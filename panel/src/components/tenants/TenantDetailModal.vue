<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Building2, Mail, MapPin, Pencil, User, X } from '@lucide/vue'
import Modal from '@/components/ui/Modal.vue'
import FileAttachments from '@/components/ui/FileAttachments.vue'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { PROPERTY_TYPE_LABELS, TENANT_DOCUMENT_LABEL, type TenantUpdateData } from '@/types/portfolio'

const store = usePortfolioStore()
const terminating = ref(false)
const terminateError = ref<string | null>(null)
const editing = ref(false)
const saving = ref(false)
const saveError = ref<string | null>(null)
const errors = ref<Partial<Record<string, string>>>({})

const editForm = ref<TenantUpdateData>({
  company: '',
  inn: '',
  email: '',
  rent: 0,
  contract: '',
})

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

const canTerminate = computed(() =>
  Boolean(tenant.value?.leaseId && tenant.value.status !== 'overdue' && !editing.value),
)

watch(
  () => store.tenantDetailOpen,
  (open) => {
    if (!open) {
      editing.value = false
      saving.value = false
      saveError.value = null
      errors.value = {}
      terminateError.value = null
    }
  },
)

watch(
  () => tenant.value,
  (t) => {
    if (t) {
      editForm.value = {
        company: t.company,
        inn: t.inn,
        email: t.email ?? '',
        rent: t.rent,
        contract: t.contract,
      }
    }
  },
  { immediate: true },
)

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

function registeredLabel(registered?: boolean, email?: string | null) {
  if (!email) return 'Не указан'
  if (registered) return 'Зарегистрирован'
  return 'Приглашён'
}

function registeredClass(registered?: boolean, email?: string | null) {
  if (!email) return 'text-slate-500 bg-slate-500/10'
  if (registered) return 'text-emerald-brand bg-emerald-brand/10'
  return 'text-amber-400 bg-amber-500/10'
}

function onClose() {
  terminateError.value = null
  store.closeTenantDetail()
}

function openProperty() {
  if (!tenant.value) return
  store.closeTenantDetail()
  store.openPropertyDetail(tenant.value.propertyId)
}

function startEdit() {
  if (!tenant.value) return
  editForm.value = {
    company: tenant.value.company,
    inn: tenant.value.inn,
    email: tenant.value.email ?? '',
    rent: tenant.value.rent,
    contract: tenant.value.contract,
  }
  errors.value = {}
  saveError.value = null
  editing.value = true
}

function cancelEdit() {
  editing.value = false
  saving.value = false
  saveError.value = null
  errors.value = {}
}

function validateEdit() {
  errors.value = {}
  if (!editForm.value.company.trim()) errors.value.company = 'Укажите название'
  if (!/^\d{10}$|^\d{12}$/.test(editForm.value.inn)) errors.value.inn = 'ИНН: 10 или 12 цифр'
  const email = editForm.value.email.trim()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.value.email = 'Введите корректный e-mail'
  if (editForm.value.rent <= 0) errors.value.rent = 'Укажите сумму аренды'
  if (!editForm.value.contract) errors.value.contract = 'Укажите дату окончания'
  return Object.keys(errors.value).length === 0
}

async function saveEdit() {
  if (!tenant.value || !validateEdit()) return
  saving.value = true
  saveError.value = null
  const ok = await store.updateTenant(tenant.value.id, { ...editForm.value }, tenant.value.leaseId)
  saving.value = false
  if (ok) {
    editing.value = false
  } else {
    saveError.value = store.lastError || 'Не удалось сохранить изменения'
  }
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
    :title="editing ? `Редактирование: ${tenant?.company ?? ''}` : (tenant?.company ?? 'Арендатор')"
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
        <span
          v-if="!editing"
          class="inline-flex px-2 py-0.5 rounded text-xs font-medium ml-auto"
          :class="registeredClass(tenant.registered, tenant.email)"
        >
          {{ registeredLabel(tenant.registered, tenant.email) }}
        </span>
      </div>

      <template v-if="!editing">
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

        <div
          class="rounded-xl border border-border bg-panel/40 p-4 mb-5 space-y-2"
        >
          <div class="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wide">
            <Mail class="w-3.5 h-3.5" />
            E-mail для счетов
          </div>
          <p v-if="tenant.email" class="text-sm font-mono text-slate-200 break-all">{{ tenant.email }}</p>
          <div v-else class="flex items-center justify-between gap-3">
            <p class="text-sm text-slate-500">Не указан — счета не будут отправляться</p>
            <button
              type="button"
              class="text-xs panel-btn-secondary !py-1 !px-3"
              @click="startEdit"
            >
              Добавить
            </button>
          </div>
        </div>

        <div class="grid sm:grid-cols-2 gap-4 mb-5">
          <div>
            <p class="text-xs text-slate-500 mb-1">Аренда / мес</p>
            <p class="text-lg font-mono text-emerald-brand">{{ store.formatMoney(tenant.rent) }}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500 mb-1">Договор до</p>
            <p class="text-lg font-mono text-slate-200">{{ store.formatDate(tenant.contract) }}</p>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="space-y-4 mb-5">
          <div>
            <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Компания</label>
            <input
              v-model="editForm.company"
              type="text"
              class="panel-input"
              :class="{ 'border-red-500': errors.company }"
            />
            <p v-if="errors.company" class="text-xs text-red-400 mt-1">{{ errors.company }}</p>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">ИНН</label>
            <input
              v-model="editForm.inn"
              type="text"
              class="panel-input font-mono"
              :class="{ 'border-red-500': errors.inn }"
            />
            <p v-if="errors.inn" class="text-xs text-red-400 mt-1">{{ errors.inn }}</p>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">
              E-mail для счетов и приглашения
            </label>
            <input
              v-model="editForm.email"
              type="email"
              placeholder="tenant@company.ru"
              class="panel-input font-mono"
              :class="{ 'border-red-500': errors.email }"
            />
            <p v-if="errors.email" class="text-xs text-red-400 mt-1">{{ errors.email }}</p>
            <p v-else class="text-xs text-slate-500 mt-1">
              На этот адрес будут приходить счета за аренду и ЖКХ.
            </p>
          </div>

          <div class="grid sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Аренда / мес, ₽</label>
              <input
                v-model.number="editForm.rent"
                type="number"
                min="0"
                class="panel-input font-mono"
                :class="{ 'border-red-500': errors.rent }"
              />
              <p v-if="errors.rent" class="text-xs text-red-400 mt-1">{{ errors.rent }}</p>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Договор до</label>
              <input
                v-model="editForm.contract"
                type="date"
                class="panel-input"
                :class="{ 'border-red-500': errors.contract }"
              />
              <p v-if="errors.contract" class="text-xs text-red-400 mt-1">{{ errors.contract }}</p>
            </div>
          </div>
        </div>

        <p v-if="saveError" class="text-xs text-red-400 mb-4">{{ saveError }}</p>
      </template>

      <p v-if="!editing" class="text-xs text-slate-500 mb-5">
        Счёт за аренду появляется у арендатора сразу после добавления. Он может оплатить его в любой день месяца.
        Если оплата не в приложении, вам нужно подтвердить её в разделе «Счета». В следующем месяце счёт снова станет неоплаченным.
      </p>

      <p v-if="terminateError" class="text-xs text-red-400 mb-4">{{ terminateError }}</p>

      <FileAttachments
        v-if="!editing"
        entity-type="tenant"
        :entity-id="tenant.id"
        category="lease"
        :label="TENANT_DOCUMENT_LABEL"
      />
    </template>

    <template #footer>
      <template v-if="editing">
        <button
          type="button"
          class="panel-btn-secondary mr-auto"
          :disabled="saving"
          @click="cancelEdit"
        >
          <X class="w-4 h-4 mr-1.5 inline-block align-text-bottom" />
          Отмена
        </button>
        <button
          type="button"
          class="panel-btn-primary"
          :disabled="saving"
          @click="saveEdit"
        >
          {{ saving ? 'Сохранение…' : 'Сохранить' }}
        </button>
      </template>
      <template v-else>
        <button
          v-if="canTerminate"
          type="button"
          class="panel-btn-danger mr-auto"
          :disabled="terminating"
          @click="terminateLease"
        >
          {{ terminating ? 'Завершение…' : 'Завершить договор' }}
        </button>
        <button
          type="button"
          class="panel-btn-secondary"
          @click="startEdit"
        >
          <Pencil class="w-4 h-4 mr-1.5 inline-block align-text-bottom" />
          Редактировать
        </button>
        <button type="button" class="panel-btn-secondary" @click="onClose">
          Закрыть
        </button>
      </template>
    </template>
  </Modal>
</template>
