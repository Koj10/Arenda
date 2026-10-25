<script setup lang="ts">
import { Loader2 } from '@lucide/vue'
import { useRequestBusy } from '@/composables/requestBusy'

const { visible } = useRequestBusy()
</script>

<template>
  <Teleport to="body">
    <!-- Тонкая полоска прогресса сверху -->
    <div
      v-show="visible"
      class="fixed top-0 left-0 right-0 z-[190] h-0.5 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      <div class="request-busy-bar h-full w-1/3 rounded-full bg-emerald-brand shadow-[0_0_12px_rgba(45,212,191,0.55)]" />
    </div>

    <!-- Блокирующий оверлей: нельзя повторно тыкать формы -->
    <div
      v-if="visible"
      class="fixed inset-0 z-[185] flex items-center justify-center bg-black/35 backdrop-blur-[1px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div class="flex items-center gap-3 rounded-2xl border border-border bg-card/95 px-5 py-4 shadow-2xl">
        <Loader2 class="w-5 h-5 text-emerald-brand animate-spin shrink-0" />
        <div class="min-w-0">
          <p class="text-sm font-medium text-white">Сохранение…</p>
          <p class="text-xs text-slate-500 mt-0.5">Дождитесь ответа сервера</p>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.request-busy-bar {
  animation: requestBusySlide 1.1s ease-in-out infinite;
}

@keyframes requestBusySlide {
  0% {
    transform: translateX(-120%);
  }
  100% {
    transform: translateX(420%);
  }
}
</style>
