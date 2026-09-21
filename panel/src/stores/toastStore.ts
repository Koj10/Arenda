import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ToastMessage {
  id: number
  title: string
  body: string
}

let nextId = 1

export const useToastStore = defineStore('toast', () => {
  const items = ref<ToastMessage[]>([])

  function show(title: string, body: string, timeoutMs = 4200) {
    const id = nextId++
    items.value.push({ id, title, body })
    window.setTimeout(() => dismiss(id), timeoutMs)
  }

  function dismiss(id: number) {
    items.value = items.value.filter((item) => item.id !== id)
  }

  return { items, show, dismiss }
})
