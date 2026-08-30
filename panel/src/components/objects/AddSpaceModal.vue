<script setup lang="ts">
import { ref, computed } from 'vue'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { createEmptySpaceFormData } from '@/types/portfolio'
import Modal from '@/components/ui/Modal.vue'

const store = usePortfolioStore()

const form = ref(createEmptySpaceFormData())
const errors = ref<Record<string, string>>({})
const inputClass = 'panel-input'

const currentProperty = computed(() =>
  store.spaceModalPropertyId ? store.getPropertyById(store.spaceModalPropertyId) : null,
)

const availableArea = computed(() =>
  currentProperty.value ? store.getAvailableAreaForProperty(currentProperty.value.id) : 0,
)

const allocatedArea = computed(() =>
  currentProperty.value ? store.getAllocatedAreaForProperty(currentProperty.value.id) : 0,
)

function resetForm() {
  form.value = createEmptySpaceFormData()
  errors.value = {}
}

function validate() {
  errors.value = {}
  if (!form.value.name.trim()) errors.value.name = 'Укажите номер'
  if (!form.value.area || form.value.area <= 0) errors.value.area = 'Укажите площадь'
  if (!form.value.monthlyRate || form.value.monthlyRate <= 0) errors.value.monthlyRate = 'Укажите ставку'

  if (currentProperty.value) {
    const duplicate = store.getSpaceByName(currentProperty.value.id, form.value.name.trim())
    if (duplicate) errors.value.name = 'Помещение с таким номером уже есть'
    if (form.value.area > availableArea.value) {
      errors.value.area = `Доступно только ${availableArea.value} м²`
    }
  }

  return Object.keys(errors.value).length === 0
}

async function submit() {
  if (!validate() || !currentProperty.value) return
  const ok = await store.addSpace(currentProperty.value.id, { ...form.value })
  if (!ok) {
    errors.value.area = store.lastError || `Нельзя выделить больше ${availableArea.value} м²`
    return
  }
  resetForm()
}

function onClose() {
  store.closeSpaceModal()
  resetForm()
}
</script>

<template>
  <Modal
    :open="store.spaceModalOpen && !!currentProperty"
    title="Добавить помещение"
    size="xl"
    :z-index="110"
    @close="onClose"
  >
    <div v-if="currentProperty" class="space-y-4">
      <div class="rounded-xl border border-border bg-panel/30 px-4 py-3 text-sm">
        <p class="text-slate-300">{{ currentProperty.address }}</p>
        <p class="text-xs text-slate-500 mt-1 font-mono">
          Общая площадь {{ store.formatArea(currentProperty.totalArea) }}
          · распределено {{ store.formatArea(allocatedArea) }}
          · <span class="text-emerald-brand">свободно {{ store.formatArea(availableArea) }}</span>
        </p>
        <p class="text-xs text-slate-500 mt-2">
          Привязку к кадастровому номеру сделайте позже в разделе «Кадастр».
        </p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Номер помещения</label>
          <input
            v-model="form.name"
            type="text"
            placeholder="101, A-01"
            :class="[inputClass, { 'border-red-500': errors.name }]"
          />
          <p v-if="errors.name" class="text-xs text-red-400 mt-1">{{ errors.name }}</p>
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Этаж</label>
          <input v-model="form.floor" type="text" placeholder="1" :class="inputClass" />
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">
            Площадь
            <span class="text-slate-600 normal-case font-normal">(макс. {{ availableArea }} м²)</span>
          </label>
          <div class="relative">
            <input
              v-model.number="form.area"
              type="number"
              min="1"
              :max="availableArea || undefined"
              step="0.1"
              :class="[inputClass, 'font-mono pr-8', { 'border-red-500': errors.area }]"
            />
            <span class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">м²</span>
          </div>
          <p v-if="errors.area" class="text-xs text-red-400 mt-1">{{ errors.area }}</p>
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Ставка аренды / мес</label>
          <div class="relative">
            <input
              v-model.number="form.monthlyRate"
              type="number"
              min="0"
              :class="[inputClass, 'font-mono pr-6', { 'border-red-500': errors.monthlyRate }]"
            />
            <span class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">₽</span>
          </div>
          <p v-if="errors.monthlyRate" class="text-xs text-red-400 mt-1">{{ errors.monthlyRate }}</p>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Номер счёта</label>
          <input v-model="form.accountNumber" type="text" :class="inputClass" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Высота потолков</label>
          <div class="relative">
            <input v-model.number="form.ceilingHeight" type="number" min="0" step="0.1" :class="[inputClass, 'font-mono pr-8']" />
            <span class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">м</span>
          </div>
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Тип помещения</label>
          <input v-model="form.spaceType" type="text" :class="inputClass" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Статус</label>
          <select v-model="form.status" :class="inputClass">
            <option value="vacant">Свободно</option>
            <option value="active">Активно</option>
            <option value="inactive">Неактивно</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Отделка</label>
          <select v-model="form.renovation" :class="inputClass">
            <option value="none">Без отделки</option>
            <option value="cosmetic">Косметическая</option>
            <option value="design">Дизайнерская</option>
          </select>
        </div>
      </div>
    </div>

    <template #footer>
      <button type="button" class="panel-btn-secondary" @click="onClose">Отмена</button>
      <button type="button" class="panel-btn-primary" :disabled="availableArea <= 0" @click="submit">
        Добавить
      </button>
    </template>
  </Modal>
</template>
