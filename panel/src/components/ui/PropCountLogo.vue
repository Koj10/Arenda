<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    size?: number
    showText?: boolean
    textClass?: string
  }>(),
  { size: 36, showText: false, textClass: '' },
)

const computedTextClass = computed(() => {
  if (props.textClass) return props.textClass
  return 'font-bold'
})
</script>

<template>
  <span class="inline-flex items-center gap-2 shrink-0">
    <svg
      :width="size"
      :height="size"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      class="shrink-0"
      aria-label="PropCount"
    >
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="var(--logo-color)" />
          <stop offset="100%" stop-color="var(--logo-color)" stop-opacity="0.85" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="40" height="40" rx="10" fill="url(#logoGrad)" />
      <path
        d="M16 18 L16 34 M16 18 Q16 14 20 14 L28 14 Q32 14 32 18 L32 30 Q32 34 28 34 L20 34"
        stroke="white"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
      />
      <circle cx="24" cy="24" r="4" fill="white" />
    </svg>
    <span
      v-if="showText"
      :class="computedTextClass"
      :style="{
        fontFamily: 'var(--font-display)',
        color: 'var(--logo-text)',
        fontSize: `${Math.round(size * 0.55)}px`,
      }"
    >
      PropCount
    </span>
  </span>
</template>
