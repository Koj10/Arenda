import { computed } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { useBillingStore } from '@/stores/billingStore'
import { INVOICE_TYPE_LABELS, INVOICE_STATUS_LABELS } from '@/types/billing'
import type { TenantBillReportRow, TenantLeaseReportRow, TenantReportScope } from '@/types/tenantReports'

const STATUS_LABELS: Record<string, string> = {
  active: 'Активен',
  expiring: 'Истекает',
  overdue: 'Просрочен',
}

export function useTenantReports(scope: () => TenantReportScope, reportKind: () => 'leases' | 'bills') {
  const auth = useAuthStore()
  const portfolio = usePortfolioStore()
  const billing = useBillingStore()

  const leases = computed(() => {
    const inn = auth.tenantInn
    if (!inn) return []
    return portfolio.getLeasesByInn(inn)
  })

  const leaseRows = computed<TenantLeaseReportRow[]>(() => {
    let list = leases.value
    const s = scope()
    if (s.kind === 'lease') {
      list = list.filter((l) => l.tenant.id === s.tenantId)
    } else if (s.kind === 'space') {
      list = list.filter((l) => l.tenant.id === s.tenantId)
    }
    return list.map((l) => ({
      address: l.property.address,
      space: l.space.name,
      area: l.space.area,
      rent: l.tenant.rent,
      contract: portfolio.formatDate(l.tenant.contract),
      status: STATUS_LABELS[l.tenant.status] ?? l.tenant.status,
    }))
  })

  const billRows = computed<TenantBillReportRow[]>(() => {
    const inn = auth.tenantInn
    if (!inn) return []
    let list = billing.getInvoicesByInn(inn)
    const s = scope()
    if (s.kind === 'lease' || s.kind === 'space') {
      list = list.filter((i) => i.tenantId === s.tenantId)
    }
    return list
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
      .map((i) => ({
        period: billing.formatPeriod(i.period),
        title: i.title,
        type: INVOICE_TYPE_LABELS[i.type],
        space: i.space,
        amount: i.amount,
        status: INVOICE_STATUS_LABELS[i.status],
        dueDate: billing.formatDate(i.dueDate),
      }))
  })

  const displayRows = computed(() => {
    const rows = reportKind() === 'leases' ? leaseRows.value : billRows.value
    return rows as unknown as Record<string, string | number>[]
  })

  const summary = computed(() => {
    if (reportKind() === 'leases') {
      return {
        totalRent: leaseRows.value.reduce((s, r) => s + r.rent, 0),
        count: leaseRows.value.length,
      }
    }
    const pending = billRows.value.filter((r) => r.status === 'К оплате' || r.status === 'Просрочен')
    return {
      totalPending: pending.reduce((s, r) => s + r.amount, 0),
      totalPaid: billRows.value.filter((r) => r.status === 'Оплачен').reduce((s, r) => s + r.amount, 0),
      count: billRows.value.length,
    }
  })

  return { leases, leaseRows, billRows, displayRows, summary, portfolio, billing }
}

export function formatTenantCell(key: string, value: string | number, portfolio: ReturnType<typeof usePortfolioStore>) {
  if (key === 'rent' || key === 'amount') return portfolio.formatMoney(value as number)
  if (key === 'area') return portfolio.formatArea(value as number)
  return String(value)
}
