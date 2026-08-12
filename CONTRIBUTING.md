# Contributing to Native Lab

Thanks for improving the lab. The best contributions here are focused: one bug, one experiment, or
one maintainability improvement with a clear way to verify it.

## Before you begin

- Search existing issues before starting a large change.
- For a new experiment or a major dependency, open a proposal first. Explain the interaction,
  supported platforms, and why it belongs in this repository.
- Never commit credentials, signing files, personal data, generated builds, or dependency folders.

## Development workflow

1. Install dependencies with `bun install`.
2. Start the gallery with `bun start`.
3. Use a development build for local Expo modules, Vision Camera, or WebGPU.
4. Make the smallest coherent change.
5. Run `bun run validate` and `bun run build:web`.
6. Test the affected route on every platform claimed in its README.

## Adding an experiment

Use `src/features/<slug>` as the ownership boundary. A complete experiment includes:

```text
src/app/experiments/<slug>.tsx        thin route adapter
src/features/<slug>/README.md         purpose, controls, runtime, and file map
src/features/<slug>/<entry>.tsx       exported experience component
src/data/experiments.ts               gallery title, tagline, poster, route, status, and tags
src/components/experiment-poster.tsx  gallery artwork for the new poster key
```

Copy [docs/feature-readme-template.md](docs/feature-readme-template.md) and replace every prompt.
Do not leave placeholder prose in a pull request.

### Gallery poster

Every experiment shows a tile on the home screen, so a new entry needs a `tagline` (two or three
words) and a `poster` key. Add the key to `PosterArt` in the registry, then compose the artwork in
`src/components/experiment-poster.tsx`: one palette entry and one `artwork` entry drawn on a 100×100
grid with plain views, native gradients, and transforms. Keep posters static and asset-free — the
gallery renders every tile at once, so no canvas, image, or animation loop belongs in a poster.

## Code expectations

- Keep navigation code in `src/app` and implementation code in `src/features`.
- Prefer the `@/` and `@/assets/` aliases over parent-relative imports.
- Use kebab-case filenames and explicit, domain-specific names.
- Keep platform behavior visible through `.ios.tsx`, `.android.tsx`, or `.web.tsx` adapters.
- Dispose of camera sessions, audio players, animation work, and GPU resources during cleanup.
- Explain unavoidable lint suppressions next to the line. File-wide suppressions need a concrete
  reason in the feature README.
- Do not extract an abstraction until at least two features share the same behavior and lifecycle.
- Update documentation when behavior, controls, dependencies, or platform support changes.

Large experience components are accepted prototypes, not a target pattern. When changing one,
prefer extracting a coherent controller, overlay, or engine boundary instead of adding another
unrelated responsibility.

## Pull requests

Describe what changed, how it was tested, and which platforms were exercised. Include a short
screen recording for interaction or visual changes. Keep formatting-only work separate from
behavior changes when possible.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
