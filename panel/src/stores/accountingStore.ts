import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Expense, ExpenseFormData, ExpenseDocument } from '@/types/accounting'
import type { PendingDocument } from '@/types/portfolio'

const initialExpenses: Expense[] = [
  {
    id: 1,
    date: '2026-07-01',
    amount: 85000,
    category: 'utilities',
    title: 'Электроэнергия — Тверская 12',
    note: 'Счёт за июнь',
    propertyId: 1,
    documents: [],
  },
  {
    id: 2,
    date: '2026-07-05',
    amount: 42000,
    category: 'maintenance',
    title: 'Замена фильтров вентиляции',
    note: 'Подрядчик ООО «КлиматСервис»',
    propertyId: 2,
    documents: [],
  },
  {
    id: 3,
    date: '2026-07-10',
    amount: 156000,
    category: 'tax',
    title: 'Налог на имущество',
    note: 'Квартальный платёж',
    propertyId: null,
    documents: [],
  },
  {
    id: 4,
    date: '2026-07-15',
    amount: 28000,
    category: 'insurance',
    title: 'Страховой полис склада',
    note: 'Садовническая 82',
    propertyId: 4,
    documents: [],
  },
]

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
  const expenses = ref<Expense[]>([...initialExpenses])

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

  function addExpense(data: ExpenseFormData) {
    expenses.value.unshift({
      id: Date.now(),
      date: data.date,
      amount: data.amount,
      category: data.category,
      title: data.title,
      note: data.note,
      propertyId: data.propertyId,
      documents: toExpenseDocuments(data.documents),
    })
    expenseModalOpen.value = false
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
    expenseModalOpen,
    expenseDetailOpen,
    expenseDetailId,
    totalAmount,
    currentMonthTotal,
    getExpenseById,
    formatMoney,
    formatDate,
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
