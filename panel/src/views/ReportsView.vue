<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import {
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  MapPin,
  Settings2,
} from '@lucide/vue'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { useExport } from '@/composables/useExport'
import { usePlan } from '@/composables/usePlan'
import type { ExportColumn, ReportColumn, SpaceReportColumn, ReportRow, SpaceReportRow } from '@/types/portfolio'
import { exportLandlordReports, getLandlordReports } from '@/api/landlord'
import { saveBlobFile } from '@/api/http'
import { num, type ApiReportRow } from '@/api/types'
import { currentPeriod } from '@/utils/dates'

type ReportScope =
  | { kind: 'portfolio' }
  | { kind: 'property'; propertyId: number }
  | { kind: 'space'; propertyId: number; spaceId: number }

const store = usePortfolioStore()
const { exportReport } = useExport()
const { requireFeature } = usePlan()

const scope = ref<ReportScope>({ kind: 'portfolio' })
const expandedPropertyIds = ref<Set<number>>(new Set())

const portfolioColumns = ref<ReportColumn[]>([
  { key: 'address', label: 'Адрес', selected: true },
  { key: 'tenant', label: 'Арендатор', selected: true },
  { key: 'income', label: 'Доход', selected: true },
  { key: 'expense', label: 'Расход', selected: true },
  { key: 'type', label: 'Тип', selected: true },
  { key: 'occupancy', label: 'Занятость', selected: true },
])

const detailColumns = ref<SpaceReportColumn[]>([
  { key: 'space', label: 'Помещение', selected: true },
  { key: 'tenant', label: 'Арендатор', selected: true },
  { key: 'income', label: 'Доход', selected: true },
  { key: 'monthlyRate', label: 'Ставка', selected: true },
  { key: 'area', label: 'Площадь', selected: true },
  { key: 'expense', label: 'Расход', selected: true },
  { key: 'occupancy', label: 'Занятость', selected: true },
])

const exporting = ref(false)
const apiRows = ref<ApiReportRow[] | null>(null)
const period = ref(currentPeriod())

const isPortfolioScope = computed(() => scope.value.kind === 'portfolio')

const activeColumns = computed<ExportColumn[]>(() =>
  isPortfolioScope.value ? portfolioColumns.value : detailColumns.value,
)

const selectedColumns = computed(() => activeColumns.value.filter((c) => c.selected))

function getRowValue(row: ReportRow | SpaceReportRow, key: string): string | number {
  return (row as unknown as Record<string, string | number>)[key] ?? ''
}

function mapApiRow(row: ApiReportRow): ReportRow & SpaceReportRow {
  const income = num(row.rent_income) + num(row.utility_income) + num(row.transaction_income)
  return {
    address: row.object_address || row.name,
    tenant: row.entity_type === 'tenant' ? row.name : '—',
    income,
    expense: num(row.expenses),
    type: row.entity_type,
    occupancy: Math.round(row.occupancy_percent ?? 0),
    space: row.name,
    monthlyRate: 0,
    area: num(row.total_area),
  }
}

const displayRows = computed(() => {
  if (apiRows.value) return apiRows.value.map(mapApiRow)
  if (scope.value.kind === 'portfolio') {
    return store.reportRows
  }
  if (scope.value.kind === 'property') {
    return store.getSpaceReportRows({ propertyId: scope.value.propertyId })
  }
  return store.getSpaceReportRows({ spaceId: scope.value.spaceId })
})

watch(
  [scope, period],
  async () => {
    try {
      const data = await getLandlordReports({
        period: period.value,
        object_id: scope.value.kind === 'portfolio' ? undefined : scope.value.propertyId,
        unit_id: scope.value.kind === 'space' ? scope.value.spaceId : undefined,
      })
      apiRows.value = data.rows ?? []
    } catch {
      apiRows.value = null
    }
  },
  { immediate: true },
)

const scopeTitle = computed(() => {
  if (scope.value.kind === 'portfolio') return 'Все объекты'
  const property = store.getPropertyById(
    scope.value.kind === 'property' ? scope.value.propertyId : scope.value.propertyId,
  )
  if (scope.value.kind === 'property') return property?.address ?? 'Объект'
  const space = store.getSpaceById(scope.value.spaceId)
  return space ? `${property?.address ?? 'Объект'} · ${space.name}` : 'Помещение'
})

const scopeSubtitle = computed(() => {
  if (scope.value.kind === 'portfolio') return 'Сводный отчёт по всем адресам'
  if (scope.value.kind === 'property') return 'Отчёт по помещениям объекта'
  return 'Отчёт по помещению'
})

const totalIncome = computed(() => displayRows.value.reduce((s, row) => s + (Number(getRowValue(row, 'income')) || 0), 0))
const totalExpense = computed(() => displayRows.value.reduce((s, row) => s + (Number(getRowValue(row, 'expense')) || 0), 0))

function isPropertyExpanded(propertyId: number) {
  return expandedPropertyIds.value.has(propertyId)
}

function togglePropertyExpand(propertyId: number) {
  const next = new Set(expandedPropertyIds.value)
  if (next.has(propertyId)) next.delete(propertyId)
  else next.add(propertyId)
  expandedPropertyIds.value = next
}

function selectPortfolio() {
  scope.value = { kind: 'portfolio' }
}

function selectProperty(propertyId: number) {
  scope.value = { kind: 'property', propertyId }
  expandedPropertyIds.value = new Set([...expandedPropertyIds.value, propertyId])
}

function selectSpace(propertyId: number, spaceId: number) {
  scope.value = { kind: 'space', propertyId, spaceId }
  expandedPropertyIds.value = new Set([...expandedPropertyIds.value, propertyId])
}

function isSpaceActive(spaceId: number) {
  return scope.value.kind === 'space' && scope.value.spaceId === spaceId
}

function formatCell(key: string, value: string | number) {
  if (key === 'income' || key === 'expense' || key === 'monthlyRate') {
    return store.formatMoney(value as number)
  }
  if (key === 'occupancy') return `${value}%`
  if (key === 'area') return store.formatArea(value as number)
  return String(value)
}

function sumColumn(key: string) {
  return displayRows.value.reduce((s, row) => s + (Number(getRowValue(row, key)) || 0), 0)
}

async function handleExport() {
  if (!requireFeature('exportReports', 'Экспорт отчётов доступен на тарифе Profi и выше')) return
  if (selectedColumns.value.length === 0 || displayRows.value.length === 0) return
  exporting.value = true
  try {
    const downloaded = await exportLandlordReports({
      period: period.value,
      object_id: scope.value.kind === 'portfolio' ? undefined : scope.value.propertyId,
      unit_id: scope.value.kind === 'space' ? scope.value.spaceId : undefined,
      fields: selectedColumns.value.map((col) => col.key).join(','),
    })
    saveBlobFile(downloaded.blob, downloaded.filename || `propcount-report-${period.value}.xlsx`)
  } catch {
    const suffix = scope.value.kind === 'portfolio'
      ? 'portfolio'
      : scope.value.kind === 'property'
        ? `property-${scope.value.propertyId}`
        : `space-${scope.value.spaceId}`
    const exportRows = displayRows.value.map((row) => {
      const obj: Record<string, string | number> = {}
      activeColumns.value.forEach((col) => {
        obj[col.key] = getRowValue(row, col.key)
      })
      return obj
    })
    exportReport(exportRows, activeColumns.value, `propcount-report-${suffix}-${Date.now()}`)
  } finally {
    exporting.value = false
  }
}

function toggleAll(selected: boolean) {
  activeColumns.value.forEach((c) => { c.selected = selected })
}

function firstTotalColumnKey() {
  return isPortfolioScope.value ? 'address' : 'space'
}

function navBtnClass(active: boolean) {
  return active
    ? 'bg-emerald-brand/10 text-emerald-brand font-medium border border-emerald-brand/20'
    : 'text-slate-400 hover:bg-card-hover hover:text-slate-200'
}
</script>

<template>
  <AppLayout>
    <template #header-action>
      <button
        type="button"
        class="panel-btn-primary"
        :disabled="selectedColumns.length === 0 || displayRows.length === 0 || exporting"
        @click="handleExport"
      >
        <Download class="w-4 h-4" />
        <span class="sm:hidden">{{ exporting ? '...' : 'Excel' }}</span>
        <span class="hidden sm:inline">{{ exporting ? 'Экспорт...' : 'Экспорт Excel' }}</span>
      </button>
    </template>

    <div class="panel-page-wide">
      <div class="flex items-center justify-end mb-4">
        <input v-model="period" type="month" class="panel-input font-mono text-xs py-1.5 w-40" />
      </div>
      <div class="grid sm:grid-cols-3 gap-4 mb-6">
        <div class="panel-stat-card">
          <p class="text-xs text-slate-500 uppercase tracking-wide mb-1">Строк в отчёте</p>
          <p class="text-2xl font-bold font-mono text-white">{{ displayRows.length }}</p>
        </div>
        <div class="panel-stat-card">
          <p class="text-xs text-slate-500 uppercase tracking-wide mb-1">Доход</p>
          <p class="text-2xl font-bold font-mono text-emerald-brand">{{ store.formatMoney(totalIncome) }}</p>
        </div>
        <div class="panel-stat-card">
          <p class="text-xs text-slate-500 uppercase tracking-wide mb-1">Расход</p>
          <p class="text-2xl font-bold font-mono text-red-400">{{ store.formatMoney(totalExpense) }}</p>
        </div>
      </div>

      <div class="grid xl:grid-cols-12 gap-6">
        <div class="xl:col-span-3 panel-card p-4">
          <div class="flex items-center gap-2 text-sm font-medium text-white mb-4">
            <MapPin class="w-4 h-4 text-emerald-brand" />
            Отчёты по объектам
          </div>

          <button
            type="button"
            class="w-full text-left px-3 py-2.5 rounded-xl text-sm mb-2 transition-colors border border-transparent"
            :class="navBtnClass(scope.kind === 'portfolio')"
            @click="selectPortfolio"
          >
            Все объекты
          </button>

          <div class="space-y-1 max-h-[420px] overflow-y-auto pr-1">
            <p v-if="store.loadingRemote" class="px-2 py-6 text-center text-sm text-slate-500">Загрузка объектов...</p>
            <div v-for="property in store.properties" :key="property.id">
              <div class="flex items-center gap-0.5">
                <button
                  type="button"
                  class="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-card-hover shrink-0"
                  @click="togglePropertyExpand(property.id)"
                >
                  <ChevronDown v-if="isPropertyExpanded(property.id)" class="w-3.5 h-3.5" />
                  <ChevronRight v-else class="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  class="flex-1 text-left px-2 py-2 rounded-xl text-sm transition-colors truncate border border-transparent"
                  :class="navBtnClass(scope.kind === 'property' && scope.propertyId === property.id)"
                  :title="property.address"
                  @click="selectProperty(property.id)"
                >
                  {{ property.address }}
                </button>
              </div>

              <div v-if="isPropertyExpanded(property.id)" class="ml-6 mt-0.5 space-y-0.5 border-l border-border pl-2">
                <button
                  v-for="space in store.getSpacesForProperty(property.id)"
                  :key="space.id"
                  type="button"
                  class="w-full text-left px-3 py-2 rounded-lg text-xs font-mono transition-colors"
                  :class="isSpaceActive(space.id) ? 'bg-emerald-brand/10 text-emerald-brand font-medium' : 'text-slate-500 hover:bg-card-hover hover:text-slate-300'"
                  @click="selectSpace(property.id, space.id)"
                >
                  {{ space.name }}
                  <span class="text-slate-600 font-sans ml-1">{{ store.formatArea(space.area) }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="xl:col-span-9 grid xl:grid-cols-4 gap-6">
          <div class="xl:col-span-1 panel-card p-5">
            <div class="flex items-center gap-2 text-sm font-medium text-white mb-1">
              <Settings2 class="w-4 h-4 text-emerald-brand" />
              Поля отчёта
            </div>
            <p class="text-xs text-slate-500 mb-4">{{ scopeSubtitle }}</p>

            <div class="space-y-2 mb-4">
              <label
                v-for="col in activeColumns"
                :key="col.key"
                class="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors"
                :class="col.selected ? 'bg-emerald-brand/10 text-emerald-brand' : 'text-slate-400 hover:bg-card-hover'"
              >
                <input v-model="col.selected" type="checkbox" class="rounded border-border bg-panel text-emerald-brand focus:ring-emerald-brand/30" />
                <span class="text-sm">{{ col.label }}</span>
              </label>
            </div>
            <div class="flex gap-2 text-xs">
              <button type="button" class="text-emerald-brand hover:underline" @click="toggleAll(true)">Все</button>
              <span class="text-slate-600">·</span>
              <button type="button" class="text-slate-400 hover:underline" @click="toggleAll(false)">Сбросить</button>
            </div>
            <button
              type="button"
              class="w-full mt-5 panel-btn-primary justify-center disabled:opacity-50"
              :disabled="selectedColumns.length === 0 || displayRows.length === 0 || exporting"
              @click="handleExport"
            >
              <Download class="w-4 h-4" />
              {{ exporting ? 'Экспорт...' : 'Экспорт Excel' }}
            </button>
          </div>

          <div class="xl:col-span-3 panel-card overflow-hidden">
            <div class="px-5 py-4 border-b border-border">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div class="flex items-center gap-2 text-sm font-medium text-white">
                    <FileSpreadsheet class="w-4 h-4 text-emerald-brand" />
                    {{ scopeTitle }}
                  </div>
                  <p class="text-xs text-slate-500 mt-0.5">{{ scopeSubtitle }}</p>
                </div>
                <span class="text-xs text-slate-500 font-mono">
                  {{ displayRows.length }} строк · {{ selectedColumns.length }} колонок
                </span>
              </div>
              <div v-if="scope.kind !== 'portfolio'" class="flex flex-wrap items-center gap-1.5 mt-3 text-xs">
                <button type="button" class="text-slate-500 hover:text-emerald-brand" @click="selectPortfolio">Все объекты</button>
                <span class="text-slate-700">/</span>
                <button
                  type="button"
                  class="hover:text-emerald-brand truncate max-w-[200px]"
                  :class="scope.kind === 'property' ? 'text-emerald-brand' : 'text-slate-400'"
                  @click="selectProperty(scope.propertyId)"
                >
                  {{ store.getPropertyById(scope.propertyId)?.address }}
                </button>
                <template v-if="scope.kind === 'space'">
                  <span class="text-slate-700">/</span>
                  <span class="text-emerald-brand font-mono">{{ store.getSpaceById(scope.spaceId)?.name }}</span>
                </template>
              </div>
            </div>

            <div class="overflow-auto max-h-[520px]">
              <table v-if="selectedColumns.length > 0 && displayRows.length > 0" class="w-full text-sm">
                <thead class="sticky top-0 bg-card z-10">
                  <tr class="panel-table-head">
                    <th v-for="col in selectedColumns" :key="col.key" class="px-4 py-3 font-medium whitespace-nowrap">
                      {{ col.label }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(row, idx) in displayRows"
                    :key="idx"
                    class="panel-table-row"
                  >
                    <td
                      v-for="col in selectedColumns"
                      :key="col.key"
                      class="px-4 py-3 text-slate-300"
                      :class="{
                        'font-mono': ['income', 'expense', 'occupancy', 'monthlyRate', 'area', 'space'].includes(col.key),
                        'max-w-[200px] truncate': ['address', 'tenant', 'space'].includes(col.key),
                      }"
                    >
                      {{ formatCell(col.key, getRowValue(row, col.key)) }}
                    </td>
                  </tr>
                </tbody>
                <tfoot v-if="displayRows.length > 1" class="border-t border-border bg-panel/80">
                  <tr>
                    <td
                      v-for="col in selectedColumns"
                      :key="'total-' + col.key"
                      class="px-4 py-3 text-xs font-semibold text-slate-400"
                    >
                      <template v-if="col.key === 'income' || col.key === 'expense' || col.key === 'monthlyRate'">
                        {{ store.formatMoney(sumColumn(col.key)) }}
                      </template>
                      <template v-else-if="col.key === 'area'">
                        {{ store.formatArea(sumColumn(col.key)) }}
                      </template>
                      <template v-else-if="col.key === firstTotalColumnKey()">Итого</template>
                    </td>
                  </tr>
                </tfoot>
              </table>
              <div v-else-if="selectedColumns.length === 0" class="py-16 text-center text-slate-500 text-sm">
                Выберите хотя бы одно поле для предпросмотра
              </div>
              <div v-else class="py-16 text-center text-slate-500 text-sm">
                Нет данных для отображения
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
