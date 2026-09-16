<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/components/layout/AppLayout.vue'
import TenantLayout from '@/components/layout/TenantLayout.vue'
import { useAuthStore } from '@/stores/authStore'
import { usePlan } from '@/composables/usePlan'
import { useThemeStore } from '@/stores/themeStore'
import { SITE } from '@/config/site'
import { Mail, Bell, Shield, Sparkles, Palette, Check } from '@lucide/vue'
import type { ThemeId } from '@/types/theme'

const auth = useAuthStore()
const router = useRouter()
const { plan, nextPlan, startCheckout, usage, limits } = usePlan()
const theme = useThemeStore()

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

function pickTheme(id: ThemeId) {
  theme.setTheme(id)
}
</script>

<template>
  <component :is="Layout">
    <div class="panel-page-narrow space-y-6">
      <section class="panel-card p-5 sm:p-6">
        <div class="flex items-center gap-2 mb-4">
          <Shield class="w-4 h-4 accent-text" />
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
            <span v-if="saved" class="text-xs accent-text">Сохранено</span>
          </div>
        </div>
      </section>

      <section class="panel-card p-5 sm:p-6">
        <div class="flex items-center gap-2 mb-4">
          <Palette class="w-4 h-4 accent-text" />
          <h2 class="text-base font-semibold text-white">Оформление панели</h2>
        </div>
        <p class="text-sm text-slate-400 mb-4">Выберите тему, которая вам больше нравится. Цвета логотипа и акценты автоматически подстраиваются под тему.</p>
        <div class="grid grid-cols-2 gap-3 sm:gap-4">
          <button
            v-for="t in theme.allThemes"
            :key="t.id"
            type="button"
            class="relative rounded-xl border p-3 text-left transition-all hover:scale-[1.02]"
            :class="theme.themeId === t.id
              ? 'border-emerald-brand/50 shadow-lg'
              : 'border-border hover:border-emerald-brand/30'"
            :style="theme.themeId === t.id ? {
              borderColor: 'color-mix(in srgb, var(--accent) 50%, transparent)',
              boxShadow: '0 8px 24px color-mix(in srgb, var(--accent) 15%, transparent)',
            } : {}"
            @click="pickTheme(t.id)"
          >
            <div
              class="flex gap-1.5 mb-3 p-2 rounded-lg border"
              :style="{
                background: t.preview.bg,
                borderColor: t.preview.card,
              }"
            >
              <div class="w-1/3 rounded-md" :style="{ background: t.preview.card }" />
              <div class="flex-1 space-y-1.5">
                <div class="h-2 rounded" :style="{ background: t.preview.accent, width: '60%' }" />
                <div class="h-2 rounded" :style="{ background: t.preview.text, opacity: 0.25, width: '100%' }" />
                <div class="h-2 rounded" :style="{ background: t.preview.text, opacity: 0.15, width: '80%' }" />
              </div>
              <div
                class="w-6 h-6 rounded shrink-0 flex items-center justify-center"
                :style="{ background: t.preview.accent }"
              >
                <Check
                  v-if="theme.themeId === t.id"
                  class="w-3.5 h-3.5"
                  :style="{ color: t.mode === 'dark' ? '#000' : '#FFF' }"
                />
              </div>
            </div>
            <div class="flex items-center justify-between mb-0.5">
              <span class="text-sm font-semibold text-white">{{ t.name }}</span>
              <span
                class="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide"
                :style="{
                  background: t.mode === 'dark'
                    ? 'color-mix(in srgb, #000 50%, transparent)'
                    : 'color-mix(in srgb, #888 20%, transparent)',
                  color: t.mode === 'dark' ? '#e5e7eb' : '#4b5563',
                }"
              >
                {{ t.mode === 'dark' ? 'Тёмн.' : 'Светл.' }}
              </span>
            </div>
            <p class="text-xs text-slate-500 leading-snug">{{ t.description }}</p>
          </button>
        </div>
      </section>

      <section v-if="!auth.isTenant" class="panel-card p-5 sm:p-6">
        <div class="flex items-center gap-2 mb-4">
          <Sparkles class="w-4 h-4 accent-text" />
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
          <Bell class="w-4 h-4 accent-text" />
          <h2 class="text-base font-semibold text-white">Уведомления</h2>
        </div>
        <div class="space-y-3">
          <label class="flex items-center justify-between gap-4 cursor-pointer">
            <span class="text-sm text-slate-300">Email о счетах и сроках</span>
            <input v-model="emailNotify" type="checkbox" class="accent-emerald-brand w-4 h-4" style="accent-color: var(--accent)" />
          </label>
          <label class="flex items-center justify-between gap-4 cursor-pointer">
            <span class="text-sm text-slate-300">Уведомления в панели</span>
            <input v-model="pushNotify" type="checkbox" class="accent-emerald-brand w-4 h-4" style="accent-color: var(--accent)" />
          </label>
          <p class="text-[11px] text-slate-600">
            Сами уведомления приходят из API. Эти переключатели пока только локальные и не влияют на рассылку.
          </p>
        </div>
      </section>

      <section class="panel-card p-5 sm:p-6">
        <div class="flex items-center gap-2 mb-3">
          <Mail class="w-4 h-4 accent-text" />
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
