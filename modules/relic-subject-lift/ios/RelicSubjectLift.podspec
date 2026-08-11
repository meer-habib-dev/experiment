require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'RelicSubjectLift'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = 'Native Lab'
  s.homepage       = 'https://example.invalid/native-lab'
  s.platforms      = { :ios => '16.4' }
  s.source         = { :path => '.' }
  s.static_framework = true
  s.swift_version  = '6.0'

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'CoreImage', 'Metal', 'MetalKit', 'Vision'
  s.source_files = '**/*.{h,m,mm,swift}'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
