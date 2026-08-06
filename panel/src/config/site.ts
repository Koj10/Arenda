/** Site URLs for production deploy */
export const SITE = {
  domain: 'propcount.ru',
  ip: '77.91.100.153',
  /** Public port on the server (docker maps 3001 → container 80) */
  port: 3001,
  origins: [
    'https://propcount.ru',
    'http://propcount.ru',
    'https://www.propcount.ru',
    'http://www.propcount.ru',
    'http://77.91.100.153:3001',
    'http://propcount.ru:3001',
  ],
} as const

/** Local Vite / serve ports — anything else is treated as production (same origin). */
export const DEV_PORTS = {
  landing: '3000',
  panel: '5173',
} as const
