<script setup lang="ts">
import { ref } from 'vue'
import { usePortfolioStore } from '@/stores/portfolioStore'
import type { PropertyFormData, PropertyType } from '@/types/portfolio'
import { PROPERTY_TYPE_LABELS, PROPERTY_DOCUMENT_LABELS, createEmptyPropertyFormData } from '@/types/portfolio'
import Modal from '@/components/ui/Modal.vue'
import FileAttachments from '@/components/ui/FileAttachments.vue'

const store = usePortfolioStore()

const form = ref<PropertyFormData>(createEmptyPropertyFormData())
const errors = ref<Record<string, string>>({})

const types = Object.entries(PROPERTY_TYPE_LABELS) as [PropertyType, string][]

const inputClass = 'panel-input'

function resetForm() {
  form.value = createEmptyPropertyFormData()
  errors.value = {}
}

function validate() {
  errors.value = {}
  if (!form.value.address.trim()) errors.value.address = 'Укажите адрес'
  if (!form.value.cadastralNumber.trim()) errors.value.cadastralNumber = 'Укажите кадастровый номер'
  if (!form.value.totalArea || form.value.totalArea <= 0) errors.value.totalArea = 'Укажите общую площадь'
  if (!form.value.cadastralValue || form.value.cadastralValue <= 0) errors.value.cadastralValue = 'Укажите кадастровую стоимость'
  return Object.keys(errors.value).length === 0
}

function submit() {
  if (!validate()) return
  const purchasePrice = form.value.purchasePrice
  store.addProperty({
    ...form.value,
    purchasePrice: purchasePrice && purchasePrice > 0 ? purchasePrice : undefined,
  })
  resetForm()
}

function onClose() {
  store.closePropertyModal()
  resetForm()
}
</script>

<template>
  <Modal :open="store.propertyModalOpen" title="Добавить объект" size="lg" @close="onClose">
    <div class="space-y-4">
      <p class="text-sm text-slate-500">
        Укажите адрес и общие данные здания. Создаётся первый кадастровый номер на всю площадь — при разделении объекта добавьте номера на вкладке «Кадастр».
      </p>

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

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Тип</label>
          <select v-model="form.type" :class="inputClass">
            <option v-for="[key, label] in types" :key="key" :value="key">{{ label }}</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Общая площадь</label>
          <div class="relative">
            <input
              v-model.number="form.totalArea"
              type="number"
              min="1"
              placeholder="362"
              :class="[inputClass, 'font-mono pr-8', { 'border-red-500': errors.totalArea }]"
            />
            <span class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">м²</span>
          </div>
          <p v-if="errors.totalArea" class="text-xs text-red-400 mt-1">{{ errors.totalArea }}</p>
        </div>
      </div>

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

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Кадастровая стоимость</label>
          <div class="relative">
            <input
              v-model.number="form.cadastralValue"
              type="number"
              min="1"
              placeholder="50000000"
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
              placeholder="45000000"
              :class="[inputClass, 'font-mono pr-6']"
            />
            <span class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">₽</span>
          </div>
        </div>
      </div>

      <div class="space-y-4 pt-2 border-t border-border">
        <FileAttachments
          v-model="form.titleDocuments"
          entity-type="property"
          category="title"
          :label="PROPERTY_DOCUMENT_LABELS.title"
        />
        <FileAttachments
          v-model="form.serviceDocuments"
          entity-type="property"
          category="service"
          :label="PROPERTY_DOCUMENT_LABELS.service"
        />
      </div>
    </div>

    <template #footer>
      <button type="button" class="panel-btn-secondary" @click="onClose">Отмена</button>
      <button type="button" class="panel-btn-primary" @click="submit">Добавить</button>
    </template>
  </Modal>
</template>
