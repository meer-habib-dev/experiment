import { Skia } from '@shopify/react-native-skia';

const metalStickerSource = `
uniform float2 size;
uniform float time;
uniform float lift;
uniform float flash;
uniform float2 tilt;
uniform float3 darkColor;
uniform float3 midColor;
uniform float3 lightColor;

half4 main(float2 xy) {
  float2 safeSize = max(size, float2(1.0));
  float2 uv = xy / safeSize;
  float2 centered = uv - 0.5;

  float diagonal = uv.x * 0.84 + uv.y * 0.42;
  float movingBandCenter = fract(time * 0.065 + tilt.x * 0.0018 + 0.16);
  float bandDistance = abs(fract(diagonal - movingBandCenter + 0.5) - 0.5);
  float specular = exp(-pow(bandDistance * 13.0, 2.0));

  float brushed = sin((uv.y * 112.0 + uv.x * 9.0) + sin(uv.x * 18.0) * 1.7);
  brushed = brushed * 0.5 + 0.5;

  float broadLight = smoothstep(-0.62, 0.58, -centered.x + centered.y * 0.42);
  broadLight += tilt.y * 0.002;
  broadLight = clamp(broadLight, 0.0, 1.0);

  float rainbowPhase = diagonal * 8.0 - time * 0.7 + tilt.x * 0.014;
  float3 rainbow = float3(
    0.5 + 0.5 * cos(rainbowPhase),
    0.5 + 0.5 * cos(rainbowPhase + 2.094),
    0.5 + 0.5 * cos(rainbowPhase + 4.188)
  );

  float3 metal = mix(darkColor, midColor, broadLight);
  metal = mix(metal, lightColor, specular * (0.50 + lift * 0.34));
  metal += (brushed - 0.5) * 0.055;
  metal = mix(metal, rainbow, (0.035 + lift * 0.14) * specular);

  float rim = smoothstep(0.72, 0.18, length(centered));
  metal *= 0.92 + rim * 0.12;
  metal += lightColor * flash * specular * 0.48;

  return half4(clamp(metal, 0.0, 1.0), 1.0);
}
`;

const compiledMetalStickerEffect =
  process.env.EXPO_OS === 'web' ? null : Skia.RuntimeEffect.Make(metalStickerSource);

export const metalStickerEffect = compiledMetalStickerEffect;
