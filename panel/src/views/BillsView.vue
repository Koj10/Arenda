<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/components/layout/AppLayout.vue'
import AddPropertyBillModal from '@/components/bills/AddPropertyBillModal.vue'
import { Building2, FileUp, Search, Settings2 } from '@lucide/vue'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { useUtilityBillsStore } from '@/stores/utilityBillsStore'
import {
  UTILITY_CRITERIA,
  UTILITY_CRITERION_LABELS,
  BILL_PAYER_LABELS,
} from '@/types/utilityBills'
import type { BillPayer, UtilityCriterion } from '@/types/utilityBills'
import { PROPERTY_TYPE_LABELS } from '@/types/portfolio'

type BillsTab = 'settings' | 'bills'

const route = useRoute()
const router = useRouter()
const portfolio = usePortfolioStore()
const utilityBills = useUtilityBillsStore()

const search = ref('')
const selectedPropertyId = ref<number | null>(null)
const activeTab = ref<BillsTab>('settings')

const filteredProperties = computed(() => {
  if (!search.value) return portfolio.properties
  const q = search.value.toLowerCase()
  return portfolio.properties.filter((p) => p.address.toLowerCase().includes(q))
})

const selectedProperty = computed(() =>
  selectedPropertyId.value ? portfolio.getPropertyById(selectedPropertyId.value) : null,
)

const spaces = computed(() =>
  selectedProperty.value ? portfolio.getSpacesForProperty(selectedProperty.value.id) : [],
)

const propertyBills = computed(() =>
  selectedProperty.value ? utilityBills.getBillsForProperty(selectedProperty.value.id) : [],
)

watch(
  () => route.query.property,
  (id) => {
    const num = Number(id)
    if (id && !Number.isNaN(num) && portfolio.getPropertyById(num)) {
      selectedPropertyId.value = num
    }
  },
  { immediate: true },
)

watch(selectedPropertyId, (id) => {
  if (id) {
    utilityBills.ensureSettingsForProperty(id)
    void utilityBills.loadForProperty(id)
  }
  const query = id ? { property: String(id) } : {}
  if (String(route.query.property ?? '') !== String(id ?? '')) {
    void router.replace({ query })
  }
})

function selectProperty(id: number) {
  selectedPropertyId.value = id
  utilityBills.ensureSettingsForProperty(id)
  void utilityBills.loadForProperty(id)
}

function onAddBill() {
  if (!selectedProperty.value) return
  utilityBills.openAddBillModal(selectedProperty.value.id)
}

function togglePayer(spaceId: number, criterion: UtilityCriterion) {
  const current = utilityBills.getPayer(spaceId, criterion)
  const next: BillPayer = current === 'landlord' ? 'tenant' : 'landlord'
  void utilityBills.setSpacePayer(spaceId, criterion, next)
}

function payerClass(payer: BillPayer) {
  return payer === 'tenant'
    ? 'bg-emerald-brand/15 text-emerald-brand border-emerald-brand/30'
    : 'bg-panel text-slate-400 border-border'
}

function tenantName(spaceName: string) {
  if (!selectedProperty.value) return null
  return portfolio.getTenantForSpace(selectedProperty.value.id, spaceName)
}
</script>

<template>
  <AppLayout>
    <div class="panel-page-wide space-y-5">
      <div class="panel-card p-5 border-emerald-brand/20 bg-emerald-brand/5">
        <h2 class="text-sm font-semibold text-white mb-2">Как работают счета</h2>
        <ol class="space-y-1.5 text-sm text-slate-400 list-decimal list-inside">
          <li>Для каждого помещения настройте, <span class="text-slate-300">кто платит</span> за каждый из 8 критериев.</li>
          <li>Загрузите <span class="text-slate-300">счёт на весь объект</span> с суммами по критериям.</li>
          <li>Система распределит суммы пропорционально площади помещений и выставит счета арендаторам.</li>
        </ol>
      </div>

      <div class="grid lg:grid-cols-[minmax(240px,300px)_1fr] gap-5">
        <div class="panel-card overflow-hidden">
          <div class="p-3 border-b border-border">
            <div class="relative">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input v-model="search" type="search" placeholder="Поиск адреса..." class="panel-search pl-9" />
            </div>
          </div>
          <ul class="max-h-[520px] overflow-y-auto divide-y divide-border">
            <li v-if="portfolio.loadingRemote" class="px-4 py-8 text-center text-sm text-slate-500">
              Загрузка объектов...
            </li>
            <li v-else-if="filteredProperties.length === 0" class="px-4 py-8 text-center text-sm text-slate-500">
              Нет объектов
            </li>
            <template v-else>
            <li v-for="p in filteredProperties" :key="p.id">
              <button
                type="button"
                class="w-full px-4 py-3 text-left hover:bg-card-hover transition-colors"
                :class="selectedPropertyId === p.id ? 'bg-emerald-brand/10 border-l-2 border-emerald-brand' : ''"
                @click="selectProperty(p.id)"
              >
                <p class="text-sm text-white truncate">{{ p.address }}</p>
                <p class="text-xs text-slate-500 mt-0.5 font-mono">
                  {{ portfolio.getSpacesForProperty(p.id).length }} пом.
                  · {{ utilityBills.getBillsForProperty(p.id).length }} сч.
                </p>
              </button>
            </li>
            </template>
          </ul>
        </div>

        <div v-if="selectedProperty" class="space-y-4">
          <div class="panel-card p-5">
            <div class="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <h2 class="text-lg font-semibold text-white">{{ selectedProperty.address }}</h2>
                <p class="text-xs text-slate-500 mt-1">
                  {{ PROPERTY_TYPE_LABELS[selectedProperty.type] }}
                  · {{ portfolio.formatArea(selectedProperty.totalArea) }}
                  · {{ spaces.length }} помещений
                </p>
              </div>
              <button type="button" class="panel-btn-primary text-xs" @click="onAddBill">
                <FileUp class="w-4 h-4" />
                Загрузить счёт
              </button>
            </div>

            <div class="panel-tabs mb-4">
              <button
                type="button"
                :class="['panel-tab', activeTab === 'settings' && 'panel-tab-active']"
                @click="activeTab = 'settings'"
              >
                <Settings2 class="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                Кто платит
              </button>
              <button
                type="button"
                :class="['panel-tab', activeTab === 'bills' && 'panel-tab-active']"
                @click="activeTab = 'bills'"
              >
                <FileUp class="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                Счета
                <span class="text-slate-600 font-normal ml-1">({{ propertyBills.length }})</span>
              </button>
            </div>

            <!-- Настройка оплаты -->
            <div v-if="activeTab === 'settings'">
              <p v-if="spaces.length === 0" class="text-sm text-slate-500 text-center py-8">
                Сначала добавьте помещения в разделе «Объекты»
              </p>
              <div v-else class="overflow-x-auto -mx-1 px-1">
                <table class="w-full text-xs min-w-[720px]">
                  <thead>
                    <tr class="border-b border-border">
                      <th class="text-left py-2 pr-3 font-medium text-slate-500 sticky left-0 bg-card z-10 min-w-[120px]">Помещение</th>
                      <th
                        v-for="criterion in UTILITY_CRITERIA"
                        :key="criterion"
                        class="text-center py-2 px-1 font-medium text-slate-500 whitespace-nowrap"
                        :title="UTILITY_CRITERION_LABELS[criterion]"
                      >
                        {{ UTILITY_CRITERION_LABELS[criterion] }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="space in spaces"
                      :key="space.id"
                      class="border-b border-border/50 hover:bg-panel/30"
                    >
                      <td class="py-2.5 pr-3 sticky left-0 bg-card z-10">
                        <p class="font-mono text-white">№{{ space.name }}</p>
                        <p class="text-slate-500">{{ space.area }} м²</p>
                        <p v-if="tenantName(space.name)" class="text-slate-600 truncate max-w-[110px]">
                          {{ tenantName(space.name)?.company }}
                        </p>
                        <p v-else class="text-amber-400/70">свободно</p>
                      </td>
                      <td v-for="criterion in UTILITY_CRITERIA" :key="criterion" class="py-2.5 px-1 text-center">
                        <button
                          type="button"
                          class="inline-flex px-2 py-1 rounded-lg border text-[10px] font-medium transition-colors whitespace-nowrap"
                          :class="payerClass(utilityBills.getPayer(space.id, criterion))"
                          :title="`Нажмите, чтобы сменить: ${BILL_PAYER_LABELS[utilityBills.getPayer(space.id, criterion)]}`"
                          @click="togglePayer(space.id, criterion)"
                        >
                          {{ BILL_PAYER_LABELS[utilityBills.getPayer(space.id, criterion)] }}
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p class="text-xs text-slate-500 mt-3">
                Нажмите на ячейку, чтобы переключить между «Я» и «Арендатор»
              </p>
            </div>

            <!-- Список счетов -->
            <div v-else>
              <div v-if="propertyBills.length" class="space-y-2">
                <div
                  v-for="bill in propertyBills"
                  :key="bill.id"
                  class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl border border-border bg-panel/40"
                >
                  <div>
                    <p class="text-sm text-white font-medium">{{ bill.title }}</p>
                    <p class="text-xs text-slate-500 mt-0.5">
                      {{ utilityBills.formatPeriod(bill.period) }}
                      · до {{ utilityBills.formatDate(bill.dueDate) }}
                    </p>
                  </div>
                  <div class="text-right">
                    <p class="font-mono text-emerald-brand">{{ utilityBills.formatMoney(bill.totalAmount) }}</p>
                    <p class="text-xs text-slate-500">{{ bill.lines.length }} критериев</p>
                  </div>
                </div>
              </div>
              <div v-else class="text-center py-10">
                <FileUp class="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p class="text-sm text-slate-500 mb-4">Счетов по этому объекту пока нет</p>
                <button type="button" class="panel-btn-secondary text-xs" @click="onAddBill">
                  Загрузить первый счёт
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="panel-card flex flex-col items-center justify-center py-20 text-slate-500">
          <Building2 class="w-10 h-10 mb-3 opacity-40" />
          <p class="text-sm">Выберите объект слева</p>
        </div>
      </div>
    </div>

    <AddPropertyBillModal />
  </AppLayout>
</template>
