# Field Folio

A gesture-driven field journal with page curls and movable metallic stickers that react to light and
touch.

## Demo

- **Route:** `/experiments/folio-shuffle`
- **Platforms:** iOS and Android; a simplified web implementation is included
- **Build:** Expo Go on native

Swipe to move through the folio. Press, lift, and drag a sticker to rearrange a page; the curl and
sticker highlights respond continuously during the gesture.

## How it works

The experience coordinates page order and gestures. `PageCurl` renders the turning sheet in Skia,
while each memoized `MetalSticker` evaluates a runtime shader without forcing the whole page tree to
rerender during a drag.

## File map

- `folio-shuffle-experience.tsx` — native page and gesture coordinator.
- `folio-shuffle-experience.web.tsx` — web-specific preview.
- `folio-page.tsx` — page content and sticker composition.
- `page-curl.tsx` — Skia page-turn rendering.
- `metal-sticker.tsx` — sticker interaction and canvas.
- `metal-sticker-shader.ts` — metallic runtime shader.

## Constraints

The native implementation relies on UI-thread shared-value mutation. Keep the file-level lint
suppressions limited to that worklet boundary, and measure older devices when adding more stickers.
