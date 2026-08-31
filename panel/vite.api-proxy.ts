import type { ProxyOptions } from 'vite'

/** Рабочее API. Браузер ходит на /__api/*, Vite/nginx пересылают сюда. */
export const LIVE_API = 'https://api.propcount.ru'

const proxy: ProxyOptions = {
  target: LIVE_API,
  changeOrigin: true,
  secure: true,
  rewrite: (path) => path.replace(/^\/__api/, '') || '/',
}

export const apiProxyRoutes: Record<string, ProxyOptions> = {
  '/__api': proxy,
}
