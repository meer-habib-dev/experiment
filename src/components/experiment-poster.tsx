import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';

import type { PosterArt } from '@/data/experiments';
import { View } from '@/tw';

/**
 * Gallery poster art.
 *
 * Every experiment gets a flat illustration built from plain views, native gradients, and
 * transforms — no canvas, no image asset, no per-tile render loop. A new experiment only needs a
 * `PosterArt` key plus one entry in `palettes` and `artwork` below.
 */

type Palette = {
  /** Panel wash behind the art. */
  base: [string, string];
  /** Ambient light pooled under the art. */
  glow: string;
  primary: string;
  secondary: string;
};

const palettes: Record<PosterArt, Palette> = {
  depth: { base: ['#171513', '#080808'], glow: '#ff9147', primary: '#fff2cf', secondary: '#ff9147' },
  ink: { base: ['#17181c', '#090a0c'], glow: '#8f86ff', primary: '#f6f4ec', secondary: '#8f86ff' },
  folio: { base: ['#181a17', '#090a09'], glow: '#e2523c', primary: '#f7f1e2', secondary: '#e2523c' },
  arena: { base: ['#121b18', '#070908'], glow: '#3ddc97', primary: '#3ddc97', secondary: '#0f6f52' },
  tower: { base: ['#1c1710', '#0a0806'], glow: '#e0a45c', primary: '#e6b273', secondary: '#a9642f' },
  prism: { base: ['#15161e', '#08090d'], glow: '#6f7bff', primary: '#ffffff', secondary: '#6f7bff' },
  relic: { base: ['#15181c', '#08090c'], glow: '#93a2b8', primary: '#e9eff7', secondary: '#7d8ca3' },
  lens: { base: ['#10161f', '#06080c'], glow: '#4aa8ff', primary: '#8fccff', secondary: '#2b6bd6' },
  paint: { base: ['#191813', '#080807'], glow: '#ffbe24', primary: '#ff493d', secondary: '#1487f4' },
  road: { base: ['#1c110f', '#0a0605'], glow: '#ff5b2e', primary: '#ff8a3d', secondary: '#ff2d18' },
  particles: {
    base: ['#161320', '#08070c'],
    glow: '#8b5cff',
    primary: '#c4a4ff',
    secondary: '#6d3bff',
  },
  wave: { base: ['#19131d', '#09070b'], glow: '#ff5ea8', primary: '#ff6fae', secondary: '#42d7ff' },
};

type PosterProps = {
  art: PosterArt;
  width: number;
  height: number;
  /** Concepts render the same art, held back so shipped experiments lead. */
  dimmed?: boolean;
};

export function ExperimentPoster({ art, dimmed = false, height, width }: PosterProps) {
  const palette = palettes[art];
  // The art is laid out on a 100×100 grid, then scaled into a square that bleeds off the corner.
  const size = width * 0.82;
  const unit = size / 100;

  return (
    <View
      className="overflow-hidden"
      style={{
        backgroundColor: palette.base[1],
        experimental_backgroundImage: `linear-gradient(155deg, ${palette.base[0]} 0%, ${palette.base[1]} 70%)`,
        height,
        width,
      }}>
      <View
        style={{
          ...fill,
          // Light pools under the art instead of washing the whole panel — the tile stays near-black.
          experimental_backgroundImage: `radial-gradient(circle at 84% 92%, ${palette.glow}3d 0%, transparent 58%)`,
          opacity: dimmed ? 0.5 : 1,
        }}
      />
      <View
        style={{
          height: size,
          left: width - size * 0.9,
          opacity: dimmed ? 0.62 : 1,
          position: 'absolute',
          top: height - size * 0.92,
          width: size,
        }}>
        {artwork[art](unit, palette)}
      </View>
    </View>
  );
}

const fill: ViewStyle = { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 };

/** Absolute box on the 100×100 art grid. */
function box(unit: number, x: number, y: number, w: number, h: number): ViewStyle {
  return { height: h * unit, left: x * unit, position: 'absolute', top: y * unit, width: w * unit };
}

function dot(unit: number, x: number, y: number, d: number, color: string, opacity = 1): ViewStyle {
  return {
    ...box(unit, x, y, d, d),
    backgroundColor: color,
    borderRadius: (d * unit) / 2,
    opacity,
  };
}

const artwork: Record<PosterArt, (unit: number, palette: Palette) => ReactNode> = {
  /** Paint Pull — a bright ribbon field gathered by a squeegee. */
  paint: (u) => (
    <>
      {['#FF493D', '#FFBE24', '#24B879', '#1487F4', '#F05AB5', '#F8F7F2'].map(
        (color, index) => (
          <View
            key={color}
            style={{
              ...box(u, 13 + index * 12, 14 + (index % 2) * 3, 9, 66 - index * 2),
              backgroundColor: color,
              borderRadius: 5 * u,
              transform: [{ rotate: `${-8 + index * 3}deg` }],
            }}
          />
        ),
      )}
      <View
        style={{
          ...box(u, 4, 68, 87, 10),
          backgroundColor: '#F6F6F4',
          borderRadius: 5 * u,
          boxShadow: `0 ${5 * u}px ${12 * u}px rgba(0,0,0,0.55)`,
          transform: [{ rotate: '4deg' }],
        }}
      />
      <View
        style={{
          ...box(u, 45, 75, 10, 23),
          backgroundColor: '#E7E7E3',
          borderRadius: 5 * u,
          transform: [{ rotate: '4deg' }],
        }}
      />
    </>
  ),
  /** Depth Light — a near hand interrupts a light projected into the scene. */
  depth: (u, p) => (
    <>
      <View
        style={{
          ...box(u, 6, 8, 88, 88),
          borderRadius: 44 * u,
          experimental_backgroundImage: `radial-gradient(circle at 27% 40%, ${p.primary} 0%, ${p.secondary}99 11%, transparent 42%)`,
          opacity: 0.92,
        }}
      />
      <View
        style={{
          ...box(u, 38, 16, 35, 84),
          backgroundColor: '#161411',
          borderRadius: 18 * u,
          boxShadow: `${-7 * u}px 0 ${14 * u}px rgba(255,145,71,0.5)`,
          transform: [{ rotate: '-18deg' }],
        }}
      />
      <View style={dot(u, 17, 35, 17, p.primary, 1)} />
      <View
        style={{
          ...box(u, 17, 35, 17, 17),
          borderColor: '#ffffff',
          borderRadius: 9 * u,
          borderWidth: 1.5 * u,
          boxShadow: `0 0 ${16 * u}px ${p.glow}`,
        }}
      />
    </>
  ),
  /** Sign Off — a signature swash breaking apart into ink. */
  ink: (u, p) => (
    <>
      <View
        style={{
          ...box(u, 2, 16, 54, 54),
          borderColor: 'transparent',
          borderLeftColor: p.primary,
          borderRadius: 27 * u,
          borderTopColor: p.primary,
          borderWidth: 6 * u,
          transform: [{ rotate: '-32deg' }],
        }}
      />
      <View
        style={{
          ...box(u, 30, 56, 58, 6),
          backgroundColor: p.primary,
          borderRadius: 3 * u,
          transform: [{ rotate: '-16deg' }],
        }}
      />
      {[
        [64, 26, 9, 0.95],
        [78, 16, 6, 0.8],
        [88, 30, 5, 0.62],
        [96, 18, 3.5, 0.4],
        [74, 40, 4, 0.5],
      ].map(([x, y, d, o]) => (
        <View key={`${x}-${y}`} style={dot(u, x, y, d, p.secondary, o)} />
      ))}
    </>
  ),

  /** Field Folio — a stack of field pages with a lifted sticker. */
  folio: (u, p) => (
    <>
      <View
        style={{
          ...box(u, 2, 18, 66, 76),
          backgroundColor: '#cfc6b3',
          borderRadius: 10 * u,
          opacity: 0.45,
          transform: [{ rotate: '-8deg' }],
        }}
      />
      <View
        style={{
          ...box(u, 12, 10, 70, 84),
          backgroundColor: p.primary,
          borderRadius: 11 * u,
          experimental_backgroundImage: `linear-gradient(160deg, #fbf7ec 0%, #e4d9c2 100%)`,
          transform: [{ rotate: '5deg' }],
        }}>
        <View style={{ ...box(u, 8, 12, 26, 4), backgroundColor: '#1e2a22', borderRadius: 2 * u }} />
        <View
          style={{
            ...box(u, 8, 22, 18, 3),
            backgroundColor: '#1e2a22',
            borderRadius: 2 * u,
            opacity: 0.35,
          }}
        />
        <View
          style={{
            ...box(u, 26, 36, 34, 34),
            backgroundColor: p.secondary,
            borderRadius: 17 * u,
            experimental_backgroundImage: `linear-gradient(150deg, #f2704f 0%, #c9331f 100%)`,
          }}>
          <View
            style={{
              ...box(u, 8, 8, 18, 18),
              borderColor: '#fbf7ec',
              borderRadius: 9 * u,
              borderWidth: 3 * u,
              opacity: 0.9,
            }}
          />
        </View>
      </View>
    </>
  ),

  /** Halo Arena — stadium tiers around a lit pitch. */
  arena: (u, p) => (
    <>
      <View
        style={{
          ...box(u, 0, 24, 100, 64),
          borderColor: p.primary,
          borderRadius: 50 * u,
          borderWidth: 3 * u,
          opacity: 0.28,
        }}
      />
      <View
        style={{
          ...box(u, 12, 33, 76, 48),
          borderColor: p.primary,
          borderRadius: 38 * u,
          borderWidth: 3 * u,
          opacity: 0.55,
        }}
      />
      <View
        style={{
          ...box(u, 26, 43, 48, 30),
          borderRadius: 15 * u,
          experimental_backgroundImage: `linear-gradient(160deg, ${p.primary} 0%, ${p.secondary} 100%)`,
        }}>
        <View
          style={{
            ...box(u, 22, 4, 2, 22),
            backgroundColor: '#04160f',
            opacity: 0.45,
          }}
        />
      </View>
      <View
        style={{
          ...box(u, 66, 28, 18, 10),
          backgroundColor: '#eafff5',
          borderRadius: 5 * u,
          boxShadow: `0 0 ${10 * u}px ${p.glow}`,
        }}
      />
    </>
  ),

  /** Timberline — a stacked tower mid-pull. */
  tower: (u, p) => (
    <>
      {[
        [18, 77, 62, 0],
        [22, 64, 56, 0],
        [16, 51, 60, 0],
        [20, 38, 58, 0],
        [24, 25, 52, 0],
      ].map(([x, y, w], index) => (
        <View
          key={`block-${y}`}
          style={{
            ...box(u, x, y, w, 11),
            backgroundColor: index % 2 === 0 ? p.primary : p.secondary,
            borderRadius: 3 * u,
            experimental_backgroundImage: `linear-gradient(180deg, ${index % 2 === 0 ? p.primary : p.secondary} 0%, #6d3d18 100%)`,
          }}
        />
      ))}
      <View
        style={{
          ...box(u, 46, 11, 58, 11),
          backgroundColor: '#fbdca8',
          borderRadius: 3 * u,
          boxShadow: `0 ${4 * u}px ${12 * u}px rgba(0,0,0,0.55)`,
          transform: [{ rotate: '-7deg' }],
        }}
      />
    </>
  ),

  /** Prism Field — a beam split into a spectrum. */
  prism: (u, p) => (
    <>
      <View
        style={{
          ...box(u, -8, 44, 40, 5),
          backgroundColor: p.primary,
          borderRadius: 3 * u,
          opacity: 0.85,
        }}
      />
      <View
        style={{
          ...box(u, 20, 26, 48, 48),
          borderRadius: 10 * u,
          experimental_backgroundImage: `linear-gradient(140deg, #ffffff 0%, #c3cbff 55%, #7e8bff 100%)`,
          transform: [{ rotate: '45deg' }],
        }}
      />
      {[
        ['#ff5f6d', -14, 30],
        ['#ffb03a', -5, 42],
        ['#4ddc8f', 5, 54],
        ['#57a9ff', 14, 66],
      ].map(([color, rotate, y]) => (
        <View
          key={color as string}
          style={{
            ...box(u, 62, y as number, 48, 5),
            backgroundColor: color as string,
            borderRadius: 3 * u,
            transform: [{ rotate: `${rotate}deg` }],
          }}
        />
      ))}
    </>
  ),

  /** Relic Lift — an object lifted out of its outline and cast in metal. */
  relic: (u, p) => (
    <>
      <View
        style={{
          ...box(u, 10, 26, 54, 56),
          borderColor: p.primary,
          borderRadius: 18 * u,
          borderWidth: 2 * u,
          opacity: 0.22,
          transform: [{ rotate: '-9deg' }],
        }}
      />
      <View
        style={{
          ...box(u, 28, 14, 54, 60),
          borderRadius: 20 * u,
          boxShadow: `0 ${6 * u}px ${16 * u}px rgba(0,0,0,0.6)`,
          experimental_backgroundImage: `linear-gradient(135deg, #f7faff 0%, ${p.secondary} 42%, #eef3fa 66%, #67758c 100%)`,
          transform: [{ rotate: '11deg' }],
        }}
      />
      <View style={dot(u, 84, 8, 8, p.primary, 0.9)} />
      <View style={dot(u, 96, 22, 4, p.primary, 0.5)} />
    </>
  ),

  /** Rain Lens — glass droplets across the lens. */
  lens: (u, p) => (
    <>
      <View
        style={{
          ...box(u, 8, 20, 76, 76),
          borderColor: '#ffffff',
          borderRadius: 38 * u,
          borderWidth: 2 * u,
          experimental_backgroundImage: `radial-gradient(circle at 34% 28%, ${p.primary}dd, ${p.secondary}55)`,
        }}
      />
      {[
        [62, 8, 20],
        [86, 30, 13],
        [54, 62, 10],
        [78, 62, 7],
      ].map(([x, y, d]) => (
        <View
          key={`drop-${x}-${y}`}
          style={{
            ...box(u, x, y, d, d),
            borderRadius: (d * u) / 2,
            experimental_backgroundImage: `radial-gradient(circle at 32% 26%, #ffffffee, ${p.secondary}aa)`,
          }}
        />
      ))}
    </>
  ),

  /** Volcano Drive — a road running to a burning horizon. */
  road: (u, p) => (
    <>
      <View
        style={{
          ...box(u, 20, 10, 60, 6),
          borderRadius: 3 * u,
          experimental_backgroundImage: `linear-gradient(90deg, ${p.secondary}00 0%, ${p.primary} 50%, ${p.secondary}00 100%)`,
        }}
      />
      <View
        style={{
          ...box(u, 12, 18, 6, 72),
          backgroundColor: p.primary,
          borderRadius: 3 * u,
          opacity: 0.55,
          transform: [{ rotate: '-15deg' }],
        }}
      />
      <View
        style={{
          ...box(u, 82, 18, 6, 72),
          backgroundColor: p.primary,
          borderRadius: 3 * u,
          opacity: 0.55,
          transform: [{ rotate: '15deg' }],
        }}
      />
      {[
        [48, 22, 4, 9],
        [47, 38, 6, 13],
        [45, 56, 9, 16],
      ].map(([x, y, w, h]) => (
        <View
          key={`dash-${y}`}
          style={{
            ...box(u, x, y, w, h),
            backgroundColor: '#ffe6c2',
            borderRadius: 2 * u,
            opacity: 0.75,
          }}
        />
      ))}
      <View
        style={{
          ...box(u, 34, 66, 34, 24),
          borderRadius: 9 * u,
          boxShadow: `0 0 ${14 * u}px ${p.secondary}`,
          experimental_backgroundImage: `linear-gradient(160deg, ${p.primary} 0%, ${p.secondary} 100%)`,
        }}>
        <View style={dot(u, 5, 4, 7, '#fff3d6', 0.95)} />
        <View style={dot(u, 22, 4, 7, '#fff3d6', 0.95)} />
      </View>
    </>
  ),

  /** GPU particle field — a compute grid falling off toward the corner. */
  particles: (u, p) => (
    <>
      {Array.from({ length: 25 }, (_, index) => {
        const column = index % 5;
        const row = Math.floor(index / 5);
        const energy = (column + row) / 8;
        return (
          <View
            key={`particle-${index}`}
            style={dot(
              u,
              6 + column * 20,
              4 + row * 18,
              3 + energy * 8,
              energy > 0.55 ? p.primary : p.secondary,
              0.3 + energy * 0.7,
            )}
          />
        );
      })}
    </>
  ),

  /** Skia transitions — two masks meeting over a shader band. */
  wave: (u, p) => (
    <>
      <View
        style={{
          ...box(u, 4, 30, 56, 56),
          borderRadius: 28 * u,
          experimental_backgroundImage: `linear-gradient(140deg, ${p.primary} 0%, #c72e79 100%)`,
        }}
      />
      <View
        style={{
          ...box(u, 40, 24, 58, 58),
          borderRadius: 29 * u,
          experimental_backgroundImage: `linear-gradient(140deg, ${p.secondary} 0%, #1d7fa8 100%)`,
          opacity: 0.72,
        }}
      />
      {[16, 30, 44].map((y, index) => (
        <View
          key={`band-${y}`}
          style={{
            ...box(u, 10, y, 84, 4),
            backgroundColor: '#ffffff',
            borderRadius: 2 * u,
            opacity: 0.16 + index * 0.06,
            transform: [{ rotate: '-12deg' }],
          }}
        />
      ))}
    </>
  ),
};
