import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { RainLensCamera } from '@/features/rain-lens/rain-lens-camera';

export default function RainLensScreen() {
  return (
    <>
      <Stack.Screen options={{ gestureEnabled: true, headerShown: false }} />
      <StatusBar style="light" />
      <RainLensCamera />
    </>
  );
}
