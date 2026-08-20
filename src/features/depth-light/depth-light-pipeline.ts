import { GPUTextureUsage } from 'react-native-webgpu';
import tgpu, { d } from 'typegpu';

import {
  depthShader,
  lightShader,
  rawDepthSize,
  resolvedDepthSize,
} from '@/features/depth-light/depth-light-shaders';

const Controls = d.struct({
  /** xy = light position in screen UV, z = light distance in metres, w = intensity. */
  light: d.vec4f,
  /** rgb = light colour, w = falloff radius in metres. */
  color: d.vec4f,
  /** xy = view size in px, zw = colour frame display size in px. */
  viewport: d.vec4f,
  /** x = colour rotation code, y = colour mirrored, z = tan(vfov/2), w = ambient. */
  camera: d.vec4f,
  /** x = depth available, y = depth rotation code, z = debug mode, w = depth mirrored. */
  depthInfo: d.vec4f,
  /** xy = valid depth region inside the raw texture, zw = depth display size in px. */
  depthSize: d.vec4f,
  /** x = raw samples are disparity rather than metres. */
  flags: d.vec4f,
});

/** Float32 slot indices for the worklet's per-frame write into `controlBuffer`. */
export const control = {
  lightX: 0,
  lightY: 1,
  lightZ: 2,
  intensity: 3,
  colorR: 4,
  colorG: 5,
  colorB: 6,
  radius: 7,
  viewWidth: 8,
  viewHeight: 9,
  sourceWidth: 10,
  sourceHeight: 11,
  cameraRotation: 12,
  cameraMirrored: 13,
  tanHalfFovY: 14,
  ambient: 15,
  hasDepth: 16,
  depthRotation: 17,
  debugMode: 18,
  depthMirrored: 19,
  depthScaleX: 20,
  depthScaleY: 21,
  depthWidth: 22,
  depthHeight: 23,
  depthIsDisparity: 24,
} as const;

export const CONTROL_FLOATS = 28;

export type DepthLightGpu = {
  cameraSampler: GPUSampler;
  context: GPUCanvasContext & { present?: () => void };
  controlBuffer: GPUBuffer;
  depthBindGroup: GPUBindGroup;
  depthPipeline: GPURenderPipeline;
  device: GPUDevice;
  lightLayout: GPUBindGroupLayout;
  lightPipeline: GPURenderPipeline;
  rawDepthTexture: GPUTexture;
  resolvedDepthView: GPUTextureView;
  destroy: () => void;
};

export function createDepthLightGpu(
  device: GPUDevice,
  context: GPUCanvasContext & { present?: () => void },
): DepthLightGpu {
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ alphaMode: 'opaque', device, format });

  // TypeGPU owns the typed control block. Its underlying WebGPU buffer is what
  // crosses into the VisionCamera worklet - the TgpuBuffer wrapper is a JS
  // class and cannot be serialised into a worklet runtime.
  const root = tgpu.initFromDevice({ device });
  const controls = root.createUniform(Controls, {
    light: d.vec4f(0.3, 0.4, 0.45, 1),
    color: d.vec4f(1, 0.58, 0.28, 0.5),
    viewport: d.vec4f(1, 1, 1, 1),
    camera: d.vec4f(0, 0, 0.6, 0.08),
    depthInfo: d.vec4f(0, 0, 0, 0),
    depthSize: d.vec4f(1, 1, 3, 4),
    flags: d.vec4f(0, 0, 0, 0),
  });
  const controlBuffer = root.unwrap(controls);

  const rawDepthTexture = device.createTexture({
    format: 'r32float',
    label: 'depth-light-raw-depth',
    size: { height: rawDepthSize.height, width: rawDepthSize.width },
    usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
  });
  const resolvedDepthTexture = device.createTexture({
    format: 'rg16float',
    label: 'depth-light-resolved-depth',
    size: { height: resolvedDepthSize.height, width: resolvedDepthSize.width },
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });
  const resolvedDepthView = resolvedDepthTexture.createView();

  const cameraSampler = device.createSampler({
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
    magFilter: 'linear',
    minFilter: 'linear',
  });

  // Explicit layouts rather than `layout: 'auto'`. r32float is an
  // unfilterable-float format, and an inferred layout may declare it as
  // filterable and reject the bind group at validation time.
  const depthLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, buffer: { type: 'uniform' }, visibility: GPUShaderStage.FRAGMENT },
      {
        binding: 1,
        texture: { sampleType: 'unfilterable-float', viewDimension: '2d' },
        visibility: GPUShaderStage.FRAGMENT,
      },
    ],
    label: 'depth-light-resolve-layout',
  });
  const lightLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, buffer: { type: 'uniform' }, visibility: GPUShaderStage.FRAGMENT },
      { binding: 1, sampler: { type: 'filtering' }, visibility: GPUShaderStage.FRAGMENT },
      {
        binding: 2,
        texture: { sampleType: 'float', viewDimension: '2d' },
        visibility: GPUShaderStage.FRAGMENT,
      },
      {
        binding: 3,
        texture: { sampleType: 'float', viewDimension: '2d' },
        visibility: GPUShaderStage.FRAGMENT,
      },
    ],
    label: 'depth-light-lighting-layout',
  });

  const depthModule = device.createShaderModule({
    code: depthShader,
    label: 'depth-light-resolve-shader',
  });
  const depthPipeline = device.createRenderPipeline({
    label: 'depth-light-resolve-pipeline',
    layout: device.createPipelineLayout({ bindGroupLayouts: [depthLayout] }),
    vertex: { entryPoint: 'vertexMain', module: depthModule },
    fragment: { entryPoint: 'fragmentMain', module: depthModule, targets: [{ format: 'rg16float' }] },
    primitive: { topology: 'triangle-list' },
  });

  const lightModule = device.createShaderModule({
    code: lightShader,
    label: 'depth-light-lighting-shader',
  });
  const lightPipeline = device.createRenderPipeline({
    label: 'depth-light-lighting-pipeline',
    layout: device.createPipelineLayout({ bindGroupLayouts: [lightLayout] }),
    vertex: { entryPoint: 'vertexMain', module: lightModule },
    fragment: { entryPoint: 'fragmentMain', module: lightModule, targets: [{ format }] },
    primitive: { topology: 'triangle-list' },
  });

  // The resolve pass binds nothing per-frame, so its bind group is built once.
  const depthBindGroup = device.createBindGroup({
    entries: [
      { binding: 0, resource: { buffer: controlBuffer } },
      { binding: 1, resource: rawDepthTexture.createView() },
    ],
    label: 'depth-light-resolve-bindings',
    layout: depthLayout,
  });

  return {
    cameraSampler,
    context,
    controlBuffer,
    depthBindGroup,
    depthPipeline,
    device,
    lightLayout,
    lightPipeline,
    rawDepthTexture,
    resolvedDepthView,
    destroy: () => {
      rawDepthTexture.destroy();
      resolvedDepthTexture.destroy();
      root.destroy();
    },
  };
}

export { rawDepthSize } from '@/features/depth-light/depth-light-shaders';

export const depthTargetResolution = { height: 480, width: 640 } as const;
export const frameTargetResolution = { height: 1280, width: 720 } as const;
