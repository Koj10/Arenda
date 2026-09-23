<script setup lang="ts">
import { computed } from 'vue'
import { useAccountingStore } from '@/stores/accountingStore'
import { EXPENSE_CATEGORY_LABELS } from '@/types/accounting'
import type { ExpenseCategory } from '@/types/accounting'

const accounting = useAccountingStore()

const palette = ['#2dd4bf', '#a855f7', '#eab308', '#3b82f6', '#f97316', '#64748b']

function categoryLabel(key: string) {
  return EXPENSE_CATEGORY_LABELS[key as ExpenseCategory] ?? key
}

const total = computed(() =>
  (accounting.analytics?.expenseBreakdown ?? []).reduce((s, row) => s + row.amount, 0),
)

const segments = computed(() => {
  const rows = accounting.analytics?.expenseBreakdown ?? []
  if (!rows.length) return []
  return rows.map((row, i) => ({
    label: categoryLabel(row.category),
    amount: row.amount,
    value: total.value > 0 ? (row.amount / total.value) * 100 : 0,
    color: palette[i % palette.length],
  }))
})

const cx = 100
const cy = 100
const r = 70
const ri = 48

function arc(start: number, end: number) {
  const s = (start / 100) * 2 * Math.PI - Math.PI / 2
  const e = (end / 100) * 2 * Math.PI - Math.PI / 2
  const x1 = cx + r * Math.cos(s)
  const y1 = cy + r * Math.sin(s)
  const x2 = cx + r * Math.cos(e)
  const y2 = cy + r * Math.sin(e)
  const xi1 = cx + ri * Math.cos(e)
  const yi1 = cy + ri * Math.sin(e)
  const xi2 = cx + ri * Math.cos(s)
  const yi2 = cy + ri * Math.sin(s)
  const large = end - start > 50 ? 1 : 0
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi1} ${yi1} A ${ri} ${ri} 0 ${large} 0 ${xi2} ${yi2} Z`
}

const arcs = computed(() => {
  let acc = 0
  return segments.value.map((seg) => {
    const start = acc
    acc += seg.value
    return { ...seg, d: arc(start, Math.min(acc, 100)) }
  })
})
</script>

<template>
  <div class="panel-card p-5 h-full">
    <h3 class="text-base font-semibold text-white mb-1">Структура расходов</h3>
    <p class="text-xs text-slate-500 mb-4">Загруженные счета коммуналки</p>
    <div class="flex flex-col items-center">
      <svg viewBox="0 0 200 200" class="w-44 h-44">
        <circle v-if="!segments.length" :cx="cx" :cy="cy" :r="r" fill="none" stroke="#2a2f36" stroke-width="22" />
        <path v-for="a in arcs" :key="a.label" :d="a.d" :fill="a.color" opacity="0.9" />
        <text :x="cx" :y="cy - 6" text-anchor="middle" fill="#888" font-size="10">Итого</text>
        <text :x="cx" :y="cy + 14" text-anchor="middle" fill="white" font-size="14" font-weight="600">
          {{ accounting.formatMoney(total) }}
        </text>
      </svg>
      <div v-if="segments.length" class="grid grid-cols-2 gap-x-4 gap-y-2 mt-2 w-full">
        <div v-for="seg in segments" :key="seg.label" class="flex items-center gap-2 text-xs text-slate-400">
          <span class="w-2 h-2 rounded-full shrink-0" :style="{ background: seg.color }" />
          <span class="truncate">{{ seg.label }}</span>
          <span class="ml-auto text-slate-500">{{ Math.round(seg.value) }}%</span>
        </div>
      </div>
      <p v-else class="text-xs text-slate-500 mt-2">Нет загруженных счетов коммуналки</p>
    </div>
  </div>
</template>
