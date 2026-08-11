import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  Line,
  Path,
  Shader,
  vec,
} from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { metalStickerEffect } from '@/features/folio-shuffle/metal-sticker-shader';

/* Reanimated gesture worklets intentionally mutate UI-thread shared values. */
/* eslint-disable react-hooks/immutability */

export type StickerShape = 'bloom' | 'comet' | 'moth' | 'shell' | 'star';
export type MetalFinish = 'copper' | 'pearl' | 'verdigris';

export type StickerSpec = {
  angle: number;
  finish: MetalFinish;
  id: string;
  shape: StickerShape;
  size: number;
  x: number;
  y: number;
};

type StickerPosition = {
  x: number;
  y: number;
};

type MetalStickerProps = {
  interactive?: boolean;
  onLiftChange?: (lifted: boolean, finish: MetalFinish) => void;
  onMove?: (id: string, position: StickerPosition) => void;
  pageHeight: number;
  pageWidth: number;
  position?: StickerPosition;
  shaderClock: SharedValue<number>;
  spec: StickerSpec;
};

const shapePaths: Record<StickerShape, string> = {
  bloom:
    'M50 8 C59 8 62 22 66 27 C74 20 88 18 92 27 C96 36 83 44 77 49 C85 55 94 67 88 76 C82 85 69 78 61 75 C59 84 56 94 47 93 C38 92 38 79 37 72 C28 77 14 80 10 70 C6 60 19 52 26 47 C18 40 10 29 17 21 C24 13 37 22 43 28 C44 19 42 8 50 8 Z',
  comet:
    'M63 16 C76 17 86 29 86 42 C86 56 75 68 61 70 C50 72 42 67 35 60 L12 87 L27 53 C22 47 20 40 22 33 C25 21 38 14 50 17 C54 16 58 15 63 16 Z',
  moth:
    'M49 20 C43 12 33 6 24 11 C14 16 16 31 25 42 C13 45 6 54 10 65 C15 78 31 75 43 65 L50 91 L57 65 C69 75 85 78 90 65 C94 54 87 45 75 42 C84 31 86 16 76 11 C67 6 57 12 51 20 Z',
  shell:
    'M13 76 C14 46 29 18 50 12 C71 18 86 46 87 76 C76 85 64 90 50 90 C36 90 24 85 13 76 Z',
  star:
    'M50 8 C56 21 58 30 61 37 C70 31 78 24 91 23 C86 37 78 45 70 51 C80 58 87 67 89 81 C74 78 65 71 57 64 C54 74 51 83 42 92 C38 78 39 68 41 58 C30 63 20 66 7 61 C18 49 28 44 38 40 C31 31 26 22 26 9 C38 17 44 26 50 36 C53 25 50 17 50 8 Z',
};

const finishes: Record<
  MetalFinish,
  { dark: number[]; light: number[]; mid: number[]; next: MetalFinish }
> = {
  copper: {
    dark: [0.24, 0.08, 0.04],
    light: [1, 0.78, 0.48],
    mid: [0.78, 0.26, 0.12],
    next: 'verdigris',
  },
  pearl: {
    dark: [0.18, 0.2, 0.26],
    light: [1, 0.98, 0.86],
    mid: [0.58, 0.68, 0.82],
    next: 'copper',
  },
  verdigris: {
    dark: [0.02, 0.18, 0.17],
    light: [0.74, 1, 0.82],
    mid: [0.1, 0.58, 0.5],
    next: 'pearl',
  },
};

function hapticLift() {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
  }
}

function hapticFinish() {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.selectionAsync().catch(() => undefined);
  }
}

function StickerDetails({ shape }: { shape: StickerShape }) {
  const line = '#FFF9EA';

  if (shape === 'bloom') {
    return (
      <>
        <Circle color={line} cx={50} cy={50} r={10} style="stroke" strokeWidth={3.2} />
        {[0, 45, 90, 135].map((angle) => {
          const radians = (angle * Math.PI) / 180;
          return (
            <Line
              color={line}
              key={angle}
              p1={vec(50 - Math.cos(radians) * 29, 50 - Math.sin(radians) * 29)}
              p2={vec(50 + Math.cos(radians) * 29, 50 + Math.sin(radians) * 29)}
              strokeCap="round"
              strokeWidth={2.3}
            />
          );
        })}
      </>
    );
  }

  if (shape === 'moth') {
    return (
      <>
        <Path color={line} path="M50 22 L50 78" strokeCap="round" strokeWidth={3} style="stroke" />
        <Path
          color={line}
          path="M45 44 C33 30 25 27 20 27 M55 44 C67 30 75 27 80 27 M43 59 C30 63 23 60 18 56 M57 59 C70 63 77 60 82 56"
          strokeCap="round"
          strokeWidth={2.2}
          style="stroke"
        />
      </>
    );
  }

  if (shape === 'shell') {
    return (
      <>
        {[28, 39, 50, 61, 72].map((x) => (
          <Path
            color={line}
            key={x}
            path={`M50 20 Q${x} 48 ${x} 78`}
            strokeCap="round"
            strokeWidth={2.2}
            style="stroke"
          />
        ))}
        <Path color={line} path="M22 73 Q50 84 78 73" strokeWidth={2.4} style="stroke" />
      </>
    );
  }

  if (shape === 'comet') {
    return (
      <>
        <Circle color={line} cx={55} cy={42} r={18} style="stroke" strokeWidth={2.7} />
        <Path
          color={line}
          path="M22 71 L40 52 M17 82 L34 65 M35 82 L44 68"
          strokeCap="round"
          strokeWidth={2.5}
          style="stroke"
        />
      </>
    );
  }

  return (
    <>
      <Path
        color={line}
        path="M50 26 L50 69 M27 55 Q50 46 73 55 M37 35 Q50 45 63 35"
        strokeCap="round"
        strokeWidth={2.7}
        style="stroke"
      />
      <Circle color={line} cx={50} cy={50} r={6} style="stroke" strokeWidth={2.4} />
    </>
  );
}

function StickerCanvas({
  finish,
  flash,
  lift,
  shape,
  shaderClock,
  size,
  tiltX,
  tiltY,
}: {
  finish: MetalFinish;
  flash: SharedValue<number>;
  lift: SharedValue<number>;
  shape: StickerShape;
  shaderClock: SharedValue<number>;
  size: number;
  tiltX: SharedValue<number>;
  tiltY: SharedValue<number>;
}) {
  const palette = finishes[finish];
  const canvasSize = size + 32;
  const scale = size / 100;
  const shadowTransform = useDerivedValue(() => [
    { translateX: 4 + lift.value * 8 },
    { translateY: 6 + lift.value * 10 },
  ]);
  const shadowOpacity = useDerivedValue(() => 0.15 + lift.value * 0.23);
  const uniforms = useDerivedValue(() => ({
    darkColor: palette.dark,
    flash: flash.value,
    lift: lift.value,
    lightColor: palette.light,
    midColor: palette.mid,
    size: [100, 100],
    tilt: [tiltX.value, tiltY.value],
    time: shaderClock.value / 1000,
  }));

  return (
    <Canvas pointerEvents="none" style={{ height: canvasSize, width: canvasSize }}>
      <Group transform={[{ translateX: 16 }, { translateY: 16 }, { scale }]}>
        <Group opacity={shadowOpacity} transform={shadowTransform}>
          <Path color="#060706" path={shapePaths[shape]}>
            <BlurMask blur={4.5} respectCTM />
          </Path>
        </Group>
        <Path
          color="#FFF9EA"
          path={shapePaths[shape]}
          strokeJoin="round"
          strokeWidth={10}
          style="stroke"
        />
        {metalStickerEffect ? (
          <Path path={shapePaths[shape]}>
            <Shader source={metalStickerEffect} uniforms={uniforms} />
          </Path>
        ) : (
          <Path
            color={
              finish === 'copper' ? '#C85B32' : finish === 'verdigris' ? '#2E9684' : '#A8B9D2'
            }
            path={shapePaths[shape]}
          />
        )}
        <Path
          color="rgba(25,28,25,0.42)"
          path={shapePaths[shape]}
          strokeJoin="round"
          strokeWidth={1.8}
          style="stroke"
        />
        <StickerDetails shape={shape} />
      </Group>
    </Canvas>
  );
}

function MetalStickerBase({
  interactive = true,
  onLiftChange,
  onMove,
  pageHeight,
  pageWidth,
  position,
  shaderClock,
  spec,
}: MetalStickerProps) {
  const [finish, setFinish] = useState<MetalFinish>(spec.finish);
  const maxX = Math.max(0, pageWidth - spec.size);
  const maxY = Math.max(0, pageHeight - spec.size);
  const initialX = (position?.x ?? spec.x) * maxX;
  const initialY = (position?.y ?? spec.y) * maxY;
  const x = useSharedValue(initialX);
  const y = useSharedValue(initialY);
  const startX = useSharedValue(initialX);
  const startY = useSharedValue(initialY);
  const lift = useSharedValue(0);
  const flash = useSharedValue(0);
  const tiltX = useSharedValue(0);
  const tiltY = useSharedValue(0);

  useEffect(() => {
    x.value = withSpring(initialX, { damping: 20, stiffness: 220 });
    y.value = withSpring(initialY, { damping: 20, stiffness: 220 });
  }, [initialX, initialY, x, y]);

  const cycleFinish = useCallback(() => {
    // Must stay pure: React may run a state updater during render, so the
    // parent notification cannot live inside setFinish.
    const next = finishes[finish].next;
    setFinish(next);
    onLiftChange?.(false, next);
    hapticFinish();
    flash.value = 0;
    flash.value = withSequence(
      withTiming(1, { duration: 120 }),
      withTiming(0, { duration: 620 }),
    );
  }, [finish, flash, onLiftChange]);

  const reportLift = useCallback(
    (lifted: boolean) => {
      onLiftChange?.(lifted, finish);
      if (lifted) hapticLift();
    },
    [finish, onLiftChange],
  );

  const reportMove = useCallback(
    (nextX: number, nextY: number) => {
      onMove?.(spec.id, {
        x: maxX > 0 ? nextX / maxX : 0,
        y: maxY > 0 ? nextY / maxY : 0,
      });
    },
    [maxX, maxY, onMove, spec.id],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(interactive)
        .activateAfterLongPress(280)
        .maxPointers(1)
        .onStart(() => {
          startX.value = x.value;
          startY.value = y.value;
          lift.value = withSpring(1, { damping: 15, stiffness: 260 });
          flash.value = withSequence(
            withTiming(0.8, { duration: 130 }),
            withTiming(0, { duration: 680 }),
          );
          runOnJS(reportLift)(true);
        })
        .onUpdate((event) => {
          x.value = Math.max(0, Math.min(maxX, startX.value + event.translationX));
          y.value = Math.max(0, Math.min(maxY, startY.value + event.translationY));
          tiltX.value = Math.max(-45, Math.min(45, event.velocityX * 0.025));
          tiltY.value = Math.max(-45, Math.min(45, event.velocityY * 0.025));
        })
        .onEnd(() => {
          lift.value = withSpring(0, { damping: 17, stiffness: 240 });
          tiltX.value = withSpring(0);
          tiltY.value = withSpring(0);
          runOnJS(reportMove)(x.value, y.value);
          runOnJS(reportLift)(false);
        })
        .onFinalize(() => {
          lift.value = withSpring(0, { damping: 17, stiffness: 240 });
          tiltX.value = withSpring(0);
          tiltY.value = withSpring(0);
        }),
    [
      flash,
      interactive,
      lift,
      maxX,
      maxY,
      reportLift,
      reportMove,
      startX,
      startY,
      tiltX,
      tiltY,
      x,
      y,
    ],
  );

  const tap = useMemo(
    () =>
      Gesture.Tap()
        .enabled(interactive)
        .maxDistance(10)
        .maxDuration(230)
        .onEnd(() => {
          runOnJS(cycleFinish)();
        }),
    [cycleFinish, interactive],
  );

  const gesture = useMemo(() => Gesture.Exclusive(pan, tap), [pan, tap]);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value - 16 },
      { translateY: y.value - 16 },
      { rotate: `${spec.angle + tiltX.value * 0.05}deg` },
      { scale: 1 + lift.value * 0.085 },
      { translateY: lift.value * -7 },
    ],
    zIndex: lift.value > 0.01 ? 20 : 4,
  }));

  const sticker = (
    <Animated.View
      accessibilityHint="Tap to change its metal finish. Hold, then drag to move it."
      accessibilityLabel={`${finish} ${spec.shape} sticker`}
      accessibilityRole="adjustable"
      style={[
        {
          height: spec.size + 32,
          left: 0,
          position: 'absolute',
          top: 0,
          width: spec.size + 32,
        },
        animatedStyle,
      ]}>
      <StickerCanvas
        finish={finish}
        flash={flash}
        lift={lift}
        shape={spec.shape}
        shaderClock={shaderClock}
        size={spec.size}
        tiltX={tiltX}
        tiltY={tiltY}
      />
    </Animated.View>
  );

  if (!interactive) return sticker;
  return <GestureDetector gesture={gesture}>{sticker}</GestureDetector>;
}

// Memoized so parent state changes (lift indicator, snapshot nonce, another
// sticker moving) don't re-render every sticker's Skia canvas. Props are stable
// refs: `spec`/`shaderClock` never change, `position` keeps its identity for
// stickers that didn't move, and the handlers are memoized upstream.
export const MetalSticker = memo(MetalStickerBase);
