# Halo Arena

An interactive stadium booking study where the venue itself is the seat map: orbit the arena, focus
a section, choose a seat, and review it in checkout.

## Demo

- **Route:** `/experiments/halo-arena`
- **Platforms:** native platforms with WebGPU support
- **Build:** development build required

Drag to orbit, pinch to zoom, and tap the geometry to move from section selection to an exact seat.
The HUD and confirmation flow remain normal React Native views above the GPU canvas.

## How it works

`ArenaWorld` owns the Three.js WebGPU scene, raycasting, camera, and seat geometry behind a small
imperative API. The experience component translates gestures into world commands and React state.
Skia supplies short-lived selection effects without coupling them to the 3D renderer.

## File map

- `arena-booking-experience.tsx` — lifecycle, input, and booking coordinator.
- `arena-world.ts` — Three.js scene, camera, picking, and renderer cleanup.
- `arena-fx.tsx` — Skia selection pulses.
- `arena-checkout.tsx` — selected-seat summary.

## Constraints

WebGPU is not available in Expo Go. Renderer initialization is asynchronous; preserve the mounted
guards and disposal path when changing it. The current prototype has no web fallback.
