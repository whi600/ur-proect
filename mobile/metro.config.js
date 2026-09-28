const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite includes a WebAssembly file for its web implementation. Metro
// needs to treat it as a binary asset when exporting the PWA.
config.resolver.assetExts.push('wasm');

module.exports = config;
