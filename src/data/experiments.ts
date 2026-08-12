import type { Href } from 'expo-router';

export type Experiment = {
  slug: string;
  title: string;
  description: string;
  status: 'available' | 'concept';
  tech: string[];
  route?: Href;
};

export const experiments: Experiment[] = [
  {
    slug: 'sign-off',
    title: 'Sign Off',
    description:
      'Sign a contract, then clear it eleven delightful ways — dust, black holes, gravity, wind, fireworks, and time itself.',
    status: 'available',
    tech: ['skia atlas', 'particles', 'gestures', 'haptics'],
    route: '/experiments/sign-off',
  },
  {
    slug: 'folio-shuffle',
    title: 'Field Folio',
    description: 'Shuffle a tactile field journal, then hold, lift, and rearrange living metal stickers inside every page.',
    status: 'available',
    tech: ['skia shader', 'page physics', 'gestures', 'haptics'],
    route: '/experiments/folio-shuffle',
  },
  {
    slug: 'halo-arena',
    title: 'Halo Arena',
    description: 'Orbit a living stadium, dive into every tier, and reserve your exact match-day view from a fully reactive 3D seat map.',
    status: 'available',
    tech: ['three', 'webgpu', 'skia', 'expo-dom', '360° booking'],
    route: '/experiments/halo-arena',
  },
  {
    slug: 'timberline',
    title: 'Timberline',
    description: 'Pull blocks from a fully simulated wooden tower and hold your nerve as every layer starts to move.',
    status: 'available',
    tech: ['three', 'webgpu', 'physics', 'skia', 'expo-dom'],
    route: '/experiments/timberline',
  },
  {
    slug: 'prism-field',
    title: 'Prism Field',
    description: 'Tune light with Camera Control, bend it by tilting the phone, then freeze the field.',
    status: 'available',
    tech: ['camera control', 'motion', 'skia'],
    route: '/experiments/prism-field',
  },
  {
    slug: 'relic-lift',
    title: 'Relic Lift',
    description: 'Find an everyday object, lift it from the camera, and cast it as living metal.',
    status: 'available',
    tech: ['camera', 'skia', 'reanimated'],
    route: '/experiments/relic-lift',
  },
  {
    slug: 'rain-lens',
    title: 'Rain Lens',
    description: 'A live camera atmosphere with drifting glass droplets and cinematic controls.',
    status: 'available',
    tech: ['camera', 'skia', 'reanimated'],
    route: '/experiments/rain-lens',
  },
  {
    slug: 'volcano-drive',
    title: 'Volcano Drive',
    description: 'A low-poly endless traffic run rendered with Three.js on native WebGPU.',
    status: 'available',
    tech: ['webgpu', 'three', 'skia'],
    route: '/experiments/volcano-drive',
  },
  {
    slug: 'gpu-particles',
    title: 'GPU particle field',
    description: 'A future compute-driven scene with touch-reactive particles.',
    status: 'concept',
    tech: ['webgpu', 'three'],
  },
  {
    slug: 'skia-transitions',
    title: 'Skia transitions',
    description: 'A tactile canvas study for masks, shaders, and fluid gestures.',
    status: 'concept',
    tech: ['skia', 'worklets'],
  },
];

export const availableExperimentCount = experiments.filter(
  ({ status }) => status === 'available',
).length;

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
