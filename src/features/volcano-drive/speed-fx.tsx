import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  Line,
  RadialGradient,
  Rect,
  useClock,
  vec,
} from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { useDerivedValue, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { View } from '@/tw';

export type FxKind = 'checkpoint' | 'coin' | 'crash' | 'drive' | 'magnet' | 'near-miss' | 'turbo';

const streaks = [
  [0.03, 0.09, -24, 110],
  [0.11, 0.28, -18, 84],
  [0.19, 0.57, -14, 72],
  [0.27, 0.16, -10, 56],
  [0.34, 0.73, -8, 49],
  [0.42, 0.39, -5, 43],
  [0.58, 0.62, 5, 48],
  [0.66, 0.2, 8, 59],
  [0.74, 0.77, 12, 78],
  [0.82, 0.47, 16, 88],
  [0.9, 0.14, 21, 102],
  [0.97, 0.68, 28, 126],
] as const;

const flashColors: Record<FxKind, string> = {
  checkpoint: '#fff2a8',
  coin: '#ffd72f',
  crash: '#ff351f',
  drive: '#ffffff',
  magnet: '#4dff9a',
  'near-miss': '#ffffff',
  turbo: '#ff8a18',
};

export function SpeedFx({
  crash,
  height,
  magnet,
  pulse,
  turbo,
  width,
}: {
  crash: boolean;
  height: number;
  magnet: boolean;
  pulse: { id: number; kind: FxKind };
  turbo: boolean;
  width: number;
}) {
  const clock = useClock();
  const flash = useSharedValue(0);
  const crashShade = useSharedValue(0);

  useEffect(() => {
    const peak = pulse.kind === 'crash' ? 0.78 : pulse.kind === 'checkpoint' ? 0.42 : 0.26;
    flash.value = withSequence(
      withTiming(peak, { duration: pulse.kind === 'crash' ? 45 : 70 }),
      withTiming(0, { duration: pulse.kind === 'crash' ? 420 : 260 }),
    );
  }, [flash, pulse]);

  useEffect(() => {
    crashShade.value = withTiming(crash ? 0.48 : 0, { duration: crash ? 520 : 180 });
  }, [crash, crashShade]);

  const transform = useDerivedValue(() => [
    { translateY: ((clock.value * (turbo ? 1.08 : 0.3)) % (height + 240)) - 120 },
  ]);
  const magnetOpacity = useDerivedValue(() =>
    magnet ? 0.28 + (Math.sin(clock.value * 0.008) + 1) * 0.16 : 0,
  );
  const magnetScale = useDerivedValue(() => 54 + ((clock.value * 0.11) % 58));

  return (
    <View className="pointer-events-none absolute inset-0">
      <Canvas style={{ flex: 1 }}>
        <Group opacity={turbo ? 0.9 : 0.25} transform={transform}>
          {[0, 1].map((repeat) =>
            streaks.map(([x, y, dx, length], index) => (
              <Line
                color={index % 4 === 0 ? '#ff8c5e' : '#fff4e9'}
                key={`${repeat}-${x}-${y}`}
                p1={vec(x * width, y * height + repeat * height - height)}
                p2={vec(x * width + dx, y * height + repeat * height - height + length)}
                strokeCap="round"
                strokeWidth={turbo ? 2.8 : 1.15}
              />
            )),
          )}
        </Group>

        {turbo ? (
          <Group opacity={0.46}>
            <Rect height={height} width={width} x={0} y={0}>
              <RadialGradient
                c={vec(width / 2, height * 0.9)}
                colors={['rgba(255,96,15,.32)', 'rgba(255,96,15,0)']}
                r={height * 0.58}
              />
            </Rect>
          </Group>
        ) : null}

        <Group opacity={magnetOpacity}>
          <Circle
            color="#55ff98"
            cx={width / 2}
            cy={height * 0.82}
            r={magnetScale}
            style="stroke"
            strokeWidth={3}>
            <BlurMask blur={8} style="solid" />
          </Circle>
          <Circle
            color="#b4ffd1"
            cx={width / 2}
            cy={height * 0.82}
            r={94}
            style="stroke"
            strokeWidth={1.5}
          />
        </Group>

        <Rect height={height} opacity={crashShade} width={width} x={0} y={0} color="#160004" />
        <Rect
          color={flashColors[pulse.kind]}
          height={height}
          opacity={flash}
          width={width}
          x={0}
          y={0}
        />

        <Rect height={height} width={width} x={0} y={0}>
          <RadialGradient
            c={vec(width / 2, height * 0.54)}
            colors={['rgba(0,0,0,0)', 'rgba(5,0,3,.42)']}
            r={height * 0.68}
          />
        </Rect>
      </Canvas>
    </View>
  );
}
