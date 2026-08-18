# Depth Light

A live, draggable light source for the camera. VisionCamera v5 emits native frame buffers, React Native WebGPU imports them as external textures, and TypeGPU owns the typed lighting uniforms used by the render pass.

On a front camera with TrueDepth, a filtered hardware depth stream shapes normals and falloff. Other cameras use a luminance-gradient fallback so the interaction remains live. Camera and depth frames never enter React state and are disposed immediately after GPU submission.

This feature requires a native development build; React Native WebGPU is not available in Expo Go.
