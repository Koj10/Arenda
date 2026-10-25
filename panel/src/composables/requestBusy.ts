import { computed, ref } from 'vue'

const pending = ref(0)

/** Счётчик мутаций (POST/PUT/PATCH/DELETE) — оверлей и прогресс-бар */
export function beginRequestBusy() {
  pending.value += 1
}

export function endRequestBusy() {
  pending.value = Math.max(0, pending.value - 1)
}

export function useRequestBusy() {
  const visible = computed(() => pending.value > 0)
  return {
    pending,
    visible,
    isBusy: visible,
  }
}
