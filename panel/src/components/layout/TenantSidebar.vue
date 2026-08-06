<script setup lang="ts">
import { useRoute, RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { DoorOpen, FileText, BarChart2, Settings, HelpCircle, LogOut } from '@lucide/vue'
import PropCountLogo from '@/components/ui/PropCountLogo.vue'
import { redirectToLandingLogin } from '@/utils/authRedirect'

defineProps<{ collapsed?: boolean }>()
const emit = defineEmits<{ navigate: [] }>()

const route = useRoute()
const auth = useAuthStore()

const items = [
  { to: '/tenant/spaces', label: 'Мои помещения', icon: DoorOpen },
  { to: '/tenant/bills', label: 'Счета', icon: FileText },
  { to: '/tenant/reports', label: 'Отчёты', icon: BarChart2 },
]

function isActive(path: string) {
  return route.path === path || route.path.startsWith(path + '/')
}

function linkClass(active: boolean) {
  return active
    ? 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-emerald-brand bg-emerald-brand/10 border border-emerald-brand/20'
    : 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-card transition-colors'
}

function logout() {
  emit('navigate')
  auth.logout()
  redirectToLandingLogin()
}
</script>

<template>
  <aside class="flex flex-col h-full bg-navy border-r border-border w-full">
    <div class="px-5 pt-6 pb-5 flex items-center gap-3">
      <PropCountLogo :size="36" />
      <span class="font-bold text-base" style="font-family: var(--font-display)">PropCount</span>
    </div>

    <div class="px-4 mb-2">
      <p class="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-2">Кабинет</p>
      <nav class="space-y-1">
        <RouterLink
          v-for="item in items"
          :key="item.to"
          :to="item.to"
          :class="linkClass(isActive(item.to))"
          @click="emit('navigate')"
        >
          <component :is="item.icon" class="w-[18px] h-[18px] shrink-0" />
          {{ item.label }}
        </RouterLink>
      </nav>
    </div>

    <div class="flex-1" />

    <div class="px-4 mb-5">
      <p class="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-2">Общее</p>
      <nav class="space-y-1">
        <button type="button" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-card transition-colors">
          <Settings class="w-[18px] h-[18px]" />
          Настройки
        </button>
        <button type="button" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-card transition-colors">
          <HelpCircle class="w-[18px] h-[18px]" />
          Помощь
        </button>
        <button
          type="button"
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-card transition-colors"
          @click="logout"
        >
          <LogOut class="w-[18px] h-[18px]" />
          Выйти
        </button>
      </nav>
      <p class="px-3 mt-4 text-[10px] text-slate-600 leading-relaxed">
        Только просмотр. Изменения вносит арендодатель.
      </p>
    </div>
  </aside>
</template>
