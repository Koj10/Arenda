<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TenantLayout from '@/components/layout/TenantLayout.vue'
import FileAttachments from '@/components/ui/FileAttachments.vue'
import { ArrowLeft, Building2, MapPin } from '@lucide/vue'
import { useAuthStore } from '@/stores/authStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { useBillingStore } from '@/stores/billingStore'
import { PROPERTY_TYPE_LABELS } from '@/types/portfolio'
import { INVOICE_TYPE_LABELS, INVOICE_STATUS_LABELS } from '@/types/billing'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const portfolio = usePortfolioStore()
const billing = useBillingStore()

const leaseId = computed(() => Number(route.params.leaseId))

const lease = computed(() => {
  const inn = auth.tenantInn
  if (!inn) return null
  return portfolio.getLeasesByInn(inn).find((l) => l.tenant.id === leaseId.value) ?? null
})

const spaceDocuments = computed(() =>
  lease.value ? portfolio.getDocuments('space', lease.value.space.id) : [],
)

const recentBills = computed(() =>
  lease.value ? billing.getInvoicesByTenantId(lease.value.tenant.id).slice(0, 5) : [],
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
    <div v-if="lease" class="max-w-3xl">
      <button
        type="button"
        class="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-accent-teal mb-5"
        @click="router.push('/tenant/spaces')"
      >
        <ArrowLeft class="w-4 h-4" />
        Все помещения
      </button>

      <div class="mb-6">
        <h1 class="text-2xl font-bold text-white mb-1 font-mono">{{ lease.space.name }}</h1>
        <p class="text-sm text-slate-400 flex items-center gap-1.5">
          <MapPin class="w-4 h-4" />
          {{ lease.property.address }}
        </p>
      </div>

      <div class="grid sm:grid-cols-2 gap-4 mb-6">
        <div class="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <p class="text-xs text-slate-500 uppercase tracking-wide mb-2">Помещение</p>
          <p class="text-sm text-slate-200">{{ portfolio.formatArea(lease.space.area) }}</p>
          <p class="text-xs text-slate-500 mt-1">Ставка {{ portfolio.formatMoney(lease.space.monthlyRate) }}/мес</p>
        </div>
        <div class="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <p class="text-xs text-slate-500 uppercase tracking-wide mb-2">Договор</p>
          <p class="text-sm font-mono text-slate-200">до {{ portfolio.formatDate(lease.tenant.contract) }}</p>
          <span class="inline-flex mt-2 px-2 py-0.5 rounded text-xs font-medium" :class="statusClass(lease.tenant.status)">
            {{ statusLabel(lease.tenant.status) }}
          </span>
        </div>
        <div class="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <p class="text-xs text-slate-500 uppercase tracking-wide mb-2">Аренда / мес</p>
          <p class="text-xl font-mono text-emerald-400">{{ portfolio.formatMoney(lease.tenant.rent) }}</p>
        </div>
        <div class="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <p class="text-xs text-slate-500 uppercase tracking-wide mb-2">Тип объекта</p>
          <p class="text-sm text-slate-200 flex items-center gap-1.5">
            <Building2 class="w-4 h-4 text-slate-500" />
            {{ PROPERTY_TYPE_LABELS[lease.property.type] }}
          </p>
          <p class="text-xs text-slate-500 mt-1 font-mono">ИНН {{ lease.tenant.inn }}</p>
        </div>
      </div>

      <!-- Recent bills -->
      <div class="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden mb-6">
        <div class="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 class="text-sm font-medium text-slate-300">Счета по помещению</h2>
          <button type="button" class="text-xs text-accent-teal hover:underline" @click="router.push('/tenant/bills')">
            Все счета
          </button>
        </div>
        <div v-if="recentBills.length" class="divide-y divide-slate-800/80">
          <div v-for="bill in recentBills" :key="bill.id" class="px-5 py-3.5 flex items-center justify-between gap-4">
            <div>
              <p class="text-sm text-slate-200">{{ bill.title }}</p>
              <p class="text-xs text-slate-500">{{ INVOICE_TYPE_LABELS[bill.type] }} · {{ billing.formatPeriod(bill.period) }}</p>
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

      <!-- Read-only documents -->
      <div class="space-y-5">
        <div class="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <FileAttachments
            entity-type="tenant"
            :entity-id="lease.tenant.id"
            label="Договор и документы"
            compact
            readonly
          />
        </div>
        <div v-if="spaceDocuments.length" class="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <FileAttachments
            entity-type="space"
            :entity-id="lease.space.id"
            label="Документы помещения"
            compact
            readonly
          />
        </div>
      </div>
    </div>

    <div v-else class="max-w-md mx-auto py-16 text-center">
      <p class="text-slate-400 mb-4">Помещение не найдено или недоступно</p>
      <button type="button" class="text-accent-teal hover:underline text-sm" @click="router.push('/tenant/spaces')">
        Вернуться к списку
      </button>
    </div>
  </TenantLayout>
</template>
