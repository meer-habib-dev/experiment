import * as Haptics from 'expo-haptics';
import { Link } from 'expo-router';
import { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ExperimentPoster } from '@/components/experiment-poster';
import type { Experiment } from '@/data/experiments';
import { Pressable, Text, View } from '@/tw';

type ExperimentCardProps = {
  experiment: Experiment;
  index: number;
  /** Column width resolved by the gallery grid. */
  width: number;
};

const PRESS_SPRING = { damping: 22, mass: 0.5, stiffness: 320 };

export function ExperimentCard({ experiment, index, width }: ExperimentCardProps) {
  const href =
    experiment.route ??
    ({ pathname: '/experiments/[slug]', params: { slug: experiment.slug } } as const);
  const isConcept = experiment.status === 'concept';
  const height = Math.round(width * 1.16);

  // Explicit shared values rather than layout animations: entering/exiting animations can freeze
  // mid-flight when a screen mounts from a deep link.
  const reveal = useSharedValue(0);
  const press = useSharedValue(0);

  useEffect(() => {
    reveal.value = withDelay(index * 55, withTiming(1, { duration: 340 }));
  }, [index, reveal]);

  const style = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [
      { translateY: (1 - reveal.value) * 16 },
      { scale: 1 - press.value * 0.045 },
    ],
  }));

  return (
    <Animated.View style={[style, { width }]}>
      <Link asChild href={href}>
        <Pressable
          accessibilityHint={experiment.description}
          accessibilityRole="button"
          className="overflow-hidden rounded-[26px] border border-white/10"
          onPressIn={() => {
            press.value = withSpring(1, PRESS_SPRING);
            if (process.env.EXPO_OS === 'ios') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
            }
          }}
          onPressOut={() => {
            press.value = withSpring(0, PRESS_SPRING);
          }}>
          <ExperimentPoster
            art={experiment.poster}
            dimmed={isConcept}
            height={height}
            width={width}
          />

          <View className="absolute inset-x-0 top-0 gap-1 p-4">
            <Text className="font-rounded text-[17px] font-bold leading-6 text-white">
              {experiment.title}
            </Text>
            <Text className="font-mono text-[10px] font-medium uppercase tracking-widest text-white/55">
              {experiment.tagline}
            </Text>
          </View>

          {isConcept ? (
            <View className="absolute bottom-3 left-3 rounded-full bg-white/12 px-2.5 py-1">
              <Text className="font-mono text-[9px] font-semibold uppercase tracking-widest text-white/70">
                Soon
              </Text>
            </View>
          ) : null}
        </Pressable>
      </Link>
    </Animated.View>
  );
}
