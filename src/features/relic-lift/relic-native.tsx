import { Image } from 'expo-image';
import { View, type ViewProps } from 'react-native';

export type LiftedSubject = {
  uri: string;
  width: number;
  height: number;
  native: boolean;
  backgroundRemoved: boolean;
  coverage: number;
};

export async function liftSubjectAsync(source: string): Promise<LiftedSubject> {
  return {
    backgroundRemoved: false,
    coverage: 1,
    height: 1,
    native: false,
    uri: source,
    width: 1,
  };
}

export function NativeMetalSubjectView({ source, style }: ViewProps & { source: string; alloy: number }) {
  return (
    <View style={style}>
      <Image contentFit="contain" source={{ uri: source }} style={{ flex: 1 }} />
    </View>
  );
}
