# Depth Light

A draggable point light that lives *in* the scene with you. VisionCamera v5 emits native
frame buffers, React Native WebGPU imports them as shared textures, and TypeGPU owns the
typed control block the render passes read. Inference-free, but the shape of the pipeline
follows the same idea: depth and colour meet on the GPU and never come back to the CPU.

## How a frame is drawn

Both passes go into **one command encoder and one submit**:

1. **Resolve** (`depth-light-shaders.ts` → `depthShader`). Raw TrueDepth metres are rewritten
   into colour-frame display space: rotation and mirroring applied once, field of view matched
   to the video crop, dropouts inpainted, and a bilateral kernel run over the result. Output is
   `rg16float` (depth, confidence) — filterable, unlike `r32float`.
2. **Light** (`lightShader`). Depth reconstructs a view-space position per pixel, cross products
   of neighbouring positions give normals, a screen-space march along the light ray gives contact
   shadows, and the emitter is drawn at its own depth so anything nearer hides it.

Because the resolve pass writes into colour-frame UV, the lighting pass samples depth and colour
at the same coordinate and does no reprojection of its own.

## Two things that are easy to get wrong here

**Depth and colour do not share a field of view.** The 16:9 video stream is a centre crop of the
4:3 depth sensor, so the depth map covers a wider field. Mapping depth 1:1 onto display UV
stretches it by ~33% and slides the lighting off the subject. `colorUvToDepthUv` compares the two
display aspect ratios and crops the wider one.

**The sensor may not be sending metres.** TrueDepth frequently streams *disparity* (roughly
1/metres), and `Depth.convert('depth-32-bit')` is not offered on every device. Read as metres, a
face at 0.4 m reads as 2.5 m and a wall at 3 m reads as 0.33 m, so the scene lights up inside out
— and the bilateral kernel's 4 cm range sigma, applied to disparity units, rejects every
neighbour and stops smoothing entirely. Conversion is attempted, but the flag passed to the
shader comes from the pixel format of the buffer that was *actually* uploaded, never from the
format that was requested.

**Normals must come from positions, not from depth.** Differencing metric depth directly makes
every silhouette read as a wall seen edge-on, and the diffuse term then swings 0→1 between
adjacent texels — a blocky mosaic on hair and shoulders. Differencing reconstructed *positions*
keeps the units consistent; the two sides of each axis are blended by how well they agree with
the centre, and pixels that straddle a genuine discontinuity are lit at reduced strength instead
of reading as a bright rim.

## Threading

`useFrameOutput` and `useDepthOutput` each create their own `DispatchQueue` natively, so their
worklets run on different threads. Driving one `GPUDevice` from both is a data race. This feature
uses `VisionCamera.createOutputSynchronizer` instead (`use-synchronized-frames.ts`), which
delivers timestamp-aligned colour and depth to a single callback on a single thread — no race,
and the depth map is paired with the frame it shades. The depth output is never given its own
callback. If the synchronizer cannot be created (it is iOS-only, and needs the outputs already
connected to the session) the feature falls back to a colour-only path that still runs on one
thread.

Imported surfaces are cached by IOSurface handle. `GPUSharedTextureMemory` has no explicit
release — it is reclaimed only when the JS object is collected — so importing per frame retains
native memory faster than Hermes frees it. The camera recycles a small pool of surfaces, so
keying the import, view and bind group by handle makes the steady state allocate nothing.

Keep `targetResolution` values as module constants: they are `useMemo` dependencies inside
VisionCamera's hooks, and an inline object literal recreates the native capture output on every
React render.

## Validating the shaders

The WGSL lives in `depth-light-shaders.ts` with no native imports, so it can be compiled and
rendered by any WebGPU implementation. Deno ships one:

```bash
deno run --unstable-webgpu --allow-all your-harness.ts
```

Building both pipelines with the real bind group layouts catches shader and layout errors, and
rendering a synthetic depth map (a curved blob at 0.45 m, a slab at 0.25 m, a wall at 1.6 m)
catches sign and scale errors that compilation cannot.

## Requirements

A native development build — React Native WebGPU is not available in Expo Go. Hardware depth
needs a TrueDepth front camera; other devices fall back to a luminance proxy so the interaction
stays live.
