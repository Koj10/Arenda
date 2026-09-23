<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Building2, MapPin, User } from '@lucide/vue'
import Modal from '@/components/ui/Modal.vue'
import FileAttachments from '@/components/ui/FileAttachments.vue'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { PROPERTY_TYPE_LABELS, TENANT_DOCUMENT_LABEL } from '@/types/portfolio'
import {
  calculateLandlordInvoice,
  createTenantTariff,
  deleteTenantTariff,
  listTenantTariffs,
} from '@/api/landlord'
import { formatApiError } from '@/api/http'
import { num, type TenantTariffOut } from '@/api/types'
import { currentPeriod } from '@/utils/dates'
import { UTILITY_CRITERIA, UTILITY_CRITERION_LABELS } from '@/types/utilityBills'

const store = usePortfolioStore()
const terminating = ref(false)
const terminateError = ref<string | null>(null)
const tariffs = ref<TenantTariffOut[]>([])
const tariffError = ref('')
const tariffSaving = ref(false)
const calculating = ref(false)
const tariffForm = ref({
  criterion: 'electricity',
  rate: 0,
  unit: 'кВт·ч',
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
  Boolean(tenant.value?.leaseId && tenant.value.status !== 'overdue'),
)

watch(
  () => tenant.value?.id,
  (id) => {
    tariffs.value = []
    if (id) void loadTariffs(id)
  },
)

async function loadTariffs(tenantId: number) {
  try {
    tariffs.value = await listTenantTariffs(tenantId)
  } catch {
    tariffs.value = []
  }
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

function onClose() {
  terminateError.value = null
  store.closeTenantDetail()
}

function openProperty() {
  if (!tenant.value) return
  store.closeTenantDetail()
  store.openPropertyDetail(tenant.value.propertyId)
}

async function addTariff() {
  if (!tenant.value || tariffForm.value.rate <= 0) return
  tariffSaving.value = true
  tariffError.value = ''
  try {
    await createTenantTariff(tenant.value.id, {
      tenant_id: tenant.value.id,
      criterion: tariffForm.value.criterion,
      rate: tariffForm.value.rate,
      unit: tariffForm.value.unit,
    })
    await loadTariffs(tenant.value.id)
  } catch (err) {
    tariffError.value = formatApiError(err, 'Не удалось сохранить тариф')
  } finally {
    tariffSaving.value = false
  }
}

async function removeTariff(id: number) {
  if (!tenant.value) return
  try {
    await deleteTenantTariff(id)
    await loadTariffs(tenant.value.id)
  } catch (err) {
    tariffError.value = formatApiError(err, 'Не удалось удалить тариф')
  }
}

async function calculateInvoice() {
  if (!tenant.value) return
  calculating.value = true
  terminateError.value = null
  try {
    await calculateLandlordInvoice(tenant.value.id, currentPeriod())
  } catch (err) {
    terminateError.value = formatApiError(err, 'Не удалось рассчитать счёт')
  } finally {
    calculating.value = false
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
          <p class="text-xs text-slate-500 mb-1">Договор до</p>
          <p class="text-lg font-mono text-slate-200">{{ store.formatDate(tenant.contract) }}</p>
        </div>
      </div>

      <p class="text-xs text-slate-500 mb-5">
        Счёт за аренду появляется у арендатора сразу после добавления. Он может оплатить его в любой день месяца.
        Если оплата не в приложении, вам нужно подтвердить её в разделе «Счета». В следующем месяце счёт снова станет неоплаченным.
      </p>

      <div class="rounded-xl border border-border bg-panel/40 p-4 mb-5">
        <p class="text-xs text-slate-500 uppercase tracking-wide mb-3">Тарифы ЖКХ</p>
        <ul v-if="tariffs.length" class="space-y-2 mb-3">
          <li v-for="item in tariffs" :key="item.id" class="flex items-center justify-between gap-2 text-sm">
            <span class="text-slate-200">
              {{ UTILITY_CRITERION_LABELS[item.criterion as keyof typeof UTILITY_CRITERION_LABELS] || item.criterion }}
              · {{ num(item.rate) }} {{ item.unit }}
            </span>
            <button type="button" class="text-xs text-rose-400 hover:underline" @click="removeTariff(item.id)">Удалить</button>
          </li>
        </ul>
        <div class="grid sm:grid-cols-3 gap-2">
          <select v-model="tariffForm.criterion" class="panel-input text-xs">
            <option v-for="criterion in UTILITY_CRITERIA" :key="criterion" :value="criterion">
              {{ UTILITY_CRITERION_LABELS[criterion] }}
            </option>
          </select>
          <input v-model.number="tariffForm.rate" type="number" min="0" class="panel-input font-mono text-xs" placeholder="Ставка" />
          <input v-model="tariffForm.unit" type="text" class="panel-input text-xs" placeholder="Ед." />
        </div>
        <p v-if="tariffError" class="text-xs text-rose-400 mt-2">{{ tariffError }}</p>
        <div class="flex flex-wrap gap-2 mt-3">
          <button type="button" class="panel-btn-secondary text-xs" :disabled="tariffSaving" @click="addTariff">
            {{ tariffSaving ? 'Сохранение...' : 'Добавить тариф' }}
          </button>
          <button type="button" class="panel-btn-secondary text-xs" :disabled="calculating" @click="calculateInvoice">
            {{ calculating ? 'Расчёт...' : 'Рассчитать счёт ЖКХ' }}
          </button>
        </div>
      </div>

      <p v-if="terminateError" class="text-xs text-red-400 mb-4">{{ terminateError }}</p>

      <FileAttachments entity-type="tenant" :entity-id="tenant.id" category="lease" :label="TENANT_DOCUMENT_LABEL" />
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
