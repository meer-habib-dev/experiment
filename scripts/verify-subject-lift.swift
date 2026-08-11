import AppKit
import CoreImage
import Foundation
import Vision

guard CommandLine.arguments.count == 3 else {
  fputs("Usage: verify-subject-lift.swift input-image output-png\n", stderr)
  exit(64)
}

let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])

guard let image = NSImage(contentsOf: inputURL) else {
  fputs("Could not open input image.\n", stderr)
  exit(65)
}

var proposedRect = CGRect(origin: .zero, size: image.size)
guard let cgImage = image.cgImage(forProposedRect: &proposedRect, context: nil, hints: nil) else {
  fputs("Could not decode input image.\n", stderr)
  exit(65)
}

if #available(macOS 14.0, *) {
  let request = VNGenerateForegroundInstanceMaskRequest()
  let handler = VNImageRequestHandler(cgImage: cgImage, orientation: .up)
  try handler.perform([request])

  guard let observation = request.results?.first, !observation.allInstances.isEmpty else {
    fputs("Vision found no foreground subject.\n", stderr)
    exit(66)
  }

  let maskedBuffer = try observation.generateMaskedImage(
    ofInstances: observation.allInstances,
    from: handler,
    croppedToInstancesExtent: true
  )
  let subject = CIImage(cvPixelBuffer: maskedBuffer)
  let context = CIContext(options: [.useSoftwareRenderer: false])
  try context.writePNGRepresentation(
    of: subject,
    to: outputURL,
    format: .RGBA8,
    colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!
  )

  print("lifted=\(Int(subject.extent.width))x\(Int(subject.extent.height)) instances=\(observation.allInstances.count)")
} else {
  fputs("Foreground lifting requires macOS 14 or newer.\n", stderr)
  exit(69)
}
