const { getDefaultConfig } = require('expo/metro-config');
const { withTamagui } = require('@tamagui/metro-plugin');

const config = getDefaultConfig(__dirname);
// Keep exports and QA captures out of Metro's file map. On Windows, reading
// thousands of disk cache entries concurrently can exhaust file descriptors.
config.resolver.blockList = [/[/\\]dist-pitwall[/\\].*/, /[/\\]dist-native[/\\].*/, /[/\\]dist-cloud[/\\].*/, /[/\\]artifacts[/\\].*/, /[/\\]qa[/\\].*/];
if (process.platform === 'win32') config.cacheStores = [];

// Expo SQLite's browser worker loads WebAssembly and uses SharedArrayBuffer.
config.resolver.assetExts.push('wasm');
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
   res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
   res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
   return middleware(req, res, next);
};

module.exports = withTamagui(config, {
   config: './tamagui.config.ts',
   components: ['tamagui']
});
