<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronDown, User, Settings, HelpCircle, LogOut, Sparkles } from '@lucide/vue'
import { useAuthStore } from '@/stores/authStore'
import { usePlan } from '@/composables/usePlan'
import { useDismissable } from '@/composables/useDismissable'
import { redirectToLandingLogin } from '@/utils/authRedirect'

const auth = useAuthStore()
const router = useRouter()
const { plan, isPaid } = usePlan()

const open = ref(false)
const root = ref<HTMLElement | null>(null)

useDismissable(root, open, () => {
  open.value = false
})

const initial = computed(() => auth.user?.name?.charAt(0)?.toUpperCase() ?? 'U')
const roleLabel = computed(() => (auth.isTenant ? 'Арендатор' : 'Арендодатель'))

function go(path: string) {
  open.value = false
  void router.push(path)
}

function logout() {
  open.value = false
  auth.logout()
  redirectToLandingLogin()
}
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-card border border-transparent hover:border-border transition-colors"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span class="w-9 h-9 rounded-full bg-emerald-brand/20 text-emerald-brand text-sm font-bold flex items-center justify-center shrink-0">
        {{ initial }}
      </span>
      <span class="hidden lg:block text-left min-w-0">
        <span class="block text-sm font-medium truncate max-w-[120px]">{{ auth.user?.name ?? 'Пользователь' }}</span>
        <span class="block text-[11px] text-slate-500 truncate max-w-[120px]">{{ auth.user?.email ?? '' }}</span>
      </span>
      <ChevronDown class="w-3.5 h-3.5 text-slate-500 hidden lg:block shrink-0" :class="open && 'rotate-180'" />
    </button>

    <div
      v-if="open"
      class="panel-popover !w-64"
    >
      <div class="px-4 py-3 border-b border-border">
        <p class="text-sm font-semibold text-white truncate">{{ auth.user?.name }}</p>
        <p class="text-xs text-slate-500 truncate">{{ auth.user?.email }}</p>
        <div class="mt-2 flex items-center gap-2">
          <span class="text-[10px] px-2 py-0.5 rounded-md bg-panel text-slate-400 border border-border">
            {{ roleLabel }}
          </span>
          <span
            v-if="!auth.isTenant"
            class="text-[10px] px-2 py-0.5 rounded-md border inline-flex items-center gap-1"
            :class="isPaid ? 'border-emerald-brand/30 text-emerald-brand bg-emerald-brand/10' : 'border-border text-slate-400 bg-panel'"
          >
            <Sparkles class="w-3 h-3" />
            {{ plan.name }}
          </span>
        </div>
      </div>

      <nav class="py-1">
        <button
          type="button"
          class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-card-hover hover:text-white"
          @click="go('/settings')"
        >
          <User class="w-4 h-4 text-slate-500" />
          Профиль
        </button>
        <button
          type="button"
          class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-card-hover hover:text-white"
          @click="go('/settings')"
        >
          <Settings class="w-4 h-4 text-slate-500" />
          Настройки
        </button>
        <button
          type="button"
          class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-card-hover hover:text-white"
          @click="go('/help')"
        >
          <HelpCircle class="w-4 h-4 text-slate-500" />
          Помощь
        </button>
      </nav>

      <div class="border-t border-border py-1">
        <button
          type="button"
          class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-400 hover:bg-card-hover"
          @click="logout"
        >
          <LogOut class="w-4 h-4" />
          Выйти
        </button>
      </div>
    </div>
  </div>
</template>
