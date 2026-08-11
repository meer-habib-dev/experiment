import { DeviceMotion } from 'expo-sensors';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import type {
  PrismControlStateEvent,
  PrismMotionEvent,
  PrismNativeCameraProps,
} from '@/features/prism-field/prism-field-native.ios';

export type {
  PrismCaptureEvent,
  PrismControlStateEvent,
  PrismMotionEvent,
  PrismNativeCameraProps,
  PrismPressEvent,
  PrismReadyEvent,
} from '@/features/prism-field/prism-field-native.ios';

export function PrismNativeCamera({ onControlState, onMotion, onReady, style }: PrismNativeCameraProps) {
  const ready = useRef(false);

  useEffect(() => {
    DeviceMotion.setUpdateInterval(32);
    const subscription = DeviceMotion.addListener((sample) => {
      const x = Math.max(-1, Math.min((sample.rotation?.gamma ?? 0) / 0.72, 1));
      const y = Math.max(-1, Math.min((sample.rotation?.beta ?? 0) / 0.72, 1));
      onMotion({ x, y } satisfies PrismMotionEvent);
    });
    return () => subscription.remove();
  }, [onMotion]);

  useEffect(() => {
    if (ready.current) return;
    ready.current = true;
    onReady({ cameraControl: false, controlCount: 0, device: 'Touch controls' });
    onControlState({ state: 'inactive' } satisfies PrismControlStateEvent);
  }, [onControlState, onReady]);

  return <View pointerEvents="none" style={style} />;
}
