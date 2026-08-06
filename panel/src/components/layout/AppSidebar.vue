<script setup lang="ts">
import { useRoute, RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { BarChart2, Building2, Users, Calculator, Settings, HelpCircle, LogOut, Sparkles } from '@lucide/vue'
import PropCountLogo from '@/components/ui/PropCountLogo.vue'
import { redirectToLandingLogin } from '@/utils/authRedirect'

defineProps<{ collapsed?: boolean }>()
const emit = defineEmits<{ navigate: [] }>()

const route = useRoute()
const auth = useAuthStore()

const menuItems = [
  { to: '/landlord/reports', label: 'Аналитика', icon: BarChart2 },
  { to: '/landlord/objects', label: 'Объекты', icon: Building2 },
  { to: '/landlord/tenants', label: 'Арендаторы', icon: Users },
  { to: '/landlord/accounting', label: 'Финансы', icon: Calculator },
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
  <aside class="flex flex-col h-full min-h-0 bg-navy border-r border-border w-full overflow-y-auto">
    <div class="px-5 pt-6 pb-5 flex items-center gap-3">
      <PropCountLogo :size="36" />
      <span class="font-bold text-base" style="font-family: var(--font-display)">PropCount</span>
    </div>

    <div class="px-4 mb-2">
      <p class="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-2">Меню</p>
      <nav class="space-y-1">
        <RouterLink
          v-for="item in menuItems"
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

    <div class="px-4 mb-4">
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
    </div>

    <div class="mx-4 mb-5 p-4 rounded-xl bg-card border border-border">
      <div class="flex items-center gap-2 mb-2">
        <Sparkles class="w-4 h-4 text-emerald-brand" />
        <span class="text-sm font-semibold">Upgrade to Pro</span>
      </div>
      <p class="text-xs text-slate-500 mb-3 leading-relaxed">
        Расширенная аналитика, автоматизация счетов и приоритетная поддержка.
      </p>
      <button type="button" class="panel-btn-primary w-full justify-center text-xs">
        Подключить Pro
      </button>
    </div>
  </aside>
</template>
