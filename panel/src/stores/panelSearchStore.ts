import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { useAccountingStore } from '@/stores/accountingStore'
import { useBillingStore } from '@/stores/billingStore'
import { PROPERTY_TYPE_LABELS } from '@/types/portfolio'
import { EXPENSE_CATEGORY_LABELS } from '@/types/accounting'
import { INVOICE_STATUS_LABELS } from '@/types/billing'

export type PanelSearchKind = 'property' | 'tenant' | 'space' | 'expense' | 'invoice' | 'page'

export interface PanelSearchHit {
  id: string
  kind: PanelSearchKind
  title: string
  subtitle: string
  /** Navigate first */
  to?: string
  propertyId?: number
  tenantId?: number
  expenseId?: number
  leaseId?: number
}

const PAGES_LANDLORD: { title: string; subtitle: string; to: string; keys: string }[] = [
  { title: 'Аналитика', subtitle: 'Отчёты', to: '/landlord/reports', keys: 'аналитика отчёты reports' },
  { title: 'Объекты', subtitle: 'Недвижимость', to: '/landlord/objects', keys: 'объекты недвижимость objects' },
  { title: 'Арендаторы', subtitle: 'Контракты', to: '/landlord/tenants', keys: 'арендаторы tenants' },
  { title: 'Финансы', subtitle: 'Доходы и расходы', to: '/landlord/accounting', keys: 'финансы транзакции счета accounting' },
  { title: 'Настройки', subtitle: 'Профиль и тариф', to: '/settings', keys: 'настройки профиль тариф' },
  { title: 'Помощь', subtitle: 'FAQ', to: '/help', keys: 'помощь faq поддержка' },
]

const PAGES_TENANT: { title: string; subtitle: string; to: string; keys: string }[] = [
  { title: 'Мои помещения', subtitle: 'Аренда', to: '/tenant/spaces', keys: 'помещения spaces' },
  { title: 'Счета', subtitle: 'Оплаты', to: '/tenant/bills', keys: 'счета bills оплата' },
  { title: 'Отчёты', subtitle: 'Выгрузки', to: '/tenant/reports', keys: 'отчёты reports' },
  { title: 'Настройки', subtitle: 'Профиль', to: '/settings', keys: 'настройки профиль' },
  { title: 'Помощь', subtitle: 'FAQ', to: '/help', keys: 'помощь faq' },
]

function norm(s: string) {
  return s.toLowerCase().trim()
}

function match(hay: string, q: string) {
  return norm(hay).includes(q)
}

export const usePanelSearchStore = defineStore('panelSearch', () => {
  const query = ref('')
  const open = ref(false)

  const results = computed<PanelSearchHit[]>(() => {
    const q = norm(query.value)
    if (q.length < 1) return []

    const auth = useAuthStore()
    const portfolio = usePortfolioStore()
    const accounting = useAccountingStore()
    const billing = useBillingStore()
    const hits: PanelSearchHit[] = []

    const pages = auth.isTenant ? PAGES_TENANT : PAGES_LANDLORD
    for (const p of pages) {
      if (match(p.title, q) || match(p.keys, q) || match(p.subtitle, q)) {
        hits.push({
          id: `page:${p.to}`,
          kind: 'page',
          title: p.title,
          subtitle: p.subtitle,
          to: p.to,
        })
      }
    }

    if (auth.isTenant) {
      const inn = auth.tenantInn
      if (inn) {
        for (const lease of portfolio.getLeasesByInn(inn)) {
          const hay = `${lease.property.address} ${lease.space.name} ${lease.tenant.company}`
          if (match(hay, q)) {
            hits.push({
              id: `lease:${lease.tenant.id}`,
              kind: 'space',
              title: lease.space.name,
              subtitle: lease.property.address,
              to: `/tenant/spaces/${lease.tenant.id}`,
              leaseId: lease.tenant.id,
            })
          }
        }
        for (const inv of billing.getInvoicesByInn(inn)) {
          const hay = `${inv.title} ${inv.space} ${inv.period}`
          if (match(hay, q)) {
            hits.push({
              id: `inv:${inv.id}`,
              kind: 'invoice',
              title: inv.title,
              subtitle: `${INVOICE_STATUS_LABELS[inv.status]} · ${inv.space}`,
              to: '/tenant/bills',
            })
          }
        }
      }
    } else {
      for (const p of portfolio.properties) {
        const type = PROPERTY_TYPE_LABELS[p.type] ?? p.type
        if (match(p.address, q) || match(type, q)) {
          hits.push({
            id: `prop:${p.id}`,
            kind: 'property',
            title: p.address,
            subtitle: `${type} · ${p.spacesOccupied}/${p.spacesTotal} помещений`,
            to: '/landlord/objects',
            propertyId: p.id,
          })
        }
      }

      for (const t of portfolio.tenants) {
        const hay = `${t.company} ${t.inn} ${t.space}`
        if (match(hay, q)) {
          hits.push({
            id: `tenant:${t.id}`,
            kind: 'tenant',
            title: t.company,
            subtitle: `ИНН ${t.inn} · ${t.space}`,
            to: '/landlord/tenants',
            tenantId: t.id,
          })
        }
      }

      for (const s of portfolio.spaces) {
        const prop = portfolio.getPropertyById(s.propertyId)
        const hay = `${s.name} ${prop?.address ?? ''} ${s.spaceType ?? ''}`
        if (match(hay, q)) {
          hits.push({
            id: `space:${s.id}`,
            kind: 'space',
            title: `Помещение ${s.name}`,
            subtitle: prop?.address ?? '',
            to: '/landlord/objects',
            propertyId: s.propertyId,
          })
        }
      }

      for (const e of accounting.expenses) {
        const cat = EXPENSE_CATEGORY_LABELS[e.category] ?? e.category
        const hay = `${e.title} ${cat}`
        if (match(hay, q)) {
          hits.push({
            id: `exp:${e.id}`,
            kind: 'expense',
            title: e.title,
            subtitle: cat,
            to: '/landlord/accounting',
            expenseId: e.id,
          })
        }
      }
    }

    return hits.slice(0, 12)
  })

  const hasQuery = computed(() => norm(query.value).length > 0)

  function setQuery(value: string) {
    query.value = value
    open.value = norm(value).length > 0
  }

  function clear() {
    query.value = ''
    open.value = false
  }

  function close() {
    open.value = false
  }

  return { query, open, results, hasQuery, setQuery, clear, close }
})
