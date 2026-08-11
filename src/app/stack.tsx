import { engineGroups } from '@/data/experiments';
import { ScrollView, Text, View } from '@/tw';

export default function StackScreen() {
  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerClassName="gap-5 px-5 pb-24 pt-4"
      contentInsetAdjustmentBehavior="automatic">
      <Text selectable className="max-w-2xl text-base leading-6 text-muted">
        The base stays intentionally small. Heavy engines are available, but experiments import
        them only when a route needs them.
      </Text>

      {engineGroups.map((group) => (
        <View className="gap-3 rounded-3xl border border-line bg-surface p-5" key={group.title}>
          <View className="gap-1">
            <Text className="font-rounded text-xl font-bold text-ink">{group.title}</Text>
            <Text selectable className="text-sm leading-5 text-muted">
              {group.purpose}
            </Text>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {group.packages.map((packageName) => (
              <View className="rounded-full bg-chip px-3 py-1.5" key={packageName}>
                <Text selectable className="font-mono text-xs font-medium text-ink">
                  {packageName}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
