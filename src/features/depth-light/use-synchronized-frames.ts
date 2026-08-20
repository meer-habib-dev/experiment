import { useEffect, useMemo, useState } from 'react';
import {
  VisionCamera,
  type CameraOutput,
  type CameraOutputSynchronizer,
  type Depth,
  type Frame,
} from 'react-native-vision-camera';
import { createWorkletRuntimeForThread } from 'react-native-vision-camera-worklets';
import { scheduleOnRuntime } from 'react-native-worklets';

/** A depth pixel format is the reliable way to tell a Depth from a Frame. */
const DEPTH_FORMATS = [
  'depth-16-bit',
  'depth-32-bit',
  'depth-point-cloud-32-bit',
  'disparity-16-bit',
  'disparity-32-bit',
];

export function isDepthSample(sample: Frame | Depth): sample is Depth {
  'worklet';
  return DEPTH_FORMATS.indexOf(sample.pixelFormat as string) >= 0;
}

export type SynchronizedFramesStatus = 'connecting' | 'ready' | 'unavailable';

type Options = {
  /**
   * The outputs to align. They must already be attached to a mounted
   * `<Camera />`; the native synchronizer rejects outputs that are not yet
   * connected to the capture session.
   */
  outputs: CameraOutput[];
  /**
   * Set once the preview has started. Connection completes slightly after that
   * callback fires, so creation is retried across a short window.
   */
  enabled: boolean;
  /** Runs on the synchronizer's own thread, once per aligned set of samples. */
  onFrames: (samples: (Frame | Depth)[]) => boolean;
};

/** Cumulative retry schedule in ms; the last entry gives up. */
const RETRY_DELAYS = [0, 120, 300, 600, 1000, 1600];

/**
 * Delivers timestamp-aligned colour and depth samples on a single native
 * thread.
 *
 * `useFrameOutput` and `useDepthOutput` each spin up their own `DispatchQueue`
 * natively, so their worklets run concurrently on different threads. Driving
 * one `GPUDevice` from both is a data race, and it is also why a frame and the
 * depth map it is shaded with can come from different moments. An
 * `AVCaptureDataOutputSynchronizer` collapses both into one callback on one
 * thread, which removes the race and pairs the samples.
 *
 * iOS only. Callers should fall back to a colour-only path elsewhere rather
 * than reintroducing the two-thread arrangement.
 */
export function useSynchronizedFrames({ enabled, onFrames, outputs }: Options) {
  const [synchronizer, setSynchronizer] = useState<CameraOutputSynchronizer | null>(null);
  const [status, setStatus] = useState<SynchronizedFramesStatus>('connecting');

  useEffect(() => {
    if (!enabled || outputs.length < 2) return;

    let cancelled = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tryCreate = () => {
      if (cancelled) return;
      try {
        const created = VisionCamera.createOutputSynchronizer(outputs);
        setSynchronizer(created);
        setStatus('ready');
      } catch (error) {
        attempt += 1;
        if (attempt >= RETRY_DELAYS.length) {
          console.warn(
            '[Depth Light] Output synchronizer unavailable, falling back to colour-only:',
            error instanceof Error ? error.message : String(error),
          );
          setStatus('unavailable');
          return;
        }
        timer = setTimeout(tryCreate, RETRY_DELAYS[attempt]);
      }
    };

    timer = setTimeout(tryCreate, RETRY_DELAYS[0]);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      setSynchronizer(null);
      setStatus('connecting');
    };
  }, [enabled, outputs]);

  // The runtime has to be bound to the synchronizer's own thread: its
  // `setOnFramesCallback` may only be called from a worklet running there.
  const runtime = useMemo(
    () => (synchronizer ? createWorkletRuntimeForThread(synchronizer.thread) : null),
    [synchronizer],
  );

  useEffect(() => {
    if (!runtime || !synchronizer) return;
    scheduleOnRuntime(runtime, () => {
      'worklet';
      synchronizer.setOnFramesCallback(onFrames);
    });
    return () => {
      scheduleOnRuntime(runtime, () => {
        'worklet';
        synchronizer.setOnFramesCallback(undefined);
      });
    };
  }, [onFrames, runtime, synchronizer]);

  return { status, synchronizer };
}
