import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Silah',
        short_name: 'Silah',
        description: 'A private companion for inherited disease risk, from the couple check to counselling, birth and family.',
        lang: 'ar',
        dir: 'auto',
        start_url: './',
        display: 'standalone',
        background_color: '#ECEEF5',
        theme_color: '#ECEEF5',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        // The app shell, fonts and pre-rendered audio work offline. The ONNX runtime and the model are
        // fetched only if someone asks for the on-device model, and are then cached by Transformers.js.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,mp3}'],
        globIgnores: ['**/ort-*.{js,mjs}', '**/transformers*.js'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
} as any);
