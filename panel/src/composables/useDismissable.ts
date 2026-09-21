import { onBeforeUnmount, onMounted, type Ref } from 'vue'

/** Закрытие по клику вне элемента и Escape */
export function useDismissable(
  root: Ref<HTMLElement | null>,
  open: Ref<boolean>,
  onClose: () => void,
  extras: Ref<HTMLElement | null>[] = [],
) {
  function onPointer(e: PointerEvent) {
    if (!open.value) return
    const target = e.target as Node
    if (root.value?.contains(target)) return
    if (extras.some((item) => item.value?.contains(target))) return
    onClose()
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
