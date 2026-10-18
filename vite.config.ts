import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

function iosStandaloneMeta(enabled: boolean): Plugin {
  return {
    name: 'ios-standalone-meta',
    transformIndexHtml(html) {
      if (!enabled) return html
      return html.replace(
        '</head>',
        "    <meta name='apple-mobile-web-app-capable' content='yes' />\n    <meta name='apple-mobile-web-app-status-bar-style' content='black-translucent' />\n  </head>",
      )
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const iosStandalone = env.VITE_IOS_STANDALONE === 'true'

  return {
    base: './',
    plugins: [
      react(),
      iosStandaloneMeta(iosStandalone),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['vite.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
        manifest: {
          name: 'Kuromi Likes Your Drawings',
          short_name: 'Mi Galería',
          lang: 'es',
          start_url: './',
          scope: './',
          display: iosStandalone ? 'standalone' : 'browser',
          display_override: iosStandalone ? ['standalone', 'minimal-ui'] : undefined,
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
  }
})
