import { Link } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';

import type { Experiment } from '@/data/experiments';
import { Pressable, Text, View } from '@/tw';

type ExperimentCardProps = {
  experiment: Experiment;
  index: number;
};

export function ExperimentCard({ experiment, index }: ExperimentCardProps) {
  const href =
    experiment.slug === 'sign-off'
      ? '/experiments/sign-off'
      : experiment.slug === 'folio-shuffle'
      ? '/experiments/folio-shuffle'
      : experiment.slug === 'halo-arena'
      ? '/experiments/halo-arena'
      : experiment.slug === 'timberline'
      ? '/experiments/timberline'
      : experiment.slug === 'relic-lift'
      ? '/experiments/relic-lift'
      : experiment.slug === 'rain-lens'
      ? '/experiments/rain-lens'
      : experiment.slug === 'volcano-drive'
        ? '/experiments/volcano-drive'
        : ({ pathname: '/experiments/[slug]', params: { slug: experiment.slug } } as const);

  return (
    <Animated.View entering={FadeInDown.delay(index * 70).springify()}>
      <Link href={href} asChild>
        <Pressable className="gap-5 rounded-3xl border border-line bg-surface p-5 active:scale-[0.99] active:opacity-80">
          <View className="flex-row items-start justify-between gap-4">
            <View className="flex-1 gap-2">
              <Text className="font-rounded text-xl font-bold text-ink">{experiment.title}</Text>
              <Text selectable className="text-sm leading-5 text-muted">
                {experiment.description}
              </Text>
            </View>
            <View className="rounded-full bg-chip px-3 py-1.5">
              <Text className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ink">
                {experiment.status}
              </Text>
            </View>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {experiment.tech.map((item) => (
              <Text className="font-mono text-xs text-accent" key={item}>
                #{item}
              </Text>
            ))}
          </View>
        </Pressable>
      </Link>
    </Animated.View>
  );
}
