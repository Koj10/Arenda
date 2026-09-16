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
      <!-- Внешний контур: дом-шестиугольник -->
      <path
        d="M24 10 L56 10 L70 30 L70 58 L40 74 L10 58 L10 30 Z"
        fill="none"
        stroke="var(--logo-color)"
        stroke-width="8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <!-- Внутренний контур: стилизованная буква P -->
      <path
        d="M28 30 L44 30 Q54 30 54 40 L54 52 Q54 60 44 60 L28 60 L28 74"
        fill="none"
        stroke="var(--logo-color)"
        stroke-width="8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
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
