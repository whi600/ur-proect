module.exports = {
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  globDirectory: 'dist',
  globPatterns: ['**/*.{css,html,ico,js,json,png,svg,ttf,wasm,woff,woff2}'],
  // Legal text pages are downloaded only when opened; never precache the corpus.
  globIgnores: ['legal-texts/**', 'ai-index/**'],
  runtimeCaching: [
    {
      urlPattern: /\/legal-texts\/totopolis-2026-09-25-v1\/.*\.json$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'legal-texts-totopolis-2026-09-25-v1',
        expiration: { maxEntries: 500, maxAgeSeconds: 365 * 24 * 60 * 60 },
        cacheableResponse: { statuses: [200] },
      },
    },
  ],
  navigateFallback: '/index.html',
  skipWaiting: true,
  swDest: 'dist/sw.js',
};
