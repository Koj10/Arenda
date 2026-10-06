import { apiDownload, apiRequest, formatApiError, queryString, ApiError } from '@/api/http'
import { asList } from '@/api/types'
import type {
  CadastreOut,
  CadastreSplitOut,
  CadastralObjectDetail,
  CadastralSummaryItem,
  GenerateInvoicesResponse,
  InvoiceDetailOut,
  InvoiceUpdateBody,
  LandlordAnalyticsResponse,
  LandlordInvoiceOut,
  LeaseDetailOut,
  ObjectDetailOut,
  ObjectListItem,
  PayersMatrixOut,
  ReportResponse,
  SearchResponse,
  TenantDetailOut,
  TenantOut,
  TenantSuggestItem,
  TenantTariffOut,
  TransactionOut,
  UnitInObjectOut,
  UtilityBillDetailOut,
  UtilityBillListItem,
  BillObjectOut,
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

export async function updateObject(objectId: number, body: {
  address?: string
  type?: 'office' | 'retail' | 'warehouse'
  total_area?: number
}) {
  return apiRequest<ObjectDetailOut>(`/landlord/objects/${objectId}`, { method: 'PATCH', body })
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

export async function getUnit(unitId: number) {
  return apiRequest<UnitInObjectOut>(`/landlord/units/${unitId}`)
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

export async function splitCadastre(cadastreId: number, body: {
  new_cadastre_number_1: string
  new_cadastre_number_2: string
  split_area_1: number
  split_area_2: number
}) {
  return apiRequest<CadastreSplitOut[]>(`/landlord/cadastre/${cadastreId}/split`, {
    method: 'POST',
    body,
  })
}

export async function listCadastral(q?: string) {
  return apiRequest<CadastralSummaryItem[]>(`/landlord/cadastral${queryString({ q })}`)
}

export async function getCadastralObject(objectId: number) {
  return apiRequest<CadastralObjectDetail>(`/landlord/cadastral/${objectId}`)
}

export async function listTenants(q?: string) {
  const query = q ? `?q=${encodeURIComponent(q)}` : ''
  return apiRequest<TenantOut[]>(`/landlord/tenants${query}`)
}

export async function getTenant(tenantId: number) {
  return apiRequest<TenantDetailOut>(`/landlord/tenants/${tenantId}`)
}

export async function createTenant(body: { name: string; inn: string; email?: string | null }) {
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
  return apiRequest<LeaseDetailOut>('/landlord/leases', { method: 'POST', body })
}

export async function updateLease(
  leaseId: number,
  body: {
    rent_monthly?: number
    start_date?: string | null
    end_date?: string
    file_ids?: number[]
  },
) {
  return apiRequest(`/landlord/leases/${leaseId}`, { method: 'PATCH', body })
}

export async function terminateLease(leaseId: number) {
  return apiRequest(`/landlord/leases/${leaseId}/terminate`, { method: 'POST' })
}

export async function deleteLease(leaseId: number) {
  return apiRequest<void>(`/landlord/leases/${leaseId}`, { method: 'DELETE' })
}

export async function updateTenant(tenantId: number, body: { name?: string; inn?: string; email?: string | null }) {
  return apiRequest<TenantOut>(`/landlord/tenants/${tenantId}`, { method: 'PATCH', body })
}

export async function sendTenantInvitation(tenantId: number) {
  return apiRequest<Record<string, unknown>>(`/landlord/tenants/${tenantId}/invitation`, {
    method: 'POST',
  })
}

export async function deleteTenant(tenantId: number) {
  return apiRequest<void>(`/landlord/tenants/${tenantId}`, { method: 'DELETE' })
}

export async function suggestTenants(inn?: string) {
  return apiRequest<TenantSuggestItem[]>(`/landlord/tenants/suggest${queryString({ inn })}`)
}

export async function listTenantTariffs(tenantId: number) {
  return apiRequest<TenantTariffOut[]>(`/landlord/tenants/${tenantId}/tariffs`)
}

export async function createTenantTariff(tenantId: number, body: {
  tenant_id: number
  criterion: string
  rate: number
  unit?: string
  effective_from?: string | null
  effective_to?: string | null
}) {
  return apiRequest<TenantTariffOut>(`/landlord/tenants/${tenantId}/tariffs`, {
    method: 'POST',
    body,
  })
}

export async function getTenantTariff(tariffId: number) {
  return apiRequest<TenantTariffOut>(`/landlord/tenants/tariffs/${tariffId}`)
}

export async function updateTenantTariff(tariffId: number, body: {
  rate?: number
  unit?: string
  effective_to?: string | null
}) {
  return apiRequest<TenantTariffOut>(`/landlord/tenants/tariffs/${tariffId}`, {
    method: 'PATCH',
    body,
  })
}

export async function deleteTenantTariff(tariffId: number) {
  return apiRequest<void>(`/landlord/tenants/tariffs/${tariffId}`, { method: 'DELETE' })
}

export async function listTransactions(params: Record<string, string | number | undefined> = {}) {
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') search.set(k, String(v))
  }
  const q = search.toString()
  return asList<TransactionOut>(await apiRequest<unknown>(`/landlord/transactions${q ? `?${q}` : ''}`))
}

export async function getTransaction(transactionId: number) {
  return apiRequest<TransactionOut>(`/landlord/transactions/${transactionId}`)
}

export async function updateTransaction(transactionId: number, body: {
  type?: 'income' | 'expense'
  title?: string
  amount?: number
  category?: string
  object_id?: number | null
  comment?: string | null
  transaction_date?: string
  file_ids?: number[]
}) {
  return apiRequest<TransactionOut>(`/landlord/transactions/${transactionId}`, {
    method: 'PATCH',
    body,
  })
}

export async function deleteTransaction(transactionId: number) {
  return apiRequest<void>(`/landlord/transactions/${transactionId}`, { method: 'DELETE' })
}

export async function getLandlordAnalytics(period: string) {
  return apiRequest<LandlordAnalyticsResponse>(
    `/landlord/analytics?period=${encodeURIComponent(period)}`,
  )
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
  return asList<UtilityBillListItem>(
    await apiRequest<unknown>(`/landlord/objects/${objectId}/bills`),
  )
}

export async function createUtilityBill(body: {
  object_id: number
  file_id?: number
  title: string
  period: string
  pay_by: string
  amounts: Record<string, number>
}) {
  return apiRequest<UtilityBillDetailOut>('/landlord/bills', { method: 'POST', body })
}

export async function getUtilityBill(billId: number) {
  return apiRequest<UtilityBillDetailOut>(`/landlord/bills/${billId}`)
}

export async function listBillObjects(q?: string) {
  return apiRequest<BillObjectOut[]>(`/landlord/bills/objects${queryString({ q })}`)
}

function moneyAmount(value: number) {
  return Math.round(Number(value) * 100) / 100
}

export function invoiceIdOf(raw: unknown): number | null {
  if (raw == null) return null
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return Number(raw)
  if (typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const nested = row.invoice
  const id = row.id ?? row.invoice_id ?? (nested && typeof nested === 'object' ? (nested as { id?: unknown }).id : null)
  const n = Number(id)
  return Number.isFinite(n) && n > 0 ? n : null
}

export async function createLandlordInvoice(body: {
  tenant_id: number
  unit_id?: number | null
  kind?: 'utility' | 'rent'
  period: string
  amount: number
  due_date: string
  file_ids?: number[]
}) {
  const payload = {
    tenant_id: body.tenant_id,
    unit_id: body.unit_id ?? undefined,
    kind: body.kind ?? 'utility',
    period: body.period,
    amount: moneyAmount(body.amount),
    due_date: String(body.due_date).slice(0, 10),
    file_ids: body.file_ids?.length ? body.file_ids : undefined,
  }
  try {
    return await apiRequest<LandlordInvoiceOut>('/landlord/invoices', { method: 'POST', body: payload })
  } catch (err) {
    if (err instanceof ApiError && err.status === 422 && payload.file_ids?.length) {
      const { file_ids: _files, ...withoutFiles } = payload
      return apiRequest<LandlordInvoiceOut>('/landlord/invoices', { method: 'POST', body: withoutFiles })
    }
    throw err
  }
}

export async function findLandlordInvoice(params: {
  tenant_id: number
  period: string
  unit_id?: number | null
  kind?: 'utility' | 'rent'
}) {
  const list = await listLandlordInvoices({ tenant_id: params.tenant_id, period: params.period })
  const matched = list.filter((row) => {
    if (params.kind && row.kind && row.kind !== params.kind) return false
    if (params.unit_id != null && row.unit_id != null && row.unit_id !== params.unit_id) return false
    return true
  })
  return matched.sort((a, b) => b.id - a.id)[0] ?? list.sort((a, b) => b.id - a.id)[0] ?? null
}

export async function ensureLandlordInvoice(body: {
  tenant_id: number
  unit_id?: number | null
  kind?: 'utility' | 'rent'
  period: string
  amount: number
  due_date: string
  file_ids?: number[]
}): Promise<LandlordInvoiceOut> {
  try {
    const created = await createLandlordInvoice(body)
    const id = invoiceIdOf(created)
    if (id) return { ...created, id }
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0
    if (status && status !== 400 && status !== 409 && status !== 422) throw err
  }
  const existing = await findLandlordInvoice({
    tenant_id: body.tenant_id,
    period: body.period,
    unit_id: body.unit_id,
    kind: body.kind,
  })
  if (!existing) throw new Error('Счёт не создался: API не вернул id')
  return existing
}

export async function listLandlordInvoices(params: {
  status?: string
  tenant_id?: number
  period?: string
} = {}) {
  return asList<LandlordInvoiceOut>(
    await apiRequest<unknown>(`/landlord/invoices${queryString(params)}`),
  )
}

export async function getLandlordInvoice(invoiceId: number) {
  return apiRequest<InvoiceDetailOut>(`/landlord/invoices/${invoiceId}`)
}

export async function updateLandlordInvoice(invoiceId: number, body: InvoiceUpdateBody) {
  return apiRequest<InvoiceDetailOut>(`/landlord/invoices/${invoiceId}`, {
    method: 'PATCH',
    body,
  })
}

export async function deleteLandlordInvoice(invoiceId: number) {
  return apiRequest<void>(`/landlord/invoices/${invoiceId}`, { method: 'DELETE' })
}

export async function calculateLandlordInvoice(tenantId: number, period: string) {
  return apiRequest<InvoiceDetailOut>(
    `/landlord/invoices/calculate${queryString({ tenant_id: tenantId, period })}`,
    { method: 'POST' },
  )
}

export async function generateLandlordInvoices(period: string) {
  return apiRequest<GenerateInvoicesResponse>(
    `/landlord/invoices/generate${queryString({ period })}`,
    { method: 'POST' },
  )
}

export async function sendLandlordInvoice(invoiceId: number) {
  if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
    throw new ApiError('Нет id счёта для отправки', 400)
  }
  try {
    return await apiRequest<Record<string, unknown>>(
      `/landlord/invoices/send${queryString({ invoice_id: invoiceId })}`,
      { method: 'POST' },
    )
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0
    if (status !== 404 && status !== 405 && status !== 422) throw err
    try {
      return await apiRequest<Record<string, unknown>>('/landlord/invoices/send', {
        method: 'POST',
        body: { invoice_id: invoiceId },
      })
    } catch {
      return apiRequest<Record<string, unknown>>(`/landlord/invoices/${invoiceId}/send`, {
        method: 'POST',
      })
    }
  }
}

export async function deliverInvoiceToTenant(params: {
  invoiceId: number
  tenantId: number
  isRegistered?: boolean
  email?: string | null
}): Promise<{ sent: boolean; invited: boolean; warnings: string[] }> {
  const warnings: string[] = []
  let sent = false
  let invited = false
  if (!params.isRegistered) {
    try {
      await sendTenantInvitation(params.tenantId)
      invited = true
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0
      if (status === 409) {
        invited = true
      } else if (!params.email?.trim()) {
        warnings.push('Арендатор не в PropCount и нет email — приглашение не отправлено')
      } else {
        warnings.push(formatApiError(err, 'Приглашение не отправилось'))
      }
    }
  }
  try {
    await sendLandlordInvoice(params.invoiceId)
    sent = true
  } catch (err) {
    warnings.push(formatApiError(err, 'Счёт создан, но письмо со счётом не ушло'))
  }
  return { sent, invited, warnings }
}

export async function listSentInvoiceHistory(objectId?: number) {
  return apiRequest<LandlordInvoiceOut[]>(
    `/landlord/invoices/sent-history${queryString({ object_id: objectId })}`,
  )
}

export async function processInAppPayment(invoiceId: number) {
  return apiRequest<{ message?: string; detail?: string; status?: string }>(
    `/landlord/payment/process${queryString({ invoice_id: invoiceId })}`,
    { method: 'POST' },
  )
}

export async function getLandlordReports(params: {
  period: string
  object_id?: number
  unit_id?: number
}) {
  return apiRequest<ReportResponse>(`/landlord/reports${queryString(params)}`)
}

export async function exportLandlordReports(params: {
  period: string
  object_id?: number
  unit_id?: number
  fields?: string
}) {
  return apiDownload(`/landlord/reports/export${queryString(params)}`)
}

export async function searchLandlord(q?: string) {
  return apiRequest<SearchResponse>(`/landlord/search${queryString({ q })}`)
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
