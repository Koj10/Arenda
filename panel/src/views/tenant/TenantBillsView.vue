<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import TenantLayout from '@/components/layout/TenantLayout.vue'
import { FileText, Download } from '@lucide/vue'
import type { Invoice } from '@/types/billing'
import { useAuthStore } from '@/stores/authStore'
import { useBillingStore } from '@/stores/billingStore'
import { INVOICE_TYPE_LABELS, INVOICE_STATUS_LABELS } from '@/types/billing'
import type { InvoiceStatus } from '@/types/billing'
import { listTenantMeters, upsertTenantMeter } from '@/api/tenant'
import { num, type MeterReadingOut } from '@/api/types'
import { METERED_CRITERIA, UTILITY_CRITERION_LABELS } from '@/types/utilityBills'
import type { UtilityCriterion } from '@/types/utilityBills'
import { formatApiError } from '@/api/http'

const auth = useAuthStore()
const billing = useBillingStore()

const statusFilter = ref<InvoiceStatus | 'all'>('all')
const metersPeriod = ref(currentPeriod())
const meterUnits = ref<{ unit_id: number; unit_number: string; object_address: string }[]>([])
const meterDrafts = ref<Record<string, { previous: string; current: string }>>({})
const meterMeta = ref<Record<string, string>>({})
const metersError = ref<string | null>(null)
const metersSaving = ref(false)

function currentPeriod() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function meterKey(unitId: number, criterion: string) {
  return `${unitId}:${criterion}`
}

function getDraft(unitId: number, criterion: string) {
  const key = meterKey(unitId, criterion)
  if (!meterDrafts.value[key]) meterDrafts.value[key] = { previous: '', current: '' }
  return meterDrafts.value[key]!
}

async function loadMeters() {
  metersError.value = null
  try {
    const data = await listTenantMeters(metersPeriod.value)
    meterUnits.value = data.units ?? []
    const next: Record<string, { previous: string; current: string }> = {}
    const meta: Record<string, string> = {}
    for (const row of data.readings as MeterReadingOut[]) {
      const key = meterKey(row.unit_id, row.criterion)
      next[key] = {
        previous: String(num(row.previous_value)),
        current: String(num(row.current_value)),
      }
      meta[key] = row.submitted_by_role
    }
    meterDrafts.value = next
    meterMeta.value = meta
  } catch (err) {
    metersError.value = formatApiError(err, 'Не удалось загрузить показания')
  }
}

async function saveMeters() {
  metersSaving.value = true
  metersError.value = null
  try {
    for (const unit of meterUnits.value) {
      for (const criterion of METERED_CRITERIA) {
        const draft = meterDrafts.value[meterKey(unit.unit_id, criterion)]
        if (!draft) continue
        const previous = Number(String(draft.previous).replace(',', '.'))
        const current = Number(String(draft.current).replace(',', '.'))
        if (!Number.isFinite(previous) || !Number.isFinite(current)) continue
        if (previous === 0 && current === 0) continue
        await upsertTenantMeter({
          unit_id: unit.unit_id,
          period: metersPeriod.value,
          criterion,
          previous_value: previous,
          current_value: current,
        })
      }
    }
    await loadMeters()
  } catch (err) {
    metersError.value = formatApiError(err, 'Не удалось сохранить показания')
  } finally {
    metersSaving.value = false
  }
}

watch(metersPeriod, () => { void loadMeters() }, { immediate: true })

const bills = computed(() => {
  const inn = auth.tenantInn
  if (!inn) return []
  let list = billing.getInvoicesByInn(inn)
  if (statusFilter.value !== 'all') {
    list = list.filter((b) => b.status === statusFilter.value)
  }
  return list.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
})

const pendingTotal = computed(() =>
  bills.value.filter((b) => b.status === 'pending' || b.status === 'overdue').reduce((s, b) => s + b.amount, 0),
)

function downloadBill(bill: Invoice) {
  if (!bill.document) return
  const link = document.createElement('a')
  link.href = bill.document.dataUrl
  link.download = bill.document.name
  link.target = '_blank'
  link.rel = 'noopener'
  link.click()
}

function statusClass(status: string) {
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
    <div class="panel-page">
      <div class="panel-card p-5 mb-6">
        <div class="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <h2 class="text-sm font-semibold text-white">Показания счётчиков</h2>
            <p class="text-xs text-slate-500 mt-1">
              Если арендодатель уже внёс цифры за период — они появятся здесь. Можно править и сохранить.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <input v-model="metersPeriod" type="month" class="panel-input font-mono text-xs py-1.5 w-40" />
            <button type="button" class="panel-btn-primary text-xs" :disabled="metersSaving" @click="saveMeters">
              {{ metersSaving ? 'Сохранение...' : 'Сохранить' }}
            </button>
          </div>
        </div>
        <p v-if="metersError" class="text-sm text-rose-400 mb-3">{{ metersError }}</p>
        <p v-if="meterUnits.length === 0" class="text-sm text-slate-500">Нет помещений по вашему ИНН</p>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-xs min-w-[560px]">
            <thead>
              <tr class="border-b border-border">
                <th class="text-left py-2 pr-3 font-medium text-slate-500">Помещение</th>
                <th v-for="criterion in METERED_CRITERIA" :key="criterion" class="text-center py-2 font-medium text-slate-500">
                  {{ UTILITY_CRITERION_LABELS[criterion as UtilityCriterion] }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="unit in meterUnits" :key="unit.unit_id" class="border-b border-border/50">
                <td class="py-2.5 pr-3">
                  <p class="font-mono text-white">№{{ unit.unit_number }}</p>
                  <p class="text-slate-500 truncate max-w-[180px]">{{ unit.object_address }}</p>
                </td>
                <td v-for="criterion in METERED_CRITERIA" :key="criterion" class="py-2 px-1">
                  <div class="flex flex-col gap-1 min-w-[110px]">
                    <input
                      :value="getDraft(unit.unit_id, criterion).previous"
                      type="number"
                      min="0"
                      step="0.001"
                      placeholder="было"
                      class="panel-input font-mono text-[11px] py-1"
                      @input="getDraft(unit.unit_id, criterion).previous = ($event.target as HTMLInputElement).value"
                    />
                    <input
                      :value="getDraft(unit.unit_id, criterion).current"
                      type="number"
                      min="0"
                      step="0.001"
                      placeholder="стало"
                      class="panel-input font-mono text-[11px] py-1"
                      @input="getDraft(unit.unit_id, criterion).current = ($event.target as HTMLInputElement).value"
                    />
                    <p v-if="meterMeta[`${unit.unit_id}:${criterion}`]" class="text-[10px] text-slate-600 text-center">
                      {{ meterMeta[`${unit.unit_id}:${criterion}`] === 'landlord' ? 'арендодатель' : 'вы' }}
                    </p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="grid sm:grid-cols-2 gap-4 mb-6">
        <div class="panel-stat-card">
          <p class="text-xs text-slate-500 uppercase tracking-wide mb-1">К оплате</p>
          <p class="text-xl font-mono text-rose-400">{{ billing.formatMoney(pendingTotal) }}</p>
        </div>
        <div class="panel-stat-card">
          <p class="text-xs text-slate-500 uppercase tracking-wide mb-1">Всего счетов</p>
          <p class="text-xl font-mono text-slate-200">{{ bills.length }}</p>
        </div>
      </div>

      <div class="panel-tabs mb-4">
        <button
          v-for="opt in ([['all', 'Все'], ['pending', 'К оплате'], ['paid', 'Оплаченные'], ['overdue', 'Просроченные']] as const)"
          :key="opt[0]"
          type="button"
          class="panel-tab !text-xs !px-3 !py-1.5"
          :class="statusFilter === opt[0] && 'panel-tab-active'"
          @click="statusFilter = opt[0]"
        >
          {{ opt[1] }}
        </button>
      </div>

      <div class="panel-card">
        <div class="panel-table-wrap">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-800">
              <th class="px-5 py-3 font-medium">Счёт</th>
              <th class="px-5 py-3 font-medium hidden sm:table-cell">Период</th>
              <th class="px-5 py-3 font-medium hidden md:table-cell">Помещение</th>
              <th class="px-5 py-3 font-medium">Сумма</th>
              <th class="px-5 py-3 font-medium">Статус</th>
              <th class="px-5 py-3 font-medium hidden lg:table-cell">Файл</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="bill in bills"
              :key="bill.id"
              class="border-b border-slate-800/80"
            >
              <td class="px-5 py-3.5">
                <div class="flex items-center gap-2">
                  <FileText class="w-4 h-4 text-slate-500 shrink-0" />
                  <div>
                    <p class="text-slate-200">{{ bill.title }}</p>
                    <p class="text-xs text-slate-500">{{ INVOICE_TYPE_LABELS[bill.type] }} · до {{ billing.formatDate(bill.dueDate) }}</p>
                  </div>
                </div>
              </td>
              <td class="px-5 py-3.5 text-slate-400 text-xs hidden sm:table-cell">{{ billing.formatPeriod(bill.period) }}</td>
              <td class="px-5 py-3.5 font-mono text-slate-400 hidden md:table-cell">{{ bill.space }}</td>
              <td class="px-5 py-3.5 font-mono text-slate-200">{{ billing.formatMoney(bill.amount) }}</td>
              <td class="px-5 py-3.5">
                <span class="inline-flex px-2 py-0.5 rounded text-xs font-medium" :class="statusClass(bill.status)">
                  {{ INVOICE_STATUS_LABELS[bill.status] }}
                </span>
              </td>
              <td class="px-5 py-3.5 hidden lg:table-cell">
                <button
                  v-if="bill.document"
                  type="button"
                  class="inline-flex items-center gap-1 text-xs text-accent-teal hover:underline"
                  @click="downloadBill(bill)"
                >
                  <Download class="w-3.5 h-3.5" />
                  Скачать
                </button>
                <span v-else class="text-xs text-slate-600">—</span>
              </td>
            </tr>
          </tbody>
        </table>
        </div>
        <div v-if="bills.length === 0" class="py-12 text-center text-slate-500 text-sm">
          Счетов не найдено
        </div>
      </div>

      <p class="text-xs text-slate-600 mt-4 text-center">
        Счета формируются арендодателем и будут приходить автоматически через API
      </p>
    </div>
  </TenantLayout>
</template>
