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
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      class="shrink-0"
      aria-label="PropCount"
    >
      <defs>
        <linearGradient id="pcMain" x1="10" y1="6" x2="70" y2="74" gradientUnits="userSpaceOnUse">
          <stop offset="0%" :style="{ stopColor: 'var(--logo-grad-light)' }" />
          <stop offset="35%" :style="{ stopColor: 'var(--logo-grad-mid)' }" />
          <stop offset="100%" :style="{ stopColor: 'var(--logo-grad-dark)' }" />
        </linearGradient>
        <linearGradient id="pcEdge" x1="20" y1="0" x2="60" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" :style="{ stopColor: 'var(--logo-edge-light)' }" />
          <stop offset="100%" :style="{ stopColor: 'var(--logo-edge-dark)' }" />
        </linearGradient>
        <linearGradient id="pcDeep" x1="30" y1="20" x2="55" y2="70" gradientUnits="userSpaceOnUse">
          <stop offset="0%" :style="{ stopColor: 'var(--logo-deep-mid)' }" />
          <stop offset="100%" :style="{ stopColor: 'var(--logo-deep-dark)' }" />
        </linearGradient>
      </defs>
      <g stroke-linejoin="miter" stroke-linecap="butt">
        <path d="M40 8 L66 23 L66 53 L40 68 L22 57" stroke="url(#pcMain)" stroke-width="11" />
        <path d="M22 29 L22 23 L40 8" stroke="url(#pcEdge)" stroke-width="11" />
        <path d="M40 27 L54 35 L54 49 L40 57 L30 51 L30 33 Z" stroke="url(#pcDeep)" stroke-width="11" />
        <path d="M30 33 L30 70" stroke="url(#pcMain)" stroke-width="11" />
        <path d="M40 8 L66 23" :style="{ stroke: 'var(--logo-top-highlight)' }" stroke-width="3.5" opacity="0.85" />
        <path d="M66 23 L66 53" :style="{ stroke: 'var(--logo-right-shadow)' }" stroke-width="3.5" opacity="0.7" />
        <path d="M30 33 L30 57" :style="{ stroke: 'var(--logo-inner-light)' }" stroke-width="3" opacity="0.55" />
        <path d="M54 35 L54 49" :style="{ stroke: 'var(--logo-inner-shadow)' }" stroke-width="3" opacity="0.65" />
      </g>
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
