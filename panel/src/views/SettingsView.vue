<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/components/layout/AppLayout.vue'
import TenantLayout from '@/components/layout/TenantLayout.vue'
import { useAuthStore } from '@/stores/authStore'
import { usePlan } from '@/composables/usePlan'
import { SITE } from '@/config/site'
import ThemePicker from '@/components/ui/ThemePicker.vue'
import BankRequisitesCard from '@/components/ui/BankRequisitesCard.vue'
import { useBankRequisitesStore } from '@/stores/bankRequisitesStore'
import { useTenantPanelStore } from '@/stores/tenantPanelStore'
import { fetchPreferencesApi, updatePreferencesApi } from '@/api/auth'
import { formatApiError } from '@/api/http'
import { Mail, Bell, Shield, Sparkles, Landmark, Percent } from '@lucide/vue'

const auth = useAuthStore()
const router = useRouter()
const { plan, nextPlan, startCheckout, usage, limits } = usePlan()
const requisites = useBankRequisitesStore()
const tenantPanel = useTenantPanelStore()

const Layout = computed(() => (auth.isTenant ? TenantLayout : AppLayout))

const name = ref(auth.user?.name ?? '')
const inn = ref(auth.user?.inn ?? '')
const taxRate = ref<number | null>(auth.user?.taxRate ?? null)
const profileError = ref('')
const emailNotify = ref(true)
const pushNotify = ref(true)
const prefsError = ref('')
const prefsSaved = ref(false)
const prefsSaving = ref(false)
const saved = ref(false)
const requisitesSaved = ref(false)
const requisitesError = ref('')

const TAX_PRESETS = [0, 6, 15, 20, 22] as const

watch(
  () => [auth.user?.name, auth.user?.inn, auth.user?.taxRate] as const,
  ([nextName, nextInn, nextTax]) => {
    if (nextName) name.value = nextName
    if (nextInn) inn.value = nextInn
    if (nextTax != null) taxRate.value = nextTax
  },
)

async function loadPreferences() {
  prefsError.value = ''
  try {
    const prefs = await fetchPreferencesApi()
    emailNotify.value = prefs.email_notifications !== false
    pushNotify.value = prefs.push_notifications !== false
  } catch {
    /* оставляем значения по умолчанию */
  }
}

async function savePreferences() {
  prefsError.value = ''
  prefsSaving.value = true
  try {
    const prefs = await updatePreferencesApi({
      email_notifications: emailNotify.value,
      push_notifications: pushNotify.value,
    })
    emailNotify.value = prefs.email_notifications !== false
    pushNotify.value = prefs.push_notifications !== false
    prefsSaved.value = true
    setTimeout(() => {
      prefsSaved.value = false
    }, 2000)
  } catch (err) {
    prefsError.value = formatApiError(err, 'Не удалось сохранить уведомления')
  } finally {
    prefsSaving.value = false
  }
}

async function saveProfile() {
  profileError.value = ''
  const result = await auth.saveProfile({
    name: name.value.trim() || auth.user?.name,
    inn: inn.value.trim(),
    ...(auth.isLandlord
      ? { taxRate: taxRate.value == null ? undefined : Number(taxRate.value) }
      : {}),
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

async function saveRequisites() {
  requisitesError.value = ''
  const ok = await requisites.saveLandlord()
  if (!ok) {
    requisitesError.value = requisites.lastError || 'Не удалось сохранить реквизиты'
    return
  }
  requisitesSaved.value = true
  setTimeout(() => {
    requisitesSaved.value = false
  }, 2000)
}

function goPricing() {
  window.open(`${SITE.url}/#pricing`, '_blank', 'noopener')
}

const tenantObjects = computed(() => {
  const map = new Map<number, string>()
  for (const space of tenantPanel.spaces) {
    if (!map.has(space.objectId)) map.set(space.objectId, space.objectAddress)
  }
  return [...map.entries()].map(([id, address]) => ({
    id,
    address,
    data: requisites.getForObject(id),
  }))
})

onMounted(() => {
  void loadPreferences()
  if (auth.isTenant) void tenantPanel.loadFromApi()
  else void requisites.loadFromApi()
})
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
              placeholder="10 или 12 цифр"
              class="panel-input font-mono"
            />
            <span class="text-[11px] text-slate-600 mt-1.5 block">
              Сохраняется в профиле аккаунта и подтягивается после входа.
            </span>
          </label>
          <div v-if="!auth.isTenant" class="block">
            <span class="text-xs text-slate-500 mb-1.5 flex items-center gap-1.5">
              <Percent class="w-3.5 h-3.5" />
              Налоговая ставка
            </span>
            <div class="flex flex-wrap gap-2 mb-2">
              <button
                v-for="preset in TAX_PRESETS"
                :key="preset"
                type="button"
                class="px-2.5 py-1 rounded-lg text-xs border transition-colors"
                :class="
                  taxRate === preset
                    ? 'border-emerald-brand bg-emerald-brand/15 text-emerald-brand'
                    : 'border-border text-slate-400 hover:border-emerald-brand/40'
                "
                @click="taxRate = preset"
              >
                {{ preset }}%
              </button>
            </div>
            <div class="relative max-w-[12rem]">
              <input
                :value="taxRate ?? ''"
                type="number"
                min="0"
                max="100"
                step="0.1"
                class="panel-input font-mono pr-10"
                @input="taxRate = ($event.target as HTMLInputElement).value === '' ? null : Number(($event.target as HTMLInputElement).value)"
              />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">%</span>
            </div>
            <span class="text-[11px] text-slate-600 mt-1.5 block">
              Из оплаченной аренды: налог = сумма × ставка. Например 90&nbsp;000 ₽ при 22% → 19&nbsp;800 ₽.
            </span>
          </div>
          <p v-if="profileError" class="text-xs text-red-400">{{ profileError }}</p>
          <div class="flex items-center gap-3">
            <button type="button" class="panel-btn-primary" @click="saveProfile">Сохранить</button>
            <span v-if="saved" class="text-xs text-emerald-brand">Сохранено</span>
          </div>
        </div>
      </section>

      <ThemePicker />

      <section v-if="auth.isTenant" class="panel-card p-5 sm:p-6">
        <div class="flex items-center gap-2 mb-2">
          <Landmark class="w-4 h-4 text-emerald-brand" />
          <h2 class="text-base font-semibold text-white">Реквизиты арендодателя</h2>
        </div>
        <p class="text-sm text-slate-400 mb-4">
          Их же можно открыть кнопкой «Показать реквизиты» при оплате счёта.
        </p>
        <p v-if="tenantObjects.length === 0" class="text-sm text-slate-500">
          Помещения появятся после того, как арендодатель добавит ваш ИНН.
        </p>
        <div v-else class="space-y-4">
          <div
            v-for="item in tenantObjects"
            :key="item.id"
            class="rounded-xl border border-border bg-panel/30 p-4"
          >
            <p class="text-sm font-medium text-white mb-3">{{ item.address }}</p>
            <BankRequisitesCard :data="item.data" />
          </div>
        </div>
      </section>

      <section v-if="!auth.isTenant" class="panel-card p-5 sm:p-6">
        <div class="flex items-center gap-2 mb-2">
          <Landmark class="w-4 h-4 text-emerald-brand" />
          <h2 class="text-base font-semibold text-white">Реквизиты для оплаты</h2>
        </div>
        <p class="text-sm text-slate-400 mb-4 leading-relaxed">
          Арендатор увидит эти данные по кнопке «Показать реквизиты» при оплате счёта.
          Реквизиты сохраняются в профиле аккаунта.
        </p>
        <div class="space-y-3">
          <label class="block">
            <span class="text-xs text-slate-500 mb-1.5 block">Получатель</span>
            <input v-model="requisites.draft.recipient" type="text" class="panel-input" placeholder="ООО «Компания»" />
          </label>
          <div class="grid sm:grid-cols-2 gap-3">
            <label class="block">
              <span class="text-xs text-slate-500 mb-1.5 block">ИНН</span>
              <input v-model="requisites.draft.inn" type="text" inputmode="numeric" class="panel-input font-mono" />
            </label>
            <label class="block">
              <span class="text-xs text-slate-500 mb-1.5 block">КПП</span>
              <input v-model="requisites.draft.kpp" type="text" inputmode="numeric" class="panel-input font-mono" />
            </label>
          </div>
          <label class="block">
            <span class="text-xs text-slate-500 mb-1.5 block">Банк</span>
            <input v-model="requisites.draft.bankName" type="text" class="panel-input" />
          </label>
          <div class="grid sm:grid-cols-2 gap-3">
            <label class="block">
              <span class="text-xs text-slate-500 mb-1.5 block">БИК</span>
              <input v-model="requisites.draft.bik" type="text" inputmode="numeric" class="panel-input font-mono" />
            </label>
            <label class="block">
              <span class="text-xs text-slate-500 mb-1.5 block">Расчётный счёт</span>
              <input v-model="requisites.draft.account" type="text" class="panel-input font-mono" />
            </label>
          </div>
          <label class="block">
            <span class="text-xs text-slate-500 mb-1.5 block">Корр. счёт</span>
            <input v-model="requisites.draft.corrAccount" type="text" class="panel-input font-mono" />
          </label>
          <label class="block">
            <span class="text-xs text-slate-500 mb-1.5 block">Комментарий к платежу</span>
            <textarea v-model="requisites.draft.notes" rows="2" class="panel-input resize-none" placeholder="Назначение платежа, доп. сведения" />
          </label>
          <p v-if="requisitesError" class="text-xs text-red-400">{{ requisitesError }}</p>
          <div class="flex items-center gap-3">
            <button
              type="button"
              class="panel-btn-primary"
              :disabled="requisites.saving"
              @click="saveRequisites"
            >
              {{ requisites.saving ? 'Сохранение…' : 'Сохранить реквизиты' }}
            </button>
            <span v-if="requisitesSaved" class="text-xs text-emerald-brand">Сохранено</span>
          </div>
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
          <p v-if="prefsError" class="text-xs text-red-400">{{ prefsError }}</p>
          <div class="flex items-center gap-3 pt-1">
            <button
              type="button"
              class="panel-btn-primary text-xs"
              :disabled="prefsSaving"
              @click="savePreferences"
            >
              {{ prefsSaving ? 'Сохранение…' : 'Сохранить уведомления' }}
            </button>
            <span v-if="prefsSaved" class="text-xs text-emerald-brand">Сохранено</span>
          </div>
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
