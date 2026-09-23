<script setup lang="ts">
withDefaults(defineProps<{
  open: boolean
  title?: string
  size?: 'md' | 'lg' | 'xl' | '3xl'
  zIndex?: number
}>(), {
  title: '',
  size: 'md',
  zIndex: 100,
})

const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4"
      :style="{ zIndex }"
    >
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="emit('close')" />
      <div
        class="relative w-full rounded-t-2xl sm:rounded-xl border border-border bg-card shadow-2xl animate-[fadeIn_0.2s_ease] max-h-[min(92dvh,920px)] flex flex-col mx-auto"
        :class="
          size === '3xl' ? 'sm:max-w-5xl'
          : size === 'xl' ? 'sm:max-w-2xl'
          : size === 'lg' ? 'sm:max-w-lg'
          : 'sm:max-w-md'
        "
      >
        <div class="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border gap-3 shrink-0">
          <slot name="header">
            <h2 class="text-lg font-semibold text-white truncate">{{ title }}</h2>
          </slot>
          <button
            type="button"
            class="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-card-hover transition-colors shrink-0"
            aria-label="Закрыть"
            @click="emit('close')"
          >
            ✕
          </button>
        </div>
        <div class="px-4 sm:px-6 py-4 sm:py-5 min-h-0 flex-1 overflow-y-auto text-slate-300">
          <slot />
        </div>
        <div
          v-if="$slots.footer"
          class="px-4 sm:px-6 py-3 sm:py-4 border-t border-border flex flex-wrap items-center justify-end gap-2 bg-panel/50 shrink-0"
        >
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
</style>
