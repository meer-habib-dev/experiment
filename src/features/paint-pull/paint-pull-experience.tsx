import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PaintPullCanvas, paintPalettes } from '@/features/paint-pull/paint-pull-canvas';

const HAS_GLASS = isLiquidGlassAvailable();

function AdaptiveGlass({ children }: { children: ReactNode }) {
  const style = {
    borderCurve: 'continuous' as const,
    borderRadius: 24,
    overflow: 'hidden' as const,
  };

  if (HAS_GLASS) {
    return (
      <GlassView isInteractive style={style}>
        {children}
      </GlassView>
    );
  }

  return (
    <BlurView intensity={82} style={style} tint="systemMaterial">
      {children}
    </BlurView>
  );
}

export function PaintPullExperience() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [generation, setGeneration] = useState(0);
  const [seed, setSeed] = useState(() => Date.now() & 0xffffffff);
  const palette = paintPalettes[generation % paintPalettes.length];

  const board = useMemo(() => {
    const width = Math.min(windowWidth - 24, 620);
    const availableHeight = windowHeight - insets.top - insets.bottom - 150;
    return {
      height: Math.max(410, Math.min(availableHeight, width * 1.5)),
      width,
    };
  }, [insets.bottom, insets.top, windowHeight, windowWidth]);

  const makeNewPattern = () => {
    setSeed((current) => (current + 0x9e3779b9) >>> 0);
    setGeneration((current) => current + 1);
    if (process.env.EXPO_OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }
  };

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: '#ECEBE6',
        flex: 1,
        paddingBottom: Math.max(insets.bottom, 12),
        paddingTop: insets.top + 64,
      }}>
      <Animated.View
        entering={FadeIn.duration(360)}
        style={{
          backgroundColor: '#F8F7F2',
          borderColor: 'rgba(28,28,30,0.08)',
          borderCurve: 'continuous',
          borderRadius: 28,
          borderWidth: 0.75,
          boxShadow: '0 16px 48px rgba(28,28,30,0.12)',
          height: board.height,
          overflow: 'hidden',
          width: board.width,
        }}>
        <PaintPullCanvas
          height={board.height}
          palette={palette}
          resetSignal={generation}
          seed={seed}
          width={board.width}
        />
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(180).duration(320)}
        style={{ alignItems: 'center', gap: 8, paddingTop: 12 }}>
        <AdaptiveGlass>
          <Pressable
            accessibilityHint="Creates a fresh arrangement of colors and marks"
            accessibilityLabel="New pattern"
            accessibilityRole="button"
            onPress={makeNewPattern}
            style={({ pressed }) => ({
              alignItems: 'center',
              flexDirection: 'row',
              gap: 8,
              opacity: pressed ? 0.58 : 1,
              paddingHorizontal: 17,
              paddingVertical: 11,
            })}>
            <Image
              contentFit="contain"
              source="sf:sparkles"
              style={{ height: 16, tintColor: '#1C1C1E', width: 16 }}
            />
            <Text style={{ color: '#1C1C1E', fontSize: 15, fontWeight: '600' }}>
              New Pattern
            </Text>
          </Pressable>
        </AdaptiveGlass>
        <Text
          selectable
          style={{ color: '#777772', fontSize: 12, fontWeight: '500', letterSpacing: 0.1 }}>
          Drag the handle through the color
        </Text>
      </Animated.View>
    </View>
  );
}
