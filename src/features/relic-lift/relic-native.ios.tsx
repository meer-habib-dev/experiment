import { requireNativeModule, requireNativeViewManager } from 'expo-modules-core';
import type { ViewProps } from 'react-native';

export type LiftedSubject = {
  uri: string;
  width: number;
  height: number;
  native: boolean;
  backgroundRemoved: boolean;
  coverage: number;
};

type RelicSubjectLiftModule = {
  liftSubject(source: string, focusX: number, focusY: number): Promise<LiftedSubject>;
};

type NativeMetalSubjectProps = ViewProps & {
  source: string;
  alloy: number;
};

const subjectLiftModule = requireNativeModule<RelicSubjectLiftModule>('RelicSubjectLift');
const NativeMetalView = requireNativeViewManager<NativeMetalSubjectProps>(
  'RelicSubjectLift',
  'RelicMetalView',
);

export function liftSubjectAsync(source: string, focusX = 0.5, focusY = 0.5) {
  return subjectLiftModule.liftSubject(source, focusX, focusY);
}

export function NativeMetalSubjectView(props: NativeMetalSubjectProps) {
  return <NativeMetalView {...props} />;
}
