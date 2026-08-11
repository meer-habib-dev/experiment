import ExpoModulesCore
import Metal
import MetalKit
import UIKit

private struct RelicMetalUniforms {
  var time: Float
  var alloy: Float
  var texelSize: SIMD2<Float>
}

public final class RelicMetalView: ExpoView, MTKViewDelegate {
  private let metalView: MTKView
  private let commandQueue: MTLCommandQueue?
  private var pipeline: MTLRenderPipelineState?
  private var texture: MTLTexture?
  private var alloy: Float = 0
  private var startedAt = CACurrentMediaTime()

  public required init(appContext: AppContext? = nil) {
    let device = MTLCreateSystemDefaultDevice()
    metalView = MTKView(frame: .zero, device: device)
    commandQueue = device?.makeCommandQueue()
    super.init(appContext: appContext)

    clipsToBounds = false
    backgroundColor = .clear
    metalView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    metalView.backgroundColor = .clear
    metalView.clearColor = MTLClearColorMake(0, 0, 0, 0)
    metalView.colorPixelFormat = .bgra8Unorm
    metalView.isOpaque = false
    metalView.framebufferOnly = true
    metalView.preferredFramesPerSecond = 60
    metalView.enableSetNeedsDisplay = false
    metalView.isPaused = false
    metalView.delegate = self
    addSubview(metalView)

    if let device {
      pipeline = try? Self.makePipeline(device: device, pixelFormat: metalView.colorPixelFormat)
    }
  }

  public override func layoutSubviews() {
    super.layoutSubviews()
    metalView.frame = bounds
  }

  public func setSource(_ source: URL?) {
    startedAt = CACurrentMediaTime()
    guard let source, let device = metalView.device else {
      texture = nil
      return
    }

    let loader = MTKTextureLoader(device: device)
    texture = try? loader.newTexture(
      URL: source,
      options: [
        .SRGB: true,
        .origin: MTKTextureLoader.Origin.topLeft,
        .textureUsage: NSNumber(value: MTLTextureUsage.shaderRead.rawValue)
      ]
    )
  }

  public func setAlloy(_ value: Int) {
    alloy = Float(max(0, min(value, 2)))
  }

  public func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {}

  public func draw(in view: MTKView) {
    guard
      let texture,
      let pipeline,
      let descriptor = view.currentRenderPassDescriptor,
      let drawable = view.currentDrawable,
      let commandBuffer = commandQueue?.makeCommandBuffer(),
      let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: descriptor)
    else { return }

    var uniforms = RelicMetalUniforms(
      time: Float(CACurrentMediaTime() - startedAt),
      alloy: alloy,
      texelSize: SIMD2<Float>(1 / Float(texture.width), 1 / Float(texture.height))
    )

    encoder.setRenderPipelineState(pipeline)
    encoder.setFragmentTexture(texture, index: 0)
    encoder.setFragmentBytes(&uniforms, length: MemoryLayout<RelicMetalUniforms>.stride, index: 0)
    encoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 6)
    encoder.endEncoding()
    commandBuffer.present(drawable)
    commandBuffer.commit()
  }

  private static func makePipeline(device: MTLDevice, pixelFormat: MTLPixelFormat) throws -> MTLRenderPipelineState {
    let library = try device.makeLibrary(source: metalShaderSource, options: nil)
    let descriptor = MTLRenderPipelineDescriptor()
    descriptor.vertexFunction = library.makeFunction(name: "relicVertex")
    descriptor.fragmentFunction = library.makeFunction(name: "relicMetalFragment")
    descriptor.colorAttachments[0].pixelFormat = pixelFormat
    descriptor.colorAttachments[0].isBlendingEnabled = true
    descriptor.colorAttachments[0].sourceRGBBlendFactor = .sourceAlpha
    descriptor.colorAttachments[0].destinationRGBBlendFactor = .oneMinusSourceAlpha
    descriptor.colorAttachments[0].sourceAlphaBlendFactor = .one
    descriptor.colorAttachments[0].destinationAlphaBlendFactor = .oneMinusSourceAlpha
    return try device.makeRenderPipelineState(descriptor: descriptor)
  }
}

private let metalShaderSource = """
#include <metal_stdlib>
using namespace metal;

struct VertexOut {
  float4 position [[position]];
  float2 uv;
};

struct RelicMetalUniforms {
  float time;
  float alloy;
  float2 texelSize;
};

vertex VertexOut relicVertex(uint vertexID [[vertex_id]]) {
  constexpr float2 positions[6] = {
    float2(-1.0, -1.0), float2( 1.0, -1.0), float2(-1.0,  1.0),
    float2(-1.0,  1.0), float2( 1.0, -1.0), float2( 1.0,  1.0)
  };
  constexpr float2 uvs[6] = {
    float2(0.0, 1.0), float2(1.0, 1.0), float2(0.0, 0.0),
    float2(0.0, 0.0), float2(1.0, 1.0), float2(1.0, 0.0)
  };
  return { float4(positions[vertexID], 0.0, 1.0), uvs[vertexID] };
}

float relicHash(float2 p) {
  return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453);
}

float3 relicPalette(float value, float alloy, float warmShift) {
  float3 tinDark = float3(0.075, 0.105, 0.13);
  float3 tinLight = float3(0.80, 0.91, 0.98);
  float3 goldDark = float3(0.24, 0.085, 0.018);
  float3 goldLight = float3(1.0, 0.77, 0.19);
  float3 candyDark = float3(0.12, 0.028, 0.24);
  float3 candyLight = float3(1.0, 0.31, 0.66);
  float firstMix = smoothstep(0.0, 1.0, alloy);
  float secondMix = smoothstep(1.0, 2.0, alloy);
  float3 darkTone = mix(mix(tinDark, goldDark, firstMix), candyDark, secondMix);
  float3 lightTone = mix(mix(tinLight, goldLight, firstMix), candyLight, secondMix);
  float3 result = mix(darkTone, lightTone, value);
  return mix(result, result * float3(1.08, 0.92, 0.78), warmShift * 0.16);
}

fragment float4 relicMetalFragment(
  VertexOut in [[stage_in]],
  texture2d<float> source [[texture(0)]],
  constant RelicMetalUniforms& uniforms [[buffer(0)]]) {
  constexpr sampler imageSampler(address::clamp_to_zero, filter::linear);
  float4 base = source.sample(imageSampler, in.uv);
  float reveal = smoothstep(0.12, 0.92, uniforms.time);

  // Build a real silhouette extrusion from the cutout's alpha. Because the
  // texture contains transparent background pixels, these layers can never
  // leak the original rectangular camera frame back into the result.
  float extrusion = 0.0;
  for (int layer = 1; layer <= 14; layer++) {
    float depth = float(layer) / 14.0;
    float2 offset = float2(0.0021, 0.0028) * float(layer);
    float layerAlpha = source.sample(imageSampler, in.uv - offset).a;
    extrusion = max(extrusion, layerAlpha * (1.0 - depth * 0.23));
  }

  float2 shadowOffset = float2(0.022, 0.036);
  float shadow = 0.0;
  shadow += source.sample(imageSampler, in.uv - shadowOffset + float2(-0.010, 0.000)).a;
  shadow += source.sample(imageSampler, in.uv - shadowOffset + float2( 0.010, 0.000)).a;
  shadow += source.sample(imageSampler, in.uv - shadowOffset + float2( 0.000,-0.010)).a;
  shadow += source.sample(imageSampler, in.uv - shadowOffset + float2( 0.000, 0.010)).a;
  shadow *= 0.25;

  if (base.a < 0.008) {
    if (extrusion > 0.018) {
      float depthGrain = relicHash(floor(in.uv * 430.0));
      float3 edgeColor = relicPalette(0.13 + depthGrain * 0.08, uniforms.alloy, 0.3);
      return float4(edgeColor, extrusion * 0.98 * reveal);
    }
    return float4(float3(0.08, 0.055, 0.045), shadow * 0.23 * reveal);
  }

  float4 left = source.sample(imageSampler, in.uv - float2(uniforms.texelSize.x * 2.0, 0.0));
  float4 right = source.sample(imageSampler, in.uv + float2(uniforms.texelSize.x * 2.0, 0.0));
  float4 up = source.sample(imageSampler, in.uv - float2(0.0, uniforms.texelSize.y * 2.0));
  float4 down = source.sample(imageSampler, in.uv + float2(0.0, uniforms.texelSize.y * 2.0));

  float luma = dot(base.rgb, float3(0.2126, 0.7152, 0.0722));
  float lumaLeft = dot(left.rgb, float3(0.2126, 0.7152, 0.0722));
  float lumaRight = dot(right.rgb, float3(0.2126, 0.7152, 0.0722));
  float lumaUp = dot(up.rgb, float3(0.2126, 0.7152, 0.0722));
  float lumaDown = dot(down.rgb, float3(0.2126, 0.7152, 0.0722));

  float2 imageGradient = float2(lumaRight - lumaLeft, lumaDown - lumaUp);
  float2 alphaGradient = float2(right.a - left.a, down.a - up.a);
  float3 normal = normalize(float3(
    -imageGradient.x * 4.4 - alphaGradient.x * 1.8,
    -imageGradient.y * 4.4 - alphaGradient.y * 1.8,
    0.72
  ));
  float3 movingLight = normalize(float3(
    cos(uniforms.time * 0.62) * 0.72,
    sin(uniforms.time * 0.46) * 0.48 - 0.24,
    0.92
  ));
  float diffuse = clamp(dot(normal, movingLight) * 0.5 + 0.5, 0.0, 1.0);
  float specular = pow(max(dot(normal, movingLight), 0.0), 34.0);

  float shaped = clamp(luma * 0.64 + diffuse * 0.48, 0.0, 0.999);
  float toon = floor(shaped * 7.0) / 6.0;
  float brush = (relicHash(float2(floor(in.uv.y * 780.0), floor(in.uv.x * 28.0))) - 0.5) * 0.075;
  float sweepPosition = fract(in.uv.x * 0.76 + in.uv.y * 0.24 - uniforms.time * 0.13);
  float sweep = pow(max(0.0, 1.0 - abs(sweepPosition - 0.5) * 2.0), 18.0);
  float fineGlint = pow(max(0.0, cos((in.uv.x * 1.3 + in.uv.y * 0.42 - uniforms.time * 0.18) * 6.28318)), 42.0);
  float rim = clamp(length(alphaGradient) * 5.6, 0.0, 1.0);

  float3 metal = relicPalette(clamp(toon + brush, 0.0, 1.0), uniforms.alloy, diffuse);
  metal += specular * float3(0.95, 1.0, 1.0) * 0.92;
  metal += sweep * float3(0.68, 0.88, 1.0) * 0.56;
  metal += fineGlint * float3(0.56, 1.0, 0.88) * 0.34;
  metal = mix(metal, float3(1.0, 0.985, 0.90), rim * 0.92);
  metal *= 0.91 + base.rgb * 0.14;
  // Briefly reveal the untouched transparent cutout first, then forge it.
  // This makes the background-removal step legible instead of hiding it
  // behind an instantaneous color swap.
  metal = mix(base.rgb / max(base.a, 0.08), metal, reveal);
  return float4(metal, base.a);
}
"""
