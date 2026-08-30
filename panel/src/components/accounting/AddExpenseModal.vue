<script setup lang="ts">
import { ref } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import ExpenseDocuments from '@/components/accounting/ExpenseDocuments.vue'
import { useAccountingStore } from '@/stores/accountingStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import type { ExpenseCategory } from '@/types/accounting'
import { EXPENSE_CATEGORY_LABELS, createEmptyExpenseForm } from '@/types/accounting'
import type { PendingDocument } from '@/types/portfolio'

const accounting = useAccountingStore()
const portfolio = usePortfolioStore()

const form = ref(createEmptyExpenseForm())
const errors = ref<Record<string, string>>({})

const categories = Object.entries(EXPENSE_CATEGORY_LABELS) as [ExpenseCategory, string][]

const inputClass =
  'panel-input'

function resetForm() {
  form.value = createEmptyExpenseForm()
  errors.value = {}
}

function validate() {
  errors.value = {}
  if (!form.value.title.trim()) errors.value.title = 'Укажите название'
  if (form.value.amount <= 0) errors.value.amount = 'Укажите сумму'
  if (!form.value.date) errors.value.date = 'Укажите дату'
  return Object.keys(errors.value).length === 0
}

async function submit() {
  if (!validate()) return
  const ok = await accounting.addExpense({ ...form.value })
  if (!ok) {
    errors.value.title = accounting.lastError || 'Не удалось сохранить расход'
    return
  }
  resetForm()
}

function onClose() {
  accounting.closeExpenseModal()
  resetForm()
}

function onDocUpload(doc: PendingDocument) {
  form.value.documents = [...form.value.documents, doc]
}

function onDocRemove(index: number) {
  form.value.documents = form.value.documents.filter((_, i) => i !== index)
}
</script>

<template>
  <Modal :open="accounting.expenseModalOpen" title="Добавить расход" size="lg" @close="onClose">
    <div class="space-y-4">
      <div>
        <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Название</label>
        <input
          v-model="form.title"
          type="text"
          placeholder="Электроэнергия, ремонт лифта..."
          :class="[inputClass, { 'border-red-500': errors.title }]"
        />
        <p v-if="errors.title" class="text-xs text-red-400 mt-1">{{ errors.title }}</p>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Сумма, ₽</label>
          <input
            v-model.number="form.amount"
            type="number"
            min="1"
            :class="[inputClass, 'font-mono', { 'border-red-500': errors.amount }]"
          />
          <p v-if="errors.amount" class="text-xs text-red-400 mt-1">{{ errors.amount }}</p>
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Дата</label>
          <input v-model="form.date" type="date" :class="[inputClass, { 'border-red-500': errors.date }]" />
          <p v-if="errors.date" class="text-xs text-red-400 mt-1">{{ errors.date }}</p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Категория</label>
          <select v-model="form.category" :class="inputClass">
            <option v-for="[key, label] in categories" :key="key" :value="key">{{ label }}</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Объект (необязательно)</label>
          <select v-model="form.propertyId" :class="inputClass">
            <option :value="null">Общий расход</option>
            <option v-for="p in portfolio.properties" :key="p.id" :value="p.id">{{ p.address }}</option>
          </select>
        </div>
      </div>

      <div>
        <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Комментарий</label>
        <textarea
          v-model="form.note"
          rows="2"
          placeholder="Дополнительные детали..."
          class="panel-input resize-none"
        />
      </div>

      <ExpenseDocuments
        :documents="form.documents"
        label="Подтверждающие документы"
        compact
        @upload="onDocUpload"
        @remove="onDocRemove"
      />
    </div>

    <template #footer>
      <button type="button" class="panel-btn-secondary" @click="onClose">Отмена</button>
      <button type="button" class="panel-btn-primary" @click="submit">Добавить</button>
    </template>
  </Modal>
</template>
