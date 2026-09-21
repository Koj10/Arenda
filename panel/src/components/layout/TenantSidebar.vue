<script setup lang="ts">
import { useRoute, RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { DoorOpen, FileText, BarChart2, Settings, HelpCircle, LogOut } from '@lucide/vue'
import PropCountLogo from '@/components/ui/PropCountLogo.vue'
import { redirectToLandingLogin } from '@/utils/authRedirect'

defineProps<{ collapsed?: boolean }>()
const emit = defineEmits<{ navigate: [] }>()

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const items = [
  { to: '/tenant/spaces', label: 'Мои помещения', icon: DoorOpen },
  { to: '/tenant/bills', label: 'Счета', icon: FileText },
  { to: '/tenant/reports', label: 'Отчёты', icon: BarChart2 },
]

function isActive(path: string) {
  return route.path === path || route.path.startsWith(path + '/')
}

function navClass(active: boolean) {
  return ['panel-nav-item', active && 'panel-nav-item-active']
}

function go(path: string) {
  emit('navigate')
  void router.push(path)
}

function logout() {
  emit('navigate')
  auth.logout()
  redirectToLandingLogin()
}
</script>

<template>
  <aside class="flex flex-col h-full min-h-0 bg-navy border-r border-border w-full overflow-y-auto overscroll-contain">
    <div class="px-4 sm:px-5 pt-5 sm:pt-6 pb-4 flex items-center gap-3 pr-12 lg:pr-5">
      <PropCountLogo :size="32" />
      <span class="font-bold text-base truncate" style="font-family: var(--font-display)">PropCount</span>
    </div>

    <div class="px-3 sm:px-4 mb-2">
      <p class="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-2">Меню</p>
      <nav class="space-y-0.5">
        <RouterLink
          v-for="item in items"
          :key="item.to"
          :to="item.to"
          :class="navClass(isActive(item.to))"
          @click="emit('navigate')"
        >
          <component :is="item.icon" class="w-[18px] h-[18px] shrink-0" />
          <span class="truncate">{{ item.label }}</span>
        </RouterLink>
      </nav>
    </div>

    <div class="flex-1 min-h-4" />

    <div class="px-3 sm:px-4 mb-3">
      <p class="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-2">Общее</p>
      <nav class="space-y-0.5">
        <button type="button" :class="navClass(isActive('/settings'))" @click="go('/settings')">
          <Settings class="w-[18px] h-[18px] shrink-0" />
          <span class="truncate">Настройки</span>
        </button>
        <button type="button" :class="navClass(isActive('/help'))" @click="go('/help')">
          <HelpCircle class="w-[18px] h-[18px] shrink-0" />
          <span class="truncate">Помощь</span>
        </button>
        <button type="button" class="panel-nav-item" @click="logout">
          <LogOut class="w-[18px] h-[18px] shrink-0" />
          <span class="truncate">Выйти</span>
        </button>
      </nav>
    </div>

    <div class="mx-3 sm:mx-4 mb-4 p-3.5 rounded-xl bg-card border border-border">
      <p class="text-sm font-semibold text-white mb-1">Кабинет арендатора</p>
      <p class="text-xs text-slate-500 leading-relaxed">
        Показания и оплата счетов — здесь. Остальные изменения вносит арендодатель.
      </p>
    </div>
  </aside>
</template>
