# Feature name

One sentence describing the user-visible experiment.

## Demo

- **Route:** `/experiments/<slug>`
- **Platforms:** list only platforms you tested
- **Build:** Expo Go or development build

Describe the shortest path through the interaction and its controls.

## How it works

Explain the feature's two or three meaningful technical decisions. Prefer concrete data flow over
a dependency list.

## File map

- `<entry>.tsx` — route-facing component.
- `<engine>.ts` — rendering or domain engine.
- `<overlay>.tsx` — focused presentation component.

## Constraints

Record platform limitations, permissions, performance assumptions, and intentionally deferred work.
