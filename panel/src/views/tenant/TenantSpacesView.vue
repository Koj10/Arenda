<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import TenantLayout from '@/components/layout/TenantLayout.vue'
import { Building2, ChevronRight, MapPin } from '@lucide/vue'
import { useAuthStore } from '@/stores/authStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { PROPERTY_TYPE_LABELS } from '@/types/portfolio'

const auth = useAuthStore()
const portfolio = usePortfolioStore()
const router = useRouter()

const leases = computed(() => {
  const inn = auth.tenantInn
  if (!inn) return []
  return portfolio.getLeasesByInn(inn)
})

function openLease(leaseId: number) {
  router.push(`/tenant/spaces/${leaseId}`)
}

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
</script>

<template>
  <TenantLayout>
    <div class="max-w-4xl">
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-white mb-1" style="font-family: Poppins, Inter, sans-serif">Мои помещения</h1>
        <p class="text-sm text-slate-400">
          Данные загружены арендодателем
          <span v-if="auth.tenantInn" class="font-mono text-slate-500">· ИНН {{ auth.tenantInn }}</span>
        </p>
      </div>

      <div v-if="leases.length > 0" class="space-y-3">
        <button
          v-for="lease in leases"
          :key="lease.tenant.id"
          type="button"
          class="w-full text-left rounded-2xl border border-slate-800 bg-slate-900/40 p-5 hover:border-teal-500/30 hover:bg-slate-800/40 transition-all group"
          @click="openLease(lease.tenant.id)"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 mb-2">
                <MapPin class="w-4 h-4 text-slate-500 group-hover:text-accent-teal shrink-0" />
                <span class="text-sm text-slate-200 truncate">{{ lease.property.address }}</span>
              </div>
              <div class="flex flex-wrap items-center gap-3">
                <span class="text-lg font-mono font-semibold text-white">{{ lease.space.name }}</span>
                <span class="text-xs text-slate-500">{{ portfolio.formatArea(lease.space.area) }}</span>
                <span class="inline-flex px-2 py-0.5 rounded text-xs font-medium" :class="statusClass(lease.tenant.status)">
                  {{ statusLabel(lease.tenant.status) }}
                </span>
              </div>
              <p class="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                <Building2 class="w-3.5 h-3.5" />
                {{ PROPERTY_TYPE_LABELS[lease.property.type] }}
                · аренда {{ portfolio.formatMoney(lease.tenant.rent) }}/мес
              </p>
            </div>
            <ChevronRight class="w-5 h-5 text-slate-600 group-hover:text-accent-teal shrink-0 mt-1" />
          </div>
        </button>
      </div>

      <div v-else class="rounded-2xl border border-dashed border-slate-700 bg-slate-900/30 py-16 text-center px-6">
        <p class="text-slate-400 mb-2">Помещения не найдены</p>
        <p class="text-sm text-slate-500">
          Арендодатель должен добавить вашу компанию по ИНН в своей панели. После этого помещения появятся здесь автоматически.
        </p>
      </div>
    </div>
  </TenantLayout>
</template>
