import { Stack, useLocalSearchParams } from 'expo-router';

import { experiments } from '@/data/experiments';
import { ScrollView, Text, View } from '@/tw';

export default function ExperimentScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const experiment = experiments.find((item) => item.slug === slug);

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerClassName="gap-6 px-5 pb-24 pt-4"
      contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title: experiment?.title ?? 'Experiment' }} />
      <View className="gap-4 rounded-[32px] bg-ink p-6">
        <Text className="font-mono text-xs uppercase tracking-widest text-canvas/60">
          Route scaffold ready
        </Text>
        <Text selectable className="font-rounded text-4xl font-bold leading-tight text-canvas">
          {experiment?.title ?? 'New experiment'}
        </Text>
        <Text selectable className="text-base leading-6 text-canvas/70">
          {experiment?.description ?? 'Add the next native idea here.'}
        </Text>
      </View>
      <View className="gap-2 rounded-3xl border border-dashed border-line bg-surface p-6">
        <Text className="font-rounded text-lg font-bold text-ink">Canvas reserved</Text>
        <Text selectable className="text-sm leading-5 text-muted">
          This screen is the clean launch point for the first product demo. Its implementation can
          stay isolated from the gallery and the other engines.
        </Text>
      </View>
    </ScrollView>
  );
}
