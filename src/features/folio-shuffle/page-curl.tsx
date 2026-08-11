import {
  Canvas,
  ImageShader,
  Line,
  LinearGradient,
  Rect,
  Vertices,
  rect,
  type SkImage,
  vec,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

const COLUMN_COUNT = 24;
const ROW_COUNT = 20;

type PageCurlProps = {
  direction: 1 | -1;
  height: number;
  image: SkImage;
  progress: SharedValue<number>;
  width: number;
};

export function PageCurl({
  direction,
  height,
  image,
  progress,
  width,
}: PageCurlProps) {
  const mesh = useMemo(() => {
    const textures = [];
    const indices = [];

    for (let row = 0; row <= ROW_COUNT; row += 1) {
      const y = (row / ROW_COUNT) * height;

      for (let column = 0; column <= COLUMN_COUNT; column += 1) {
        const x = (column / COLUMN_COUNT) * width;
        textures.push(vec(x, y));

        if (row >= ROW_COUNT || column >= COLUMN_COUNT) continue;

        const topLeft = row * (COLUMN_COUNT + 1) + column;
        const topRight = topLeft + 1;
        const bottomLeft = topLeft + COLUMN_COUNT + 1;
        const bottomRight = bottomLeft + 1;
        indices.push(
          topLeft,
          bottomLeft,
          topRight,
          bottomLeft,
          bottomRight,
          topRight,
        );
      }
    }

    return { indices, textures };
  }, [height, width]);

  const diagonal = width * 0.2;
  const diagonalSlope = diagonal / height;
  const normalLength = Math.sqrt(1 + diagonalSlope * diagonalSlope);
  const normalX = (direction === 1 ? 1 : -1) / normalLength;
  const normalY = diagonalSlope / normalLength;
  const maximumSweep = width + diagonal;

  const vertices = useDerivedValue(() => {
    const value = Math.max(0, Math.min(1, Math.abs(progress.value)));
    const crease = maximumSweep * (1 - value);
    const foldRange = Math.max(maximumSweep * value, 0.0001);
    const points = [];

    for (let row = 0; row <= ROW_COUNT; row += 1) {
      const y = (row / ROW_COUNT) * height;
      const yProgress = row / ROW_COUNT;

      for (let column = 0; column <= COLUMN_COUNT; column += 1) {
        const x = (column / COLUMN_COUNT) * width;
        const forwardX = direction === 1 ? x : width - x;
        const sweep = forwardX + diagonal * yProgress;
        const distanceFromCrease = sweep - crease;

        if (distanceFromCrease <= 0) {
          points.push(vec(x, y));
          continue;
        }

        const foldProgress = Math.min(1, distanceFromCrease / foldRange);
        const barrel = Math.sin(foldProgress * Math.PI);
        const normalDistance = distanceFromCrease / normalLength;
        const reflection = 1.72 - barrel * 0.24;
        const centerPinch = (0.5 - yProgress) * barrel * height * 0.042;
        const paperSag =
          Math.pow(foldProgress, 1.7) *
          Math.sin(value * Math.PI) *
          height *
          0.018;

        points.push(
          vec(
            x - reflection * normalDistance * normalX,
            y - reflection * normalDistance * normalY + centerPinch + paperSag,
          ),
        );
      }
    }

    return points;
  }, [
    diagonal,
    direction,
    height,
    maximumSweep,
    normalLength,
    normalX,
    normalY,
    width,
  ]);

  const creaseCenter = useDerivedValue(() => {
    const value = Math.max(0, Math.min(1, Math.abs(progress.value)));
    const sweep = maximumSweep * (1 - value);
    const forwardX = sweep - diagonal * 0.5;
    return vec(direction === 1 ? forwardX : width - forwardX, height * 0.5);
  }, [diagonal, direction, height, maximumSweep, width]);

  const shadeStart = useDerivedValue(() =>
    vec(
      creaseCenter.value.x - normalX * 46,
      creaseCenter.value.y - normalY * 46,
    ),
  );
  const shadeEnd = useDerivedValue(() =>
    vec(
      creaseCenter.value.x + normalX * 54,
      creaseCenter.value.y + normalY * 54,
    ),
  );
  const shadeOpacity = useDerivedValue(() => {
    const value = Math.max(0, Math.min(1, Math.abs(progress.value)));
    return Math.sin(value * Math.PI) * 0.9;
  });

  const creaseTop = useDerivedValue(() => {
    const value = Math.max(0, Math.min(1, Math.abs(progress.value)));
    const sweep = maximumSweep * (1 - value);
    return vec(direction === 1 ? sweep : width - sweep, 0);
  }, [direction, maximumSweep, width]);
  const creaseBottom = useDerivedValue(() => {
    const value = Math.max(0, Math.min(1, Math.abs(progress.value)));
    const sweep = maximumSweep * (1 - value);
    const forwardX = sweep - diagonal;
    return vec(direction === 1 ? forwardX : width - forwardX, height);
  }, [diagonal, direction, height, maximumSweep, width]);
  const edgeOpacity = useDerivedValue(() => {
    const value = Math.max(0, Math.min(1, Math.abs(progress.value)));
    return value > 0.015 && value < 0.985 ? Math.sin(value * Math.PI) * 0.72 : 0;
  });

  return (
    <Canvas pointerEvents="none" style={{ height, width }}>
      <Vertices
        indices={mesh.indices}
        mode="triangles"
        textures={mesh.textures}
        vertices={vertices}>
        <ImageShader
          fit="fill"
          image={image}
          rect={rect(0, 0, width, height)}
          tx="clamp"
          ty="clamp"
        />
      </Vertices>

      <Rect
        height={height}
        opacity={shadeOpacity}
        width={width}
        x={0}
        y={0}>
        <LinearGradient
          colors={[
            'rgba(14,17,15,0)',
            'rgba(14,17,15,0.30)',
            'rgba(255,253,246,0.76)',
            'rgba(101,91,72,0.18)',
            'rgba(14,17,15,0)',
          ]}
          end={shadeEnd}
          positions={[0, 0.34, 0.49, 0.66, 1]}
          start={shadeStart}
        />
      </Rect>

      <Line
        color="rgba(255,255,255,0.92)"
        opacity={edgeOpacity}
        p1={creaseTop}
        p2={creaseBottom}
        strokeWidth={1.4}
      />
    </Canvas>
  );
}
