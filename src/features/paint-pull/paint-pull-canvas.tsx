import {
  Canvas,
  Circle,
  Group,
  Line,
  Path,
  Rect,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

/* Reanimated gestures intentionally mutate UI-thread shared values. */
/* eslint-disable react-hooks/immutability */

const HANDLE_TOP = 54;
const HANDLE_BOTTOM_INSET = 68;
const HANDLE_HEAD_HEIGHT = 22;

export const paintPalettes = [
  ['#FF493D', '#FFBE24', '#24B879', '#1487F4', '#F05AB5', '#17191D'],
  ['#FF6542', '#FFD43B', '#75D8C4', '#218CE8', '#9659E8', '#24252A'],
  ['#F44174', '#FF9F1C', '#F6DD38', '#25B79F', '#5B7CFA', '#151519'],
  ['#E94B35', '#F4C945', '#55C1D8', '#5A74D6', '#E787B7', '#202126'],
] as const;

type MarkKind = 'beads' | 'curve' | 'dash' | 'dot';

type MarkSpec = {
  angle: number;
  color: string;
  id: number;
  kind: MarkKind;
  length: number;
  size: number;
  x: number;
  y: number;
};

type RibbonSpec = {
  color: string;
  id: number;
  phase: number;
  sway: number;
  width: number;
  x: number;
};

type PaintPullCanvasProps = {
  height: number;
  palette: readonly string[];
  resetSignal: number;
  seed: number;
  width: number;
};

function mulberry32(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function makeComposition(
  width: number,
  height: number,
  palette: readonly string[],
  seed: number,
) {
  const random = mulberry32(seed);
  const marks: MarkSpec[] = [];
  const markCount = Math.round(62 + width / 12);

  for (let index = 0; index < markCount; index += 1) {
    const roll = random();
    const kind: MarkKind =
      roll < 0.3 ? 'dot' : roll < 0.58 ? 'dash' : roll < 0.8 ? 'beads' : 'curve';
    marks.push({
      angle: random() * Math.PI * 2,
      color: palette[Math.floor(random() * palette.length)],
      id: index,
      kind,
      length: 9 + random() * 30,
      size: 2.2 + random() * 4.2,
      x: 20 + random() * (width - 40),
      y: 28 + random() * (height - 56),
    });
  }

  const ribbonCount = Math.max(22, Math.round(width / 12));
  const ribbons: RibbonSpec[] = Array.from({ length: ribbonCount }, (_, index) => ({
    color: palette[(index + Math.floor(random() * palette.length)) % palette.length],
    id: index,
    phase: random() * Math.PI * 2,
    sway: 10 + random() * 28,
    width: width / ribbonCount + 2 + random() * 4,
    x: 8 + (index / (ribbonCount - 1)) * (width - 16) + (random() - 0.5) * 7,
  }));

  return { marks, ribbons };
}

function haptic(kind: 'grab' | 'release') {
  if (process.env.EXPO_OS !== 'ios') {
    return;
  }
  const style =
    kind === 'grab'
      ? Haptics.ImpactFeedbackStyle.Medium
      : Haptics.ImpactFeedbackStyle.Soft;
  Haptics.impactAsync(style).catch(() => undefined);
}

function PatternMark({ handleY, spec }: { handleY: SharedValue<number>; spec: MarkSpec }) {
  const opacity = useDerivedValue(() => {
    const distance = spec.y - handleY.value;
    return Math.max(0, Math.min(1, distance / 15));
  });
  const dx = Math.cos(spec.angle) * spec.length;
  const dy = Math.sin(spec.angle) * spec.length;

  if (spec.kind === 'dot') {
    return <Circle color={spec.color} cx={spec.x} cy={spec.y} opacity={opacity} r={spec.size} />;
  }

  if (spec.kind === 'dash') {
    return (
      <Line
        color={spec.color}
        opacity={opacity}
        p1={vec(spec.x - dx / 2, spec.y - dy / 2)}
        p2={vec(spec.x + dx / 2, spec.y + dy / 2)}
        strokeCap="round"
        strokeWidth={spec.size}
      />
    );
  }

  if (spec.kind === 'beads') {
    return (
      <Group opacity={opacity}>
        {Array.from({ length: 5 }, (_, index) => {
          const step = (index - 2) / 4;
          return (
            <Circle
              color={spec.color}
              cx={spec.x + dx * step}
              cy={spec.y + dy * step}
              key={index}
              r={spec.size * (index === 2 ? 0.72 : 0.48)}
            />
          );
        })}
      </Group>
    );
  }

  const path = Skia.Path.Make();
  path.moveTo(spec.x - dx / 2, spec.y - dy / 2);
  path.cubicTo(
    spec.x - dx * 0.12 - dy * 0.5,
    spec.y - dy * 0.12 + dx * 0.5,
    spec.x + dx * 0.12 + dy * 0.5,
    spec.y + dy * 0.12 - dx * 0.5,
    spec.x + dx / 2,
    spec.y + dy / 2,
  );
  return (
    <Path
      color={spec.color}
      opacity={opacity}
      path={path}
      strokeCap="round"
      strokeWidth={spec.size}
      style="stroke"
    />
  );
}

function PaintRibbon({
  handleX,
  handleY,
  spec,
}: {
  handleX: SharedValue<number>;
  handleY: SharedValue<number>;
  spec: RibbonSpec;
}) {
  const path = useDerivedValue(() => {
    const bottom = Math.max(4, handleY.value - HANDLE_HEAD_HEIGHT * 0.35);
    const pull = handleX.value * 0.58;
    const waveA = Math.sin(spec.phase + bottom * 0.012) * spec.sway;
    const waveB = Math.cos(spec.phase * 1.3 + bottom * 0.009) * spec.sway * 0.72;
    const result = Skia.Path.Make();
    result.moveTo(spec.x + Math.sin(spec.phase) * 3, -8);
    result.cubicTo(
      spec.x + waveA,
      bottom * 0.26,
      spec.x + waveB + pull * 0.22,
      bottom * 0.62,
      spec.x + pull,
      bottom + 4,
    );
    return result;
  });

  return (
    <>
      <Path
        color={spec.color}
        path={path}
        strokeCap="round"
        strokeJoin="round"
        strokeWidth={spec.width}
        style="stroke"
      />
      {spec.id % 5 === 0 ? (
        <Path
          color={spec.id % 10 === 0 ? 'rgba(255,255,255,0.78)' : 'rgba(20,20,24,0.68)'}
          path={path}
          strokeCap="round"
          strokeWidth={Math.max(1.4, spec.width * 0.18)}
          style="stroke"
        />
      ) : null}
    </>
  );
}

export function PaintPullCanvas({
  height,
  palette,
  resetSignal,
  seed,
  width,
}: PaintPullCanvasProps) {
  const composition = useMemo(
    () => makeComposition(width, height, palette, seed),
    [height, palette, seed, width],
  );
  const handleX = useSharedValue(0);
  const handleY = useSharedValue(HANDLE_TOP);
  const startX = useSharedValue(0);
  const startY = useSharedValue(HANDLE_TOP);
  const tilt = useSharedValue(0);
  const grabbed = useSharedValue(0);
  useEffect(() => {
    handleX.value = withSpring(0, { damping: 20, stiffness: 220 });
    handleY.value = withSpring(HANDLE_TOP, { damping: 20, stiffness: 220 });
    tilt.value = withSpring(0, { damping: 20, stiffness: 220 });
  }, [handleX, handleY, resetSignal, tilt]);

  const pan = Gesture.Pan()
    .maxPointers(1)
    .minDistance(1)
    .onBegin(() => {
      startX.value = handleX.value;
      startY.value = handleY.value;
      grabbed.value = 1;
      runOnJS(haptic)('grab');
    })
    .onUpdate((event) => {
      handleY.value = Math.max(
        HANDLE_TOP,
        Math.min(height - HANDLE_BOTTOM_INSET, startY.value + event.translationY),
      );
      handleX.value = Math.max(-42, Math.min(42, startX.value + event.translationX * 0.38));
      tilt.value = Math.max(-5.5, Math.min(5.5, event.velocityX * 0.005));
    })
    .onFinalize(() => {
      grabbed.value = 0;
      tilt.value = withSpring(0, { damping: 18, stiffness: 210 });
      runOnJS(haptic)('release');
    });

  const handleStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: handleX.value },
      { translateY: handleY.value - HANDLE_HEAD_HEIGHT / 2 },
      { rotate: `${tilt.value}deg` },
      { scale: 1 + grabbed.value * 0.012 },
    ],
  }));

  return (
    <GestureDetector gesture={pan}>
      <View
        accessibilityHint="Drag down to pull the color pattern into paint ribbons"
        accessibilityLabel="Interactive paint pull canvas"
        accessibilityRole="adjustable"
        style={{ height, width }}>
        <Canvas pointerEvents="none" style={{ height, width }}>
          <Rect color="#F8F7F2" height={height} width={width} x={0} y={0} />
          <Group opacity={0.42}>
            {Array.from({ length: 12 }, (_, index) => (
              <Line
                color="#D7D4CC"
                key={index}
                p1={vec(0, 42 + index * 54)}
                p2={vec(width, 42 + index * 54)}
                strokeWidth={0.5}
              />
            ))}
          </Group>

          {composition.ribbons.map((spec) => (
            <PaintRibbon handleX={handleX} handleY={handleY} key={spec.id} spec={spec} />
          ))}

          {composition.marks.map((spec) => (
            <PatternMark handleY={handleY} key={spec.id} spec={spec} />
          ))}
        </Canvas>

        <Animated.View
          pointerEvents="none"
          style={[
            {
              alignItems: 'center',
              left: width * 0.07,
              position: 'absolute',
              top: 0,
              width: width * 0.86,
            },
            handleStyle,
          ]}>
          <View
            style={{
              backgroundColor: '#F6F6F4',
              borderColor: 'rgba(28,28,30,0.16)',
              borderCurve: 'continuous',
              borderRadius: 8,
              borderWidth: 0.75,
              boxShadow: '0 5px 12px rgba(28,28,30,0.18)',
              height: HANDLE_HEAD_HEIGHT,
              width: '100%',
            }}>
            <View
              style={{
                backgroundColor: 'rgba(38,38,42,0.14)',
                borderRadius: 1,
                bottom: 3,
                height: 2,
                left: 9,
                position: 'absolute',
                right: 9,
              }}
            />
          </View>
          <View
            style={{
              backgroundColor: '#EFEFEC',
              borderColor: 'rgba(28,28,30,0.14)',
              borderTopWidth: 0,
              borderWidth: 0.75,
              height: 18,
              width: 56,
            }}
          />
          <View
            style={{
              backgroundColor: '#F8F8F6',
              borderColor: 'rgba(28,28,30,0.17)',
              borderCurve: 'continuous',
              borderRadius: 13,
              borderWidth: 0.75,
              boxShadow: '0 5px 10px rgba(28,28,30,0.16)',
              height: 62,
              width: 30,
            }}>
            <View
              style={{
                backgroundColor: 'rgba(28,28,30,0.12)',
                borderRadius: 2,
                height: 28,
                left: 12,
                position: 'absolute',
                top: 16,
                width: 5,
              }}
            />
          </View>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}
