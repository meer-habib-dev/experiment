import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Canvas as WebGPUCanvas, type CanvasRef, useDevice } from 'react-native-webgpu';

import ArenaCheckout from '@/features/halo-arena/arena-checkout';
import { ArenaFx, type ArenaPulse } from '@/features/halo-arena/arena-fx';
import {
  type ArenaSeat,
  type ArenaSection,
  ArenaWorld,
} from '@/features/halo-arena/arena-world';

type ExperienceState = 'error' | 'exploring' | 'loading' | 'ready';

const haptic = (style: Haptics.ImpactFeedbackStyle) => {
  if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(style).catch(() => undefined);
};

export function ArenaBookingExperience() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const { device } = useDevice();
  const canvasRef = useRef<CanvasRef>(null);
  const worldRef = useRef<ArenaWorld | null>(null);
  const pinchPrevious = useRef(1);
  const lastTap = useRef({ x: 0.5, y: 0.5 });
  const pulseCounter = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [checkout, setCheckout] = useState(false);
  const [experienceState, setExperienceState] = useState<ExperienceState>('loading');
  const [focusedSection, setFocusedSection] = useState<ArenaSection | null>(null);
  const [pulse, setPulse] = useState<ArenaPulse>({ id: 0, kind: 'idle', x: 0.5, y: 0.5 });
  const [activeSeat, setActiveSeat] = useState<ArenaSeat | null>(null);
  const [seatPreview, setSeatPreview] = useState(false);
  const [selected, setSelected] = useState<ArenaSeat[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const total = selected.reduce((sum, seat) => sum + seat.price, 0);
  const compact = height < 730 || width < 370;

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 1650);
  }, []);

  const triggerPulse = useCallback((kind: ArenaPulse['kind']) => {
    pulseCounter.current += 1;
    setPulse({ id: pulseCounter.current, kind, x: lastTap.current.x, y: lastTap.current.y });
  }, []);

  useEffect(() => {
    if (!device) return;
    let mounted = true;
    const frame = requestAnimationFrame(() => {
      if (!canvasRef.current || !mounted) return;
      const world = new ArenaWorld({
        onLimit: () => {
          showToast('MAXIMUM 6 SEATS PER BOOKING');
          triggerPulse('unavailable');
          if (process.env.EXPO_OS === 'ios') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
          }
        },
        onReady: () => {
          if (mounted) setExperienceState('ready');
        },
        onSeatFocus: (seat) => {
          if (!mounted) return;
          setActiveSeat(seat);
          if (!seat) setSeatPreview(false);
        },
        onSeatPulse: (kind) => {
          triggerPulse(kind);
          if (kind === 'unavailable') {
            showToast('THAT SEAT IS ALREADY RESERVED');
            if (process.env.EXPO_OS === 'ios') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
            }
          } else {
            haptic(kind === 'added' ? Haptics.ImpactFeedbackStyle.Rigid : Haptics.ImpactFeedbackStyle.Light);
          }
        },
        onSectionFocus: (section) => {
          if (!mounted) return;
          setFocusedSection(section);
          setSeatPreview(false);
          setActiveSeat((current) =>
            section && current?.section === section.section ? current : null,
          );
          if (section) haptic(Haptics.ImpactFeedbackStyle.Medium);
        },
        onSelectionChange: (seats) => {
          if (!mounted) return;
          setSelected(seats);
          setActiveSeat((current) =>
            current && seats.some((seat) => seat.id === current.id)
              ? current
              : (seats.at(-1) ?? null),
          );
        },
      });
      worldRef.current = world;
      world.initialize(canvasRef.current, device).catch((error: unknown) => {
        console.error(error);
        if (mounted) setExperienceState('error');
      });
    });

    return () => {
      mounted = false;
      cancelAnimationFrame(frame);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      worldRef.current?.dispose();
      worldRef.current = null;
    };
  }, [device, showToast, triggerPulse]);

  const enterArena = useCallback(() => {
    worldRef.current?.start();
    setExperienceState('exploring');
    haptic(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const pickSeat = useCallback(
    (x: number, y: number) => {
      lastTap.current = {
        x: Math.min(1, Math.max(0, x / Math.max(width, 1))),
        y: Math.min(1, Math.max(0, y / Math.max(height, 1))),
      };
      worldRef.current?.pickNormalized(lastTap.current.x, lastTap.current.y);
    },
    [height, width],
  );

  const orbitCamera = useCallback((x: number, y: number) => {
    worldRef.current?.orbit(x, y);
  }, []);

  const beginPinch = useCallback(() => {
    pinchPrevious.current = 1;
  }, []);

  const zoomCamera = useCallback((scale: number) => {
    const delta = scale / Math.max(pinchPrevious.current, 0.001);
    pinchPrevious.current = scale;
    worldRef.current?.zoom(Math.pow(delta, 0.82));
  }, []);

  const focusSectionAt = useCallback(
    (x: number, y: number) => {
      const normalizedX = Math.min(1, Math.max(0, x / Math.max(width, 1)));
      const normalizedY = Math.min(1, Math.max(0, y / Math.max(height, 1)));
      worldRef.current?.focusSectionAtNormalized(normalizedX, normalizedY);
    },
    [height, width],
  );

  const stepZoom = useCallback((direction: 'in' | 'out') => {
    worldRef.current?.zoom(direction === 'in' ? 1.24 : 0.81);
    haptic(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  /* Gesture callbacks intentionally capture imperative camera and canvas refs. */
  /* eslint-disable react-hooks/refs */
  const gestures = useMemo(() => {
    const singleTap = Gesture.Tap()
      .maxDistance(9)
      .maxDuration(300)
      .runOnJS(true)
      .onEnd((event, success) => {
        if (success) pickSeat(event.x, event.y);
      });
    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .maxDelay(260)
      .maxDistance(18)
      .runOnJS(true)
      .onEnd((event, success) => {
        if (success) focusSectionAt(event.x, event.y);
      });
    const taps = Gesture.Exclusive(doubleTap, singleTap);
    const pan = Gesture.Pan()
      .minDistance(8)
      .runOnJS(true)
      .onChange((event) => orbitCamera(event.changeX, event.changeY));
    const pinch = Gesture.Pinch()
      .runOnJS(true)
      .onBegin(beginPinch)
      .onUpdate((event) => zoomCamera(event.scale));
    return Gesture.Simultaneous(Gesture.Race(taps, pan), pinch);
  }, [beginPinch, focusSectionAt, orbitCamera, pickSeat, zoomCamera]);
  /* eslint-enable react-hooks/refs */

  const openCheckout = useCallback(() => {
    if (selected.length === 0) {
      showToast('TAP AN AVAILABLE SEAT FIRST');
      return;
    }
    setCheckout(true);
    haptic(Haptics.ImpactFeedbackStyle.Medium);
  }, [selected.length, showToast]);

  const closeCheckout = useCallback(async () => {
    setCheckout(false);
  }, []);

  const confirmBooking = useCallback(async () => {
    worldRef.current?.confirmSelection();
    if (process.env.EXPO_OS === 'ios') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }
  }, []);

  const toggleSeatPreview = useCallback(() => {
    if (!activeSeat) return;
    if (seatPreview) {
      worldRef.current?.resetView();
      setSeatPreview(false);
    } else {
      worldRef.current?.previewSeat(activeSeat.id);
      setSeatPreview(true);
    }
    haptic(Haptics.ImpactFeedbackStyle.Medium);
  }, [activeSeat, seatPreview]);

  return (
    <View style={styles.root}>
      <WebGPUCanvas ref={canvasRef} style={styles.canvas} />
      <ArenaFx height={height} pulse={pulse} selected={selected.length} width={width} />

      {experienceState === 'exploring' && !checkout ? (
        <GestureDetector gesture={gestures}>
          <Animated.View collapsable={false} style={styles.gestureSurface} />
        </GestureDetector>
      ) : null}

      {experienceState === 'exploring' ? (
        <>
          <View pointerEvents="box-none" style={[styles.topArea, { paddingTop: insets.top + 7 }]}>
            <Pressable
              accessibilityLabel="Go back"
              hitSlop={10}
              onPress={() => router.back()}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
              <Text style={styles.back}>‹</Text>
            </Pressable>
            <BlurView intensity={46} style={styles.eventPill} tint="dark">
              <View style={styles.liveRow}>
                <View style={styles.liveDot} />
                <Text style={styles.eyebrow}>LIVE INVENTORY</Text>
              </View>
              <Text selectable style={styles.eventTitle}>AURORA FINAL</Text>
              <Text selectable style={styles.eventMeta}>SEP 14 · NOVA PARK</Text>
            </BlurView>
            <Pressable
              accessibilityLabel="Reset arena view"
              hitSlop={10}
              onPress={() => {
                worldRef.current?.resetView();
                setSeatPreview(false);
                haptic(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
              <Text style={styles.orbitIcon}>◎</Text>
            </Pressable>
          </View>

          <View pointerEvents="none" style={[styles.legend, { top: insets.top + 88 }]}>
            <LegendItem color="#d9faf4" label="Available" />
            <LegendItem color="#63777f" label="Reserved" />
            <LegendItem color="#d8ff36" label="Selected" />
          </View>

          <BlurView intensity={48} style={[styles.zoomControls, { top: insets.top + 88 }]} tint="dark">
            <Pressable
              accessibilityLabel="Zoom in"
              accessibilityRole="button"
              hitSlop={6}
              onPress={() => stepZoom('in')}
              style={({ pressed }) => [styles.zoomButton, pressed && styles.zoomButtonPressed]}>
              <Text style={styles.zoomGlyph}>+</Text>
            </Pressable>
            <View style={styles.zoomDivider} />
            <Pressable
              accessibilityLabel="Zoom out"
              accessibilityRole="button"
              hitSlop={6}
              onPress={() => stepZoom('out')}
              style={({ pressed }) => [styles.zoomButton, pressed && styles.zoomButtonPressed]}>
              <Text style={styles.zoomGlyph}>−</Text>
            </Pressable>
          </BlurView>

          <Animated.View
            layout={LinearTransition.springify().damping(18)}
            style={[styles.bottomArea, { paddingBottom: Math.max(insets.bottom, 10) + 4 }]}>
            <BlurView intensity={64} style={styles.bookingCard} tint="dark">
              <View style={styles.bookingHeader}>
                <View>
                  <Text style={styles.selectedLabel}>SELECTED</Text>
                  <Text selectable style={styles.selectedCount}>
                    {selected.length} seat{selected.length === 1 ? '' : 's'}
                  </Text>
                </View>
                <View style={styles.headerRight}>
                  {selected.length > 0 ? (
                    <Pressable
                      accessibilityLabel="Clear selected seats"
                      hitSlop={8}
                      onPress={() => {
                        worldRef.current?.clearSelection();
                        haptic(Haptics.ImpactFeedbackStyle.Light);
                      }}>
                      <Text style={styles.clearLabel}>CLEAR</Text>
                    </Pressable>
                  ) : null}
                  <View style={styles.totalArea}>
                    <Text style={styles.selectedLabel}>TOTAL</Text>
                    <Text selectable style={styles.total}>${total.toLocaleString()}</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.seatStrip, compact && styles.seatStripCompact]}>
                {activeSeat ? (
                  <Animated.View
                    entering={FadeInDown.duration(220).springify().damping(18)}
                    key={activeSeat.id}
                    layout={LinearTransition}
                    style={styles.seatDetail}>
                    <View style={styles.seatBadge}>
                      <Text style={styles.seatBadgeRow}>ROW {activeSeat.row}</Text>
                      <Text style={styles.seatBadgeName}>{activeSeat.seat}</Text>
                    </View>
                    <View style={styles.seatCopy}>
                      <Text style={styles.seatDetailTitle}>SECTION {activeSeat.section}</Text>
                      <Text style={styles.seatDetailMeta}>{activeSeat.tier} · ${activeSeat.price}</Text>
                    </View>
                    <View style={styles.seatStatus}>
                      <View style={styles.selectedDot} />
                      <Text style={styles.seatStatusText}>
                        {selected.length > 1 ? `+${selected.length - 1} MORE` : 'SELECTED'}
                      </Text>
                    </View>
                  </Animated.View>
                ) : focusedSection ? (
                  <Animated.View
                    entering={FadeInDown.duration(220).springify().damping(18)}
                    key={`section-${focusedSection.section}`}
                    layout={LinearTransition}
                    style={styles.sectionDetail}>
                    <View style={styles.sectionBadge}>
                      <Text style={styles.sectionBadgeLabel}>SECTION</Text>
                      <Text style={styles.sectionBadgeNumber}>{focusedSection.section}</Text>
                    </View>
                    <View style={styles.sectionCopy}>
                      <Text style={styles.sectionTitle}>SECTION DETAIL</Text>
                      <Text style={styles.sectionMeta}>
                        {focusedSection.available} available · {focusedSection.reserved} reserved
                      </Text>
                    </View>
                    <View style={styles.sectionPrice}>
                      <Text style={styles.sectionPriceLabel}>FROM</Text>
                      <Text style={styles.sectionPriceValue}>${focusedSection.fromPrice}</Text>
                    </View>
                    <Pressable
                      accessibilityLabel="Return to full stadium map"
                      hitSlop={6}
                      onPress={() => worldRef.current?.resetView()}
                      style={({ pressed }) => [styles.sectionClose, pressed && styles.pressed]}>
                      <Text style={styles.sectionCloseText}>×</Text>
                    </Pressable>
                  </Animated.View>
                ) : (
                  <Animated.View entering={FadeIn} style={styles.hintRow}>
                    <View style={styles.gestureHint}><Text style={styles.gestureGlyph}>↻</Text></View>
                    <View style={styles.hintCopy}>
                      <Text style={styles.hintTitle}>Tap or double-tap a stadium section</Text>
                      <Text style={styles.hintBody}>DRAG ORBIT · PINCH ZOOM · DOUBLE-TAP DETAIL</Text>
                    </View>
                  </Animated.View>
                )}
              </View>

              <View style={styles.actionRow}>
                {activeSeat ? (
                  <Pressable
                    accessibilityLabel={seatPreview ? 'Back to arena map' : 'View from selected seat'}
                    onPress={toggleSeatPreview}
                    style={({ pressed }) => [styles.viewButton, seatPreview && styles.viewButtonActive, pressed && styles.pressed]}>
                    <Text style={styles.viewGlyph}>{seatPreview ? '⌁' : '◉'}</Text>
                    <Text style={styles.viewLabel}>{seatPreview ? 'MAP' : 'VIEW'}</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={openCheckout}
                  style={({ pressed }) => [
                    styles.reviewButton,
                    selected.length === 0 && styles.reviewButtonEmpty,
                    pressed && styles.reviewButtonPressed,
                  ]}>
                  <Text style={[styles.reviewLabel, selected.length === 0 && styles.reviewLabelEmpty]}>
                    {selected.length === 0
                      ? focusedSection
                        ? 'SELECT AN AVAILABLE SEAT'
                        : 'CHOOSE A SECTION'
                      : `REVIEW ${selected.length} SEAT${selected.length === 1 ? '' : 'S'}`}
                  </Text>
                  <Text style={[styles.reviewArrow, selected.length === 0 && styles.reviewLabelEmpty]}>→</Text>
                </Pressable>
              </View>
            </BlurView>
          </Animated.View>
        </>
      ) : null}

      {toast ? (
        <Animated.View
          entering={FadeInDown.duration(170)}
          exiting={FadeOut.duration(150)}
          pointerEvents="none"
          style={[styles.toast, { top: insets.top + 150 }]}>
          <Text selectable style={styles.toastText}>{toast}</Text>
        </Animated.View>
      ) : null}

      {experienceState === 'loading' ? (
        <View style={styles.loading}>
          <ActivityIndicator color="#b9fff3" size="small" />
          <Text style={styles.loadingTitle}>OPENING NOVA PARK</Text>
          <Text style={styles.loadingMeta}>BUILDING 1,854 LIVE SEATS</Text>
        </View>
      ) : null}

      {experienceState === 'ready' ? (
        <Animated.View
          entering={FadeIn.duration(360)}
          exiting={FadeOut.duration(180)}
          style={[styles.ready, { paddingBottom: insets.bottom + 22, paddingTop: insets.top + 32 }]}>
          <View pointerEvents="none" style={styles.readyScrim} />
          <View style={styles.readyTop}>
            <Text style={styles.readyEyebrow}>NOVA PARK · 360° LIVE MAP</Text>
            <Text selectable style={[styles.readyTitle, compact && styles.readyTitleCompact]}>THE WHOLE{`\n`}ARENA, ALIVE.</Text>
            <Text selectable style={styles.readyBody}>
              Orbit every tier, dive into any section, and reserve the exact view you want in a fully reactive 3D stadium.
            </Text>
          </View>
          <View style={styles.readyBottom}>
            <View style={styles.techRow}>
              <Text style={styles.tech}>THREE.JS</Text><View style={styles.techDot} />
              <Text style={styles.tech}>NATIVE WEBGPU</Text><View style={styles.techDot} />
              <Text style={styles.tech}>SKIA</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={enterArena}
              style={({ pressed }) => [styles.enterButton, pressed && styles.enterButtonPressed]}>
              <Text style={styles.enterLabel}>ENTER THE ARENA</Text>
              <Text style={styles.enterArrow}>↗</Text>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}

      {checkout ? (
        <Animated.View entering={FadeIn.duration(170)} style={styles.checkout}>
          <ArenaCheckout
            dom={{ contentInsetAdjustmentBehavior: 'never', scrollEnabled: false }}
            onClose={closeCheckout}
            onConfirm={confirmBooking}
            seats={selected}
            total={total}
          />
        </Animated.View>
      ) : null}

      {experienceState === 'error' ? (
        <View style={styles.error}>
          <Text style={styles.errorTitle}>NATIVE WEBGPU BUILD REQUIRED</Text>
          <Text selectable style={styles.errorBody}>
            Run npm run ios:dev or npm run android. This stadium uses native WebGPU and is unavailable in Expo Go.
          </Text>
          <Pressable onPress={() => router.back()} style={styles.errorButton}>
            <Text style={styles.errorButtonLabel}>BACK TO NATIVE LAB</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendRow}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: '#030b12', flex: 1 },
  canvas: { flex: 1 },
  gestureSurface: { ...StyleSheet.absoluteFill, zIndex: 2 },
  topArea: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'space-between',
    left: 0,
    paddingHorizontal: 13,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 4,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(4,13,19,.68)',
    borderColor: 'rgba(220,255,248,.15)',
    borderCurve: 'continuous',
    borderRadius: 17,
    borderWidth: 1,
    height: 45,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 45,
  },
  pressed: { opacity: 0.55, transform: [{ scale: 0.95 }] },
  back: { color: '#effffb', fontSize: 30, fontWeight: '500', marginTop: -3 },
  orbitIcon: { color: '#c8fff6', fontSize: 23, fontWeight: '500' },
  eventPill: {
    alignItems: 'center',
    borderColor: 'rgba(220,255,248,.13)',
    borderCurve: 'continuous',
    borderRadius: 19,
    borderWidth: 1,
    flex: 1,
    maxWidth: 260,
    overflow: 'hidden',
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
  liveRow: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  liveDot: { backgroundColor: '#d8ff36', borderRadius: 4, height: 5, width: 5 },
  eyebrow: { color: 'rgba(197,255,246,.53)', fontSize: 7, fontWeight: '900', letterSpacing: 1.25 },
  eventTitle: { color: '#f4fffc', fontSize: 13, fontWeight: '900', letterSpacing: 0.8, marginTop: 2 },
  eventMeta: { color: 'rgba(255,255,255,.38)', fontSize: 7, fontWeight: '800', letterSpacing: 1.15, marginTop: 1 },
  legend: {
    backgroundColor: 'rgba(3,12,18,.63)',
    borderColor: 'rgba(225,255,250,.1)',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 9,
    position: 'absolute',
    right: 13,
    zIndex: 4,
  },
  legendRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  legendDot: { borderRadius: 3, height: 6, width: 6 },
  legendLabel: { color: 'rgba(240,255,252,.55)', fontSize: 8, fontWeight: '700' },
  zoomControls: {
    borderColor: 'rgba(225,255,250,.12)',
    borderCurve: 'continuous',
    borderRadius: 15,
    borderWidth: 1,
    left: 13,
    overflow: 'hidden',
    position: 'absolute',
    zIndex: 4,
  },
  zoomButton: { alignItems: 'center', height: 38, justifyContent: 'center', width: 38 },
  zoomButtonPressed: { backgroundColor: 'rgba(216,255,54,.12)' },
  zoomDivider: { alignSelf: 'center', backgroundColor: 'rgba(255,255,255,.1)', height: StyleSheet.hairlineWidth, width: 20 },
  zoomGlyph: { color: '#dcfff8', fontSize: 22, fontWeight: '500', lineHeight: 24 },
  bottomArea: { bottom: 0, left: 0, paddingHorizontal: 10, position: 'absolute', right: 0, zIndex: 4 },
  bookingCard: {
    alignSelf: 'center',
    borderColor: 'rgba(216,255,246,.14)',
    borderCurve: 'continuous',
    borderRadius: 24,
    borderWidth: 1,
    gap: 8,
    maxWidth: 600,
    overflow: 'hidden',
    padding: 12,
    width: '100%',
  },
  bookingHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  headerRight: { alignItems: 'center', flexDirection: 'row', gap: 13 },
  selectedLabel: { color: 'rgba(255,255,255,.37)', fontSize: 7, fontWeight: '900', letterSpacing: 1.25 },
  selectedCount: { color: '#f5fffc', fontSize: 17, fontVariant: ['tabular-nums'], fontWeight: '800', marginTop: 1 },
  totalArea: { alignItems: 'flex-end' },
  total: { color: '#d8ff36', fontSize: 19, fontVariant: ['tabular-nums'], fontWeight: '900', marginTop: 1 },
  seatStrip: { alignItems: 'center', flexDirection: 'row', minHeight: 48 },
  seatStripCompact: { minHeight: 44 },
  hintRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  gestureHint: { alignItems: 'center', backgroundColor: 'rgba(139,255,236,.08)', borderRadius: 13, height: 38, justifyContent: 'center', width: 38 },
  gestureGlyph: { color: '#9ef8e9', fontSize: 20 },
  hintCopy: { flex: 1, gap: 2 },
  hintTitle: { color: 'rgba(246,255,253,.78)', fontSize: 11, fontWeight: '800' },
  hintBody: { color: 'rgba(255,255,255,.3)', fontSize: 6.5, fontWeight: '800', letterSpacing: 0.8 },
  seatDetail: {
    alignItems: 'center',
    backgroundColor: 'rgba(232,255,250,.055)',
    borderColor: 'rgba(232,255,250,.1)',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 48,
    padding: 5,
    paddingRight: 11,
  },
  seatBadge: { alignItems: 'center', backgroundColor: '#d8ff36', borderCurve: 'continuous', borderRadius: 12, height: 38, justifyContent: 'center', width: 42 },
  seatBadgeRow: { color: 'rgba(13,27,10,.52)', fontSize: 6, fontWeight: '900', letterSpacing: 0.6 },
  seatBadgeName: { color: '#101d0c', fontSize: 16, fontVariant: ['tabular-nums'], fontWeight: '900', lineHeight: 18 },
  seatCopy: { flex: 1, gap: 2 },
  seatDetailTitle: { color: '#f0fffb', fontSize: 11, fontWeight: '900', letterSpacing: 0.55 },
  seatDetailMeta: { color: 'rgba(232,255,250,.42)', fontSize: 8, fontWeight: '700' },
  seatStatus: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  selectedDot: { backgroundColor: '#d8ff36', borderRadius: 3, height: 5, width: 5 },
  seatStatusText: { color: 'rgba(225,255,116,.68)', fontSize: 6.5, fontWeight: '900', letterSpacing: 0.75 },
  sectionDetail: {
    alignItems: 'center',
    backgroundColor: 'rgba(139,255,236,.065)',
    borderColor: 'rgba(139,255,236,.15)',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 9,
    minHeight: 48,
    padding: 5,
    paddingRight: 7,
  },
  sectionBadge: {
    alignItems: 'center',
    backgroundColor: '#9ef8e9',
    borderCurve: 'continuous',
    borderRadius: 12,
    height: 38,
    justifyContent: 'center',
    width: 48,
  },
  sectionBadgeLabel: { color: 'rgba(8,29,28,.54)', fontSize: 5.5, fontWeight: '900', letterSpacing: 0.7 },
  sectionBadgeNumber: { color: '#0a211e', fontSize: 15, fontVariant: ['tabular-nums'], fontWeight: '900', lineHeight: 17 },
  sectionCopy: { flex: 1, gap: 2 },
  sectionTitle: { color: '#effffb', fontSize: 10.5, fontWeight: '900', letterSpacing: 0.55 },
  sectionMeta: { color: 'rgba(232,255,250,.42)', fontSize: 7.5, fontWeight: '700' },
  sectionPrice: { alignItems: 'flex-end', gap: 1 },
  sectionPriceLabel: { color: 'rgba(232,255,250,.32)', fontSize: 5.5, fontWeight: '900', letterSpacing: 0.8 },
  sectionPriceValue: { color: '#d8ff36', fontSize: 13, fontVariant: ['tabular-nums'], fontWeight: '900' },
  sectionClose: {
    alignItems: 'center',
    borderColor: 'rgba(232,255,250,.12)',
    borderRadius: 12,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    marginLeft: 1,
    width: 30,
  },
  sectionCloseText: { color: 'rgba(238,255,251,.66)', fontSize: 19, fontWeight: '500', lineHeight: 21 },
  actionRow: { flexDirection: 'row', gap: 8 },
  clearLabel: { color: 'rgba(255,255,255,.42)', fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  viewButton: { alignItems: 'center', borderColor: 'rgba(185,255,244,.16)', borderCurve: 'continuous', borderRadius: 15, borderWidth: 1, flexDirection: 'row', gap: 5, justifyContent: 'center', minHeight: 46, width: 72 },
  viewButtonActive: { backgroundColor: 'rgba(139,255,236,.1)', borderColor: 'rgba(139,255,236,.28)' },
  viewGlyph: { color: '#aefbef', fontSize: 13 },
  viewLabel: { color: '#bffff4', fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  reviewButton: {
    alignItems: 'center',
    backgroundColor: '#d8ff36',
    borderCurve: 'continuous',
    borderRadius: 17,
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 46,
    paddingHorizontal: 17,
  },
  reviewButtonEmpty: { backgroundColor: 'rgba(211,255,245,.1)' },
  reviewButtonPressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  reviewLabel: { color: '#12200d', fontSize: 10, fontWeight: '900', letterSpacing: 0.55 },
  reviewLabelEmpty: { color: 'rgba(231,255,250,.48)' },
  reviewArrow: { color: '#12200d', fontSize: 18, fontWeight: '700' },
  toast: {
    alignSelf: 'center',
    backgroundColor: 'rgba(12,22,28,.9)',
    borderColor: 'rgba(255,124,139,.24)',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    position: 'absolute',
    zIndex: 6,
  },
  toastText: { color: '#ffb3bd', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', backgroundColor: '#030b12', gap: 9, justifyContent: 'center' },
  loadingTitle: { color: '#edfffb', fontSize: 12, fontWeight: '900', letterSpacing: 1.5, marginTop: 6 },
  loadingMeta: { color: 'rgba(181,255,243,.34)', fontSize: 7, fontWeight: '800', letterSpacing: 1.3 },
  ready: { ...StyleSheet.absoluteFill, justifyContent: 'space-between', paddingHorizontal: 21 },
  readyScrim: { backgroundColor: 'rgba(2,10,15,.48)', height: '43%', left: 0, position: 'absolute', right: 0, top: 0 },
  readyTop: { marginTop: '12%' },
  readyEyebrow: { color: '#9effef', fontSize: 8, fontWeight: '900', letterSpacing: 2.1 },
  readyTitle: { color: '#f5fffc', fontSize: 48, fontWeight: '900', letterSpacing: -2.8, lineHeight: 45, marginTop: 10, textShadowColor: 'rgba(70,255,220,.18)', textShadowOffset: { height: 8, width: 0 }, textShadowRadius: 28 },
  readyTitleCompact: { fontSize: 42, lineHeight: 40 },
  readyBody: { color: 'rgba(237,255,251,.76)', fontSize: 13, lineHeight: 19, marginTop: 15, maxWidth: 340 },
  readyBottom: { gap: 13 },
  techRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  tech: { color: 'rgba(197,255,245,.43)', fontSize: 7, fontWeight: '900', letterSpacing: 1.25 },
  techDot: { backgroundColor: '#d8ff36', borderRadius: 2, height: 3, width: 3 },
  enterButton: { alignItems: 'center', backgroundColor: '#d8ff36', borderCurve: 'continuous', borderRadius: 21, flexDirection: 'row', justifyContent: 'space-between', minHeight: 58, paddingHorizontal: 19 },
  enterButtonPressed: { opacity: 0.75, transform: [{ scale: 0.985 }] },
  enterLabel: { color: '#10200d', fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  enterArrow: { color: '#10200d', fontSize: 22, fontWeight: '800' },
  checkout: { ...StyleSheet.absoluteFill, zIndex: 10 },
  error: { ...StyleSheet.absoluteFill, alignItems: 'center', backgroundColor: '#030b12', gap: 12, justifyContent: 'center', padding: 28 },
  errorTitle: { color: '#d8ff36', fontSize: 13, fontWeight: '900', letterSpacing: 1.3, textAlign: 'center' },
  errorBody: { color: 'rgba(235,255,251,.56)', fontSize: 12, lineHeight: 18, maxWidth: 360, textAlign: 'center' },
  errorButton: { borderColor: 'rgba(216,255,54,.28)', borderRadius: 16, borderWidth: 1, marginTop: 8, paddingHorizontal: 18, paddingVertical: 13 },
  errorButtonLabel: { color: '#d8ff36', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
});
