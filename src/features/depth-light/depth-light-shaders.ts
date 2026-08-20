/**
 * WGSL for the depth-light experiment, kept free of native imports so the
 * shaders can be compiled and validated by any WebGPU implementation.
 */

// The raw sensor upload target. TrueDepth streams 640x480 (or smaller) in the
// sensor's landscape orientation; a square texture holds any orientation
// without reallocating when the device rotates.
const RAW_DEPTH = { height: 640, width: 640 } as const;

// The resolved depth target lives in *colour-frame display space*: already
// rotated, unmirrored, FOV-matched to the camera image and smoothed. The
// lighting pass therefore samples it at the same UV as the camera texture and
// needs no reprojection of its own. 9:16 to match the colour stream.
const RESOLVED_DEPTH = { height: 512, width: 288 } as const;

/** Metric depth outside this band is treated as a dropout and inpainted. */
const DEPTH_NEAR = 0.12;
const DEPTH_FAR = 4.5;

/**
 * Shared prelude: the control block, the fullscreen triangle, and the two
 * orientation helpers. Camera and depth buffers arrive in the sensor's native
 * orientation with a mirror flag, so display UV has to be pushed back through
 * the inverse transform before sampling either one.
 */
const prelude = /* wgsl */ `
struct Controls {
  light: vec4f,
  color: vec4f,
  viewport: vec4f,
  camera: vec4f,
  depthInfo: vec4f,
  depthSize: vec4f,
  flags: vec4f,
}

@group(0) @binding(0) var<uniform> controls: Controls;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vertexMain(@builtin(vertex_index) index: u32) -> VertexOut {
  var positions = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var uvs = array<vec2f, 3>(vec2f(0.0, 1.0), vec2f(2.0, 1.0), vec2f(0.0, -1.0));
  var output: VertexOut;
  output.position = vec4f(positions[index], 0.0, 1.0);
  output.uv = uvs[index];
  return output;
}

fn unrotate(uv: vec2f, rotation: f32, mirrored: f32) -> vec2f {
  var result = uv;
  if (mirrored > 0.5) { result.x = 1.0 - result.x; }
  if (rotation >= 0.5 && rotation < 1.5) { result = vec2f(1.0 - result.y, result.x); }
  if (rotation >= 1.5 && rotation < 2.5) { result = vec2f(1.0 - result.x, 1.0 - result.y); }
  if (rotation >= 2.5) { result = vec2f(result.y, 1.0 - result.x); }
  return result;
}
`;

/**
 * Pass 1 - resolve.
 *
 * Rewrites the raw sensor depth into colour-frame display space and cleans it
 * up. Three things happen here that the lighting pass then gets for free:
 *
 *  - Orientation. The rotation/mirror transform is applied once, per resolved
 *    texel, instead of once per lighting sample.
 *  - Field of view. The 16:9 video stream is a centre crop of the 4:3 depth
 *    sensor, so the two cover different angular extents. Matching them is what
 *    keeps the light anchored to the subject instead of sliding off it.
 *  - Dropouts and noise. TrueDepth leaves NaN/zero holes at silhouette edges
 *    and on dark hair. A bilateral kernel inpaints them from valid neighbours
 *    while keeping real depth discontinuities sharp.
 *
 * Output is rg16float: r = metric depth, g = confidence. rg16float is
 * filterable, so the lighting pass can sample it linearly - r32float cannot be
 * without the optional `float32-filterable` feature.
 */
export const depthShader = /* wgsl */ `
${prelude}

@group(0) @binding(1) var rawDepth: texture_2d<f32>;

fn validDepth(value: f32) -> bool {
  // NaN fails every comparison, so the self-equality test rejects it.
  return value == value && value > ${DEPTH_NEAR} && value < ${DEPTH_FAR};
}

/**
 * One raw sample, always returned in metres.
 *
 * TrueDepth frequently streams *disparity* (roughly 1/metres) rather than
 * depth, and the conversion to a depth format is not offered on every device.
 * Reading disparity as metres inverts the scene - a face at 0.4 m reads as
 * 2.5 m and a wall at 3 m reads as 0.33 m - so the reciprocal is taken here,
 * before anything else looks at the value.
 */
fn loadRaw(uv: vec2f) -> f32 {
  let dimensions = vec2f(textureDimensions(rawDepth));
  let coordinate = vec2i(clamp(uv, vec2f(0.0), vec2f(0.9999)) * dimensions);
  let raw = textureLoad(rawDepth, coordinate, 0).r;
  if (controls.flags.x > 0.5) {
    // A NaN or zero dropout fails this test and falls through as 0, which
    // validDepth then rejects.
    if (!(raw > 0.0001)) { return 0.0; }
    return 1.0 / raw;
  }
  return raw;
}

/**
 * Colour-frame display UV -> depth-frame display UV.
 *
 * Both streams share a lens and a centre, so the narrower field of view is a
 * centred crop of the wider one. Comparing display aspect ratios says which
 * axis is cropped and by how much.
 */
fn colorUvToDepthUv(uv: vec2f) -> vec2f {
  let colorAspect = controls.viewport.z / max(controls.viewport.w, 1.0);
  let depthAspect = controls.depthSize.z / max(controls.depthSize.w, 1.0);
  var result = uv;
  if (colorAspect < depthAspect) {
    // Colour is narrower: it is a horizontal crop of the depth field.
    result.x = 0.5 + (uv.x - 0.5) * (colorAspect / depthAspect);
  } else {
    result.y = 0.5 + (uv.y - 0.5) * (depthAspect / colorAspect);
  }
  return result;
}

/** Depth-frame display UV -> raw sensor texture UV. */
fn depthUvToRawUv(uv: vec2f) -> vec2f {
  let sensor = unrotate(uv, controls.depthInfo.y, controls.depthInfo.w);
  return sensor * controls.depthSize.xy;
}

@fragment
fn fragmentMain(input: VertexOut) -> @location(0) vec2f {
  let rawUv = depthUvToRawUv(colorUvToDepthUv(input.uv));
  // One raw sensor texel, in raw-texture UV. The sample point is already scaled
  // into the valid region, so the kernel step must not be scaled by it again.
  let texel = vec2f(1.0) / vec2f(textureDimensions(rawDepth));

  let center = loadRaw(rawUv);
  let centerValid = validDepth(center);
  // Anchor the bilateral range term on the centre sample when it is usable,
  // otherwise let the first valid neighbour seed it so holes still fill.
  var reference = center;
  if (!centerValid) {
    reference = 0.0;
    var found = false;
    for (var y = -2; y <= 2 && !found; y += 1) {
      for (var x = -2; x <= 2 && !found; x += 1) {
        let probe = loadRaw(rawUv + vec2f(f32(x), f32(y)) * texel);
        if (validDepth(probe)) {
          reference = probe;
          found = true;
        }
      }
    }
    if (!found) { return vec2f(0.0, 0.0); }
  }

  var total = 0.0;
  var weightSum = 0.0;
  var validCount = 0.0;
  for (var y = -2; y <= 2; y += 1) {
    for (var x = -2; x <= 2; x += 1) {
      let offset = vec2f(f32(x), f32(y));
      let probe = loadRaw(rawUv + offset * texel);
      if (!validDepth(probe)) { continue; }
      validCount += 1.0;
      // Spatial term: a Gaussian over the 5x5 footprint.
      let spatial = exp(-dot(offset, offset) * 0.35);
      // Range term: 4 cm sigma keeps silhouettes from bleeding into the
      // background while still smoothing sensor noise across a flat surface.
      let delta = (probe - reference) / 0.04;
      let range = exp(-delta * delta * 0.5);
      let weight = spatial * range;
      total += probe * weight;
      weightSum += weight;
    }
  }

  if (weightSum <= 0.0) { return vec2f(reference, 0.15); }
  // Confidence blends how many neighbours agreed with whether the centre texel
  // was a real reading; the lighting pass fades its contribution accordingly.
  let confidence = clamp(validCount / 25.0, 0.0, 1.0) * select(0.45, 1.0, centerValid);
  return vec2f(total / weightSum, confidence);
}
`;

/**
 * Pass 2 - light.
 *
 * A single point light placed in view space. Depth reconstructs a position for
 * every pixel, cross products of those positions give normals, and a
 * screen-space march along the light ray gives contact shadows. The emitter
 * itself is depth-tested, so anything nearer than the light hides it.
 */
export const lightShader = /* wgsl */ `
${prelude}

@group(0) @binding(1) var linearSampler: sampler;
@group(0) @binding(2) var cameraFrame: texture_2d<f32>;
@group(0) @binding(3) var resolvedDepth: texture_2d<f32>;

/** Screen UV -> colour frame UV, honouring the preview's aspect-fill crop. */
fn coverUv(uv: vec2f) -> vec2f {
  let viewAspect = controls.viewport.x / max(controls.viewport.y, 1.0);
  let sourceAspect = controls.viewport.z / max(controls.viewport.w, 1.0);
  var result = uv;
  if (sourceAspect > viewAspect) {
    result.x = (uv.x - 0.5) * (viewAspect / sourceAspect) + 0.5;
  } else {
    result.y = (uv.y - 0.5) * (sourceAspect / viewAspect) + 0.5;
  }
  return result;
}

fn sampleCamera(uv: vec2f) -> vec3f {
  let sensorUv = unrotate(clamp(uv, vec2f(0.0), vec2f(1.0)), controls.camera.x, controls.camera.y);
  return textureSampleLevel(cameraFrame, linearSampler, sensorUv, 0.0).rgb;
}

fn luminance(value: vec3f) -> f32 {
  return dot(value, vec3f(0.2126, 0.7152, 0.0722));
}

/**
 * Metric depth at a colour-frame UV.
 *
 * Without a depth sensor the experiment stays interactive by treating image
 * luminance as a crude proxy for proximity - bright regions read as nearer.
 * It is not geometry, but it keeps the light responsive to the subject.
 */
fn depthAt(uv: vec2f) -> vec2f {
  if (controls.depthInfo.x < 0.5) {
    let proxy = 1.55 - luminance(sampleCamera(uv)) * 0.85;
    return vec2f(proxy, 1.0);
  }
  let sample = textureSampleLevel(resolvedDepth, linearSampler, clamp(uv, vec2f(0.0), vec2f(1.0)), 0.0).rg;
  if (sample.y <= 0.0) { return vec2f(${DEPTH_FAR}, 0.0); }
  return sample;
}

/** Half-extent of the view frustum at unit distance, in display orientation. */
fn tanHalf() -> vec2f {
  let vertical = controls.camera.z;
  let aspect = controls.viewport.z / max(controls.viewport.w, 1.0);
  return vec2f(vertical * aspect, vertical);
}

/** Colour-frame UV + metric depth -> view space position (metres, +z forward). */
fn viewPosition(uv: vec2f, z: f32) -> vec3f {
  let half = tanHalf();
  let ndc = vec2f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0);
  return vec3f(ndc.x * half.x * z, ndc.y * half.y * z, z);
}

/** View space position -> colour-frame UV. */
fn projectUv(position: vec3f) -> vec2f {
  let half = tanHalf();
  let z = max(position.z, 0.001);
  let ndc = vec2f(position.x / (half.x * z), position.y / (half.y * z));
  return vec2f(ndc.x * 0.5 + 0.5, 0.5 - ndc.y * 0.5);
}

/**
 * Surface normal from reconstructed positions.
 *
 * Differencing metric depth directly makes every silhouette read as a wall
 * facing the camera edge-on. Differencing *positions* keeps the units
 * consistent, and picking the shorter of the forward/backward difference on
 * each axis stops a normal from straddling a depth discontinuity - the two
 * together are what remove the mosaic on hair and shoulders.
 */
struct Surface {
  normal: vec3f,
  /** 0 on a real surface, 1 where the sample straddles a depth discontinuity. */
  edge: f32,
}

fn surfaceNormal(uv: vec2f, center: f32) -> Surface {
  let step = vec2f(1.5 / ${RESOLVED_DEPTH.width}.0, 1.5 / ${RESOLVED_DEPTH.height}.0);
  let position = viewPosition(uv, center);

  let right = depthAt(uv + vec2f(step.x, 0.0)).r;
  let left = depthAt(uv - vec2f(step.x, 0.0)).r;
  let down = depthAt(uv + vec2f(0.0, step.y)).r;
  let up = depthAt(uv - vec2f(0.0, step.y)).r;

  let dxForward = viewPosition(uv + vec2f(step.x, 0.0), right) - position;
  let dxBackward = position - viewPosition(uv - vec2f(step.x, 0.0), left);
  let dyForward = viewPosition(uv + vec2f(0.0, step.y), down) - position;
  let dyBackward = position - viewPosition(uv - vec2f(0.0, step.y), up);

  // Weight each side by how well it agrees with the centre depth, rather than
  // hard-selecting the closer one. A hard select flips on the depth texel grid
  // and reintroduces exactly the blocky mosaic this reconstruction exists to
  // avoid; the reciprocal weights stay continuous while still collapsing onto
  // the near side at a silhouette, where the far side's delta is enormous.
  let weightRight = 1.0 / (abs(right - center) + 1e-4);
  let weightLeft = 1.0 / (abs(center - left) + 1e-4);
  let weightDown = 1.0 / (abs(down - center) + 1e-4);
  let weightUp = 1.0 / (abs(center - up) + 1e-4);
  let ddx = (dxForward * weightRight + dxBackward * weightLeft) / (weightRight + weightLeft);
  let ddy = (dyForward * weightDown + dyBackward * weightUp) / (weightDown + weightUp);

  // Normalise before crossing. One sample step spans about a millimetre of
  // view space at arm's length, so the raw cross product lands near 1e-6 and
  // any absolute epsilon on its length would reject real, flat surfaces.
  // Crossing unit vectors makes the degeneracy test scale-free.
  let lengthX = length(ddx);
  let lengthY = length(ddy);
  if (lengthX < 1e-9 || lengthY < 1e-9) { return Surface(vec3f(0.0, 0.0, -1.0), 1.0); }
  // ddx points +x in view space, ddy points -y (UV runs downward), so
  // cross(ddx, ddy) is the outward normal: -z for a surface facing the lens.
  let normal = cross(ddx / lengthX, ddy / lengthY);
  let normalLength = length(normal);
  if (normalLength < 1e-4) { return Surface(vec3f(0.0, 0.0, -1.0), 1.0); }
  let unit = normal / normalLength;

  // A silhouette is not a surface. Where the depth step across one sample is
  // far larger than the lateral world step it spans, the pixel straddles a
  // discontinuity rather than a steep slope, and the normal it produces points
  // sideways - drawing a hard dark rim around every subject. Comparing the two
  // as a ratio keeps the test independent of distance and map resolution.
  let lateral = 2.0 * tanHalf().y * center * (1.5 / ${RESOLVED_DEPTH.height}.0);
  let stepZ = max(abs(right - center), abs(down - center));
  let edge = smoothstep(6.0, 16.0, stepZ / max(lateral, 1e-5));
  return Surface(normalize(mix(unit, vec3f(0.0, 0.0, -1.0), edge)), edge);
}

/**
 * Contact shadow: march the segment from the surface to the light and count
 * how much of it passes behind recorded geometry. The thickness bound stops
 * background from shadowing the whole frame, since a depth map only knows the
 * front surface of anything it sees.
 */
fn shadowFactor(surface: vec3f, lightPosition: vec3f, jitter: f32) -> f32 {
  if (controls.depthInfo.x < 0.5) { return 1.0; }
  let steps = 14;
  let thickness = 0.35;
  var occlusion = 0.0;
  for (var i = 0; i < steps; i += 1) {
    let t = (f32(i) + jitter) / f32(steps);
    // Bias away from the surface so a pixel never shadows itself.
    let point = mix(surface, lightPosition, 0.06 + t * 0.94);
    let uv = projectUv(point);
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { continue; }
    let scene = depthAt(uv);
    if (scene.y <= 0.0) { continue; }
    let difference = point.z - scene.r;
    if (difference > 0.02 && difference < thickness) {
      occlusion += (1.0 - t) * scene.y;
    }
  }
  return clamp(1.0 - occlusion / 3.5, 0.0, 1.0);
}

fn tonemap(value: vec3f) -> vec3f {
  // Narkowicz ACES fit - keeps the core of the emitter from clipping to a flat
  // white disc and rolls the highlights off the way the reference does.
  let x = max(value, vec3f(0.0));
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), vec3f(0.0), vec3f(1.0));
}

@fragment
fn fragmentMain(input: VertexOut) -> @location(0) vec4f {
  let uv = coverUv(input.uv);
  let source = sampleCamera(uv);
  let depth = depthAt(uv);
  let lightUv = coverUv(controls.light.xy);
  let lightZ = controls.light.z;

  if (controls.depthInfo.z > 0.5) {
    // Depth inspector: near reads warm, far reads cool, dropouts read black.
    let normalised = 1.0 - clamp((depth.r - 0.2) / 1.6, 0.0, 1.0);
    let ramp = mix(vec3f(0.05, 0.13, 0.26), vec3f(1.0, 0.62, 0.28), normalised);
    return vec4f(ramp * mix(0.2, 1.0, depth.y), 1.0);
  }

  let position = viewPosition(uv, depth.r);
  let surface = surfaceNormal(uv, depth.r);
  let normal = surface.normal;
  let lightPosition = viewPosition(lightUv, lightZ);

  let toLight = lightPosition - position;
  let distance = length(toLight);
  let direction = toLight / max(distance, 0.0001);

  // Inverse-square falloff, softened near the source so dragging the light
  // onto a surface does not blow out a single texel.
  let radius = controls.color.w;
  let falloff = 1.0 / (1.0 + (distance / radius) * (distance / radius));
  // Interleaved gradient noise breaks up the shadow march's banding.
  let jitter = fract(52.9829189 * fract(dot(input.position.xy, vec2f(0.06711056, 0.00583715))));
  let shadow = shadowFactor(position, lightPosition, jitter);

  let diffuse = max(dot(normal, direction), 0.0);
  let viewDirection = normalize(-position);
  let halfVector = normalize(direction + viewDirection);
  let specular = pow(max(dot(normal, halfVector), 0.0), 48.0) * 0.35;

  // Silhouette pixels sit on interpolated geometry that is not really there, so
  // they are lit at reduced strength instead of reading as a bright rim.
  let energy =
    falloff * shadow * controls.light.w * mix(0.35, 1.0, depth.y) * (1.0 - surface.edge * 0.8);
  let albedo = pow(max(source, vec3f(0.0)), vec3f(2.2));
  let ambient = controls.camera.w;

  var lit = albedo * (vec3f(ambient) + controls.color.rgb * diffuse * energy * 2.6);
  lit += controls.color.rgb * specular * energy;

  // The emitter is part of the scene: it sits at lightZ and anything in front
  // of it hides it. The faint ring survives occlusion so the drag handle never
  // disappears from under the finger.
  let viewAspect = controls.viewport.x / max(controls.viewport.y, 1.0);
  let toEmitter = (input.uv - controls.light.xy) * vec2f(viewAspect, 1.0);
  let emitterDistance = length(toEmitter);
  let occluderDepth = depthAt(lightUv);
  let unoccluded = select(
    1.0,
    smoothstep(-0.03, 0.05, occluderDepth.r - lightZ),
    controls.depthInfo.x > 0.5 && occluderDepth.y > 0.0
  );
  let core = (1.0 - smoothstep(0.008, 0.016, emitterDistance)) * unoccluded;
  let halo = exp(-emitterDistance * 26.0) * 0.55 * unoccluded;
  let ring = (1.0 - smoothstep(0.017, 0.021, emitterDistance)) * smoothstep(0.013, 0.017, emitterDistance);

  lit += controls.color.rgb * halo * controls.light.w;
  lit += mix(controls.color.rgb, vec3f(1.0), 0.85) * core * 5.0;
  lit += vec3f(0.55) * ring;

  return vec4f(pow(tonemap(lit), vec3f(1.0 / 2.2)), 1.0);
}
`;


export const rawDepthSize = RAW_DEPTH;
export const resolvedDepthSize = RESOLVED_DEPTH;
