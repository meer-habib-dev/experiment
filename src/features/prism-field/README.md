# Prism Field

An iOS camera experiment that maps Camera Control and device motion into a live prismatic capture
field.

## Demo

- **Route:** `/experiments/prism-field`
- **Platforms:** iOS; a motion-only fallback adapter exists for other platforms
- **Build:** iOS development build required for the complete experience

Grant camera access, tilt the device to bend the field, and use Camera Control on supported hardware
to tune or capture it. On unsupported devices, the interface exposes a simulation control.

## How it works

The React component owns permissions, controls, and overlay animation. `prism-field-native.ios.tsx`
bridges to the local `prism-field-camera` Expo module, which runs the capture session and native
composition. The universal adapter preserves the component contract without loading the iOS module.

## File map

- `prism-field-camera.tsx` — permission, interaction, and presentation coordinator.
- `prism-field-native.ios.tsx` — typed Expo module view adapter.
- `prism-field-native.tsx` — universal motion fallback.
- `modules/prism-field-camera` — Swift AVFoundation implementation.

## Constraints

Physical Camera Control input requires supported iPhone hardware and an active capture session.
Native module changes require rebuilding the iOS app. Keep capture data on-device.
