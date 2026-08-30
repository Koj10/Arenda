import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getAccessToken } from '@/api/http'
import { listNotifications, markNotificationRead } from '@/api/landlord'
import type { NotificationOut } from '@/api/types'

export interface AppNotification {
  id: string
  title: string
  body: string
  createdAt: string
  read: boolean
  href?: string
}

function mapNotification(n: NotificationOut): AppNotification {
  return {
    id: String(n.id),
    title: n.title || 'Уведомление',
    body: n.body || n.message || '',
    createdAt: n.created_at || new Date().toISOString(),
    read: Boolean(n.is_read ?? n.read),
  }
}

export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref<AppNotification[]>([])
  const loadedFor = ref<string | null>(null)

  const unreadCount = computed(() => items.value.filter((n) => !n.read).length)

  async function loadFromApi() {
    if (!getAccessToken()) return
    try {
      const rows = await listNotifications() as NotificationOut[]
      items.value = Array.isArray(rows) ? rows.map(mapNotification) : []
    } catch {
      /* keep current */
    }
  }

  function hydrate(role: 'landlord' | 'tenant', email: string) {
    const key = `${role}:${email}`
    if (loadedFor.value === key) return
    loadedFor.value = key
    void loadFromApi()
  }

  function markRead(id: string) {
    const n = items.value.find((x) => x.id === id)
    if (n) n.read = true
    const numeric = Number(id)
    if (!Number.isNaN(numeric)) void markNotificationRead(numeric)
  }

  function markAllRead() {
    items.value.forEach((n) => {
      n.read = true
      const numeric = Number(n.id)
      if (!Number.isNaN(numeric)) void markNotificationRead(numeric)
    })
  }

  function clear() {
    items.value = []
    loadedFor.value = null
  }

  return { items, unreadCount, hydrate, loadFromApi, markRead, markAllRead, clear }
})
