<script setup lang="ts">
import { computed } from 'vue'
import { useAccountingStore } from '@/stores/accountingStore'
import { formatDateRu } from '@/utils/dates'

const accounting = useAccountingStore()

const points = computed(() => accounting.analytics?.cashflow ?? [])

const labels = computed(() =>
  points.value.map((p) => {
    if (/^\d{4}-\d{2}-\d{2}/.test(p.date)) {
      return formatDateRu(p.date).slice(0, 5)
    }
    return p.date
  }),
)

const income = computed(() => points.value.map((p) => p.income))
const expenses = computed(() => points.value.map((p) => p.expense))
const net = computed(() => points.value.map((p) => p.profit))

const w = 560
const h = 200
const pad = { t: 10, r: 10, b: 24, l: 40 }
const innerW = w - pad.l - pad.r
const innerH = h - pad.t - pad.b

const yMax = computed(() => {
  const vals = [...income.value, ...expenses.value, ...net.value, 0]
  const max = Math.max(...vals.map((v) => Math.abs(v)), 1)
  return max * 1.1
})

function scaleY(val: number) {
  return pad.t + innerH - (val / yMax.value) * innerH
}

function scaleX(i: number, len: number) {
  if (len <= 1) return pad.l + innerW / 2
  return pad.l + (i / (len - 1)) * innerW
}

function linePath(data: number[]) {
  if (!data.length) return ''
  return data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i, data.length)} ${scaleY(v)}`).join(' ')
}

function areaPath(data: number[]) {
  if (!data.length) return ''
  const line = data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i, data.length)} ${scaleY(v)}`).join(' ')
  return `${line} L ${scaleX(data.length - 1, data.length)} ${pad.t + innerH} L ${scaleX(0, data.length)} ${pad.t + innerH} Z`
}

const labelStep = computed(() => Math.max(1, Math.ceil(labels.value.length / 8)))
</script>

<template>
  <div class="panel-card p-5">
    <div class="flex items-start justify-between mb-4">
      <div>
        <h3 class="text-base font-semibold text-white">Денежный поток</h3>
        <p class="text-xs text-slate-500 mt-0.5">Оплаты арендаторов и загруженные коммуналки</p>
      </div>
      <div class="flex items-center gap-4 text-xs">
        <span class="flex items-center gap-1.5 text-slate-400"><span class="w-2.5 h-2.5 rounded-full bg-emerald-brand" />Доход</span>
        <span class="flex items-center gap-1.5 text-slate-400"><span class="w-2.5 h-2.5 rounded-full bg-red-500" />Расход</span>
        <span class="flex items-center gap-1.5 text-slate-400"><span class="w-2.5 h-2.5 rounded-full bg-orange-400" />Чистая</span>
      </div>
    </div>
    <p v-if="!points.length" class="text-sm text-slate-500 py-10 text-center">Нет данных за этот месяц</p>
    <svg v-else :viewBox="`0 0 ${w} ${h}`" class="w-full h-auto">
      <defs>
        <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#2dd4bf" stop-opacity="0.35" />
          <stop offset="100%" stop-color="#2dd4bf" stop-opacity="0" />
        </linearGradient>
      </defs>
      <line v-for="i in 4" :key="i" :x1="pad.l" :x2="w - pad.r" :y1="pad.t + (innerH / 4) * i" :y2="pad.t + (innerH / 4) * i" stroke="#2a2f36" stroke-width="1" />
      <path :d="areaPath(income)" fill="url(#incomeGrad)" />
      <path :d="linePath(income)" fill="none" stroke="#2dd4bf" stroke-width="2" stroke-linecap="round" />
      <path :d="linePath(expenses)" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" />
      <path :d="linePath(net)" fill="none" stroke="#fb923c" stroke-width="2" stroke-linecap="round" stroke-dasharray="4 3" />
      <text
        v-for="(m, i) in labels"
        v-show="i % labelStep === 0"
        :key="`${m}-${i}`"
        :x="scaleX(i, labels.length)"
        :y="h - 4"
        text-anchor="middle"
        fill="#666"
        font-size="10"
      >{{ m }}</text>
    </svg>
  </div>
</template>
