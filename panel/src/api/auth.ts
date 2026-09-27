import { apiRequest, apiUpload, clearTokens, getApiBaseUrl, queryString, setTokens, ApiError } from '@/api/http'
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
}): Promise<AuthResponse | { detail?: string; message?: string }> {
  const session = await apiRequest<AuthResponse | { detail?: string; message?: string }>('/auth/register', {
    method: 'POST',
    skipAuth: true,
    body: data,
  })
  if (session && typeof session === 'object' && 'access_token' in session && session.access_token) {
    persistAuth(session)
  }
  return session
}

export async function verifyEmailApi(email: string, code: string): Promise<AuthResponse | { detail?: string }> {
  const paths = ['/auth/verify-email', '/auth/confirm-email', '/auth/verify']
  let last: unknown
  for (const path of paths) {
    try {
      const session = await apiRequest<AuthResponse | { detail?: string }>(path, {
        method: 'POST',
        skipAuth: true,
        body: { email, code },
      })
      if (session && typeof session === 'object' && 'access_token' in session && session.access_token) {
        persistAuth(session)
      }
      return session
    } catch (err) {
      last = err
      if (err instanceof ApiError && (err.status === 404 || err.status === 405)) continue
      throw err
    }
  }
  throw last instanceof Error ? last : new ApiError('Не удалось подтвердить почту', 404)
}

export async function resendVerificationCodeApi(email: string) {
  const paths = ['/auth/resend-code', '/auth/resend-verification', '/auth/verify-email/resend']
  let last: unknown
  for (const path of paths) {
    try {
      return await apiRequest<{ detail?: string; message?: string }>(path, {
        method: 'POST',
        skipAuth: true,
        body: { email },
      })
    } catch (err) {
      last = err
      if (err instanceof ApiError && (err.status === 404 || err.status === 405)) continue
      throw err
    }
  }
  throw last instanceof Error ? last : new ApiError('Не удалось отправить код', 404)
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
  return apiRequest<{ detail?: string; message?: string; reset_token?: string | null }>('/auth/forgot-password', {
    method: 'POST',
    skipAuth: true,
    body: { email },
  })
}

export async function resetPasswordApi(data: {
  email?: string
  code?: string
  token?: string
  password: string
  password_confirm: string
}) {
  const token = data.token || data.code || ''
  try {
    return await apiRequest<{ detail?: string; message?: string }>('/auth/reset-password', {
      method: 'POST',
      skipAuth: true,
      body: {
        email: data.email,
        code: data.code || token,
        token,
        password: data.password,
        password_confirm: data.password_confirm,
      },
    })
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 422) throw err
    return apiRequest<{ detail?: string; message?: string }>('/auth/reset-password', {
      method: 'POST',
      skipAuth: true,
      body: {
        token,
        password: data.password,
        password_confirm: data.password_confirm,
      },
    })
  }
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
  if (extra.linked_type) form.append('linked_type', extra.linked_type)
  if (extra.linked_id != null) form.append('linked_id', String(extra.linked_id))
  return apiUpload<FileOut>('/files', form)
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
