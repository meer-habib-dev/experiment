# Sign Off

A tactile signature pad where completed ink can be cleared with eleven deliberately playful
effects, from dust and gravity to fireworks and a black hole.

## Demo

- **Route:** `/experiments/sign-off`
- **Platforms:** iOS and Android; a simplified explanatory preview is used on web
- **Build:** Expo Go on native

Draw a signature, finish it, then choose an eraser effect. The interaction combines gesture input,
haptic feedback, path sampling, and particle animation rather than treating the canvas as an image.

## How it works

`SignaturePad` owns the drawing state and converts Skia paths into particle fields. The effect
catalog in `eraser-effects.ts` describes how those particles evolve, while `InkParticles` renders
the live field. Mutable Skia and Reanimated values are kept on the UI thread for responsive input.

## File map

- `sign-off-experience.tsx` — native route-facing layout.
- `sign-off-experience.web.tsx` — web-specific fallback.
- `signature-pad.tsx` — gesture, drawing, and effect coordinator.
- `eraser-effects.ts` — effect definitions and particle evolution.
- `ink-sampler.ts` — converts strokes into renderable samples.
- `ink-particles.tsx` — Skia particle renderer.

## Constraints

The coordinator mutates worklet-owned values, so it has a documented React hooks lint suppression.
Avoid moving those values into React state; doing so would put per-frame work on the JS thread.
