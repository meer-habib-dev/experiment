# Rain Lens

A live-camera atmosphere that refracts the scene through animated droplets and cinematic capture
controls.

## Demo

- **Route:** `/experiments/rain-lens`
- **Platforms:** native platforms supported by Vision Camera and Skia frame processors
- **Build:** development build required

Grant camera access, tap to focus, adjust the atmosphere, flip cameras, and capture the processed
frame. Frames remain local to the device.

## How it works

Vision Camera provides frames directly to a Skia frame processor. A compiled runtime shader applies
the droplet distortion, while React Native overlays manage permission, focus, capture, and camera
selection outside the per-frame path.

## File map

- `rain-lens-camera.tsx` — session lifecycle, controls, capture, and overlays.
- `rain-lens-shader.ts` — compiled Skia runtime effect and paint.

## Constraints

This route cannot run in Expo Go because its camera stack contains native modules. Shader changes
must avoid per-frame allocation. Test capture orientation and both camera positions on hardware.
