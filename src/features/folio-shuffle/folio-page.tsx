import {
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Line,
  Path,
  Rect,
  vec,
} from '@shopify/react-native-skia';
import { memo } from 'react';
import { Text, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import {
  MetalSticker,
  type MetalFinish,
  type StickerSpec,
} from '@/features/folio-shuffle/metal-sticker';

export type FolioPageData = {
  accent: string;
  chapter: string;
  code: string;
  ink: string;
  note: string;
  paper: string;
  stickers: StickerSpec[];
  title: string;
};

type StickerPosition = {
  x: number;
  y: number;
};

type FolioPageProps = {
  height: number;
  interactive?: boolean;
  onLiftChange?: (lifted: boolean, finish: MetalFinish) => void;
  onStickerMove?: (id: string, position: StickerPosition) => void;
  page: FolioPageData;
  pageIndex: number;
  positions?: Record<string, StickerPosition>;
  shaderClock: SharedValue<number>;
  width: number;
};

export const folioPages: FolioPageData[] = [
  {
    accent: '#FF6B4A',
    chapter: 'FIELD NOTE 01',
    code: 'ALP–24',
    ink: '#193D31',
    note: 'Collected where the trail thins and the air turns silver.',
    paper: '#F5EEDC',
    stickers: [
      { angle: -8, finish: 'verdigris', id: 'alpine-bloom', shape: 'bloom', size: 108, x: 0.58, y: 0.39 },
      { angle: 11, finish: 'copper', id: 'alpine-star', shape: 'star', size: 86, x: 0.12, y: 0.68 },
    ],
    title: 'Alpine\nSignals',
  },
  {
    accent: '#2E75E8',
    chapter: 'FIELD NOTE 02',
    code: 'RAIN–09',
    ink: '#162D4D',
    note: 'Blue hour, wet pavement, and one impossible patch of clear sky.',
    paper: '#EAF1F1',
    stickers: [
      { angle: 7, finish: 'pearl', id: 'rain-moth', shape: 'moth', size: 112, x: 0.49, y: 0.34 },
      { angle: -12, finish: 'verdigris', id: 'rain-shell', shape: 'shell', size: 91, x: 0.14, y: 0.69 },
    ],
    title: 'After\nRain',
  },
  {
    accent: '#EAAA28',
    chapter: 'FIELD NOTE 03',
    code: 'ORB–77',
    ink: '#44243E',
    note: 'The orchard kept the last light long after the road went dark.',
    paper: '#F1E5DC',
    stickers: [
      { angle: -10, finish: 'copper', id: 'orchard-comet', shape: 'comet', size: 112, x: 0.54, y: 0.35 },
      { angle: 8, finish: 'pearl', id: 'orchard-bloom', shape: 'bloom', size: 89, x: 0.1, y: 0.7 },
    ],
    title: 'Night\nOrchard',
  },
  {
    accent: '#00AFA0',
    chapter: 'FIELD NOTE 04',
    code: 'TIDE–18',
    ink: '#173F46',
    note: 'A ledger of salt, wind, and the shapes the tide returned.',
    paper: '#EBF0E8',
    stickers: [
      { angle: 9, finish: 'verdigris', id: 'tide-shell', shape: 'shell', size: 112, x: 0.55, y: 0.35 },
      { angle: -9, finish: 'pearl', id: 'tide-star', shape: 'star', size: 90, x: 0.1, y: 0.69 },
    ],
    title: 'Tide\nLedger',
  },
  {
    accent: '#F24E36',
    chapter: 'FIELD NOTE 05',
    code: 'SOL–31',
    ink: '#3C3321',
    note: 'Warm fragments filed by color, not chronology.',
    paper: '#F4E8CB',
    stickers: [
      { angle: -7, finish: 'copper', id: 'solar-star', shape: 'star', size: 112, x: 0.54, y: 0.35 },
      { angle: 12, finish: 'pearl', id: 'solar-moth', shape: 'moth', size: 89, x: 0.12, y: 0.7 },
    ],
    title: 'Solar\nFragments',
  },
];

function PageArtwork({
  accent,
  height,
  ink,
  pageIndex,
  width,
}: {
  accent: string;
  height: number;
  ink: string;
  pageIndex: number;
  width: number;
}) {
  const stripeY = height * 0.57;
  const orbX = pageIndex % 2 === 0 ? width * 0.72 : width * 0.67;

  return (
    <Canvas pointerEvents="none" style={{ height, left: 0, position: 'absolute', top: 0, width }}>
      <Rect height={height * 0.34} width={width} x={0} y={height * 0.31}>
        <LinearGradient
          colors={[`${accent}08`, `${accent}36`, `${accent}10`]}
          end={vec(width, height * 0.6)}
          start={vec(0, height * 0.34)}
        />
      </Rect>
      <Circle color={`${accent}DD`} cx={orbX} cy={height * 0.43} r={width * 0.2} />
      <Circle color={`${ink}18`} cx={width * 0.2} cy={height * 0.59} r={width * 0.13} />
      <Group opacity={0.22}>
        {Array.from({ length: 9 }).map((_, index) => (
          <Line
            color={ink}
            key={index}
            p1={vec(width * 0.07, stripeY + index * 8)}
            p2={vec(width * (0.43 + (index % 3) * 0.05), stripeY + index * 8)}
            strokeWidth={1}
          />
        ))}
      </Group>
      <Path
        color={`${ink}20`}
        path={`M${width * 0.05} ${height * 0.74} C${width * 0.25} ${height * 0.66}, ${width * 0.42} ${height * 0.84}, ${width * 0.66} ${height * 0.74} S${width * 0.91} ${height * 0.72}, ${width * 0.98} ${height * 0.81}`}
        strokeCap="round"
        strokeWidth={1.4}
        style="stroke"
      />
      <Rect color={`${ink}0D`} height={height} width={1} x={width * 0.055} y={0} />
      <Rect color={`${ink}0D`} height={height} width={1} x={width * 0.945} y={0} />
    </Canvas>
  );
}

function FolioPageBase({
  height,
  interactive = true,
  onLiftChange,
  onStickerMove,
  page,
  pageIndex,
  positions,
  shaderClock,
  width,
}: FolioPageProps) {
  const compact = width < 360;

  return (
    <View
      style={{
        backgroundColor: page.paper,
        borderColor: 'rgba(23,28,25,0.13)',
        borderCurve: 'continuous',
        borderRadius: 26,
        borderWidth: 1,
        height,
        overflow: 'hidden',
        width,
      }}>
      <PageArtwork
        accent={page.accent}
        height={height}
        ink={page.ink}
        pageIndex={pageIndex}
        width={width}
      />

      <View
        pointerEvents="none"
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          left: 23,
          position: 'absolute',
          right: 23,
          top: 22,
        }}>
        <Text
          style={{
            color: page.ink,
            fontSize: 10,
            fontWeight: '800',
            letterSpacing: 1.4,
          }}>
          {page.chapter}
        </Text>
        <Text
          style={{
            color: `${page.ink}A8`,
            fontSize: 10,
            fontVariant: ['tabular-nums'],
            fontWeight: '700',
            letterSpacing: 1.2,
          }}>
          {page.code}
        </Text>
      </View>

      <Text
        pointerEvents="none"
        style={{
          color: page.ink,
          fontSize: compact ? 36 : 42,
          fontWeight: '900',
          left: 22,
          letterSpacing: -2.1,
          lineHeight: compact ? 34 : 39,
          position: 'absolute',
          top: 55,
        }}>
        {page.title}
      </Text>

      {page.stickers.map((sticker) => (
        <MetalSticker
          interactive={interactive}
          key={sticker.id}
          onLiftChange={onLiftChange}
          onMove={onStickerMove}
          pageHeight={height}
          pageWidth={width}
          position={positions?.[sticker.id]}
          shaderClock={shaderClock}
          spec={sticker}
        />
      ))}

      <View
        pointerEvents="none"
        style={{
          bottom: 19,
          flexDirection: 'row',
          gap: 12,
          left: 23,
          position: 'absolute',
          right: 23,
        }}>
        <View style={{ backgroundColor: page.accent, height: 34, width: 4 }} />
        <Text
          style={{
            color: `${page.ink}C7`,
            flex: 1,
            fontSize: 11,
            fontWeight: '600',
            lineHeight: 16,
          }}>
          {page.note}
        </Text>
        <Text
          style={{
            alignSelf: 'flex-end',
            color: page.ink,
            fontSize: 12,
            fontVariant: ['tabular-nums'],
            fontWeight: '900',
          }}>
          {String(pageIndex + 1).padStart(2, '0')}
        </Text>
      </View>
    </View>
  );
}

// Memoized: the live and target pages only re-render when their own props
// change, so the lift indicator / snapshot nonce state on the parent no longer
// re-renders the whole Skia page tree mid-gesture.
export const FolioPage = memo(FolioPageBase);
