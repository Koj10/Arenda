import { ApiError, apiRequest, apiUpload, clearTokens, getApiBaseUrl, queryString, setTokens } from '@/api/http'
import { asList, type AuthResponse, type FileOut, type MeResponse, type TenantProfileOut, type UserPublic } from '@/api/types'

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
}): Promise<AuthResponse | { detail?: string }> {
  const raw = await apiRequest<AuthResponse | { detail?: string }>('/auth/register', {
    method: 'POST',
    skipAuth: true,
    body: data,
  })
  if (raw && typeof raw === 'object' && 'access_token' in raw && raw.access_token) {
    persistAuth(raw)
  }
  return raw
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

export async function selectRoleApi(role: 'landlord' | 'tenant'): Promise<AuthResponse> {
  const session = await apiRequest<AuthResponse>('/me/select-role', {
    method: 'POST',
    body: { role },
  })
  persistAuth(session)
  return session
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
  return apiRequest<{ detail?: string; message?: string }>('/auth/forgot-password', {
    method: 'POST',
    skipAuth: true,
    body: { email },
  })
}

export async function resetPasswordApi(data: {
  token: string
  password: string
  password_confirm: string
}) {
  return apiRequest<{ detail?: string; message?: string }>('/auth/reset-password', {
    method: 'POST',
    skipAuth: true,
    body: data,
  })
}

export async function acceptTenantInvitationApi(data: {
  token: string
  password: string
  password_confirm: string
}): Promise<AuthResponse> {
  const session = await apiRequest<AuthResponse>('/auth/tenant-invitation/accept', {
    method: 'POST',
    skipAuth: true,
    body: data,
  })
  persistAuth(session)
  return session
}

export async function updateMeApi(params: { name?: string; inn?: string }) {
  return apiRequest<UserPublic>(`/me${queryString(params)}`, { method: 'PATCH' })
}

export function oauthUrl(provider: 'google' | 'apple'): string {
  return `${getApiBaseUrl()}/auth/${provider}`
}

export async function uploadFileApi(file: Blob, extra: {
  filename: string
  kind?: 'title' | 'service' | 'supporting' | 'contract' | 'receipt'
  linked_type?: string
  linked_id?: number
}): Promise<FileOut> {
  const form = new FormData()
  form.append('file', file, extra.filename)
  if (extra.kind) form.append('kind', extra.kind)
  if (extra.linked_type && extra.linked_id != null) {
    form.append('linked_type', extra.linked_type)
    form.append('linked_id', String(extra.linked_id))
  }
  try {
    return await apiUpload<FileOut>('/files', form)
  } catch (err) {
    if (err instanceof ApiError && err.status === 422 && extra.linked_type) {
      const retry = new FormData()
      retry.append('file', file, extra.filename)
      if (extra.kind) retry.append('kind', extra.kind)
      return apiUpload<FileOut>('/files', retry)
    }
    throw err
  }
}

export async function listFiles(params: {
  linked_type?: string
  linked_id?: number
  kind?: string
} = {}) {
  return asList<FileOut>(await apiRequest<unknown>(`/files${queryString(params)}`))
}

export async function deleteFileApi(fileId: number) {
  return apiRequest<void>(`/files/${fileId}`, { method: 'DELETE' })
}

export function fileDisplayName(file: FileOut) {
  return file.original_name || file.name || file.filename || 'Файл'
}

export function dataUrlToBlob(dataUrl: string, mimeType = 'application/octet-stream'): Blob {
  const [header, payload] = dataUrl.split(',')
  const mime = header?.match(/data:(.*?);/)?.[1] || mimeType
  const binary = atob(payload || '')
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}
