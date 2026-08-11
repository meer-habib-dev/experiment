import { Stack } from 'expo-router';

import { ArenaBookingExperience } from '@/features/halo-arena/arena-booking-experience';

export default function HaloArenaScreen() {
  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false, headerShown: false }} />
      <ArenaBookingExperience />
    </>
  );
}
