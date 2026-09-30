import { generateSW } from 'workbox-build';
import config from '../workbox-config.cjs';

const { count, size } = await generateSW(config);
console.log(`Service Worker: ${count} файлов, ${Math.round(size / 1024)} КБ предварительного кеша.`);
