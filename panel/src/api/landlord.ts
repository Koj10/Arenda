import { apiRequest } from '@/api/http'
import type {
  CadastreOut,
  ObjectDetailOut,
  ObjectListItem,
  PayersMatrixOut,
  TenantDetailOut,
  TenantOut,
  TransactionOut,
  UnitInObjectOut,
  UtilityBillListItem,
  LandlordInvoiceOut,
  InvoiceDetailOut,
} from '@/api/types'

export async function listObjects(q?: string) {
  const query = q ? `?q=${encodeURIComponent(q)}` : ''
  return apiRequest<ObjectListItem[]>(`/landlord/objects${query}`)
}

export async function getObject(objectId: number) {
  return apiRequest<ObjectDetailOut>(`/landlord/objects/${objectId}`)
}

export async function createObject(body: {
  address: string
  type?: 'office' | 'retail' | 'warehouse'
  total_area: number
  cadastre_number?: string
  cadastral_value?: number
  purchase_price?: number
  file_ids?: number[]
}) {
  return apiRequest<ObjectDetailOut>('/landlord/objects', { method: 'POST', body })
}

export async function deleteObject(objectId: number) {
  return apiRequest<void>(`/landlord/objects/${objectId}`, { method: 'DELETE' })
}

export async function createUnit(objectId: number, body: {
  number: string
  area: number
  rent_rate?: number
  cadastre_id?: number | null
}) {
  return apiRequest<UnitInObjectOut>(`/landlord/objects/${objectId}/units`, { method: 'POST', body })
}

export async function updateUnit(unitId: number, body: {
  number?: string
  area?: number
  rent_rate?: number
  cadastre_id?: number | null
}) {
  return apiRequest<UnitInObjectOut>(`/landlord/units/${unitId}`, { method: 'PATCH', body })
}

export async function deleteUnit(unitId: number) {
  return apiRequest<void>(`/landlord/units/${unitId}`, { method: 'DELETE' })
}

export async function updateUnitPayer(unitId: number, criterion: string, payer: 'landlord' | 'tenant') {
  return apiRequest(`/landlord/units/${unitId}/payer`, {
    method: 'PATCH',
    body: { criterion, payer },
  })
}

export async function createCadastre(objectId: number, body: {
  number: string
  cadastral_value: number
  purchase_price?: number
}) {
  return apiRequest<CadastreOut>(`/landlord/objects/${objectId}/cadastre`, { method: 'POST', body })
}

export async function updateCadastre(cadastreId: number, body: {
  number?: string
  cadastral_value?: number
  purchase_price?: number
}) {
  return apiRequest<CadastreOut>(`/landlord/cadastre/${cadastreId}`, { method: 'PATCH', body })
}

export async function deleteCadastre(cadastreId: number) {
  return apiRequest<void>(`/landlord/cadastre/${cadastreId}`, { method: 'DELETE' })
}

export async function listTenants(q?: string) {
  const query = q ? `?q=${encodeURIComponent(q)}` : ''
  return apiRequest<TenantOut[]>(`/landlord/tenants${query}`)
}

export async function getTenant(tenantId: number) {
  return apiRequest<TenantDetailOut>(`/landlord/tenants/${tenantId}`)
}

export async function createTenant(body: { name: string; inn: string }) {
  return apiRequest<TenantOut>('/landlord/tenants', { method: 'POST', body })
}

export async function createLease(body: {
  tenant_id: number
  unit_id: number
  rent_monthly: number
  start_date?: string
  end_date: string
  file_ids?: number[]
}) {
  return apiRequest('/landlord/leases', { method: 'POST', body })
}

export async function listTransactions(params: Record<string, string | number | undefined> = {}) {
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') search.set(k, String(v))
  }
  const q = search.toString()
  return apiRequest<TransactionOut[]>(`/landlord/transactions${q ? `?${q}` : ''}`)
}

export async function createTransaction(body: {
  type: 'income' | 'expense'
  title: string
  amount: number
  category: string
  object_id?: number | null
  comment?: string | null
  transaction_date: string
  file_ids?: number[]
}) {
  return apiRequest<TransactionOut>('/landlord/transactions', { method: 'POST', body })
}

export async function getObjectPayers(objectId: number) {
  return apiRequest<PayersMatrixOut>(`/landlord/objects/${objectId}/payers`)
}

export async function listObjectBills(objectId: number) {
  return apiRequest<UtilityBillListItem[]>(`/landlord/objects/${objectId}/bills`)
}

export async function createUtilityBill(body: {
  object_id: number
  file_id?: number
  title: string
  period: string
  pay_by: string
  amounts: Record<string, number>
}) {
  return apiRequest('/landlord/bills', { method: 'POST', body })
}

export async function listObjectMeters(objectId: number, period: string) {
  return apiRequest<import('@/api/types').ObjectMetersOut>(
    `/landlord/objects/${objectId}/meters?period=${encodeURIComponent(period)}`,
  )
}

export async function upsertMeter(body: {
  unit_id: number
  period: string
  criterion: string
  previous_value: number
  current_value: number
}) {
  return apiRequest('/landlord/meters', { method: 'PUT', body })
}

export async function getSubscription() {
  return apiRequest('/landlord/subscription')
}

export async function upgradeSubscription(plan?: string) {
  return apiRequest('/landlord/subscription/upgrade', {
    method: 'POST',
    body: plan ? { plan } : {},
  })
}

export async function listLandlordInvoices(status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : ''
  return apiRequest<LandlordInvoiceOut[]>(`/landlord/invoices${query}`)
}

export async function getLandlordInvoice(invoiceId: number) {
  return apiRequest<InvoiceDetailOut>(`/landlord/invoices/${invoiceId}`)
}

export async function confirmInvoicePayment(invoiceId: number) {
  return apiRequest<InvoiceDetailOut>(`/landlord/invoices/${invoiceId}/confirm-payment`, {
    method: 'POST',
  })
}

export async function listNotifications() {
  return apiRequest('/notifications')
}

export async function markNotificationRead(id: number | string) {
  return apiRequest(`/notifications/${id}`, {
    method: 'PATCH',
    body: { is_read: true },
  })
}
