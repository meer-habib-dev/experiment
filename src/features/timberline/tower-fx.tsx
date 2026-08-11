import { Canvas, Circle, Group, RadialGradient, Rect, vec } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { StyleSheet, View } from 'react-native';

export type TowerPulse = {
  id: number;
  kind: 'danger' | 'pull' | 'reset';
  x: number;
  y: number;
};

export function TowerFx({
  height,
  pulse,
  stability,
  width,
}: {
  height: number;
  pulse: TowerPulse;
  stability: number;
  width: number;
}) {
  const danger = useSharedValue(0);
  const ripple = useSharedValue(1);

  useEffect(() => {
    danger.value = withTiming(Math.max(0, (42 - stability) / 42), { duration: 260 });
  }, [danger, stability]);

  useEffect(() => {
    ripple.value = 0;
    ripple.value = withTiming(1, { duration: pulse.kind === 'danger' ? 520 : 360 });
  }, [pulse, ripple]);

  const dangerOpacity = useDerivedValue(() => danger.value * 0.12);
  const rippleOpacity = useDerivedValue(() => (1 - ripple.value) * 0.8);
  const rippleRadius = useDerivedValue(() => 18 + ripple.value * 62);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Canvas style={{ flex: 1 }}>
        <Rect height={height} width={width} x={0} y={0}>
          <RadialGradient
            c={vec(width / 2, height * 0.5)}
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,.38)']}
            r={Math.max(width, height) * 0.72}
          />
        </Rect>
        <Rect color="#e8492c" height={height} opacity={dangerOpacity} width={width} x={0} y={0} />
        {pulse.kind !== 'reset' ? (
          <Group opacity={rippleOpacity}>
            <Circle
              color={pulse.kind === 'danger' ? '#ff7658' : '#ffe0aa'}
              cx={pulse.x * width}
              cy={pulse.y * height}
              r={rippleRadius}
              style="stroke"
              strokeWidth={1.5}
            />
            <Circle
              color="#fff8e9"
              cx={pulse.x * width}
              cy={pulse.y * height}
              r={4}
            />
          </Group>
        ) : null}
      </Canvas>
    </View>
  );
}
