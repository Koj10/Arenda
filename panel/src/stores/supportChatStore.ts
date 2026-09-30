import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  getSupportUnreadCount,
  listSupportMessages,
  markSupportRead,
  sendSupportMessage,
} from '@/api/support'
import { getAccessToken } from '@/api/http'
import type { SupportMessageOut } from '@/api/types'

export interface SupportChatMessage {
  id: string
  role: 'user' | 'support'
  text: string
  at: string
  status: 'sending' | 'sent' | 'error'
}

function fromApi(row: SupportMessageOut): SupportChatMessage[] {
  const items: SupportChatMessage[] = [
    {
      id: `u-${row.id}`,
      role: 'user',
      text: row.message,
      at: row.created_at,
      status: 'sent',
    },
  ]
  if (row.response?.trim()) {
    items.push({
      id: `s-${row.id}`,
      role: 'support',
      text: row.response.trim(),
      at: row.updated_at || row.created_at,
      status: 'sent',
    })
  }
  return items
}

export const useSupportChatStore = defineStore('supportChat', () => {
  const open = ref(false)
  const messages = ref<SupportChatMessage[]>([])
  const draft = ref('')
  const sending = ref(false)
  const loading = ref(false)
  const unread = ref(0)

  async function refreshUnread() {
    if (!getAccessToken()) {
      unread.value = 0
      return
    }
    try {
      unread.value = await getSupportUnreadCount()
    } catch {
      unread.value = 0
    }
  }

  async function load() {
    if (!getAccessToken()) return
    loading.value = true
    try {
      const rows = await listSupportMessages()
      const sorted = [...rows].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
      messages.value = sorted.flatMap(fromApi)
    } catch {
      /* keep current */
    } finally {
      loading.value = false
    }
  }

  async function toggle() {
    open.value = !open.value
    if (open.value) {
      await load()
      try {
        await markSupportRead()
        unread.value = 0
      } catch {
        /* ignore */
      }
    }
  }

  function close() {
    open.value = false
  }

  async function send() {
    const text = draft.value.trim()
    if (!text || sending.value) return
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
    try {
      await sendSupportMessage(text)
      item.status = 'sent'
      await load()
    } catch {
      item.status = 'error'
    } finally {
      sending.value = false
    }
  }

  return {
    open,
    messages,
    draft,
    sending,
    loading,
    unread,
    toggle,
    close,
    send,
    load,
    refreshUnread,
  }
})
