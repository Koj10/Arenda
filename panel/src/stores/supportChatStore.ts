import { defineStore } from 'pinia'
import { ref } from 'vue'
import { sendSupportToTelegram } from '@/api/telegram'
import { useAuthStore } from '@/stores/authStore'

export interface SupportChatMessage {
  id: string
  role: 'user' | 'support'
  text: string
  at: string
  status: 'sending' | 'sent' | 'error'
}

const STORAGE_KEY = 'propcount-support-chat'

function readStored(): SupportChatMessage[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SupportChatMessage[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const useSupportChatStore = defineStore('supportChat', () => {
  const open = ref(false)
  const messages = ref<SupportChatMessage[]>(readStored())
  const draft = ref('')
  const sending = ref(false)

  function persist() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.value))
    } catch {
      /* quota / private mode */
    }
  }

  function toggle() {
    open.value = !open.value
  }

  function close() {
    open.value = false
  }

  async function send() {
    const text = draft.value.trim()
    if (!text || sending.value) return
    const auth = useAuthStore()
    const item: SupportChatMessage = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      role: 'user',
      text,
      at: new Date().toISOString(),
      status: 'sending',
    }
    messages.value.push(item)
    draft.value = ''
    sending.value = true
    persist()
    try {
      await sendSupportToTelegram({
        text,
        name: auth.user?.name,
        email: auth.user?.email,
        role: auth.user?.role,
      })
      item.status = 'sent'
    } catch {
      item.status = 'error'
    } finally {
      sending.value = false
      persist()
    }
  }

  return {
    open,
    messages,
    draft,
    sending,
    toggle,
    close,
    send,
  }
})
