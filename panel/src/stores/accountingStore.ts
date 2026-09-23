import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Expense, ExpenseFormData, ExpenseDocument, ExpenseCategory } from '@/types/accounting'
import type { PendingDocument } from '@/types/portfolio'
import { formatApiError, getAccessToken } from '@/api/http'
import { dataUrlToBlob, fileDisplayName, uploadFileApi } from '@/api/auth'
import {
  createTransaction,
  deleteTransaction,
  getLandlordAnalytics,
  getTransaction,
  listTransactions,
  updateTransaction,
} from '@/api/landlord'
import { num } from '@/api/types'
import type { FileOut } from '@/api/types'
import { currentPeriod, formatDateRu, parseDateOnly } from '@/utils/dates'

const CATEGORIES: ExpenseCategory[] = ['utilities', 'maintenance', 'tax', 'insurance', 'management', 'other']

export interface AnalyticsCards {
  income: number
  expenses: number
  profit: number
  rentAccrued: number
  utilityAccrued: number
  invoicesPending: number
  invoicesOverdue: number
  occupancyPercent: number
}

export interface CashflowPoint {
  date: string
  income: number
  expense: number
  profit: number
}

export interface ExpenseBreakdownRow {
  category: string
  amount: number
}

export interface RevenueComparison {
  currentPeriod: string
  previousPeriod: string
  current: number
  previous: number
  difference: number
  percentChange: number
}

export interface LandlordAnalytics {
  period: string
  cards: AnalyticsCards
  cashflow: CashflowPoint[]
  expenseBreakdown: ExpenseBreakdownRow[]
  revenueComparison: RevenueComparison
}

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

function filesToExpenseDocs(files?: FileOut[]): ExpenseDocument[] {
  return (files ?? []).map((file) => ({
    id: file.id,
    name: fileDisplayName(file),
    mimeType: file.mime_type || 'application/octet-stream',
    size: file.size ?? 0,
    uploadedAt: file.created_at || new Date().toISOString(),
  }))
}

function mapAnalytics(raw: Awaited<ReturnType<typeof getLandlordAnalytics>>): LandlordAnalytics {
  return {
    period: raw.period,
    cards: {
      income: num(raw.cards.income),
      expenses: num(raw.cards.expenses),
      profit: num(raw.cards.profit),
      rentAccrued: num(raw.cards.rent_accrued),
      utilityAccrued: num(raw.cards.utility_accrued),
      invoicesPending: num(raw.cards.invoices_pending),
      invoicesOverdue: num(raw.cards.invoices_overdue),
      occupancyPercent: raw.cards.occupancy_percent ?? 0,
    },
    cashflow: (raw.cashflow ?? []).map((row) => ({
      date: row.date,
      income: num(row.income),
      expense: num(row.expense),
      profit: num(row.profit),
    })),
    expenseBreakdown: (raw.expense_breakdown ?? []).map((row) => ({
      category: row.category,
      amount: num(row.amount),
    })),
    revenueComparison: {
      currentPeriod: raw.revenue_comparison.current_period,
      previousPeriod: raw.revenue_comparison.previous_period,
      current: num(raw.revenue_comparison.current),
      previous: num(raw.revenue_comparison.previous),
      difference: num(raw.revenue_comparison.difference),
      percentChange: raw.revenue_comparison.percent_change ?? 0,
    },
  }
}

export const useAccountingStore = defineStore('accounting', () => {
  const expenses = ref<Expense[]>([])
  const analytics = ref<LandlordAnalytics | null>(null)
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
        const d = parseDateOnly(e.date)
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
    return formatDateRu(date)
  }

  function syncPropertyExpenses() {
    void import('@/stores/portfolioStore').then(({ usePortfolioStore }) => {
      const portfolio = usePortfolioStore()
      const totals = new Map<number, number>()
      for (const e of expenses.value) {
        if (e.propertyId) totals.set(e.propertyId, (totals.get(e.propertyId) ?? 0) + e.amount)
      }
      for (const p of portfolio.properties) {
        p.expense = totals.get(p.id) ?? 0
      }
    })
  }

  function reset() {
    expenses.value = []
    analytics.value = null
    lastError.value = null
  }

  async function loadAnalytics() {
    if (!getAccessToken()) return
    try {
      analytics.value = mapAnalytics(await getLandlordAnalytics(currentPeriod()))
    } catch (err) {
      lastError.value = formatApiError(err, 'Не удалось загрузить аналитику')
    }
  }

  async function loadFromApi() {
    if (!getAccessToken()) return
    lastError.value = null
    try {
      const rows = await listTransactions({ type: 'expense' })
      expenses.value = await Promise.all(rows.map(async (row) => {
        let files = row.files
        if (!files?.length) {
          try {
            files = (await getTransaction(row.id)).files
          } catch {
            files = []
          }
        }
        return {
          id: row.id,
          date: row.transaction_date,
          amount: num(row.amount),
          category: asCategory(row.category),
          title: row.title,
          note: row.comment ?? '',
          propertyId: row.object_id ?? null,
          documents: filesToExpenseDocs(files),
        }
      }))
      syncPropertyExpenses()
      await loadAnalytics()
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
        documents: filesToExpenseDocs(created.files).length
          ? filesToExpenseDocs(created.files)
          : toExpenseDocuments(data.documents),
      })
      expenseModalOpen.value = false
      syncPropertyExpenses()
      void loadAnalytics()
      return true
    } catch (err) {
      lastError.value = formatApiError(err, 'Не удалось сохранить расход')
      return false
    }
  }

  async function updateExpense(id: number, data: Partial<Omit<Expense, 'id' | 'documents'>>) {
    const expense = getExpenseById(id)
    if (!expense) return false
    lastError.value = null
    try {
      const updated = await updateTransaction(id, {
        title: data.title,
        amount: data.amount,
        category: data.category,
        object_id: data.propertyId,
        comment: data.note,
        transaction_date: data.date,
      })
      Object.assign(expense, {
        title: updated.title,
        amount: num(updated.amount),
        category: asCategory(updated.category),
        propertyId: updated.object_id ?? null,
        note: updated.comment ?? '',
        date: updated.transaction_date,
        ...data,
      })
      syncPropertyExpenses()
      void loadAnalytics()
      return true
    } catch (err) {
      lastError.value = formatApiError(err, 'Не удалось сохранить расход')
      return false
    }
  }

  async function removeExpense(id: number) {
    lastError.value = null
    try {
      await deleteTransaction(id)
      expenses.value = expenses.value.filter((e) => e.id !== id)
      if (expenseDetailId.value === id) closeExpenseDetail()
      syncPropertyExpenses()
      void loadAnalytics()
      return true
    } catch (err) {
      lastError.value = formatApiError(err, 'Не удалось удалить расход')
      return false
    }
  }

  async function addExpenseDocument(expenseId: number, doc: PendingDocument) {
    const expense = getExpenseById(expenseId)
    if (!expense) return false
    lastError.value = null
    try {
      const uploaded = await uploadFileApi(dataUrlToBlob(doc.dataUrl, doc.mimeType), {
        filename: doc.name,
        kind: 'supporting',
        linked_type: 'transaction',
        linked_id: expenseId,
      })
      const fileIds = [...expense.documents.map((item) => item.id), uploaded.id]
      await updateTransaction(expenseId, { file_ids: fileIds })
      expense.documents.push({
        id: uploaded.id,
        name: fileDisplayName(uploaded) || doc.name,
        mimeType: uploaded.mime_type || doc.mimeType,
        size: uploaded.size ?? doc.size,
        dataUrl: doc.dataUrl,
        uploadedAt: uploaded.created_at || new Date().toISOString(),
      })
      return true
    } catch (err) {
      lastError.value = formatApiError(err, 'Не удалось сохранить файл')
      return false
    }
  }

  async function removeExpenseDocument(expenseId: number, documentId: number) {
    const expense = getExpenseById(expenseId)
    if (!expense) return
    lastError.value = null
    try {
      const fileIds = expense.documents.filter((item) => item.id !== documentId).map((item) => item.id)
      await updateTransaction(expenseId, { file_ids: fileIds })
    } catch (err) {
      lastError.value = formatApiError(err, 'Не удалось отвязать файл')
    }
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
    analytics,
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
    loadAnalytics,
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
    syncPropertyExpenses,
  }
})
