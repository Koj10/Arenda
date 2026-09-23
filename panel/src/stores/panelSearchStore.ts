import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { useAccountingStore } from '@/stores/accountingStore'
import { useTenantPanelStore } from '@/stores/tenantPanelStore'
import { PROPERTY_TYPE_LABELS } from '@/types/portfolio'
import { EXPENSE_CATEGORY_LABELS } from '@/types/accounting'
import { INVOICE_STATUS_LABELS } from '@/types/billing'
import { searchLandlord } from '@/api/landlord'
import { num } from '@/api/types'

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
  { title: 'Аналитика', subtitle: 'Доходы и расходы', to: '/landlord/accounting', keys: 'аналитика транзакции accounting' },
  { title: 'Объекты', subtitle: 'Недвижимость', to: '/landlord/objects', keys: 'объекты недвижимость objects' },
  { title: 'Кадастр', subtitle: 'Кадастровые номера', to: '/landlord/cadastral', keys: 'кадастр cadastral' },
  { title: 'Арендаторы', subtitle: 'Контракты', to: '/landlord/tenants', keys: 'арендаторы tenants' },
  { title: 'Документы', subtitle: 'Файлы кабинета', to: '/landlord/documents', keys: 'документы файлы documents' },
  { title: 'Счета', subtitle: 'Коммунальные счета', to: '/landlord/bills', keys: 'счета bills коммунальные жкх' },
  { title: 'Финансы', subtitle: 'Отчёты', to: '/landlord/reports', keys: 'финансы отчёты reports' },
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
  const remoteHits = ref<PanelSearchHit[]>([])
  let searchTimer: ReturnType<typeof setTimeout> | null = null

  watch(query, (value) => {
    if (searchTimer) clearTimeout(searchTimer)
    const q = value.trim()
    if (q.length < 2) {
      remoteHits.value = []
      return
    }
    searchTimer = setTimeout(() => {
      void (async () => {
        const auth = useAuthStore()
        if (auth.isTenant) return
        try {
          const data = await searchLandlord(q)
          const hits: PanelSearchHit[] = []
          for (const row of data.objects ?? []) {
            hits.push({
              id: `api-prop:${row.id}`,
              kind: 'property',
              title: row.address,
              subtitle: `${row.type} · ${num(row.total_area)} м²`,
              to: '/landlord/objects',
              propertyId: row.id,
            })
          }
          for (const row of data.tenants ?? []) {
            hits.push({
              id: `api-tenant:${row.id}`,
              kind: 'tenant',
              title: row.name,
              subtitle: `ИНН ${row.inn}`,
              to: '/landlord/tenants',
              tenantId: row.id,
            })
          }
          remoteHits.value = hits
        } catch {
          remoteHits.value = []
        }
      })()
    }, 280)
  })

  const results = computed<PanelSearchHit[]>(() => {
    const q = norm(query.value)
    if (q.length < 1) return []

    const auth = useAuthStore()
    const portfolio = usePortfolioStore()
    const accounting = useAccountingStore()
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
      const tenantPanel = useTenantPanelStore()
      for (const lease of tenantPanel.spaces) {
        const hay = `${lease.objectAddress} ${lease.unitNumber} ${lease.tenantName}`
        if (match(hay, q)) {
          hits.push({
            id: `lease:${lease.leaseId}`,
            kind: 'space',
            title: lease.unitNumber,
            subtitle: lease.objectAddress,
            to: `/tenant/spaces/${lease.leaseId}`,
            leaseId: lease.leaseId,
          })
        }
      }
      for (const inv of tenantPanel.invoices) {
        const hay = `${inv.kind} ${inv.unitNumber} ${inv.period}`
        if (match(hay, q)) {
          hits.push({
            id: `inv:${inv.id}`,
            kind: 'invoice',
            title: INVOICE_STATUS_LABELS[inv.status],
            subtitle: `${inv.unitNumber} · ${inv.period}`,
            to: '/tenant/bills',
          })
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
        const hay = `${t.company} ${t.inn} ${t.email} ${t.space}`
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

    const merged = [...hits]
    for (const hit of remoteHits.value) {
      if (!merged.some((item) => item.kind === hit.kind && item.propertyId === hit.propertyId && item.tenantId === hit.tenantId && item.title === hit.title)) {
        merged.push(hit)
      }
    }
    return merged.slice(0, 12)
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
