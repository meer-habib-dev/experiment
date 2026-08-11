import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { FolioShuffleExperience } from '@/features/folio-shuffle/folio-shuffle-experience';

export default function FolioShuffleScreen() {
  return (
    <>
      <Stack.Screen options={{ gestureEnabled: true, headerShown: false }} />
      <StatusBar style="light" />
      <FolioShuffleExperience />
    </>
  );
}

