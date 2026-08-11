import {
  FilterMode,
  ImageFormat,
  MipmapMode,
  TileMode,
} from "@shopify/react-native-skia";
import { File, Paths } from "expo-file-system";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Share,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useCameraDevice,
  useCameraPermission,
  type Constraint,
} from "react-native-vision-camera";
import {
  SkiaCamera,
  type SkiaCameraProps,
  type SkiaCameraRef,
} from "react-native-vision-camera-skia";

import {
  relicPreviewEffect,
  relicPreviewPaint,
} from "@/features/relic-lift/relic-lift-shader";
import {
  liftSubjectAsync,
  NativeMetalSubjectView,
  type LiftedSubject,
} from "@/features/relic-lift/relic-native";

type Phase = "searching" | "locking" | "extracting" | "lifted";

const colors = {
  blue: "#5276FF",
  blush: "#FF8D82",
  cream: "#FFF8E8",
  green: "#70D7AE",
  ink: "#27232B",
  paper: "#FFFEF8",
  stage: "#F2E8D5",
  yellow: "#F6C84A",
};

const alloys = [
  { color: "#B6D7E5", label: "TIN", detail: "cool + shiny" },
  { color: "#F4B936", label: "GOLD", detail: "warm + sunny" },
  { color: "#F278B5", label: "CANDY", detail: "pink + cosmic" },
] as const;
const zoomStops = [1, 1.5, 2] as const;
const cameraConstraints = [
  { fps: 30 },
  { binned: true },
] satisfies Constraint[];

function haptic(
  style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light,
) {
  if (process.env.EXPO_OS === "ios")
    Haptics.impactAsync(style).catch(() => undefined);
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

function RoundButton({
  accessibilityLabel,
  backgroundColor = colors.paper,
  icon,
  onPress,
  size = 50,
}: {
  accessibilityLabel: string;
  backgroundColor?: string;
  icon: string;
  onPress: () => void;
  size?: number;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor,
        borderColor: colors.ink,
        borderRadius: size / 2,
        borderWidth: 2.2,
        boxShadow: pressed ? "0 1px 0 #27232B" : "0 4px 0 #27232B",
        height: size,
        justifyContent: "center",
        transform: [
          { translateY: pressed ? 3 : 0 },
          { scale: pressed ? 0.97 : 1 },
        ],
        width: size,
      })}
    >
      <SfIcon name={icon} size={size * 0.4} />
    </Pressable>
  );
}

function TargetCorners({ color = "#FFFFFF" }: { color?: string }) {
  const corner = {
    borderColor: color,
    height: 30,
    position: "absolute" as const,
    width: 30,
  };
  return (
    <>
      <View
        style={[
          corner,
          { borderLeftWidth: 3, borderTopWidth: 3, left: 0, top: 0 },
        ]}
      />
      <View
        style={[
          corner,
          { borderRightWidth: 3, borderTopWidth: 3, right: 0, top: 0 },
        ]}
      />
      <View
        style={[
          corner,
          { borderBottomWidth: 3, borderLeftWidth: 3, bottom: 0, left: 0 },
        ]}
      />
      <View
        style={[
          corner,
          { borderBottomWidth: 3, borderRightWidth: 3, bottom: 0, right: 0 },
        ]}
      />
    </>
  );
}

function SwatchWheel({
  alloy,
  onPress,
}: {
  alloy: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`Metal finish ${alloys[alloy].label}. Tap to change.`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: colors.paper,
        borderColor: colors.ink,
        borderRadius: 13,
        borderWidth: 2.2,
        boxShadow: pressed ? "0 1px 0 #27232B" : "0 4px 0 #27232B",
        height: 54,
        justifyContent: "center",
        transform: [{ translateY: pressed ? 3 : 0 }],
        width: 42,
      })}
    >
      <View
        style={{
          borderColor: colors.ink,
          borderRadius: 7,
          borderWidth: 1.5,
          height: 38,
          overflow: "hidden",
          width: 22,
        }}
      >
        {alloys.map((item, index) => (
          <View
            key={item.label}
            style={{
              backgroundColor: item.color,
              flex: 1,
              opacity: alloy === index ? 1 : 0.46,
            }}
          />
        ))}
      </View>
    </Pressable>
  );
}

function PermissionScreen({ onRequest }: { onRequest: () => void }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: colors.cream,
        flex: 1,
        justifyContent: "center",
        paddingHorizontal: 28,
      }}
    >
      <Pressable
        accessibilityLabel="Go back"
        onPress={() => router.back()}
        style={{ left: 14, padding: 14, position: "absolute", top: insets.top }}
      >
        <SfIcon name="chevron.left" size={22} />
      </Pressable>
      <View
        style={{
          alignItems: "center",
          backgroundColor: colors.yellow,
          borderColor: colors.ink,
          borderRadius: 32,
          borderWidth: 2.5,
          boxShadow: "7px 8px 0 #27232B",
          height: 104,
          justifyContent: "center",
          transform: [{ rotate: "-3deg" }],
          width: 104,
        }}
      >
        <SfIcon name="camera.fill" size={42} />
      </View>
      <Text
        selectable
        style={{
          color: colors.ink,
          fontSize: 31,
          fontWeight: "900",
          paddingTop: 34,
          textAlign: "center",
        }}
      >
        Open the pocket foundry
      </Text>
      <Text
        selectable
        style={{
          color: "#665F67",
          fontSize: 15,
          lineHeight: 22,
          maxWidth: 320,
          paddingTop: 11,
          textAlign: "center",
        }}
      >
        Point the camera at one everyday object. Apple Vision cuts it out
        on-device, then Metal turns it into a shiny toy relic.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRequest}
        style={({ pressed }) => ({
          backgroundColor: colors.blue,
          borderColor: colors.ink,
          borderRadius: 99,
          borderWidth: 2.5,
          boxShadow: pressed ? "0 2px 0 #27232B" : "0 6px 0 #27232B",
          marginTop: 30,
          paddingHorizontal: 28,
          paddingVertical: 15,
          transform: [{ translateY: pressed ? 4 : 0 }],
        })}
      >
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 14,
            fontWeight: "900",
            letterSpacing: 0.8,
          }}
        >
          LET&apos;S FIND SOMETHING
        </Text>
      </Pressable>
    </View>
  );
}

export function RelicLiftCamera() {
  const cameraRef = useRef<SkiaCameraRef>(null);
  const captureTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestedPermission = useRef(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const { canRequestPermission, hasPermission, requestPermission } =
    useCameraPermission();
  const device = useCameraDevice("back", { physicalDevices: ["wide-angle"] });

  const [screenActive, setScreenActive] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [captureUri, setCaptureUri] = useState<string | null>(null);
  const [subject, setSubject] = useState<LiftedSubject | null>(null);
  const [phase, setPhase] = useState<Phase>("searching");
  const [alloy, setAlloy] = useState(0);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [kept, setKept] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const scanner = useSharedValue(0);
  const lockProgress = useSharedValue(0);
  const lift = useSharedValue(0);
  const stageOpacity = useSharedValue(0);
  const shutterScale = useSharedValue(1);

  const bodyWidth = width - 24;
  const footerReserve = 86;
  const availableBodyHeight =
    height - insets.top - insets.bottom - 64 - footerReserve;
  const bodyHeight = Math.min(
    bodyWidth * 1.34,
    Math.max(440, availableBodyHeight),
  );
  const previewWidth = bodyWidth - 22;
  const previewHeight = bodyHeight - 93;
  const targetWidth = Math.min(previewWidth * 0.63, 242);
  const targetHeight = targetWidth * 0.94;
  const cameraZoom = zoomStops[zoomIndex];

  const subjectAspect = subject
    ? subject.width / Math.max(1, subject.height)
    : 0.78;
  const subjectMaxWidth = previewWidth * 0.79;
  const subjectMaxHeight = previewHeight * 0.72;
  const subjectWidth =
    subjectAspect > subjectMaxWidth / subjectMaxHeight
      ? subjectMaxWidth
      : subjectMaxHeight * subjectAspect;
  const subjectHeight =
    subjectAspect > subjectMaxWidth / subjectMaxHeight
      ? subjectMaxWidth / subjectAspect
      : subjectMaxHeight;

  useFocusEffect(
    useCallback(() => {
      setScreenActive(true);
      return () => setScreenActive(false);
    }, []),
  );

  useEffect(() => {
    if (hasPermission || !canRequestPermission || requestedPermission.current)
      return;
    requestedPermission.current = true;
    requestPermission().catch(() => undefined);
  }, [canRequestPermission, hasPermission, requestPermission]);

  useEffect(() => {
    scanner.value = withRepeat(
      withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => {
      if (captureTimer.current) clearTimeout(captureTimer.current);
    };
  }, [scanner]);

  const onFrame = useCallback<SkiaCameraProps["onFrame"]>(
    (frame, render) => {
      "worklet";
      try {
        const time = frame.timestamp % 3600;
        render(({ canvas, frameTexture }) => {
          const source = frameTexture.makeShaderOptions(
            TileMode.Clamp,
            TileMode.Clamp,
            FilterMode.Linear,
            MipmapMode.None,
          );
          const shader = relicPreviewEffect.makeShaderWithChildren(
            [
              frame.width,
              frame.height,
              time,
              phase === "locking" ? 1 : 0,
              cameraZoom,
            ],
            [source],
          );
          relicPreviewPaint.setShader(shader);
          canvas.drawRect(
            { height: frame.height, width: frame.width, x: 0, y: 0 },
            relicPreviewPaint,
          );
          relicPreviewPaint.setShader(null);
          shader.dispose();
          source.dispose();
        });
      } finally {
        frame.dispose();
      }
    },
    [cameraZoom, phase],
  );

  const scanStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scanner.value, [0, 0.08, 0.92, 1], [0, 0.88, 0.88, 0]),
    transform: [
      { translateY: interpolate(scanner.value, [0, 1], [0, targetHeight]) },
    ],
  }));
  const progressStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: lockProgress.value }],
  }));
  const liftStyle = useAnimatedStyle(() => ({
    opacity: interpolate(lift.value, [0, 0.12, 1], [0, 1, 1]),
    transform: [
      { translateY: interpolate(lift.value, [0, 1], [86, -10]) },
      { scale: interpolate(lift.value, [0, 0.75, 1], [0.62, 1.06, 1]) },
      { rotateZ: `${interpolate(lift.value, [0, 1], [5, -1.8])}deg` },
    ],
  }));
  const stageStyle = useAnimatedStyle(() => ({ opacity: stageOpacity.value }));
  const shutterStyle = useAnimatedStyle(() => ({
    transform: [{ scale: shutterScale.value }],
  }));

  const finishCapture = useCallback(async () => {
    try {
      const snapshot = cameraRef.current?.takeSnapshot();
      if (!snapshot) throw new Error("No camera frame is ready yet.");
      const bytes = snapshot.encodeToBytes(ImageFormat.JPEG, 96);
      snapshot.dispose();
      const file = new File(Paths.cache, `relic-source-${Date.now()}.jpg`);
      file.create({ overwrite: true });
      file.write(bytes);
      setCaptureUri(file.uri);
      setPhase("extracting");

      const liftedSubject = await liftSubjectAsync(file.uri);
      setSubject(liftedSubject);
      setPhase("lifted");
      // eslint-disable-next-line react-hooks/immutability
      stageOpacity.value = withTiming(1, { duration: 360 });
      // eslint-disable-next-line react-hooks/immutability
      lift.value = withDelay(
        90,
        withSpring(1, { damping: 14, mass: 0.85, stiffness: 150 }),
      );
      if (process.env.EXPO_OS === "ios") {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => undefined);
      }
    } catch (captureError) {
      setError(
        captureError instanceof Error
          ? captureError.message
          : "No subject was found. Try a simpler background.",
      );
      setCaptureUri(null);
      setPhase("searching");
      if (process.env.EXPO_OS === "ios") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => undefined,
        );
      }
    }
  }, [lift, stageOpacity]);

  const beginCapture = useCallback(() => {
    if (!cameraReady || phase !== "searching") return;
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    setError(null);
    setPhase("locking");
    // eslint-disable-next-line react-hooks/immutability
    lockProgress.value = 0;
    lockProgress.value = withTiming(1, {
      duration: 720,
      easing: Easing.out(Easing.cubic),
    });
    // eslint-disable-next-line react-hooks/immutability
    shutterScale.value = withSequence(
      withTiming(0.88, { duration: 70 }),
      withSpring(1, { damping: 10, stiffness: 290 }),
    );
    captureTimer.current = setTimeout(() => void finishCapture(), 740);
  }, [cameraReady, finishCapture, lockProgress, phase, shutterScale]);

  const reset = useCallback(() => {
    if (captureTimer.current) clearTimeout(captureTimer.current);
    haptic();
    setCaptureUri(null);
    setSubject(null);
    setError(null);
    setPhase("searching");
    // eslint-disable-next-line react-hooks/immutability
    lift.value = 0;
    // eslint-disable-next-line react-hooks/immutability
    stageOpacity.value = 0;
    // eslint-disable-next-line react-hooks/immutability
    lockProgress.value = 0;
  }, [lift, lockProgress, stageOpacity]);

  const keepRelic = useCallback(() => {
    setKept((value) => value + 1);
    if (process.env.EXPO_OS === "ios") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
    }
    reset();
  }, [reset]);

  const shareSubject = useCallback(() => {
    if (!subject) return;
    haptic();
    Share.share({
      message: `Pocket Foundry relic ${kept + 1} · ${alloys[alloy].label.toLowerCase()} finish`,
      url: subject.uri,
    }).catch(() => undefined);
  }, [alloy, kept, subject]);

  const showHelp = useCallback(() => {
    haptic();
    Alert.alert(
      "Make a clean lift",
      "Use one object on a simple, contrasting background. Keep it inside the white corners and hold still while Apple Vision separates the foreground.",
      [{ text: "Ready!" }],
    );
  }, []);

  if (!hasPermission)
    return <PermissionScreen onRequest={() => requestPermission()} />;

  return (
    <View
      style={{
        backgroundColor: colors.cream,
        flex: 1,
        paddingBottom: Math.max(insets.bottom, 8),
        paddingTop: insets.top + 1,
      }}
    >
      <View
        pointerEvents="none"
        style={{
          backgroundColor: "#DCE7FF",
          borderRadius: 140,
          height: 280,
          left: -155,
          position: "absolute",
          top: 100,
          width: 280,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          backgroundColor: "#FFE0D3",
          borderRadius: 150,
          bottom: -160,
          height: 300,
          position: "absolute",
          right: -125,
          width: 300,
        }}
      />

      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          height: 57,
          justifyContent: "space-between",
          paddingHorizontal: 13,
        }}
      >
        <RoundButton
          accessibilityLabel="Go back"
          icon="chevron.left"
          onPress={() => router.back()}
          size={42}
        />
        <View style={{ alignItems: "center", gap: 1 }}>
          <Text
            style={{
              color: colors.ink,
              fontSize: 18,
              fontWeight: "900",
              letterSpacing: -0.4,
            }}
          >
            Pocket Foundry
          </Text>
          <Text
            style={{
              color: "#766E72",
              fontSize: 8,
              fontWeight: "900",
              letterSpacing: 1.4,
            }}
          >
            LIFT · POLISH · KEEP
          </Text>
        </View>
        <View
          style={{
            alignItems: "center",
            backgroundColor: colors.green,
            borderColor: colors.ink,
            borderRadius: 14,
            borderWidth: 2,
            minWidth: 44,
            paddingHorizontal: 8,
            paddingVertical: 5,
            transform: [{ rotate: "2deg" }],
          }}
        >
          <Text
            style={{
              color: colors.ink,
              fontSize: 14,
              fontVariant: ["tabular-nums"],
              fontWeight: "900",
            }}
          >
            {kept.toString().padStart(2, "0")}
          </Text>
          <Text
            style={{
              color: colors.ink,
              fontSize: 6,
              fontWeight: "900",
              letterSpacing: 0.8,
            }}
          >
            KEPT
          </Text>
        </View>
      </View>

      <View
        style={{
          marginTop: 20,
          alignSelf: "center",
          backgroundColor: colors.yellow,
          borderColor: colors.ink,
          borderCurve: "continuous",
          borderRadius: 34,
          borderWidth: 2.5,
          boxShadow: "0 9px 0 #27232B",
          height: bodyHeight + 20,
          padding: 9,
          width: bodyWidth,
        }}
      >
        <View
          style={{
            backgroundColor: "#161619",
            borderColor: colors.ink,
            borderCurve: "continuous",
            borderRadius: 25,
            borderWidth: 2.2,
            height: previewHeight,
            overflow: "hidden",
            width: previewWidth,
          }}
        >
          {device ? (
            <SkiaCamera
              constraints={cameraConstraints}
              device={device}
              enablePhysicalBufferRotation
              enablePreviewSizedOutputBuffers
              enableSmoothAutoFocus={
                device.supportsSmoothAutoFocus ? true : undefined
              }
              isActive={
                screenActive && (phase === "searching" || phase === "locking")
              }
              mirrorMode="auto"
              onError={(cameraError) => setError(cameraError.message)}
              onFrame={onFrame}
              onStarted={() => {
                setCameraReady(true);
                setError(null);
              }}
              pixelFormat="yuv"
              ref={cameraRef}
              style={{ flex: 1 }}
            />
          ) : (
            <View
              style={{
                alignItems: "center",
                backgroundColor: "#EDE8DC",
                flex: 1,
                gap: 9,
                justifyContent: "center",
              }}
            >
              <ActivityIndicator color={colors.blue} />
              <Text
                style={{
                  color: colors.ink,
                  fontSize: 9,
                  fontWeight: "900",
                  letterSpacing: 1.2,
                }}
              >
                A REAL CAMERA IS NEEDED
              </Text>
            </View>
          )}

          {captureUri ? (
            <Animated.View
              entering={FadeIn.duration(100)}
              exiting={FadeOut.duration(90)}
              style={{ inset: 0, position: "absolute" }}
            >
              <Image
                contentFit="cover"
                source={{ uri: captureUri }}
                style={{ flex: 1 }}
              />
            </Animated.View>
          ) : null}

          {phase === "searching" ? (
            <Pressable
              onPress={(event) => {
                haptic();
                cameraRef.current
                  ?.focusTo({
                    x: event.nativeEvent.locationX,
                    y: event.nativeEvent.locationY,
                  })
                  .catch(() => undefined);
              }}
              style={{ inset: 0, position: "absolute" }}
            />
          ) : null}

          <Animated.View
            pointerEvents="none"
            style={[
              { backgroundColor: colors.stage, inset: 0, position: "absolute" },
              stageStyle,
            ]}
          >
            <View
              style={{
                backgroundColor: colors.blue,
                borderRadius: 9,
                height: 18,
                left: 22,
                position: "absolute",
                top: 25,
                transform: [{ rotate: "-12deg" }],
                width: 18,
              }}
            />
            <View
              style={{
                backgroundColor: colors.blush,
                borderRadius: 99,
                height: 14,
                position: "absolute",
                right: 28,
                top: 60,
                width: 14,
              }}
            />
            <View
              style={{
                backgroundColor: colors.green,
                bottom: 39,
                height: 11,
                left: 34,
                position: "absolute",
                transform: [{ rotate: "22deg" }],
                width: 26,
              }}
            />
            <View
              style={{
                backgroundColor: "#F2B835",
                bottom: 28,
                borderRadius: 99,
                height: 17,
                position: "absolute",
                right: 45,
                width: 17,
              }}
            />
            <View
              style={{
                alignSelf: "center",
                backgroundColor: "rgba(79,57,40,0.16)",
                borderRadius: 99,
                bottom: previewHeight * 0.14,
                height: 18,
                position: "absolute",
                width: subjectWidth * 0.72,
              }}
            />
          </Animated.View>

          {phase !== "lifted" ? (
            <View
              pointerEvents="none"
              style={{
                alignSelf: "center",
                height: targetHeight,
                position: "absolute",
                top: (previewHeight - targetHeight) / 2,
                width: targetWidth,
              }}
            >
              <TargetCorners />
              <Animated.View
                style={[
                  {
                    backgroundColor: "#FFFFFF",
                    boxShadow: "0 0 11px rgba(255,255,255,0.8)",
                    height: 2,
                    left: 9,
                    position: "absolute",
                    right: 9,
                    top: 0,
                  },
                  scanStyle,
                ]}
              />
              <View
                style={{
                  alignSelf: "center",
                  backgroundColor: "#FFFFFF",
                  borderColor: colors.ink,
                  borderRadius: 99,
                  borderWidth: 1.5,
                  bottom: 13,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  position: "absolute",
                }}
              >
                <Text
                  style={{
                    color: colors.ink,
                    fontSize: 8,
                    fontWeight: "900",
                    letterSpacing: 1,
                  }}
                >
                  {phase === "searching"
                    ? "ONE OBJECT, RIGHT HERE"
                    : phase === "locking"
                      ? "HOLD IT STILL!"
                      : "LIFTING THE SUBJECT…"}
                </Text>
              </View>
            </View>
          ) : null}

          {phase === "extracting" ? (
            <Animated.View
              entering={FadeIn.duration(120)}
              style={{
                alignItems: "center",
                backgroundColor: "rgba(255,248,232,0.84)",
                inset: 0,
                justifyContent: "center",
                position: "absolute",
              }}
            >
              <View
                style={{
                  alignItems: "center",
                  backgroundColor: colors.paper,
                  borderColor: colors.ink,
                  borderRadius: 25,
                  borderWidth: 2,
                  gap: 10,
                  paddingHorizontal: 22,
                  paddingVertical: 17,
                  transform: [{ rotate: "-2deg" }],
                }}
              >
                <ActivityIndicator color={colors.blue} />
                <Text
                  style={{
                    color: colors.ink,
                    fontSize: 11,
                    fontWeight: "900",
                    letterSpacing: 1,
                  }}
                >
                  APPLE VISION IS CUTTING…
                </Text>
              </View>
            </Animated.View>
          ) : null}

          {phase === "lifted" && subject ? (
            <Animated.View
              style={[
                {
                  alignSelf: "center",
                  height: subjectHeight,
                  position: "absolute",
                  top: (previewHeight - subjectHeight) / 2,
                  width: subjectWidth,
                },
                liftStyle,
              ]}
            >
              <NativeMetalSubjectView
                alloy={alloy}
                source={subject.uri}
                style={{ flex: 1 }}
              />
            </Animated.View>
          ) : null}

          {phase === "lifted" && subject?.backgroundRemoved ? (
            <Animated.View
              entering={FadeIn.delay(420).duration(180)}
              style={{
                alignItems: "center",
                alignSelf: "center",
                backgroundColor: colors.paper,
                borderColor: colors.ink,
                borderRadius: 99,
                borderWidth: 1.5,
                flexDirection: "row",
                gap: 5,
                paddingHorizontal: 10,
                paddingVertical: 6,
                position: "absolute",
                top: 14,
              }}
            >
              <SfIcon
                color={colors.green}
                name="checkmark.seal.fill"
                size={13}
              />
              <Text
                style={{
                  color: colors.ink,
                  fontSize: 7,
                  fontWeight: "900",
                  letterSpacing: 0.8,
                }}
              >
                BACKGROUND REMOVED
              </Text>
            </Animated.View>
          ) : null}

          {phase === "locking" ? (
            <View
              style={{
                backgroundColor: "rgba(255,255,255,0.38)",
                bottom: 0,
                height: 6,
                left: 0,
                overflow: "hidden",
                position: "absolute",
                right: 0,
              }}
            >
              <Animated.View
                style={[
                  {
                    backgroundColor: colors.blue,
                    height: 6,
                    transformOrigin: "left",
                  },
                  progressStyle,
                ]}
              />
            </View>
          ) : null}

          {error ? (
            <Animated.View
              entering={FadeIn.duration(120)}
              style={{
                alignSelf: "center",
                backgroundColor: colors.blush,
                borderColor: colors.ink,
                borderRadius: 99,
                borderWidth: 1.5,
                bottom: 12,
                maxWidth: "86%",
                paddingHorizontal: 12,
                paddingVertical: 7,
                position: "absolute",
              }}
            >
              <Text
                selectable
                style={{
                  color: colors.ink,
                  fontSize: 8,
                  fontWeight: "900",
                  letterSpacing: 0.5,
                }}
              >
                {error.toUpperCase()}
              </Text>
            </Animated.View>
          ) : null}
        </View>

        <View
          style={{
            alignItems: "center",
            flex: 1,
            flexDirection: "row",
            justifyContent: "space-around",
            paddingHorizontal: 6,
          }}
        >
          {phase === "lifted" ? (
            <>
              <RoundButton
                accessibilityLabel="Try another object"
                icon="xmark"
                onPress={reset}
              />
              <Pressable
                accessibilityLabel="Keep relic"
                accessibilityRole="button"
                onPress={keepRelic}
                style={({ pressed }) => ({
                  alignItems: "center",
                  backgroundColor: colors.green,
                  borderColor: colors.ink,
                  borderRadius: 31,
                  borderWidth: 2.5,
                  boxShadow: pressed ? "0 2px 0 #27232B" : "0 5px 0 #27232B",
                  flexDirection: "row",
                  gap: 8,
                  height: 60,
                  justifyContent: "center",
                  paddingHorizontal: 25,
                  transform: [{ translateY: pressed ? 3 : 0 }],
                })}
              >
                <SfIcon name="checkmark" size={20} />
                <Text
                  style={{
                    color: colors.ink,
                    fontSize: 12,
                    fontWeight: "900",
                    letterSpacing: 0.8,
                  }}
                >
                  KEEP IT
                </Text>
              </Pressable>
              <RoundButton
                accessibilityLabel="Share subject"
                icon="square.and.arrow.up"
                onPress={shareSubject}
              />
            </>
          ) : (
            <>
              <Pressable
                accessibilityLabel={`Zoom ${cameraZoom} times`}
                onPress={() => {
                  haptic();
                  setZoomIndex((value) => (value + 1) % zoomStops.length);
                }}
                style={({ pressed }) => ({
                  alignItems: "center",
                  backgroundColor: colors.paper,
                  borderColor: colors.ink,
                  borderRadius: 25,
                  borderWidth: 2.2,
                  boxShadow: pressed ? "0 1px 0 #27232B" : "0 4px 0 #27232B",
                  height: 50,
                  justifyContent: "center",
                  transform: [{ translateY: pressed ? 3 : 0 }],
                  width: 50,
                })}
              >
                <Text
                  style={{
                    color: colors.ink,
                    fontSize: 11,
                    fontVariant: ["tabular-nums"],
                    fontWeight: "900",
                  }}
                >
                  {cameraZoom.toFixed(1)}×
                </Text>
              </Pressable>
              <Animated.View style={shutterStyle}>
                <Pressable
                  accessibilityLabel="Lift the object"
                  accessibilityRole="button"
                  disabled={!cameraReady || phase !== "searching"}
                  onPress={beginCapture}
                  style={({ pressed }) => ({
                    alignItems: "center",
                    backgroundColor:
                      phase === "locking" ? colors.blush : colors.paper,
                    borderColor: colors.ink,
                    borderRadius: 35,
                    borderWidth: 3,
                    boxShadow: pressed ? "0 2px 0 #27232B" : "0 6px 0 #27232B",
                    height: 70,
                    justifyContent: "center",
                    opacity: !cameraReady ? 0.52 : 1,
                    transform: [{ translateY: pressed ? 4 : 0 }],
                    width: 70,
                  })}
                >
                  {phase === "locking" ? (
                    <ActivityIndicator color={colors.ink} />
                  ) : (
                    <SfIcon name="camera.fill" size={28} />
                  )}
                </Pressable>
              </Animated.View>
              <SwatchWheel
                alloy={alloy}
                onPress={() => {
                  haptic();
                  setAlloy((value) => (value + 1) % alloys.length);
                }}
              />
            </>
          )}
        </View>
      </View>

      <View
        style={{
          alignItems: "center",
          flex: 1,
          gap: 8,
          justifyContent: "center",
          minHeight: footerReserve,
          paddingHorizontal: 18,
          paddingTop: 13,
        }}
      >
        {phase === "lifted" ? (
          <Animated.View
            entering={FadeIn.duration(190)}
            style={{ alignItems: "center", flexDirection: "row", gap: 8 }}
          >
            {alloys.map((item, index) => (
              <Pressable
                accessibilityRole="button"
                key={item.label}
                onPress={() => {
                  haptic();
                  setAlloy(index);
                }}
                style={({ pressed }) => ({
                  alignItems: "center",
                  backgroundColor: alloy === index ? item.color : colors.paper,
                  borderColor: colors.ink,
                  borderRadius: 16,
                  borderWidth: alloy === index ? 2.5 : 1.5,
                  minWidth: 94,
                  opacity: pressed ? 0.62 : 1,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  transform: [
                    { rotate: `${index === 0 ? -2 : index === 2 ? 2 : 0}deg` },
                  ],
                })}
              >
                <Text
                  style={{
                    color: colors.ink,
                    fontSize: 10,
                    fontWeight: "900",
                    letterSpacing: 0.7,
                  }}
                >
                  {item.label}
                </Text>
                <Text style={{ color: "#675F66", fontSize: 7, paddingTop: 1 }}>
                  {item.detail}
                </Text>
              </Pressable>
            ))}
          </Animated.View>
        ) : (
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <View
              style={{
                backgroundColor: alloys[alloy].color,
                borderColor: colors.ink,
                borderRadius: 99,
                borderWidth: 1.5,
                height: 12,
                width: 12,
              }}
            />
            <Text
              style={{ color: colors.ink, fontSize: 11, fontWeight: "900" }}
            >
              Center one object, then tap the camera
            </Text>
            <Pressable
              accessibilityLabel="Show subject lift tips"
              hitSlop={10}
              onPress={showHelp}
            >
              <SfIcon name="questionmark.circle.fill" size={18} />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}
