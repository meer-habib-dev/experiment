import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { Canvas as WebGPUCanvas, type CanvasRef, useDevice } from 'react-native-webgpu';

import checkpointAsset from '@/assets/audio/checkpoint.ogg';
import coinAsset from '@/assets/audio/coin.ogg';
import crashAsset from '@/assets/audio/crash.ogg';
import engineAsset from '@/assets/audio/engine.ogg';
import tapAsset from '@/assets/audio/tap.ogg';
import turboAsset from '@/assets/audio/turbo.ogg';

import RaceResults from '@/features/volcano-drive/race-results';
import { type FxKind, SpeedFx } from '@/features/volcano-drive/speed-fx';
import { type PickupKind, VolcanoDriveWorld } from '@/features/volcano-drive/game-world';
import { Pressable, Text, View } from '@/tw';

type GameState = 'loading' | 'ready' | 'running' | 'crashing' | 'crashed' | 'error';
type BannerTone = 'danger' | 'green' | 'yellow';
type Banner = { id: number; subtitle?: string; title: string; tone: BannerTone };
type FxPulse = { id: number; kind: FxKind };
type AudioBank = Record<
  'checkpoint' | 'coin' | 'crash' | 'engine' | 'tap' | 'turbo' | 'wind',
  AudioPlayer
>;

const replay = async (player: AudioPlayer) => {
  await player.seekTo(0);
  player.play();
};

const impactHaptic = (style: Haptics.ImpactFeedbackStyle) => {
  if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(style).catch(() => undefined);
};

export function VolcanoDriveGame() {
  const { height, width } = useWindowDimensions();
  const { device } = useDevice();
  const canvasRef = useRef<CanvasRef>(null);
  const audioRef = useRef<AudioBank | null>(null);
  const worldRef = useRef<VolcanoDriveWorld | null>(null);
  const fxCounter = useRef(0);
  const steering = useSharedValue(0);
  const scoreScale = useSharedValue(1);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [fxPulse, setFxPulse] = useState<FxPulse>({ id: 0, kind: 'drive' });
  const [gameState, setGameState] = useState<GameState>('loading');
  const [level, setLevel] = useState(1);
  const [magnet, setMagnet] = useState(false);
  const [score, setScore] = useState(0);
  const [turbo, setTurbo] = useState(false);

  const scoreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scoreScale.value }],
  }));

  const pulseScore = useCallback(() => {
    // Reanimated shared values are intentionally mutable animation controls.
    // eslint-disable-next-line react-hooks/immutability
    scoreScale.value = withSequence(
      withTiming(1.22, { duration: 80 }),
      withSpring(1, { damping: 9, stiffness: 260 }),
    );
  }, [scoreScale]);

  const triggerFx = useCallback((kind: FxKind) => {
    fxCounter.current += 1;
    setFxPulse({ id: fxCounter.current, kind });
  }, []);

  const showBanner = useCallback(
    (title: string, subtitle?: string, tone: BannerTone = 'green', duration = 1700) => {
      const next = { id: Date.now(), subtitle, title, tone } satisfies Banner;
      setBanner(next);
      setTimeout(() => setBanner((current) => (current?.id === next.id ? null : current)), duration);
    },
    [],
  );

  useEffect(() => {
    if (!device) return;

    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false }).catch(
      () => undefined,
    );
    const audio: AudioBank = {
      checkpoint: createAudioPlayer(checkpointAsset),
      coin: createAudioPlayer(coinAsset),
      crash: createAudioPlayer(crashAsset),
      engine: createAudioPlayer(engineAsset),
      tap: createAudioPlayer(tapAsset),
      turbo: createAudioPlayer(turboAsset),
      wind: createAudioPlayer(engineAsset),
    };
    audio.engine.loop = true;
    audio.engine.volume = 0.16;
    audio.engine.setPlaybackRate(0.88);
    audio.wind.loop = true;
    audio.wind.volume = 0.035;
    audio.wind.setPlaybackRate(1.72);
    audioRef.current = audio;

    let mounted = true;
    const frame = requestAnimationFrame(() => {
      if (!canvasRef.current || !mounted) return;
      const world = new VolcanoDriveWorld(
        {
          onCheckpoint: (nextLevel, bonus) => {
            setLevel(nextLevel);
            showBanner('CHECKPOINT', `+$${bonus} · SPEED UP`, 'green', 2300);
            triggerFx('checkpoint');
            pulseScore();
            audio.engine.setPlaybackRate(0.9 + nextLevel * 0.035);
            replay(audio.checkpoint).catch(() => undefined);
            if (process.env.EXPO_OS === 'ios') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
                () => undefined,
              );
              setTimeout(() => impactHaptic(Haptics.ImpactFeedbackStyle.Rigid), 120);
            }
          },
          onCrashSettled: (finalScore) => {
            setScore(finalScore);
            setGameState('crashed');
          },
          onCrashStart: (finalScore) => {
            setScore(finalScore);
            setGameState('crashing');
            triggerFx('crash');
            audio.engine.pause();
            audio.wind.pause();
            replay(audio.crash).catch(() => undefined);
            if (process.env.EXPO_OS === 'ios') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
                () => undefined,
              );
              setTimeout(() => impactHaptic(Haptics.ImpactFeedbackStyle.Heavy), 90);
            }
          },
          onMagnetChange: setMagnet,
          onNearMiss: () => {
            showBanner('CLOSE CALL', '+$5', 'danger', 850);
            triggerFx('near-miss');
            audio.tap.setPlaybackRate(1.35);
            replay(audio.tap).catch(() => undefined);
            impactHaptic(Haptics.ImpactFeedbackStyle.Rigid);
          },
          onPickup: (kind: PickupKind, value: number) => {
            if (kind === 'coin') {
              audio.coin.setPlaybackRate(0.94 + Math.random() * 0.28);
              replay(audio.coin).catch(() => undefined);
              pulseScore();
              triggerFx('coin');
              if (process.env.EXPO_OS === 'ios') {
                Haptics.selectionAsync().catch(() => undefined);
              }
              return;
            }

            if (kind === 'turbo') {
              showBanner('TURBO!', '2× POINTS · FULL SEND', 'yellow', 1900);
              audio.turbo.setPlaybackRate(1);
              replay(audio.turbo).catch(() => undefined);
              triggerFx('turbo');
              impactHaptic(Haptics.ImpactFeedbackStyle.Heavy);
              setTimeout(() => impactHaptic(Haptics.ImpactFeedbackStyle.Light), 110);
              return;
            }

            showBanner('MAGNET ONLINE', 'COINS RAIN IN', 'green', 1800);
            audio.turbo.setPlaybackRate(0.72);
            replay(audio.turbo).catch(() => undefined);
            triggerFx('magnet');
            impactHaptic(Haptics.ImpactFeedbackStyle.Medium);
            if (value > 0) pulseScore();
          },
          onScore: setScore,
          onTurboChange: (active) => {
            setTurbo(active);
            audio.engine.setPlaybackRate(active ? 1.18 : 0.9);
            audio.engine.volume = active ? 0.22 : 0.16;
            audio.wind.volume = active ? 0.12 : 0.035;
          },
        },
        steering,
      );
      worldRef.current = world;
      world
        .initialize(canvasRef.current, device)
        .then(() => {
          if (mounted) setGameState('ready');
        })
        .catch((error: unknown) => {
          console.error(error);
          if (mounted) setGameState('error');
        });
    });

    return () => {
      mounted = false;
      cancelAnimationFrame(frame);
      worldRef.current?.dispose();
      worldRef.current = null;
      Object.values(audio).forEach((player) => {
        player.pause();
        player.remove();
      });
      audioRef.current = null;
    };
  }, [device, pulseScore, showBanner, steering, triggerFx]);

  const startDrive = useCallback(async () => {
    setScore(0);
    setLevel(1);
    setBanner(null);
    setMagnet(false);
    setTurbo(false);
    triggerFx('drive');
    worldRef.current?.restart();
    setGameState('running');
    const audio = audioRef.current;
    if (audio) {
      audio.tap.setPlaybackRate(1);
      await replay(audio.tap).catch(() => undefined);
      audio.engine.setPlaybackRate(0.88);
      audio.engine.play();
      audio.wind.play();
    }
    impactHaptic(Haptics.ImpactFeedbackStyle.Medium);
  }, [triggerFx]);

  const steeringGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(1)
        .onBegin((event) => {
          // Reanimated shared values are intentionally mutable inside gesture worklets.
          // eslint-disable-next-line react-hooks/immutability
          steering.value = (event.absoluteX / width) * 2 - 1;
        })
        .onUpdate((event) => {
          const velocityLead = (event.velocityX / Math.max(width, 1)) * 0.075;
          // Reanimated shared values are intentionally mutable inside gesture worklets.
          // eslint-disable-next-line react-hooks/immutability
          steering.value = Math.max(
            -1,
            Math.min(1, (event.absoluteX / width) * 2 - 1 + velocityLead),
          );
        }),
    [steering, width],
  );

  const bannerClass =
    banner?.tone === 'yellow'
      ? 'bg-[#ffe000]'
      : banner?.tone === 'danger'
        ? 'bg-[#ff4b45]'
        : 'bg-[#18c95a]';

  return (
    <GestureDetector gesture={steeringGesture}>
      <View className="flex-1 bg-[#210b10]">
        <WebGPUCanvas ref={canvasRef} style={{ flex: 1 }} />
        <SpeedFx
          crash={gameState === 'crashing'}
          height={height}
          magnet={magnet}
          pulse={fxPulse}
          turbo={turbo}
          width={width}
        />

        <View className="pointer-events-none absolute inset-x-0 top-0 px-5 pt-14">
          <View className="flex-row items-start justify-between gap-4">
            <Animated.View style={scoreStyle}>
              <Text className="font-rounded text-3xl font-black tracking-tight text-white">
                ${score}
              </Text>
              <Text className="font-mono text-[9px] font-bold uppercase tracking-widest text-white/45">
                Best $570
              </Text>
            </Animated.View>
            <View className="items-end gap-1.5">
              <View className="flex-row gap-1.5">
                {magnet ? (
                  <Animated.View
                    className="rounded-full bg-[#20d96b] px-3 py-1"
                    entering={ZoomIn.springify()}
                    exiting={FadeOut.duration(180)}>
                    <Text className="font-rounded text-xs font-black text-white">🧲 MAGNET</Text>
                  </Animated.View>
                ) : null}
                {turbo ? (
                  <Animated.View
                    className="rounded-full bg-[#ffe300] px-3 py-1"
                    entering={ZoomIn.springify()}
                    exiting={FadeOut.duration(180)}>
                    <Text className="font-rounded text-xs font-black text-[#171207]">
                      ⚡ TURBO ×2
                    </Text>
                  </Animated.View>
                ) : null}
              </View>
              <Text className="font-rounded text-xs font-black uppercase tracking-wider text-[#ff8a2a]">
                🔥 Level {level}
              </Text>
            </View>
          </View>
          <View className="mt-3 self-start rounded-xl bg-black/25 px-3 py-2">
            <Text className="font-rounded text-xs font-bold text-white/90">
              🏁 FREE DRIVE — survive as long as you can
            </Text>
          </View>
        </View>

        {banner ? (
          <Animated.View
            key={banner.id}
            className="pointer-events-none absolute inset-x-0 top-[43%] items-center px-5"
            entering={ZoomIn.springify().damping(11).stiffness(220)}
            exiting={FadeOut.duration(220)}>
            <View className={`${bannerClass} min-w-52 items-center rounded-2xl px-5 py-3`}>
              <Text
                className={`font-rounded text-base font-black ${banner.tone === 'yellow' ? 'text-[#171207]' : 'text-white'}`}>
                {banner.title}
              </Text>
              {banner.subtitle ? (
                <Text
                  className={`mt-0.5 font-mono text-[9px] font-bold uppercase tracking-widest ${banner.tone === 'yellow' ? 'text-black/55' : 'text-white/70'}`}>
                  {banner.subtitle}
                </Text>
              ) : null}
            </View>
          </Animated.View>
        ) : null}

        {gameState === 'loading' ? (
          <View className="absolute inset-0 items-center justify-center bg-[#210b10]">
            <Animated.View className="items-center gap-3" entering={FadeIn}>
              <Text className="text-5xl">🔥</Text>
              <Text className="font-rounded text-xl font-black text-white">WARMING UP WEBGPU</Text>
            </Animated.View>
          </View>
        ) : null}

        {gameState === 'ready' ? (
          <Animated.View
            className="absolute inset-0 items-center justify-end bg-black/15 px-6 pb-16"
            entering={FadeIn.duration(500)}
            exiting={FadeOut.duration(220)}>
            <View className="w-full gap-4 rounded-[30px] border border-white/10 bg-black/55 p-5">
              <View className="gap-1">
                <Text className="font-rounded text-3xl font-black tracking-tight text-white">
                  VOLCANO DRIVE
                </Text>
                <Text className="text-sm leading-5 text-white/60">
                  Drag anywhere to steer. Thread the traffic, chain power-ups, and survive the climb.
                </Text>
              </View>
              <Pressable
                className="items-center rounded-2xl bg-[#ffe300] px-5 py-4 active:scale-[0.98]"
                onPress={startDrive}>
                <Text className="font-rounded text-base font-black text-[#171207]">TOUCH TO DRIVE</Text>
              </Pressable>
              <Text className="text-center font-mono text-[10px] uppercase tracking-widest text-white/35">
                Three.js · WebGPU · Skia · Expo
              </Text>
            </View>
          </Animated.View>
        ) : null}

        {gameState === 'crashed' ? (
          <Animated.View className="absolute inset-0" entering={FadeIn.duration(260)}>
            <RaceResults
              best={570}
              dom={{ scrollEnabled: false }}
              level={level}
              onRestart={startDrive}
              score={score}
            />
          </Animated.View>
        ) : null}

        {gameState === 'error' ? (
          <View className="absolute inset-0 items-center justify-center gap-3 bg-[#210b10] px-8">
            <Text className="font-rounded text-2xl font-black text-white">WEBGPU BUILD REQUIRED</Text>
            <Text className="text-center text-sm leading-5 text-white/60">
              Run npm run ios:dev. This experiment uses native WebGPU and cannot run inside Expo Go.
            </Text>
          </View>
        ) : null}
      </View>
    </GestureDetector>
  );
}
