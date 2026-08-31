<script setup lang="ts">
import { computed, ref } from 'vue'
import { Building2, MapPin, User } from '@lucide/vue'
import Modal from '@/components/ui/Modal.vue'
import FileAttachments from '@/components/ui/FileAttachments.vue'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { PROPERTY_TYPE_LABELS, TENANT_DOCUMENT_LABEL } from '@/types/portfolio'

const store = usePortfolioStore()
const terminating = ref(false)
const terminateError = ref<string | null>(null)

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
