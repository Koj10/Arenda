<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/components/layout/AppLayout.vue'
import TenantLayout from '@/components/layout/TenantLayout.vue'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import { usePlan } from '@/composables/usePlan'
import { SITE } from '@/config/site'
import { Mail, Bell, Shield, Sparkles, Palette, Check } from '@lucide/vue'

const auth = useAuthStore()
const theme = useThemeStore()
const router = useRouter()
const { plan, nextPlan, startCheckout, usage, limits } = usePlan()

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
          <Palette class="w-4 h-4" style="color: var(--color-accent)" />
          <h2 class="text-base font-semibold" style="color: var(--text-primary)">Оформление</h2>
        </div>
        <p class="text-sm mb-4" style="color: var(--text-secondary)">
          Выберите цветовую схему панели. Изменения применяются сразу и сохраняются на этом устройстве.
        </p>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <button
            v-for="t in theme.allThemes"
            :key="t.id"
            type="button"
            class="relative rounded-xl border-2 p-2 transition-all hover:scale-[1.02]"
            :class="theme.themeId === t.id
              ? 'border-solid shadow-lg'
              : 'border-transparent hover:opacity-90'"
            :style="{
              borderColor: theme.themeId === t.id ? t.preview.accent : 'transparent',
              backgroundColor: 'transparent',
            }"
            @click="theme.setTheme(t.id)"
          >
            <div
              class="relative rounded-lg overflow-hidden aspect-[4/3] mb-2 border"
              :style="{
                backgroundColor: t.preview.bg,
                borderColor: t.preview.card,
              }"
            >
              <div
                class="absolute left-2 top-2 right-2 h-2 rounded-full"
                :style="{ backgroundColor: t.preview.card }"
              ></div>
              <div
                class="absolute left-2 top-5 w-4 h-4 rounded-sm"
                :style="{ backgroundColor: t.preview.accent }"
              ></div>
              <div
                class="absolute left-8 top-5 right-2 h-1.5 rounded-full"
                :style="{ backgroundColor: t.preview.card }"
              ></div>
              <div
                class="absolute left-2 top-11 right-2 bottom-2 rounded-md"
                :style="{ backgroundColor: t.preview.card }"
              >
                <div
                  class="absolute left-2 top-2 right-2 h-1 rounded-full opacity-60"
                  :style="{ backgroundColor: t.preview.text }"
                ></div>
                <div
                  class="absolute left-2 top-4 right-5 h-1 rounded-full opacity-40"
                  :style="{ backgroundColor: t.preview.text }"
                ></div>
                <div
                  class="absolute left-2 top-7 right-3 bottom-2 rounded-md opacity-30"
                  :style="{ backgroundColor: t.preview.accent }"
                ></div>
              </div>
              <div
                v-if="theme.themeId === t.id"
                class="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                :style="{ backgroundColor: t.preview.accent }"
              >
                <Check
                  class="w-3.5 h-3.5"
                  :style="{ color: t.id === 'corporate' ? '#ffffff' : t.id === 'yellow' ? '#1a1a1a' : '#000000' }"
                />
              </div>
            </div>
            <div class="text-center">
              <p class="text-sm font-semibold leading-tight" style="color: var(--text-primary)">
                {{ t.name }}
              </p>
              <p class="text-[11px] mt-0.5 leading-tight" style="color: var(--text-muted)">
                {{ t.description }}
              </p>
            </div>
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
