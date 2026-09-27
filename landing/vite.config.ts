import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import { apiProxyRoutes } from '../panel/vite.api-proxy.ts'

const root = dirname(fileURLToPath(import.meta.url))

function prettyHtmlUrls(): Plugin {
  return {
    name: 'pretty-html-urls',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next()
        const raw = req.url || '/'
        const q = raw.indexOf('?')
        const pathname = q >= 0 ? raw.slice(0, q) : raw
        const search = q >= 0 ? raw.slice(q) : ''
        if (!pathname || pathname === '/' || pathname.includes('.')) return next()
        const rel = pathname.replace(/^\//, '').replace(/\/$/, '')
        if (!rel || rel.includes('..')) return next()
        const htmlFile = join(root, `${rel}.html`)
        if (existsSync(htmlFile)) req.url = `/${rel}.html${search}`
        next()
      })
    },
  }
}

export default defineConfig({
  root,
  appType: 'mpa',
  plugins: [prettyHtmlUrls()],
  server: {
    port: 3000,
    proxy: apiProxyRoutes,
  },
})
