# Timberline

A physics tower game that lets the player pull individual wooden blocks while the entire structure
responds in real time.

## Demo

- **Route:** `/experiments/timberline`
- **Platforms:** native platforms with WebGPU support
- **Build:** development build required

Orbit or pinch the camera to inspect the tower, then drag a selectable block. Audio, haptics, and a
Skia overlay communicate movement, instability, and the final result.

## How it works

`TimberlineWorld` combines a Three.js WebGPU renderer with cannon-es rigid bodies and exposes
high-level picking and camera commands. The route-facing game owns resource lifecycle and converts
world snapshots into HUD state.

## File map

- `timberline-game.tsx` — game lifecycle, gestures, audio, and state.
- `tower-world.ts` — rendering, physics, picking, and camera.
- `tower-hud.tsx` — controls and live status.
- `tower-fx.tsx` — Skia feedback layer.
- `tower-results.tsx` — end-state presentation.

## Constraints

WebGPU requires a development build. Physics and rendering share a frame loop, so changes to object
counts or simulation steps should be profiled on a physical device. Audio assets are shared from
`assets/audio` and covered by the adjacent CC0 notice.
