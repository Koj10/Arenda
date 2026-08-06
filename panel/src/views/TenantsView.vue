<script setup lang="ts">
import { ref, computed } from 'vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import AddTenantModal from '@/components/tenants/AddTenantModal.vue'
import TenantDetailModal from '@/components/tenants/TenantDetailModal.vue'
import { Plus, Search, User, Lock } from '@lucide/vue'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { usePlan } from '@/composables/usePlan'

const store = usePortfolioStore()
const { canAddTenant, requireCanAddTenant } = usePlan()
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
    <div class="panel-page-wide">
      <div class="panel-toolbar">
        <div class="panel-toolbar-search">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            v-model="search"
            type="search"
            placeholder="Поиск по названию или ИНН..."
            class="panel-search"
          />
        </div>
        <div class="panel-toolbar-actions">
          <button
            type="button"
            class="panel-btn-primary"
            @click="requireCanAddTenant() && store.openTenantModal()"
          >
            <Lock v-if="!canAddTenant()" class="w-4 h-4" />
            <Plus v-else class="w-4 h-4" />
            Добавить арендатора
          </button>
        </div>
      </div>

      <div class="panel-card">
        <div class="panel-table-wrap">
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
                class="panel-table-row cursor-pointer"
                @click="store.openTenantDetail(t.id)"
              >
                <td class="px-5 py-3.5">
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="w-8 h-8 rounded-lg bg-emerald-brand/10 text-emerald-brand flex items-center justify-center shrink-0">
                      <User class="w-4 h-4" />
                    </span>
                    <span class="text-white truncate">{{ t.company }}</span>
                  </div>
                </td>
                <td class="px-5 py-3.5 font-mono text-slate-500 hidden sm:table-cell">{{ t.inn }}</td>
                <td class="px-5 py-3.5 text-slate-400 hidden md:table-cell">{{ getSpaceLabel(t) }}</td>
                <td class="px-5 py-3.5 font-mono text-emerald-brand">{{ store.formatMoney(t.rent) }}</td>
                <td class="px-5 py-3.5 text-slate-500 hidden lg:table-cell">{{ store.formatDate(t.contract) }}</td>
                <td class="px-5 py-3.5">
                  <span class="inline-flex px-2 py-0.5 rounded text-xs font-medium" :class="statusClass(t.status)">
                    {{ statusLabel(t.status) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="filtered.length === 0" class="py-12 text-center text-slate-500 text-sm">
          Арендаторы не найдены
        </div>
      </div>
    </div>

    <AddTenantModal />
    <TenantDetailModal />
  </AppLayout>
</template>
