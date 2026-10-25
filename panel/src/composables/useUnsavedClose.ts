import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue'

const DEFAULT_MESSAGE = 'Закрыть без сохранения? Введённые данные будут потеряны.'

/**
 * Подтверждение закрытия модалки, если форма отличается от снимка.
 * Вызовите snapshot() после инициализации / сброса формы (обычно при открытии).
 */
export function useUnsavedClose(
  getState: MaybeRefOrGetter<unknown>,
  message = DEFAULT_MESSAGE,
) {
  const initialJson = ref('')

  function snapshot() {
    initialJson.value = JSON.stringify(toValue(getState))
  }

  snapshot()

  const isDirty = computed(
    () => JSON.stringify(toValue(getState)) !== initialJson.value,
  )

  function confirmClose(): boolean {
    if (!isDirty.value) return true
    return window.confirm(message)
  }

  function requestClose(close: () => void) {
    if (confirmClose()) close()
  }

  return { isDirty, snapshot, confirmClose, requestClose }
}
