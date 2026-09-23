import { computed, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { useBillingStore } from '@/stores/billingStore'
import { useTenantPanelStore } from '@/stores/tenantPanelStore'
import { INVOICE_TYPE_LABELS, INVOICE_STATUS_LABELS } from '@/types/billing'
import type { TenantBillReportRow, TenantLeaseReportRow, TenantReportScope } from '@/types/tenantReports'
import { getTenantReports } from '@/api/tenant'
import { num } from '@/api/types'
import { currentPeriod } from '@/utils/dates'

const STATUS_LABELS: Record<string, string> = {
  active: 'Активен',
  expiring: 'Истекает',
  overdue: 'Просрочен',
}

export function useTenantReports(scope: () => TenantReportScope, reportKind: () => 'leases' | 'bills') {
  const auth = useAuthStore()
  const portfolio = usePortfolioStore()
  const billing = useBillingStore()
  const tenantPanel = useTenantPanelStore()
  const apiRows = ref<Record<string, string | number>[]>([])
  const period = ref(currentPeriod())

  onMounted(() => {
    void tenantPanel.loadFromApi()
  })

  watch(
    reportKind,
    async (tab) => {
      try {
        const data = await getTenantReports(tab, period.value)
        apiRows.value = (data.rows ?? []).map((row) => {
          const next: Record<string, string | number> = {}
          for (const [key, value] of Object.entries(row)) {
            next[key] = value == null ? '' : typeof value === 'number' ? value : String(value)
          }
          if (next.amount != null) next.amount = num(next.amount)
          if (next.rent != null) next.rent = num(next.rent)
          if (next.area != null) next.area = num(next.area)
          return next
        })
      } catch {
        apiRows.value = []
      }
    },
    { immediate: true },
  )

  const leases = computed(() => tenantPanel.spaces)

  const leaseRows = computed<TenantLeaseReportRow[]>(() => {
    let list = leases.value
    const s = scope()
    if (s.kind === 'lease' || s.kind === 'space') {
      list = list.filter((l) => l.leaseId === s.tenantId)
    }
    return list.map((l) => ({
      address: l.objectAddress,
      space: l.unitNumber,
      area: l.unitArea,
      rent: l.rentMonthly,
      contract: portfolio.formatDate(l.endDate),
      status: STATUS_LABELS[l.status] ?? l.status,
    }))
  })

  const billRows = computed<TenantBillReportRow[]>(() => {
    let list = tenantPanel.invoices
    const s = scope()
    if (s.kind === 'lease' || s.kind === 'space') {
      const lease = leases.value.find((l) => l.leaseId === s.tenantId)
      if (lease) {
        list = list.filter((i) => i.unitId === lease.unitId)
      }
    }
    return [...list]
      .sort((a, b) => b.dueDate.localeCompare(a.dueDate))
      .map((i) => ({
        period: billing.formatPeriod(i.period),
        title: INVOICE_TYPE_LABELS[i.kind],
        type: INVOICE_TYPE_LABELS[i.kind],
        space: i.unitNumber,
        amount: i.amount,
        status: INVOICE_STATUS_LABELS[i.status],
        dueDate: billing.formatDate(i.dueDate),
      }))
  })

  const displayRows = computed(() => {
    if (apiRows.value.length) return apiRows.value
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

  return { leases, leaseRows, billRows, displayRows, summary, portfolio, billing, auth, period }
}

export function formatTenantCell(key: string, value: string | number, portfolio: ReturnType<typeof usePortfolioStore>) {
  if (key === 'rent' || key === 'amount') return portfolio.formatMoney(value as number)
  if (key === 'area') return portfolio.formatArea(value as number)
  return String(value)
}
