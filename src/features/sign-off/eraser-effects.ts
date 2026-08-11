import type { SkRSXform } from '@shopify/react-native-skia';
import type { SFSymbol } from 'sf-symbols-typescript';

/**
 * Every eraser effect is a deterministic function of one progress value.
 *
 * A particle never integrates state frame-to-frame: its position and alpha
 * are closed-form functions of (origin, seeds, t). That keeps the whole
 * simulation scrub-safe, allocation-free, and runnable per-frame on the UI
 * thread inside the Atlas buffer mappers.
 */

export type ParticleField = {
  /** Centroid of the sampled ink, in canvas coordinates. */
  cx: number;
  cy: number;
  h: number;
  w: number;
};

type PlaceFn = (
  xf: SkRSXform,
  ox: number,
  oy: number,
  u: number,
  size: number,
  s0: number,
  s1: number,
  s2: number,
  s3: number,
  t: number,
  f: ParticleField,
) => void;

type FadeFn = (
  ox: number,
  oy: number,
  u: number,
  s0: number,
  s1: number,
  s2: number,
  s3: number,
  t: number,
  f: ParticleField,
) => number;

export type ParticleEffect = {
  duration: number;
  fade: FadeFn;
  /** SF Symbol shown in the native effect picker menu. */
  icon: SFSymbol;
  id: string;
  kind: 'particles';
  label: string;
  place: PlaceFn;
};

export type TrimEffect = {
  duration: number;
  icon: SFSymbol;
  id: string;
  kind: 'trim';
  label: string;
};

export type EraserEffect = ParticleEffect | TrimEffect;

export const SPRITE_SIZE = 12;
const HALF = SPRITE_SIZE / 2;
const TWO_PI = Math.PI * 2;

function clamp01(value: number) {
  'worklet';
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function smoothstep(edge0: number, edge1: number, value: number) {
  'worklet';
  const x = clamp01((value - edge0) / (edge1 - edge0));
  return x * x * (3 - 2 * x);
}

function easeOutCubic(value: number) {
  'worklet';
  const inverted = 1 - value;
  return 1 - inverted * inverted * inverted;
}

/** Positions the dot sprite centered on (x, y) at the given scale. */
function setSprite(xf: SkRSXform, x: number, y: number, scale: number) {
  'worklet';
  xf.set(scale, 0, x - scale * HALF, y - scale * HALF);
}

/* ------------------------------------------------------------------ */
/* Thanos Snap — a disintegration wave travels left to right and the  */
/* ink drifts away as weightless dust.                                */
/* ------------------------------------------------------------------ */

const thanosLocal = (ox: number, s0: number, t: number, f: ParticleField) => {
  'worklet';
  return clamp01((t - 0.38 * (ox / f.w) - 0.08 * s0) / 0.54);
};

const thanos: ParticleEffect = {
  duration: 2100,
  fade: (ox, _oy, _u, s0, _s1, _s2, _s3, t, f) => {
    'worklet';
    return 1 - smoothstep(0.08, 0.92, thanosLocal(ox, s0, t, f));
  },
  icon: 'sparkles',
  id: 'thanos',
  kind: 'particles',
  label: 'Thanos Snap',
  place: (xf, ox, oy, _u, size, s0, s1, s2, _s3, t, f) => {
    'worklet';
    const tt = thanosLocal(ox, s0, t, f);
    const e = easeOutCubic(tt);
    const x = ox + e * (30 + 84 * s1) + Math.sin(TWO_PI * (s2 + tt * 1.6)) * 7 * tt;
    const y = oy - e * (34 + 70 * s2) - 14 * tt * s0;
    setSprite(xf, x, y, size * (1 - 0.45 * tt));
  },
};

/* ------------------------------------------------------------------ */
/* Black Hole — every particle spirals into the ink centroid,         */
/* accelerating as it falls in.                                       */
/* ------------------------------------------------------------------ */

const blackHole: ParticleEffect = {
  duration: 1600,
  fade: (_ox, _oy, _u, s0, _s1, _s2, _s3, t) => {
    'worklet';
    const tt = clamp01(t * 1.08 - s0 * 0.08);
    return 1 - smoothstep(0.78, 1, tt);
  },
  icon: 'moonphase.new.moon',
  id: 'black-hole',
  kind: 'particles',
  label: 'Black Hole',
  place: (xf, ox, oy, _u, size, s0, s1, _s2, _s3, t, f) => {
    'worklet';
    const tt = clamp01(t * 1.08 - s0 * 0.08);
    const e = tt * tt;
    const dx = ox - f.cx;
    const dy = oy - f.cy;
    const radius = Math.sqrt(dx * dx + dy * dy) * (1 - e);
    const angle = Math.atan2(dy, dx) + (2.6 + 2.2 * s1) * e;
    setSprite(
      xf,
      f.cx + Math.cos(angle) * radius,
      f.cy + Math.sin(angle) * radius,
      size * (1 - 0.6 * e),
    );
  },
};

/* ------------------------------------------------------------------ */
/* Gravity Fall — the ink loses adhesion, drops, and piles up along   */
/* the bottom edge before fading.                                     */
/* ------------------------------------------------------------------ */

const gravity: ParticleEffect = {
  duration: 1900,
  fade: (_ox, _oy, _u, _s0, _s1, _s2, _s3, t) => {
    'worklet';
    return 1 - smoothstep(0.82, 1, t);
  },
  icon: 'arrow.down.to.line.compact',
  id: 'gravity',
  kind: 'particles',
  label: 'Gravity Fall',
  place: (xf, ox, oy, _u, size, s0, s1, s2, _s3, t, f) => {
    'worklet';
    const tt = clamp01((t - s0 * 0.24) / 0.58);
    const restY = f.h - 2 - s1 * s1 * 16;
    const y = Math.min(oy + tt * tt * f.h * 1.6, restY);
    const landed = y >= restY;
    setSprite(xf, ox + (s2 - 0.5) * 24 * tt, y, size * (landed ? 0.9 : 1));
  },
};

/* ------------------------------------------------------------------ */
/* Explosion — one hard burst outward from the centroid with a touch  */
/* of gravity droop on the debris.                                    */
/* ------------------------------------------------------------------ */

const explosion: ParticleEffect = {
  duration: 1300,
  fade: (_ox, _oy, _u, _s0, _s1, _s2, _s3, t) => {
    'worklet';
    return 1 - smoothstep(0.35, 0.95, t);
  },
  icon: 'burst',
  id: 'explosion',
  kind: 'particles',
  label: 'Explosion',
  place: (xf, ox, oy, _u, size, s0, s1, _s2, _s3, t, f) => {
    'worklet';
    const dx = ox - f.cx;
    const dy = oy - f.cy;
    const angle = Math.atan2(dy, dx) + (s0 - 0.5) * 0.9;
    const speed = 90 + 170 * s1 + Math.sqrt(dx * dx + dy * dy) * 0.7;
    const e = easeOutCubic(t);
    setSprite(
      xf,
      ox + Math.cos(angle) * speed * e,
      oy + Math.sin(angle) * speed * e + 70 * t * t,
      size * (1 - 0.4 * t),
    );
  },
};

/* ------------------------------------------------------------------ */
/* Wind Sweep — a gust enters from the left and carries the ink off   */
/* the right edge in a fluttering stream.                             */
/* ------------------------------------------------------------------ */

const windLocal = (ox: number, s0: number, t: number, f: ParticleField) => {
  'worklet';
  return clamp01((t - 0.26 * (ox / f.w) - 0.06 * s0) / 0.6);
};

const wind: ParticleEffect = {
  duration: 1600,
  fade: (ox, _oy, _u, s0, _s1, _s2, _s3, t, f) => {
    'worklet';
    return 1 - smoothstep(0.35, 0.95, windLocal(ox, s0, t, f));
  },
  icon: 'wind',
  id: 'wind',
  kind: 'particles',
  label: 'Wind Sweep',
  place: (xf, ox, oy, _u, size, s0, s1, s2, _s3, t, f) => {
    'worklet';
    const tt = windLocal(ox, s0, t, f);
    const e = tt * tt * (3 - 2 * tt);
    const x = ox + e * f.w * (0.5 + 0.45 * s1);
    const y = oy - e * 26 * s0 + Math.sin(TWO_PI * (s2 + tt * 1.4)) * 11 * tt;
    setSprite(xf, x, y, size * (1 - 0.5 * tt));
  },
};

/* ------------------------------------------------------------------ */
/* Dissolve — grain-by-grain stochastic fade with a soft downward     */
/* sift, like sand losing its grip.                                   */
/* ------------------------------------------------------------------ */

const dissolve: ParticleEffect = {
  duration: 1400,
  fade: (_ox, _oy, _u, s0, _s1, _s2, _s3, t) => {
    'worklet';
    return 1 - clamp01((t - s0 * 0.62) / 0.38);
  },
  icon: 'aqi.medium',
  id: 'dissolve',
  kind: 'particles',
  label: 'Dissolve',
  place: (xf, ox, oy, _u, size, s0, s1, _s2, _s3, t) => {
    'worklet';
    const tt = clamp01((t - s0 * 0.62) / 0.38);
    setSprite(xf, ox + (s1 - 0.5) * 10 * tt, oy + tt * tt * 20, size * (1 - 0.4 * tt));
  },
};

/* ------------------------------------------------------------------ */
/* Vortex Spin — the whole signature spins up around the canvas       */
/* center and slings outward.                                         */
/* ------------------------------------------------------------------ */

const vortex: ParticleEffect = {
  duration: 1500,
  fade: (_ox, _oy, _u, _s0, _s1, _s2, _s3, t) => {
    'worklet';
    return 1 - smoothstep(0.55, 1, t);
  },
  icon: 'hurricane',
  id: 'vortex',
  kind: 'particles',
  label: 'Vortex Spin',
  place: (xf, ox, oy, _u, size, s0, _s1, _s2, _s3, t, f) => {
    'worklet';
    const cx = f.w / 2;
    const cy = f.h / 2;
    const dx = ox - cx;
    const dy = oy - cy;
    const spin = t * t * (5.2 + 2.6 * s0);
    const radius = Math.sqrt(dx * dx + dy * dy) * (1 + t * t * t * 2.4);
    const angle = Math.atan2(dy, dx) + spin;
    setSprite(xf, cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, size * (1 - 0.3 * t));
  },
};

/* ------------------------------------------------------------------ */
/* Ash Burn — a burn front consumes the ink in the order it was       */
/* written; embers lift and wander as they cool.                      */
/* ------------------------------------------------------------------ */

const ashLocal = (u: number, t: number) => {
  'worklet';
  return clamp01((t * 1.28 - u) / 0.3);
};

const ash: ParticleEffect = {
  duration: 2100,
  fade: (_ox, _oy, u, _s0, _s1, _s2, _s3, t) => {
    'worklet';
    return 1 - smoothstep(0.45, 1, ashLocal(u, t));
  },
  icon: 'flame',
  id: 'ash',
  kind: 'particles',
  label: 'Ash Burn',
  place: (xf, ox, oy, u, size, s0, s1, _s2, _s3, t) => {
    'worklet';
    const local = ashLocal(u, t);
    const x = ox + Math.sin(TWO_PI * (s1 + local * 1.2)) * 10 * local;
    const y = oy - local * local * (46 + 66 * s0);
    setSprite(xf, x, y, size * (1 - 0.5 * local));
  },
};

/* ------------------------------------------------------------------ */
/* Vacuum — everything gets sucked into the corner where the Clear    */
/* button lives, shrinking as it goes.                                */
/* ------------------------------------------------------------------ */

const vacuum: ParticleEffect = {
  duration: 1400,
  fade: (_ox, _oy, _u, s0, _s1, _s2, _s3, t) => {
    'worklet';
    const tt = clamp01(t * 1.3 - s0 * 0.3);
    return 1 - smoothstep(0.85, 1, tt);
  },
  icon: 'tornado',
  id: 'vacuum',
  kind: 'particles',
  label: 'Vacuum',
  place: (xf, ox, oy, _u, size, s0, s1, _s2, _s3, t, f) => {
    'worklet';
    const tt = clamp01(t * 1.3 - s0 * 0.3);
    const e = tt * tt * tt;
    const targetX = f.w - 8;
    const targetY = f.h + 44;
    const bow = Math.sin(Math.PI * e) * 46 * (s1 - 0.5);
    const dx = targetX - ox;
    const dy = targetY - oy;
    const length = Math.sqrt(dx * dx + dy * dy) + 1e-3;
    setSprite(
      xf,
      ox + dx * e - (dy / length) * bow,
      oy + dy * e + (dx / length) * bow,
      size * (1 - 0.7 * e),
    );
  },
};

/* ------------------------------------------------------------------ */
/* Firework Pop — the ink implodes into its centroid, then pops in a  */
/* flickering spherical burst.                                        */
/* ------------------------------------------------------------------ */

const GATHER = 0.3;

const firework: ParticleEffect = {
  duration: 1800,
  fade: (_ox, _oy, _u, _s0, _s1, s2, s3, t) => {
    'worklet';
    if (t < GATHER) {
      return 1;
    }
    const p = (t - GATHER) / (1 - GATHER);
    const flicker = 0.6 + 0.4 * Math.sin(TWO_PI * (s2 + p * (3 + 3 * s3)));
    return (1 - smoothstep(0.45, 1, p)) * flicker;
  },
  icon: 'fireworks',
  id: 'firework',
  kind: 'particles',
  label: 'Firework Pop',
  place: (xf, ox, oy, _u, size, s0, s1, _s2, _s3, t, f) => {
    'worklet';
    if (t < GATHER) {
      const e = (t / GATHER) ** 3;
      setSprite(xf, ox + (f.cx - ox) * e, oy + (f.cy - oy) * e, size * (1 - 0.4 * e));
      return;
    }
    const p = (t - GATHER) / (1 - GATHER);
    const e = easeOutCubic(p);
    const angle = s0 * TWO_PI;
    const speed = 62 + 150 * s1;
    setSprite(
      xf,
      f.cx + Math.cos(angle) * speed * e,
      f.cy + Math.sin(angle) * speed * e + 74 * p * p,
      size * (0.6 + 0.4 * (1 - p)),
    );
  },
};

/* ------------------------------------------------------------------ */
/* Rewind — not a particle effect: the strokes un-draw themselves in  */
/* reverse, handled by trimming the paths.                            */
/* ------------------------------------------------------------------ */

const rewind: TrimEffect = {
  duration: 1400,
  icon: 'clock.arrow.circlepath',
  id: 'rewind',
  kind: 'trim',
  label: 'Rewind',
};

export const eraserEffects: EraserEffect[] = [
  thanos,
  blackHole,
  gravity,
  explosion,
  wind,
  dissolve,
  vortex,
  ash,
  vacuum,
  firework,
  rewind,
];
