import { copyFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

function stableSqliteWasm() {
  return {
    name: 'stable-sqlite-wasm',
    apply: 'build' as const,
    closeBundle() {
      const dir = join(process.cwd(), 'dist', 'assets')
      const hashed = readdirSync(dir).find((name) => /^sqlite3-.*\.wasm$/.test(name))
      if (!hashed) return
      copyFileSync(join(dir, hashed), join(dir, 'sqlite3.wasm'))
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    stableSqliteWasm(),
    VitePWA({
      disable: process.env.VITEST === 'true',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'HAK Wholesales',
        short_name: 'HAK',
        start_url: '/',
        display: 'standalone',
        background_color: '#f4f6fb',
        theme_color: '#9f1239',
        id: '/',
        icons: [
          { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,wasm}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  server: {
    host: '127.0.0.1',
    port: 5173,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
