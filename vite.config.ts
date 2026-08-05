import { defineConfig } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',  // prompt the user before updating — gives us control via UpdateBanner
      includeAssets: ['icons/*.png', 'manifest.json'],
      manifest: false,         // use our own public/manifest.json instead of auto-generated
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2}', 'icons/*.png'],
        // Exclude oversized demo images from precache — they'll be served normally
        globIgnores: ['**/ChatGPT_Image_*.png', '**/image-*.png'],
        // Don't cache API calls — always fresh from server
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              networkTimeoutSeconds: 5,
            },
          },
        ],
      },
      devOptions: {
        enabled: false,  // SW in dev caches assets and doesn't auto-update — re-enable only for explicit offline testing
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
