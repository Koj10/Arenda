import { apiRequest, apiUpload, clearTokens, getApiBaseUrl, setTokens } from '@/api/http'
import type { AuthResponse, FileOut, MeResponse, TenantProfileOut } from '@/api/types'

export function persistAuth(session: AuthResponse) {
  setTokens(session.access_token, session.refresh_token)
}

export async function loginApi(email: string, password: string): Promise<AuthResponse> {
  const session = await apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    skipAuth: true,
    body: { email, password },
  })
  persistAuth(session)
  return session
}

export async function registerApi(data: {
  name: string
  email: string
  password: string
  password_confirm: string
  terms: boolean
}): Promise<AuthResponse> {
  const session = await apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    skipAuth: true,
    body: data,
  })
  persistAuth(session)
  return session
}

export async function logoutApi() {
  try {
    await apiRequest('/auth/logout', { method: 'POST' })
  } catch {
    /* ignore */
  } finally {
    clearTokens()
  }
}

export async function fetchMe(): Promise<MeResponse> {
  return apiRequest<MeResponse>('/me')
}

export async function selectRoleApi(role: 'landlord' | 'tenant'): Promise<MeResponse> {
  return apiRequest<MeResponse>('/me/select-role', {
    method: 'POST',
    body: { role },
  })
}

export async function updateTenantProfileApi(data: {
  company_name?: string
  inn?: string
}): Promise<TenantProfileOut> {
  return apiRequest<TenantProfileOut>('/me/tenant-profile', {
    method: 'PATCH',
    body: data,
  })
}

export async function fetchTenantProfileApi(): Promise<TenantProfileOut> {
  return apiRequest<TenantProfileOut>('/me/tenant-profile')
}

export async function forgotPasswordApi(email: string) {
  return apiRequest<{ message?: string }>('/auth/forgot-password', {
    method: 'POST',
    skipAuth: true,
    body: { email },
  })
}

export function oauthUrl(provider: 'google' | 'apple'): string {
  return `${getApiBaseUrl()}/auth/${provider}`
}

export async function uploadFileApi(file: Blob, extra: {
  filename: string
  kind?: 'title' | 'service' | 'supporting' | 'contract'
  linked_type?: string
  linked_id?: number
}): Promise<FileOut> {
  const form = new FormData()
  form.append('file', file, extra.filename)
  if (extra.kind) form.append('kind', extra.kind)
  if (extra.linked_type) form.append('linked_type', extra.linked_type)
  if (extra.linked_id != null) form.append('linked_id', String(extra.linked_id))
  return apiUpload<FileOut>('/files', form)
}

export function dataUrlToBlob(dataUrl: string, mimeType = 'application/octet-stream'): Blob {
  const [header, payload] = dataUrl.split(',')
  const mime = header?.match(/data:(.*?);/)?.[1] || mimeType
  const binary = atob(payload || '')
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}
