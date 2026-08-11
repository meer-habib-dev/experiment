# Native Lab

A build-in-public playground for polished iOS and universal mobile experiments. Each idea lives on
its own Expo Router route so it can become a focused demo, recording, and social post without
turning the rest of the app into a monolith.

## Included

- Expo 57, React Native 0.86, React 19, and typed Expo Router routes
- NativeWind 5 preview + Tailwind CSS 4 for all application styling
- React Native Reanimated, Worklets, Gesture Handler, and Expo Haptics
- React Native Skia for canvas drawing, shaders, and visual effects
- React Native WebGPU, Three.js, React Three Fiber, and `wgpu-matrix`
- Expo DOM support through Expo Router's `"use dom"` components
- React Compiler and the New Architecture from the Expo 57 base

## Run it

```bash
npm run ios
```

Start with Expo Go for the Router, UI, motion, gestures, and most Skia work. WebGPU ships native
code and needs an iOS development build:

```bash
npm run ios:dev
```

Useful checks:

```bash
npm run typecheck
npm run lint
npm run doctor
```

## First experiment: Volcano Drive

Open `/experiments/volcano-drive` from the lab home screen. Drag anywhere to steer through
three-lane traffic, collect coins, trigger turbo and magnet power-ups, and pass checkpoints as the
road accelerates. The scene is procedural Three.js rendered by native WebGPU, speed streaks are a
transparent Skia layer, and the crash/results card is an Expo DOM component.

The game sounds in `assets/audio` come from Kenney's CC0 Interface Sounds pack; the local license
notice is included beside the files. A simulator journey covering ready, driving, and crash states
is available at `.maestro/volcano-drive.yaml`.

## Structure

```text
src/
  app/            routes and layouts only
  components/     reusable visual building blocks
  data/           experiment registry and metadata
  tw/             CSS-enabled React Native primitives
  global.css      NativeWind theme and design tokens
```

To start an experiment, add its metadata in `src/data/experiments.ts`, then create or replace its
screen under `src/app/experiments`. Keep engine-specific helpers beside normal source code—not in
the route directory—and lazy-load large Skia or WebGPU scenes when practical.
