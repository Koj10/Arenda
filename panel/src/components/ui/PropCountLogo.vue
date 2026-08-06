<script setup lang="ts">
import logoUrl from '@/assets/logo.png'

withDefaults(
  defineProps<{
    size?: number
    showText?: boolean
    textClass?: string
  }>(),
  { size: 36, showText: false, textClass: 'font-bold text-white' },
)
</script>

<template>
  <span class="inline-flex items-center gap-2 shrink-0">
    <img
      :src="logoUrl"
      alt="PropCount"
      :width="size"
      :height="size"
      class="shrink-0 object-contain"
      draggable="false"
    />
    <span
      v-if="showText"
      :class="textClass"
      style="font-family: var(--font-display)"
    >
      PropCount
    </span>
  </span>
</template>
