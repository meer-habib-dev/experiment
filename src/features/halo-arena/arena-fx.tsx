import {
  Canvas,
  Circle,
  Group,
  LinearGradient,
  RadialGradient,
  Rect,
  RoundedRect,
  vec,
} from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export type ArenaPulse = {
  id: number;
  kind: 'added' | 'idle' | 'removed' | 'unavailable';
  x: number;
  y: number;
};

export function ArenaFx({
  height,
  pulse,
  selected,
  width,
}: {
  height: number;
  pulse: ArenaPulse;
  selected: number;
  width: number;
}) {
  const ripple = useSharedValue(1);
  const scan = useSharedValue(0);
  const selectedGlow = useSharedValue(0);

  useEffect(() => {
    scan.value = withRepeat(
      withTiming(1, { duration: 5600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [scan]);

  useEffect(() => {
    ripple.value = 0;
    ripple.value = withTiming(1, { duration: pulse.kind === 'unavailable' ? 520 : 430 });
  }, [pulse, ripple]);

  useEffect(() => {
    selectedGlow.value = withTiming(Math.min(1, selected / 3), { duration: 280 });
  }, [selected, selectedGlow]);

  const rippleOpacity = useDerivedValue(() => (1 - ripple.value) * 0.88);
  const rippleRadius = useDerivedValue(() => 14 + ripple.value * 74);
  const scanY = useDerivedValue(() => height * 0.18 + scan.value * height * 0.48);
  const glowOpacity = useDerivedValue(() => 0.04 + selectedGlow.value * 0.06);
  const pulseColor =
    pulse.kind === 'unavailable'
      ? '#ff6577'
      : pulse.kind === 'removed'
        ? '#8fb6be'
        : '#d8ff36';

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Canvas style={{ flex: 1 }}>
        <Rect height={height} width={width} x={0} y={0}>
          <RadialGradient
            c={vec(width / 2, height * 0.44)}
            colors={['rgba(0,0,0,0)', 'rgba(1,6,11,.62)']}
            r={Math.max(width, height) * 0.73}
          />
        </Rect>
        <Rect height={height} opacity={glowOpacity} width={width} x={0} y={0}>
          <LinearGradient
            colors={['#65fff200', '#76f8e3', '#a976ff00']}
            end={vec(width, height)}
            start={vec(0, 0)}
          />
        </Rect>
        <RoundedRect height={1} opacity={0.16} r={1} width={width * 0.66} x={width * 0.17} y={scanY}>
          <LinearGradient
            colors={['#74fff000', '#b9fff6', '#a581ff00']}
            end={vec(width * 0.83, 0)}
            start={vec(width * 0.17, 0)}
          />
        </RoundedRect>
        {pulse.kind !== 'idle' ? (
          <Group opacity={rippleOpacity}>
            <Circle
              color={pulseColor}
              cx={pulse.x * width}
              cy={pulse.y * height}
              r={rippleRadius}
              style="stroke"
              strokeWidth={1.7}
            />
            <Circle color="#f8fff5" cx={pulse.x * width} cy={pulse.y * height} r={3.5} />
          </Group>
        ) : null}
      </Canvas>
    </View>
  );
}
