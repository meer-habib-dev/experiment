import CoreImage
import ExpoModulesCore
import UIKit
import Vision

public final class RelicSubjectLiftModule: Module {
  public func definition() -> ModuleDefinition {
    Name("RelicSubjectLift")

    AsyncFunction("liftSubject") { (source: URL, focusX: Double, focusY: Double) throws -> [String: Any] in
      guard #available(iOS 17.0, *) else {
        throw SubjectLiftError.unsupported
      }
      return try SubjectExtractor.extract(
        from: source,
        focus: CGPoint(
          x: max(0, min(focusX, 1)),
          y: max(0, min(focusY, 1))
        )
      )
    }

    View(RelicMetalView.self) {
      Prop("source") { (view, source: URL?) in
        view.setSource(source)
      }

      Prop("alloy") { (view, alloy: Int) in
        view.setAlloy(alloy)
      }
    }
  }
}

enum SubjectLiftError: Error, LocalizedError {
  case invalidImage
  case noSubject
  case processingFailed
  case renderFailed
  case unsupported

  var errorDescription: String? {
    switch self {
    case .invalidImage:
      return "The captured frame could not be read."
    case .noSubject:
      return "No foreground subject was found. Try a simpler background."
    case .processingFailed:
      return "Subject separation could not finish. Hold still and try the object again."
    case .renderFailed:
      return "The subject mask could not be rendered."
    case .unsupported:
      return "Native subject lift requires iOS 17 or newer."
    }
  }
}

@available(iOS 17.0, *)
private enum SubjectExtractor {
  private static let context = CIContext(options: [.useSoftwareRenderer: false])

  static func extract(from source: URL, focus: CGPoint) throws -> [String: Any] {
    guard
      let image = UIImage(contentsOfFile: source.path),
      let cgImage = normalizedCGImage(from: image)
    else {
      throw SubjectLiftError.invalidImage
    }

    let request = VNGenerateForegroundInstanceMaskRequest()
    let handler = VNImageRequestHandler(cgImage: cgImage, orientation: .up)
    do {
      try handler.perform([request])
    } catch {
      throw SubjectLiftError.processingFailed
    }

    guard let observation = request.results?.first else {
      throw SubjectLiftError.noSubject
    }

    let selectedInstances = instances(near: focus, in: observation)
    guard !selectedInstances.isEmpty else {
      throw SubjectLiftError.noSubject
    }

    let maskBuffer: CVPixelBuffer
    do {
      maskBuffer = try observation.generateScaledMaskForImage(
        forInstances: selectedInstances,
        from: handler
      )
    } catch {
      throw SubjectLiftError.processingFailed
    }
    let coverage = foregroundCoverage(in: maskBuffer)
    guard coverage > 0.002, coverage < 0.985 else {
      throw SubjectLiftError.noSubject
    }

    // Vision owns both the masking and the tight crop here. Unlike a generic
    // alpha-mask filter, this API guarantees transparent black for every
    // background pixel and preserves Vision's soft, high-resolution edges.
    let maskedBuffer: CVPixelBuffer
    do {
      maskedBuffer = try observation.generateMaskedImage(
        ofInstances: selectedInstances,
        from: handler,
        croppedToInstancesExtent: true
      )
    } catch {
      throw SubjectLiftError.processingFailed
    }
    let tightlyCropped = CIImage(cvPixelBuffer: maskedBuffer)
    let sourceExtent = tightlyCropped.extent.integral
    let margin = max(10, min(72, max(sourceExtent.width, sourceExtent.height) * 0.055))
    let outputExtent = CGRect(
      x: 0,
      y: 0,
      width: sourceExtent.width + margin * 2,
      height: sourceExtent.height + margin * 2
    ).integral
    let translatedSubject = tightlyCropped.transformed(
      by: CGAffineTransform(
        translationX: margin - sourceExtent.minX,
        y: margin - sourceExtent.minY
      )
    )
    let transparentCanvas = CIImage(color: .clear).cropped(to: outputExtent)
    let lifted = translatedSubject
      .composited(over: transparentCanvas)
      .cropped(to: outputExtent)

    let outputURL = FileManager.default.temporaryDirectory
      .appendingPathComponent("relic-subject-\(UUID().uuidString).png")
    let outputColorSpace = CGColorSpace(name: CGColorSpace.sRGB)!

    do {
      try context.writePNGRepresentation(
        of: lifted,
        to: outputURL,
        format: .RGBA8,
        colorSpace: outputColorSpace
      )
    } catch {
      throw SubjectLiftError.renderFailed
    }

    return [
      "uri": outputURL.absoluteString,
      "width": Int(outputExtent.width.rounded()),
      "height": Int(outputExtent.height.rounded()),
      "native": true,
      "backgroundRemoved": true,
      "coverage": coverage
    ]
  }

  private static func normalizedCGImage(from image: UIImage) -> CGImage? {
    if image.imageOrientation == .up, let cgImage = image.cgImage {
      return cgImage
    }

    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    let renderer = UIGraphicsImageRenderer(size: image.size, format: format)
    return renderer.image { _ in
      image.draw(in: CGRect(origin: .zero, size: image.size))
    }.cgImage
  }

  private static func instances(
    near focus: CGPoint,
    in observation: VNInstanceMaskObservation
  ) -> IndexSet {
    let mask = observation.instanceMask
    guard CVPixelBufferGetPixelFormatType(mask) == kCVPixelFormatType_OneComponent8 else {
      return observation.allInstances
    }

    CVPixelBufferLockBaseAddress(mask, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(mask, .readOnly) }

    guard let baseAddress = CVPixelBufferGetBaseAddress(mask) else {
      return observation.allInstances
    }

    let width = CVPixelBufferGetWidth(mask)
    let height = CVPixelBufferGetHeight(mask)
    let bytesPerRow = CVPixelBufferGetBytesPerRow(mask)
    let bytes = baseAddress.assumingMemoryBound(to: UInt8.self)
    let centerX = min(width - 1, max(0, Int(focus.x * CGFloat(width - 1))))
    let centerY = min(height - 1, max(0, Int(focus.y * CGFloat(height - 1))))
    let maxRadius = max(2, min(width, height) / 4)

    var bestLabel = 0
    var bestDistance = Int.max
    let step = max(1, min(width, height) / 90)

    for y in stride(from: max(0, centerY - maxRadius), through: min(height - 1, centerY + maxRadius), by: step) {
      let row = bytes.advanced(by: y * bytesPerRow)
      for x in stride(from: max(0, centerX - maxRadius), through: min(width - 1, centerX + maxRadius), by: step) {
        let label = Int(row[x])
        guard label > 0, observation.allInstances.contains(label) else { continue }
        let dx = x - centerX
        let dy = y - centerY
        let distance = dx * dx + dy * dy
        if distance < bestDistance {
          bestDistance = distance
          bestLabel = label
        }
      }
    }

    return bestLabel > 0 ? IndexSet(integer: bestLabel) : IndexSet()
  }

  private static func foregroundCoverage(in mask: CVPixelBuffer) -> Double {
    CVPixelBufferLockBaseAddress(mask, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(mask, .readOnly) }
    guard let baseAddress = CVPixelBufferGetBaseAddress(mask) else { return 0 }

    let width = CVPixelBufferGetWidth(mask)
    let height = CVPixelBufferGetHeight(mask)
    let bytesPerRow = CVPixelBufferGetBytesPerRow(mask)
    let format = CVPixelBufferGetPixelFormatType(mask)
    var foregroundPixels = 0
    let sampleStep = max(1, min(width, height) / 420)

    if format == kCVPixelFormatType_OneComponent32Float {
      for y in stride(from: 0, to: height, by: sampleStep) {
        let row = baseAddress
          .advanced(by: y * bytesPerRow)
          .assumingMemoryBound(to: Float32.self)
        for x in stride(from: 0, to: width, by: sampleStep) where row[x] > 0.08 {
          foregroundPixels += 1
        }
      }
    } else if format == kCVPixelFormatType_OneComponent8 {
      let bytes = baseAddress.assumingMemoryBound(to: UInt8.self)
      for y in stride(from: 0, to: height, by: sampleStep) {
        let row = bytes.advanced(by: y * bytesPerRow)
        for x in stride(from: 0, to: width, by: sampleStep) where row[x] > 20 {
          foregroundPixels += 1
        }
      }
    } else {
      return 0
    }

    let sampledWidth = (width + sampleStep - 1) / sampleStep
    let sampledHeight = (height + sampleStep - 1) / sampleStep
    return Double(foregroundPixels) / Double(max(1, sampledWidth * sampledHeight))
  }
}
