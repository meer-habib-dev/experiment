# Volcano Drive

A low-poly endless-driving game with three-lane traffic, pickups, checkpoints, and escalating speed.

## Demo

- **Route:** `/experiments/volcano-drive`
- **Platforms:** native platforms with WebGPU support
- **Build:** development build required

Drag horizontally to steer. Collect coins, turbo, and magnet pickups; avoid traffic and survive as
the procedural road accelerates.

## How it works

`VolcanoDriveWorld` owns the Three.js WebGPU scene and simulation behind an imperative interface.
The React component manages run state, gestures, audio players, and haptics. A transparent Skia
canvas supplies speed streaks and impact feedback above the 3D scene.

## File map

- `volcano-drive-game.tsx` — game lifecycle, controls, audio, and state.
- `game-world.ts` — procedural world, traffic, pickups, and renderer.
- `speed-fx.tsx` — Skia feedback overlay.
- `race-results.tsx` — crash and score presentation.
- [`.maestro/volcano-drive.yaml`](../../../.maestro/volcano-drive.yaml) — simulator journey for
  core states.

## Constraints

WebGPU requires a development build. Audio files in `assets/audio` are shared with Timberline and
covered by the included CC0 notice. Profile changes that increase traffic or scenery counts.
