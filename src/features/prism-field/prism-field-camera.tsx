import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCameraPermission } from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';

import {
  PrismNativeCamera,
  type PrismControlStateEvent,
  type PrismMotionEvent,
  type PrismPressEvent,
  type PrismReadyEvent,
} from '@/features/prism-field/prism-field-native';

const ink = '#061317';
const card = '#0B1B20';
const paper = '#F4F1EA';
const mint = '#B6FFB9';
const muted = '#657176';

type PaymentState = 'selecting' | 'armed' | 'review' | 'sending' | 'sent';

function haptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(style).catch(() => undefined);
}

function SfIcon({ color = paper, name, size = 19 }: { color?: string; name: string; size?: number }) {
  return (
    <Image
      contentFit="contain"
      source={`sf:${name}`}
      style={{ height: size, tintColor: color, width: size }}
    />
  );
}

function CloseButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Close Quick Pay"
      accessibilityRole="button"
      hitSlop={12}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: pressed ? '#173038' : '#0D2228',
        borderRadius: 19,
        height: 38,
        justifyContent: 'center',
        opacity: pressed ? 0.72 : 1,
        transform: [{ scale: pressed ? 0.94 : 1 }],
        width: 38,
      })}>
      <SfIcon name="xmark" size={14} />
    </Pressable>
  );
}

function PermissionScreen({ onRequest }: { onRequest: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: ink, flex: 1, paddingHorizontal: 26 }}>
      <View style={{ left: 20, position: 'absolute', top: insets.top + 10 }}>
        <CloseButton onPress={() => router.back()} />
      </View>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <View
          style={{
            alignItems: 'center',
            borderColor: mint,
            borderRadius: 26,
            borderWidth: 1,
            height: 52,
            justifyContent: 'center',
            width: 52,
          }}>
          <SfIcon color={mint} name="button.horizontal.top.press" size={23} />
        </View>
        <Text style={{ color: paper, fontSize: 34, fontWeight: '600', letterSpacing: -1.2, paddingTop: 25 }}>
          Enable Camera Control
        </Text>
        <Text style={{ color: '#829096', fontSize: 15, lineHeight: 23, maxWidth: 350, paddingTop: 13 }}>
          iOS only delivers Camera Control presses while a capture session is active. Quick Pay never
          displays, stores, or processes the camera image.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onRequest}
          style={({ pressed }) => ({
            alignItems: 'center',
            alignSelf: 'flex-start',
            backgroundColor: paper,
            borderRadius: 99,
            marginTop: 26,
            opacity: pressed ? 0.72 : 1,
            paddingHorizontal: 19,
            paddingVertical: 13,
          })}>
          <Text style={{ color: ink, fontSize: 14, fontWeight: '700' }}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SideRail({ amount, onChange }: { amount: number; onChange: (value: number) => void }) {
  const railHeight = 300;
  const lastValue = useSharedValue(amount);
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin((event) => {
          const next = Math.max(1, Math.min(50, Math.round((1 - event.y / railHeight) * 49 + 1)));
          // eslint-disable-next-line react-hooks/immutability
          lastValue.value = next;
          scheduleOnRN(onChange, next);
        })
        .onUpdate((event) => {
          const next = Math.max(1, Math.min(50, Math.round((1 - event.y / railHeight) * 49 + 1)));
          if (next === lastValue.value) return;
          // eslint-disable-next-line react-hooks/immutability
          lastValue.value = next;
          scheduleOnRN(onChange, next);
        }),
    [lastValue, onChange],
  );

  return (
    <GestureDetector gesture={gesture}>
      <View
        accessibilityLabel={`Payment amount ${amount} dollars. Swipe vertically to adjust.`}
        accessibilityRole="adjustable"
        style={{ alignItems: 'flex-end', height: railHeight, justifyContent: 'space-between', paddingVertical: 4, width: 42 }}>
        {Array.from({ length: 21 }, (_, index) => {
          const progress = 1 - index / 20;
          const active = Math.abs(progress - (amount - 1) / 49) < 0.03;
          return (
            <View
              key={index}
              style={{
                backgroundColor: active ? paper : '#415158',
                borderRadius: 2,
                height: active ? 3 : 1,
                opacity: active ? 1 : 0.72,
                width: active ? 27 : index % 4 === 0 ? 13 : 7,
              }}
            />
          );
        })}
      </View>
    </GestureDetector>
  );
}

function AmbientField({ motionX, motionY }: { motionX: SharedValue<number>; motionY: SharedValue<number> }) {
  const dots = useMemo(
    () => [
      [0.16, 0.2, 1], [0.81, 0.17, 1], [0.73, 0.32, 2], [0.21, 0.43, 1], [0.9, 0.58, 1],
      [0.31, 0.7, 1], [0.72, 0.78, 1], [0.14, 0.86, 2], [0.88, 0.9, 1], [0.5, 0.14, 1],
      [0.54, 0.84, 1], [0.09, 0.58, 1], [0.63, 0.46, 1], [0.39, 0.29, 1],
    ],
    [],
  );
  const nearStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: motionX.value * 14 }, { translateY: motionY.value * 10 }],
  }));
  const farStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: motionX.value * -7 }, { translateY: motionY.value * -5 }],
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {dots.map(([x, y, size], index) => (
        <Animated.View
          key={index}
          style={[
            {
              backgroundColor: index % 5 === 0 ? mint : '#8DA1A8',
              borderRadius: size,
              height: size,
              left: `${x * 100}%`,
              opacity: index % 5 === 0 ? 0.45 : 0.24,
              position: 'absolute',
              top: `${y * 100}%`,
              width: size,
            },
            index % 2 === 0 ? nearStyle : farStyle,
          ]}
        />
      ))}
    </View>
  );
}

export function PrismFieldCamera() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { canRequestPermission, hasPermission, requestPermission } = useCameraPermission();
  const [active, setActive] = useState(true);
  const [amount, setAmount] = useState(20);
  const [cameraControl, setCameraControl] = useState(false);
  const [controlActive, setControlActive] = useState(false);
  const [paymentState, setPaymentState] = useState<PaymentState>('selecting');
  const [error, setError] = useState<string | null>(null);
  const amountPulse = useSharedValue(0);
  const pressScale = useSharedValue(1);
  const motionX = useSharedValue(0);
  const motionY = useSharedValue(0);
  const sendProgress = useSharedValue(0);
  const stateRef = useRef<PaymentState>('selecting');
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateState = useCallback((next: PaymentState) => {
    stateRef.current = next;
    setPaymentState(next);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setActive(true);
      return () => setActive(false);
    }, []),
  );

  useEffect(
    () => () => {
      if (expiryTimer.current) clearTimeout(expiryTimer.current);
      if (sendTimer.current) clearTimeout(sendTimer.current);
    },
    [],
  );

  const changeAmount = useCallback(
    (value: number) => {
      const next = Math.max(1, Math.min(50, Math.round(value)));
      setAmount((current) => {
        if (current === next) return current;
        haptic(Haptics.ImpactFeedbackStyle.Soft);
        return next;
      });
      if (stateRef.current === 'armed') updateState('selecting');
      // eslint-disable-next-line react-hooks/immutability
      amountPulse.value = withSequence(withTiming(1, { duration: 45 }), withTiming(0, { duration: 170 }));
    },
    [amountPulse, updateState],
  );

  const completePayment = useCallback(() => {
    if (sendTimer.current) clearTimeout(sendTimer.current);
    if (expiryTimer.current) clearTimeout(expiryTimer.current);
    updateState('sending');
    haptic(Haptics.ImpactFeedbackStyle.Rigid);
    // eslint-disable-next-line react-hooks/immutability
    sendProgress.value = withTiming(1, { duration: 720, easing: Easing.inOut(Easing.cubic) });
    sendTimer.current = setTimeout(() => {
      updateState('sent');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }, 760);
  }, [sendProgress, updateState]);

  const showReview = useCallback(() => {
    if (expiryTimer.current) clearTimeout(expiryTimer.current);
    updateState('review');
    haptic(Haptics.ImpactFeedbackStyle.Medium);
  }, [updateState]);

  const advanceWithTouch = useCallback(() => {
    const current = stateRef.current;
    if (current === 'review') {
      completePayment();
      return;
    }
    if (current === 'armed') {
      showReview();
      return;
    }
    if (current !== 'selecting') return;
    updateState('armed');
    haptic(Haptics.ImpactFeedbackStyle.Heavy);
    if (expiryTimer.current) clearTimeout(expiryTimer.current);
    expiryTimer.current = setTimeout(() => {
      if (stateRef.current === 'armed') updateState('selecting');
    }, 850);
  }, [completePayment, showReview, updateState]);

  const onCapturePress = useCallback(
    (event: PrismPressEvent) => {
      if (event.phase === 'began') {
        // eslint-disable-next-line react-hooks/immutability
        pressScale.value = withTiming(0.965, { duration: 80 });
      } else if (event.phase === 'ended' || event.phase === 'cancelled') {
        pressScale.value = withSpring(1, { damping: 13, stiffness: 260 });
      } else if (event.phase === 'armed' && stateRef.current === 'selecting') {
        updateState('armed');
        haptic(Haptics.ImpactFeedbackStyle.Heavy);
      } else if (event.phase === 'expired' && stateRef.current === 'armed') {
        updateState('selecting');
      } else if (event.phase === 'double') {
        if (stateRef.current === 'review') completePayment();
        else if (stateRef.current === 'selecting' || stateRef.current === 'armed') showReview();
      }
    },
    [completePayment, pressScale, showReview, updateState],
  );

  const onMotion = useCallback(
    (event: PrismMotionEvent) => {
      // eslint-disable-next-line react-hooks/immutability
      motionX.value = motionX.value * 0.8 + event.x * 0.2;
      // eslint-disable-next-line react-hooks/immutability
      motionY.value = motionY.value * 0.8 + event.y * 0.2;
    },
    [motionX, motionY],
  );

  const onControlState = useCallback((event: PrismControlStateEvent) => {
    setControlActive(event.state !== 'inactive');
  }, []);

  const onReady = useCallback((event: PrismReadyEvent) => {
    setCameraControl(event.cameraControl);
    setError(null);
  }, []);

  const amountStyle = useAnimatedStyle(() => ({
    opacity: interpolate(amountPulse.value, [0, 1], [1, 0.68]),
    transform: [{ scale: interpolate(amountPulse.value, [0, 1], [1, 0.95]) }],
  }));
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: pressScale.value }] }));
  const paymentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sendProgress.value, [0, 0.2, 0.82, 1], [1, 1, 0.28, 0]),
    transform: [
      { translateY: interpolate(sendProgress.value, [0, 1], [0, -height * 0.27]) },
      { scale: interpolate(sendProgress.value, [0, 1], [1, 0.34]) },
    ],
  }));

  if (!hasPermission) {
    return (
      <PermissionScreen
        onRequest={() => {
          if (canRequestPermission) requestPermission().catch(() => undefined);
        }}
      />
    );
  }

  const isReview = paymentState === 'review' || paymentState === 'sending';
  const isSent = paymentState === 'sent';

  return (
    <View style={{ backgroundColor: ink, flex: 1, overflow: 'hidden' }}>
      <PrismNativeCamera
        active={active}
        captureToken={0}
        fieldIndex={amount}
        onCapture={() => undefined}
        onCapturePress={onCapturePress}
        onControlState={onControlState}
        onError={setError}
        onFieldChange={changeAmount}
        onMotion={onMotion}
        onReady={onReady}
        onSpectrumChange={() => undefined}
        spectrumIndex={0}
        style={StyleSheet.absoluteFill}
      />

      <AmbientField motionX={motionX} motionY={motionY} />

      <View style={{ left: 20, position: 'absolute', top: insets.top + 10 }}>
        <CloseButton onPress={() => router.back()} />
      </View>
      <View style={{ alignItems: 'center', left: 0, position: 'absolute', right: 0, top: insets.top + 21 }}>
        <Text style={{ color: '#587077', fontSize: 9, fontWeight: '700', letterSpacing: 2.1 }}>QUICK PAY</Text>
      </View>

      {!isReview && !isSent ? (
        <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
          <Animated.View style={[{ alignItems: 'center', flexDirection: 'row' }, amountStyle, pressStyle]}>
            <Text style={{ color: paper, fontSize: 27, fontWeight: '300', paddingBottom: 23 }}>$</Text>
            <Text
              style={{
                color: paper,
                fontSize: height < 760 ? 80 : 98,
                fontVariant: ['tabular-nums'],
                fontWeight: '300',
                letterSpacing: -5,
              }}>
              {amount}
            </Text>
            <Animated.View
              entering={FadeIn.duration(180)}
              exiting={FadeOut.duration(120)}
              style={{ marginLeft: 14, width: 72 }}>
              <Text
                style={{
                  color: paymentState === 'armed' ? mint : controlActive ? '#AAB7BA' : muted,
                  fontSize: 8,
                  fontWeight: '700',
                  letterSpacing: 0.5,
                  lineHeight: 11,
                }}>
                {paymentState === 'armed' ? 'CLICK ONCE\nMORE' : 'DOUBLE CLICK\nTO PAY'}
              </Text>
            </Animated.View>
          </Animated.View>
          <Text style={{ color: '#40545A', fontSize: 8, fontWeight: '700', letterSpacing: 1.65, paddingTop: 19 }}>
            SLIDE CAMERA CONTROL
          </Text>
        </View>
      ) : null}

      {isReview ? (
        <Animated.View
          entering={FadeInDown.duration(430).springify().damping(17)}
          style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
          <Animated.View style={[{ alignItems: 'center' }, paymentStyle]}>
            <View style={{ alignItems: 'center', paddingBottom: 23 }}>
              <View
                style={{
                  alignItems: 'center',
                  backgroundColor: '#D7B08B',
                  borderColor: '#F3D6B8',
                  borderRadius: 29,
                  borderWidth: 1,
                  height: 58,
                  justifyContent: 'center',
                  width: 58,
                }}>
                <Text style={{ color: '#311F18', fontSize: 19, fontWeight: '700' }}>M</Text>
              </View>
              <Text style={{ color: paper, fontSize: 12, fontWeight: '600', paddingTop: 9 }}>Maya</Text>
            </View>

            <View
              style={{
                backgroundColor: card,
                borderColor: '#17333A',
                borderRadius: 22,
                borderWidth: 1,
                height: 172,
                justifyContent: 'space-between',
                padding: 18,
                width: 300,
              }}>
              <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: '#7B8E93', fontSize: 8, fontWeight: '700', letterSpacing: 1.2 }}>QUICK PAY</Text>
                <View style={{ backgroundColor: mint, borderRadius: 4, height: 7, width: 7 }} />
              </View>
              <View style={{ alignItems: 'baseline', flexDirection: 'row', justifyContent: 'center' }}>
                <Text style={{ color: paper, fontSize: 19, fontWeight: '300' }}>$</Text>
                <Text style={{ color: paper, fontSize: 55, fontVariant: ['tabular-nums'], fontWeight: '300', letterSpacing: -2 }}>
                  {amount}
                </Text>
              </View>
              <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: '#64787E', fontSize: 8, letterSpacing: 1 }}>•• 4821</Text>
                <Text style={{ color: mint, fontSize: 8, fontWeight: '700', letterSpacing: 0.6 }}>
                  {paymentState === 'sending' ? 'SENDING' : 'DOUBLE CLICK TO SEND'}
                </Text>
              </View>
            </View>
          </Animated.View>
        </Animated.View>
      ) : null}

      {isSent ? (
        <Animated.View
          entering={FadeInDown.duration(360).springify().damping(18)}
          style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
          <View
            style={{
              alignItems: 'center',
              borderColor: mint,
              borderRadius: 30,
              borderWidth: 1,
              height: 60,
              justifyContent: 'center',
              width: 60,
            }}>
            <SfIcon color={mint} name="checkmark" size={20} />
          </View>
          <Text style={{ color: paper, fontSize: 17, fontWeight: '500', letterSpacing: -0.3, paddingTop: 21 }}>
            Sent to Maya
          </Text>
          <Text style={{ color: muted, fontSize: 11, paddingTop: 6 }}>${amount} · just now</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              // eslint-disable-next-line react-hooks/immutability
              sendProgress.value = 0;
              updateState('selecting');
            }}
            style={({ pressed }) => ({
              backgroundColor: pressed ? '#173038' : '#0D2228',
              borderRadius: 99,
              marginTop: 31,
              opacity: pressed ? 0.72 : 1,
              paddingHorizontal: 17,
              paddingVertical: 10,
            })}>
            <Text style={{ color: paper, fontSize: 11, fontWeight: '600' }}>Send another</Text>
          </Pressable>
        </Animated.View>
      ) : null}

      {!cameraControl && !isSent && paymentState !== 'sending' ? (
        <>
          {!isReview ? (
            <View style={{ position: 'absolute', right: 10, top: height * 0.34 }}>
              <SideRail amount={amount} onChange={changeAmount} />
            </View>
          ) : null}
          <Pressable
            accessibilityLabel="Simulate Camera Control double click"
            accessibilityRole="button"
            onPress={advanceWithTouch}
            style={({ pressed }) => ({
              alignItems: 'center',
              alignSelf: 'center',
              backgroundColor: paymentState === 'armed' ? mint : '#0D2228',
              borderRadius: 99,
              bottom: insets.bottom + 24,
              opacity: pressed ? 0.65 : 1,
              paddingHorizontal: 18,
              paddingVertical: 11,
              position: 'absolute',
            })}>
            <Text style={{ color: paymentState === 'armed' ? ink : paper, fontSize: 10, fontWeight: '700' }}>
              {paymentState === 'review' ? 'Double tap to send' : paymentState === 'armed' ? 'Tap again' : 'Double tap'}
            </Text>
          </Pressable>
        </>
      ) : null}

      {error ? (
        <Animated.View
          entering={FadeIn.duration(160)}
          style={{ bottom: insets.bottom + 18, left: 22, position: 'absolute', right: 22 }}>
          <Text selectable style={{ color: '#FF9AA7', fontSize: 11, textAlign: 'center' }}>
            {error}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}
