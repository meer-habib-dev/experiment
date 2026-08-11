import { Stack } from 'expo-router';

import { TimberlineGame } from '@/features/timberline/timberline-game';

export default function TimberlineScreen() {
  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false, headerShown: false }} />
      <TimberlineGame />
    </>
  );
}
