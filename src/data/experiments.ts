export type Experiment = {
  slug: string;
  title: string;
  description: string;
  status: 'next' | 'idea';
  tech: string[];
};

export const experiments: Experiment[] = [
  {
    slug: 'sign-off',
    title: 'Sign Off',
    description:
      'Sign a contract, then clear it eleven delightful ways — dust, black holes, gravity, wind, fireworks, and time itself.',
    status: 'next',
    tech: ['skia atlas', 'particles', 'gestures', 'haptics'],
  },
  {
    slug: 'folio-shuffle',
    title: 'Field Folio',
    description: 'Shuffle a tactile field journal, then hold, lift, and rearrange living metal stickers inside every page.',
    status: 'next',
    tech: ['skia shader', 'page physics', 'gestures', 'haptics'],
  },
  {
    slug: 'halo-arena',
    title: 'Halo Arena',
    description: 'Orbit a living stadium, dive into every tier, and reserve your exact match-day view from a fully reactive 3D seat map.',
    status: 'next',
    tech: ['three', 'webgpu', 'skia', 'expo-dom', '360° booking'],
  },
  {
    slug: 'timberline',
    title: 'Timberline',
    description: 'Pull blocks from a fully simulated wooden tower and hold your nerve as every layer starts to move.',
    status: 'next',
    tech: ['three', 'webgpu', 'physics', 'skia', 'expo-dom'],
  },
  {
    slug: 'prism-field',
    title: 'Prism Field',
    description: 'Tune light with Camera Control, bend it by tilting the phone, then freeze the field.',
    status: 'next',
    tech: ['camera control', 'motion', 'skia'],
  },
  {
    slug: 'relic-lift',
    title: 'Relic Lift',
    description: 'Find an everyday object, lift it from the camera, and cast it as living metal.',
    status: 'next',
    tech: ['camera', 'skia', 'reanimated'],
  },
  {
    slug: 'rain-lens',
    title: 'Rain Lens',
    description: 'A live camera atmosphere with drifting glass droplets and cinematic controls.',
    status: 'next',
    tech: ['camera', 'skia', 'reanimated'],
  },
  {
    slug: 'volcano-drive',
    title: 'Volcano Drive',
    description: 'A low-poly endless traffic run rendered with Three.js on native WebGPU.',
    status: 'next',
    tech: ['webgpu', 'three', 'skia'],
  },
  {
    slug: 'gpu-particles',
    title: 'GPU particle field',
    description: 'A future compute-driven scene with touch-reactive particles.',
    status: 'idea',
    tech: ['webgpu', 'three'],
  },
  {
    slug: 'skia-transitions',
    title: 'Skia transitions',
    description: 'A tactile canvas study for masks, shaders, and fluid gestures.',
    status: 'idea',
    tech: ['skia', 'worklets'],
  },
];

export const engineGroups = [
  {
    title: 'Application shell',
    purpose: 'Typed, file-based routes and universal screens.',
    packages: ['expo-router', 'expo-dom', 'react-native-css'],
  },
  {
    title: 'Motion and touch',
    purpose: 'UI-thread animation, gestures, and tactile feedback.',
    packages: ['reanimated', 'worklets', 'gesture-handler', 'expo-haptics'],
  },
  {
    title: 'Pixels and GPU',
    purpose: 'Canvas graphics, shaders, 3D scenes, and GPU compute.',
    packages: ['react-native-skia', 'react-native-webgpu', 'three', 'r3f'],
  },
] as const;
