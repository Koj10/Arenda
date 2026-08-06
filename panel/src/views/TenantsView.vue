<script setup lang="ts">
import { ref, computed } from 'vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import AddTenantModal from '@/components/tenants/AddTenantModal.vue'
import TenantDetailModal from '@/components/tenants/TenantDetailModal.vue'
import { Plus, Search, User } from '@lucide/vue'
import { usePortfolioStore } from '@/stores/portfolioStore'

const store = usePortfolioStore()
const search = ref('')

const filtered = computed(() => {
  if (!search.value) return store.tenants
  const q = search.value.toLowerCase()
  return store.tenants.filter(
    (t) => t.company.toLowerCase().includes(q) || t.inn.includes(q),
  )
})

function statusLabel(s: string) {
  const map: Record<string, string> = { active: 'Активен', expiring: 'Истекает', overdue: 'Просрочен' }
  return map[s] ?? s
}

function statusClass(s: string) {
  const map: Record<string, string> = {
    active: 'text-emerald-400 bg-emerald-500/10',
    expiring: 'text-accent-amber bg-accent-amber/10',
    overdue: 'text-rose-400 bg-rose-500/10',
  }
  return map[s] ?? ''
}

function getSpaceLabel(tenant: (typeof store.tenants)[0]) {
  const prop = store.getPropertyById(tenant.propertyId)
  const addr = prop?.address.split(',')[1]?.trim() ?? prop?.address ?? ''
  return `${addr ? addr + ', ' : ''}${tenant.space}`
}
</script>

<template>
  <AppLayout>
    <div class="max-w-6xl">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div class="relative flex-1 min-w-[200px] max-w-md">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            v-model="search"
            type="text"
            placeholder="Поиск по названию или ИНН..."
            class="panel-search"
          />
        </div>
        <button type="button" class="panel-btn-primary shrink-0" @click="store.openTenantModal()">
          <Plus class="w-4 h-4" />
          Добавить арендатора
        </button>
      </div>

      <div class="panel-card">
        <table class="w-full text-sm">
          <thead>
            <tr class="panel-table-head">
              <th class="px-5 py-3 font-medium">Компания</th>
              <th class="px-5 py-3 font-medium hidden sm:table-cell">ИНН</th>
              <th class="px-5 py-3 font-medium hidden md:table-cell">Помещение</th>
              <th class="px-5 py-3 font-medium">Аренда/мес</th>
              <th class="px-5 py-3 font-medium hidden lg:table-cell">Договор до</th>
              <th class="px-5 py-3 font-medium">Статус</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="t in filtered"
              :key="t.id"
              class="border-b border-slate-800/80 hover:bg-slate-800/30 transition-colors"
            >
              <td class="px-5 py-3.5">
                <button
                  type="button"
                  class="flex items-center gap-2 text-left group/tenant"
                  @click="store.openTenantDetail(t.id)"
                >
                  <div class="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 group-hover/tenant:bg-slate-700 transition-colors">
                    <User class="w-4 h-4 text-slate-500 group-hover/tenant:text-accent-amber" />
                  </div>
                  <span class="text-slate-200 font-medium group-hover/tenant:text-accent-amber underline-offset-2 group-hover/tenant:underline transition-colors">{{ t.company }}</span>
                </button>
              </td>
              <td class="px-5 py-3.5 font-mono text-xs text-slate-400 hidden sm:table-cell">{{ t.inn }}</td>
              <td class="px-5 py-3.5 text-slate-400 text-xs hidden md:table-cell">{{ getSpaceLabel(t) }}</td>
              <td class="px-5 py-3.5 font-mono text-slate-300">{{ store.formatMoney(t.rent) }}</td>
              <td class="px-5 py-3.5 font-mono text-xs text-slate-400 hidden lg:table-cell">{{ store.formatDate(t.contract) }}</td>
              <td class="px-5 py-3.5">
                <span class="inline-flex px-2 py-0.5 rounded text-xs font-medium" :class="statusClass(t.status)">
                  {{ statusLabel(t.status) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="filtered.length === 0" class="py-12 text-center text-slate-500 text-sm">
          Арендаторы не найдены
        </div>
      </div>
    </div>

    <AddTenantModal />
    <TenantDetailModal />
  </AppLayout>
</template>
