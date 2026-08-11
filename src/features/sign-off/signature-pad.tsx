import {
  Button as SwiftButton,
  ContextMenu,
  Host,
  HStack as SwiftHStack,
  Image as SwiftImage,
  Text as SwiftText,
} from '@expo/ui/swift-ui';
import {
  buttonBorderShape,
  buttonStyle,
  disabled as disabledModifier,
  font,
  foregroundStyle,
  padding,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { Canvas, Path, Skia, type SkPath } from '@shopify/react-native-skia';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useCallback, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { eraserEffects, type ParticleField } from '@/features/sign-off/eraser-effects';
import { InkParticles } from '@/features/sign-off/ink-particles';
import {
  measurePathLength,
  sampleInkParticles,
  type StrokeRecord,
} from '@/features/sign-off/ink-sampler';

/* Gesture callbacks intentionally bridge to JS and mutate UI-thread shared values. */
/* eslint-disable react-hooks/immutability, react-hooks/refs */

export const signOffPalette = {
  backdrop: '#E9E9E6',
  canvas: '#F5F5F2',
  card: '#FDFDFC',
  ink: '#1B1B1F',
  line: 'rgba(27,27,31,0.09)',
  muted: '#8E8E88',
  pill: '#1A1B1D',
};

const STROKE_WIDTH = 2.5;
const IS_IOS = process.env.EXPO_OS === 'ios';
const HAS_GLASS = isLiquidGlassAvailable();

type Stroke = StrokeRecord & { id: number };

function haptic(kind: 'clear' | 'cycle' | 'done') {
  if (process.env.EXPO_OS !== 'ios') {
    return;
  }
  if (kind === 'cycle') {
    Haptics.selectionAsync().catch(() => undefined);
  } else if (kind === 'clear') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
  } else {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => undefined);
  }
}

function SfIcon({ color, name, size = 16 }: { color: string; name: string; size?: number }) {
  return (
    <Image
      contentFit="contain"
      source={`sf:${name}`}
      style={{ height: size, tintColor: color, width: size }}
    />
  );
}

/**
 * One committed stroke. While a Rewind erase is running, `end` trims the
 * path so the whole signature un-draws itself in reverse draw order.
 */
function TrimStroke({
  length,
  path,
  prefix,
  progress,
  total,
  trimActive,
}: {
  length: number;
  path: SkPath;
  prefix: number;
  progress: SharedValue<number>;
  total: number;
  trimActive: SharedValue<number>;
}) {
  const end = useDerivedValue(() => {
    if (trimActive.value === 0) {
      return 1;
    }
    const visible = (1 - progress.value) * total;
    const fraction = (visible - prefix) / length;
    return fraction < 0 ? 0 : fraction > 1 ? 1 : fraction;
  });
  return (
    <Path
      color={signOffPalette.ink}
      end={end}
      path={path}
      start={0}
      strokeCap="round"
      strokeJoin="round"
      strokeWidth={STROKE_WIDTH}
      style="stroke"
    />
  );
}

type SignaturePadProps = {
  onClose: () => void;
  width: number;
};

export function SignaturePad({ onClose, width }: SignaturePadProps) {
  const canvasWidth = width - 36;
  const canvasHeight = Math.round(canvasWidth * 0.84);

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [effectIndex, setEffectIndex] = useState(0);
  const [erasing, setErasing] = useState(false);
  const strokeId = useRef(0);

  const effect = eraserEffects[effectIndex];
  const totalLength = strokes.reduce((sum, stroke) => sum + stroke.length, 0);
  const hasInkRef = useRef(false);
  hasInkRef.current = strokes.length > 0;

  /* Live drawing */
  const livePath = useSharedValue(Skia.Path.Make());
  const lastX = useSharedValue(0);
  const lastY = useSharedValue(0);
  const drawing = useSharedValue(0);
  const blockDraw = useSharedValue(0);
  const hintOpacity = useSharedValue(1);

  /* Erase animation */
  const progress = useSharedValue(0);
  const particlesActive = useSharedValue(0);
  const trimActive = useSharedValue(0);
  const particleCount = useSharedValue(0);
  const particleData = useSharedValue<number[]>([]);
  const effectIndexSv = useSharedValue(0);
  const field = useSharedValue<ParticleField>({ cx: 0, cy: 0, h: 1, w: 1 });

  const commitStroke = useCallback(() => {
    const committed = livePath.value.copy();
    livePath.modify((path) => {
      'worklet';
      path.reset();
      return path;
    });
    const length = measurePathLength(committed);
    if (length < 0.5) {
      return;
    }
    strokeId.current += 1;
    const id = strokeId.current;
    setStrokes((current) => [...current, { id, length, path: committed }]);
  }, [livePath]);

  const pan = Gesture.Pan()
    .maxPointers(1)
    .minDistance(1)
    .onBegin((event) => {
      if (blockDraw.value === 1) {
        return;
      }
      drawing.value = 1;
      hintOpacity.value = withTiming(0, { duration: 160 });
      lastX.value = event.x;
      lastY.value = event.y;
      livePath.modify((path) => {
        'worklet';
        path.moveTo(event.x, event.y);
        return path;
      });
    })
    .onUpdate((event) => {
      if (drawing.value === 0) {
        return;
      }
      const midX = (lastX.value + event.x) / 2;
      const midY = (lastY.value + event.y) / 2;
      const fromX = lastX.value;
      const fromY = lastY.value;
      livePath.modify((path) => {
        'worklet';
        path.quadTo(fromX, fromY, midX, midY);
        return path;
      });
      lastX.value = event.x;
      lastY.value = event.y;
    })
    .onFinalize(() => {
      if (drawing.value === 0) {
        return;
      }
      drawing.value = 0;
      const endX = lastX.value;
      const endY = lastY.value;
      livePath.modify((path) => {
        'worklet';
        path.lineTo(endX, endY);
        return path;
      });
      runOnJS(commitStroke)();
    });

  const finishErase = useCallback(() => {
    particlesActive.value = 0;
    trimActive.value = 0;
    blockDraw.value = 0;
    if (!hasInkRef.current) {
      hintOpacity.value = withTiming(1, { duration: 260 });
    }
    setErasing(false);
    haptic('done');
  }, [blockDraw, hintOpacity, particlesActive, trimActive]);

  const finishRewind = useCallback(() => {
    hasInkRef.current = false;
    setStrokes([]);
    finishErase();
  }, [finishErase]);

  const handleClear = () => {
    if (erasing || strokes.length === 0) {
      return;
    }
    haptic('clear');
    effectIndexSv.value = effectIndex;

    if (effect.kind === 'particles') {
      const sample = sampleInkParticles(strokes);
      if (!sample) {
        return;
      }
      particleData.value = sample.data;
      particleCount.value = sample.count;
      field.value = { cx: sample.cx, cy: sample.cy, h: canvasHeight, w: canvasWidth };
      particlesActive.value = 1;
      progress.value = 0;
      progress.value = withTiming(
        1,
        { duration: effect.duration, easing: Easing.linear },
        (finished) => {
          if (finished) {
            runOnJS(finishErase)();
          }
        },
      );
      /* The strokes leave the tree on the same commit the dust appears. */
      setStrokes([]);
    } else {
      const duration = Math.min(2000, 600 + totalLength * 0.6);
      trimActive.value = 1;
      blockDraw.value = 1;
      progress.value = 0;
      progress.value = withTiming(
        1,
        { duration, easing: Easing.inOut(Easing.cubic) },
        (finished) => {
          if (finished) {
            runOnJS(finishRewind)();
          }
        },
      );
    }
    setErasing(true);
  };

  const labelBump = useSharedValue(1);

  const selectEffect = (index: number) => {
    haptic('cycle');
    setEffectIndex(index % eraserEffects.length);
    labelBump.value = 0;
    labelBump.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) });
  };

  const cycleEffect = () => {
    selectEffect(effectIndex + 1);
  };

  const hintStyle = useAnimatedStyle(() => ({ opacity: hintOpacity.value }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + 0.75 * labelBump.value,
    transform: [{ translateY: (1 - labelBump.value) * 5 }],
  }));

  const hasInk = strokes.length > 0;
  let prefix = 0;

  return (
    <View
      style={{
        backgroundColor: signOffPalette.card,
        borderCurve: 'continuous',
        borderRadius: 28,
        boxShadow: '0 24px 64px rgba(20,20,24,0.12)',
        padding: 18,
        width,
      }}>
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingBottom: 14,
          paddingHorizontal: 4,
          paddingTop: 2,
        }}>
        <Text style={{ color: signOffPalette.ink, fontSize: 17, fontWeight: '600' }}>
          Sign the contract
        </Text>
        {HAS_GLASS ? (
          <Host matchContents>
            <SwiftButton
              modifiers={[
                buttonStyle('glass'),
                buttonBorderShape('circle'),
                tint(signOffPalette.ink),
              ]}
              onPress={onClose}>
              <SwiftImage color={signOffPalette.ink} size={15} systemName="xmark" />
            </SwiftButton>
          </Host>
        ) : (
          <Pressable
            accessibilityLabel="Close"
            accessibilityRole="button"
            hitSlop={12}
            onPress={onClose}
            style={({ pressed }) => ({ opacity: pressed ? 0.4 : 1 })}>
            <SfIcon color={signOffPalette.ink} name="xmark" size={17} />
          </Pressable>
        )}
      </View>

      <GestureDetector gesture={pan}>
        <View
          style={{
            backgroundColor: signOffPalette.canvas,
            borderCurve: 'continuous',
            borderRadius: 18,
            height: canvasHeight,
            overflow: 'hidden',
          }}>
          <Canvas style={{ flex: 1 }}>
            {strokes.map((stroke) => {
              const node = (
                <TrimStroke
                  key={stroke.id}
                  length={stroke.length}
                  path={stroke.path}
                  prefix={prefix}
                  progress={progress}
                  total={totalLength}
                  trimActive={trimActive}
                />
              );
              prefix += stroke.length;
              return node;
            })}
            <Path
              color={signOffPalette.ink}
              path={livePath}
              strokeCap="round"
              strokeJoin="round"
              strokeWidth={STROKE_WIDTH}
              style="stroke"
            />
            <InkParticles
              active={particlesActive}
              count={particleCount}
              data={particleData}
              effectIndex={effectIndexSv}
              field={field}
              inkColor={signOffPalette.ink}
              progress={progress}
            />
          </Canvas>
          <Animated.View
            pointerEvents="none"
            style={[
              {
                alignItems: 'center',
                bottom: 0,
                justifyContent: 'center',
                left: 0,
                position: 'absolute',
                right: 0,
                top: 0,
              },
              hintStyle,
            ]}>
            <Text style={{ color: signOffPalette.muted, fontSize: 13, fontWeight: '500' }}>
              Draw your signature
            </Text>
          </Animated.View>
        </View>
      </GestureDetector>

      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: 4,
          paddingTop: 16,
        }}>
        {IS_IOS ? (
          /* Tap cycles; long-press opens the native context menu with every effect. */
          <Host matchContents>
            <ContextMenu>
              <ContextMenu.Items>
                {eraserEffects.map((item, index) => (
                  <SwiftButton
                    key={item.id}
                    label={item.label}
                    onPress={() => selectEffect(index)}
                    systemImage={item.icon}
                  />
                ))}
              </ContextMenu.Items>
              <ContextMenu.Trigger>
                <SwiftButton modifiers={[buttonStyle('plain')]} onPress={cycleEffect}>
                  <SwiftHStack modifiers={[padding({ trailing: 28, vertical: 8 })]} spacing={7}>
                    <SwiftText
                      modifiers={[
                        font({ size: 15, weight: 'medium' }),
                        foregroundStyle(signOffPalette.ink),
                      ]}>
                      {effect.label}
                    </SwiftText>
                    <SwiftImage
                      color={signOffPalette.muted}
                      size={14}
                      systemName="arrow.2.squarepath"
                    />
                  </SwiftHStack>
                </SwiftButton>
              </ContextMenu.Trigger>
            </ContextMenu>
          </Host>
        ) : (
          <Pressable
            accessibilityLabel={`Eraser effect: ${effect.label}. Tap to change.`}
            accessibilityRole="button"
            hitSlop={14}
            onPress={cycleEffect}
            style={({ pressed }) => ({
              alignItems: 'center',
              flex: 1,
              flexDirection: 'row',
              gap: 7,
              opacity: pressed ? 0.5 : 1,
              paddingVertical: 6,
            })}>
            <Animated.Text
              style={[{ color: signOffPalette.ink, fontSize: 15, fontWeight: '500' }, labelStyle]}>
              {effect.label}
            </Animated.Text>
            <SfIcon color={signOffPalette.muted} name="arrow.2.squarepath" size={14} />
          </Pressable>
        )}

        {HAS_GLASS ? (
          <Host matchContents>
            <SwiftButton
              modifiers={[
                buttonStyle('glassProminent'),
                tint(signOffPalette.pill),
                disabledModifier(!hasInk || erasing),
              ]}
              onPress={handleClear}>
              <SwiftHStack modifiers={[padding({ horizontal: 4, vertical: 3 })]} spacing={7}>
                <SwiftImage color={signOffPalette.card} size={14} systemName="eraser" />
                <SwiftText
                  modifiers={[
                    font({ size: 15, weight: 'semibold' }),
                    foregroundStyle(signOffPalette.card),
                  ]}>
                  Clear
                </SwiftText>
              </SwiftHStack>
            </SwiftButton>
          </Host>
        ) : (
          <Pressable
            accessibilityLabel="Clear the signature"
            accessibilityRole="button"
            disabled={!hasInk || erasing}
            onPress={handleClear}
            style={({ pressed }) => ({
              alignItems: 'center',
              backgroundColor: signOffPalette.pill,
              borderRadius: 24,
              flexDirection: 'row',
              gap: 7,
              opacity: !hasInk || erasing ? 0.35 : 1,
              paddingHorizontal: 18,
              paddingVertical: 11,
              transform: [{ scale: pressed ? 0.96 : 1 }],
            })}>
            <SfIcon color={signOffPalette.card} name="eraser" size={15} />
            <Text style={{ color: signOffPalette.card, fontSize: 15, fontWeight: '600' }}>
              Clear
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
