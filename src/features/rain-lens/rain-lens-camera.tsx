import { FilterMode, ImageFormat, MipmapMode, TileMode } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  type Constraint,
  type TargetCameraPosition,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import {
  SkiaCamera,
  type SkiaCameraProps,
  type SkiaCameraRef,
} from 'react-native-vision-camera-skia';
import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  type ViewStyle,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { rainLensEffect, rainLensPaint } from '@/features/rain-lens/rain-lens-shader';

type RainMood = 'mist' | 'rain' | 'storm';

const colors = {
  blush: '#EDB5C4',
  blushDeep: '#D98FA5',
  frame: '#151317',
  ink: '#291820',
  milk: '#FFF8FA',
  muted: '#825968',
};

const moodWetness: Record<RainMood, number> = {
  mist: 0.52,
  rain: 0.82,
  storm: 1,
};
const moodHaze: Record<RainMood, number> = {
  mist: 0.36,
  rain: 0.24,
  storm: 0.3,
};
const rainModes: RainMood[] = ['mist', 'rain', 'storm'];
const zoomStops = [1, 1.5, 2];
const cameraConstraints = [{ fps: 30 }, { binned: true }] satisfies Constraint[];

function haptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(style).catch(() => undefined);
}

function SfIcon({
  color = colors.ink,
  name,
  size = 20,
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

function GlassSurface({
  children,
  style,
}: PropsWithChildren<{ style: ViewStyle | ViewStyle[] }>) {
  if (isLiquidGlassAvailable()) {
    return (
      <GlassView isInteractive style={style}>
        {children}
      </GlassView>
    );
  }

  return <View style={[style, { backgroundColor: 'rgba(255,244,248,0.25)' }]}>{children}</View>;
}

function RoundControl({
  accessibilityLabel,
  active,
  icon,
  onPress,
}: {
  accessibilityLabel: string;
  active?: boolean;
  icon: string;
  onPress: () => void;
}) {
  return (
    <GlassSurface
      style={{
        alignItems: 'center',
        borderColor: 'rgba(255,255,255,0.62)',
        borderRadius: 27,
        borderWidth: 1.25,
        boxShadow: '0 7px 18px rgba(98,39,59,0.16)',
        height: 54,
        justifyContent: 'center',
        width: 54,
      }}>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => ({
          alignItems: 'center',
          height: '100%',
          justifyContent: 'center',
          opacity: pressed ? 0.55 : 1,
          transform: [{ scale: pressed ? 0.93 : 1 }],
          width: '100%',
        })}>
        <SfIcon name={icon} size={21} />
        {active ? (
          <View
            style={{
              backgroundColor: '#623344',
              borderColor: colors.blush,
              borderRadius: 5,
              borderWidth: 2,
              height: 10,
              position: 'absolute',
              right: 5,
              top: 3,
              width: 10,
            }}
          />
        ) : null}
      </Pressable>
    </GlassSurface>
  );
}

function StatusPill({ icon, label }: { icon: string; label: string }) {
  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: 'rgba(32,29,32,0.48)',
        borderColor: 'rgba(255,255,255,0.2)',
        borderRadius: 99,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 7,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}>
      <SfIcon color={colors.milk} name={icon} size={15} />
      <Text
        style={{
          color: colors.milk,
          fontSize: 11,
          fontVariant: ['tabular-nums'],
          fontWeight: '900',
          letterSpacing: 0.8,
        }}>
        {label}
      </Text>
    </View>
  );
}

function PermissionScreen({ onRequest }: { onRequest: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: colors.blush,
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 30,
      }}>
      <Pressable
        accessibilityLabel="Go back"
        onPress={() => router.back()}
        style={{ left: 18, padding: 12, position: 'absolute', top: insets.top + 4 }}>
        <SfIcon name="chevron.left" size={22} />
      </Pressable>
      <View
        style={{
          alignItems: 'center',
          backgroundColor: colors.frame,
          borderRadius: 44,
          boxShadow: '0 14px 28px rgba(80,28,47,0.23)',
          height: 88,
          justifyContent: 'center',
          width: 88,
        }}>
        <SfIcon color={colors.milk} name="drop.fill" size={36} />
      </View>
      <Text
        selectable
        style={{ color: colors.ink, fontSize: 30, fontWeight: '900', paddingTop: 26 }}>
        Open the rainy lens
      </Text>
      <Text
        selectable
        style={{
          color: colors.muted,
          fontSize: 15,
          lineHeight: 22,
          maxWidth: 320,
          paddingTop: 10,
          textAlign: 'center',
        }}>
        Camera access lets the shader bend your live view through moving drops. Frames stay on this
        device.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRequest}
        style={({ pressed }) => ({
          backgroundColor: colors.frame,
          borderRadius: 99,
          marginTop: 28,
          opacity: pressed ? 0.72 : 1,
          paddingHorizontal: 27,
          paddingVertical: 15,
        })}>
        <Text style={{ color: colors.milk, fontSize: 15, fontWeight: '900' }}>Allow camera</Text>
      </Pressable>
    </View>
  );
}

export function RainLensCamera() {
  const cameraRef = useRef<SkiaCameraRef>(null);
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didRequestPermission = useRef(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const { canRequestPermission, hasPermission, requestPermission } = useCameraPermission();
  const [screenActive, setScreenActive] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [captureUri, setCaptureUri] = useState<string | null>(null);
  const [facing, setFacing] = useState<TargetCameraPosition>('back');
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [rainEnabled, setRainEnabled] = useState(true);
  const [rainMood, setRainMood] = useState<RainMood>('rain');
  const [zoomIndex, setZoomIndex] = useState(0);
  const shutterScale = useSharedValue(1);
  const flashOpacity = useSharedValue(0);
  const device = useCameraDevice(facing, { physicalDevices: ['wide-angle'] });
  const shaderWetness = rainEnabled ? moodWetness[rainMood] : 0;
  const shaderHaze = rainEnabled ? moodHaze[rainMood] : 0;
  const shaderZoom = zoomStops[zoomIndex];

  const frameWidth = width - 28;
  const frameHeight = Math.min(frameWidth * 1.36, height - insets.top - insets.bottom - 150);

  useFocusEffect(
    useCallback(() => {
      setScreenActive(true);
      return () => setScreenActive(false);
    }, []),
  );

  useEffect(() => {
    if (hasPermission || !canRequestPermission || didRequestPermission.current) return;
    didRequestPermission.current = true;
    requestPermission().catch(() => undefined);
  }, [canRequestPermission, hasPermission, requestPermission]);

  useEffect(
    () => () => {
      if (focusTimer.current != null) clearTimeout(focusTimer.current);
    },
    [],
  );

  const onFrame = useCallback<SkiaCameraProps['onFrame']>(
    (frame, render) => {
      'worklet';
      try {
        // VisionCamera v5 exposes presentation time in seconds. Keep it small
        // so the GPU's float precision preserves smooth sub-second movement.
        const time = frame.timestamp % 3600;
        render(({ canvas, frameTexture }) => {
          const imageShader = frameTexture.makeShaderOptions(
            TileMode.Clamp,
            TileMode.Clamp,
            FilterMode.Linear,
            MipmapMode.None,
          );
          const shader = rainLensEffect.makeShaderWithChildren(
            [frame.width, frame.height, time, shaderWetness, shaderZoom, shaderHaze],
            [imageShader],
          );
          rainLensPaint.setShader(shader);
          // Paint the shader itself across the frame. drawImage can treat the
          // image as the source and ignore a custom paint shader on some GPU
          // paths; the runtime shader already owns frameTexture as its child.
          canvas.drawRect(
            { height: frame.height, width: frame.width, x: 0, y: 0 },
            rainLensPaint,
          );
          rainLensPaint.setShader(null);
          shader.dispose();
          imageShader.dispose();
        });
      } finally {
        frame.dispose();
      }
    },
    [shaderHaze, shaderWetness, shaderZoom],
  );

  const flashStyle = useAnimatedStyle(() => ({ opacity: flashOpacity.value }));
  const shutterStyle = useAnimatedStyle(() => ({ transform: [{ scale: shutterScale.value }] }));

  const pulseShutter = useCallback(() => {
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    // Reanimated shared values are imperative animation controls.
    // eslint-disable-next-line react-hooks/immutability
    shutterScale.value = withSequence(
      withTiming(0.91, { duration: 70 }),
      withSpring(1, { damping: 11, stiffness: 290 }),
    );
  }, [shutterScale]);

  const takePhoto = useCallback(async () => {
    if (captureUri) {
      pulseShutter();
      setCaptureUri(null);
      setCameraReady(false);
      return;
    }

    if (!cameraReady || isCapturing) return;
    setIsCapturing(true);
    pulseShutter();
    // Reanimated shared values are imperative animation controls.
    // eslint-disable-next-line react-hooks/immutability
    flashOpacity.value = withSequence(
      withTiming(0.62, { duration: 42 }),
      withTiming(0, { duration: 210 }),
    );

    try {
      const snapshot = cameraRef.current?.takeSnapshot();
      if (snapshot == null) throw new Error('No processed camera frame is ready yet.');
      const bytes = snapshot.encodeToBytes(ImageFormat.JPEG, 94);
      snapshot.dispose();
      const file = new File(Paths.cache, `rain-lens-${Date.now()}.jpg`);
      file.create({ overwrite: true });
      file.write(bytes);
      setCaptureUri(file.uri);
      if (process.env.EXPO_OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      }
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : 'Could not capture the wet-lens frame.');
      if (process.env.EXPO_OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      }
    } finally {
      setIsCapturing(false);
    }
  }, [cameraReady, captureUri, flashOpacity, isCapturing, pulseShutter]);

  const toggleRain = useCallback(() => {
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    setRainEnabled((current) => !current);
  }, []);

  const cycleRain = useCallback(() => {
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    const nextMood = rainModes[(rainModes.indexOf(rainMood) + 1) % rainModes.length];
    setRainMood(nextMood);
    setRainEnabled(true);
  }, [rainMood]);

  const cycleZoom = useCallback(() => {
    haptic();
    const nextIndex = (zoomIndex + 1) % zoomStops.length;
    setZoomIndex(nextIndex);
  }, [zoomIndex]);

  const flipCamera = useCallback(() => {
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
    setCaptureUri(null);
    setCameraReady(false);
    setCameraError(null);
    setZoomIndex(0);
  }, []);

  const focusCamera = useCallback(
    (x: number, y: number) => {
      if (!cameraReady || captureUri) return;
      haptic();
      setFocusPoint({ x, y });
      cameraRef.current?.focusTo({ x, y }).catch(() => undefined);
      if (focusTimer.current != null) clearTimeout(focusTimer.current);
      focusTimer.current = setTimeout(() => setFocusPoint(null), 720);
    },
    [cameraReady, captureUri],
  );

  if (!hasPermission) {
    return <PermissionScreen onRequest={() => requestPermission()} />;
  }

  return (
    <View
      style={{
        backgroundColor: colors.blush,
        flex: 1,
        paddingBottom: Math.max(insets.bottom, 8),
        paddingHorizontal: 14,
        paddingTop: insets.top + 2,
      }}>
      <View
        pointerEvents="none"
        style={{
          backgroundColor: 'rgba(255,239,244,0.36)',
          borderRadius: 190,
          height: 380,
          left: -180,
          position: 'absolute',
          top: 80,
          width: 380,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          backgroundColor: 'rgba(174,82,112,0.09)',
          borderRadius: 170,
          bottom: -130,
          height: 340,
          position: 'absolute',
          right: -140,
          width: 340,
        }}
      />

      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          height: 28,
          justifyContent: 'space-between',
        }}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => ({ opacity: pressed ? 0.48 : 1, padding: 8, width: 42 })}>
          <SfIcon name="chevron.left" size={20} />
        </Pressable>
        <View />
        <View style={{ alignItems: 'center', padding: 8, width: 42 }}>
          <View
            style={{
              backgroundColor: rainEnabled ? '#653145' : 'rgba(70,42,52,0.26)',
              borderRadius: 4,
              height: 7,
              width: 7,
            }}
          />
        </View>
      </View>

      <View
        style={{
          alignSelf: 'center',
          backgroundColor: colors.frame,
          borderColor: 'rgba(255,255,255,0.54)',
          borderCurve: 'continuous',
          borderRadius: 48,
          borderWidth: 1.4,
          boxShadow: '0 20px 42px rgba(91,32,52,0.29)',
          height: frameHeight + 12,
          padding: 6,
          width: frameWidth,
        }}>
        <View
          style={{
            backgroundColor: '#262125',
            borderCurve: 'continuous',
            borderRadius: 41,
            flex: 1,
            overflow: 'hidden',
          }}>
          {device ? (
            <SkiaCamera
              constraints={cameraConstraints}
              device={device}
              enableDistortionCorrection={device.supportsDistortionCorrection ? true : undefined}
              // The shader's gravity is expressed in display-space. Give it
              // upright buffers so portrait sensor rotation cannot turn a
              // falling drop sideways (or invert the front-camera preview).
              enablePhysicalBufferRotation
              enablePreviewSizedOutputBuffers
              enableSmoothAutoFocus={device.supportsSmoothAutoFocus ? true : undefined}
              isActive={screenActive && !captureUri}
              mirrorMode="auto"
              onError={(error) => setCameraError(error.message)}
              onFrame={onFrame}
              onStarted={() => {
                setCameraReady(true);
                setCameraError(null);
              }}
              pixelFormat="yuv"
              ref={cameraRef}
              style={{ flex: 1 }}
            />
          ) : (
            <View
              style={{
                alignItems: 'center',
                backgroundColor: '#373036',
                flex: 1,
                gap: 11,
                justifyContent: 'center',
              }}>
              <ActivityIndicator color={colors.milk} />
              <Text style={{ color: '#DCCBD1', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 }}>
                PHYSICAL CAMERA REQUIRED
              </Text>
            </View>
          )}

          {!cameraReady && device ? (
            <View
              pointerEvents="none"
              style={{
                alignItems: 'center',
                backgroundColor: 'rgba(24,20,23,0.42)',
                inset: 0,
                justifyContent: 'center',
                position: 'absolute',
              }}>
              <ActivityIndicator color={colors.milk} />
            </View>
          ) : null}

          {captureUri ? (
            <Animated.View
              entering={FadeIn.duration(160)}
              exiting={FadeOut.duration(120)}
              style={{ position: 'absolute', inset: 0 }}>
              <Image contentFit="cover" source={{ uri: captureUri }} style={{ flex: 1 }} />
            </Animated.View>
          ) : null}

          <Pressable
            disabled={!cameraReady || !!captureUri}
            onPress={(event) => focusCamera(event.nativeEvent.locationX, event.nativeEvent.locationY)}
            style={{ position: 'absolute', inset: 0 }}
          />

          {focusPoint ? (
            <Animated.View
              entering={FadeIn.duration(100)}
              exiting={FadeOut.duration(180)}
              pointerEvents="none"
              style={{
                borderColor: colors.milk,
                borderRadius: 22,
                borderWidth: 1.2,
                height: 44,
                left: focusPoint.x - 22,
                position: 'absolute',
                top: focusPoint.y - 22,
                width: 44,
              }}>
              <View
                style={{
                  backgroundColor: colors.milk,
                  height: 1,
                  left: 15,
                  position: 'absolute',
                  top: 20,
                  width: 12,
                }}
              />
            </Animated.View>
          ) : null}

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              left: 16,
              position: 'absolute',
              right: 16,
              top: 16,
            }}>
            <StatusPill icon="bolt.slash.fill" label="FLASH OFF" />
            <StatusPill icon="camera.metering.center.weighted" label={`${zoomStops[zoomIndex].toFixed(1)}×`} />
          </View>

          <View
            pointerEvents="none"
            style={{
              borderBottomColor: 'rgba(255,248,250,0.9)',
              borderBottomWidth: 4,
              borderColor: 'transparent',
              borderRadius: 42,
              borderRightColor: 'rgba(255,248,250,0.9)',
              borderRightWidth: 4,
              bottom: -11,
              height: 84,
              position: 'absolute',
              right: -11,
              transform: [{ rotate: '2deg' }],
              width: 84,
            }}
          />

          {cameraError ? (
            <Animated.View
              entering={FadeIn.duration(160)}
              style={{
                alignSelf: 'center',
                backgroundColor: 'rgba(56,16,29,0.75)',
                borderRadius: 99,
                bottom: 18,
                maxWidth: '82%',
                paddingHorizontal: 13,
                paddingVertical: 7,
                position: 'absolute',
              }}>
              <Text selectable style={{ color: '#FFE5EC', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 }}>
                {cameraError.toUpperCase()}
              </Text>
            </Animated.View>
          ) : null}

          {captureUri ? (
            <View
              pointerEvents="none"
              style={{
                alignSelf: 'center',
                backgroundColor: 'rgba(25,19,23,0.62)',
                borderRadius: 99,
                bottom: 18,
                paddingHorizontal: 13,
                paddingVertical: 7,
                position: 'absolute',
              }}>
              <Text style={{ color: colors.milk, fontSize: 9, fontWeight: '900', letterSpacing: 1 }}>
                RAINY MOMENT · TAP SHUTTER TO RETAKE
              </Text>
            </View>
          ) : null}

          <Animated.View
            pointerEvents="none"
            style={[{ backgroundColor: colors.milk, position: 'absolute', inset: 0 }, flashStyle]}
          />
        </View>
      </View>

      <View style={{ flex: 1, justifyContent: 'center', minHeight: 98, paddingTop: 7 }}>
        <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
          <Pressable
            accessibilityLabel={`Zoom ${zoomStops[zoomIndex].toFixed(1)} times`}
            accessibilityRole="button"
            onPress={cycleZoom}
            style={({ pressed }) => ({
              alignItems: 'center',
              backgroundColor: 'rgba(255,244,248,0.2)',
              borderColor: 'rgba(255,255,255,0.64)',
              borderRadius: 27,
              borderWidth: 1.25,
              boxShadow: '0 7px 18px rgba(98,39,59,0.14)',
              height: 54,
              justifyContent: 'center',
              opacity: pressed ? 0.58 : 1,
              width: 54,
            })}>
            <Text
              style={{
                color: colors.ink,
                fontSize: 12,
                fontVariant: ['tabular-nums'],
                fontWeight: '900',
              }}>
              {zoomStops[zoomIndex].toFixed(1)}×
            </Text>
          </Pressable>

          <RoundControl
            accessibilityLabel={rainEnabled ? 'Dry the lens' : 'Wet the lens'}
            active={rainEnabled}
            icon="drop.halffull"
            onPress={toggleRain}
          />

          <Animated.View style={shutterStyle}>
            <Pressable
              accessibilityLabel={captureUri ? 'Retake rainy photo' : 'Take rainy photo'}
              accessibilityRole="button"
              disabled={isCapturing}
              onPress={takePhoto}
              style={({ pressed }) => ({
                alignItems: 'center',
                backgroundColor: colors.frame,
                borderColor: 'rgba(255,255,255,0.56)',
                borderRadius: 44,
                borderWidth: 2,
                boxShadow: '0 12px 24px rgba(76,24,42,0.3)',
                height: 88,
                justifyContent: 'center',
                opacity: pressed || isCapturing ? 0.7 : 1,
                width: 88,
              })}>
              <SfIcon
                color={colors.milk}
                name={captureUri ? 'arrow.counterclockwise' : 'camera.aperture'}
                size={36}
              />
            </Pressable>
          </Animated.View>

          <RoundControl
            accessibilityLabel={`Rain intensity ${rainMood}`}
            active
            icon="cloud.rain.fill"
            onPress={cycleRain}
          />
          <RoundControl
            accessibilityLabel="Flip camera"
            icon="arrow.triangle.2.circlepath.camera"
            onPress={flipCamera}
          />
        </View>
        <Text
          style={{
            color: 'rgba(72,38,50,0.64)',
            fontSize: 8,
            fontWeight: '900',
            letterSpacing: 1.7,
            paddingTop: 3,
            textAlign: 'center',
          }}>
          {rainEnabled ? `${rainMood.toUpperCase()} · LIVE REFRACTION` : 'DRY LENS'}
        </Text>
      </View>
    </View>
  );
}
