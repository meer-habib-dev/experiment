import { Canvas, Circle, Group, Line, Path } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GestureResponderEvent } from 'react-native';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

type CreatureSeed = {
  id: number;
  x: number;
  y: number;
  size: number;
  phase: number;
  speed: number;
  drift: number;
  rotation: number;
};

type Point = { x: number; y: number };

const REFLECTIONS = [
  'Softness is a kind of intelligence.',
  'A small signal can move a whole field.',
  'Notice what responds when you slow down.',
  'Connection begins with gentle attention.',
  'Let the next breath arrive on its own.',
];

const SEEDS: CreatureSeed[] = [
  [0, .13, .17, .82, .2, .83, 18, -12], [1, .27, .12, .58, 2.1, .65, 13, 18],
  [2, .45, .20, 1.05, 4.4, .51, 17, -5], [3, .65, .13, .72, 1.2, .77, 14, 24],
  [4, .82, .21, .93, 3.5, .59, 19, -18], [5, .18, .35, .64, 5.2, .68, 12, 10],
  [6, .36, .40, 1.15, 2.9, .48, 20, -25], [7, .57, .34, .55, .7, .91, 10, 14],
  [8, .76, .41, .78, 4.8, .74, 16, 4], [9, .90, .34, .48, 1.8, .63, 9, -22],
  [10, .10, .57, .51, 3.1, .86, 12, 20], [11, .27, .62, .92, .5, .57, 17, -8],
  [12, .49, .54, .69, 5.6, .79, 14, 17], [13, .68, .61, 1.09, 2.5, .52, 21, -15],
  [14, .86, .57, .60, 4.1, .90, 11, 26], [15, .17, .78, .76, 1.4, .69, 15, -20],
  [16, .38, .82, .49, 3.8, .94, 9, 7], [17, .56, .75, .89, 5.1, .62, 18, 20],
  [18, .78, .82, .66, 2.2, .81, 13, -9], [19, .91, .74, .45, 4.7, .72, 8, 16],
].map(([id, x, y, size, phase, speed, drift, rotation]) => ({
  id, x, y, size, phase, speed, drift, rotation,
}));

function creaturePoint(seed: CreatureSeed, width: number, height: number, time: number): Point {
  const safeHeight = Math.max(520, height);
  const loop = time * .001 * seed.speed;
  return {
    x: seed.x * width + Math.sin(loop + seed.phase) * seed.drift,
    y: seed.y * safeHeight + Math.cos(loop * .76 + seed.phase * 1.31) * seed.drift * .8,
  };
}

function octopusPath(size: number, time: number, phase: number) {
  const headW = size * .42;
  const headH = size * .42;
  const commands = [
    `M ${-headW} 0`,
    `C ${-headW * .96} ${-headH} ${-headW * .48} ${-headH * 1.28} 0 ${-headH * 1.3}`,
    `C ${headW * .48} ${-headH * 1.28} ${headW * .96} ${-headH} ${headW} 0`,
    `C ${headW * .72} ${headH * .28} ${-headW * .72} ${headH * .28} ${-headW} 0`,
  ];

  for (let arm = 0; arm < 8; arm += 1) {
    const startX = (arm - 3.5) * size * .095;
    const spread = (arm - 3.5) * size * .13;
    const wave = Math.sin(time * .0022 + phase + arm * .92) * size * .18;
    const armLength = size * (.55 + (arm % 3) * .1);
    commands.push(
      `M ${startX} ${size * .04} C ${startX + wave * .3} ${size * .20} ${spread + wave} ${armLength * .72} ${spread + Math.sin(time * .0028 + arm) * size * .12} ${armLength}`,
    );
  }
  return commands.join(' ');
}

export function SignalGardenExperience() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [time, setTime] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [signalStarted, setSignalStarted] = useState(0);
  const [reflectionIndex, setReflectionIndex] = useState(0);
  const startedAt = useRef(0);

  useEffect(() => {
    startedAt.current = performance.now();
    let frame = 0;
    let previous = 0;
    const animate = (now: number) => {
      if (now - previous > 28) {
        setTime(now - startedAt.current);
        previous = now;
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  const points = useMemo(
    () => SEEDS.map((seed) => creaturePoint(seed, width, height, time)),
    [height, time, width],
  );

  const chain = useMemo(() => {
    if (selected === null) return [];
    const chosen = [selected];
    while (chosen.length < 5) {
      const from = points[chosen[chosen.length - 1]];
      let nearest = -1;
      let nearestDistance = Number.POSITIVE_INFINITY;
      points.forEach((point, index) => {
        if (chosen.includes(index)) return;
        const distance = Math.hypot(point.x - from.x, point.y - from.y);
        if (distance < nearestDistance) {
          nearest = index;
          nearestDistance = distance;
        }
      });
      if (nearest < 0) break;
      chosen.push(nearest);
    }
    return chosen;
  }, [points, selected]);

  const signalAge = selected === null ? 0 : time - signalStarted;
  const signalOpacity = Math.max(0, 1 - Math.max(0, signalAge - 3100) / 900);

  const handleFieldPress = (event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    let nearest = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    points.forEach((point, index) => {
      const distance = Math.hypot(point.x - locationX, point.y - locationY);
      if (distance < nearestDistance) {
        nearest = index;
        nearestDistance = distance;
      }
    });
    if (nearestDistance > 58) return;
    setSelected(nearest);
    setSignalStarted(time);
    setReflectionIndex((current) => (current + 1) % REFLECTIONS.length);
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <Canvas style={{ position: 'absolute', inset: 0 }}>
        {chain.slice(1).map((id, index) => {
          const reveal = Math.min(1, Math.max(0, (signalAge - index * 190) / 360));
          return (
            <Line
              key={`signal-${id}`}
              p1={points[chain[index]]}
              p2={points[id]}
              color={`rgba(255,255,255,${.20 * reveal * signalOpacity})`}
              strokeWidth={.65}
            />
          );
        })}
        {SEEDS.map((seed, index) => {
          const point = points[index];
          const chainIndex = chain.indexOf(index);
          const lit = chainIndex >= 0
            ? Math.min(1, Math.max(0, (signalAge - chainIndex * 190) / 260)) * signalOpacity
            : 0;
          const scale = seed.size * (1 + lit * .22);
          const path = octopusPath(22, time, seed.phase);
          const rotation = seed.rotation + Math.sin(time * .0007 + seed.phase) * 12;
          return (
            <Group
              key={seed.id}
              transform={[
                { translateX: point.x }, { translateY: point.y },
                { rotate: rotation * Math.PI / 180 }, { scale },
              ]}
            >
              {lit > .02 ? <Circle cx={0} cy={0} r={18 + lit * 15} color={`rgba(255,255,255,${lit * .055})`} /> : null}
              <Path
                path={path}
                style="stroke"
                strokeWidth={.72 + lit * .5}
                strokeCap="round"
                strokeJoin="round"
                color={`rgba(255,255,255,${.50 + seed.size * .24 + lit * .25})`}
              />
              <Circle cx={-3.7} cy={-4.2} r={.85} color={`rgba(255,255,255,${.68 + lit * .3})`} />
              <Circle cx={3.7} cy={-4.2} r={.85} color={`rgba(255,255,255,${.68 + lit * .3})`} />
            </Group>
          );
        })}
        {selected !== null && signalOpacity > 0 ? (
          <Circle
            cx={points[selected].x}
            cy={points[selected].y}
            r={22 + Math.min(1, signalAge / 900) * 72}
            style="stroke"
            strokeWidth={1}
            color={`rgba(255,255,255,${Math.max(0, .42 - signalAge / 2500)})`}
          />
        ) : null}
      </Canvas>

      <Pressable accessibilityLabel="Touch an octopus" onPress={handleFieldPress} style={{ position: 'absolute', inset: 0 }} />

      <View pointerEvents="box-none" style={{ position: 'absolute', inset: 0, paddingTop: insets.top + 10, paddingHorizontal: 18, paddingBottom: insets.bottom + 18, justifyContent: 'space-between' }}>
        <View pointerEvents="box-none" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable
            accessibilityLabel="Back"
            onPress={() => router.back()}
            style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? 'rgba(255,255,255,.15)' : 'rgba(255,255,255,.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,.13)' })}
          >
            <Image source="sf:chevron.left" style={{ width: 15, height: 18 }} tintColor="#fff" />
          </Pressable>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <Text selectable style={{ color: '#fff', fontSize: 13, fontWeight: '700', letterSpacing: 1.8 }}>SIGNAL GARDEN</Text>
            <Text selectable style={{ color: 'rgba(255,255,255,.48)', fontSize: 10, letterSpacing: 1.4 }}>A QUIET CONNECTION STUDY</Text>
          </View>
        </View>

        <View pointerEvents="none" style={{ alignItems: 'center', gap: 10 }}>
          {selected === null || signalOpacity <= 0 ? (
            <Animated.View entering={FadeIn.duration(700)} exiting={FadeOut.duration(300)} style={{ alignItems: 'center', gap: 8 }}>
              <Text selectable style={{ color: 'rgba(255,255,255,.76)', fontSize: 13, letterSpacing: .4 }}>Touch a drifting octopus</Text>
              <View style={{ width: 20, height: 1, backgroundColor: 'rgba(255,255,255,.32)' }} />
            </Animated.View>
          ) : (
            <Animated.View key={signalStarted} entering={FadeIn.duration(350)} exiting={FadeOut.duration(300)} style={{ maxWidth: 310, alignItems: 'center', gap: 9 }}>
              <Text selectable style={{ color: 'rgba(255,255,255,.48)', fontSize: 10, letterSpacing: 2 }}>SIGNAL REACHED {chain.length}</Text>
              <Text selectable style={{ color: '#fff', fontSize: 17, lineHeight: 24, textAlign: 'center', fontWeight: '500' }}>{REFLECTIONS[reflectionIndex]}</Text>
            </Animated.View>
          )}
        </View>
      </View>
    </View>
  );
}
