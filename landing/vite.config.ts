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
  plugins: [
    {
      name: 'landing-clean-urls',
      configureServer(server) {
        const rewrites = [
          ['/login', '/login.html'],
          ['/register', '/register.html'],
          ['/privacy', '/privacy.html'],
          ['/terms', '/terms.html'],
        ]
        server.middlewares.use((req, _res, next) => {
          const hit = rewrites.find(([from]) => req.url === from || req.url === from + '/')
          if (hit) req.url = hit[1]
          next()
        })
      },
    },
  ],
})
