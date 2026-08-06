<script setup lang="ts">
const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']

const income = [420, 445, 460, 480, 510, 530, 550, 565, 580, 590, 600, 590]
const expenses = [180, 175, 190, 195, 200, 205, 198, 210, 205, 200, 208, 205]
const net = income.map((v, i) => v - expenses[i])

const w = 560
const h = 200
const pad = { t: 10, r: 10, b: 24, l: 40 }
const innerW = w - pad.l - pad.r
const innerH = h - pad.t - pad.b

function scaleY(val: number) {
  const max = 650
  return pad.t + innerH - (val / max) * innerH
}

function scaleX(i: number) {
  return pad.l + (i / (months.length - 1)) * innerW
}

function linePath(data: number[]) {
  return data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(v)}`).join(' ')
}

function areaPath(data: number[]) {
  const line = data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(v)}`).join(' ')
  return `${line} L ${scaleX(data.length - 1)} ${pad.t + innerH} L ${scaleX(0)} ${pad.t + innerH} Z`
}
</script>

<template>
  <div class="panel-card p-5">
    <div class="flex items-start justify-between mb-4">
      <div>
        <h3 class="text-base font-semibold text-white">Cash Flow Analysis</h3>
        <p class="text-xs text-slate-500 mt-0.5">Доходы, расходы и чистая прибыль</p>
      </div>
      <div class="flex items-center gap-4 text-xs">
        <span class="flex items-center gap-1.5 text-slate-400"><span class="w-2.5 h-2.5 rounded-full bg-emerald-brand" />Доход</span>
        <span class="flex items-center gap-1.5 text-slate-400"><span class="w-2.5 h-2.5 rounded-full bg-red-500" />Расход</span>
        <span class="flex items-center gap-1.5 text-slate-400"><span class="w-2.5 h-2.5 rounded-full bg-orange-400" />Чистая</span>
      </div>
    </div>
    <svg :viewBox="`0 0 ${w} ${h}`" class="w-full h-auto">
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
      <text v-for="(m, i) in months" :key="m" :x="scaleX(i)" :y="h - 4" text-anchor="middle" fill="#666" font-size="10">{{ m }}</text>
    </svg>
  </div>
</template>
