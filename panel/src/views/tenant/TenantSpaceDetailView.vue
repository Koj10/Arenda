<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TenantLayout from '@/components/layout/TenantLayout.vue'
import { ArrowLeft, Building2, MapPin } from '@lucide/vue'
import { useAuthStore } from '@/stores/authStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { useBillingStore } from '@/stores/billingStore'
import { useTenantPanelStore } from '@/stores/tenantPanelStore'
import { INVOICE_TYPE_LABELS, INVOICE_STATUS_LABELS } from '@/types/billing'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const portfolio = usePortfolioStore()
const billing = useBillingStore()
const tenantPanel = useTenantPanelStore()

const leaseId = computed(() => Number(route.params.leaseId))

onMounted(() => {
  if (!tenantPanel.spaces.length) void tenantPanel.loadFromApi()
})

const lease = computed(() => tenantPanel.getSpaceByLeaseId(leaseId.value))

const areaShareLabel = computed(() =>
  lease.value ? portfolio.formatArea(lease.value.unitArea) : '',
)

const recentBills = computed(() =>
  lease.value ? tenantPanel.invoicesForUnit(lease.value.unitId).slice(0, 5) : [],
)

function statusLabel(status: string) {
  const map: Record<string, string> = { active: 'Активен', expiring: 'Истекает', overdue: 'Просрочен' }
  return map[status] ?? status
}

function statusClass(status: string) {
  const map: Record<string, string> = {
    active: 'text-emerald-400 bg-emerald-500/10',
    expiring: 'text-accent-amber bg-accent-amber/10',
    overdue: 'text-rose-400 bg-rose-500/10',
  }
  return map[status] ?? ''
}

function billStatusClass(status: string) {
  const map: Record<string, string> = {
    pending: 'text-accent-amber bg-accent-amber/10',
    paid: 'text-emerald-400 bg-emerald-500/10',
    overdue: 'text-rose-400 bg-rose-500/10',
  }
  return map[status] ?? ''
}
</script>

<template>
  <TenantLayout>
    <div v-if="lease" class="panel-page">
      <button
        type="button"
        class="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-emerald-brand mb-5"
        @click="router.push('/tenant/spaces')"
      >
        <ArrowLeft class="w-4 h-4" />
        Все помещения
      </button>

      <div class="mb-6">
        <h2 class="panel-page-title !mb-1 font-mono">{{ lease.unitNumber }}</h2>
        <p class="text-sm text-slate-400 flex items-center gap-1.5 min-w-0">
          <MapPin class="w-4 h-4 shrink-0" />
          <span class="truncate">{{ lease.objectAddress }}</span>
        </p>
      </div>

      <div class="grid sm:grid-cols-2 gap-4 mb-6">
        <div class="panel-stat-card">
          <p class="text-xs text-slate-500 uppercase tracking-wide mb-2">Помещение</p>
          <p class="text-sm text-slate-200 font-mono">{{ areaShareLabel }}</p>
        </div>
        <div class="panel-stat-card">
          <p class="text-xs text-slate-500 uppercase tracking-wide mb-2">Договор</p>
          <p class="text-sm font-mono text-slate-200">до {{ portfolio.formatDate(lease.endDate) }}</p>
          <span class="inline-flex mt-2 px-2 py-0.5 rounded text-xs font-medium" :class="statusClass(lease.status)">
            {{ statusLabel(lease.status) }}
          </span>
        </div>
        <div class="panel-stat-card">
          <p class="text-xs text-slate-500 uppercase tracking-wide mb-2">Аренда / мес</p>
          <p class="text-xl font-mono text-emerald-brand">{{ portfolio.formatMoney(lease.rentMonthly) }}</p>
        </div>
        <div class="panel-stat-card">
          <p class="text-xs text-slate-500 uppercase tracking-wide mb-2">Арендатор</p>
          <p class="text-sm text-slate-200 flex items-center gap-1.5 min-w-0">
            <Building2 class="w-4 h-4 text-slate-500 shrink-0" />
            <span class="truncate">{{ lease.tenantName || 'Компания' }}</span>
          </p>
          <p class="text-xs text-slate-500 mt-1 font-mono">ИНН {{ lease.tenantInn || auth.tenantInn }}</p>
        </div>
      </div>

      <div class="panel-card mb-6">
        <div class="px-4 sm:px-5 py-4 border-b border-border flex items-center justify-between gap-3">
          <h2 class="text-sm font-semibold text-white">Счета по помещению</h2>
          <button type="button" class="text-xs text-emerald-brand hover:underline shrink-0" @click="router.push('/tenant/bills')">
            Все счета
          </button>
        </div>
        <div v-if="recentBills.length" class="divide-y divide-border">
          <div v-for="bill in recentBills" :key="bill.id" class="px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm text-slate-200 truncate">{{ INVOICE_TYPE_LABELS[bill.kind] }}</p>
              <p class="text-xs text-slate-500">{{ billing.formatPeriod(bill.period) }}</p>
            </div>
            <div class="text-right shrink-0">
              <p class="font-mono text-sm text-slate-200">{{ billing.formatMoney(bill.amount) }}</p>
              <span class="inline-flex mt-1 px-2 py-0.5 rounded text-xs font-medium" :class="billStatusClass(bill.status)">
                {{ INVOICE_STATUS_LABELS[bill.status] }}
              </span>
            </div>
          </div>
        </div>
        <p v-else class="px-5 py-8 text-center text-sm text-slate-500">Счетов пока нет</p>
      </div>
    </div>

    <div v-else class="panel-empty max-w-md mx-auto">
      <p class="text-slate-300 mb-4">{{ tenantPanel.loading ? 'Загрузка...' : 'Помещение не найдено или недоступно' }}</p>
      <button type="button" class="panel-btn-secondary text-sm" @click="router.push('/tenant/spaces')">
        Вернуться к списку
      </button>
    </div>
  </TenantLayout>
</template>
