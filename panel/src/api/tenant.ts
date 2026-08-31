import { apiRequest } from '@/api/http'
import type { TenantInvoicesResponse, TenantMetersOut, TenantSpacesResponse } from '@/api/types'

export async function listTenantSpaces() {
  return apiRequest<TenantSpacesResponse>('/tenant/spaces')
}

export async function listTenantInvoices(status?: string) {
  const query = status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : ''
  return apiRequest<TenantInvoicesResponse>(`/tenant/invoices${query}`)
}

export async function listTenantMeters(period: string) {
  return apiRequest<TenantMetersOut>(`/tenant/meters?period=${encodeURIComponent(period)}`)
}

export async function upsertTenantMeter(body: {
  unit_id: number
  period: string
  criterion: string
  previous_value: number
  current_value: number
}) {
  return apiRequest('/tenant/meters', { method: 'PUT', body })
}
