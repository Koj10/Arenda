<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Building2, MapPin, Mail, Phone, Plus, Trash2, User } from '@lucide/vue'
import Modal from '@/components/ui/Modal.vue'
import FileAttachments from '@/components/ui/FileAttachments.vue'
import { useUnsavedClose } from '@/composables/useUnsavedClose'
import { usePortfolioStore } from '@/stores/portfolioStore'
import type { TenantContact } from '@/types/portfolio'
import { PROPERTY_TYPE_LABELS, TENANT_DOCUMENT_LABEL } from '@/types/portfolio'

const store = usePortfolioStore()
const terminating = ref(false)
const terminateError = ref<string | null>(null)
const emailDraft = ref('')
const emailError = ref('')
const savingEmail = ref(false)
const contactsDraft = ref<TenantContact[]>([])
const contactsError = ref('')
const savingContacts = ref(false)
const autoRenewalDraft = ref(false)
const savingAutoRenewal = ref(false)
const autoRenewalError = ref('')

const { snapshot: snapshotDraft, requestClose } = useUnsavedClose(() => ({
  email: emailDraft.value,
  contacts: contactsDraft.value,
  autoRenewal: autoRenewalDraft.value,
}))

const tenant = computed(() => {
  if (store.tenantDetailLeaseId) {
    return store.getTenantByLeaseId(store.tenantDetailLeaseId) ?? store.getTenantById(store.tenantDetailId!)
  }
  return store.tenantDetailId ? store.getTenantById(store.tenantDetailId) : null
})

const property = computed(() =>
  tenant.value ? store.getPropertyById(tenant.value.propertyId) : null,
)

const space = computed(() => {
  if (!tenant.value || !property.value) return null
  return store.getSpacesForProperty(property.value.id).find((s) => s.name === tenant.value!.space) ?? null
})

const canTerminate = computed(() => Boolean(tenant.value?.leaseId))

const contactsDirty = computed(() =>
  JSON.stringify(normalizeDraft(contactsDraft.value)) !==
  JSON.stringify(normalizeDraft(tenant.value?.contacts ?? [])),
)

watch(
  () => tenant.value?.leaseId ?? tenant.value?.id,
  () => {
    emailDraft.value = tenant.value?.email ?? ''
    emailError.value = ''
    contactsDraft.value = (tenant.value?.contacts ?? []).map((row) => ({ ...row }))
    contactsError.value = ''
    autoRenewalDraft.value = Boolean(tenant.value?.autoRenewal)
    autoRenewalError.value = ''
    snapshotDraft()
  },
  { immediate: true },
)

function normalizeDraft(list: TenantContact[]) {
  return list.map((row) => ({
    name: row.name.trim(),
    phone: row.phone.trim(),
  }))
}

function statusLabel(status: string) {
  const map: Record<string, string> = { active: 'Активен', expiring: 'Истекает', overdue: 'Просрочен' }
  return map[status] ?? status
}

function statusClass(status: string) {
  const map: Record<string, string> = {
    active: 'text-emerald-brand bg-emerald-brand/10',
    expiring: 'text-emerald-brand bg-emerald-brand/10',
    overdue: 'text-rose-400 bg-rose-500/10',
  }
  return map[status] ?? ''
}

async function saveEmail() {
  if (!tenant.value || savingEmail.value) return
  const value = emailDraft.value.trim()
  if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    emailError.value = 'Некорректный email'
    return
  }
  savingEmail.value = true
  emailError.value = ''
  const ok = await store.updateTenant(
    tenant.value.id,
    {
      company: tenant.value.company,
      inn: tenant.value.inn,
      email: value,
      rent: tenant.value.rent,
      contract: tenant.value.contract,
    },
    tenant.value.leaseId,
  )
  savingEmail.value = false
  if (!ok) {
    emailError.value = store.lastError || 'Не удалось сохранить email'
    return
  }
  snapshotDraft()
}

function addContact() {
  contactsDraft.value.push({ name: '', phone: '' })
}

function removeContact(index: number) {
  contactsDraft.value.splice(index, 1)
}

function validateContacts(): TenantContact[] | null {
  contactsError.value = ''
  const cleaned: TenantContact[] = []
  for (const row of contactsDraft.value) {
    const name = row.name.trim()
    const phone = row.phone.trim()
    if (!name && !phone) continue
    if (!name || !phone) {
      contactsError.value = 'Укажите и наименование, и номер для каждого контакта'
      return null
    }
    cleaned.push({ name, phone })
  }
  return cleaned
}

async function saveContacts() {
  if (!tenant.value || savingContacts.value) return
  const cleaned = validateContacts()
  if (!cleaned) return
  savingContacts.value = true
  contactsError.value = ''
  const ok = await store.updateTenant(
    tenant.value.id,
    {
      company: tenant.value.company,
      inn: tenant.value.inn,
      email: tenant.value.email,
      contacts: cleaned,
      rent: tenant.value.rent,
      contract: tenant.value.contract,
    },
    tenant.value.leaseId,
  )
  savingContacts.value = false
  if (!ok) {
    contactsError.value = store.lastError || 'Не удалось сохранить контакты'
    return
  }
  contactsDraft.value = cleaned.map((row) => ({ ...row }))
  snapshotDraft()
}

function onClose() {
  requestClose(() => {
    terminateError.value = null
    store.closeTenantDetail()
  })
}

function openProperty() {
  if (!tenant.value) return
  store.closeTenantDetail()
  store.openPropertyDetail(tenant.value.propertyId)
}

async function onAutoRenewalChange() {
  if (!tenant.value?.leaseId || savingAutoRenewal.value) return
  const next = autoRenewalDraft.value
  savingAutoRenewal.value = true
  autoRenewalError.value = ''
  const ok = await store.setLeaseAutoRenewal(tenant.value.leaseId, next)
  savingAutoRenewal.value = false
  if (!ok) {
    autoRenewalDraft.value = Boolean(tenant.value.autoRenewal)
    autoRenewalError.value = store.lastError || 'Не удалось сохранить'
    return
  }
  snapshotDraft()
}

async function terminateLease() {
  if (!tenant.value?.leaseId || terminating.value) return
  const place = tenant.value.space ? ` по помещению ${tenant.value.space}` : ''
  if (!confirm(
    `Досрочно завершить договор с ${tenant.value.company}${place}?\n\nПомещение сразу станет свободным. Неоплаченный счёт за аренду будет снят. Если арендатор уже отправил оплату, её всё ещё можно подтвердить.`,
  )) return
  terminating.value = true
  terminateError.value = null
  const ok = await store.terminateLease(tenant.value.leaseId)
  terminating.value = false
  if (!ok) terminateError.value = store.lastError || 'Не удалось завершить договор'
}
</script>

<template>
  <Modal
    :open="store.tenantDetailOpen && !!tenant"
    :title="tenant?.company ?? 'Арендатор'"
    size="lg"
    :z-index="105"
    @close="onClose"
  >
    <template v-if="tenant && property">
      <div class="flex flex-wrap items-center gap-2 mb-5 pb-4 border-b border-border">
        <span class="inline-flex px-2 py-0.5 rounded text-xs font-medium" :class="statusClass(tenant.status)">
          {{ statusLabel(tenant.status) }}
        </span>
        <span class="text-xs text-slate-500 font-mono">ИНН {{ tenant.inn }}</span>
      </div>

      <div class="rounded-xl border border-border bg-panel/40 p-4 mb-5">
        <div class="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wide mb-2">
          <Mail class="w-3.5 h-3.5" />
          Эл. почта
        </div>
        <div class="flex flex-col sm:flex-row gap-2">
          <input
            v-model="emailDraft"
            type="email"
            placeholder="Для счетов, если нет кабинета в приложении"
            class="panel-input"
            :class="{ 'border-red-500': emailError }"
          />
          <button
            type="button"
            class="panel-btn-primary shrink-0"
            :disabled="savingEmail || emailDraft.trim() === (tenant.email ?? '').trim()"
            @click="saveEmail"
          >
            {{ savingEmail ? 'Сохранение...' : 'Сохранить' }}
          </button>
        </div>
        <p v-if="emailError" class="text-xs text-red-400 mt-1">{{ emailError }}</p>
        <p v-else class="text-xs text-slate-500 mt-1">
          На этот адрес уходят счета, если арендатор ещё не в PropCount.
        </p>
        <span
          v-if="tenant.isRegistered"
          class="inline-flex mt-3 px-2 py-0.5 rounded text-xs font-medium text-emerald-brand bg-emerald-brand/10"
        >
          Уже зарегистрирован
        </span>
      </div>

      <div class="rounded-xl border border-border bg-panel/40 p-4 mb-5">
        <div class="flex items-center justify-between gap-2 mb-3">
          <div class="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wide">
            <Phone class="w-3.5 h-3.5" />
            Контактные номера
          </div>
          <button
            type="button"
            class="text-xs text-emerald-brand hover:text-emerald-brand/80 inline-flex items-center gap-1"
            @click="addContact"
          >
            <Plus class="w-3.5 h-3.5" />
            Добавить
          </button>
        </div>

        <div v-if="contactsDraft.length" class="space-y-2">
          <div
            v-for="(contact, index) in contactsDraft"
            :key="index"
            class="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2"
          >
            <input
              v-model="contact.name"
              type="text"
              placeholder="Должность / имя"
              class="panel-input"
            />
            <input
              v-model="contact.phone"
              type="tel"
              placeholder="+7 900 123-45-67"
              class="panel-input font-mono"
            />
            <button
              type="button"
              class="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-card-hover justify-self-end sm:justify-self-auto"
              aria-label="Удалить контакт"
              @click="removeContact(index)"
            >
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </div>
        <p v-else class="text-sm text-slate-500">Нет контактных номеров</p>

        <div class="flex flex-col sm:flex-row sm:items-center gap-2 mt-3">
          <p v-if="contactsError" class="text-xs text-red-400 flex-1">{{ contactsError }}</p>
          <p v-else class="text-xs text-slate-500 flex-1">
            Укажите наименование контакта и телефон.
          </p>
          <button
            type="button"
            class="panel-btn-primary shrink-0"
            :disabled="savingContacts || !contactsDirty"
            @click="saveContacts"
          >
            {{ savingContacts ? 'Сохранение...' : 'Сохранить контакты' }}
          </button>
        </div>
      </div>

      <div class="grid sm:grid-cols-2 gap-4 mb-5">
        <div class="rounded-xl border border-border bg-panel/40 p-4 space-y-3">
          <div class="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wide">
            <Building2 class="w-3.5 h-3.5" />
            Объект
          </div>
          <button
            type="button"
            class="text-sm text-slate-200 hover:text-emerald-brand transition-colors text-left flex items-start gap-2"
            @click="openProperty"
          >
            <MapPin class="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            {{ property.address }}
          </button>
          <p class="text-xs text-slate-500">{{ PROPERTY_TYPE_LABELS[property.type] }}</p>
        </div>

        <div class="rounded-xl border border-border bg-panel/40 p-4 space-y-3">
          <div class="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wide">
            <User class="w-3.5 h-3.5" />
            Помещение
          </div>
          <p class="text-sm font-mono text-white">{{ tenant.space }}</p>
          <p v-if="space" class="text-xs text-slate-500">
            {{ store.formatArea(space.area) }} · ставка {{ store.formatMoney(space.monthlyRate) }}/мес
          </p>
        </div>
      </div>

      <div class="grid sm:grid-cols-2 gap-4 mb-5">
        <div>
          <p class="text-xs text-slate-500 mb-1">Аренда / мес</p>
          <p class="text-lg font-mono text-emerald-brand">{{ store.formatMoney(tenant.rent) }}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500 mb-1">
            {{ store.isContractIndefinite(tenant.contract, tenant.autoRenewal) ? 'Срок договора' : 'Договор до' }}
          </p>
          <p class="text-lg font-mono text-slate-200">
            {{ store.formatContractEnd(tenant.contract, tenant.autoRenewal) }}
          </p>
          <p
            v-if="tenant.autoRenewal && !store.isContractIndefinite(tenant.contract, tenant.autoRenewal)"
            class="text-xs text-slate-500 mt-1"
          >
            После {{ store.formatDate(tenant.contract) }} станет бессрочным
          </p>
        </div>
      </div>

      <label
        v-if="tenant.leaseId"
        class="flex items-start gap-3 rounded-xl border border-border bg-panel/40 p-4 mb-5 cursor-pointer"
      >
        <input
          v-model="autoRenewalDraft"
          type="checkbox"
          class="mt-1 rounded border-border bg-panel text-emerald-brand focus:ring-emerald-brand/40"
          :disabled="savingAutoRenewal"
          @change="onAutoRenewalChange"
        />
        <span class="min-w-0">
          <span class="block text-sm text-slate-200">Автоматическая пролонгация</span>
          <span class="block text-xs text-slate-500 mt-1">
            Если срок договора истёк, он считается бессрочным, статус остаётся «Активен».
          </span>
          <span v-if="autoRenewalError" class="block text-xs text-red-400 mt-1">{{ autoRenewalError }}</span>
          <span v-else-if="savingAutoRenewal" class="block text-xs text-slate-500 mt-1">Сохранение…</span>
        </span>
      </label>

      <p class="text-xs text-slate-500 mb-5">
        Счёт за аренду появляется у арендатора сразу после добавления. Он может оплатить его в любой день месяца.
        Если оплата не в приложении, вам нужно подтвердить её в разделе «Счета». В следующем месяце счёт снова станет неоплаченным.
      </p>

      <p v-if="terminateError" class="text-xs text-red-400 mb-4">{{ terminateError }}</p>

      <FileAttachments entity-type="tenant" :entity-id="tenant.leaseId ?? tenant.id" category="lease" :label="TENANT_DOCUMENT_LABEL" />
    </template>

    <template #footer>
      <button
        v-if="canTerminate"
        type="button"
        class="panel-btn-danger mr-auto"
        :disabled="terminating"
        @click="terminateLease"
      >
        {{ terminating ? 'Завершение…' : 'Завершить договор' }}
      </button>
      <button type="button" class="panel-btn-secondary" @click="onClose">
        Закрыть
      </button>
    </template>
  </Modal>
</template>
