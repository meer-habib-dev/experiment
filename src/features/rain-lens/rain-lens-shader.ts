import { Skia } from '@shopify/react-native-skia';

const source = `
uniform shader src;
uniform float2 resolution;
uniform float time;
uniform float wetness;
uniform float zoom;
uniform float haze;

float hash(float n) {
  return fract(sin(n * 127.1 + 311.7) * 43758.5453123);
}

float2 capsuleDelta(float2 p, float2 a, float2 b) {
  float2 ab = b - a;
  float h = clamp(dot(p - a, ab) / max(dot(ab, ab), 0.0001), 0.0, 1.0);
  return p - (a + ab * h);
}

half4 main(float2 xy) {
  float2 safeResolution = max(resolution, float2(1.0));
  float2 imageCenter = safeResolution * 0.5;
  float2 p = (xy - imageCenter) / max(zoom, 1.0) + imageCenter;
  float pixelScale = safeResolution.x / 390.0;
  float activeCount = 6.0 + wetness * 19.0;
  float beadDensity = 0.0;
  float filmDensity = 0.0;
  float2 normalSum = float2(0.0);
  float radiusSum = 0.0;

  // Small drops cling to glass. They are deliberately sparse and nearly
  // stationary; a wet window should not look like a field of moving bubbles.
  float microCell = 20.0 * pixelScale;
  float2 microGrid = floor(p / microCell);
  float2 microLocal = p - microGrid * microCell;
  float microSeed = hash(dot(microGrid, float2(27.17, 91.43)) + 13.7);
  float microSeedB = hash(dot(microGrid, float2(63.91, 17.13)) + 4.2);
  float microSeedC = hash(dot(microGrid, float2(11.71, 47.77)) + 8.9);
  float microPresence = step(1.0 - wetness * 0.44, microSeed) * step(0.015, wetness);
  float microLife = fract(time / (34.0 + microSeedC * 28.0) + microSeedB);
  float microForm = smoothstep(0.0, 0.075, microLife) * (1.0 - smoothstep(0.94, 1.0, microLife));
  float2 microCenter = microCell * float2(0.18 + microSeedB * 0.64, 0.18 + microSeedC * 0.64);
  float microRadius = (0.75 + pow(microSeedC, 1.9) * 2.15) * pixelScale;
  float2 microDelta = microLocal - microCenter;
  microDelta.x *= mix(0.92, 1.1, microSeedB);
  microDelta.y *= mix(0.9, 1.08, microSeedC);
  float microDistance = length(microDelta);
  float microInfluence = 1.0 - smoothstep(microRadius * 0.32, microRadius * 1.08, microDistance);
  microInfluence *= microPresence * microForm;
  beadDensity += microInfluence;
  normalSum += microDelta / max(microDistance, 0.001) * microInfluence;
  radiusSum += microRadius * microInfluence;

  // Larger beads release at different times. Heavy drops accelerate down the
  // lens while smaller ones stay pinned, leaving short tapered wet tracks.
  for (int i = 0; i < 25; i++) {
    float fi = float(i);
    float active = step(fi, activeCount - 0.5) * step(0.015, wetness);
    float seedX = hash(fi * 3.17 + 1.3);
    float seedY = hash(fi * 5.23 + 8.1);
    float seedSize = hash(fi * 7.91 + 4.7);
    float seedPhase = hash(fi * 11.73 + 2.9);
    float radius = (2.0 + pow(seedSize, 1.75) * 7.4) * pixelScale;
    float moving = step(0.43, seedSize);
    float lifetime = mix(26.0, 7.5, seedSize);
    float life = fract(time / lifetime + seedPhase);
    float form = smoothstep(0.0, 0.06, life) * (1.0 - smoothstep(0.94, 1.0, life));
    float gravity = life * life * safeResolution.y * (0.13 + seedSize * seedSize * 0.92);
    float y = seedY * safeResolution.y + moving * gravity;
    y = mod(y + radius * 2.0, safeResolution.y + radius * 4.0) - radius * 2.0;
    float drift = sin(time * (0.13 + seedSize * 0.11) + seedPhase * 6.2831) * radius * moving * 0.22;
    float x = seedX * safeResolution.x + drift;
    float2 center = float2(x, y);
    float2 delta = p - center;
    delta.y *= mix(1.0, 0.82, moving * seedSize);
    float distanceToDrop = length(delta);
    float influence = (1.0 - smoothstep(radius * 0.34, radius * 1.08, distanceToDrop)) * active * form;

    beadDensity += influence;
    normalSum += delta / max(distanceToDrop, 0.001) * influence;
    radiusSum += radius * influence;

    float trailLength = moving * radius * (0.8 + life * 3.8);
    float2 trailEnd = center - float2(drift * 0.16, trailLength);
    float2 trailVector = center - trailEnd;
    float trailPosition = clamp(
      dot(p - trailEnd, trailVector) / max(dot(trailVector, trailVector), 0.0001),
      0.0,
      1.0
    );
    float2 trailDelta = capsuleDelta(p, trailEnd, center);
    float distanceToTrail = length(trailDelta);
    float trailRadius = radius * mix(0.055, 0.24, trailPosition);
    float trail = 1.0 - smoothstep(trailRadius * 0.22, trailRadius, distanceToTrail);
    trail *= active * form * moving * smoothstep(0.09, 0.28, life) * 0.48;
    filmDensity += trail;
    normalSum += trailDelta / max(distanceToTrail, 0.001) * trail * 0.18;
    radiusSum += trailRadius * trail * 0.2;
  }

  float mask = smoothstep(0.11, 0.68, beadDensity);
  float edge = smoothstep(0.06, 0.3, beadDensity) * (1.0 - smoothstep(0.57, 0.94, beadDensity));
  float trailMask = smoothstep(0.05, 0.4, filmDensity);
  float2 normal = normalize(normalSum + float2(0.0001, -0.0001));
  float combinedDensity = beadDensity + filmDensity * 0.18;
  float averageRadius = radiusSum / max(combinedDensity, 0.001);
  float lensWeight = mask * 0.96 + trailMask * 0.14;
  float bend = min(averageRadius * 0.5, 12.0 * pixelScale) * lensWeight * wetness;
  float2 refracted = clamp(p - normal * bend, float2(0.0), safeResolution - float2(1.0));

  half3 raw = src.eval(p).rgb;
  float fogRadius = (1.8 + haze * 7.0) * pixelScale;
  float2 fogOffset = float2(fogRadius, fogRadius * 0.42);
  half3 softA = src.eval(clamp(p + fogOffset, float2(0.0), safeResolution - float2(1.0))).rgb;
  half3 softB = src.eval(clamp(p - fogOffset, float2(0.0), safeResolution - float2(1.0))).rgb;
  half3 softened = (raw * half(2.0) + softA + softB) / half(4.0);
  half3 refractedCenter = src.eval(refracted).rgb;
  half3 refractedA = src.eval(clamp(refracted + normal * pixelScale * 0.85, float2(0.0), safeResolution - float2(1.0))).rgb;
  half3 refractedB = src.eval(clamp(refracted - normal * pixelScale * 0.65, float2(0.0), safeResolution - float2(1.0))).rgb;
  half3 lens = half3(refractedB.r, refractedCenter.g, refractedA.b);
  lens = mix(lens, (refractedCenter + refractedA + refractedB) / 3.0, half(0.18 + wetness * 0.08));
  lens = clamp((lens - 0.5) * half(1.09) + 0.5, half3(0.0), half3(1.0));

  half luminance = dot(softened, half3(0.2126, 0.7152, 0.0722));
  float mistBand = 0.5 + 0.5 * sin(
    p.y / max(118.0 * pixelScale, 1.0) +
    sin(p.x / max(164.0 * pixelScale, 1.0) + time * 0.035) * 0.72
  );
  float2 centered = (xy - imageCenter) / max(imageCenter, float2(1.0));
  float edgeMist = smoothstep(0.38, 1.16, length(centered));
  float fogAmount = clamp(haze * (0.7 + mistBand * 0.25 + edgeMist * 0.18), 0.0, 0.42);
  half3 fogTint = half3(0.78, 0.84, 0.88) + half3(luminance * half(0.08));
  half3 graded = mix(softened, half3(luminance), half(wetness * 0.16 + haze * 0.18));
  graded = mix(graded, fogTint, half(fogAmount));
  graded = (graded - 0.5) * half(1.0 - wetness * 0.045 - haze * 0.1) + 0.5;
  graded *= half3(1.0 - wetness * 0.018, 1.0, 1.0 + wetness * 0.04 + haze * 0.045);

  float2 lightDirection = normalize(float2(-0.72, -0.69));
  float highlight = pow(max(dot(normal, lightDirection), 0.0), 11.0) * edge;
  float lowerShadow = pow(max(dot(normal, -lightDirection), 0.0), 4.2) * edge;
  float caustic = pow(max(dot(normal, normalize(float2(0.42, 0.91))), 0.0), 9.0) * edge;

  half3 color = mix(graded, lens, half(lensWeight));
  color += half3(0.82, 0.94, 1.0) * half(edge * 0.2 + highlight * 0.38 + caustic * 0.13);
  color -= half3(0.17, 0.2, 0.22) * half(lowerShadow * 0.58 + edge * 0.06);
  color = mix(color, color * half3(0.92, 0.98, 1.02), half(trailMask * 0.16));
  half bloom = max(luminance - half(0.58), half(0.0)) * half(haze * 0.12);
  color += fogTint * bloom;
  float vignette = smoothstep(0.52, 1.2, length(centered));
  color *= half(1.0 - vignette * (0.055 + haze * 0.1));

  return half4(clamp(color, half3(0.0), half3(1.0)), 1.0);
}
`;

const compiledEffect = Skia.RuntimeEffect.Make(source);

if (compiledEffect == null) {
  throw new Error('Rain Lens shader failed to compile.');
}

export const rainLensEffect = compiledEffect;
export const rainLensPaint = Skia.Paint();
