import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Reemplaza al par react-scripts + config-overrides.js. Ese config-overrides nunca llegó a
// ejecutarse: registraba el service worker vía InjectManifest, pero los scripts llamaban a
// `react-scripts` directamente y `react-app-rewired` no estaba ni instalado — así que la PWA
// no tuvo service worker en ningún momento. VitePWA es el primero que realmente se genera.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'car-icon.png', 'robots.txt'],
      manifest: false, // el manifest.json existente en public/ sigue siendo la fuente
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // La caja necesita que la app abra aunque la red esté caída; los datos siguen
        // necesitando conexión, así que la API se sirve por red primero y solo cae al
        // cache como último recurso.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 }
            }
          }
        ]
      }
    })
  ],
  server: {
    port: 3001,
    host: true
  },
  preview: {
    port: 3001,
    host: true
  },
  build: {
    outDir: 'build', // se mantiene el nombre que ya usan los scripts de deploy
    sourcemap: false
  }
});
