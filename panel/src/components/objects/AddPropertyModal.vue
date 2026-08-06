<script setup lang="ts">
import { ref, computed } from 'vue'
import { Plus, Trash2 } from '@lucide/vue'
import { usePortfolioStore } from '@/stores/portfolioStore'
import type { PropertyFormData, PropertyType } from '@/types/portfolio'
import { PROPERTY_TYPE_LABELS, createEmptySpace } from '@/types/portfolio'
import Modal from '@/components/ui/Modal.vue'
import FileAttachments from '@/components/ui/FileAttachments.vue'

const store = usePortfolioStore()

const form = ref<PropertyFormData>({
  address: '',
  type: 'office',
  spaces: [createEmptySpace()],
  documents: [],
})

const errors = ref<Record<string, string>>({})

const types = Object.entries(PROPERTY_TYPE_LABELS) as [PropertyType, string][]

const inputClass =
  'panel-input'

const totalArea = computed(() => form.value.spaces.reduce((s, sp) => s + (sp.area || 0), 0))
const totalRate = computed(() => form.value.spaces.reduce((s, sp) => s + (sp.monthlyRate || 0), 0))

function resetForm() {
  form.value = {
    address: '',
    type: 'office',
    spaces: [createEmptySpace()],
    documents: [],
  }
  errors.value = {}
}

function addSpaceRow() {
  form.value.spaces.push(createEmptySpace())
}

function removeSpaceRow(index: number) {
  if (form.value.spaces.length <= 1) return
  form.value.spaces.splice(index, 1)
}

function validate() {
  errors.value = {}
  if (!form.value.address.trim()) errors.value.address = 'Укажите адрес'
  if (form.value.spaces.length === 0) errors.value.spaces = 'Добавьте хотя бы одно помещение'

  form.value.spaces.forEach((space, index) => {
    if (!space.name.trim()) errors.value[`space-name-${index}`] = 'Укажите номер'
    if (space.area <= 0) errors.value[`space-area-${index}`] = 'Укажите площадь'
    if (space.monthlyRate <= 0) errors.value[`space-rate-${index}`] = 'Укажите ставку'
  })

  const names = form.value.spaces.map((s) => s.name.trim().toLowerCase())
  if (new Set(names).size !== names.length) errors.value.spaces = 'Номера помещений должны быть уникальными'

  return Object.keys(errors.value).length === 0
}

function submit() {
  if (!validate()) return
  store.addProperty({ ...form.value })
  resetForm()
}

function onClose() {
  store.closePropertyModal()
  resetForm()
}
</script>

<template>
  <Modal :open="store.propertyModalOpen" title="Добавить объект" size="xl" @close="onClose">
    <div class="space-y-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Адрес</label>
          <input
            v-model="form.address"
            type="text"
            placeholder="г. Москва, ул. Примерная, д. 1"
            :class="[inputClass, { 'border-red-500': errors.address }]"
          />
          <p v-if="errors.address" class="text-xs text-red-400 mt-1">{{ errors.address }}</p>
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Тип</label>
          <select v-model="form.type" :class="inputClass">
            <option v-for="[key, label] in types" :key="key" :value="key">{{ label }}</option>
          </select>
        </div>
      </div>

      <!-- Spaces -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <label class="text-xs font-medium text-slate-400 uppercase tracking-wide">Помещения</label>
          <button
            type="button"
            class="inline-flex items-center gap-1 text-xs text-emerald-brand hover:underline"
            @click="addSpaceRow"
          >
            <Plus class="w-3.5 h-3.5" />
            Добавить помещение
          </button>
        </div>

        <div class="hidden sm:grid grid-cols-[1fr_5rem_7rem_auto] gap-2 px-3 mb-1 text-[10px] uppercase tracking-wide text-slate-500">
          <span>Номер</span>
          <span>Площадь</span>
          <span>Ставка / мес</span>
          <span class="w-9" />
        </div>

        <div class="space-y-2 max-h-56 overflow-y-auto pr-1">
          <div
            v-for="(space, index) in form.spaces"
            :key="index"
            class="flex items-start gap-2 p-3 rounded-xl border border-border bg-panel/30"
          >
            <div class="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_5rem_7rem] gap-2">
              <div>
                <input
                  v-model="space.name"
                  type="text"
                  placeholder="101, A-01"
                  :class="[inputClass, 'font-mono', { 'border-red-500': errors[`space-name-${index}`] }]"
                />
                <p v-if="errors[`space-name-${index}`]" class="text-xs text-red-400 mt-1">{{ errors[`space-name-${index}`] }}</p>
              </div>
              <div>
                <div class="relative">
                  <input
                    v-model.number="space.area"
                    type="number"
                    min="1"
                    placeholder="85"
                    :class="[inputClass, 'font-mono pr-8', { 'border-red-500': errors[`space-area-${index}`] }]"
                  />
                  <span class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">м²</span>
                </div>
                <p v-if="errors[`space-area-${index}`]" class="text-xs text-red-400 mt-1">{{ errors[`space-area-${index}`] }}</p>
              </div>
              <div>
                <div class="relative">
                  <input
                    v-model.number="space.monthlyRate"
                    type="number"
                    min="1"
                    placeholder="420000"
                    :class="[inputClass, 'font-mono pr-6', { 'border-red-500': errors[`space-rate-${index}`] }]"
                  />
                  <span class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">₽</span>
                </div>
                <p v-if="errors[`space-rate-${index}`]" class="text-xs text-red-400 mt-1">{{ errors[`space-rate-${index}`] }}</p>
              </div>
            </div>
            <button
              type="button"
              class="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-card-hover disabled:opacity-30 shrink-0 transition-colors"
              :disabled="form.spaces.length <= 1"
              @click="removeSpaceRow(index)"
            >
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </div>
        <p v-if="errors.spaces" class="text-xs text-red-400 mt-1">{{ errors.spaces }}</p>
        <p class="text-xs text-slate-500 mt-2">
          {{ form.spaces.length }} помещений · {{ totalArea.toLocaleString('ru-RU') }} м² ·
          <span class="text-emerald-brand font-mono">{{ store.formatMoney(totalRate) }}</span> / мес
        </p>
      </div>

      <FileAttachments v-model="form.documents" entity-type="property" label="Документы объекта" />
    </div>

    <template #footer>
      <button type="button" class="panel-btn-secondary" @click="onClose">Отмена</button>
      <button type="button" class="panel-btn-primary" @click="submit">Добавить</button>
    </template>
  </Modal>
</template>
