<script setup lang="ts">
import { computed } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import { useUtilityBillsStore } from '@/stores/utilityBillsStore'
import { UTILITY_CRITERION_LABELS, type UtilityCriterion } from '@/types/utilityBills'

const utilityBills = useUtilityBillsStore()

function lossLabel(value: number) {
  if (Math.abs(value) < 0.01) return 'Сверка ОК'
  if (value > 0) return 'Убыток арендодателя'
  return 'Прибыль арендодателя'
}

function lossClass(value: number) {
  if (Math.abs(value) < 0.01) return 'text-slate-400'
  if (value > 0) return 'text-rose-400'
  return 'text-emerald-brand'
}

function spacesTotalArea() {
  return (statement.value?.spaces ?? []).reduce((s, r) => s + (r.area > 0 ? r.area : 0), 0)
}

function abs(value: number) {
  return Math.abs(value)
}

const open = computed(() => !!utilityBills.statement)
const statement = computed(() => utilityBills.statement)

const usedCriteria = computed(() => {
  const keys = new Set<UtilityCriterion>()
  for (const row of statement.value?.spaces ?? []) {
    for (const charge of row.charges) keys.add(charge.criterion)
  }
  return [...keys]
})

const pendingCount = computed(() =>
  (statement.value?.spaces ?? []).filter((row) => row.destination === 'tenant' && !row.issued && row.total > 0).length,
)

function chargeOf(spaceId: number, criterion: string) {
  const row = statement.value?.spaces.find((s) => s.spaceId === spaceId)
  return row?.charges.find((c) => c.criterion === criterion)?.amount ?? 0
}

function close() {
  utilityBills.closeStatement()
}
</script>

<template>
  <Modal
    :open="open"
    title="Выписка по коммунальным"
    size="3xl"
    :z-index="120"
    @close="close"
  >
    <div v-if="statement" class="space-y-4">
      <div class="rounded-lg border border-border bg-panel/30 px-3 py-2 text-sm text-slate-400">
        <p class="text-slate-200">{{ statement.address }}</p>
        <p class="text-xs mt-1">
          {{ utilityBills.formatPeriod(statement.period) }}
          · оплатить до {{ utilityBills.formatDate(statement.dueDate) }}
          · общая площадь объекта {{ statement.objectArea }} м²
          <span v-if="spacesTotalArea() > 0 && statement.objectArea !== spacesTotalArea()">
            · заведено помещений {{ spacesTotalArea() }} м²
          </span>
        </p>
      </div>

      <div v-if="statement.warnings.length" class="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200 space-y-1">
        <p v-for="(warn, i) in statement.warnings" :key="i">{{ warn }}</p>
      </div>
      <p v-if="utilityBills.statementError" class="text-sm text-rose-400">{{ utilityBills.statementError }}</p>

      <div class="overflow-x-auto -mx-1 px-1">
        <table class="w-full text-xs min-w-[720px]">
          <thead>
            <tr class="border-b border-border text-slate-500">
              <th class="text-left py-2 pr-3 font-medium">Помещение</th>
              <th class="text-right py-2 px-2 font-medium">Доля</th>
              <th v-for="key in usedCriteria" :key="key" class="text-right py-2 px-2 font-medium whitespace-nowrap">
                {{ UTILITY_CRITERION_LABELS[key] }}
              </th>
              <th class="text-right py-2 px-2 font-medium">Итого</th>
              <th class="text-right py-2 pl-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in statement.spaces" :key="row.spaceId" class="border-b border-border/60">
              <td class="py-2.5 pr-3">
                <p class="text-white font-mono">№{{ row.spaceName }}</p>
                <p class="text-slate-500">{{ row.area }} м² · {{ row.tenantName || 'свободно' }}</p>
                <p class="text-[10px]" :class="row.destination === 'tenant' ? 'text-emerald-brand' : 'text-rose-400/80'">
                  {{ row.destination === 'tenant' ? 'арендатору' : 'потери' }}
                  <span v-if="row.issued"> · выставлен</span>
                </p>
              </td>
              <td class="text-right px-2 font-mono text-slate-400">{{ Math.round(row.areaShare * 1000) / 10 }}%</td>
              <td v-for="key in usedCriteria" :key="key" class="text-right px-2 font-mono text-slate-300">
                {{ chargeOf(row.spaceId, key) ? utilityBills.formatMoney(chargeOf(row.spaceId, key)) : '—' }}
              </td>
              <td class="text-right px-2 font-mono text-white">{{ utilityBills.formatMoney(row.total) }}</td>
              <td class="text-right pl-2">
                <button
                  v-if="row.destination === 'tenant' && !row.issued && row.total > 0"
                  type="button"
                  class="panel-btn-secondary text-[11px] py-1 px-2"
                  :disabled="utilityBills.issuing"
                  @click="utilityBills.issueStatementRow(row.spaceId)"
                >
                  Выставить
                </button>
                <span v-else-if="row.issued" class="text-[11px] text-emerald-brand">Готово</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex flex-wrap gap-4 text-sm">
        <p class="text-slate-400">
          Арендаторам:
          <span class="text-emerald-brand font-mono">{{ utilityBills.formatMoney(statement.tenantTotal) }}</span>
        </p>
        <p class="text-slate-400">
          {{ lossLabel(statement.landlordLoss) }}:
          <span class="font-mono" :class="lossClass(statement.landlordLoss)">
            {{ utilityBills.formatMoney(abs(statement.landlordLoss)) }}
          </span>
        </p>
      </div>
    </div>

    <template #footer>
      <button type="button" class="panel-btn-secondary" @click="close">Закрыть</button>
      <button
        type="button"
        class="panel-btn-primary"
        :disabled="utilityBills.issuing || pendingCount === 0"
        @click="utilityBills.issueAllStatementRows()"
      >
        {{ utilityBills.issuing ? 'Выставление...' : `Выставить все (${pendingCount})` }}
      </button>
    </template>
  </Modal>
</template>
