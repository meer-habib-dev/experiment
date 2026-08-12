# Relic Lift

An iOS capture flow that isolates an everyday object, lifts it from its background, and presents it
as a responsive metallic artifact.

## Demo

- **Route:** `/experiments/relic-lift`
- **Platforms:** iOS for subject extraction; a static image adapter exists elsewhere
- **Build:** iOS development build required

Grant camera permission, frame a clear foreground subject, capture it, and move through the lift and
metal presentation states.

## How it works

The feature coordinates Vision Camera frames and Skia preview effects. After capture, the local
`relic-subject-lift` Expo module uses Apple Vision to extract the foreground and a native Metal view
to present the result. Platform adapters keep that native dependency out of universal rendering.

## File map

- `relic-lift-camera.tsx` — camera, state machine, and overlays.
- `relic-lift-shader.ts` — Skia preview treatment.
- `relic-native.ios.tsx` — Vision/Metal module adapter.
- `relic-native.tsx` — non-iOS image fallback.
- `modules/relic-subject-lift` — Swift Vision and Metal implementation.

## Constraints

Subject quality depends on contrast and clear object boundaries. The main coordinator is currently
large; new work should extract lifecycle or state-machine boundaries instead of adding unrelated UI
states. Native changes require a fresh iOS build.
