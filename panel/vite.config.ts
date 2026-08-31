import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { apiProxyRoutes } from './vite.api-proxy.ts'

export default defineConfig({
  // Local: './' ; Docker/prod: '/panel/' via VITE_BASE_PATH
  base: process.env.VITE_BASE_PATH || './',
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: apiProxyRoutes,
  },
})
