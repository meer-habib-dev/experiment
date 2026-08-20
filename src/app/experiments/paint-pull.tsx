import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { PaintPullExperience } from '@/features/paint-pull/paint-pull-experience';

export default function PaintPullScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          gestureEnabled: true,
          headerBackButtonDisplayMode: 'minimal',
          headerBlurEffect: 'none',
          headerLargeTitle: false,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: 'transparent' },
          headerTintColor: '#1C1C1E',
          headerTitleStyle: { color: '#1C1C1E' },
          headerTransparent: true,
          title: 'Paint Pull',
        }}
      />
      <StatusBar style="dark" />
      <PaintPullExperience />
    </>
  );
}
