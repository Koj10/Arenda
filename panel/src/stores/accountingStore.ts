import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Expense, ExpenseFormData, ExpenseDocument, ExpenseCategory } from '@/types/accounting'
import type { PendingDocument } from '@/types/portfolio'
import { formatApiError, getAccessToken } from '@/api/http'
import { dataUrlToBlob, uploadFileApi } from '@/api/auth'
import { createTransaction, listTransactions } from '@/api/landlord'
import { num } from '@/api/types'

const CATEGORIES: ExpenseCategory[] = ['utilities', 'maintenance', 'tax', 'insurance', 'management', 'other']

function asCategory(value: string): ExpenseCategory {
  return CATEGORIES.includes(value as ExpenseCategory) ? (value as ExpenseCategory) : 'other'
}

function toExpenseDocuments(docs: PendingDocument[]): ExpenseDocument[] {
  return docs.map((d) => ({
    id: Date.now() + Math.random(),
    name: d.name,
    mimeType: d.mimeType,
    size: d.size,
    dataUrl: d.dataUrl,
    uploadedAt: new Date().toISOString(),
  }))
}

export const useAccountingStore = defineStore('accounting', () => {
  const expenses = ref<Expense[]>([])
  const lastError = ref<string | null>(null)

  const expenseModalOpen = ref(false)
  const expenseDetailOpen = ref(false)
  const expenseDetailId = ref<number | null>(null)

  const totalAmount = computed(() => expenses.value.reduce((s, e) => s + e.amount, 0))

  const currentMonthTotal = computed(() => {
    const now = new Date()
    const month = now.getMonth()
    const year = now.getFullYear()
    return expenses.value
      .filter((e) => {
        const d = new Date(e.date)
        return d.getMonth() === month && d.getFullYear() === year
      })
      .reduce((s, e) => s + e.amount, 0)
  })

  function getExpenseById(id: number) {
    return expenses.value.find((e) => e.id === id)
  }

  function formatMoney(value: number) {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value)
  }

  function formatDate(date: string) {
    return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date))
  }

  function reset() {
    expenses.value = []
    lastError.value = null
  }

  async function loadFromApi() {
    if (!getAccessToken()) return
    lastError.value = null
    try {
      const rows = await listTransactions({ type: 'expense' })
      expenses.value = rows.map((row) => ({
        id: row.id,
        date: row.transaction_date,
        amount: num(row.amount),
        category: asCategory(row.category),
        title: row.title,
        note: row.comment ?? '',
        propertyId: row.object_id ?? null,
        documents: [],
      }))
    } catch (err) {
      lastError.value = formatApiError(err, 'Не удалось загрузить транзакции')
    }
  }

  async function addExpense(data: ExpenseFormData) {
    lastError.value = null
    try {
      const fileIds: number[] = []
      for (const doc of data.documents) {
        const uploaded = await uploadFileApi(dataUrlToBlob(doc.dataUrl, doc.mimeType), {
          filename: doc.name,
          kind: 'supporting',
          linked_type: 'transaction',
        })
        fileIds.push(uploaded.id)
      }
      const created = await createTransaction({
        type: 'expense',
        title: data.title.trim(),
        amount: data.amount,
        category: data.category,
        object_id: data.propertyId,
        comment: data.note || null,
        transaction_date: data.date,
        file_ids: fileIds.length ? fileIds : undefined,
      })
      expenses.value.unshift({
        id: created.id,
        date: created.transaction_date,
        amount: num(created.amount),
        category: asCategory(created.category),
        title: created.title,
        note: created.comment ?? data.note,
        propertyId: created.object_id ?? data.propertyId,
        documents: toExpenseDocuments(data.documents),
      })
      expenseModalOpen.value = false
      return true
    } catch (err) {
      lastError.value = formatApiError(err, 'Не удалось сохранить расход')
      return false
    }
  }

  function updateExpense(id: number, data: Partial<Omit<Expense, 'id' | 'documents'>>) {
    const expense = getExpenseById(id)
    if (!expense) return
    Object.assign(expense, data)
  }

  function removeExpense(id: number) {
    expenses.value = expenses.value.filter((e) => e.id !== id)
    if (expenseDetailId.value === id) closeExpenseDetail()
  }

  function addExpenseDocument(expenseId: number, doc: PendingDocument) {
    const expense = getExpenseById(expenseId)
    if (!expense) return
    expense.documents.push({
      id: Date.now() + Math.random(),
      name: doc.name,
      mimeType: doc.mimeType,
      size: doc.size,
      dataUrl: doc.dataUrl,
      uploadedAt: new Date().toISOString(),
    })
  }

  function removeExpenseDocument(expenseId: number, documentId: number) {
    const expense = getExpenseById(expenseId)
    if (!expense) return
    expense.documents = expense.documents.filter((d) => d.id !== documentId)
  }

  function openExpenseModal() {
    expenseModalOpen.value = true
  }

  function closeExpenseModal() {
    expenseModalOpen.value = false
  }

  function openExpenseDetail(id: number) {
    expenseDetailId.value = id
    expenseDetailOpen.value = true
  }

  function closeExpenseDetail() {
    expenseDetailOpen.value = false
    expenseDetailId.value = null
  }

  return {
    expenses,
    lastError,
    expenseModalOpen,
    expenseDetailOpen,
    expenseDetailId,
    totalAmount,
    currentMonthTotal,
    getExpenseById,
    formatMoney,
    formatDate,
    loadFromApi,
    reset,
    addExpense,
    updateExpense,
    removeExpense,
    addExpenseDocument,
    removeExpenseDocument,
    openExpenseModal,
    closeExpenseModal,
    openExpenseDetail,
    closeExpenseDetail,
  }
})
