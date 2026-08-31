import { defineConfig } from 'vite'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { apiProxyRoutes } from '../panel/vite.api-proxy.ts'

const root = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root,
  server: {
    port: 3000,
    proxy: apiProxyRoutes,
  },
})
