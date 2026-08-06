<script setup lang="ts">
const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
const y2025 = [380, 395, 410, 420, 430, 440, 450, 455, 460, 465, 470, 475]
const y2026 = [420, 445, 460, 480, 510, 530, 550, 565, 580, 590, 600, 590]

const w = 720
const h = 220
const pad = { t: 16, r: 16, b: 28, l: 44 }
const innerW = w - pad.l - pad.r
const innerH = h - pad.t - pad.b
const groupW = innerW / months.length
const barW = groupW * 0.28

function barH(val: number) {
  return (val / 650) * innerH
}
</script>

<template>
  <div class="panel-card p-5">
    <div class="flex items-start justify-between mb-4">
      <div>
        <h3 class="text-base font-semibold text-white">Revenue Comparison</h3>
        <p class="text-xs text-slate-500 mt-0.5">Сравнение доходов 2025 vs 2026</p>
      </div>
      <div class="flex items-center gap-4 text-xs">
        <span class="flex items-center gap-1.5 text-slate-400"><span class="w-2.5 h-2.5 rounded-full bg-slate-600" />2025</span>
        <span class="flex items-center gap-1.5 text-slate-400"><span class="w-2.5 h-2.5 rounded-full bg-emerald-brand" />2026</span>
      </div>
    </div>
    <svg :viewBox="`0 0 ${w} ${h}`" class="w-full h-auto">
      <line v-for="i in 4" :key="i" :x1="pad.l" :x2="w - pad.r" :y1="pad.t + (innerH / 4) * i" :y2="pad.t + (innerH / 4) * i" stroke="#2a2f36" stroke-width="1" />
      <g v-for="(m, i) in months" :key="m">
        <rect
          :x="pad.l + i * groupW + groupW * 0.18"
          :y="pad.t + innerH - barH(y2025[i])"
          :width="barW"
          :height="barH(y2025[i])"
          rx="3"
          fill="#404040"
        />
        <rect
          :x="pad.l + i * groupW + groupW * 0.52"
          :y="pad.t + innerH - barH(y2026[i])"
          :width="barW"
          :height="barH(y2026[i])"
          rx="3"
          fill="#2dd4bf"
        />
        <text :x="pad.l + i * groupW + groupW / 2" :y="h - 6" text-anchor="middle" fill="#666" font-size="10">{{ m }}</text>
      </g>
    </svg>
  </div>
</template>
