import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { SignOffExperience } from '@/features/sign-off/sign-off-experience';

export default function SignOffScreen() {
  return (
    <>
      <Stack.Screen options={{ gestureEnabled: true, headerShown: false }} />
      <StatusBar style="dark" />
      <SignOffExperience />
    </>
  );
}
