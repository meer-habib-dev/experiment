import { Skia, type SkPath } from '@shopify/react-native-skia';

export type StrokeRecord = {
  /** Arc length, measured once when the stroke is committed. */
  length: number;
  path: SkPath;
};

/** Packed particle layout: [ox, oy, u, size, s0, s1, s2, s3] per particle. */
export const PARTICLE_STRIDE = 8;
export const MAX_PARTICLES = 2000;

export type InkSample = {
  count: number;
  /** Ink centroid, used as the focal point for radial effects. */
  cx: number;
  cy: number;
  data: number[];
};

export function measurePathLength(path: SkPath) {
  const iterator = Skia.ContourMeasureIter(path, false, 1);
  let total = 0;
  let contour = iterator.next();
  while (contour) {
    total += contour.length();
    contour = iterator.next();
  }
  return total;
}

/**
 * Walks every stroke at a uniform arc-length step and emits one dust
 * particle per sample. `u` is the normalized position in draw order, which
 * lets effects consume the signature in the order it was written.
 */
export function sampleInkParticles(strokes: StrokeRecord[]): InkSample | null {
  const totalLength = strokes.reduce((sum, stroke) => sum + stroke.length, 0);
  if (totalLength < 1) {
    return null;
  }
  const step = Math.max(1.2, totalLength / MAX_PARTICLES);
  const data: number[] = [];
  let count = 0;
  let traveled = 0;
  let sumX = 0;
  let sumY = 0;

  for (const stroke of strokes) {
    const iterator = Skia.ContourMeasureIter(stroke.path, false, 1);
    let contour = iterator.next();
    while (contour) {
      const contourLength = contour.length();
      for (let distance = 0; distance <= contourLength; distance += step) {
        if (count >= MAX_PARTICLES) {
          break;
        }
        const [position] = contour.getPosTan(distance);
        data.push(
          position.x,
          position.y,
          (traveled + distance) / totalLength,
          0.3 + 0.4 * Math.random(),
          Math.random(),
          Math.random(),
          Math.random(),
          Math.random(),
        );
        sumX += position.x;
        sumY += position.y;
        count += 1;
      }
      traveled += contourLength;
      contour = iterator.next();
    }
  }

  if (count === 0) {
    return null;
  }
  return { count, cx: sumX / count, cy: sumY / count, data };
}
