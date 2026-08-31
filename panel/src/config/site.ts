/** Site URLs for production deploy */
export const SITE = {
  domain: 'propcount.ru',
  ip: '94.228.166.142',
  url: 'https://propcount.ru',
  origins: [
    'https://propcount.ru',
    'https://www.propcount.ru',
  ],
} as const

/** Local Vite / serve ports — anything else is treated as production (same origin). */
export const DEV_PORTS = {
  landing: '3000',
  panel: '5173',
} as const
