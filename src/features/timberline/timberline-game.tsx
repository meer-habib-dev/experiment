import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Canvas as WebGPUCanvas, type CanvasRef, useDevice } from 'react-native-webgpu';

import checkpointAsset from '@/assets/audio/checkpoint.ogg';
import crashAsset from '@/assets/audio/crash.ogg';
import tapAsset from '@/assets/audio/tap.ogg';

import { TowerFx, type TowerPulse } from '@/features/timberline/tower-fx';
import { TowerHud } from '@/features/timberline/tower-hud';
import TowerResults from '@/features/timberline/tower-results';
import { TimberlineWorld, type TowerSnapshot } from '@/features/timberline/tower-world';

type GameState = 'loading' | 'ready' | 'running' | 'collapsing' | 'collapsed' | 'error';
type AudioBank = { collapse: AudioPlayer; impact: AudioPlayer; pull: AudioPlayer };

const INITIAL_SNAPSHOT: TowerSnapshot = {
  fallen: 0,
  moves: 0,
  score: 0,
  stability: 100,
  standing: 54,
  status: 'stable',
};

const replay = async (player: AudioPlayer, volume?: number) => {
  if (typeof volume === 'number') player.volume = volume;
  await player.seekTo(0);
  player.play();
};

const impactHaptic = (style: Haptics.ImpactFeedbackStyle) => {
  if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(style).catch(() => undefined);
};

export function TimberlineGame() {
  const { device } = useDevice();
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const canvasRef = useRef<CanvasRef>(null);
  const worldRef = useRef<TimberlineWorld | null>(null);
  const audioRef = useRef<AudioBank | null>(null);
  const soundEnabledRef = useRef(true);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinchPrevious = useRef(1);
  const pulseCounter = useRef(0);
  const lastTap = useRef({ x: 0.5, y: 0.52 });
  const lastImpactFeedback = useRef(0);
  const [gameState, setGameState] = useState<GameState>('loading');
  const [interactionReady, setInteractionReady] = useState(false);
  const [snapshot, setSnapshot] = useState<TowerSnapshot>(INITIAL_SNAPSHOT);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [pulse, setPulse] = useState<TowerPulse>({ id: 0, kind: 'reset', x: 0.5, y: 0.52 });

  const triggerPulse = useCallback((kind: TowerPulse['kind'], x = 0.5, y = 0.52) => {
    pulseCounter.current += 1;
    setPulse({ id: pulseCounter.current, kind, x, y });
  }, []);

  const showToast = useCallback((text: string) => {
    const next = { id: Date.now(), text };
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(next);
    toastTimer.current = setTimeout(() => {
      setToast((current) => (current?.id === next.id ? null : current));
    }, 900);
  }, []);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    if (!device) return;
    let mounted = true;
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false }).catch(() => undefined);
    const audio: AudioBank = {
      collapse: createAudioPlayer(crashAsset),
      impact: createAudioPlayer(tapAsset),
      pull: createAudioPlayer(checkpointAsset),
    };
    audio.impact.volume = 0.22;
    audio.pull.volume = 0.4;
    audio.collapse.volume = 0.72;
    audioRef.current = audio;

    const frame = requestAnimationFrame(() => {
      if (!mounted || !canvasRef.current) return;
      const world = new TimberlineWorld({
        onCollapse: (finalSnapshot) => {
          setInteractionReady(false);
          setSnapshot(finalSnapshot);
          setGameState('collapsing');
          triggerPulse('danger');
          if (soundEnabledRef.current) replay(audio.collapse).catch(() => undefined);
          if (process.env.EXPO_OS === 'ios') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
          }
          collapseTimer.current = setTimeout(() => {
            if (mounted) setGameState('collapsed');
          }, 1350);
        },
        onImpact: (strength) => {
          const now = performance.now();
          if (now - lastImpactFeedback.current < 190) return;
          lastImpactFeedback.current = now;
          if (soundEnabledRef.current) {
            audio.impact.setPlaybackRate(0.78 + strength * 0.42);
            replay(audio.impact, 0.12 + strength * 0.24).catch(() => undefined);
          }
          if (strength > 0.6) impactHaptic(Haptics.ImpactFeedbackStyle.Medium);
        },
        onInvalidPick: () => {
          if (process.env.EXPO_OS === 'ios') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
          }
          showToast('TOP TWO LAYERS ARE LOCKED');
        },
        onPull: (_score, layer) => {
          triggerPulse('pull', lastTap.current.x, lastTap.current.y);
          if (soundEnabledRef.current) {
            audio.pull.setPlaybackRate(0.95 + Math.random() * 0.1);
            replay(audio.pull, 0.38).catch(() => undefined);
          }
          impactHaptic(layer <= 6 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
          if (layer <= 4) showToast('RISKY FOUNDATION PULL');
        },
        onReady: () => {
          if (mounted) setGameState('ready');
        },
        onSnapshot: (next) => {
          if (mounted) setSnapshot(next);
        },
      });
      worldRef.current = world;
      world.initialize(canvasRef.current, device).catch((error: unknown) => {
        console.error(error);
        if (mounted) setGameState('error');
      });
    });

    return () => {
      mounted = false;
      cancelAnimationFrame(frame);
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
      if (interactionTimer.current) clearTimeout(interactionTimer.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      worldRef.current?.dispose();
      worldRef.current = null;
      Object.values(audio).forEach((player) => {
        player.pause();
        player.remove();
      });
      audioRef.current = null;
    };
  }, [device, showToast, triggerPulse]);

  const armInteraction = useCallback(() => {
    if (interactionTimer.current) clearTimeout(interactionTimer.current);
    setInteractionReady(false);
    interactionTimer.current = setTimeout(() => setInteractionReady(true), 450);
  }, []);

  const start = useCallback(async () => {
    setSnapshot(INITIAL_SNAPSHOT);
    setToast(null);
    triggerPulse('reset');
    worldRef.current?.start();
    setGameState('running');
    armInteraction();
    if (soundEnabledRef.current && audioRef.current) {
      await replay(audioRef.current.impact, 0.16).catch(() => undefined);
    }
    impactHaptic(Haptics.ImpactFeedbackStyle.Medium);
  }, [armInteraction, triggerPulse]);

  const restart = useCallback(async () => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    worldRef.current?.reset();
    worldRef.current?.start();
    setSnapshot(INITIAL_SNAPSHOT);
    setToast(null);
    triggerPulse('reset');
    setGameState('running');
    armInteraction();
    impactHaptic(Haptics.ImpactFeedbackStyle.Rigid);
  }, [armInteraction, triggerPulse]);

  const pickBlock = useCallback(
    (x: number, y: number) => {
      const normalizedX = Math.min(1, Math.max(0, x / Math.max(width, 1)));
      const normalizedY = Math.min(1, Math.max(0, y / Math.max(height, 1)));
      lastTap.current = { x: normalizedX, y: normalizedY };
      worldRef.current?.pickNormalized(normalizedX, normalizedY);
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
    worldRef.current?.zoom(delta);
  }, []);

  /* eslint-disable react-hooks/refs */
  const gestures = useMemo(() => {
    const tap = Gesture.Tap()
      .maxDistance(9)
      .maxDuration(300)
      .runOnJS(true)
      .onEnd((event, success) => {
        if (success) pickBlock(event.x, event.y);
      });
    const pan = Gesture.Pan()
      .minDistance(8)
      .runOnJS(true)
      .onChange((event) => orbitCamera(event.changeX, event.changeY));
    const pinch = Gesture.Pinch()
      .runOnJS(true)
      .onBegin(beginPinch)
      .onUpdate((event) => zoomCamera(event.scale));
    return Gesture.Simultaneous(Gesture.Race(tap, pan), pinch);
  }, [beginPinch, orbitCamera, pickBlock, zoomCamera]);
  /* eslint-enable react-hooks/refs */

  const handleBack = useCallback(() => router.back(), [router]);
  const handleNudge = useCallback(() => worldRef.current?.nudge(), []);
  const toggleSound = useCallback(() => {
    setSoundEnabled((value) => !value);
    impactHaptic(Haptics.ImpactFeedbackStyle.Light);
  }, []);
  const compact = height < 720 || width < 370;
  const canInteract = gameState === 'running' && interactionReady;

  return (
    <View style={styles.root}>
      <WebGPUCanvas ref={canvasRef} style={styles.canvas} />
      <TowerFx height={height} pulse={pulse} stability={snapshot.stability} width={width} />

      {canInteract ? (
        <GestureDetector gesture={gestures}>
          <Animated.View collapsable={false} style={styles.gestureSurface} />
        </GestureDetector>
      ) : null}

      {(gameState === 'running' || gameState === 'collapsing') ? (
        <TowerHud
          bottom={insets.bottom + 12}
          compact={compact}
          onBack={handleBack}
          onNudge={handleNudge}
          onToggleSound={toggleSound}
          snapshot={snapshot}
          soundEnabled={soundEnabled}
          top={insets.top + 7}
        />
      ) : null}

      {toast ? (
        <Animated.View
          entering={FadeIn.duration(120)}
          exiting={FadeOut.duration(160)}
          pointerEvents="none"
          style={styles.toast}>
          <Text style={styles.toastText}>{toast.text}</Text>
        </Animated.View>
      ) : null}

      {gameState === 'loading' ? (
        <View style={styles.loading}>
          <ActivityIndicator color="#ffc57a" size="small" />
          <Text style={styles.loadingText}>PREPARING WEBGPU WORLD</Text>
        </View>
      ) : null}

      {gameState === 'ready' ? (
        <Animated.View
          entering={FadeIn.duration(260)}
          exiting={FadeOut.duration(140)}
          style={[styles.readyOverlay, { paddingBottom: insets.bottom + 18 }]}>
          <View style={[styles.readyCard, compact && styles.readyCardCompact]}>
            <Text style={styles.eyebrow}>18 LAYERS · 54 PHYSICAL BLOCKS</Text>
            <Text style={[styles.readyTitle, compact && styles.readyTitleCompact]}>TIMBERLINE</Text>
            <Text style={styles.readyBody}>
              Tap a block to slide it completely free. Read the lean, protect the center, and leave the top two layers untouched.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={start}
              style={({ pressed }) => [styles.startButton, pressed && styles.startButtonPressed]}>
              <Text style={styles.startLabel}>STEADY YOUR HAND</Text>
            </Pressable>
            <Text style={styles.tech}>THREE.JS · NATIVE WEBGPU · CANNON · SKIA</Text>
          </View>
        </Animated.View>
      ) : null}

      {gameState === 'collapsing' ? (
        <Animated.View entering={FadeIn.duration(120)} pointerEvents="none" style={styles.collapseMessage}>
          <Text style={styles.collapseTitle}>TIMBER!</Text>
        </Animated.View>
      ) : null}

      {gameState === 'collapsed' ? (
        <Animated.View entering={FadeIn.duration(220)} style={styles.fill}>
          <TowerResults
            dom={{ scrollEnabled: false }}
            fallen={snapshot.fallen}
            moves={snapshot.moves}
            onRestart={restart}
            score={snapshot.score}
          />
        </Animated.View>
      ) : null}

      {gameState === 'error' ? (
        <View style={styles.error}>
          <Text style={styles.errorTitle}>WEBGPU BUILD REQUIRED</Text>
          <Text selectable style={styles.errorBody}>
            Run npm run ios:dev or npm run android. Native WebGPU is unavailable in Expo Go.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: '#080706', flex: 1 },
  canvas: { flex: 1 },
  fill: { ...StyleSheet.absoluteFill },
  gestureSurface: { ...StyleSheet.absoluteFill, zIndex: 2 },
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    backgroundColor: '#080706',
    gap: 14,
    justifyContent: 'center',
  },
  loadingText: { color: '#ffc57a', fontSize: 10, fontWeight: '900', letterSpacing: 2.2 },
  readyOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,.12)',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
  },
  readyCard: {
    backgroundColor: 'rgba(16,12,9,.94)',
    borderColor: 'rgba(255,255,255,.11)',
    borderCurve: 'continuous',
    borderRadius: 28,
    borderWidth: 1,
    gap: 12,
    maxWidth: 520,
    padding: 20,
    width: '100%',
  },
  readyCardCompact: { gap: 8, padding: 16 },
  eyebrow: { color: '#ffad60', fontSize: 8, fontWeight: '900', letterSpacing: 2.1 },
  readyTitle: { color: '#fff6e8', fontSize: 38, fontWeight: '900', letterSpacing: -1.5 },
  readyTitleCompact: { fontSize: 31 },
  readyBody: { color: 'rgba(255,255,255,.58)', fontSize: 13, lineHeight: 19 },
  startButton: {
    alignItems: 'center',
    backgroundColor: '#ffc477',
    borderCurve: 'continuous',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  startButtonPressed: { opacity: 0.75, transform: [{ scale: 0.985 }] },
  startLabel: { color: '#281509', fontSize: 14, fontWeight: '900', letterSpacing: 0.4 },
  tech: { color: 'rgba(255,255,255,.25)', fontSize: 7, fontWeight: '800', letterSpacing: 1.15, textAlign: 'center' },
  toast: {
    alignSelf: 'center',
    backgroundColor: 'rgba(16,12,9,.9)',
    borderColor: 'rgba(255,185,105,.25)',
    borderCurve: 'continuous',
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 9,
    position: 'absolute',
    top: '43%',
  },
  toastText: { color: '#ffd092', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  collapseMessage: { left: 0, position: 'absolute', right: 0, top: '46%' },
  collapseTitle: { color: '#fff2d7', fontSize: 48, fontWeight: '900', letterSpacing: -2, textAlign: 'center' },
  error: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    backgroundColor: '#080706',
    gap: 10,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: { color: '#fff', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  errorBody: { color: 'rgba(255,255,255,.56)', fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
