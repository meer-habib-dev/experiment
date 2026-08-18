import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useDepthOutput,
  useFrameOutput,
  type CameraOrientation,
} from 'react-native-vision-camera';
import {
  Canvas,
  installWebGPU,
  useCanvasRef,
  useDevice,
  type NativeVideoFrame,
  type GPUSharedTextureMemory,
} from 'react-native-webgpu';
import { scheduleOnRN } from 'react-native-worklets';

import {
  createDepthLightGpu,
  depthTargetResolution,
  depthTextureSize,
  type DepthLightGpu,
} from '@/features/depth-light/depth-light-pipeline';

const colors = {
  black: '#070808',
  card: 'rgba(15, 16, 16, 0.72)',
  line: 'rgba(255, 255, 255, 0.16)',
  paper: '#F5F2EA',
  quiet: '#AAA9A4',
};

const lightPresets = [
  { color: [1, 0.58, 0.28] as const, label: 'EMBER', swatch: '#FF9147' },
  { color: [1, 0.92, 0.72] as const, label: 'IVORY', swatch: '#FFECC1' },
  { color: [0.35, 0.86, 1] as const, label: 'GLACIER', swatch: '#59DBFF' },
] as const;

function haptic(style = Haptics.ImpactFeedbackStyle.Light) {
  if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(style).catch(() => undefined);
}

function SfIcon({ color = colors.paper, name, size = 19 }: { color?: string; name: string; size?: number }) {
  return (
    <Image
      contentFit="contain"
      source={`sf:${name}`}
      style={{ height: size, tintColor: color, width: size }}
    />
  );
}

function GlassSurface({ children, style }: PropsWithChildren<{ style: ViewStyle | ViewStyle[] }>) {
  if (isLiquidGlassAvailable()) {
    return <GlassView style={style}>{children}</GlassView>;
  }
  return <View style={[style, { backgroundColor: colors.card }]}>{children}</View>;
}

function RoundButton({ accessibilityLabel, icon, onPress }: { accessibilityLabel: string; icon: string; onPress: () => void }) {
  return (
    <GlassSurface
      style={{
        alignItems: 'center',
        borderColor: colors.line,
        borderRadius: 23,
        borderWidth: 1,
        height: 46,
        justifyContent: 'center',
        overflow: 'hidden',
        width: 46,
      }}>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => ({
          alignItems: 'center',
          height: '100%',
          justifyContent: 'center',
          opacity: pressed ? 0.5 : 1,
          width: '100%',
        })}>
        <SfIcon name={icon} size={17} />
      </Pressable>
    </GlassSurface>
  );
}

function PermissionScreen({ onRequest }: { onRequest: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: colors.black, flex: 1, justifyContent: 'center', paddingHorizontal: 28 }}>
      <View style={{ left: 18, position: 'absolute', top: insets.top + 8 }}>
        <RoundButton accessibilityLabel="Go back" icon="xmark" onPress={() => router.back()} />
      </View>
      <View
        style={{
          alignItems: 'center',
          borderColor: '#FF9B54',
          borderRadius: 30,
          borderWidth: 1,
          height: 60,
          justifyContent: 'center',
          width: 60,
        }}>
        <SfIcon color="#FF9B54" name="lightbulb.max.fill" size={25} />
      </View>
      <Text selectable style={{ color: colors.paper, fontSize: 35, fontWeight: '700', letterSpacing: -1.4, paddingTop: 27 }}>
        Hold the light.
      </Text>
      <Text selectable style={{ color: '#858681', fontSize: 15, lineHeight: 23, maxWidth: 340, paddingTop: 12 }}>
        The live frame stays on your GPU. Depth shapes the light around faces, hands, and everything between you and the lens.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRequest}
        style={({ pressed }) => ({
          alignItems: 'center',
          alignSelf: 'flex-start',
          backgroundColor: colors.paper,
          borderRadius: 99,
          marginTop: 28,
          opacity: pressed ? 0.68 : 1,
          paddingHorizontal: 21,
          paddingVertical: 14,
        })}>
        <Text style={{ color: colors.black, fontSize: 14, fontWeight: '800' }}>Open live camera</Text>
      </Pressable>
    </View>
  );
}

function orientationCode(orientation: CameraOrientation) {
  'worklet';
  if (orientation === 'right') return 1;
  if (orientation === 'down') return 2;
  if (orientation === 'left') return 3;
  return 0;
}

function orientationDegrees(orientation: CameraOrientation): 0 | 90 | 180 | 270 {
  'worklet';
  if (orientation === 'right') return 90;
  if (orientation === 'down') return 180;
  if (orientation === 'left') return 270;
  return 0;
}

export function DepthLightCamera() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const canvasRef = useCanvasRef();
  const { device: gpuDevice } = useDevice({ powerPreference: 'high-performance' });
  const { canRequestPermission, hasPermission, requestPermission } = useCameraPermission();
  // Face ID is exposed as a virtual device composed of the front wide camera
  // and the TrueDepth sensor. Request both constituents so VisionCamera ranks
  // it above the plain front camera instead of resolving their scores as a tie.
  const cameraDevice = useCameraDevice('front', {
    physicalDevices: ['wide-angle', 'true-depth'],
  });
  const hasHardwareDepth = cameraDevice?.mediaTypes.includes('depth') ?? false;
  const [screenActive, setScreenActive] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [gpu, setGpu] = useState<DepthLightGpu | null>(null);
  const [gpuError, setGpuError] = useState<string | null>(null);
  const [presetIndex, setPresetIndex] = useState(0);
  const [showDepth, setShowDepth] = useState(false);
  const didRequest = useRef(false);

  const lightX = useSharedValue(0.28);
  const lightY = useSharedValue(0.38);
  const radius = useSharedValue(0.34);
  const pinchStart = useSharedValue(0.34);
  const hardwareDepthReady = useSharedValue(0);
  const depthRotation = useSharedValue(0);
  const depthMode = useSharedValue(0);
  const depthMirrored = useSharedValue(0);
  const depthScaleX = useSharedValue(1);
  const depthScaleY = useSharedValue(1);
  const depthErrorReported = useSharedValue(0);
  const depthReadyReported = useSharedValue(0);
  const renderFailed = useSharedValue(0);
  const renderReadyReported = useSharedValue(0);
  const workletGpu = useMemo(
    () =>
      gpu
        ? {
            context: gpu.context,
            depthTexture: gpu.depthTexture,
            depthView: gpu.depthView,
            device: gpu.device,
            pipeline: gpu.pipeline,
            sampler: gpu.sampler,
            uniformBuffer: gpu.uniformBuffer,
          }
        : null,
    [gpu],
  );

  useFocusEffect(
    useCallback(() => {
      setScreenActive(true);
      return () => setScreenActive(false);
    }, []),
  );

  useEffect(() => {
    if (hasPermission || !canRequestPermission || didRequest.current) return;
    didRequest.current = true;
    requestPermission().catch(() => undefined);
  }, [canRequestPermission, hasPermission, requestPermission]);

  useEffect(() => {
    depthMode.value = showDepth ? 1 : 0;
  }, [depthMode, showDepth]);

  useEffect(() => {
    if (!gpuDevice || !canvasRef.current) return;
    try {
      const context = canvasRef.current.getContext('webgpu');
      if (!context) throw new Error('The WebGPU surface is unavailable.');
      const resources = createDepthLightGpu(gpuDevice, context);
      setGpu(resources);
      return () => {
        resources.destroy();
      };
    } catch (error) {
      setGpuError(error instanceof Error ? error.message : 'WebGPU could not start.');
    }
  }, [canvasRef, gpuDevice]);

  const reportRenderError = useCallback((message: string) => {
    console.error('[Depth Light GPU]', message);
    setGpuError(`GPU pass paused: ${message}`);
  }, []);

  const reportRenderReady = useCallback((details: string) => {
    console.info(`[Depth Light GPU] First live frame presented (${details})`);
    setGpuError(null);
  }, []);

  const reportDepthReady = useCallback((details: string) => {
    console.info(`[Depth Light GPU] Hardware depth active (${details})`);
  }, []);

  const reportDepthError = useCallback((message: string) => {
    console.error(`[Depth Light depth] ${message}`);
  }, []);

  const depthOutput = useDepthOutput({
    allowDeferredStart: true,
    dropFramesWhileBusy: true,
    enableFiltering: true,
    targetResolution: depthTargetResolution,
    onDepth(depth) {
      'worklet';
      if (!workletGpu) {
        depth.dispose();
        return true;
      }
      let metricDepth: typeof depth | undefined;
      try {
        installWebGPU();
        metricDepth =
          depth.pixelFormat === 'depth-32-bit' ? depth : depth.convert('depth-32-bit');
        const raw = metricDepth.getDepthData();
        if (
          metricDepth.width <= depthTextureSize.width &&
          metricDepth.height <= depthTextureSize.height
        ) {
          workletGpu.device.queue.writeTexture(
            { texture: workletGpu.depthTexture },
            raw,
            {
              bytesPerRow: metricDepth.bytesPerRow,
              rowsPerImage: metricDepth.height,
            },
            { height: metricDepth.height, width: metricDepth.width },
          );
          hardwareDepthReady.value = 1;
          depthRotation.value = orientationCode(metricDepth.orientation);
          depthMirrored.value = metricDepth.isMirrored ? 1 : 0;
          depthScaleX.value = metricDepth.width / depthTextureSize.width;
          depthScaleY.value = metricDepth.height / depthTextureSize.height;
          if (depthReadyReported.value === 0) {
            depthReadyReported.value = 1;
            scheduleOnRN(
              reportDepthReady,
              `${metricDepth.width}x${metricDepth.height} metric, ${
                metricDepth.orientation
              }, ${metricDepth.isMirrored ? 'mirrored' : 'not mirrored'}`,
            );
          }
        }
      } catch (error) {
        hardwareDepthReady.value = 0;
        if (depthErrorReported.value === 0) {
          depthErrorReported.value = 1;
          scheduleOnRN(
            reportDepthError,
            error instanceof Error ? error.message : String(error),
          );
        }
      } finally {
        if (metricDepth && metricDepth !== depth) metricDepth.dispose();
        depth.dispose();
      }
      return true;
    },
  });

  const frameOutput = useFrameOutput({
    allowDeferredStart: false,
    dropFramesWhileBusy: true,
    enablePhysicalBufferRotation: true,
    enablePreviewSizedOutputBuffers: true,
    // The native NV12 IOSurface is also held by VisionCamera's preview. On iOS,
    // react-native-webgpu cannot begin exclusive access to that shared surface.
    // Request BGRA output so the external texture owns an importable frame buffer.
    pixelFormat: 'rgb',
    targetResolution: { height: 1280, width: 720 },
    onFrame(frame) {
      'worklet';
      let nativeBuffer: ReturnType<typeof frame.getNativeBuffer> | undefined;
      let videoFrame: NativeVideoFrame | undefined;
      let sharedMemory: GPUSharedTextureMemory | undefined;
      let cameraTexture: GPUTexture | undefined;
      let cameraAccessStarted = false;
      try {
        if (!workletGpu || renderFailed.value > 0 || !frame.hasNativeBuffer) return true;
        installWebGPU();
        nativeBuffer = frame.getNativeBuffer();
        videoFrame = RNWebGPU.createVideoFrameFromNativeBuffer(nativeBuffer.pointer);
        sharedMemory = workletGpu.device.importSharedTextureMemory({
          handle: videoFrame.handle,
          label: 'depth-light-camera-frame',
        });
        cameraTexture = sharedMemory.createTexture();
        sharedMemory.beginAccess(cameraTexture, true);
        cameraAccessStarted = true;

        const preset = lightPresets[presetIndex];
        workletGpu.device.queue.writeBuffer(
          workletGpu.uniformBuffer,
          0,
          new Float32Array([
            lightX.value,
            lightY.value,
            radius.value,
            1,
            preset.color[0],
            preset.color[1],
            preset.color[2],
            0,
            width,
            height,
            frame.orientation === 'left' || frame.orientation === 'right' ? frame.height : frame.width,
            frame.orientation === 'left' || frame.orientation === 'right' ? frame.width : frame.height,
            hardwareDepthReady.value,
            depthRotation.value,
            depthMode.value,
            depthMirrored.value,
            orientationCode(frame.orientation),
            frame.isMirrored ? 1 : 0,
            depthScaleX.value,
            depthScaleY.value,
            0,
            1,
            0,
            0,
            0,
            0,
            1,
            0,
          ]),
        );
        const bindGroup = workletGpu.device.createBindGroup({
          layout: workletGpu.pipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: workletGpu.uniformBuffer } },
            { binding: 1, resource: workletGpu.sampler },
            { binding: 2, resource: cameraTexture.createView() },
            { binding: 3, resource: workletGpu.depthView },
          ],
        });
        const encoder = workletGpu.device.createCommandEncoder({ label: 'depth-light-frame' });
        const pass = encoder.beginRenderPass({
          colorAttachments: [
            {
              clearValue: { a: 1, b: 0.02, g: 0.02, r: 0.02 },
              loadOp: 'clear',
              storeOp: 'store',
              view: workletGpu.context.getCurrentTexture().createView(),
            },
          ],
        });
        pass.setPipeline(workletGpu.pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(3);
        pass.end();
        workletGpu.device.queue.submit([encoder.finish()]);
        workletGpu.context.present?.();
        if (renderReadyReported.value === 0) {
          renderReadyReported.value = 1;
          scheduleOnRN(
            reportRenderReady,
            `${frame.orientation}, ${frame.isMirrored ? 'mirrored' : 'not mirrored'}`,
          );
        }
      } catch (error) {
        if (renderFailed.value === 0) {
          renderFailed.value = 1;
          const message = error instanceof Error ? error.message : String(error);
          scheduleOnRN(reportRenderError, message);
        }
      } finally {
        if (cameraAccessStarted && sharedMemory && cameraTexture) {
          sharedMemory.endAccess(cameraTexture);
        }
        cameraTexture?.destroy();
        videoFrame?.release();
        nativeBuffer?.release();
        frame.dispose();
      }
      return true;
    },
  });

  const outputs = useMemo(
    () => (hasHardwareDepth ? [frameOutput, depthOutput] : [frameOutput]),
    [depthOutput, frameOutput, hasHardwareDepth],
  );

  const moveLight = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin((event) => {
          lightX.value = Math.max(0.04, Math.min(0.96, event.x / width));
          lightY.value = Math.max(0.04, Math.min(0.96, event.y / height));
        })
        .onUpdate((event) => {
          lightX.value = Math.max(0.04, Math.min(0.96, event.x / width));
          lightY.value = Math.max(0.04, Math.min(0.96, event.y / height));
        }),
    [height, lightX, lightY, width],
  );
  const resizeLight = useMemo(
    () =>
      Gesture.Pinch()
        .onBegin(() => {
          pinchStart.value = radius.value;
        })
        .onUpdate((event) => {
          radius.value = Math.max(0.14, Math.min(0.68, pinchStart.value * event.scale));
        }),
    [pinchStart, radius],
  );
  const gesture = useMemo(() => Gesture.Simultaneous(moveLight, resizeLight), [moveLight, resizeLight]);
  const orbStyle = useAnimatedStyle(() => ({
    left: lightX.value * width - 24,
    top: lightY.value * height - 24,
  }));

  if (!hasPermission) {
    return <PermissionScreen onRequest={() => requestPermission().catch(() => undefined)} />;
  }

  return (
    <View style={{ backgroundColor: colors.black, flex: 1 }}>
      {cameraDevice ? (
        <Camera
          constraints={[{ fps: 30 }]}
          device={cameraDevice}
          isActive={screenActive}
          mirrorMode="on"
          onPreviewStarted={() => setCameraReady(true)}
          outputs={outputs}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <Canvas pointerEvents="none" ref={canvasRef} style={StyleSheet.absoluteFill} />

      <GestureDetector gesture={gesture}>
        <Animated.View style={StyleSheet.absoluteFill}>
          <Animated.View
            pointerEvents="none"
            style={[
              {
                alignItems: 'center',
                borderRadius: 24,
                height: 48,
                justifyContent: 'center',
                position: 'absolute',
                width: 48,
              },
              orbStyle,
            ]}>
            <View
              style={{
                backgroundColor: '#FFF9E8',
                borderRadius: 5,
                boxShadow: `0 0 16px ${lightPresets[presetIndex].swatch}`,
                height: 10,
                width: 10,
              }}
            />
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      <View style={{ left: 18, position: 'absolute', top: insets.top + 8 }}>
        <RoundButton accessibilityLabel="Close depth light" icon="xmark" onPress={() => router.back()} />
      </View>
      <View style={{ position: 'absolute', right: 18, top: insets.top + 8 }}>
        <GlassSurface
          style={{
            alignItems: 'center',
            borderColor: colors.line,
            borderRadius: 99,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 7,
            paddingHorizontal: 12,
            paddingVertical: 9,
          }}>
          <View style={{ backgroundColor: cameraReady && gpu ? '#A7F3A1' : '#F0C56D', borderRadius: 3, height: 6, width: 6 }} />
          <Text style={{ color: colors.paper, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 }}>
            {hasHardwareDepth ? 'TRUEDEPTH · TYPEGPU' : 'MONO · TYPEGPU'}
          </Text>
        </GlassSurface>
      </View>

      {!cameraReady || !gpu ? (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)} pointerEvents="none" style={styles.loading}>
          <ActivityIndicator color={colors.paper} />
          <Text style={{ color: colors.quiet, fontSize: 12, fontWeight: '700', letterSpacing: 0.8 }}>PREPARING GPU LIGHT</Text>
        </Animated.View>
      ) : null}

      <View style={{ bottom: insets.bottom + 18, left: 18, position: 'absolute', right: 18 }}>
        <GlassSurface
          style={{
            borderColor: colors.line,
            borderRadius: 26,
            borderWidth: 1,
            gap: 16,
            overflow: 'hidden',
            padding: 16,
          }}>
          <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ gap: 3 }}>
              <Text style={{ color: colors.paper, fontSize: 14, fontWeight: '800' }}>Move the source</Text>
              <Text style={{ color: colors.quiet, fontSize: 11 }}>Drag to relight · pinch for falloff</Text>
            </View>
            <Pressable
              accessibilityLabel={showDepth ? 'Show relit camera' : 'Show depth map'}
              accessibilityRole="button"
              onPress={() => {
                haptic();
                setShowDepth((current) => !current);
              }}
              style={({ pressed }) => ({
                backgroundColor: showDepth ? colors.paper : 'rgba(255,255,255,0.08)',
                borderRadius: 99,
                opacity: pressed ? 0.55 : 1,
                paddingHorizontal: 12,
                paddingVertical: 8,
              })}>
              <Text style={{ color: showDepth ? colors.black : colors.paper, fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>
                DEPTH
              </Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: 9 }}>
            {lightPresets.map((preset, index) => {
              const active = presetIndex === index;
              return (
                <Pressable
                  accessibilityLabel={`${preset.label} light`}
                  accessibilityRole="button"
                  key={preset.label}
                  onPress={() => {
                    haptic();
                    setPresetIndex(index);
                  }}
                  style={({ pressed }) => ({
                    alignItems: 'center',
                    backgroundColor: active ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.04)',
                    borderColor: active ? 'rgba(255,255,255,0.28)' : 'transparent',
                    borderRadius: 15,
                    borderWidth: 1,
                    flex: 1,
                    gap: 7,
                    opacity: pressed ? 0.55 : 1,
                    paddingVertical: 11,
                  })}>
                  <View style={{ backgroundColor: preset.swatch, borderRadius: 7, height: 14, width: 14 }} />
                  <Text style={{ color: active ? colors.paper : colors.quiet, fontSize: 9, fontWeight: '900', letterSpacing: 1 }}>
                    {preset.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {gpuError ? (
            <Animated.Text entering={FadeIn} selectable style={{ color: '#F2B5A4', fontSize: 11, lineHeight: 16 }}>
              {gpuError}
            </Animated.Text>
          ) : null}
        </GlassSurface>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    gap: 12,
    left: 0,
    position: 'absolute',
    right: 0,
    top: '46%',
  },
});
