import { defineConfig } from 'vite'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cpSync, existsSync } from 'node:fs'
import { apiProxyRoutes } from '../panel/vite.api-proxy.ts'

const root = dirname(fileURLToPath(import.meta.url))

function syncCleanUrls() {
  const pages = ['login', 'register', 'privacy', 'terms']
  for (const name of pages) {
    const src = join(root, `${name}.html`)
    const dst = join(root, name)
    if (existsSync(src)) cpSync(src, dst)
  }
}

export default defineConfig({
  root,
  server: {
    port: 3000,
    proxy: apiProxyRoutes,
  },
  plugins: [
    {
      name: 'landing-sync-clean-urls',
      buildStart() {
        syncCleanUrls()
      },
      configureServer(server) {
        syncCleanUrls()
        const rewrites = [
          ['/login', '/login.html'],
          ['/register', '/register.html'],
          ['/privacy', '/privacy.html'],
          ['/terms', '/terms.html'],
        ]
        server.middlewares.use((req, _res, next) => {
          if (req.url && !req.url.startsWith('/__api') && !req.url.startsWith('/@')) {
            const hit = rewrites.find(([from]) => req.url === from || req.url === from + '/')
            if (hit) req.url = hit[1]
          }
          next()
        })
      },
    },
  ],
})
