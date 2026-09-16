<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/components/layout/AppLayout.vue'
import TenantLayout from '@/components/layout/TenantLayout.vue'
import { useAuthStore } from '@/stores/authStore'
import { usePlan } from '@/composables/usePlan'
import { SITE } from '@/config/site'
import { Mail, Bell, Shield, Sparkles, Palette, Check } from '@lucide/vue'
import { useThemeStore } from '@/stores/themeStore'

const auth = useAuthStore()
const router = useRouter()
const { plan, nextPlan, startCheckout, usage, limits } = usePlan()
const themeStore = useThemeStore()

const Layout = computed(() => (auth.isTenant ? TenantLayout : AppLayout))

const name = ref(auth.user?.name ?? '')
const inn = ref(auth.user?.inn ?? '')
const profileError = ref('')
const emailNotify = ref(true)
const pushNotify = ref(true)
const saved = ref(false)

async function saveProfile() {
  profileError.value = ''
  const result = await auth.saveProfile({
    name: name.value.trim() || auth.user?.name,
    inn: inn.value.trim(),
  })
  if (!result.ok) {
    profileError.value = result.error
    return
  }
  saved.value = true
  setTimeout(() => {
    saved.value = false
  }, 2000)
}

function goPricing() {
  window.open(`${SITE.url}/#pricing`, '_blank', 'noopener')
}
</script>

<template>
  <component :is="Layout">
    <div class="panel-page-narrow space-y-6">
      <section class="panel-card p-5 sm:p-6">
        <div class="flex items-center gap-2 mb-4">
          <Shield class="w-4 h-4 text-emerald-brand" />
          <h2 class="text-base font-semibold text-white">Профиль</h2>
        </div>
        <div class="space-y-4">
          <label class="block">
            <span class="text-xs text-slate-500 mb-1.5 block">Имя / компания</span>
            <input v-model="name" type="text" class="panel-input" />
          </label>
          <label class="block">
            <span class="text-xs text-slate-500 mb-1.5 block">Email</span>
            <input :value="auth.user?.email" type="email" class="panel-input opacity-70" disabled />
          </label>
          <label class="block">
            <span class="text-xs text-slate-500 mb-1.5 block">ИНН</span>
            <input
              v-model="inn"
              type="text"
              inputmode="numeric"
              placeholder="Для арендатора обязателен. Для арендодателя — только в этом браузере"
              class="panel-input font-mono"
            />
            <span class="text-[11px] text-slate-600 mt-1.5 block">
              {{
                auth.isTenant
                  ? 'ИНН сохраняется в профиле арендатора и нужен, чтобы найти ваши договоры.'
                  : 'В API нет профиля ИНН арендодателя — значение остаётся только на этом устройстве.'
              }}
            </span>
          </label>
          <p v-if="profileError" class="text-xs text-red-400">{{ profileError }}</p>
          <div class="flex items-center gap-3">
            <button type="button" class="panel-btn-primary" @click="saveProfile">Сохранить</button>
            <span v-if="saved" class="text-xs text-emerald-brand">Сохранено</span>
          </div>
        </div>
      </section>

      <section class="panel-card p-5 sm:p-6">
        <div class="flex items-center gap-2 mb-4">
          <Palette class="w-4 h-4 text-emerald-brand" />
          <h2 class="text-base font-semibold text-white">Тема интерфейса</h2>
        </div>
        <p class="text-sm text-slate-400 mb-4">Выберите оформление панели, которое вам больше нравится</p>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            v-for="theme in themeStore.allThemes"
            :key="theme.id"
            type="button"
            class="group relative rounded-xl border p-3 text-left transition-all hover:border-emerald-brand/50"
            :class="themeStore.themeId === theme.id ? 'border-emerald-brand ring-2 ring-emerald-brand/25' : 'border-border'"
            @click="themeStore.setTheme(theme.id)"
          >
            <div
              class="h-20 rounded-lg mb-3 border overflow-hidden relative"
              :style="{ backgroundColor: theme.preview.bg, borderColor: theme.preview.card }"
            >
              <div
                class="absolute left-3 top-3 bottom-3 w-1/3 rounded-md"
                :style="{ backgroundColor: theme.preview.card }"
              />
              <div class="absolute right-3 top-3 h-2 w-24 rounded-full" :style="{ backgroundColor: theme.preview.card }" />
              <div
                class="absolute right-3 bottom-3 h-6 w-16 rounded-md flex items-center justify-center"
                :style="{ backgroundColor: theme.preview.accent }"
              >
                <div class="w-6 h-1.5 rounded-full" style="background: rgba(255,255,255,0.7)" />
              </div>
              <div
                v-if="themeStore.themeId === theme.id"
                class="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                :style="{ backgroundColor: theme.preview.accent }"
              >
                <Check class="w-3 h-3" :style="{ color: theme.id === 'gold' ? '#0a0908' : '#ffffff' }" />
              </div>
            </div>
            <p class="text-sm font-semibold text-white mb-0.5">{{ theme.name }}</p>
            <p class="text-xs text-slate-500 leading-snug">{{ theme.description }}</p>
          </button>
        </div>
      </section>

      <section v-if="!auth.isTenant" class="panel-card p-5 sm:p-6">
        <div class="flex items-center gap-2 mb-4">
          <Sparkles class="w-4 h-4 text-emerald-brand" />
          <h2 class="text-base font-semibold text-white">Тариф</h2>
        </div>
        <p class="text-sm text-white mb-1">
          {{ plan.name }}
          <span class="text-slate-500 font-normal">
            · {{ usage?.objects ?? 0 }}{{ limits.maxObjects != null ? ` / ${limits.maxObjects}` : '' }} объектов
            <template v-if="limits.maxSpacesPerObject != null">
              · до {{ limits.maxSpacesPerObject }} помещений в объекте
            </template>
            <template v-else-if="limits.maxSpaces == null">
              · помещения без лимита
            </template>
          </span>
        </p>
        <p class="text-xs text-slate-400 mb-4">{{ plan.description }}</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-if="nextPlan"
            type="button"
            class="panel-btn-primary text-xs"
            @click="startCheckout(nextPlan.id)"
          >
            Перейти на {{ nextPlan.name }}
          </button>
          <button type="button" class="panel-btn-secondary text-xs" @click="goPricing">
            Все тарифы
          </button>
        </div>
      </section>

      <section class="panel-card p-5 sm:p-6">
        <div class="flex items-center gap-2 mb-4">
          <Bell class="w-4 h-4 text-emerald-brand" />
          <h2 class="text-base font-semibold text-white">Уведомления</h2>
        </div>
        <div class="space-y-3">
          <label class="flex items-center justify-between gap-4 cursor-pointer">
            <span class="text-sm text-slate-300">Email о счетах и сроках</span>
            <input v-model="emailNotify" type="checkbox" class="accent-emerald-brand w-4 h-4" />
          </label>
          <label class="flex items-center justify-between gap-4 cursor-pointer">
            <span class="text-sm text-slate-300">Уведомления в панели</span>
            <input v-model="pushNotify" type="checkbox" class="accent-emerald-brand w-4 h-4" />
          </label>
          <p class="text-[11px] text-slate-600">
            Сами уведомления приходят из API. Эти переключатели пока только локальные и не влияют на рассылку.
          </p>
        </div>
      </section>

      <section class="panel-card p-5 sm:p-6">
        <div class="flex items-center gap-2 mb-3">
          <Mail class="w-4 h-4 text-emerald-brand" />
          <h2 class="text-base font-semibold text-white">Поддержка</h2>
        </div>
        <p class="text-sm text-slate-400 mb-3">Вопросы по аккаунту и тарифам</p>
        <button type="button" class="panel-btn-secondary text-xs" @click="router.push('/help')">
          Открыть помощь
        </button>
      </section>
    </div>
  </component>
</template>
