import { Stack } from 'expo-router';

import { VolcanoDriveGame } from '@/features/volcano-drive/volcano-drive-game';

export default function VolcanoDriveScreen() {
  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false, headerShown: false }} />
      <VolcanoDriveGame />
    </>
  );
}
