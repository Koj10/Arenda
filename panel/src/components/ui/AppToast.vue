<script setup lang="ts">
import { Info, X } from '@lucide/vue'
import { useToastStore } from '@/stores/toastStore'

const toast = useToastStore()
</script>

<template>
  <Teleport to="body">
    <div class="fixed z-[200] top-4 right-4 left-4 sm:left-auto flex flex-col gap-2 w-auto sm:w-96 pointer-events-none">
      <div
        v-for="item in toast.items"
        :key="item.id"
        class="pointer-events-auto rounded-xl border border-amber-400/40 bg-card shadow-2xl px-4 py-3 flex gap-3"
      >
        <Info class="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-white">{{ item.title }}</p>
          <p class="text-xs text-slate-400 mt-0.5 leading-relaxed">{{ item.body }}</p>
        </div>
        <button
          type="button"
          class="text-slate-500 hover:text-white shrink-0"
          aria-label="Закрыть"
          @click="toast.dismiss(item.id)"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </div>
  </Teleport>
</template>
