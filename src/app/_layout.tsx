import '@/global.css';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView className="flex-1">
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack
          screenOptions={{
            headerLargeTitle: true,
            headerTransparent: true,
            headerBlurEffect: 'systemMaterial',
          }}>
          <Stack.Screen name="index" options={{ title: 'Native Lab' }} />
          <Stack.Screen name="stack" options={{ title: 'The stack' }} />
          <Stack.Screen name="experiments/relic-lift" options={{ headerShown: false }} />
          <Stack.Screen name="experiments/folio-shuffle" options={{ headerShown: false }} />
          <Stack.Screen name="experiments/rain-lens" options={{ headerShown: false }} />
          <Stack.Screen name="experiments/prism-field" options={{ headerShown: false }} />
          <Stack.Screen name="experiments/volcano-drive" options={{ headerShown: false }} />
          <Stack.Screen name="experiments/timberline" options={{ headerShown: false }} />
          <Stack.Screen name="experiments/halo-arena" options={{ headerShown: false }} />
          <Stack.Screen name="experiments/[slug]" options={{ title: 'Experiment' }} />
          <Stack.Screen name="+not-found" options={{ title: 'Not found' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
