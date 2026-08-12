import * as Haptics from "expo-haptics";
import { Link } from "expo-router";
import { useWindowDimensions } from "react-native";

import { ExperimentCard } from "@/components/experiment-card";
import { availableExperimentCount, experiments } from "@/data/experiments";
import { Pressable, ScrollView, Text, View } from "@/tw";

const SCREEN_PADDING = 20;
const GRID_GAP = 12;

const shipped = experiments.filter(({ status }) => status === "available");
const concepts = experiments.filter(({ status }) => status === "concept");

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const columns = width >= 1100 ? 4 : width >= 720 ? 3 : 2;
  const columnWidth = Math.floor(
    (width - SCREEN_PADDING * 2 - GRID_GAP * (columns - 1)) / columns,
  );

  return (
    <View className="flex-1">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        className="flex-1 bg-canvas"
        contentContainerClassName="gap-8 px-5 pb-24 pt-2"
      >
        <View className="gap-4 pt-1">
          <Text
            selectable
            className="max-w-2xl font-rounded text-[30px] font-bold leading-[36px] text-ink"
          >
            Small native experiments. Big visual ideas.
          </Text>
          <Text
            selectable
            className="max-w-2xl text-[15px] leading-6 text-muted"
          >
            Motion, graphics, GPU work, and the newest corners of React Native.
            Tap any tile to run it.
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <Badge label="Expo 57" />
            <Badge label={`${availableExperimentCount} live`} />
            <Badge label="Open source" tone="accent" />
          </View>
        </View>

        <View className="gap-4">
          <SectionHeader title="Experiments" />
          <View className="flex-row flex-wrap gap-3">
            {shipped.map((experiment, index) => (
              <ExperimentCard
                experiment={experiment}
                index={index}
                key={experiment.slug}
                width={columnWidth}
              />
            ))}
          </View>
        </View>

        {concepts.length > 0 ? (
          <View className="gap-4">
            <SectionHeader
              subtitle="Sketched, not shipped yet."
              title="Next up"
            />
            <View className="flex-row flex-wrap gap-3">
              {concepts.map((experiment, index) => (
                <ExperimentCard
                  experiment={experiment}
                  index={shipped.length + index}
                  key={experiment.slug}
                  width={columnWidth}
                />
              ))}
            </View>
          </View>
        ) : null}

        <Link asChild href="/stack">
          <Pressable
            className="flex-row items-center justify-between gap-4 rounded-3xl border border-line bg-surface p-5 active:opacity-70"
            onPress={() => {
              if (process.env.EXPO_OS === "ios") {
                Haptics.selectionAsync();
              }
            }}
          >
            <View className="flex-1 gap-1">
              <Text className="font-rounded text-base font-bold text-ink">
                The stack
              </Text>
              <Text className="text-sm leading-5 text-muted">
                Every engine behind these experiments, and why it earns its
                place.
              </Text>
            </View>
            <Text className="font-rounded text-lg font-bold text-accent">
              →
            </Text>
          </Pressable>
        </Link>
      </ScrollView>
    </View>
  );
}

function SectionHeader({
  subtitle,
  title,
}: {
  subtitle?: string;
  title: string;
}) {
  return (
    <View className="gap-1">
      <Text className="font-rounded text-xl font-bold text-ink">{title}</Text>
      {subtitle ? (
        <Text className="text-sm leading-5 text-muted">{subtitle}</Text>
      ) : null}
    </View>
  );
}

function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "accent" | "neutral";
}) {
  return (
    <View className="rounded-full border border-line bg-surface px-3 py-1.5">
      <Text
        className={`font-mono text-[11px] font-semibold uppercase tracking-widest ${
          tone === "accent" ? "text-accent" : "text-muted"
        }`}
      >
        {label}
      </Text>
    </View>
  );
}
