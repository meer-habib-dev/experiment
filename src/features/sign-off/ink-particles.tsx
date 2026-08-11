import {
  Atlas,
  BlurMask,
  Circle,
  useColorBuffer,
  useRectBuffer,
  useRSXformBuffer,
  useTexture,
} from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';

import {
  eraserEffects,
  SPRITE_SIZE,
  type ParticleField,
} from '@/features/sign-off/eraser-effects';
import { MAX_PARTICLES, PARTICLE_STRIDE } from '@/features/sign-off/ink-sampler';

const HALF = SPRITE_SIZE / 2;

type InkParticlesProps = {
  /** 1 while an erase animation is running, 0 otherwise. */
  active: SharedValue<number>;
  count: SharedValue<number>;
  data: SharedValue<number[]>;
  effectIndex: SharedValue<number>;
  field: SharedValue<ParticleField>;
  inkColor: string;
  progress: SharedValue<number>;
};

/**
 * Dust layer rendered with a single Atlas draw call.
 *
 * The RSXform and color buffers are recomputed on the UI thread whenever
 * `progress` ticks; each particle's pose comes straight from the active
 * effect's closed-form kinematics, so nothing is integrated or allocated
 * per frame.
 */
export function InkParticles({
  active,
  count,
  data,
  effectIndex,
  field,
  inkColor,
  progress,
}: InkParticlesProps) {
  const texture = useTexture(
    <Circle color={inkColor} cx={HALF} cy={HALF} r={HALF - 2}>
      <BlurMask blur={1.1} style="normal" />
    </Circle>,
    { height: SPRITE_SIZE, width: SPRITE_SIZE },
  );

  const sprites = useRectBuffer(MAX_PARTICLES, (rect) => {
    'worklet';
    rect.setXYWH(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  });

  const transforms = useRSXformBuffer(MAX_PARTICLES, (xf, index) => {
    'worklet';
    if (active.value === 0 || index >= count.value) {
      xf.set(0, 0, -SPRITE_SIZE, -SPRITE_SIZE);
      return;
    }
    const effect = eraserEffects[effectIndex.value];
    if (effect.kind !== 'particles') {
      xf.set(0, 0, -SPRITE_SIZE, -SPRITE_SIZE);
      return;
    }
    const d = data.value;
    const o = index * PARTICLE_STRIDE;
    effect.place(
      xf,
      d[o],
      d[o + 1],
      d[o + 2],
      d[o + 3],
      d[o + 4],
      d[o + 5],
      d[o + 6],
      d[o + 7],
      progress.value,
      field.value,
    );
  });

  const colors = useColorBuffer(MAX_PARTICLES, (color, index) => {
    'worklet';
    let alpha = 0;
    if (active.value === 1 && index < count.value) {
      const effect = eraserEffects[effectIndex.value];
      if (effect.kind === 'particles') {
        const d = data.value;
        const o = index * PARTICLE_STRIDE;
        alpha = effect.fade(
          d[o],
          d[o + 1],
          d[o + 2],
          d[o + 4],
          d[o + 5],
          d[o + 6],
          d[o + 7],
          progress.value,
          field.value,
        );
      }
    }
    color[0] = 1;
    color[1] = 1;
    color[2] = 1;
    color[3] = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
  });

  return (
    <Atlas
      colorBlendMode="modulate"
      colors={colors}
      image={texture}
      sprites={sprites}
      transforms={transforms}
    />
  );
}
