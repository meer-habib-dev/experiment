# Architecture

Native Lab is a gallery shell around independent experiments. Its most important design rule is
directional ownership: routes know about features; features do not know about the gallery.

```text
src/app route
    -> src/features/<slug> entry component
        -> feature-local UI, state, shaders, and engine
        -> optional modules/<name> native implementation

src/data/experiments.ts -> gallery card and route metadata
src/components          -> genuinely shared presentation
src/tw                  -> shared styled React Native primitives
```

## Boundaries

### Routes

Files under `src/app` configure Expo Router and render feature entry points. They should not contain
rendering engines, domain state, or reusable UI. Every concrete experiment owns a static route;
concept-only registry entries fall back to `experiments/[slug].tsx`.

### Features

Each directory under `src/features` is independently understandable and contains a README. Keep
feature-only types and helpers there. Importing between feature directories is discouraged because
it couples experiments that should be removable. Promote code to `src/components` or a deliberately
named shared package only after the ownership is genuinely shared.

### Native modules

Local Expo modules live under `modules`. TypeScript platform adapters keep native module loading out
of universal code. Because these modules are compiled into the app, changes require a new native
development build rather than a Metro refresh.

### Runtime resources

GPU worlds, audio players, subscriptions, and camera sessions must have explicit setup and teardown.
Do not let a route transition leave work running. Worklet mutation may require targeted React
Compiler lint suppressions; keep those suppressions narrow and document why the mutation is safe.

## Dependency decisions

Dependencies are shared at the app level, but that does not make them appropriate everywhere. A
feature README should name its major runtime dependencies. New packages should earn their place by
providing a capability that the platform or an existing dependency does not already cover.

The repository uses Bun as its package manager, strict TypeScript, Expo's flat ESLint config, Expo
Router typed routes, React Compiler, and the New Architecture.

## Known maintenance pressure

Several visual prototypes still have large coordinator files. They combine lifecycle, input, and
presentation because the interactions evolved together. Treat files approaching 500 lines as a
prompt to look for a real boundary, not as an automatic refactor. Good extraction targets include:

- resource or session lifecycle hooks;
- pure state machines and reducers;
- heads-up display or permission overlays;
- rendering engines with a small imperative interface.

Avoid generic `utils`, `helpers`, and `common` directories. Their names hide ownership and make the
repository feel generated rather than designed.
