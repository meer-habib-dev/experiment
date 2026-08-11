import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SignaturePad, signOffPalette } from '@/features/sign-off/signature-pad';

export function SignOffExperience() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 36, 480);

  /* Explicit mount animation — layout `entering` animations proved flaky here. */
  const intro = useSharedValue(0);
  const captionIntro = useSharedValue(0);

  useEffect(() => {
    intro.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
    captionIntro.value = withDelay(300, withTiming(1, { duration: 400 }));
  }, [captionIntro, intro]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: intro.value,
    transform: [{ translateY: (1 - intro.value) * 14 }],
  }));
  const captionStyle = useAnimatedStyle(() => ({ opacity: captionIntro.value }));

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: signOffPalette.backdrop,
        flex: 1,
        justifyContent: 'center',
        paddingBottom: insets.bottom + 18,
        paddingHorizontal: 18,
        paddingTop: insets.top + 18,
      }}>
      <Animated.View style={cardStyle}>
        <SignaturePad onClose={() => router.back()} width={cardWidth} />
      </Animated.View>
      <Animated.View style={captionStyle}>
        <Text
          style={{
            color: signOffPalette.muted,
            fontSize: 13,
            fontWeight: '500',
            paddingTop: 20,
            textAlign: 'center',
          }}>
          Tap the effect name to change how the ink leaves the page.
        </Text>
      </Animated.View>
    </View>
  );
}
