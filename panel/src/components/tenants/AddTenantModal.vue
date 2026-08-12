<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { usePortfolioStore } from '@/stores/portfolioStore'
import type { TenantFormData } from '@/types/portfolio'
import { TENANT_DOCUMENT_LABEL } from '@/types/portfolio'
import Modal from '@/components/ui/Modal.vue'
import FileAttachments from '@/components/ui/FileAttachments.vue'

const store = usePortfolioStore()

const form = ref<TenantFormData>({
  company: '',
  inn: '',
  propertyId: null,
  space: '',
  rent: 0,
  contract: '',
  documents: [],
})

const errors = ref<Partial<Record<string, string>>>({})

const propertyOptions = computed(() => store.properties)
const lockedProperty = computed(() => !!store.tenantModalPrefill?.propertyId)
const lockedSpace = computed(() => !!store.tenantModalPrefill?.space)

const spaceOptions = computed(() => {
  if (!form.value.propertyId) return []
  return store.getSpacesForProperty(form.value.propertyId)
})

function resetForm() {
  form.value = { company: '', inn: '', propertyId: null, space: '', rent: 0, contract: '', documents: [] }
  errors.value = {}
}

function applyPrefill() {
  const prefill = store.tenantModalPrefill
  if (!prefill) return
  if (prefill.propertyId) form.value.propertyId = prefill.propertyId
  if (prefill.space) form.value.space = prefill.space
  if (prefill.propertyId && prefill.space) {
    const space = store.getSpaceByName(prefill.propertyId, prefill.space)
    if (space) form.value.rent = space.monthlyRate
  }
}

watch(
  () => form.value.space,
  (spaceName) => {
    if (!form.value.propertyId || !spaceName) return
    const space = store.getSpaceByName(form.value.propertyId, spaceName)
    if (space) form.value.rent = space.monthlyRate
  },
)

watch(
  () => store.tenantModalOpen,
  (open) => {
    if (open) {
      resetForm()
      applyPrefill()
    }
  },
)

watch(
  () => form.value.propertyId,
  () => {
    if (!lockedSpace.value && form.value.propertyId) {
      const available = spaceOptions.value.find(
        (s) => !store.getTenantForSpace(form.value.propertyId!, s.name),
      )
      if (available && !form.value.space) form.value.space = available.name
    }
  },
)

function validate() {
  errors.value = {}
  if (!form.value.company.trim()) errors.value.company = 'Укажите название'
  if (!/^\d{10}$|^\d{12}$/.test(form.value.inn)) errors.value.inn = 'ИНН: 10 или 12 цифр'
  if (!form.value.propertyId) errors.value.propertyId = 'Выберите объект'
  if (!form.value.space.trim()) errors.value.space = 'Укажите помещение'
  if (form.value.rent <= 0) errors.value.rent = 'Укажите сумму аренды'
  if (!form.value.contract) errors.value.contract = 'Укажите дату окончания'
  return Object.keys(errors.value).length === 0
}

function submit() {
  if (!validate()) return
  store.addTenant({ ...form.value })
  resetForm()
}

function onClose() {
  store.closeTenantModal()
  resetForm()
}
</script>

<template>
  <Modal :open="store.tenantModalOpen" title="Добавить арендатора" size="lg" :z-index="110" @close="onClose">
    <div class="space-y-4">
      <div>
        <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Компания</label>
        <input v-model="form.company" type="text" placeholder="ООО «Компания»" class="panel-input" :class="{ 'border-red-500': errors.company }" />
        <p v-if="errors.company" class="text-xs text-red-400 mt-1">{{ errors.company }}</p>
      </div>

      <div>
        <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">ИНН</label>
        <input v-model="form.inn" type="text" placeholder="7707083893" class="panel-input font-mono" :class="{ 'border-red-500': errors.inn }" />
        <p v-if="errors.inn" class="text-xs text-red-400 mt-1">{{ errors.inn }}</p>
      </div>

      <div>
        <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Объект</label>
        <select
          v-model="form.propertyId"
          class="panel-input disabled:opacity-60 disabled:cursor-not-allowed"
          :class="{ 'border-red-500': errors.propertyId }"
          :disabled="lockedProperty"
        >
          <option :value="null" disabled>Выберите объект</option>
          <option v-for="p in propertyOptions" :key="p.id" :value="p.id">{{ p.address }}</option>
        </select>
        <p v-if="errors.propertyId" class="text-xs text-red-400 mt-1">{{ errors.propertyId }}</p>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Помещение</label>
          <select
            v-if="spaceOptions.length > 0 && !lockedSpace"
            v-model="form.space"
            class="panel-input"
            :class="{ 'border-red-500': errors.space }"
          >
            <option value="" disabled>Выберите помещение</option>
            <option
              v-for="s in spaceOptions"
              :key="s.id"
              :value="s.name"
              :disabled="!!store.getTenantForSpace(form.propertyId!, s.name)"
            >
              {{ s.name }} · {{ store.formatArea(s.area) }} · {{ store.formatMoney(s.monthlyRate) }}{{ store.getTenantForSpace(form.propertyId!, s.name) ? ' (занято)' : '' }}
            </option>
          </select>
          <input
            v-else
            v-model="form.space"
            type="text"
            placeholder="101, A-01"
            class="panel-input disabled:opacity-60 disabled:cursor-not-allowed"
            :class="{ 'border-red-500': errors.space }"
            :disabled="lockedSpace"
          />
          <p v-if="errors.space" class="text-xs text-red-400 mt-1">{{ errors.space }}</p>
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Аренда / мес, ₽</label>
          <input v-model.number="form.rent" type="number" min="0" class="panel-input font-mono" :class="{ 'border-red-500': errors.rent }" />
          <p v-if="errors.rent" class="text-xs text-red-400 mt-1">{{ errors.rent }}</p>
        </div>
      </div>

      <div>
        <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Договор до</label>
        <input v-model="form.contract" type="date" class="panel-input" :class="{ 'border-red-500': errors.contract }" />
        <p v-if="errors.contract" class="text-xs text-red-400 mt-1">{{ errors.contract }}</p>
      </div>

      <FileAttachments v-model="form.documents" entity-type="tenant" category="lease" :label="TENANT_DOCUMENT_LABEL" compact />
    </div>

    <template #footer>
      <button type="button" class="panel-btn-secondary" @click="onClose">Отмена</button>
      <button type="button" class="panel-btn-primary" @click="submit">Добавить</button>
    </template>
  </Modal>
</template>
