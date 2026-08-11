import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { PrismFieldCamera } from '@/features/prism-field/prism-field-camera';

export default function PrismFieldScreen() {
  return (
    <>
      <Stack.Screen options={{ gestureEnabled: true, headerShown: false }} />
      <StatusBar style="light" />
      <PrismFieldCamera />
    </>
  );
}
