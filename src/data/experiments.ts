import type { Href } from 'expo-router';

/**
 * Poster art keys. Each key names a hand-composed gallery illustration in
 * `src/components/experiment-poster.tsx`; the registry picks the art, the poster owns the drawing.
 */
export type PosterArt =
  | 'arena'
  | 'depth'
  | 'folio'
  | 'ink'
  | 'lens'
  | 'particles'
  | 'prism'
  | 'relic'
  | 'road'
  | 'tower'
  | 'wave';

export type Experiment = {
  slug: string;
  title: string;
  /** Two or three words for the gallery tile. */
  tagline: string;
  description: string;
  status: 'available' | 'concept';
  poster: PosterArt;
  tech: string[];
  route?: Href;
};

export const experiments: Experiment[] = [
  {
    slug: 'depth-light',
    title: 'Depth Light',
    tagline: 'Hold the light',
    description: 'Drag a living light through the camera and watch real depth wrap it around faces, hands, and space.',
    status: 'available',
    poster: 'depth',
    tech: ['vision camera', 'typegpu', 'webgpu', 'true depth'],
    route: '/experiments/depth-light',
  },
  {
    slug: 'sign-off',
    title: 'Sign Off',
    tagline: 'Ink & particles',
    description:
      'Sign a contract, then clear it eleven delightful ways — dust, black holes, gravity, wind, fireworks, and time itself.',
    status: 'available',
    poster: 'ink',
    tech: ['skia atlas', 'particles', 'gestures', 'haptics'],
    route: '/experiments/sign-off',
  },
  {
    slug: 'folio-shuffle',
    title: 'Field Folio',
    tagline: 'Pages & stickers',
    description: 'Shuffle a tactile field journal, then hold, lift, and rearrange living metal stickers inside every page.',
    status: 'available',
    poster: 'folio',
    tech: ['skia shader', 'page physics', 'gestures', 'haptics'],
    route: '/experiments/folio-shuffle',
  },
  {
    slug: 'halo-arena',
    title: 'Halo Arena',
    tagline: '3D seat booking',
    description: 'Orbit a living stadium, dive into every tier, and reserve your exact match-day view from a fully reactive 3D seat map.',
    status: 'available',
    poster: 'arena',
    tech: ['three', 'webgpu', 'skia', 'expo-dom', '360° booking'],
    route: '/experiments/halo-arena',
  },
  {
    slug: 'timberline',
    title: 'Timberline',
    tagline: 'Physics tower',
    description: 'Pull blocks from a fully simulated wooden tower and hold your nerve as every layer starts to move.',
    status: 'available',
    poster: 'tower',
    tech: ['three', 'webgpu', 'physics', 'skia', 'expo-dom'],
    route: '/experiments/timberline',
  },
  {
    slug: 'prism-field',
    title: 'Prism Field',
    tagline: 'Light & motion',
    description: 'Tune light with Camera Control, bend it by tilting the phone, then freeze the field.',
    status: 'available',
    poster: 'prism',
    tech: ['camera control', 'motion', 'skia'],
    route: '/experiments/prism-field',
  },
  {
    slug: 'relic-lift',
    title: 'Relic Lift',
    tagline: 'Lift & recast',
    description: 'Find an everyday object, lift it from the camera, and cast it as living metal.',
    status: 'available',
    poster: 'relic',
    tech: ['camera', 'skia', 'reanimated'],
    route: '/experiments/relic-lift',
  },
  {
    slug: 'rain-lens',
    title: 'Rain Lens',
    tagline: 'Camera weather',
    description: 'A live camera atmosphere with drifting glass droplets and cinematic controls.',
    status: 'available',
    poster: 'lens',
    tech: ['camera', 'skia', 'reanimated'],
    route: '/experiments/rain-lens',
  },
  {
    slug: 'volcano-drive',
    title: 'Volcano Drive',
    tagline: 'Endless run',
    description: 'A low-poly endless traffic run rendered with Three.js on native WebGPU.',
    status: 'available',
    poster: 'road',
    tech: ['webgpu', 'three', 'skia'],
    route: '/experiments/volcano-drive',
  },
  {
    slug: 'gpu-particles',
    title: 'GPU particle field',
    tagline: 'Compute field',
    description: 'A future compute-driven scene with touch-reactive particles.',
    status: 'concept',
    poster: 'particles',
    tech: ['webgpu', 'three'],
  },
  {
    slug: 'skia-transitions',
    title: 'Skia transitions',
    tagline: 'Masks & shaders',
    description: 'A tactile canvas study for masks, shaders, and fluid gestures.',
    status: 'concept',
    poster: 'wave',
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
