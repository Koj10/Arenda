/**
 * Префикс /__api на этом же сайте. Nginx/Vite отдают его на
 * https://api.propcount.ru или локально http://127.0.0.1:8000 (Vite/nginx прокси).
 */
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL as string | undefined
  if (raw != null && raw.trim()) return raw.trim().replace(/\/$/, '')
  return '/__api'
}

export function isApiConfigured(): boolean {
  return true
}

const ACCESS_KEY = 'propcount-access-token'
const REFRESH_KEY = 'propcount-refresh-token'

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY)
}

export function setTokens(access: string, refresh?: string | null) {
  localStorage.setItem(ACCESS_KEY, access)
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export function isPaymentRequired(err: unknown): boolean {
  return err instanceof ApiError && err.status === 402
}

export function formatApiError(err: unknown, fallback = 'Ошибка запроса'): string {
  if (err instanceof ApiError) {
    if (err.status === 402) {
      const body = err.body as { detail?: unknown; message?: string } | string | null
      if (typeof body === 'string' && body.trim()) return body
      if (body && typeof body === 'object') {
        if (typeof body.detail === 'string' && body.detail.trim()) return body.detail
        if (body.message) return body.message
      }
      return 'Лимит тарифа исчерпан. Перейдите на платный план, чтобы добавить больше.'
    }
    const body = err.body as { detail?: unknown; message?: string } | string | null
    if (typeof body === 'string' && body.trim()) return body
    if (body && typeof body === 'object') {
      const detail = body.detail
      if (typeof detail === 'string') return detail
      if (Array.isArray(detail)) {
        return detail
          .map((item) => {
            if (typeof item === 'string') return item
            if (item && typeof item === 'object' && 'msg' in item) return String((item as { msg: string }).msg)
            return ''
          })
          .filter(Boolean)
          .join('. ')
      }
      if (body.message) return body.message
    }
    if (err.message && err.message !== `API ${err.status}`) return err.message
  }
  if (err instanceof Error && err.message) return err.message
  return fallback
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  token?: string | null
  skipAuth?: boolean
  skipRefresh?: boolean
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

let refreshInFlight: Promise<boolean> | null = null

async function tryRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = (async () => {
    const refresh = getRefreshToken()
    if (!refresh) return false
    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresh }),
      })
      if (!res.ok) return false
      const data = (await res.json()) as { access_token?: string; refresh_token?: string }
      if (!data.access_token) return false
      setTokens(data.access_token, data.refresh_token ?? refresh)
      return true
    } catch {
      return false
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const base = getApiBaseUrl()
  const headers = new Headers(options.headers)
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData

  if (!isForm && !headers.has('Content-Type') && options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }

  const token = options.skipAuth ? null : (options.token ?? getAccessToken())
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(`${base}${path.startsWith('/') ? path : `/${path}`}`, {
    ...options,
    headers,
    body: isForm
      ? (options.body as FormData)
      : options.body !== undefined
        ? JSON.stringify(options.body)
        : undefined,
  })

  if (res.status === 401 && !options.skipAuth && !options.skipRefresh) {
    const ok = await tryRefresh()
    if (ok) {
      return apiRequest<T>(path, { ...options, skipRefresh: true })
    }
  }

  if (!res.ok) {
    const body = await parseBody(res)
    throw new ApiError(formatApiError(new ApiError(`API ${res.status}`, res.status, body), `API ${res.status}`), res.status, body)
  }

  if (res.status === 204) return undefined as T
  const data = await parseBody(res)
  return data as T
}

export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  return apiRequest<T>(path, { method: 'POST', body: form })
}
