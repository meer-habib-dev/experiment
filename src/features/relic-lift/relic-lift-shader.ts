import { Skia } from '@shopify/react-native-skia';

const previewSource = `
uniform shader src;
uniform float2 resolution;
uniform float time;
uniform float lock;
uniform float zoom;

float roundedBox(float2 p, float2 halfSize, float radius) {
  float2 q = abs(p) - halfSize + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

half4 main(float2 xy) {
  float2 safeResolution = max(resolution, float2(1.0));
  float2 uv = xy / safeResolution;
  float2 samplePoint = (xy - safeResolution * 0.5) / max(zoom, 1.0) + safeResolution * 0.5;
  half4 source = src.eval(samplePoint);

  float luminance = dot(source.rgb, half3(0.2126, 0.7152, 0.0722));
  half3 cinematic = mix(source.rgb, half3(luminance), 0.08);
  cinematic *= half3(0.97, 1.015, 1.02);

  float2 centered = xy - safeResolution * 0.5;
  float targetDistance = roundedBox(
    centered,
    float2(safeResolution.x * 0.285, safeResolution.y * 0.205),
    safeResolution.x * 0.08
  );
  float target = 1.0 - smoothstep(-2.0, 2.0, targetDistance);

  float scanPosition = fract(time * mix(0.22, 0.78, lock));
  float scan = exp(-pow((uv.y - scanPosition) * 54.0, 2.0));
  scan *= target;

  float vignette = smoothstep(0.82, 0.22, length(uv - 0.5));
  cinematic *= mix(0.78, 1.04, vignette);
  cinematic = mix(cinematic, cinematic * half3(0.48, 0.55, 0.56), lock * (1.0 - target) * 0.62);
  cinematic += half3(0.20, 0.91, 0.78) * scan * (0.12 + lock * 0.25);

  float edge = 1.0 - smoothstep(0.0, 7.0, abs(targetDistance));
  cinematic += half3(0.43, 1.0, 0.86) * edge * lock * 0.34;

  return half4(cinematic, source.a);
}
`;

const compiledPreviewEffect = Skia.RuntimeEffect.Make(previewSource);

if (compiledPreviewEffect == null) {
  throw new Error('Could not compile the Relic Lift preview shader.');
}

export const relicPreviewEffect = compiledPreviewEffect;
export const relicPreviewPaint = Skia.Paint();
