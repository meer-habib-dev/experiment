import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { RelicLiftCamera } from '@/features/relic-lift/relic-lift-camera';

export default function RelicLiftScreen() {
  return (
    <>
      <Stack.Screen options={{ gestureEnabled: true, headerShown: false }} />
      <StatusBar style="light" />
      <RelicLiftCamera />
    </>
  );
}
