<script setup lang="ts">
import { computed } from 'vue'
import { MapPin, Trash2 } from '@lucide/vue'
import Modal from '@/components/ui/Modal.vue'
import ExpenseDocuments from '@/components/accounting/ExpenseDocuments.vue'
import { useAccountingStore } from '@/stores/accountingStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { EXPENSE_CATEGORY_LABELS } from '@/types/accounting'
import type { PendingDocument } from '@/types/portfolio'

const accounting = useAccountingStore()
const portfolio = usePortfolioStore()

const expense = computed(() =>
  accounting.expenseDetailId ? accounting.getExpenseById(accounting.expenseDetailId) : null,
)

const propertyLabel = computed(() => {
  if (!expense.value?.propertyId) return 'Общий расход'
  return portfolio.getPropertyById(expense.value.propertyId)?.address ?? '—'
})

function onClose() {
  accounting.closeExpenseDetail()
}

function onDelete() {
  if (!expense.value) return
  if (confirm('Удалить этот расход?')) {
    accounting.removeExpense(expense.value.id)
  }
}

function onDocUpload(doc: PendingDocument) {
  if (!expense.value) return
  accounting.addExpenseDocument(expense.value.id, doc)
}

function onDocRemove(_index: number, documentId?: number) {
  if (!expense.value || documentId == null) return
  accounting.removeExpenseDocument(expense.value.id, documentId)
}
</script>

<template>
  <Modal
    :open="accounting.expenseDetailOpen && !!expense"
    :title="expense?.title ?? 'Расход'"
    size="lg"
    @close="onClose"
  >
    <template v-if="expense">
      <div class="flex flex-wrap items-center gap-2 mb-5 pb-4 border-b border-border">
        <span class="inline-flex px-2.5 py-1 rounded-lg bg-panel text-xs text-slate-300">
          {{ EXPENSE_CATEGORY_LABELS[expense.category] }}
        </span>
        <span class="text-xs text-slate-500 font-mono">{{ accounting.formatDate(expense.date) }}</span>
      </div>

      <div class="grid sm:grid-cols-2 gap-4 mb-5">
        <div>
          <p class="text-xs text-slate-500 mb-1">Сумма</p>
          <p class="text-2xl font-mono text-rose-400">{{ accounting.formatMoney(expense.amount) }}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500 mb-1">Объект</p>
          <p class="text-sm text-slate-200 flex items-start gap-1.5">
            <MapPin v-if="expense.propertyId" class="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            {{ propertyLabel }}
          </p>
        </div>
      </div>

      <div v-if="expense.note" class="mb-5 rounded-xl border border-border bg-panel/40 p-4">
        <p class="text-xs text-slate-500 mb-1">Комментарий</p>
        <p class="text-sm text-slate-300">{{ expense.note }}</p>
      </div>

      <ExpenseDocuments
        :documents="expense.documents"
        label="Подтверждающие документы"
        @upload="onDocUpload"
        @remove="onDocRemove"
      />
    </template>

    <template #footer>
      <button
        type="button"
        class="panel-btn-danger mr-auto"
        @click="onDelete"
      >
        <Trash2 class="w-4 h-4" />
        Удалить
      </button>
      <button type="button" class="panel-btn-secondary" @click="onClose">
        Закрыть
      </button>
    </template>
  </Modal>
</template>
