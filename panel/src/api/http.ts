/**
 * HTTP-клиент под будущий API.
 * База: VITE_API_URL (например https://propcount.ru или http://localhost:3000)
 * Пустые ответы / сеть → вызывающий код использует stub.
 */

const DEFAULT_API_BASE = ''

export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL as string | undefined
  if (raw && raw.trim()) return raw.replace(/\/$/, '')
  return DEFAULT_API_BASE
}

/** true, когда API ещё не подключён — работаем на локальных stub */
export function isApiConfigured(): boolean {
  return Boolean(getApiBaseUrl())
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

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  token?: string | null
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const base = getApiBaseUrl()
  if (!base) {
    throw new ApiError('VITE_API_URL is not set', 0)
  }

  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }
  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`)
  }

  const res = await fetch(`${base}${path.startsWith('/') ? path : `/${path}`}`, {
    ...options,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  if (!res.ok) {
    let body: unknown
    try {
      body = await res.json()
    } catch {
      body = await res.text().catch(() => null)
    }
    throw new ApiError(`API ${res.status}`, res.status, body)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}
