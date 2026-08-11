import { useRouter } from 'expo-router';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const palette = {
  backdrop: '#E9E9E6',
  canvas: '#F5F5F2',
  card: '#FDFDFC',
  ink: '#1B1B1F',
  muted: '#8E8E88',
  pill: '#1A1B1D',
};

export function SignOffExperience() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 36, 480);

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: palette.backdrop,
        flex: 1,
        justifyContent: 'center',
        paddingBottom: insets.bottom + 18,
        paddingHorizontal: 18,
        paddingTop: insets.top + 18,
      }}>
      <View
        style={{
          backgroundColor: palette.card,
          borderRadius: 28,
          boxShadow: '0 24px 64px rgba(20,20,24,0.12)',
          padding: 18,
          width: cardWidth,
        }}>
        <View
          style={{
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingBottom: 14,
            paddingHorizontal: 4,
            paddingTop: 2,
          }}>
          <Text style={{ color: palette.ink, fontSize: 17, fontWeight: '600' }}>
            Sign the contract
          </Text>
          <Pressable accessibilityLabel="Close" hitSlop={12} onPress={() => router.back()}>
            <Text style={{ color: palette.ink, fontSize: 17 }}>✕</Text>
          </Pressable>
        </View>
        <View
          style={{
            alignItems: 'center',
            backgroundColor: palette.canvas,
            borderRadius: 18,
            height: (cardWidth - 36) * 0.84,
            justifyContent: 'center',
          }}>
          <Text style={{ color: palette.muted, fontSize: 13, fontWeight: '500' }}>
            Open on native for live ink, dust, and black holes.
          </Text>
        </View>
        <View
          style={{
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: 4,
            paddingTop: 16,
          }}>
          <Text style={{ color: palette.ink, fontSize: 15, fontWeight: '500' }}>Thanos Snap</Text>
          <View
            style={{
              backgroundColor: palette.pill,
              borderRadius: 24,
              opacity: 0.35,
              paddingHorizontal: 18,
              paddingVertical: 11,
            }}>
            <Text style={{ color: palette.card, fontSize: 15, fontWeight: '600' }}>Clear</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
