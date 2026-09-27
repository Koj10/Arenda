import { defineConfig } from 'vite'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { apiProxyRoutes } from '../panel/vite.api-proxy.ts'

const root = dirname(fileURLToPath(import.meta.url))

const prettyPages: Record<string, string> = {
  '/login': '/login.html',
  '/register': '/register.html',
  '/verify-email': '/verify-email.html',
  '/forgot-password': '/forgot-password.html',
  '/reset-password': '/reset-password.html',
  '/privacy': '/privacy.html',
  '/terms': '/terms.html',
}

export default defineConfig({
  root,
  server: {
    port: 3000,
    proxy: apiProxyRoutes,
  },
  plugins: [
    {
      name: 'pretty-auth-pages',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (!req.url) return next()
          const [pathname, search] = req.url.split('?')
          const target = prettyPages[pathname || '']
          if (target) req.url = search ? `${target}?${search}` : target
          next()
        })
      },
    },
  ],
})
