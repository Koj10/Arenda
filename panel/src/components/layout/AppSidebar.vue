<script setup lang="ts">
import { useRoute, RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { usePlan } from '@/composables/usePlan'
import { BarChart2, Building2, Landmark, Users, Calculator, Receipt, Settings, HelpCircle, LogOut, Sparkles } from '@lucide/vue'
import PropCountLogo from '@/components/ui/PropCountLogo.vue'
import { redirectToLandingLogin } from '@/utils/authRedirect'
import { SITE } from '@/config/site'

defineProps<{ collapsed?: boolean }>()
const emit = defineEmits<{ navigate: [] }>()

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { plan, isPaid, nextPlan, openUpgrade, startCheckout, usage, limits } = usePlan()

const menuItems = [
  { to: '/landlord/accounting', label: 'Аналитика', icon: BarChart2 },
  { to: '/landlord/objects', label: 'Объекты', icon: Building2 },
  { to: '/landlord/cadastral', label: 'Кадастр', icon: Landmark },
  { to: '/landlord/tenants', label: 'Арендаторы', icon: Users },
  { to: '/landlord/bills', label: 'Счета', icon: Receipt },
  { to: '/landlord/reports', label: 'Финансы', icon: Calculator },
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

function onUpgradeClick() {
  emit('navigate')
  if (nextPlan.value) {
    void startCheckout(nextPlan.value.id)
  } else {
    openUpgrade({ reason: 'Вы уже на максимальном тарифе' })
  }
}

const objectsLabel = () => {
  const used = usage.value?.objects ?? 0
  const max = limits.value.maxObjects
  return max != null ? `${used} / ${max}` : `${used}`
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
          v-for="item in menuItems"
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
      <div class="flex items-center justify-between gap-2 mb-1">
        <span class="text-sm font-semibold truncate">{{ plan.name }}</span>
        <span class="text-[10px] uppercase tracking-wide text-slate-500 tabular-nums shrink-0">
          {{ objectsLabel() }}
        </span>
      </div>
      <template v-if="!isPaid || nextPlan">
        <div class="flex items-center gap-2 mb-1.5 mt-2">
          <Sparkles class="w-4 h-4 text-emerald-brand shrink-0" />
          <span class="text-sm font-semibold truncate">{{ nextPlan ? nextPlan.name : 'Тариф' }}</span>
        </div>
        <p class="text-xs text-slate-500 mb-3 leading-relaxed line-clamp-2">
          {{ nextPlan?.description ?? 'Расширенная аналитика и автоматизация.' }}
        </p>
        <button type="button" class="panel-btn-primary w-full text-xs py-2" @click="onUpgradeClick">
          {{ nextPlan ? `Подключить ${nextPlan.name}` : 'Тарифы' }}
        </button>
      </template>
      <p v-else class="text-xs text-slate-500 leading-relaxed mt-2">
        Максимальный тариф ·
        <a :href="`${SITE.url}/#pricing`" class="text-emerald-brand hover:underline">детали</a>
      </p>
    </div>
  </aside>
</template>
