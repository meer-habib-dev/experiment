import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  type DimensionValue,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const webPages = [
  {
    accent: '#FF6B4A',
    chapter: 'FIELD NOTE 01',
    code: 'ALP–24',
    ink: '#193D31',
    note: 'Collected where the trail thins and the air turns silver.',
    paper: '#F5EEDC',
    title: 'Alpine\nSignals',
  },
  {
    accent: '#2E75E8',
    chapter: 'FIELD NOTE 02',
    code: 'RAIN–09',
    ink: '#162D4D',
    note: 'Blue hour, wet pavement, and one impossible patch of clear sky.',
    paper: '#EAF1F1',
    title: 'After\nRain',
  },
  {
    accent: '#EAAA28',
    chapter: 'FIELD NOTE 03',
    code: 'ORB–77',
    ink: '#44243E',
    note: 'The orchard kept the last light long after the road went dark.',
    paper: '#F1E5DC',
    title: 'Night\nOrchard',
  },
  {
    accent: '#00AFA0',
    chapter: 'FIELD NOTE 04',
    code: 'TIDE–18',
    ink: '#173F46',
    note: 'A ledger of salt, wind, and the shapes the tide returned.',
    paper: '#EBF0E8',
    title: 'Tide\nLedger',
  },
  {
    accent: '#F24E36',
    chapter: 'FIELD NOTE 05',
    code: 'SOL–31',
    ink: '#3C3321',
    note: 'Warm fragments filed by color, not chronology.',
    paper: '#F4E8CB',
    title: 'Solar\nFragments',
  },
] as const;

function WebSticker({
  color,
  left,
  size,
  top,
}: {
  color: string;
  left: DimensionValue;
  size: number;
  top: DimensionValue;
}) {
  const [lifted, setLifted] = useState(false);
  return (
    <Pressable
      accessibilityHint="On native, hold and drag this living metal sticker."
      accessibilityLabel="Metal sticker preview"
      accessibilityRole="button"
      onPress={() => setLifted((current) => !current)}
      style={{
        alignItems: 'center',
        backgroundColor: color,
        borderColor: '#FFF9EA',
        borderRadius: size * 0.32,
        borderWidth: 7,
        boxShadow: lifted ? '10px 16px 20px rgba(0,0,0,.28)' : '3px 5px 7px rgba(0,0,0,.18)',
        height: size,
        justifyContent: 'center',
        left,
        position: 'absolute',
        top,
        transform: [{ rotate: lifted ? '7deg' : '-7deg' }, { scale: lifted ? 1.08 : 1 }],
        width: size,
      }}>
      <View
        style={{
          borderColor: 'rgba(255,255,255,.84)',
          borderRadius: size * 0.2,
          borderWidth: 2,
          height: size * 0.46,
          transform: [{ rotate: '45deg' }],
          width: size * 0.46,
        }}
      />
    </Pressable>
  );
}

export function FolioShuffleExperience() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const [pageIndex, setPageIndex] = useState(0);
  const page = webPages[pageIndex];
  const pageWidth = Math.min(width - 28, 520);
  const pageHeight = Math.min(pageWidth * 1.46, height - insets.top - insets.bottom - 190);

  const turn = (direction: 1 | -1) => {
    setPageIndex((current) => (current + direction + webPages.length) % webPages.length);
  };

  return (
    <View style={{ backgroundColor: '#151A17', flex: 1, height, overflow: 'hidden' }}>
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingTop: insets.top + 8,
        }}>
        <Pressable
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={{
            alignItems: 'center',
            backgroundColor: 'rgba(245,239,222,.08)',
            borderColor: 'rgba(245,239,222,.16)',
            borderRadius: 22,
            borderWidth: 1,
            height: 44,
            justifyContent: 'center',
            width: 44,
          }}>
          <Text style={{ color: '#F5EFDE', fontSize: 24 }}>‹</Text>
        </Pressable>
        <View style={{ alignItems: 'center', gap: 3 }}>
          <Text style={{ color: '#F5EFDE', fontSize: 13, fontWeight: '900', letterSpacing: 2.1 }}>
            FIELD FOLIO
          </Text>
          <Text
            style={{
              color: 'rgba(245,239,222,.62)',
              fontSize: 9,
              fontWeight: '700',
              letterSpacing: 1.4,
            }}>
            ISSUE 04 · 0{pageIndex + 1}/0{webPages.length}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Next page"
          onPress={() => turn(1)}
          style={{
            alignItems: 'center',
            backgroundColor: 'rgba(245,239,222,.08)',
            borderColor: 'rgba(245,239,222,.16)',
            borderRadius: 22,
            borderWidth: 1,
            height: 44,
            justifyContent: 'center',
            width: 44,
          }}>
          <Text style={{ color: '#F5EFDE', fontSize: 20 }}>→</Text>
        </Pressable>
      </View>

      <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
        <View style={{ height: pageHeight + 12, width: pageWidth + 12 }}>
          <View
            style={{
              backgroundColor: '#B8AD94',
              borderRadius: 26,
              height: pageHeight,
              left: 10,
              opacity: 0.35,
              position: 'absolute',
              top: 10,
              transform: [{ rotate: '2.4deg' }],
              width: pageWidth,
            }}
          />
          <View
            style={{
              backgroundColor: page.paper,
              borderColor: 'rgba(23,28,25,.13)',
              borderCurve: 'continuous',
              borderRadius: 26,
              borderWidth: 1,
              boxShadow: '0 18px 48px rgba(0,0,0,.34)',
              height: pageHeight,
              overflow: 'hidden',
              padding: 22,
              width: pageWidth,
            }}>
            <View
              style={{
                backgroundColor: page.accent,
                borderRadius: pageWidth * 0.17,
                height: pageWidth * 0.34,
                opacity: 0.82,
                position: 'absolute',
                right: pageWidth * 0.1,
                top: pageHeight * 0.31,
                width: pageWidth * 0.34,
              }}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: page.ink, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 }}>
                {page.chapter}
              </Text>
              <Text style={{ color: page.ink, fontSize: 10, fontWeight: '700', letterSpacing: 1.2 }}>
                {page.code}
              </Text>
            </View>
            <Text
              style={{
                color: page.ink,
                fontSize: 42,
                fontWeight: '900',
                letterSpacing: -2.1,
                lineHeight: 39,
                paddingTop: 22,
              }}>
              {page.title}
            </Text>
            <WebSticker color={page.accent} left="57%" size={104} top="39%" />
            <WebSticker color="#729E8C" left="13%" size={84} top="69%" />
            <View
              style={{
                alignItems: 'flex-start',
                bottom: 20,
                flexDirection: 'row',
                gap: 12,
                left: 23,
                position: 'absolute',
                right: 23,
              }}>
              <View style={{ backgroundColor: page.accent, height: 34, width: 4 }} />
              <Text
                style={{
                  color: page.ink,
                  flex: 1,
                  fontSize: 11,
                  fontWeight: '600',
                  lineHeight: 16,
                }}>
                {page.note}
              </Text>
              <Text style={{ color: page.ink, fontSize: 12, fontWeight: '900' }}>
                0{pageIndex + 1}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={{ alignItems: 'center', gap: 12, paddingBottom: insets.bottom + 12 }}>
        <View style={{ flexDirection: 'row', gap: 7 }}>
          {webPages.map((item, index) => (
            <Pressable
              accessibilityLabel={`Open ${item.title.replace('\n', ' ')}`}
              key={item.code}
              onPress={() => setPageIndex(index)}
              style={{
                backgroundColor: index === pageIndex ? '#F5EFDE' : 'rgba(245,239,222,.25)',
                borderRadius: 4,
                height: 6,
                width: index === pageIndex ? 22 : 6,
              }}
            />
          ))}
        </View>
        <Text
          style={{
            color: 'rgba(245,239,222,.62)',
            fontSize: 10,
            fontWeight: '800',
            letterSpacing: 1.1,
          }}>
          TAP A STICKER · OPEN ON NATIVE FOR LIVE METAL + DRAG
        </Text>
      </View>
    </View>
  );
}
