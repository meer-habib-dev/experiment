@preconcurrency import AVFoundation
@preconcurrency import AVKit
import CoreMotion
import ExpoModulesCore
import UIKit

/// A camera-free presentation backed by an active capture session solely so
/// iPhone Camera Control can deliver slide and full-press gestures. No preview
/// layer or camera pixels are exposed to React Native.
public final class PrismFieldCameraView: ExpoView, @unchecked Sendable {
  let onReady = EventDispatcher()
  let onError = EventDispatcher()
  let onFieldChange = EventDispatcher()
  let onSpectrumChange = EventDispatcher()
  let onControlState = EventDispatcher()
  let onMotion = EventDispatcher()
  let onCapture = EventDispatcher()
  let onCapturePress = EventDispatcher()

  nonisolated(unsafe) private let captureSession = AVCaptureSession()
  private let sessionQueue = DispatchQueue(label: "com.meernabib.nativelab.side-control")
  nonisolated(unsafe) private let motionManager = CMMotionManager()
  private var eventInteraction: AnyObject?
  nonisolated(unsafe) private var amountControl: AnyObject?
  nonisolated(unsafe) private var configured = false
  nonisolated(unsafe) private var active = true
  nonisolated(unsafe) private var amount = 20
  private var lastFullPressAt: TimeInterval?
  nonisolated(unsafe) private var pendingClickReset: DispatchWorkItem?

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .clear
    isOpaque = false
    configureCaptureInteraction()
    startMotion()
    configureSession()
  }

  deinit {
    pendingClickReset?.cancel()
    motionManager.stopDeviceMotionUpdates()
  }

  public override func didMoveToWindow() {
    super.didMoveToWindow()
#if targetEnvironment(simulator)
    guard window != nil else { return }
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
      self?.onReady(["cameraControl": false, "controlCount": 0, "device": "iPhone Simulator"])
    }
#endif
  }

  public func setActive(_ value: Bool) {
    guard active != value else { return }
    active = value
    sessionQueue.async { [weak self] in
      guard let self else { return }
      if value, self.configured, !self.captureSession.isRunning {
        self.captureSession.startRunning()
      } else if !value, self.captureSession.isRunning {
        self.captureSession.stopRunning()
      }
    }
  }

  public func setFieldIndex(_ value: Int) {
    let next = max(1, min(value, 50))
    amount = next
    if #available(iOS 18.0, *), let slider = amountControl as? AVCaptureSlider,
       abs(slider.value - Float(next)) > 0.01 {
      slider.value = Float(next)
    }
  }

  // Retained as no-ops so existing generated module bindings stay compatible.
  public func setSpectrumIndex(_ value: Int) {}
  public func setCaptureToken(_ value: Int) {}

  private func configureSession() {
#if targetEnvironment(simulator)
    configured = true
#else
    sessionQueue.async { [weak self] in
      guard let self else { return }
      do {
        self.captureSession.beginConfiguration()
        self.captureSession.sessionPreset = .low

        // Apple only delivers capture-button events to an app actively using a
        // camera. Keep a low-cost input/output pipeline alive, but intentionally
        // create no preview layer and never retain or process a video frame.
        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else {
          throw SideControlError.noCamera
        }
        let input = try AVCaptureDeviceInput(device: device)
        guard self.captureSession.canAddInput(input) else { throw SideControlError.configuration }
        self.captureSession.addInput(input)

        let output = AVCaptureVideoDataOutput()
        output.alwaysDiscardsLateVideoFrames = true
        guard self.captureSession.canAddOutput(output) else { throw SideControlError.configuration }
        self.captureSession.addOutput(output)

        if #available(iOS 18.0, *), self.captureSession.supportsControls {
          self.captureSession.setControlsDelegate(self, queue: .main)

          let slider = AVCaptureSlider(
            "Tip amount",
            symbolName: "dollarsign",
            in: 1...50,
            step: 1
          )
          slider.value = Float(self.amount)
          slider.prominentValues = [1, 5, 10, 15, 20, 25, 30, 40, 50]
          slider.localizedValueFormat = "$%@"
          slider.accessibilityIdentifier = "quick-tip-amount"
          slider.setActionQueue(.main) { [weak self] value in
            guard let self else { return }
            let next = max(1, min(Int(value.rounded()), 50))
            self.amount = next
            self.onFieldChange(["value": next, "source": "cameraControl"])
          }
          if self.captureSession.canAddControl(slider) {
            self.captureSession.addControl(slider)
            self.amountControl = slider
          }
        }

        self.captureSession.commitConfiguration()
        self.configured = true
        if self.active { self.captureSession.startRunning() }
        let controlCount: Int
        if #available(iOS 18.0, *) {
          controlCount = self.captureSession.controls.count
        } else {
          controlCount = 0
        }

        DispatchQueue.main.async { [weak self] in
          self?.onReady([
            "cameraControl": self?.amountControl != nil,
            "controlCount": controlCount,
            "device": "Camera Control"
          ])
        }
      } catch {
        if self.captureSession.isRunning { self.captureSession.stopRunning() }
        self.captureSession.commitConfiguration()
        DispatchQueue.main.async { [weak self] in
          self?.onError(["message": error.localizedDescription])
        }
      }
    }
#endif
  }

  private func configureCaptureInteraction() {
    guard #available(iOS 17.2, *) else { return }
    let interaction = AVCaptureEventInteraction { [weak self] event in
      guard let self else { return }
      switch event.phase {
      case .began:
        self.onCapturePress(["phase": "began"])
      case .ended:
        self.onCapturePress(["phase": "ended"])
        self.handleFullPressEnded()
      case .cancelled:
        self.pendingClickReset?.cancel()
        self.pendingClickReset = nil
        self.lastFullPressAt = nil
        self.onCapturePress(["phase": "cancelled"])
      @unknown default:
        break
      }
    }
    addInteraction(interaction)
    eventInteraction = interaction
  }

  private func handleFullPressEnded() {
    let now = ProcessInfo.processInfo.systemUptime
    if let previous = lastFullPressAt, now - previous <= 0.62 {
      pendingClickReset?.cancel()
      pendingClickReset = nil
      lastFullPressAt = nil
      onCapturePress(["phase": "double"])
      return
    }

    lastFullPressAt = now
    onCapturePress(["phase": "armed"])
    let reset = DispatchWorkItem { [weak self] in
      guard let self, self.lastFullPressAt == now else { return }
      self.lastFullPressAt = nil
      self.pendingClickReset = nil
      self.onCapturePress(["phase": "expired"])
    }
    pendingClickReset?.cancel()
    pendingClickReset = reset
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.62, execute: reset)
  }

  private func startMotion() {
    guard motionManager.isDeviceMotionAvailable else { return }
    motionManager.deviceMotionUpdateInterval = 1.0 / 30.0
    motionManager.startDeviceMotionUpdates(to: .main) { [weak self] motion, _ in
      guard let self, let gravity = motion?.gravity else { return }
      let x = max(-1, min(gravity.x * 1.45, 1))
      let y = max(-1, min((gravity.y + 0.58) * 1.3, 1))
      self.onMotion(["x": x, "y": y])
    }
  }
}

@available(iOS 18.0, *)
extension PrismFieldCameraView: @preconcurrency AVCaptureSessionControlsDelegate {
  public func sessionControlsDidBecomeActive(_ session: AVCaptureSession) {
    onControlState(["state": "active"])
  }

  public func sessionControlsWillEnterFullscreenAppearance(_ session: AVCaptureSession) {
    onControlState(["state": "fullscreen"])
  }

  public func sessionControlsWillExitFullscreenAppearance(_ session: AVCaptureSession) {
    onControlState(["state": "active"])
  }

  public func sessionControlsDidBecomeInactive(_ session: AVCaptureSession) {
    onControlState(["state": "inactive"])
  }
}

private enum SideControlError: Error, LocalizedError {
  case noCamera
  case configuration

  var errorDescription: String? {
    switch self {
    case .noCamera: return "Camera Control is not available on this device."
    case .configuration: return "Camera Control could not be configured."
    }
  }
}
