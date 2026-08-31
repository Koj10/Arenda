import { defineStore } from 'pinia'
import { ref } from 'vue'
import { formatApiError } from '@/api/http'
import { listTenantInvoices, listTenantSpaces } from '@/api/tenant'
import { num } from '@/api/types'
import type { InvoiceStatus, InvoiceType, PaymentMethod } from '@/types/billing'

export interface TenantPanelSpace {
  leaseId: number
  status: string
  startDate: string | null
  endDate: string
  rentMonthly: number
  unitId: number
  unitNumber: string
  unitArea: number
  objectId: number
  objectAddress: string
  tenantName: string
  tenantInn: string
}

export interface TenantPanelInvoice {
  id: number
  kind: InvoiceType
  period: string
  amount: number
  dueDate: string
  status: InvoiceStatus
  objectAddress: string
  unitNumber: string
  unitId: number | null
  paymentMethod: PaymentMethod | null
  files: { id: number; original_name: string }[]
}

function asInvoiceType(kind: string): InvoiceType {
  if (kind === 'rent') return 'rent'
  if (kind === 'utility' || kind === 'utilities') return 'utilities'
  return 'other'
}

function asInvoiceStatus(status: string): InvoiceStatus {
  if (status === 'paid' || status === 'overdue' || status === 'pending' || status === 'awaiting_confirmation') {
    return status
  }
  return 'pending'
}

function asPaymentMethod(value?: string | null): PaymentMethod | null {
  if (value === 'cash' || value === 'bank' || value === 'in_app') return value
  return null
}

export const useTenantPanelStore = defineStore('tenantPanel', () => {
  const spaces = ref<TenantPanelSpace[]>([])
  const invoices = ref<TenantPanelInvoice[]>([])
  const matched = ref(false)
  const message = ref<string | null>(null)
  const loading = ref(false)
  const lastError = ref<string | null>(null)

  function getSpaceByLeaseId(leaseId: number) {
    return spaces.value.find((item) => item.leaseId === leaseId) ?? null
  }

  function invoicesForUnit(unitId: number) {
    return invoices.value.filter((item) => item.unitId === unitId)
  }

  async function loadFromApi() {
    loading.value = true
    lastError.value = null
    try {
      const [spacesRes, invoicesRes] = await Promise.all([
        listTenantSpaces(),
        listTenantInvoices(),
      ])
      matched.value = spacesRes.matched
      message.value = spacesRes.message ?? invoicesRes.message ?? null
      spaces.value = (spacesRes.spaces ?? []).map((row) => ({
        leaseId: row.lease_id,
        status: row.status,
        startDate: row.start_date ?? null,
        endDate: row.end_date,
        rentMonthly: num(row.rent_monthly),
        unitId: row.unit_id,
        unitNumber: row.unit_number,
        unitArea: num(row.unit_area),
        objectId: row.object_id,
        objectAddress: row.object_address,
        tenantName: row.tenant_name ?? '',
        tenantInn: row.tenant_inn ?? '',
      }))
      invoices.value = (invoicesRes.invoices ?? []).map((row) => ({
        id: row.id,
        kind: asInvoiceType(row.kind),
        period: row.period,
        amount: num(row.amount),
        dueDate: row.due_date,
        status: asInvoiceStatus(row.computed_status || row.status),
        objectAddress: row.object_address ?? '',
        unitNumber: row.unit_number ?? '',
        unitId: row.unit_id ?? null,
        paymentMethod: asPaymentMethod(row.payment_method),
        files: (row.files ?? []).map((file) => ({
          id: file.id,
          original_name: file.original_name || file.filename || file.name || `файл ${file.id}`,
        })),
      }))
    } catch (err) {
      lastError.value = formatApiError(err, 'Не удалось загрузить данные арендатора')
      spaces.value = []
      invoices.value = []
      matched.value = false
    } finally {
      loading.value = false
    }
  }

  function reset() {
    spaces.value = []
    invoices.value = []
    matched.value = false
    message.value = null
    lastError.value = null
  }

  return {
    spaces,
    invoices,
    matched,
    message,
    loading,
    lastError,
    getSpaceByLeaseId,
    invoicesForUnit,
    loadFromApi,
    reset,
  }
})
