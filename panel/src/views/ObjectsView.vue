<script setup lang="ts">

import { ref, computed } from 'vue'

import AppLayout from '@/components/layout/AppLayout.vue'

import AddPropertyModal from '@/components/objects/AddPropertyModal.vue'

import PropertyDetailModal from '@/components/objects/PropertyDetailModal.vue'

import SpaceDetailModal from '@/components/objects/SpaceDetailModal.vue'

import AddTenantModal from '@/components/tenants/AddTenantModal.vue'

import TenantDetailModal from '@/components/tenants/TenantDetailModal.vue'

import { Plus, MapPin, Search, Lock } from '@lucide/vue'

import { usePortfolioStore } from '@/stores/portfolioStore'

import { PROPERTY_TYPE_LABELS } from '@/types/portfolio'

import { usePlan } from '@/composables/usePlan'



const store = usePortfolioStore()

const { canAddObject, requireCanAddObject, limits, usage } = usePlan()

const search = ref('')



const filtered = computed(() => {

  if (!search.value) return store.properties

  const q = search.value.toLowerCase()

  return store.properties.filter((p) => p.address.toLowerCase().includes(q))

})



function onAddObject() {

  if (!requireCanAddObject()) return

  store.openPropertyModal()

}



function occupancyClass(rate: number) {

  if (rate === 100) return 'text-emerald-brand bg-emerald-brand/10'
  if (rate > 0) return 'text-yellow-400 bg-yellow-500/10'

  return 'text-rose-600 bg-rose-500/10'

}

</script>



<template>

  <AppLayout>

    <div class="panel-page-wide">
      <div class="panel-toolbar">
        <div class="panel-toolbar-search">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input v-model="search" type="search" placeholder="Поиск по адресу..." class="panel-search" />
        </div>
        <div class="panel-toolbar-actions">
          <button
            type="button"
            class="panel-btn-primary"
            :class="{ 'opacity-80': !canAddObject() }"
            @click="onAddObject"
          >
            <Lock v-if="!canAddObject()" class="w-4 h-4" />
            <Plus v-else class="w-4 h-4" />
            <span>Добавить объект</span>
            <span v-if="limits.maxObjects != null" class="text-xs opacity-70 tabular-nums">
              {{ usage?.objects ?? 0 }}/{{ limits.maxObjects }}
            </span>
          </button>
        </div>
      </div>

      <div class="panel-card">
        <div class="panel-table-wrap">
        <table class="w-full text-sm">

          <thead>

            <tr class="panel-table-head">

              <th class="px-5 py-3 font-medium">Адрес</th>

              <th class="px-5 py-3 font-medium hidden sm:table-cell">Тип</th>

              <th class="px-5 py-3 font-medium">Помещения</th>

              <th class="px-5 py-3 font-medium">Занятость</th>

              <th class="px-5 py-3 font-medium hidden md:table-cell">Доход/мес</th>

              <th class="px-5 py-3 font-medium hidden lg:table-cell">Расход/мес</th>

            </tr>

          </thead>

          <tbody>

            <tr v-for="p in filtered" :key="p.id" class="panel-table-row group">

              <td class="px-5 py-3.5">

                <button type="button" class="flex items-center gap-2 text-left group/addr" @click="store.openPropertyDetail(p.id)">

                  <MapPin class="w-3.5 h-3.5 text-slate-500 group-hover/addr:text-emerald-brand shrink-0" />

                  <span class="text-white group-hover/addr:text-emerald-brand underline-offset-2 group-hover/addr:underline transition-colors">{{ p.address }}</span>

                </button>

              </td>

              <td class="px-5 py-3.5 text-slate-500 hidden sm:table-cell">{{ PROPERTY_TYPE_LABELS[p.type] }}</td>

              <td class="px-5 py-3.5 font-mono text-slate-500">{{ p.spacesOccupied }} / {{ p.spacesTotal }}</td>

              <td class="px-5 py-3.5">

                <span class="inline-flex px-2 py-0.5 rounded font-mono text-xs font-medium" :class="occupancyClass(p.occupancy)">

                  {{ p.occupancy }}%

                </span>

              </td>

              <td class="px-5 py-3.5 font-mono text-emerald-brand hidden md:table-cell">{{ store.formatMoney(p.income) }}</td>

              <td class="px-5 py-3.5 font-mono text-rose-600/90 hidden lg:table-cell">{{ store.formatMoney(p.expense) }}</td>

            </tr>

          </tbody>

        </table>

        </div>

        <div v-if="filtered.length === 0" class="py-12 text-center text-slate-500 text-sm">

          Объекты не найдены

        </div>

      </div>

    </div>



    <AddPropertyModal />

    <PropertyDetailModal />

    <SpaceDetailModal />

    <AddTenantModal />

    <TenantDetailModal />

  </AppLayout>

</template>


