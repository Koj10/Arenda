<script setup lang="ts">
import { computed } from 'vue'
import { useAccountingStore } from '@/stores/accountingStore'

const accounting = useAccountingStore()

const comparison = computed(() => accounting.analytics?.revenueComparison ?? null)

const previous = computed(() => comparison.value?.previous ?? 0)
const current = computed(() => comparison.value?.current ?? 0)

const w = 720
const h = 220
const pad = { t: 16, r: 16, b: 36, l: 44 }
const innerW = w - pad.l - pad.r
const innerH = h - pad.t - pad.b
const barW = innerW * 0.22

const yMax = computed(() => Math.max(previous.value, current.value, 1) * 1.1)

function barH(val: number) {
  return (val / yMax.value) * innerH
}

function formatPeriod(period: string) {
  const [year, month] = period.split('-')
  if (!year || !month) return period
  const d = new Date(Number(year), Number(month) - 1, 1)
  return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(d)
}

const changeLabel = computed(() => {
  if (!comparison.value) return ''
  const pct = comparison.value.percentChange
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}% к прошлому периоду`
})
</script>

<template>
  <div class="panel-card p-5">
    <div class="flex items-start justify-between mb-4">
      <div>
        <h3 class="text-base font-semibold text-white">Сравнение доходов</h3>
        <p class="text-xs text-slate-500 mt-0.5">
          {{ comparison ? changeLabel : 'Текущий месяц относительно предыдущего' }}
        </p>
      </div>
      <div v-if="comparison" class="flex items-center gap-4 text-xs">
        <span class="flex items-center gap-1.5 text-slate-400">
          <span class="w-2.5 h-2.5 rounded-full bg-slate-600" />{{ formatPeriod(comparison.previousPeriod) }}
        </span>
        <span class="flex items-center gap-1.5 text-slate-400">
          <span class="w-2.5 h-2.5 rounded-full" style="background: var(--chart-income)" />{{ formatPeriod(comparison.currentPeriod) }}
        </span>
      </div>
    </div>
    <p v-if="!comparison" class="text-sm text-slate-500 py-10 text-center">Нет данных</p>
    <svg v-else :viewBox="`0 0 ${w} ${h}`" class="w-full h-auto max-w-xl mx-auto">
      <line
        v-for="i in 4"
        :key="i"
        :x1="pad.l"
        :x2="w - pad.r"
        :y1="pad.t + (innerH / 4) * i"
        :y2="pad.t + (innerH / 4) * i"
        style="stroke: var(--chart-grid)"
        stroke-width="1"
      />
      <rect
        :x="pad.l + innerW * 0.22"
        :y="pad.t + innerH - barH(previous)"
        :width="barW"
        :height="barH(previous)"
        rx="4"
        fill="var(--border-subtle)"
        :style="{ fill: 'color-mix(in srgb, var(--text-muted) 45%, transparent)' }"
      />
      <rect
        :x="pad.l + innerW * 0.56"
        :y="pad.t + innerH - barH(current)"
        :width="barW"
        :height="barH(current)"
        rx="4"
        :style="{ fill: 'var(--chart-income)' }"
      />
      <text
        :x="pad.l + innerW * 0.22 + barW / 2"
        :y="h - 8"
        text-anchor="middle"
        fill="var(--text-muted)"
        font-size="11"
      >
        {{ accounting.formatMoney(previous) }}
      </text>
      <text
        :x="pad.l + innerW * 0.56 + barW / 2"
        :y="h - 8"
        text-anchor="middle"
        fill="var(--text-muted)"
        font-size="11"
      >
        {{ accounting.formatMoney(current) }}
      </text>
    </svg>
  </div>
</template>
