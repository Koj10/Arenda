import { onBeforeUnmount, onMounted, type Ref } from 'vue'

/** Закрытие по клику вне элемента и Escape */
export function useDismissable(root: Ref<HTMLElement | null>, open: Ref<boolean>, onClose: () => void) {
  function onPointer(e: MouseEvent) {
    if (!open.value || !root.value) return
    if (!root.value.contains(e.target as Node)) onClose()
  }

  function onKey(e: KeyboardEvent) {
    if (open.value && e.key === 'Escape') onClose()
  }

  onMounted(() => {
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
  })
  onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', onPointer)
    document.removeEventListener('keydown', onKey)
  })
}
