<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Download, Receipt } from '@lucide/vue'
import { useUtilityBillsStore } from '@/stores/utilityBillsStore'
import {
  UTILITY_CRITERIA,
  UTILITY_CRITERION_LABELS,
  type UtilityCriterion,
} from '@/types/utilityBills'
import { downloadFileBlob, formatApiError } from '@/api/http'

const props = defineProps<{
  propertyId: number
}>()

const utilityBills = useUtilityBillsStore()
const loading = ref(false)
const typeFilter = ref<'all' | UtilityCriterion>('all')
const monthFilter = ref('all')
const downloadError = ref<string | null>(null)
const downloadingId = ref<number | null>(null)

const bills = computed(() => utilityBills.getBillsForProperty(props.propertyId))

const monthOptions = computed(() => {
  const seen = new Set<string>()
  for (const bill of bills.value) seen.add(bill.period)
  return [...seen].sort((a, b) => b.localeCompare(a))
})

const filteredBills = computed(() => {
  return bills.value
    .filter((bill) => monthFilter.value === 'all' || bill.period === monthFilter.value)
    .filter((bill) => {
      if (typeFilter.value === 'all') return true
      return bill.lines.some((line) => line.criterion === typeFilter.value)
        || bill.title.toLowerCase().includes(UTILITY_CRITERION_LABELS[typeFilter.value].toLowerCase())
    })
    .slice()
    .sort((a, b) => b.period.localeCompare(a.period) || b.issuedAt.localeCompare(a.issuedAt))
})

watch(
  () => props.propertyId,
  async (id) => {
    typeFilter.value = 'all'
    monthFilter.value = 'all'
    downloadError.value = null
    loading.value = true
    await utilityBills.loadForProperty(id)
    loading.value = false
  },
  { immediate: true },
)

function typeLabel(bill: (typeof bills.value)[number]) {
  if (!bill.lines.length) return 'Коммунальные'
  return bill.lines.map((line) => UTILITY_CRITERION_LABELS[line.criterion]).join(', ')
}

async function downloadBill(fileId: number) {
  downloadingId.value = fileId
  downloadError.value = null
  try {
    const blob = await downloadFileBlob(fileId)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `schet-${fileId}`
    link.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    downloadError.value = formatApiError(err, 'Не удалось скачать файл')
  } finally {
    downloadingId.value = null
  }
}
</script>

<template>
  <div>
    <p class="text-xs text-slate-500 mb-3">
      Счета поставщиков, которые вы загружали на этот объект. Можно отфильтровать по типу услуги и месяцу.
    </p>

    <div class="flex flex-wrap gap-2 mb-4">
      <select v-model="typeFilter" class="panel-input text-xs py-1.5 w-full sm:w-auto min-w-[180px]">
        <option value="all">Все типы</option>
        <option v-for="criterion in UTILITY_CRITERIA" :key="criterion" :value="criterion">
          {{ UTILITY_CRITERION_LABELS[criterion] }}
        </option>
      </select>
      <select v-model="monthFilter" class="panel-input text-xs py-1.5 w-full sm:w-auto min-w-[180px]">
        <option value="all">Все месяцы</option>
        <option v-for="period in monthOptions" :key="period" :value="period">
          {{ utilityBills.formatPeriod(period) }}
        </option>
      </select>
    </div>

    <p v-if="downloadError" class="text-xs text-rose-400 mb-3">{{ downloadError }}</p>
    <p v-if="loading" class="text-sm text-slate-500 text-center py-8">Загрузка счетов...</p>

    <div v-else-if="filteredBills.length" class="space-y-2">
      <article
        v-for="bill in filteredBills"
        :key="bill.id"
        class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl border border-border bg-panel/40"
      >
        <div class="min-w-0">
          <p class="text-sm text-white font-medium truncate">{{ bill.title }}</p>
          <p class="text-xs text-slate-500 mt-0.5">
            {{ typeLabel(bill) }}
            · {{ utilityBills.formatPeriod(bill.period) }}
            · до {{ utilityBills.formatDate(bill.dueDate) }}
          </p>
        </div>
        <div class="flex items-center gap-3 shrink-0">
          <div class="text-right">
            <p class="font-mono text-emerald-brand">{{ utilityBills.formatMoney(bill.totalAmount) }}</p>
            <p v-if="bill.landlordLoss > 0" class="text-xs text-rose-400 font-mono">
              потери {{ utilityBills.formatMoney(bill.landlordLoss) }}
            </p>
          </div>
          <button
            v-if="bill.fileId"
            type="button"
            class="panel-btn-secondary text-xs py-1.5 px-2"
            :disabled="downloadingId === bill.fileId"
            @click="downloadBill(bill.fileId!)"
          >
            <Download class="w-3.5 h-3.5" />
          </button>
        </div>
      </article>
    </div>

    <div v-else class="text-center py-10 rounded-xl border border-dashed border-border">
      <Receipt class="w-10 h-10 text-slate-600 mx-auto mb-3" />
      <p class="text-sm text-slate-500">
        {{ bills.length ? 'Нет счетов по выбранным фильтрам' : 'На объект ещё не загружали счета' }}
      </p>
      <p class="text-xs text-slate-600 mt-1">Загрузите их во вкладке «Счета» панели арендодателя.</p>
    </div>
  </div>
</template>
