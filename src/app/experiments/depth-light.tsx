import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { DepthLightCamera } from '@/features/depth-light/depth-light-camera';

export default function DepthLightScreen() {
  return (
    <>
      <Stack.Screen options={{ gestureEnabled: true, headerShown: false }} />
      <StatusBar style="light" />
      <DepthLightCamera />
    </>
  );
}
