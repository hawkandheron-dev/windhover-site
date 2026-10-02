import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Use relative paths for assets
  esbuild: {
    drop: ['console', 'debugger'],
  },
  build: {
    outDir: '../apps',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        'church-history': resolve(__dirname, 'church-history.html'),
        'church-history-timeline': resolve(__dirname, 'church-history-timeline.html'),
        'church-history-2': resolve(__dirname, 'church-history-2.html'),
        // Redirect stub for the old URL. Kept as a build input so
        // apps/church-history-supabase.html remains a (redirecting) page
        // rather than a 404 for existing bookmarks.
        'church-history-supabase': resolve(__dirname, 'church-history-supabase.html'),
        'heresies': resolve(__dirname, 'heresies.html'),
        'historical-eras': resolve(__dirname, 'historical-eras.html'),
        'biblical-places': resolve(__dirname, 'biblical-places.html'),
        'african-kingdoms': resolve(__dirname, 'african-kingdoms.html'),
        'first-century-church': resolve(__dirname, 'first-century-church.html'),
        'contributor-portal': resolve(__dirname, 'contributor-portal.html'),
        'arthuriana':          resolve(__dirname, 'arthuriana.html'),
        'arthuriana-studio':   resolve(__dirname, 'arthuriana-studio.html'),
        'arthuriana-supabase': resolve(__dirname, 'arthuriana-supabase.html'),
      },
    },
  },
})
