import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { SignalGardenExperience } from '@/features/signal-garden/signal-garden-experience';

export default function SignalGardenScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />
      <SignalGardenExperience />
    </>
  );
}
