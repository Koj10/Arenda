<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { createSplitCadastralFormData } from '@/types/portfolio'
import Modal from '@/components/ui/Modal.vue'

const store = usePortfolioStore()

const form = ref(createSplitCadastralFormData({
  id: 0,
  propertyId: 0,
  cadastralNumber: '',
  area: 0,
  cadastralValue: 0,
}))

const errors = ref<Record<string, string>>({})
const inputClass = 'panel-input'

const sourceParcel = computed(() =>
  store.splitCadastralParcelId ? store.getCadastralParcelById(store.splitCadastralParcelId) : null,
)

const property = computed(() =>
  sourceParcel.value ? store.getPropertyById(sourceParcel.value.propertyId) : null,
)

const spacesOnParcel = computed(() =>
  sourceParcel.value ? store.getSpacesForParcel(sourceParcel.value.id).length : 0,
)

watch(
  () => store.splitCadastralModalOpen,
  (open) => {
    if (!open || !sourceParcel.value) return
    form.value = createSplitCadastralFormData(sourceParcel.value)
    errors.value = {}
  },
)

function validate() {
  errors.value = {}
  if (!sourceParcel.value) return false

  if (!form.value.newCadastralNumber.trim()) errors.value.newCadastralNumber = 'Укажите номер второго участка'
  if (form.value.firstCadastralValue <= 0) errors.value.firstCadastralValue = 'Укажите стоимость'
  if (form.value.secondCadastralValue <= 0) errors.value.secondCadastralValue = 'Укажите стоимость'

  return Object.keys(errors.value).length === 0
}

function submit() {
  if (!sourceParcel.value || !validate()) return
  const ok = store.splitCadastralParcel(sourceParcel.value.id, {
    ...form.value,
    firstPurchasePrice: form.value.firstPurchasePrice && form.value.firstPurchasePrice > 0
      ? form.value.firstPurchasePrice
      : undefined,
    secondPurchasePrice: form.value.secondPurchasePrice && form.value.secondPurchasePrice > 0
      ? form.value.secondPurchasePrice
      : undefined,
  })
  if (!ok) {
    errors.value.newCadastralNumber = 'Не удалось разделить — проверьте данные'
  }
}

function onClose() {
  store.closeSplitCadastralModal()
}
</script>

<template>
  <Modal
    :open="store.splitCadastralModalOpen && !!sourceParcel && !!property"
    title="Разделить кадастровый номер на два"
    size="xl"
    :z-index="120"
    @close="onClose"
  >
    <div v-if="sourceParcel && property" class="space-y-5">
      <div class="rounded-xl border border-emerald-brand/30 bg-emerald-brand/5 px-4 py-3 text-sm text-slate-300">
        <p class="font-medium text-white mb-1">{{ property.address }}</p>
        <p>
          Номер <span class="font-mono">{{ sourceParcel.cadastralNumber }}</span>
          сейчас <span class="font-mono text-emerald-brand">{{ store.formatArea(sourceParcel.area) }}</span>
          ({{ spacesOnParcel }} пом.).
          Укажите кадастровые стоимости для двух номеров — площадь каждого считается по привязанным помещениям.
        </p>
      </div>

      <div class="grid md:grid-cols-2 gap-4">
        <section class="rounded-xl border border-border bg-panel/30 p-4 space-y-3">
          <h3 class="text-sm font-semibold text-white">1. Первый номер (остаётся)</h3>
          <p class="text-xs font-mono text-slate-400">{{ sourceParcel.cadastralNumber }}</p>
          <p class="text-xs text-slate-500">
            Площадь: {{ store.formatArea(sourceParcel.area) }} · помещения остаются здесь
          </p>

          <div>
            <label class="block text-xs text-slate-500 mb-1">Кадастровая стоимость, ₽</label>
            <input
              v-model.number="form.firstCadastralValue"
              type="number"
              min="1"
              :class="[inputClass, 'font-mono', { 'border-red-500': errors.firstCadastralValue }]"
            />
            <p v-if="errors.firstCadastralValue" class="text-xs text-red-400 mt-1">{{ errors.firstCadastralValue }}</p>
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1">Цена покупки (необяз.)</label>
            <input v-model.number="form.firstPurchasePrice" type="number" min="0" :class="[inputClass, 'font-mono']" />
          </div>
        </section>

        <section class="rounded-xl border border-border bg-panel/30 p-4 space-y-3">
          <h3 class="text-sm font-semibold text-white">2. Второй номер (новый)</h3>

          <div>
            <label class="block text-xs text-slate-500 mb-1">Кадастровый номер</label>
            <input
              v-model="form.newCadastralNumber"
              type="text"
              placeholder="77:01:0004012:1680"
              :class="[inputClass, 'font-mono', { 'border-red-500': errors.newCadastralNumber }]"
            />
            <p v-if="errors.newCadastralNumber" class="text-xs text-red-400 mt-1">{{ errors.newCadastralNumber }}</p>
          </div>
          <p class="text-xs text-slate-500">
            После разделения перетащите нужные помещения во второй номер — его площадь пересчитается автоматически.
          </p>
          <div>
            <label class="block text-xs text-slate-500 mb-1">Кадастровая стоимость, ₽</label>
            <input
              v-model.number="form.secondCadastralValue"
              type="number"
              min="1"
              :class="[inputClass, 'font-mono', { 'border-red-500': errors.secondCadastralValue }]"
            />
            <p v-if="errors.secondCadastralValue" class="text-xs text-red-400 mt-1">{{ errors.secondCadastralValue }}</p>
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1">Цена покупки (необяз.)</label>
            <input v-model.number="form.secondPurchasePrice" type="number" min="0" :class="[inputClass, 'font-mono']" />
          </div>
        </section>
      </div>
    </div>

    <template #footer>
      <button type="button" class="panel-btn-secondary" @click="onClose">Отмена</button>
      <button type="button" class="panel-btn-primary" @click="submit">
        Разделить на два номера
      </button>
    </template>
  </Modal>
</template>
