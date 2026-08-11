import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  makeImageFromView,
  type SkImage,
  useClock,
} from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FolioPage, folioPages } from '@/features/folio-shuffle/folio-page';
import { PageCurl } from '@/features/folio-shuffle/page-curl';
import type { MetalFinish } from '@/features/folio-shuffle/metal-sticker';

/* Gesture callbacks intentionally bridge to JS and mutate UI-thread shared values. */
/* eslint-disable react-hooks/immutability, react-hooks/refs */

type StickerPosition = {
  x: number;
  y: number;
};

const PAGE_COUNT = folioPages.length;

const colors = {
  backdrop: '#151A17',
  line: 'rgba(245,239,222,0.16)',
  paper: '#F5EFDE',
  soft: 'rgba(245,239,222,0.62)',
};

function wrapIndex(index: number) {
  return (index + PAGE_COUNT) % PAGE_COUNT;
}

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.max(min, Math.min(max, value));
}

function nextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

async function waitForFrames(count: number) {
  for (let frame = 0; frame < count; frame += 1) {
    await nextFrame();
  }
}

function hapticTurn() {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  }
}

function SfIcon({
  color = colors.paper,
  name,
  size = 19,
}: {
  color?: string;
  name: string;
  size?: number;
}) {
  return (
    <Image
      contentFit="contain"
      source={`sf:${name}`}
      style={{ height: size, tintColor: color, width: size }}
    />
  );
}

function HeaderButton({
  accessibilityLabel,
  icon,
  onPress,
}: {
  accessibilityLabel: string;
  icon: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: pressed ? 'rgba(245,239,222,0.16)' : 'rgba(245,239,222,0.08)',
        borderColor: colors.line,
        borderRadius: 22,
        borderWidth: 1,
        height: 44,
        justifyContent: 'center',
        transform: [{ scale: pressed ? 0.94 : 1 }],
        width: 44,
      })}>
      <SfIcon name={icon} />
    </Pressable>
  );
}

/**
 * Page turns are driven entirely from the UI thread.
 *
 * The curl layer stays mounted with a snapshot of the resting page that is
 * captured while idle, and its visibility is derived from `turn` in a worklet.
 * So a drag needs no JS work at all to become visible: no capture, no state
 * change, no async handshake on the gesture path. JS only runs once per turn,
 * after the animation has already finished, to advance the page index.
 */
export function FolioShuffleExperience() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();

  const [pageIndex, setPageIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [jumpTarget, setJumpTarget] = useState<number | null>(null);
  const [pageImage, setPageImage] = useState<SkImage | null>(null);
  const [liftedFinish, setLiftedFinish] = useState<MetalFinish | null>(null);
  const [positions, setPositions] = useState<Record<string, StickerPosition>>({});
  const [captureNonce, setCaptureNonce] = useState(0);

  const pageRef = useRef<View>(null);
  const captureToken = useRef(0);
  const liftedRef = useRef(false);

  const shaderClock = useClock();

  // |turn| is curl progress 0..1; its sign encodes the direction being dragged.
  const turn = useSharedValue(0);
  // 1 only while `pageImage` matches the page currently on screen. Gates the
  // curl so a stale snapshot can never be shown.
  const curlReady = useSharedValue(0);
  // Blocks new turns while one is animating.
  const settling = useSharedValue(false);

  const targetIndex = jumpTarget ?? wrapIndex(pageIndex + direction);

  const horizontalPadding = screenWidth > 700 ? 42 : 14;
  const pageWidth = Math.min(screenWidth - horizontalPadding * 2, 520);
  const availableHeight = screenHeight - insets.top - insets.bottom - 196;
  const pageHeight = Math.min(pageWidth * 1.46, Math.max(360, availableHeight));

  // Visibility is a pure function of UI-thread state, so the curl appears on
  // the very first frame of a drag.
  const livePageStyle = useAnimatedStyle(() => ({
    opacity: curlReady.value === 1 && Math.abs(turn.value) > 0.0005 ? 0 : 1,
  }));
  const curlPageStyle = useAnimatedStyle(() => ({
    opacity: curlReady.value === 1 && Math.abs(turn.value) > 0.0005 ? 1 : 0,
  }));

  const requestRecapture = useCallback(() => {
    setCaptureNonce((current) => current + 1);
  }, []);

  const captureRestingPage = useCallback(async () => {
    if (liftedRef.current || turn.value !== 0) return;
    const token = (captureToken.current += 1);
    let image: SkImage | null = null;
    try {
      image = await makeImageFromView(pageRef);
    } catch {
      return;
    }
    // Anything that happened while the capture was in flight invalidates it.
    if (token !== captureToken.current) return;
    if (liftedRef.current || turn.value !== 0) return;
    if (!image) return;
    setPageImage(image);
    curlReady.value = 1;
  }, [curlReady, turn]);

  // Any change to what the resting page looks like invalidates the snapshot,
  // then re-warms it. Invalidation is synchronous so a turn started before the
  // new capture lands simply runs without the curl instead of showing a stale
  // page. Capture is skipped while a sticker is held and re-fired on release.
  useEffect(() => {
    captureToken.current += 1;
    curlReady.value = 0;
    const timer = setTimeout(() => {
      void captureRestingPage();
    }, 90);
    return () => clearTimeout(timer);
  }, [captureNonce, captureRestingPage, curlReady, pageIndex]);

  // Runs after the new page has been committed by React. Resetting `turn` on
  // the next frame guarantees the live page has painted its new content before
  // the curl layer is released, which is what removes the end-of-turn flash.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      turn.value = 0;
      settling.value = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [pageIndex, settling, turn]);

  const commitTurn = useCallback((destinationIndex: number) => {
    hapticTurn();
    liftedRef.current = false;
    setLiftedFinish(null);
    setJumpTarget(null);
    setPageIndex(destinationIndex);
  }, []);

  const cancelTurn = useCallback(() => {
    settling.value = false;
    // A capture may have been skipped because this drag was in flight; now that
    // the page is at rest again, re-arm it.
    requestRecapture();
  }, [requestRecapture, settling]);

  const armDirection = useCallback((nextDirection: 1 | -1) => {
    setJumpTarget(null);
    setDirection(nextDirection);
  }, []);

  const makeEdgeGesture = useCallback(
    (edgeDirection: 1 | -1) => {
      // Resolved here on the JS thread: the withTiming callback below is a
      // worklet and cannot call back into plain JS helpers.
      const destination = wrapIndex(pageIndex + edgeDirection);

      return Gesture.Pan()
        .maxPointers(1)
        .onBegin(() => {
          if (settling.value) return;
          // Only tells React which neighbour to render underneath. The curl
          // itself does not wait on this.
          runOnJS(armDirection)(edgeDirection);
        })
        .onUpdate((event) => {
          if (settling.value) return;
          const travel = clamp(
            (event.translationX * -edgeDirection) / (pageWidth * 0.92),
            0,
            1,
          );
          turn.value = travel * -edgeDirection;
        })
        .onEnd((event) => {
          if (settling.value) return;
          const progress = Math.abs(turn.value);
          const flung = event.velocityX * -edgeDirection > 720;
          const shouldCommit = progress > 0.32 || flung;
          settling.value = true;

          turn.value = withTiming(
            shouldCommit ? -edgeDirection : 0,
            {
              duration: shouldCommit
                ? 190 + Math.round((1 - progress) * 150)
                : 150 + Math.round(progress * 170),
              easing: Easing.bezier(0.2, 0.78, 0.18, 1),
            },
            (finished) => {
              if (!finished) return;
              if (shouldCommit) {
                runOnJS(commitTurn)(destination);
              } else {
                runOnJS(cancelTurn)();
              }
            },
          );
        });
    },
    [
      armDirection,
      cancelTurn,
      commitTurn,
      pageIndex,
      pageWidth,
      settling,
      turn,
    ],
  );

  const previousGesture = useMemo(() => makeEdgeGesture(-1), [makeEdgeGesture]);
  const nextGesture = useMemo(() => makeEdgeGesture(1), [makeEdgeGesture]);

  const turnWithButton = useCallback(
    async (nextDirection: 1 | -1, destinationIndex?: number) => {
      if (settling.value) return;
      settling.value = true;

      setDirection(nextDirection);
      setJumpTarget(destinationIndex ?? null);

      // Not finger-tracked, so it is safe to wait here: make sure a snapshot
      // exists and the target page has rendered before the curl starts.
      if (curlReady.value !== 1) {
        await captureRestingPage();
      }
      await waitForFrames(2);

      const destination =
        destinationIndex ?? wrapIndex(pageIndex + nextDirection);

      turn.value = withTiming(
        -nextDirection,
        { duration: 420, easing: Easing.bezier(0.2, 0.78, 0.18, 1) },
        (finished) => {
          if (finished) runOnJS(commitTurn)(destination);
        },
      );
    },
    [captureRestingPage, commitTurn, curlReady, pageIndex, settling, turn],
  );

  const turnToPage = useCallback(
    (destinationIndex: number) => {
      if (destinationIndex === pageIndex || settling.value) return;
      const forward = wrapIndex(destinationIndex - pageIndex);
      const backward = wrapIndex(pageIndex - destinationIndex);
      void turnWithButton(forward <= backward ? 1 : -1, destinationIndex);
    },
    [pageIndex, settling, turnWithButton],
  );

  const updatePosition = useCallback(
    (id: string, position: StickerPosition) => {
      setPositions((current) => ({ ...current, [id]: position }));
      requestRecapture();
    },
    [requestRecapture],
  );

  const handleLiftChange = useCallback(
    (lifted: boolean, finish: MetalFinish) => {
      liftedRef.current = lifted;
      setLiftedFinish(lifted ? finish : null);
      // Lifting invalidates the snapshot; releasing re-warms it.
      requestRecapture();
    },
    [requestRecapture],
  );

  return (
    <View style={{ backgroundColor: colors.backdrop, flex: 1 }}>
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingTop: insets.top + 8,
        }}>
        <HeaderButton accessibilityLabel="Go back" icon="chevron.left" onPress={() => router.back()} />
        <View style={{ alignItems: 'center', gap: 3 }}>
          <Text
            style={{
              color: colors.paper,
              fontSize: 13,
              fontWeight: '900',
              letterSpacing: 2.1,
            }}>
            FIELD FOLIO
          </Text>
          <Text
            style={{
              color: colors.soft,
              fontSize: 9,
              fontVariant: ['tabular-nums'],
              fontWeight: '700',
              letterSpacing: 1.4,
            }}>
            ISSUE 04 · {String(pageIndex + 1).padStart(2, '0')}/{String(PAGE_COUNT).padStart(2, '0')}
          </Text>
        </View>
        <HeaderButton
          accessibilityLabel="Next page"
          icon="arrow.right"
          onPress={() => void turnWithButton(1)}
        />
      </View>

      <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center', paddingTop: 8 }}>
        <View style={{ height: pageHeight + 14, width: pageWidth + 14 }}>
          <View
            pointerEvents="none"
            style={{
              backgroundColor: '#B8AD94',
              borderCurve: 'continuous',
              borderRadius: 26,
              bottom: 0,
              height: pageHeight,
              left: 10,
              opacity: 0.34,
              position: 'absolute',
              transform: [{ rotate: '2.4deg' }],
              width: pageWidth,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              backgroundColor: '#D9CFB7',
              borderCurve: 'continuous',
              borderRadius: 26,
              bottom: 5,
              height: pageHeight,
              left: 3,
              opacity: 0.62,
              position: 'absolute',
              transform: [{ rotate: '-1.35deg' }],
              width: pageWidth,
            }}
          />

          {/* The page revealed underneath as the current one peels away. */}
          <View
            pointerEvents="none"
            style={{
              height: pageHeight,
              left: 0,
              position: 'absolute',
              top: 0,
              width: pageWidth,
            }}>
            <FolioPage
              height={pageHeight}
              interactive={false}
              page={folioPages[targetIndex]}
              pageIndex={targetIndex}
              positions={positions}
              shaderClock={shaderClock}
              width={pageWidth}
            />
          </View>

          {/* The real, interactive page. Hidden by a worklet while curling. */}
          <Animated.View
            collapsable={false}
            ref={pageRef}
            style={[
              {
                boxShadow: '0 18px 48px rgba(0,0,0,0.34)',
                height: pageHeight,
                left: 0,
                position: 'absolute',
                top: 0,
                width: pageWidth,
              },
              livePageStyle,
            ]}>
            <FolioPage
              height={pageHeight}
              onLiftChange={handleLiftChange}
              onStickerMove={updatePosition}
              page={folioPages[pageIndex]}
              pageIndex={pageIndex}
              positions={positions}
              shaderClock={shaderClock}
              width={pageWidth}
            />
          </Animated.View>

          {/* Stays mounted so a drag never waits on a texture upload. */}
          {pageImage ? (
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  height: pageHeight,
                  left: 0,
                  position: 'absolute',
                  top: 0,
                  width: pageWidth,
                },
                curlPageStyle,
              ]}>
              <PageCurl
                direction={direction}
                height={pageHeight}
                image={pageImage}
                progress={turn}
                width={pageWidth}
              />
            </Animated.View>
          ) : null}

          <GestureDetector gesture={previousGesture}>
            <Animated.View
              accessibilityHint="Drag right to open the previous page"
              accessibilityLabel="Previous page edge"
              accessibilityRole="adjustable"
              style={{
                bottom: 8,
                left: 0,
                position: 'absolute',
                top: 8,
                width: 34,
              }}
            />
          </GestureDetector>
          <GestureDetector gesture={nextGesture}>
            <Animated.View
              accessibilityHint="Drag left to open the next page"
              accessibilityLabel="Next page edge"
              accessibilityRole="adjustable"
              style={{
                bottom: 8,
                position: 'absolute',
                right: 0,
                top: 8,
                width: 34,
              }}
            />
          </GestureDetector>
        </View>
      </View>

      <View
        style={{
          alignItems: 'center',
          gap: 12,
          paddingBottom: insets.bottom + 12,
          paddingHorizontal: 18,
          paddingTop: 8,
        }}>
        <View style={{ flexDirection: 'row', gap: 7 }}>
          {folioPages.map((page, index) => (
            <Pressable
              accessibilityLabel={`Open ${page.title.replace('\n', ' ')}`}
              accessibilityRole="button"
              key={page.code}
              onPress={() => turnToPage(index)}
              style={{
                backgroundColor: index === pageIndex ? colors.paper : 'rgba(245,239,222,0.25)',
                borderRadius: 4,
                height: 6,
                width: index === pageIndex ? 22 : 6,
              }}
            />
          ))}
        </View>

        <View
          style={{
            alignItems: 'center',
            backgroundColor: liftedFinish ? 'rgba(245,239,222,0.15)' : 'rgba(245,239,222,0.08)',
            borderColor: colors.line,
            borderRadius: 22,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 9,
            minHeight: 42,
            paddingHorizontal: 15,
          }}>
          <SfIcon
            color={liftedFinish ? '#FFE08B' : colors.soft}
            name={liftedFinish ? 'sparkles' : 'hand.draw'}
            size={16}
          />
          <Text
            style={{
              color: liftedFinish ? colors.paper : colors.soft,
              fontSize: 10,
              fontWeight: '800',
              letterSpacing: 1.15,
            }}>
            {liftedFinish
              ? `${liftedFinish.toUpperCase()} LIFTED · MOVE TO PLACE`
              : 'DRAG AN EDGE · HOLD A STICKER · TAP FOR METAL'}
          </Text>
        </View>
      </View>
    </View>
  );
}
