import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface AppNotification {
  id: string
  title: string
  body: string
  createdAt: string
  read: boolean
  href?: string
}

const STUB: AppNotification[] = [
  {
    id: '1',
    title: 'Счёт ожидает оплаты',
    body: 'ООО «ТехноСофт» — аренда за август, 420 000 ₽',
    createdAt: new Date(Date.now() - 3600e3).toISOString(),
    read: false,
    href: '/landlord/accounting',
  },
  {
    id: '2',
    title: 'Договор истекает',
    body: 'Помещение 101 на Тверской — через 30 дней',
    createdAt: new Date(Date.now() - 864e5).toISOString(),
    read: false,
    href: '/landlord/tenants',
  },
  {
    id: '3',
    title: 'Добро пожаловать в PropCount',
    body: 'Настройте объекты и пригласите арендаторов',
    createdAt: new Date(Date.now() - 3 * 864e5).toISOString(),
    read: true,
  },
]

const TENANT_STUB: AppNotification[] = [
  {
    id: 't1',
    title: 'Новый счёт',
    body: 'Выставлен счёт за аренду — август',
    createdAt: new Date(Date.now() - 7200e3).toISOString(),
    read: false,
    href: '/tenant/bills',
  },
  {
    id: 't2',
    title: 'Документ добавлен',
    body: 'Акт сверки доступен в кабинете',
    createdAt: new Date(Date.now() - 2 * 864e5).toISOString(),
    read: true,
    href: '/tenant/reports',
  },
]

export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref<AppNotification[]>([])
  const loadedFor = ref<string | null>(null)

  const unreadCount = computed(() => items.value.filter((n) => !n.read).length)

  function hydrate(role: 'landlord' | 'tenant', email: string) {
    const key = `${role}:${email}`
    if (loadedFor.value === key) return
    loadedFor.value = key
    // TODO: GET /api/me/notifications
    items.value = (role === 'tenant' ? TENANT_STUB : STUB).map((n) => ({ ...n }))
  }

  function markRead(id: string) {
    const n = items.value.find((x) => x.id === id)
    if (n) n.read = true
  }

  function markAllRead() {
    items.value.forEach((n) => {
      n.read = true
    })
  }

  function clear() {
    items.value = []
    loadedFor.value = null
  }

  return { items, unreadCount, hydrate, markRead, markAllRead, clear }
})
