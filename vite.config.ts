import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['vite.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'Kuromi Likes Your Drawings',
        short_name: 'Mi Galería',
        start_url: './',
        scope: './',
        display: 'browser',
        display_override: ['standalone', 'minimal-ui'],
        background_color: '#14101a',
        theme_color: '#5b2a86',
        description: 'Galería privada de dibujos',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
