import { apiRequest } from '@/api/http'
import type { TenantMetersOut } from '@/api/types'

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
