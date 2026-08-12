# Feature index

This directory contains the implementation of every runnable experiment. The gallery registry is
in [`src/data/experiments.ts`](../data/experiments.ts); Expo Router adapters live in
[`src/app/experiments`](../app/experiments).

| Feature | Entry point | Rendering path | Build |
| --- | --- | --- | --- |
| [Sign Off](sign-off/README.md) | `sign-off-experience.tsx` | Skia + Reanimated | Expo Go on native |
| [Field Folio](folio-shuffle/README.md) | `folio-shuffle-experience.tsx` | Skia + gestures | Expo Go on native |
| [Halo Arena](halo-arena/README.md) | `arena-booking-experience.tsx` | Three.js + WebGPU + Skia | Development build |
| [Timberline](timberline/README.md) | `timberline-game.tsx` | Three.js + WebGPU + cannon-es | Development build |
| [Prism Field](prism-field/README.md) | `prism-field-camera.tsx` | AVFoundation + motion | iOS development build |
| [Relic Lift](relic-lift/README.md) | `relic-lift-camera.tsx` | Vision + Metal + Skia camera | iOS development build |
| [Rain Lens](rain-lens/README.md) | `rain-lens-camera.tsx` | Vision Camera + Skia frame processor | Development build |
| [Volcano Drive](volcano-drive/README.md) | `volcano-drive-game.tsx` | Three.js + WebGPU + Skia | Development build |

## Ownership rules

- A feature may import shared code, but should not import another feature.
- A route file should only configure navigation and mount the feature entry point.
- Platform-specific native loading belongs behind a platform extension such as `.ios.tsx`.
- Update the feature README whenever controls, support, or runtime requirements change.
- Add new concepts to the registry only when the placeholder page communicates something useful;
  otherwise keep proposals in issues until an implementation exists.
