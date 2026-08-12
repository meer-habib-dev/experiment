import { requireNativeView } from 'expo';
import type { NativeSyntheticEvent, ViewProps } from 'react-native';

export type PrismReadyEvent = { cameraControl: boolean; controlCount?: number; device: string };
export type PrismMotionEvent = { x: number; y: number };
export type PrismControlStateEvent = { state: 'active' | 'fullscreen' | 'inactive' };
export type PrismCaptureEvent = {
  uri: string;
  fieldIndex: number;
  spectrumIndex: number;
  width: number;
  height: number;
};
export type PrismPressEvent = {
  phase: 'began' | 'ended' | 'cancelled' | 'armed' | 'double' | 'expired' | 'capturing';
  source?: string;
};

export type PrismNativeCameraProps = ViewProps & {
  active: boolean;
  fieldIndex: number;
  spectrumIndex: number;
  captureToken: number;
  onReady: (event: PrismReadyEvent) => void;
  onError: (message: string) => void;
  onFieldChange: (value: number) => void;
  onSpectrumChange: (value: number) => void;
  onControlState: (event: PrismControlStateEvent) => void;
  onMotion: (event: PrismMotionEvent) => void;
  onCapture: (event: PrismCaptureEvent) => void;
  onCapturePress: (event: PrismPressEvent) => void;
};

type NativeProps = Omit<
  PrismNativeCameraProps,
  | 'onReady'
  | 'onError'
  | 'onFieldChange'
  | 'onSpectrumChange'
  | 'onControlState'
  | 'onMotion'
  | 'onCapture'
  | 'onCapturePress'
> & {
  onReady: (event: NativeSyntheticEvent<PrismReadyEvent>) => void;
  onError: (event: NativeSyntheticEvent<{ message: string }>) => void;
  onFieldChange: (event: NativeSyntheticEvent<{ value: number; source: string }>) => void;
  onSpectrumChange: (event: NativeSyntheticEvent<{ value: number; source: string }>) => void;
  onControlState: (event: NativeSyntheticEvent<PrismControlStateEvent>) => void;
  onMotion: (event: NativeSyntheticEvent<PrismMotionEvent>) => void;
  onCapture: (event: NativeSyntheticEvent<PrismCaptureEvent>) => void;
  onCapturePress: (event: NativeSyntheticEvent<PrismPressEvent>) => void;
};

const NativePrismFieldCamera = requireNativeView<NativeProps>(
  'PrismFieldCamera',
  'PrismFieldCameraView',
);

export function PrismNativeCamera({
  onCapture,
  onCapturePress,
  onControlState,
  onError,
  onFieldChange,
  onMotion,
  onReady,
  onSpectrumChange,
  ...props
}: PrismNativeCameraProps) {
  return (
    <NativePrismFieldCamera
      {...props}
      onCapture={(event) => onCapture(event.nativeEvent)}
      onCapturePress={(event) => onCapturePress(event.nativeEvent)}
      onControlState={(event) => onControlState(event.nativeEvent)}
      onError={(event) => onError(event.nativeEvent.message)}
      onFieldChange={(event) => onFieldChange(event.nativeEvent.value)}
      onMotion={(event) => onMotion(event.nativeEvent)}
      onReady={(event) => onReady(event.nativeEvent)}
      onSpectrumChange={(event) => onSpectrumChange(event.nativeEvent.value)}
    />
  );
}
