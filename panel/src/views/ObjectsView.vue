<script setup lang="ts">

import { ref, computed } from 'vue'

import AppLayout from '@/components/layout/AppLayout.vue'

import AddPropertyModal from '@/components/objects/AddPropertyModal.vue'

import PropertyDetailModal from '@/components/objects/PropertyDetailModal.vue'

import SpaceDetailModal from '@/components/objects/SpaceDetailModal.vue'

import AddTenantModal from '@/components/tenants/AddTenantModal.vue'

import TenantDetailModal from '@/components/tenants/TenantDetailModal.vue'

import { Plus, MapPin, Search } from '@lucide/vue'

import { usePortfolioStore } from '@/stores/portfolioStore'

import { PROPERTY_TYPE_LABELS } from '@/types/portfolio'



const store = usePortfolioStore()

const search = ref('')



const filtered = computed(() => {

  if (!search.value) return store.properties

  const q = search.value.toLowerCase()

  return store.properties.filter((p) => p.address.toLowerCase().includes(q))

})



function occupancyClass(rate: number) {

  if (rate === 100) return 'text-emerald-brand bg-emerald-brand/10'
  if (rate > 0) return 'text-yellow-400 bg-yellow-500/10'

  return 'text-rose-600 bg-rose-500/10'

}

</script>



<template>

  <AppLayout>

    <div class="max-w-6xl">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div class="relative flex-1 min-w-[200px] max-w-md">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input v-model="search" type="text" placeholder="Поиск по адресу..." class="panel-input pl-10" />
        </div>
        <button type="button" class="panel-btn-primary shrink-0" @click="store.openPropertyModal()">
          <Plus class="w-4 h-4" />
          Добавить объект
        </button>
      </div>



      <div class="panel-card">

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


