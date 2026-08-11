import { Link } from 'expo-router';

import { Pressable, ScrollView, Text, View } from '@/tw';

export default function NotFoundScreen() {
  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerClassName="flex-1 items-center justify-center gap-5 px-6"
      contentInsetAdjustmentBehavior="automatic">
      <View className="items-center gap-2">
        <Text className="font-rounded text-5xl font-bold text-ink">404</Text>
        <Text selectable className="text-center text-base text-muted">
          This experiment has not been invented yet.
        </Text>
      </View>
      <Link href="/" asChild>
        <Pressable className="rounded-full bg-accent px-5 py-3 active:opacity-70">
          <Text className="font-bold text-white">Back to the lab</Text>
        </Pressable>
      </Link>
    </ScrollView>
  );
}
