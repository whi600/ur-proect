module.exports = {
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  globDirectory: 'dist',
  globPatterns: ['**/*.{css,html,ico,js,json,png,svg,ttf,woff,woff2}'],
  navigateFallback: '/index.html',
  skipWaiting: true,
  swDest: 'dist/sw.js',
};
