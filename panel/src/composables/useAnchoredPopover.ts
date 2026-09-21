import { nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'

/** Фиксирует выпадашку у кнопки, чтобы меню не уезжало за край экрана */
export function useAnchoredPopover(
  anchor: Ref<HTMLElement | null>,
  open: Ref<boolean>,
  preferredWidth = 288,
) {
  const style = ref<Record<string, string>>({})

  function update() {
    if (!open.value || typeof window === 'undefined') return
    const el = anchor.value
    if (!el) return
    const rect = el.getBoundingClientRect()
    const gutter = 12
    const width = Math.min(preferredWidth, window.innerWidth - gutter * 2)
    let left = rect.right - width
    left = Math.min(left, window.innerWidth - width - gutter)
    left = Math.max(gutter, left)
    const spaceBelow = window.innerHeight - rect.bottom - gutter
    const spaceAbove = rect.top - gutter
    const maxHeight = Math.max(140, Math.min(420, Math.max(spaceBelow, spaceAbove) - 8))
    const placeAbove = spaceBelow < 180 && spaceAbove > spaceBelow
    const top = placeAbove ? Math.max(gutter, rect.top - 8 - maxHeight) : rect.bottom + 8
    style.value = {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${width}px`,
      maxHeight: `${maxHeight}px`,
      zIndex: '80',
    }
  }

  watch(open, async (value) => {
    if (value) {
      await nextTick()
      update()
    }
  })

  onMounted(() => {
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', update)
    window.removeEventListener('scroll', update, true)
  })

  return { style, update }
}
