<script setup lang="ts">
import { ref, computed } from 'vue'
import TenantLayout from '@/components/layout/TenantLayout.vue'
import {
  ChevronRight,
  Download,
  FileSpreadsheet,
  Settings2,
  DoorOpen,
  Receipt,
} from '@lucide/vue'
import { useAuthStore } from '@/stores/authStore'
import { useExport } from '@/composables/useExport'
import { useTenantReports, formatTenantCell } from '@/composables/useTenantReports'
import { usePlan } from '@/composables/usePlan'
import type { TenantReportKind, TenantReportScope } from '@/types/tenantReports'
import {
  TENANT_LEASE_COLUMNS,
  TENANT_BILL_COLUMNS,
} from '@/types/tenantReports'

const auth = useAuthStore()
const { exportReport } = useExport()
const { tenantReportsUnlocked, requireTenantReports } = usePlan()

const reportKind = ref<TenantReportKind>('bills')
const scope = ref<TenantReportScope>({ kind: 'all' })

const leaseColumns = ref(TENANT_LEASE_COLUMNS.map((c) => ({ ...c })))
const billColumns = ref(TENANT_BILL_COLUMNS.map((c) => ({ ...c })))

const exporting = ref(false)

const { leases, displayRows, summary, portfolio, billing } = useTenantReports(
  () => scope.value,
  () => reportKind.value,
)

const activeColumns = computed(() =>
  reportKind.value === 'leases' ? leaseColumns.value : billColumns.value,
)

const selectedColumns = computed(() => activeColumns.value.filter((c) => c.selected))

const scopeTitle = computed(() => {
  if (scope.value.kind === 'all') {
    return reportKind.value === 'leases' ? 'Все помещения' : 'Все счета'
  }
  const lease = leases.value.find((l) =>
    scope.value.kind !== 'all' && l.leaseId === scope.value.tenantId,
  )
  if (!lease) return 'Отчёт'
  return `${lease.objectAddress} · ${lease.unitNumber}`
})

function selectAllLeases() {
  scope.value = { kind: 'all' }
}

function selectLease(tenantId: number) {
  scope.value = { kind: 'lease', tenantId }
}

function toggleKind(kind: TenantReportKind) {
  reportKind.value = kind
  scope.value = { kind: 'all' }
}

function toggleAllColumns(selected: boolean) {
  activeColumns.value.forEach((c) => { c.selected = selected })
}

function getRowValue(row: Record<string, string | number>, key: string) {
  return row[key] ?? ''
}

function sumColumn(key: string) {
  if (key !== 'rent' && key !== 'amount') return 0
  return displayRows.value.reduce((s, row) => s + (Number(row[key]) || 0), 0)
}

function handleExport() {
  if (!requireTenantReports()) return
  if (!selectedColumns.value.length || !displayRows.value.length) return
  exporting.value = true
  const exportRows = displayRows.value.map((row) => {
    const obj: Record<string, string | number> = {}
    activeColumns.value.forEach((col) => {
      obj[col.key] = getRowValue(row, col.key)
    })
    return obj
  })
  exportReport(exportRows, activeColumns.value, `tenant-report-${reportKind.value}-${Date.now()}`)
  setTimeout(() => { exporting.value = false }, 600)
}

function navBtnClass(active: boolean) {
  return active
    ? 'bg-emerald-brand/10 text-emerald-brand font-medium border border-emerald-brand/20'
    : 'text-slate-400 hover:bg-card-hover hover:text-slate-200'
}
</script>

<template>
  <TenantLayout>
    <template #header-action>
      <button
        type="button"
        class="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-brand text-black text-sm font-semibold hover:bg-bronze-dark transition-colors disabled:opacity-50"
        :disabled="!selectedColumns.length || !displayRows.length || exporting"
        @click="handleExport"
      >
        <Download class="w-4 h-4" />
        {{ exporting ? 'Экспорт...' : 'Excel' }}
      </button>
    </template>

    <div class="panel-page-wide">
      <p v-if="auth.tenantInn" class="text-xs text-slate-500 mb-4 font-mono">ИНН {{ auth.tenantInn }}</p>

      <div
        v-if="!tenantReportsUnlocked"
        class="mb-6 rounded-xl border border-border bg-card p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between"
      >
        <div>
          <p class="text-sm font-semibold text-white mb-1">Расширенные отчёты</p>
          <p class="text-xs text-slate-400 leading-relaxed">
            История платежей и выгрузки — от 249 ₽/мес. На тарифе Profi владельца отчёты включены.
          </p>
        </div>
        <div class="flex gap-2 shrink-0">
          <button type="button" class="panel-btn-primary text-xs" @click="requireTenantReports()">
            Подключить
          </button>
        </div>
      </div>

      <div class="panel-tabs mb-6">
        <button
          type="button"
          :class="['panel-tab', reportKind === 'bills' && 'panel-tab-active']"
          @click="toggleKind('bills')"
        >
          <Receipt class="w-4 h-4" />
          Счета и платежи
        </button>
        <button
          type="button"
          :class="['panel-tab', reportKind === 'leases' && 'panel-tab-active']"
          @click="toggleKind('leases')"
        >
          <DoorOpen class="w-4 h-4" />
          Помещения
        </button>
      </div>

      <div class="grid sm:grid-cols-3 gap-4 mb-6">
        <template v-if="reportKind === 'bills'">
          <div class="panel-stat-card">
            <p class="text-xs text-slate-500 uppercase tracking-wide mb-1">К оплате</p>
            <p class="text-2xl font-bold font-mono text-red-400">{{ billing.formatMoney((summary as { totalPending?: number }).totalPending ?? 0) }}</p>
          </div>
          <div class="panel-stat-card">
            <p class="text-xs text-slate-500 uppercase tracking-wide mb-1">Оплачено</p>
            <p class="text-2xl font-bold font-mono text-emerald-brand">{{ billing.formatMoney((summary as { totalPaid?: number }).totalPaid ?? 0) }}</p>
          </div>
          <div class="panel-stat-card">
            <p class="text-xs text-slate-500 uppercase tracking-wide mb-1">Счетов</p>
            <p class="text-2xl font-bold font-mono text-white">{{ summary.count }}</p>
          </div>
        </template>
        <template v-else>
          <div class="panel-stat-card">
            <p class="text-xs text-slate-500 uppercase tracking-wide mb-1">Аренда / мес</p>
            <p class="text-2xl font-bold font-mono text-emerald-brand">{{ portfolio.formatMoney((summary as { totalRent?: number }).totalRent ?? 0) }}</p>
          </div>
          <div class="panel-stat-card sm:col-span-2">
            <p class="text-xs text-slate-500 uppercase tracking-wide mb-1">Помещений</p>
            <p class="text-2xl font-bold font-mono text-white">{{ summary.count }}</p>
          </div>
        </template>
      </div>

      <div class="grid lg:grid-cols-12 gap-6">
        <div class="lg:col-span-3 panel-card p-4">
          <div class="text-sm font-medium text-white mb-4">
            {{ reportKind === 'leases' ? 'По помещениям' : 'Фильтр' }}
          </div>
          <button
            type="button"
            class="w-full text-left px-3 py-2.5 rounded-xl text-sm mb-2 transition-colors border border-transparent"
            :class="navBtnClass(scope.kind === 'all')"
            @click="selectAllLeases"
          >
            {{ reportKind === 'leases' ? 'Все помещения' : 'Все счета' }}
          </button>
          <div class="space-y-1 max-h-64 overflow-y-auto pr-1">
            <button
              v-for="lease in leases"
              :key="lease.leaseId"
              type="button"
              class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-left transition-colors border border-transparent"
              :class="navBtnClass(scope.kind !== 'all' && scope.tenantId === lease.leaseId)"
              @click="selectLease(lease.leaseId)"
            >
              <span class="font-mono truncate">{{ lease.unitNumber }}</span>
              <ChevronRight class="w-3.5 h-3.5 shrink-0 opacity-50" />
            </button>
          </div>
        </div>

        <div class="lg:col-span-9 grid lg:grid-cols-4 gap-6">
          <div class="lg:col-span-1 panel-card p-5">
            <div class="flex items-center gap-2 text-sm font-medium text-white mb-4">
              <Settings2 class="w-4 h-4 text-emerald-brand" />
              Поля
            </div>
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
            <div class="flex gap-2 text-xs mb-5">
              <button type="button" class="text-emerald-brand hover:underline" @click="toggleAllColumns(true)">Все</button>
              <span class="text-slate-600">·</span>
              <button type="button" class="text-slate-400 hover:underline" @click="toggleAllColumns(false)">Сбросить</button>
            </div>
            <button
              type="button"
              class="w-full panel-btn-primary justify-center disabled:opacity-50"
              :disabled="!selectedColumns.length || !displayRows.length || exporting"
              @click="handleExport"
            >
              <Download class="w-4 h-4" />
              {{ exporting ? 'Экспорт...' : 'Excel' }}
            </button>
          </div>

          <div class="lg:col-span-3 panel-card overflow-hidden">
            <div class="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <div class="flex items-center gap-2 text-sm font-medium text-white">
                  <FileSpreadsheet class="w-4 h-4 text-emerald-brand" />
                  {{ scopeTitle }}
                </div>
                <p class="text-xs text-slate-500 mt-0.5">Только просмотр</p>
              </div>
              <span class="text-xs text-slate-500 font-mono">{{ displayRows.length }} строк</span>
            </div>

            <div class="overflow-auto max-h-[480px]">
              <table v-if="selectedColumns.length && displayRows.length" class="w-full text-sm">
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
                        'font-mono': ['rent', 'amount', 'space', 'area'].includes(col.key),
                        'max-w-[180px] truncate': col.key === 'address' || col.key === 'title',
                      }"
                    >
                      {{ formatTenantCell(col.key, getRowValue(row, col.key), portfolio) }}
                    </td>
                  </tr>
                </tbody>
                <tfoot v-if="displayRows.length > 1 && (reportKind === 'bills' || reportKind === 'leases')" class="border-t border-border bg-panel/80">
                  <tr>
                    <td
                      v-for="col in selectedColumns"
                      :key="'t-' + col.key"
                      class="px-4 py-3 text-xs font-semibold text-slate-400"
                    >
                      <template v-if="col.key === 'amount' || col.key === 'rent'">
                        {{ portfolio.formatMoney(sumColumn(col.key)) }}
                      </template>
                      <template v-else-if="col.key === 'title' || col.key === 'address'">Итого</template>
                    </td>
                  </tr>
                </tfoot>
              </table>
              <div v-else class="py-16 text-center text-slate-500 text-sm">
                {{ selectedColumns.length ? 'Нет данных для отображения' : 'Выберите поля отчёта' }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </TenantLayout>
</template>
