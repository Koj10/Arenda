import http from 'node:http'
import { URL } from 'node:url'

const PORT = Number(process.env.PORT || 3000)
const SITE_URL = process.env.SITE_URL || 'http://localhost:3001'

// Не прод. Рабочий API — FastAPI в ../propcount-main (образ ghcr.io/koj10/arenda-api).

function send(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN?.split(',')[0] || '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  })
  res.end(payload)
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`)

  if (req.method === 'OPTIONS') {
    send(res, 204, {})
    return
  }

  if (url.pathname === '/health' || url.pathname === '/api/health') {
    send(res, 200, {
      ok: true,
      service: 'propcount-api',
      site: SITE_URL,
      db: Boolean(process.env.DATABASE_URL),
      redis: Boolean(process.env.REDIS_URL),
    })
    return
  }

  // Заглушки под будущую регистрацию/логин
  if (url.pathname === '/api/auth/register' && req.method === 'POST') {
    send(res, 501, {
      error: 'not_implemented',
      message: 'Регистрация через БД будет подключена в следующем релизе API',
    })
    return
  }

  if (url.pathname === '/api/auth/login' && req.method === 'POST') {
    send(res, 501, {
      error: 'not_implemented',
      message: 'Авторизация через БД будет подключена в следующем релизе API',
    })
    return
  }

  send(res, 404, { error: 'not_found', path: url.pathname })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[propcount-api] listening on :${PORT}`)
})
