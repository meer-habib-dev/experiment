import ExpoModulesCore

public final class PrismFieldCameraModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PrismFieldCamera")

    View(PrismFieldCameraView.self) {
      Events(
        "onReady",
        "onError",
        "onFieldChange",
        "onSpectrumChange",
        "onControlState",
        "onMotion",
        "onCapture",
        "onCapturePress"
      )

      Prop("active") { (view, active: Bool) in
        view.setActive(active)
      }

      Prop("fieldIndex") { (view, fieldIndex: Int) in
        view.setFieldIndex(fieldIndex)
      }

      Prop("spectrumIndex") { (view, spectrumIndex: Int) in
        view.setSpectrumIndex(spectrumIndex)
      }

      Prop("captureToken") { (view, captureToken: Int) in
        view.setCaptureToken(captureToken)
      }
    }
  }
}
