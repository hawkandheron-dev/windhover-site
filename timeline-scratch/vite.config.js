import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import process from 'node:process'
import lightThemeOptOut from './postcss-light-theme-optout.js'

// Lifelines' share card (church-history-2.html: Open Graph tags, canonical
// link) needs absolute URLs. The site is windhoverhistory.com (owner,
// 2026-10-08), and Lifelines' canonical address is /lifelines on it, though
// the root serves it too (_redirects). To build for another address, set
// LIFELINES_SITE_URL in the Pages build settings and redeploy.
const LIFELINES_SITE_URL = (process.env.LIFELINES_SITE_URL || 'https://windhoverhistory.com').replace(/\/$/, '')

function lifelinesSiteUrl() {
  return {
    name: 'lifelines-site-url',
    transformIndexHtml: html => html.replaceAll('%LIFELINES_SITE_URL%', LIFELINES_SITE_URL),
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), lifelinesSiteUrl()],
  css: {
    // Lets a page hold its light palette under a dark OS; see the plugin.
    postcss: { plugins: [lightThemeOptOut()] },
  },
  // Absolute, not './': Lifelines is also served at the site root (see the
  // root _redirects), where './assets/…' would resolve to /assets/ and 404.
  // Every app is deployed under /apps/, so this changes no other URL.
  base: '/apps/',
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
