import { Link } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { ExperimentCard } from '@/components/experiment-card';
import { experiments } from '@/data/experiments';
import { Pressable, ScrollView, Text, View } from '@/tw';

export default function HomeScreen() {
  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerClassName="gap-8 px-5 pb-24 pt-4"
      contentInsetAdjustmentBehavior="automatic">
      <View className="gap-3 pt-2">
        <View className="self-start rounded-full border border-line bg-surface px-3 py-1.5">
          <Text className="font-mono text-xs font-semibold uppercase tracking-widest text-accent">
            Expo 57 · build in public
          </Text>
        </View>
        <Text selectable className="max-w-3xl font-rounded text-4xl font-bold leading-tight text-ink">
          Small native experiments. Big visual ideas.
        </Text>
        <Text selectable className="max-w-2xl text-base leading-6 text-muted">
          A focused playground for motion, graphics, GPU work, DOM components, and the newest
          corners of React Native.
        </Text>
      </View>

      <View className="flex-row gap-3">
        <View className="flex-1 gap-1 rounded-3xl bg-ink p-4">
          <Text className="font-mono text-xs uppercase tracking-widest text-canvas/60">Ready</Text>
          <Text className="font-rounded text-3xl font-bold text-canvas">{experiments.length}</Text>
        </View>
        <View className="flex-1 gap-1 rounded-3xl border border-line bg-surface p-4">
          <Text className="font-mono text-xs uppercase tracking-widest text-muted">Engines</Text>
          <Text className="font-rounded text-3xl font-bold text-ink">06</Text>
        </View>
      </View>

      <View className="gap-4">
        <View className="flex-row items-end justify-between gap-4">
          <View className="gap-1">
            <Text className="font-rounded text-2xl font-bold text-ink">Experiment queue</Text>
            <Text className="text-sm text-muted">Each demo gets its own shareable route.</Text>
          </View>
          <Link href="/stack" asChild>
            <Pressable
              className="rounded-full bg-accent px-4 py-2 active:opacity-70"
              onPress={() => {
                if (process.env.EXPO_OS === 'ios') {
                  Haptics.selectionAsync();
                }
              }}>
              <Text className="text-sm font-bold text-white">View stack</Text>
            </Pressable>
          </Link>
        </View>

        <View className="gap-3">
          {experiments.map((experiment, index) => (
            <ExperimentCard experiment={experiment} index={index} key={experiment.slug} />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
