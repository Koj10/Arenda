<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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
import { Mail, Bell, Shield, Sparkles, Landmark } from '@lucide/vue'

const auth = useAuthStore()
const router = useRouter()
const { plan, nextPlan, startCheckout, usage, limits } = usePlan()
const requisites = useBankRequisitesStore()
const tenantPanel = useTenantPanelStore()

const Layout = computed(() => (auth.isTenant ? TenantLayout : AppLayout))

const name = ref(auth.user?.name ?? '')
const inn = ref(auth.user?.inn ?? '')
const profileError = ref('')
const emailNotify = ref(true)
const pushNotify = ref(true)
const saved = ref(false)
const requisitesSaved = ref(false)

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

function saveRequisites() {
  requisites.saveLandlord()
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
  if (auth.isTenant) void tenantPanel.loadFromApi()
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
          Пока API не хранит реквизиты — они сохраняются в этом браузере и будут подключены к серверу позже.
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
          <div class="flex items-center gap-3">
            <button type="button" class="panel-btn-primary" @click="saveRequisites">Сохранить реквизиты</button>
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
