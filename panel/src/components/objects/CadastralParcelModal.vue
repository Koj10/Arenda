<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { createEmptyCadastralParcelFormData } from '@/types/portfolio'
import Modal from '@/components/ui/Modal.vue'

const store = usePortfolioStore()

const form = ref(createEmptyCadastralParcelFormData())
const errors = ref<Record<string, string>>({})
const deleting = ref(false)

const inputClass = 'panel-input'

const property = computed(() =>
  store.cadastralModalPropertyId ? store.getPropertyById(store.cadastralModalPropertyId) : null,
)

const editingParcel = computed(() =>
  store.cadastralEditId ? store.getCadastralParcelById(store.cadastralEditId) : null,
)

const isEdit = computed(() => !!editingParcel.value)

const computedArea = computed(() =>
  editingParcel.value ? store.getSpacesAreaForParcel(editingParcel.value.id) : 0,
)

watch(
  () => store.cadastralModalOpen,
  (open) => {
    if (!open) return
    if (editingParcel.value) {
      form.value = {
        cadastralNumber: editingParcel.value.cadastralNumber,
        cadastralValue: editingParcel.value.cadastralValue,
        purchasePrice: editingParcel.value.purchasePrice,
      }
    } else {
      form.value = createEmptyCadastralParcelFormData()
    }
    errors.value = {}
    deleting.value = false
  },
)

function validate() {
  errors.value = {}
  if (!form.value.cadastralNumber.trim()) errors.value.cadastralNumber = 'Укажите кадастровый номер'
  if (!form.value.cadastralValue || form.value.cadastralValue <= 0) {
    errors.value.cadastralValue = 'Укажите кадастровую стоимость'
  }
  return Object.keys(errors.value).length === 0
}

async function submit() {
  if (!property.value || !validate()) return
  const payload = {
    ...form.value,
    purchasePrice: form.value.purchasePrice && form.value.purchasePrice > 0
      ? form.value.purchasePrice
      : undefined,
  }
  const ok = isEdit.value && editingParcel.value
    ? await store.updateCadastralParcel(editingParcel.value.id, payload)
    : await store.addCadastralParcel(property.value.id, payload)
  if (!ok) {
    errors.value.cadastralNumber = store.lastError || 'Не удалось сохранить — проверьте данные'
  }
}

async function onDelete() {
  if (!editingParcel.value || deleting.value) return
  const spacesCount = store.getSpacesForParcel(editingParcel.value.id).length
  const spacesNote = spacesCount
    ? `\n\nПомещения (${spacesCount}) останутся на объекте, но будут без кадастра.`
    : ''
  if (!confirm(`Удалить кадастровый номер ${editingParcel.value.cadastralNumber}?${spacesNote}`)) return
  deleting.value = true
  const ok = await store.removeCadastralParcel(editingParcel.value.id)
  deleting.value = false
  if (!ok) {
    errors.value.cadastralNumber = store.lastError || 'Не удалось удалить кадастр'
  }
}

function onClose() {
  store.closeCadastralModal()
}
</script>

<template>
  <Modal
    :open="store.cadastralModalOpen && !!property"
    :title="isEdit ? 'Редактировать кадастровый номер' : 'Добавить кадастровый номер'"
    size="lg"
    :z-index="110"
    @close="onClose"
  >
    <div v-if="property" class="space-y-4">
      <p class="text-sm text-slate-500">
        {{ property.address }} · общая площадь {{ store.formatArea(property.totalArea) }}
      </p>

      <div>
        <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Кадастровый номер</label>
        <input
          v-model="form.cadastralNumber"
          type="text"
          placeholder="77:01:0004012:1670"
          :class="[inputClass, 'font-mono', { 'border-red-500': errors.cadastralNumber }]"
        />
        <p v-if="errors.cadastralNumber" class="text-xs text-red-400 mt-1">{{ errors.cadastralNumber }}</p>
      </div>

      <div v-if="isEdit" class="rounded-lg border border-border bg-panel/30 px-3 py-2">
        <p class="text-xs text-slate-500">
          Площадь по кадастру:
          <span class="font-mono text-emerald-brand">{{ store.formatArea(computedArea) }}</span>
          — считается автоматически по привязанным помещениям
        </p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Кадастровая стоимость</label>
          <div class="relative">
            <input
              v-model.number="form.cadastralValue"
              type="number"
              min="1"
              :class="[inputClass, 'font-mono pr-6', { 'border-red-500': errors.cadastralValue }]"
            />
            <span class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">₽</span>
          </div>
          <p v-if="errors.cadastralValue" class="text-xs text-red-400 mt-1">{{ errors.cadastralValue }}</p>
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">
            Цена покупки
            <span class="text-slate-600 normal-case">(необязательно)</span>
          </label>
          <div class="relative">
            <input
              v-model.number="form.purchasePrice"
              type="number"
              min="0"
              :class="[inputClass, 'font-mono pr-6']"
            />
            <span class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">₽</span>
          </div>
        </div>
      </div>

      <p class="text-xs text-slate-500 rounded-lg border border-border bg-panel/30 px-3 py-2">
        Площадь кадастра не задаётся вручную — привяжите помещения в разделе «Кадастр», и площадь пересчитается автоматически.
      </p>
    </div>

    <template #footer>
      <button
        v-if="isEdit"
        type="button"
        class="mr-auto text-sm text-rose-400 hover:text-rose-300 disabled:opacity-40"
        :disabled="deleting"
        @click="onDelete"
      >
        {{ deleting ? 'Удаление...' : 'Удалить' }}
      </button>
      <button type="button" class="panel-btn-secondary" @click="onClose">Отмена</button>
      <button type="button" class="panel-btn-primary" @click="submit">Сохранить</button>
    </template>
  </Modal>
</template>
