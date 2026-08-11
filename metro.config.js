const { getDefaultConfig } = require('expo/metro-config');
const { withNativewind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('ogg');

module.exports = withNativewind(config, {
  inlineVariables: false,
  globalClassNamePolyfill: true,
});
