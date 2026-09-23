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

const sourceArea = computed(() =>
  sourceParcel.value?.area || property.value?.totalArea || 0,
)

const firstArea = computed(() => Number(form.value.firstArea) || 0)
const secondArea = computed(() => Number(form.value.secondArea) || 0)
const allocatedArea = computed(() => roundArea(firstArea.value + secondArea.value))
const remainingArea = computed(() => roundArea(sourceArea.value - allocatedArea.value))

function roundArea(value: number) {
  return Math.round(value * 100) / 100
}

function fillOtherArea(edited: 'first' | 'second') {
  if (sourceArea.value <= 0) return
  if (edited === 'first') {
    const rest = roundArea(sourceArea.value - firstArea.value)
    form.value.secondArea = rest > 0 ? rest : 0
  } else {
    const rest = roundArea(sourceArea.value - secondArea.value)
    form.value.firstArea = rest > 0 ? rest : 0
  }
}

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

  const firstNumber = form.value.firstCadastralNumber.trim()
  const secondNumber = form.value.newCadastralNumber.trim()
  if (!firstNumber) errors.value.firstCadastralNumber = 'Укажите кадастровый номер'
  if (!secondNumber) errors.value.newCadastralNumber = 'Укажите кадастровый номер'
  const originalNumber = sourceParcel.value.cadastralNumber.trim()
  if (firstNumber && firstNumber === originalNumber) {
    errors.value.firstCadastralNumber = 'Нужен новый номер, исходный после раздела не сохраняется'
  }
  if (secondNumber && secondNumber === originalNumber) {
    errors.value.newCadastralNumber = 'Нужен новый номер, исходный после раздела не сохраняется'
  }
  if (firstNumber && secondNumber && firstNumber === secondNumber) {
    errors.value.newCadastralNumber = 'Номера должны отличаться'
  }

  const others = store
    .getCadastralParcelsForProperty(sourceParcel.value.propertyId)
    .filter((p) => p.id !== sourceParcel.value!.id)
    .map((p) => p.cadastralNumber.trim())
  if (firstNumber && others.includes(firstNumber)) {
    errors.value.firstCadastralNumber = 'Такой номер уже есть у объекта'
  }
  if (secondNumber && others.includes(secondNumber)) {
    errors.value.newCadastralNumber = 'Такой номер уже есть у объекта'
  }

  if (!form.value.firstCadastralValue || form.value.firstCadastralValue <= 0) {
    errors.value.firstCadastralValue = 'Укажите новую кадастровую стоимость'
  }
  if (!form.value.secondCadastralValue || form.value.secondCadastralValue <= 0) {
    errors.value.secondCadastralValue = 'Укажите новую кадастровую стоимость'
  }

  if (firstArea.value <= 0) errors.value.firstArea = 'Укажите площадь'
  if (secondArea.value <= 0) errors.value.secondArea = 'Укажите площадь'
  if (sourceArea.value > 0 && firstArea.value > 0 && secondArea.value > 0) {
    if (Math.abs(allocatedArea.value - sourceArea.value) > 0.01) {
      const message = `Сумма площадей должна быть ${store.formatArea(sourceArea.value)}`
      errors.value.firstArea = message
      errors.value.secondArea = message
    }
  }

  return Object.keys(errors.value).length === 0
}

async function submit() {
  if (!sourceParcel.value || !validate()) return
  const ok = await store.splitCadastralParcel(sourceParcel.value.id, {
    ...form.value,
    firstPurchasePrice: form.value.firstPurchasePrice && form.value.firstPurchasePrice > 0
      ? form.value.firstPurchasePrice
      : undefined,
    secondPurchasePrice: form.value.secondPurchasePrice && form.value.secondPurchasePrice > 0
      ? form.value.secondPurchasePrice
      : undefined,
  })
  if (!ok) {
    errors.value.submit = store.lastError || 'Не удалось разделить — проверьте данные'
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
          Исходный номер <span class="font-mono">{{ sourceParcel.cadastralNumber }}</span> после раздела
          перестанет действовать. Укажите два новых кадастровых номера, площадь и стоимость каждого.
          <template v-if="sourceArea > 0"> Сумма площадей должна быть {{ store.formatArea(sourceArea) }}.</template>
        </p>
      </div>

      <div class="grid md:grid-cols-2 gap-4">
        <section class="rounded-xl border border-border bg-panel/30 p-4 space-y-3">
          <h3 class="text-sm font-semibold text-white">1. Первый новый кадастр</h3>
          <p class="text-xs text-slate-500">Помещения пока остаются на этом участке</p>

          <div>
            <label class="block text-xs text-slate-500 mb-1">Кадастровый номер</label>
            <input
              v-model="form.firstCadastralNumber"
              type="text"
              placeholder="77:01:0004012:1670"
              :class="[inputClass, 'font-mono', { 'border-red-500': errors.firstCadastralNumber }]"
            />
            <p v-if="errors.firstCadastralNumber" class="text-xs text-red-400 mt-1">{{ errors.firstCadastralNumber }}</p>
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1">Площадь, м²</label>
            <input
              v-model.number="form.firstArea"
              type="number"
              min="0.01"
              step="0.01"
              :class="[inputClass, 'font-mono', { 'border-red-500': errors.firstArea }]"
              @input="fillOtherArea('first')"
            />
            <p v-if="errors.firstArea" class="text-xs text-red-400 mt-1">{{ errors.firstArea }}</p>
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1">Новая кадастровая стоимость, ₽</label>
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
          <h3 class="text-sm font-semibold text-white">2. Второй новый кадастр</h3>
          <p class="text-xs text-slate-500">
            После разделения перетащите сюда нужные помещения.
          </p>

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
          <div>
            <label class="block text-xs text-slate-500 mb-1">Площадь, м²</label>
            <input
              v-model.number="form.secondArea"
              type="number"
              min="0.01"
              step="0.01"
              :class="[inputClass, 'font-mono', { 'border-red-500': errors.secondArea }]"
              @input="fillOtherArea('second')"
            />
            <p v-if="errors.secondArea" class="text-xs text-red-400 mt-1">{{ errors.secondArea }}</p>
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1">Новая кадастровая стоимость, ₽</label>
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

      <p
        v-if="sourceArea > 0"
        class="text-xs font-mono"
        :class="Math.abs(remainingArea) <= 0.01 ? 'text-emerald-brand' : 'text-amber-400'"
      >
        Распределено {{ store.formatArea(allocatedArea) }} из {{ store.formatArea(sourceArea) }}
        <template v-if="Math.abs(remainingArea) > 0.01">
          · осталось {{ store.formatArea(Math.abs(remainingArea)) }}
          {{ remainingArea < 0 ? 'сверх исходной' : '' }}
        </template>
      </p>
      <p v-if="errors.submit" class="text-sm text-rose-400">{{ errors.submit }}</p>
    </div>

    <template #footer>
      <button type="button" class="panel-btn-secondary" @click="onClose">Отмена</button>
      <button type="button" class="panel-btn-primary" @click="submit">
        Разделить на два номера
      </button>
    </template>
  </Modal>
</template>
