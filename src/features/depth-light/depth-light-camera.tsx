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
import Animated, { FadeIn, FadeOut, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useDepthOutput,
  useFrameOutput,
  type CameraOrientation,
  type Depth,
  type Frame,
} from 'react-native-vision-camera';
import {
  Canvas,
  installWebGPU,
  useCanvasRef,
  useDevice,
  type GPUSharedTextureMemory,
  type NativeVideoFrame,
} from 'react-native-webgpu';
import { scheduleOnRN } from 'react-native-worklets';

import {
  CONTROL_FLOATS,
  control,
  createDepthLightGpu,
  depthTargetResolution,
  frameTargetResolution,
  rawDepthSize,
  type DepthLightGpu,
} from '@/features/depth-light/depth-light-pipeline';
import {
  isDepthSample,
  useSynchronizedFrames,
} from '@/features/depth-light/use-synchronized-frames';

const colors = {
  black: '#070808',
  card: 'rgba(15, 16, 16, 0.72)',
  line: 'rgba(255, 255, 255, 0.16)',
  paper: '#F5F2EA',
  quiet: '#AAA9A4',
};

const lightPresets = [
  { ambient: 0.05, color: [1, 0.55, 0.24] as const, label: 'EMBER', swatch: '#FF9147' },
  { ambient: 0.09, color: [1, 0.9, 0.7] as const, label: 'IVORY', swatch: '#FFECC1' },
  { ambient: 0.06, color: [0.32, 0.82, 1] as const, label: 'GLACIER', swatch: '#59DBFF' },
] as const;

/** Light distance from the lens, in metres. */
const MIN_DISTANCE = 0.16;
const MAX_DISTANCE = 1.4;
const DEFAULT_DISTANCE = 0.45;
/** Falloff radius in metres - the distance at which the light drops to half. */
const LIGHT_RADIUS = 0.5;
/** Fallback vertical half-FOV when a frame carries no calibration data. */
const DEFAULT_TAN_HALF_FOV = 0.66;

function haptic(style = Haptics.ImpactFeedbackStyle.Light) {
  if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(style).catch(() => undefined);
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

function GlassSurface({ children, style }: PropsWithChildren<{ style: ViewStyle | ViewStyle[] }>) {
  if (isLiquidGlassAvailable()) {
    return <GlassView style={style}>{children}</GlassView>;
  }
  return <View style={[style, { backgroundColor: colors.card }]}>{children}</View>;
}

function RoundButton({
  accessibilityLabel,
  icon,
  onPress,
}: {
  accessibilityLabel: string;
  icon: string;
  onPress: () => void;
}) {
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
    <View
      style={{
        backgroundColor: colors.black,
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 28,
      }}>
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
      <Text
        selectable
        style={{
          color: colors.paper,
          fontSize: 35,
          fontWeight: '700',
          letterSpacing: -1.4,
          paddingTop: 27,
        }}>
        Hold the light.
      </Text>
      <Text
        selectable
        style={{ color: '#858681', fontSize: 15, lineHeight: 23, maxWidth: 340, paddingTop: 12 }}>
        The live frame stays on your GPU. Depth places the light in the room with you, so it wraps
        around what is near and leaves what is far in the dark.
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
        <Text style={{ color: colors.black, fontSize: 14, fontWeight: '800' }}>
          Open live camera
        </Text>
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

/**
 * Per-surface GPU resources, cached on the worklet runtime's global object.
 *
 * The camera recycles a small pool of IOSurfaces, so importing shared memory
 * per frame means re-importing the same handful of surfaces thirty times a
 * second. `GPUSharedTextureMemory` has no explicit release - it is reclaimed
 * only when the JS object is collected - so those imports pile up as retained
 * native memory faster than Hermes frees them. Keying the import, the texture
 * view and the bind group by surface handle makes the steady state allocate
 * nothing and bounds live surfaces to `MAX_CACHED_SURFACES`.
 *
 * The cache lives on `globalThis` rather than in the worklet's closure so it
 * survives regardless of how captured values are serialised into the runtime.
 */
type SurfaceEntry = {
  bindGroup: GPUBindGroup;
  handle: bigint;
  memory: GPUSharedTextureMemory;
  texture: GPUTexture;
};
type SurfaceCache = { entries: SurfaceEntry[]; generation: number };
const SURFACE_CACHE_KEY = '__depthLightSurfaceCache';
const MAX_CACHED_SURFACES = 6;

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
  const [gpuGeneration, setGpuGeneration] = useState(0);
  const [gpuError, setGpuError] = useState<string | null>(null);
  const [presetIndex, setPresetIndex] = useState(0);
  const [showDepth, setShowDepth] = useState(false);
  const [distanceLabel, setDistanceLabel] = useState(Math.round(DEFAULT_DISTANCE * 100));
  const [depthLive, setDepthLive] = useState(false);
  const didRequest = useRef(false);

  const lightX = useSharedValue<number>(0.32);
  const lightY = useSharedValue<number>(0.42);
  const lightZ = useSharedValue<number>(DEFAULT_DISTANCE);
  const pinchStart = useSharedValue<number>(DEFAULT_DISTANCE);
  const lightR = useSharedValue<number>(lightPresets[0].color[0]);
  const lightG = useSharedValue<number>(lightPresets[0].color[1]);
  const lightB = useSharedValue<number>(lightPresets[0].color[2]);
  const ambient = useSharedValue<number>(lightPresets[0].ambient);
  const debugMode = useSharedValue<number>(0);
  const viewWidth = useSharedValue<number>(width);
  const viewHeight = useSharedValue<number>(height);
  const renderFailures = useSharedValue<number>(0);
  const renderReported = useSharedValue<number>(0);
  const synchronizerActive = useSharedValue<number>(0);
  const depthReported = useSharedValue<number>(0);

  useEffect(() => {
    viewWidth.value = width;
    viewHeight.value = height;
  }, [height, viewHeight, viewWidth, width]);

  useEffect(() => {
    const preset = lightPresets[presetIndex];
    lightR.value = preset.color[0];
    lightG.value = preset.color[1];
    lightB.value = preset.color[2];
    ambient.value = preset.ambient;
  }, [ambient, lightB, lightG, lightR, presetIndex]);

  useEffect(() => {
    debugMode.value = showDepth ? 1 : 0;
  }, [debugMode, showDepth]);

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
    if (!gpuDevice || !canvasRef.current) return;
    try {
      const context = canvasRef.current.getContext('webgpu');
      if (!context) throw new Error('The WebGPU surface is unavailable.');
      const resources = createDepthLightGpu(gpuDevice, context);
      setGpu(resources);
      // Bumping the generation invalidates every cached surface entry: the
      // bind groups it holds reference the previous device's layouts.
      setGpuGeneration((current) => current + 1);
      return () => {
        setGpu(null);
        resources.destroy();
      };
    } catch (error) {
      setGpuError(error instanceof Error ? error.message : 'WebGPU could not start.');
    }
  }, [canvasRef, gpuDevice]);

  const workletGpu = useMemo(
    () =>
      gpu
        ? {
            cameraSampler: gpu.cameraSampler,
            context: gpu.context,
            controlBuffer: gpu.controlBuffer,
            depthBindGroup: gpu.depthBindGroup,
            depthPipeline: gpu.depthPipeline,
            device: gpu.device,
            generation: gpuGeneration,
            lightLayout: gpu.lightLayout,
            lightPipeline: gpu.lightPipeline,
            rawDepthTexture: gpu.rawDepthTexture,
            resolvedDepthView: gpu.resolvedDepthView,
          }
        : null,
    [gpu, gpuGeneration],
  );

  const reportRenderError = useCallback((message: string) => {
    console.error('[Depth Light GPU]', message);
    setGpuError(`GPU pass paused: ${message}`);
  }, []);

  const reportRenderReady = useCallback((details: string) => {
    console.info(`[Depth Light GPU] Live frame presented (${details})`);
    setGpuError(null);
  }, []);

  const reportDepthReady = useCallback((details: string) => {
    console.info(`[Depth Light GPU] Hardware depth active (${details})`);
    setDepthLive(true);
  }, []);

  /**
   * One frame: resolve depth, light the scene, present. Both passes go into a
   * single command encoder and a single submit, so the depth map the lighting
   * reads is the one produced moments earlier in the same buffer - it is never
   * read back to the CPU.
   *
   * Disposal of `frame` and `depth` belongs to the caller.
   */
  const drawFrame = useCallback(
    (frame: Frame, depth: Depth | null) => {
      'worklet';
      if (!workletGpu || renderFailures.value > 3) return;
      if (!frame.hasNativeBuffer) return;

      const gpuResources = workletGpu;
      let nativeBuffer: ReturnType<typeof frame.getNativeBuffer> | undefined;
      let videoFrame: NativeVideoFrame | undefined;
      let entry: SurfaceEntry | undefined;
      let accessStarted = false;

      try {
        installWebGPU();

        const host = globalThis as unknown as Record<string, SurfaceCache | undefined>;
        let cache = host[SURFACE_CACHE_KEY];
        if (!cache || cache.generation !== gpuResources.generation) {
          if (cache) {
            for (let i = 0; i < cache.entries.length; i += 1) cache.entries[i].texture.destroy();
          }
          cache = { entries: [], generation: gpuResources.generation };
          host[SURFACE_CACHE_KEY] = cache;
        }

        nativeBuffer = frame.getNativeBuffer();
        videoFrame = RNWebGPU.createVideoFrameFromNativeBuffer(nativeBuffer.pointer);
        const handle = videoFrame.handle;

        for (let i = 0; i < cache.entries.length; i += 1) {
          if (cache.entries[i].handle === handle) {
            entry = cache.entries[i];
            break;
          }
        }

        if (!entry) {
          const memory = gpuResources.device.importSharedTextureMemory({
            handle,
            label: 'depth-light-camera-frame',
          });
          const texture = memory.createTexture();
          const bindGroup = gpuResources.device.createBindGroup({
            entries: [
              { binding: 0, resource: { buffer: gpuResources.controlBuffer } },
              { binding: 1, resource: gpuResources.cameraSampler },
              { binding: 2, resource: texture.createView() },
              { binding: 3, resource: gpuResources.resolvedDepthView },
            ],
            label: 'depth-light-lighting-bindings',
            layout: gpuResources.lightLayout,
          });
          entry = { bindGroup, handle, memory, texture };
          cache.entries.push(entry);
          if (cache.entries.length > MAX_CACHED_SURFACES) {
            const evicted = cache.entries.shift();
            evicted?.texture.destroy();
          }
        }

        // Depth is uploaded before anything is encoded, so the resolve pass in
        // this same submit reads the map paired with this exact frame.
        let hasDepth = 0;
        let depthRotation = 0;
        let depthMirrored = 0;
        let depthScaleX = 1;
        let depthScaleY = 1;
        let depthDisplayWidth = 3;
        let depthDisplayHeight = 4;
        let tanHalfFovY = DEFAULT_TAN_HALF_FOV;
        let depthIsDisparity = 0;

        if (depth) {
          let metric: Depth | undefined;
          try {
            // Ask for metric float depth, but never assume the request was
            // honoured: `convert` throws where the target format is not
            // offered, and TrueDepth commonly streams disparity. Whatever the
            // buffer we end up uploading actually says it is, is what the
            // shader is told - guessing here inverts the whole scene.
            if (depth.pixelFormat !== 'depth-32-bit') {
              try {
                metric = depth.convert('depth-32-bit');
              } catch {
                metric = undefined;
              }
            }
            if (!metric) metric = depth;
            depthIsDisparity = metric.pixelFormat.indexOf('disparity') === 0 ? 1 : 0;
            if (metric.width <= rawDepthSize.width && metric.height <= rawDepthSize.height) {
              gpuResources.device.queue.writeTexture(
                { texture: gpuResources.rawDepthTexture },
                metric.getDepthData(),
                { bytesPerRow: metric.bytesPerRow, rowsPerImage: metric.height },
                { height: metric.height, width: metric.width },
              );
              hasDepth = 1;
              depthRotation = orientationCode(metric.orientation);
              depthMirrored = metric.isMirrored ? 1 : 0;
              depthScaleX = metric.width / rawDepthSize.width;
              depthScaleY = metric.height / rawDepthSize.height;
              const depthRotated = depthRotation === 1 || depthRotation === 3;
              depthDisplayWidth = depthRotated ? metric.height : metric.width;
              depthDisplayHeight = depthRotated ? metric.width : metric.height;

              // Real intrinsics beat a guessed FOV: the reconstructed positions
              // are only metric if the frustum matches the lens.
              const calibration = metric.cameraCalibrationData;
              if (calibration) {
                const intrinsics = calibration.cameraIntrinsicMatrix;
                const reference = calibration.intrinsicMatrixReferenceDimensions;
                const colorCode = orientationCode(frame.orientation);
                // A portrait display shows the sensor's long axis vertically,
                // and the video crop trims the sensor's short axis - so the
                // display's vertical FOV is the sensor's uncropped horizontal
                // FOV. In landscape the roles swap.
                const candidate =
                  colorCode === 1 || colorCode === 3
                    ? reference.width / 2 / intrinsics[0]
                    : reference.height / 2 / intrinsics[4];
                if (candidate > 0.15 && candidate < 2.5) tanHalfFovY = candidate;
              }

              if (depthReported.value === 0) {
                depthReported.value = 1;
                scheduleOnRN(
                  reportDepthReady,
                  `${metric.width}x${metric.height} ${metric.pixelFormat} (from ${
                    depth.pixelFormat
                  }), ${metric.orientation}, ${metric.depthDataQuality} quality`,
                );
              }
            }
          } finally {
            if (metric && metric !== depth) metric.dispose();
          }
        }

        const colorRotated = frame.orientation === 'left' || frame.orientation === 'right';
        const controls = new Float32Array(CONTROL_FLOATS);
        controls[control.lightX] = lightX.value;
        controls[control.lightY] = lightY.value;
        controls[control.lightZ] = lightZ.value;
        controls[control.intensity] = 1;
        controls[control.colorR] = lightR.value;
        controls[control.colorG] = lightG.value;
        controls[control.colorB] = lightB.value;
        controls[control.radius] = LIGHT_RADIUS;
        controls[control.viewWidth] = viewWidth.value;
        controls[control.viewHeight] = viewHeight.value;
        controls[control.sourceWidth] = colorRotated ? frame.height : frame.width;
        controls[control.sourceHeight] = colorRotated ? frame.width : frame.height;
        controls[control.cameraRotation] = orientationCode(frame.orientation);
        controls[control.cameraMirrored] = frame.isMirrored ? 1 : 0;
        controls[control.tanHalfFovY] = tanHalfFovY;
        controls[control.ambient] = ambient.value;
        controls[control.hasDepth] = hasDepth;
        controls[control.depthRotation] = depthRotation;
        controls[control.debugMode] = debugMode.value;
        controls[control.depthMirrored] = depthMirrored;
        controls[control.depthScaleX] = depthScaleX;
        controls[control.depthScaleY] = depthScaleY;
        controls[control.depthWidth] = depthDisplayWidth;
        controls[control.depthHeight] = depthDisplayHeight;
        controls[control.depthIsDisparity] = depthIsDisparity;
        gpuResources.device.queue.writeBuffer(gpuResources.controlBuffer, 0, controls);

        entry.memory.beginAccess(entry.texture, true);
        accessStarted = true;

        const encoder = gpuResources.device.createCommandEncoder({ label: 'depth-light-frame' });
        if (hasDepth === 1) {
          const resolve = encoder.beginRenderPass({
            colorAttachments: [
              {
                clearValue: { a: 0, b: 0, g: 0, r: 0 },
                loadOp: 'clear',
                storeOp: 'store',
                view: gpuResources.resolvedDepthView,
              },
            ],
            label: 'depth-light-resolve',
          });
          resolve.setPipeline(gpuResources.depthPipeline);
          resolve.setBindGroup(0, gpuResources.depthBindGroup);
          resolve.draw(3);
          resolve.end();
        }

        const lighting = encoder.beginRenderPass({
          colorAttachments: [
            {
              clearValue: { a: 1, b: 0.02, g: 0.02, r: 0.02 },
              loadOp: 'clear',
              storeOp: 'store',
              view: gpuResources.context.getCurrentTexture().createView(),
            },
          ],
          label: 'depth-light-lighting',
        });
        lighting.setPipeline(gpuResources.lightPipeline);
        lighting.setBindGroup(0, entry.bindGroup);
        lighting.draw(3);
        lighting.end();

        gpuResources.device.queue.submit([encoder.finish()]);
        gpuResources.context.present?.();

        renderFailures.value = 0;
        if (renderReported.value === 0) {
          renderReported.value = 1;
          scheduleOnRN(
            reportRenderReady,
            `${frame.orientation}, ${frame.isMirrored ? 'mirrored' : 'not mirrored'}, depth ${
              hasDepth === 1 ? 'on' : 'off'
            }`,
          );
        }
      } catch (error) {
        // A single bad frame should not end the session. Only a sustained run
        // of failures stops the pass and surfaces the message.
        renderFailures.value += 1;
        if (renderFailures.value === 4) {
          scheduleOnRN(reportRenderError, error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (accessStarted && entry) {
          try {
            entry.memory.endAccess(entry.texture);
          } catch {
            // The surface is going away; nothing useful to do here.
          }
        }
        // The imported memory keeps the IOSurface alive, so the frame's own
        // reference can go straight back to the camera's buffer pool.
        videoFrame?.release();
        nativeBuffer?.release();
      }
    },
    // Shared values are stable for the component's lifetime and are read on the
    // camera thread, so they are deliberately not dependencies here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reportDepthReady, reportRenderError, reportRenderReady, workletGpu],
  );

  const onSynchronizedFrames = useCallback(
    (samples: (Frame | Depth)[]) => {
      'worklet';
      let frame: Frame | null = null;
      let depth: Depth | null = null;
      for (let i = 0; i < samples.length; i += 1) {
        const sample = samples[i];
        if (isDepthSample(sample)) depth = sample;
        else frame = sample as Frame;
      }
      try {
        if (frame) drawFrame(frame, depth);
      } finally {
        depth?.dispose();
        frame?.dispose();
      }
      return true;
    },
    [drawFrame],
  );

  /**
   * The colour-only path: used before the synchronizer connects, and
   * permanently on hardware without depth. Once the synchronizer owns the
   * outputs it delivers every sample itself, so this stands down rather than
   * rendering the same frame twice.
   *
   * The stand-down is a shared value read inside the worklet rather than a
   * changing `onFrame` prop, because the callback has to be installed from the
   * output's own thread and the synchronizer's status is not known until after
   * the outputs exist. The depth output never gets a callback at all, so no
   * second thread ever touches the device.
   */
  const colorOnlyFrame = useCallback(
    (frame: Frame) => {
      'worklet';
      try {
        if (synchronizerActive.value === 0) drawFrame(frame, null);
      } finally {
        // Dispose on every path - a retained frame stalls the pipeline.
        frame.dispose();
      }
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drawFrame],
  );

  const depthOutput = useDepthOutput({
    allowDeferredStart: true,
    dropFramesWhileBusy: true,
    // Platform filtering already inpaints most dropouts, which leaves the
    // resolve pass a cleaner map to bilateral-filter.
    enableFiltering: true,
    targetResolution: depthTargetResolution,
  });

  const frameOutput = useFrameOutput({
    allowDeferredStart: false,
    dropFramesWhileBusy: true,
    enablePhysicalBufferRotation: true,
    enablePreviewSizedOutputBuffers: true,
    onFrame: colorOnlyFrame,
    // The native NV12 IOSurface is also held by VisionCamera's preview. On iOS,
    // react-native-webgpu cannot begin exclusive access to that shared surface.
    // Request BGRA output so the external texture owns an importable frame buffer.
    pixelFormat: 'rgb',
    targetResolution: frameTargetResolution,
  });

  const outputs = useMemo(
    () => (hasHardwareDepth ? [frameOutput, depthOutput] : [frameOutput]),
    [depthOutput, frameOutput, hasHardwareDepth],
  );

  const { status: syncStatus } = useSynchronizedFrames({
    enabled: cameraReady && hasHardwareDepth && workletGpu != null,
    onFrames: onSynchronizedFrames,
    outputs,
  });

  useEffect(() => {
    synchronizerActive.value = syncStatus === 'ready' ? 1 : 0;
  }, [syncStatus, synchronizerActive]);

  const moveLight = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin((event) => {
          lightX.value = Math.max(0.03, Math.min(0.97, event.x / width));
          lightY.value = Math.max(0.03, Math.min(0.97, event.y / height));
        })
        .onUpdate((event) => {
          lightX.value = Math.max(0.03, Math.min(0.97, event.x / width));
          lightY.value = Math.max(0.03, Math.min(0.97, event.y / height));
        }),
    [height, lightX, lightY, width],
  );

  const pushLight = useMemo(
    () =>
      Gesture.Pinch()
        .onBegin(() => {
          pinchStart.value = lightZ.value;
        })
        .onUpdate((event) => {
          // Spreading the fingers pushes the source away from the lens.
          const next = Math.max(
            MIN_DISTANCE,
            Math.min(MAX_DISTANCE, pinchStart.value * event.scale),
          );
          lightZ.value = next;
          scheduleOnRN(setDistanceLabel, Math.round(next * 100));
        }),
    [lightZ, pinchStart],
  );

  const gesture = useMemo(() => Gesture.Simultaneous(moveLight, pushLight), [moveLight, pushLight]);

  if (!hasPermission) {
    return <PermissionScreen onRequest={() => requestPermission().catch(() => undefined)} />;
  }

  const depthActive = depthLive && syncStatus === 'ready';

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
      {/* The lit result is drawn here. The emitter orb is part of that render,
          so it is occluded by anything nearer to the lens than the light. */}
      <Canvas pointerEvents="none" ref={canvasRef} style={StyleSheet.absoluteFill} />

      <GestureDetector gesture={gesture}>
        <Animated.View style={StyleSheet.absoluteFill} />
      </GestureDetector>

      <View pointerEvents="box-none" style={{ left: 18, position: 'absolute', top: insets.top + 8 }}>
        <RoundButton
          accessibilityLabel="Close depth light"
          icon="xmark"
          onPress={() => router.back()}
        />
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', right: 18, top: insets.top + 8 }}>
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
          <View
            style={{
              backgroundColor: depthActive ? '#A7F3A1' : cameraReady && gpu ? '#F0C56D' : '#8A8A85',
              borderRadius: 3,
              height: 6,
              width: 6,
            }}
          />
          <Text style={{ color: colors.paper, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 }}>
            {depthActive ? 'TRUEDEPTH · TYPEGPU' : 'MONO · TYPEGPU'}
          </Text>
        </GlassSurface>
      </View>

      {!cameraReady || !gpu ? (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(180)}
          pointerEvents="none"
          style={styles.loading}>
          <ActivityIndicator color={colors.paper} />
          <Text style={{ color: colors.quiet, fontSize: 12, fontWeight: '700', letterSpacing: 0.8 }}>
            PREPARING GPU LIGHT
          </Text>
        </Animated.View>
      ) : null}

      <View
        pointerEvents="box-none"
        style={{ bottom: insets.bottom + 18, left: 18, position: 'absolute', right: 18 }}>
        <GlassSurface
          style={{
            borderColor: colors.line,
            borderRadius: 26,
            borderWidth: 1,
            gap: 16,
            overflow: 'hidden',
            padding: 16,
          }}>
          <View
            style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ gap: 3 }}>
              <Text style={{ color: colors.paper, fontSize: 14, fontWeight: '800' }}>
                Move the source
              </Text>
              <Text style={{ color: colors.quiet, fontSize: 11 }}>
                Drag to relight · pinch to set depth · {distanceLabel} cm out
              </Text>
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
              <Text
                style={{
                  color: showDepth ? colors.black : colors.paper,
                  fontSize: 10,
                  fontWeight: '900',
                  letterSpacing: 1,
                }}>
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
                  <View
                    style={{
                      backgroundColor: preset.swatch,
                      borderRadius: 7,
                      height: 14,
                      width: 14,
                    }}
                  />
                  <Text
                    style={{
                      color: active ? colors.paper : colors.quiet,
                      fontSize: 9,
                      fontWeight: '900',
                      letterSpacing: 1,
                    }}>
                    {preset.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {gpuError ? (
            <Animated.Text
              entering={FadeIn}
              selectable
              style={{ color: '#F2B5A4', fontSize: 11, lineHeight: 16 }}>
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
