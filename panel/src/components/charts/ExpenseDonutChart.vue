<script setup lang="ts">
const segments = [
  { label: 'Коммунальные', value: 0, color: '#2dd4bf' },
  { label: 'Обслуживание', value: 0, color: '#a855f7' },
  { label: 'Налоги', value: 0, color: '#eab308' },
  { label: 'Страхование', value: 0, color: '#3b82f6' },
  { label: 'Прочее', value: 0, color: '#64748b' },
]

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

let acc = 0
const arcs = segments.map((seg) => {
  const start = acc
  acc += seg.value
  return { ...seg, d: arc(start, acc) }
})
</script>

<template>
  <div class="panel-card p-5 h-full">
    <h3 class="text-base font-semibold text-white mb-1">Expense Breakdown</h3>
    <p class="text-xs text-slate-500 mb-4">Структура расходов</p>
    <div class="flex flex-col items-center">
      <svg viewBox="0 0 200 200" class="w-44 h-44">
        <path v-for="a in arcs" :key="a.label" :d="a.d" :fill="a.color" opacity="0.9" />
        <text :x="cx" :y="cy - 6" text-anchor="middle" fill="#888" font-size="10">Total</text>
        <text :x="cx" :y="cy + 14" text-anchor="middle" fill="white" font-size="16" font-weight="600">₽0</text>
      </svg>
      <div class="grid grid-cols-2 gap-x-4 gap-y-2 mt-2 w-full">
        <div v-for="seg in segments" :key="seg.label" class="flex items-center gap-2 text-xs text-slate-400">
          <span class="w-2 h-2 rounded-full shrink-0" :style="{ background: seg.color }" />
          <span class="truncate">{{ seg.label }}</span>
          <span class="ml-auto text-slate-500">{{ seg.value }}%</span>
        </div>
      </div>
    </div>
  </div>
</template>
