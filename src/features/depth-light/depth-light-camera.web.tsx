import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

export function DepthLightCamera() {
  const router = useRouter();
  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 28 }}
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: '#070808' }}>
      <View style={{ gap: 16, maxWidth: 420 }}>
        <Text selectable style={{ color: '#F5F2EA', fontSize: 34, fontWeight: '700', letterSpacing: -1.2 }}>
          Depth Light is a native camera experiment.
        </Text>
        <Text selectable style={{ color: '#92928E', fontSize: 15, lineHeight: 23 }}>
          Open this route in the iOS or Android development build to stream VisionCamera frames directly into TypeGPU.
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => ({
            alignSelf: 'flex-start',
            backgroundColor: '#F5F2EA',
            borderRadius: 99,
            opacity: pressed ? 0.65 : 1,
            paddingHorizontal: 19,
            paddingVertical: 13,
          })}>
          <Text style={{ color: '#070808', fontSize: 14, fontWeight: '800' }}>Back to the lab</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
