import { GPUTextureUsage } from 'react-native-webgpu';
import tgpu, { d } from 'typegpu';

const DEPTH_WIDTH = 640;
const DEPTH_HEIGHT = 640;

const LightUniforms = d.struct({
  light: d.vec4f,
  color: d.vec4f,
  viewport: d.vec4f,
  depth: d.vec4f,
  yuv0: d.vec4f,
  yuv1: d.vec4f,
  yuv2: d.vec4f,
});

export type DepthLightGpu = {
  context: GPUCanvasContext & { present?: () => void };
  depthTexture: GPUTexture;
  depthView: GPUTextureView;
  device: GPUDevice;
  pipeline: GPURenderPipeline;
  sampler: GPUSampler;
  uniformBuffer: GPUBuffer;
  destroy: () => void;
};

const shader = /* wgsl */ `
struct LightUniforms {
  light: vec4f,
  color: vec4f,
  viewport: vec4f,
  depth: vec4f,
  yuv0: vec4f,
  yuv1: vec4f,
  yuv2: vec4f,
}

@group(0) @binding(0) var<uniform> controls: LightUniforms;
@group(0) @binding(1) var linearSampler: sampler;
@group(0) @binding(2) var cameraFrame: texture_2d<f32>;
@group(0) @binding(3) var depthMap: texture_2d<f32>;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vertexMain(@builtin(vertex_index) index: u32) -> VertexOut {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0)
  );
  var uvs = array<vec2f, 3>(
    vec2f(0.0, 1.0),
    vec2f(2.0, 1.0),
    vec2f(0.0, -1.0)
  );
  var output: VertexOut;
  output.position = vec4f(positions[index], 0.0, 1.0);
  output.uv = uvs[index];
  return output;
}

fn coverUv(uv: vec2f) -> vec2f {
  let viewAspect = controls.viewport.x / max(controls.viewport.y, 1.0);
  let sourceAspect = controls.viewport.z / max(controls.viewport.w, 1.0);
  var result = uv;
  if (sourceAspect > viewAspect) {
    let visible = viewAspect / sourceAspect;
    result.x = (uv.x - 0.5) * visible + 0.5;
  } else {
    let visible = sourceAspect / viewAspect;
    result.y = (uv.y - 0.5) * visible + 0.5;
  }
  return clamp(result, vec2f(0.001), vec2f(0.999));
}

fn rawDepthUv(displayUv: vec2f) -> vec2f {
  let rotation = controls.depth.y;
  var result = displayUv;
  // Mirror in display space first, then map into the sensor's texture space.
  if (controls.depth.w > 0.5) { result.x = 1.0 - result.x; }
  if (rotation >= 0.5 && rotation < 1.5) { result = vec2f(1.0 - result.y, result.x); }
  if (rotation >= 1.5 && rotation < 2.5) { result = vec2f(1.0 - result.x, 1.0 - result.y); }
  if (rotation >= 2.5) { result = vec2f(result.y, 1.0 - result.x); }
  return result * controls.yuv0.zw;
}

fn luminance(value: vec3f) -> f32 {
  return dot(value, vec3f(0.2126, 0.7152, 0.0722));
}

fn loadMetricDepth(rawUv: vec2f) -> f32 {
  let dimensions = vec2f(textureDimensions(depthMap));
  let coordinate = vec2i(clamp(rawUv, vec2f(0.0), vec2f(0.9999)) * dimensions);
  return textureLoad(depthMap, coordinate, 0).r;
}

fn rawCameraUv(displayUv: vec2f) -> vec2f {
  let rotation = controls.yuv0.x;
  var result = displayUv;
  if (controls.yuv0.y > 0.5) { result.x = 1.0 - result.x; }
  // RGB buffers keep the sensor's native orientation. Sampling uses the
  // inverse transform so the displayed image follows the device orientation.
  if (rotation >= 0.5 && rotation < 1.5) { result = vec2f(1.0 - result.y, result.x); }
  if (rotation >= 1.5 && rotation < 2.5) { result = vec2f(1.0 - result.x, 1.0 - result.y); }
  if (rotation >= 2.5) { result = vec2f(result.y, 1.0 - result.x); }
  return result;
}

fn sampleCamera(displayUv: vec2f) -> vec3f {
  return textureSampleLevel(cameraFrame, linearSampler, rawCameraUv(displayUv), 0.0).rgb;
}

@fragment
fn fragmentMain(input: VertexOut) -> @location(0) vec4f {
  let uv = coverUv(input.uv);
  let source = sampleCamera(uv);
  let px = vec2f(1.0 / 640.0, 1.0 / 640.0);
  let duv = rawDepthUv(uv);
  let rawSensed = loadMetricDepth(duv);
  let sensed = select(1.2, rawSensed, rawSensed == rawSensed && rawSensed > 0.08 && rawSensed < 5.0);
  let rawLeft = loadMetricDepth(duv - vec2f(px.x * 2.0, 0.0));
  let rawRight = loadMetricDepth(duv + vec2f(px.x * 2.0, 0.0));
  let rawUp = loadMetricDepth(duv - vec2f(0.0, px.y * 2.0));
  let rawDown = loadMetricDepth(duv + vec2f(0.0, px.y * 2.0));
  let sensedLeft = select(sensed, rawLeft, rawLeft == rawLeft && rawLeft > 0.08 && rawLeft < 5.0);
  let sensedRight = select(sensed, rawRight, rawRight == rawRight && rawRight > 0.08 && rawRight < 5.0);
  let sensedUp = select(sensed, rawUp, rawUp == rawUp && rawUp > 0.08 && rawUp < 5.0);
  let sensedDown = select(sensed, rawDown, rawDown == rawDown && rawDown > 0.08 && rawDown < 5.0);

  // Hardware depth is preferred. The fallback builds a stable pseudo surface
  // normal from camera luminance so the experiment remains useful on devices
  // without TrueDepth/LiDAR.
  let luma = luminance(source);
  let sourceX = sampleCamera(uv + vec2f(0.003, 0.0));
  let sourceY = sampleCamera(uv + vec2f(0.0, 0.003));
  let fallbackDx = (luminance(sourceX) - luma) * 0.28;
  let fallbackDy = (luminance(sourceY) - luma) * 0.28;
  let hardware = controls.depth.x;
  let dx = mix(fallbackDx, sensedRight - sensedLeft, hardware);
  let dy = mix(fallbackDy, sensedDown - sensedUp, hardware);
  let normal = normalize(vec3f(-dx, -dy, mix(0.11, max(0.004, sensed * 0.014), hardware)));

  let viewAspect = controls.viewport.x / max(controls.viewport.y, 1.0);
  let fovScale = 1.18;
  let surfacePosition = vec3f(
    (input.uv.x - 0.5) * sensed * viewAspect * fovScale,
    (0.5 - input.uv.y) * sensed * fovScale,
    sensed
  );
  let lightDepth = 0.22;
  let lightPosition = vec3f(
    (controls.light.x - 0.5) * lightDepth * viewAspect * fovScale,
    (0.5 - controls.light.y) * lightDepth * fovScale,
    lightDepth
  );
  let lightVector = lightPosition - surfacePosition;
  let lightDistance = length(lightVector);
  let direction = normalize(lightVector);
  let radius = 0.25 + controls.light.z * 1.15;
  let attenuation = pow(smoothstep(radius, 0.04, lightDistance), 2.0);
  let diffuse = max(dot(normal, direction), 0.0);
  let halfVector = normalize(direction + vec3f(0.0, 0.0, 1.0));
  let specular = pow(max(dot(normal, halfVector), 0.0), 42.0);

  // Screen-space depth ray: objects closer than the fragment-to-light ray
  // block the injected light, which lets hands cast a convincing live shadow.
  var visibility = 1.0;
  for (var step = 1; step <= 8; step += 1) {
    let t = f32(step) / 9.0;
    let rayUv = mix(input.uv, controls.light.xy, t);
    let blockerRaw = loadMetricDepth(rawDepthUv(rayUv));
    let rayDepth = mix(sensed, lightDepth, t);
    let blockerValid = blockerRaw == blockerRaw && blockerRaw > 0.08 && blockerRaw < 5.0;
    if (blockerValid && blockerRaw < rayDepth - 0.035) {
      visibility *= 0.52;
    }
  }
  visibility = mix(1.0, visibility, hardware);
  let energy = attenuation * visibility * controls.light.w;

  // Shade in linear light so the key light preserves skin/material detail.
  // The source supplies albedo; depth normals shape diffuse and specular terms.
  let sourceLinear = pow(max(source, vec3f(0.0)), vec3f(2.2));
  let lightTint = mix(vec3f(1.0), controls.color.rgb, 0.58);
  let ambient = 0.38;
  let irradiance = energy * (0.12 + diffuse * 2.35);
  var litLinear = sourceLinear * (vec3f(ambient) + lightTint * irradiance);
  litLinear += controls.color.rgb * specular * energy * 0.22;
  var graded = pow(max(litLinear, vec3f(0.0)), vec3f(1.0 / 2.2));

  // The emitter is part of the scene, with a hot core and broad optical halo.
  let emitterDistance = length(input.uv - controls.light.xy);
  let emitterCore = 1.0 - smoothstep(0.006, 0.019, emitterDistance);
  let emitterHalo = exp(-emitterDistance * 34.0) * 0.42;
  graded += controls.color.rgb * emitterHalo;
  graded += mix(controls.color.rgb, vec3f(1.0), 0.82) * emitterCore * 1.8;

  if (controls.depth.z > 0.5) {
    let metricMap = 1.0 - smoothstep(0.22, 1.8, sensed);
    let mapValue = mix(luma, metricMap, hardware);
    let nearColor = vec3f(1.0, 0.46, 0.20);
    let farColor = vec3f(0.08, 0.26, 0.46);
    graded = mix(farColor, nearColor, mapValue);
    graded += vec3f(abs(dx), abs(dy), abs(dx - dy)) * 2.4;
  }

  return vec4f(clamp(graded, vec3f(0.0), vec3f(1.0)), 1.0);
}
`;

export function createDepthLightGpu(
  device: GPUDevice,
  context: GPUCanvasContext & { present?: () => void },
): DepthLightGpu {
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ alphaMode: 'opaque', device, format });

  // TypeGPU owns the strongly typed control buffer. Its underlying WebGPU
  // buffer is shared with VisionCamera's worklet for the per-frame write.
  const root = tgpu.initFromDevice({ device });
  const uniform = root.createUniform(LightUniforms, {
    light: d.vec4f(0.3, 0.38, 0.34, 1),
    color: d.vec4f(1, 0.66, 0.34, 0),
    viewport: d.vec4f(1, 1, 1, 1),
    depth: d.vec4f(0, 0, 0, 0),
    yuv0: d.vec4f(1, 0, 0, 0),
    yuv1: d.vec4f(0, 1, 0, 0),
    yuv2: d.vec4f(0, 0, 1, 0),
  });
  // `uniform.buffer` is still TypeGPU's TgpuBufferImpl wrapper. Worklet
  // runtimes cannot serialize that JavaScript class, so only expose the raw
  // WebGPU HostObject across the VisionCamera runtime boundary.
  const uniformBuffer = root.unwrap(uniform);
  const depthTexture = device.createTexture({
    format: 'r32float',
    label: 'depth-light-map',
    size: { height: DEPTH_HEIGHT, width: DEPTH_WIDTH },
    usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
  });
  const depthView = depthTexture.createView();
  const sampler = device.createSampler({
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
    magFilter: 'linear',
    minFilter: 'linear',
  });
  const module = device.createShaderModule({ code: shader, label: 'depth-light-shader' });
  const pipeline = device.createRenderPipeline({
    label: 'depth-light-pipeline',
    layout: 'auto',
    vertex: { entryPoint: 'vertexMain', module },
    fragment: { entryPoint: 'fragmentMain', module, targets: [{ format }] },
    primitive: { topology: 'triangle-list' },
  });

  return {
    context,
    depthTexture,
    depthView,
    device,
    pipeline,
    sampler,
    uniformBuffer,
    destroy: () => {
      depthTexture.destroy();
      root.destroy();
    },
  };
}

export const depthTextureSize = { height: DEPTH_HEIGHT, width: DEPTH_WIDTH } as const;
export const depthTargetResolution = { height: 480, width: 640 } as const;
