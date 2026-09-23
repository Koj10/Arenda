import { apiDownload, apiRequest, queryString } from '@/api/http'
import type {
  TenantInvoicesResponse,
  TenantMetersOut,
  TenantReportResponse,
  TenantSpacesResponse,
  TenantSubscriptionResponse,
} from '@/api/types'

export async function listTenantSpaces() {
  return apiRequest<TenantSpacesResponse>('/tenant/spaces')
}

export async function listTenantInvoices(status?: string) {
  const query = status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : ''
  return apiRequest<TenantInvoicesResponse>(`/tenant/invoices${query}`)
}

export async function payTenantInvoice(invoiceId: number, body: {
  method: 'cash' | 'bank' | 'in_app'
  file_ids?: number[]
}) {
  return apiRequest<TenantInvoicesResponse>(`/tenant/invoices/${invoiceId}/pay`, {
    method: 'POST',
    body,
  })
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

export async function getTenantReports(tab: string, period: string) {
  return apiRequest<TenantReportResponse>(`/tenant/reports${queryString({ tab, period })}`)
}

export async function exportTenantReports(tab: string, period: string, fields?: string) {
  return apiDownload(`/tenant/reports/export${queryString({ tab, period, fields })}`)
}

export async function getTenantSubscription() {
  return apiRequest<TenantSubscriptionResponse>('/tenant/subscription')
}

export async function upgradeTenantSubscription() {
  return apiRequest<TenantSubscriptionResponse>('/tenant/subscription/upgrade', { method: 'POST' })
}
