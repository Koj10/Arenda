<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Bell, CheckCheck } from '@lucide/vue'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationsStore } from '@/stores/notificationsStore'
import { useDismissable } from '@/composables/useDismissable'

const auth = useAuthStore()
const store = useNotificationsStore()
const router = useRouter()

const open = ref(false)
const root = ref<HTMLElement | null>(null)

useDismissable(root, open, () => {
  open.value = false
})

watch(
  () => [auth.user?.email, auth.user?.role] as const,
  ([email, role]) => {
    if (email && role) store.hydrate(role, email)
  },
  { immediate: true },
)

const unread = computed(() => store.unreadCount)

function formatWhen(iso: string) {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  if (diff < 3600e3) return `${Math.max(1, Math.floor(diff / 60e3))} мин назад`
  if (diff < 864e5) return `${Math.floor(diff / 3600e3)} ч назад`
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function toggle() {
  open.value = !open.value
}

function openItem(id: string, href?: string) {
  store.markRead(id)
  open.value = false
  if (href) void router.push(href)
}
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-card border border-transparent hover:border-border relative"
      :aria-expanded="open"
      aria-label="Уведомления"
      @click="toggle"
    >
      <Bell class="w-4 h-4" />
      <span
        v-if="unread > 0"
        class="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 ring-2 ring-navy"
      />
    </button>

    <div
      v-if="open"
      class="panel-popover"
    >
      <div class="flex items-center justify-between px-4 py-3 border-b border-border">
        <p class="text-sm font-semibold text-white">Уведомления</p>
        <button
          v-if="unread > 0"
          type="button"
          class="text-xs text-emerald-brand hover:underline inline-flex items-center gap-1"
          @click="store.markAllRead()"
        >
          <CheckCheck class="w-3.5 h-3.5" />
          Прочитать все
        </button>
      </div>

      <ul v-if="store.items.length" class="max-h-80 overflow-y-auto divide-y divide-border">
        <li v-for="n in store.items" :key="n.id">
          <button
            type="button"
            class="w-full text-left px-4 py-3 hover:bg-card-hover transition-colors"
            :class="!n.read && 'bg-emerald-brand/5'"
            @click="openItem(n.id, n.href)"
          >
            <div class="flex items-start justify-between gap-2">
              <p class="text-sm font-medium text-white">{{ n.title }}</p>
              <span v-if="!n.read" class="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-brand shrink-0" />
            </div>
            <p class="text-xs text-slate-400 mt-0.5 leading-relaxed">{{ n.body }}</p>
            <p class="text-[10px] text-slate-600 mt-1.5">{{ formatWhen(n.createdAt) }}</p>
          </button>
        </li>
      </ul>
      <p v-else class="px-4 py-8 text-center text-sm text-slate-500">Пока нет уведомлений</p>
    </div>
  </div>
</template>
