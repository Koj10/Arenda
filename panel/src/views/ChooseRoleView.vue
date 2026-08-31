<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Building2, UserRound, ArrowLeft, Check } from '@lucide/vue'
import { useAuthStore } from '@/stores/authStore'
import { defaultHomeForRole, isValidInn } from '@/types/auth'
import type { UserRole } from '@/types/auth'
import { fetchTenantProfileApi } from '@/api/auth'
import PropCountLogo from '@/components/ui/PropCountLogo.vue'
import { redirectToLandingAuth } from '@/utils/authRedirect'

const router = useRouter()
const auth = useAuthStore()

const selected = ref<UserRole | null>(null)
const tenantInn = ref('')
const error = ref('')
const loading = ref(false)

const pending = computed(() => auth.pendingRoleChoice)
const isLogin = computed(() => pending.value?.mode === 'login')
const isRegister = computed(() => pending.value?.mode === 'register')
const greeting = computed(() => pending.value?.name?.split(' ')[0] || 'друг')

const title = computed(() =>
  isLogin.value ? 'Выберите панель' : `Здравствуйте, ${greeting.value}!`,
)

const subtitle = computed(() =>
  isLogin.value
    ? 'Выберите, кем вы входите. Арендатору нужен ИНН — по нему откроется кабинет арендатора.'
    : 'Аккаунт создан. Выберите роль: арендатору обязательно указать ИНН.',
)

const roles: {
  id: UserRole
  title: string
  description: string
  points: string[]
  icon: typeof Building2
}[] = [
  {
    id: 'landlord',
    title: 'Арендодатель',
    description: 'Управляйте объектами, арендаторами, финансами и документами.',
    points: ['Реестр объектов и помещений', 'Арендаторы и договоры', 'Аналитика и счета'],
    icon: Building2,
  },
  {
    id: 'tenant',
    title: 'Арендатор',
    description: 'Смотрите свои помещения, счета и отчёты по аренде.',
    points: ['Мои помещения', 'Входящие счета', 'Финансовые отчёты'],
    icon: UserRound,
  },
]

async function confirm() {
  error.value = ''
  if (!selected.value) {
    error.value = 'Выберите панель для входа'
    return
  }

  if (selected.value === 'tenant') {
    const inn = tenantInn.value.trim()
    if (!inn) {
      error.value = 'Укажите ИНН компании'
      return
    }
    if (!isValidInn(inn)) {
      error.value = 'ИНН: 10 или 12 цифр'
      return
    }
  }

  loading.value = true
  const result = await auth.completeRoleChoice(
    selected.value,
    selected.value === 'tenant' ? tenantInn.value.trim() : undefined,
  )
  loading.value = false

  if (!result.ok) {
    error.value = result.error
    return
  }
  router.replace(defaultHomeForRole(selected.value))
}

function goBack() {
  const mode = isLogin.value ? 'login' : 'register'
  auth.clearPendingRoleChoice()
  redirectToLandingAuth(mode)
}

onMounted(async () => {
  try {
    const profile = await fetchTenantProfileApi()
    if (profile.inn && !tenantInn.value) tenantInn.value = profile.inn
  } catch {
    /* ИНН ещё не задан */
  }
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4 py-10 bg-navy relative overflow-hidden">
    <div class="relative w-full max-w-3xl animate-[fadeIn_0.45s_ease]">
      <div class="flex items-center justify-center gap-2 mb-8 font-bold text-lg text-white" style="font-family: var(--font-display)">
        <PropCountLogo :size="36" show-text text-class="font-bold text-white" />
      </div>

      <div class="text-center mb-8">
        <h1 class="text-2xl sm:text-3xl font-bold text-white mb-2" style="font-family: var(--font-display)">
          {{ title }}
        </h1>
        <p class="text-sm text-slate-400 max-w-lg mx-auto">
          {{ subtitle }}
        </p>
        <p v-if="pending?.email" class="text-xs text-slate-500 mt-2 font-mono">{{ pending.email }}</p>
      </div>

      <div class="grid sm:grid-cols-2 gap-4 mb-6">
        <button
          v-for="role in roles"
          :key="role.id"
          type="button"
          class="text-left rounded-2xl border p-5 transition-all"
          :class="
            selected === role.id
              ? 'border-emerald-brand bg-emerald-brand/10 shadow-[0_0_0_1px_rgba(45,212,191,0.35)]'
              : 'border-border bg-card hover:border-emerald-brand/40 hover:bg-card-hover'
          "
          @click="selected = role.id"
        >
          <div class="flex items-start justify-between gap-3 mb-4">
            <span
              class="w-11 h-11 rounded-xl flex items-center justify-center"
              :class="selected === role.id ? 'bg-emerald-brand/20 text-emerald-brand' : 'bg-panel text-slate-400'"
            >
              <component :is="role.icon" class="w-5 h-5" />
            </span>
            <span
              v-if="selected === role.id"
              class="w-6 h-6 rounded-full bg-emerald-brand text-black flex items-center justify-center shrink-0"
            >
              <Check class="w-3.5 h-3.5" />
            </span>
          </div>
          <h2 class="text-lg font-semibold text-white mb-1">{{ role.title }}</h2>
          <p class="text-sm text-slate-400 mb-4 leading-relaxed">{{ role.description }}</p>
          <ul class="space-y-1.5">
            <li v-for="point in role.points" :key="point" class="text-xs text-slate-500 flex items-center gap-2">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-brand shrink-0" />
              {{ point }}
            </li>
          </ul>
        </button>
      </div>

      <div
        v-if="selected === 'tenant'"
        class="mb-6 rounded-2xl border border-border bg-card p-5"
      >
        <label class="panel-label">ИНН компании <span class="text-red-400">*</span></label>
        <input
          v-model="tenantInn"
          type="text"
          inputmode="numeric"
          placeholder="7707083893"
          class="panel-input font-mono"
          :class="{ 'border-red-500': error.includes('ИНН') }"
          required
        />
        <p class="text-xs text-slate-500 mt-2">
          Обязательно для арендатора. По ИНН откроется кабинет и связь с договорами.
        </p>
      </div>

      <p v-if="error" class="text-sm text-red-400 text-center mb-4">{{ error }}</p>

      <button
        type="button"
        class="panel-btn-primary w-full justify-center py-3.5 text-base disabled:opacity-50"
        :disabled="loading || !selected"
        @click="confirm"
      >
        <span v-if="loading" class="inline-block w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
        <span v-else>Войти в панель</span>
      </button>

      <p class="text-center text-xs text-slate-600 mt-6">
        <button type="button" class="inline-flex items-center gap-1 hover:text-emerald-brand" @click="goBack">
          <ArrowLeft class="w-3 h-3" />
          {{ isLogin ? 'Назад ко входу' : 'Назад к регистрации' }}
        </button>
      </p>
    </div>
  </div>
</template>

<style>
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
