import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

const WEB_SEEDS = [
  [.12, .17, .85, -12], [.27, .11, .58, 18], [.44, .20, 1.05, -5], [.65, .13, .72, 24], [.82, .21, .93, -18],
  [.18, .35, .64, 10], [.36, .40, 1.12, -25], [.57, .34, .55, 14], [.76, .41, .78, 4], [.90, .34, .48, -22],
  [.10, .57, .51, 20], [.27, .62, .92, -8], [.49, .54, .69, 17], [.68, .61, 1.09, -15], [.86, .57, .60, 26],
  [.17, .78, .76, -20], [.38, .82, .49, 7], [.56, .75, .89, 20], [.78, .82, .66, -9], [.91, .74, .45, 16],
] as const;

const WEB_REFLECTIONS = [
  'Softness is a kind of intelligence.',
  'A small signal can move a whole field.',
  'Notice what responds when you slow down.',
  'Connection begins with gentle attention.',
  'Let the next breath arrive on its own.',
];

export function SignalGardenExperience() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [reflection, setReflection] = useState(0);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const animate = (now: number) => {
      setPhase((now - start) * .001);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  const activate = (index: number) => {
    setSelected(index);
    setReflection((current) => (current + 1) % WEB_REFLECTIONS.length);
    window.setTimeout(() => setSelected((current) => current === index ? null : current), 4000);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000', overflow: 'hidden' }}>
      {WEB_SEEDS.map(([x, y, scale, rotation], index) => {
        const lit = selected !== null && [0, 1, 2, 3, 4].some((hop) => (selected + hop * 3) % WEB_SEEDS.length === index);
        const driftX = Math.sin(phase * (.42 + index % 4 * .08) + index) * (9 + index % 3 * 3);
        const driftY = Math.cos(phase * (.34 + index % 5 * .05) + index * 1.3) * (7 + index % 4 * 2);
        return (
          <Pressable
            accessibilityLabel={`Octopus ${index + 1}`}
            key={index}
            onPress={() => activate(index)}
            style={{
              position: 'absolute', left: `${x * 100}%`, top: `${y * 100}%`, width: 48, height: 54,
              alignItems: 'center', justifyContent: 'center', opacity: .54 + scale * .3, outlineWidth: 0,
              transform: [{ translateX: driftX - 24 }, { translateY: driftY - 27 }, { rotate: `${rotation + Math.sin(phase + index) * 8}deg` }, { scale: scale * (lit ? 1.22 : 1) }],
            }}
          >
            {lit ? <View style={{ position: 'absolute', width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,.28)', boxShadow: '0 0 24px rgba(255,255,255,.16)' }} /> : null}
            <View style={{ position: 'absolute', top: 12, width: 18, height: 15, borderWidth: 1, borderColor: '#fff', borderRadius: 10, borderCurve: 'continuous' }}>
              <View style={{ position: 'absolute', left: 4, top: 5, width: 2, height: 2, borderRadius: 1, backgroundColor: '#fff' }} />
              <View style={{ position: 'absolute', right: 4, top: 5, width: 2, height: 2, borderRadius: 1, backgroundColor: '#fff' }} />
            </View>
            {Array.from({ length: 8 }, (_, arm) => (
              <View
                key={arm}
                style={{
                  position: 'absolute', top: 26, left: 21 + (arm - 3.5) * 1.9, width: 1, height: 13 + arm % 3 * 2,
                  backgroundColor: '#fff', borderRadius: 1, transformOrigin: 'top center',
                  transform: [{ rotate: `${(arm - 3.5) * 9 + Math.sin(phase * 2 + index + arm) * 8}deg` }],
                }}
              />
            ))}
          </Pressable>
        );
      })}

      <View pointerEvents="box-none" style={{ position: 'absolute', inset: 0, paddingTop: insets.top + 10, paddingHorizontal: 18, paddingBottom: insets.bottom + 18, justifyContent: 'space-between' }}>
        <View pointerEvents="box-none" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,.13)' }}>
            <Text style={{ color: '#fff', fontSize: 22, lineHeight: 24 }}>‹</Text>
          </Pressable>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <Text selectable style={{ color: '#fff', fontSize: 13, fontWeight: '700', letterSpacing: 1.8 }}>SIGNAL GARDEN</Text>
            <Text selectable style={{ color: 'rgba(255,255,255,.48)', fontSize: 10, letterSpacing: 1.4 }}>A QUIET CONNECTION STUDY</Text>
          </View>
        </View>

        <View pointerEvents="none" style={{ alignItems: 'center', gap: 9 }}>
          {selected === null ? (
            <Text selectable style={{ color: 'rgba(255,255,255,.76)', fontSize: 13, letterSpacing: .4 }}>Touch a drifting octopus</Text>
          ) : (
            <Animated.View key={selected} entering={FadeIn.duration(350)} style={{ alignItems: 'center', gap: 9 }}>
              <Text selectable style={{ color: 'rgba(255,255,255,.48)', fontSize: 10, letterSpacing: 2 }}>SIGNAL REACHED 5</Text>
              <Text selectable style={{ color: '#fff', fontSize: 17, lineHeight: 24, textAlign: 'center', fontWeight: '500' }}>{WEB_REFLECTIONS[reflection]}</Text>
            </Animated.View>
          )}
        </View>
      </View>
    </View>
  );
}
