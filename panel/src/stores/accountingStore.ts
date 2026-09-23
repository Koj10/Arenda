import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Expense, ExpenseFormData, ExpenseDocument, ExpenseCategory } from '@/types/accounting'
import type { PendingDocument } from '@/types/portfolio'
import { formatApiError, getAccessToken } from '@/api/http'
import { dataUrlToBlob, fileDisplayName, uploadFileApi } from '@/api/auth'
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  listBillObjects,
  listLandlordInvoices,
  listObjectBills,
  listObjects,
  listTransactions,
  updateTransaction,
} from '@/api/landlord'
import { asList, num } from '@/api/types'
import type { FileOut, LandlordInvoiceOut, UtilityBillListItem } from '@/api/types'
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

function previousPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number)
  if (!year || !month) return period
  const date = new Date(year, month - 2, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function inMonth(value: string | null | undefined, period: string): boolean {
  if (!value) return false
  return String(value).slice(0, 7) === period
}

function isPaidInvoice(invoice: LandlordInvoiceOut): boolean {
  const status = (invoice.computed_status || invoice.status || '').toLowerCase()
  return status === 'paid' || Boolean(invoice.paid_at)
}

function paidInMonth(invoice: LandlordInvoiceOut, period: string): boolean {
  if (!isPaidInvoice(invoice)) return false
  if (invoice.paid_at) return inMonth(invoice.paid_at, period)
  return inMonth(invoice.period, period)
}

function billInPeriod(bill: UtilityBillListItem, period: string): boolean {
  return inMonth(bill.period, period) || (!bill.period && inMonth(bill.created_at, period))
}

function dayKey(value: string | null | undefined, fallback: string): string {
  const raw = String(value || '')
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  if (/^\d{4}-\d{2}$/.test(raw)) return `${raw}-01`
  return fallback
}

function emptyAnalytics(period: string): LandlordAnalytics {
  return {
    period,
    cards: {
      income: 0,
      expenses: 0,
      profit: 0,
      rentAccrued: 0,
      utilityAccrued: 0,
      invoicesPending: 0,
      invoicesOverdue: 0,
      occupancyPercent: 0,
    },
    cashflow: [],
    expenseBreakdown: [],
    revenueComparison: {
      currentPeriod: period,
      previousPeriod: previousPeriod(period),
      current: 0,
      previous: 0,
      difference: 0,
      percentChange: 0,
    },
  }
}

function paidIncome(invoices: LandlordInvoiceOut[], period: string): number {
  return invoices.filter((item) => paidInMonth(item, period)).reduce((sum, item) => sum + num(item.amount), 0)
}

function buildBusinessAnalytics(
  period: string,
  invoices: LandlordInvoiceOut[],
  bills: UtilityBillListItem[],
): LandlordAnalytics {
  const mapped = emptyAnalytics(period)
  const paidNow = invoices.filter((item) => paidInMonth(item, period))
  const billsNow = bills.filter((item) => billInPeriod(item, period))
  const unpaid = invoices.filter((item) => !isPaidInvoice(item))

  const income = paidNow.reduce((sum, item) => sum + num(item.amount), 0)
  const expenses = billsNow.reduce((sum, item) => sum + num(item.total), 0)
  const rentPaid = paidNow
    .filter((item) => (item.kind || '').toLowerCase() === 'rent')
    .reduce((sum, item) => sum + num(item.amount), 0)
  const utilityPaid = paidNow
    .filter((item) => {
      const kind = (item.kind || '').toLowerCase()
      return kind === 'utility' || kind === 'utilities'
    })
    .reduce((sum, item) => sum + num(item.amount), 0)
  const pending = unpaid.reduce((sum, item) => sum + num(item.amount), 0)
  const overdue = unpaid
    .filter((item) => (item.computed_status || item.status || '').toLowerCase() === 'overdue')
    .reduce((sum, item) => sum + num(item.amount), 0)

  mapped.cards = {
    income,
    expenses,
    profit: income - expenses,
    rentAccrued: rentPaid,
    utilityAccrued: utilityPaid,
    invoicesPending: pending,
    invoicesOverdue: overdue,
    occupancyPercent: 0,
  }

  const byDay = new Map<string, CashflowPoint>()
  function point(date: string): CashflowPoint {
    const existing = byDay.get(date)
    if (existing) return existing
    const next = { date, income: 0, expense: 0, profit: 0 }
    byDay.set(date, next)
    return next
  }
  for (const invoice of paidNow) {
    point(dayKey(invoice.paid_at || invoice.period, `${period}-01`)).income += num(invoice.amount)
  }
  for (const bill of billsNow) {
    point(dayKey(bill.created_at || bill.period, `${period}-01`)).expense += num(bill.total)
  }
  mapped.cashflow = [...byDay.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => ({ ...row, profit: row.income - row.expense }))

  const breakdown = new Map<string, number>()
  for (const bill of billsNow) {
    const key = bill.title?.trim() || 'utilities'
    breakdown.set(key, (breakdown.get(key) ?? 0) + num(bill.total))
  }
  mapped.expenseBreakdown = [...breakdown.entries()].map(([category, amount]) => ({ category, amount }))

  const previous = paidIncome(invoices, previousPeriod(period))
  mapped.revenueComparison = {
    currentPeriod: period,
    previousPeriod: previousPeriod(period),
    current: income,
    previous,
    difference: income - previous,
    percentChange: previous ? ((income - previous) / previous) * 100 : 0,
  }
  return mapped
}

function ensureChartPoints(analytics: LandlordAnalytics): LandlordAnalytics {
  if (analytics.cashflow.length || (!analytics.cards.income && !analytics.cards.expenses)) {
    return analytics
  }
  return {
    ...analytics,
    cashflow: [{
      date: `${analytics.period}-01`,
      income: analytics.cards.income,
      expense: analytics.cards.expenses,
      profit: analytics.cards.profit,
    }],
  }
}

async function loadAllUtilityBills(): Promise<UtilityBillListItem[]> {
  let objects = asList<{ id: number }>(await listBillObjects().catch(() => []))
  if (!objects.length) {
    objects = asList<{ id: number }>(await listObjects())
  }
  const rows = await Promise.all(
    objects.map((object) => listObjectBills(object.id).catch(() => [] as UtilityBillListItem[])),
  )
  return rows.flat()
}

export const useAccountingStore = defineStore('accounting', () => {
  const expenses = ref<Expense[]>([])
  const analytics = ref<LandlordAnalytics | null>(null)
  const lastError = ref<string | null>(null)
  const loading = ref(false)

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
    loading.value = false
  }

  async function loadAnalytics() {
    if (!getAccessToken()) return
    const period = currentPeriod()
    try {
      const [invoices, bills] = await Promise.all([
        listLandlordInvoices(),
        loadAllUtilityBills(),
      ])
      analytics.value = ensureChartPoints(buildBusinessAnalytics(period, invoices, bills))
    } catch (err) {
      lastError.value = formatApiError(err, 'Не удалось загрузить аналитику')
      analytics.value = emptyAnalytics(period)
    }
  }

  async function loadFromApi() {
    if (!getAccessToken()) return
    loading.value = true
    lastError.value = null
    try {
      const rows = asList<Awaited<ReturnType<typeof listTransactions>>[number]>(
        await listTransactions({ type: 'expense' }),
      )
      expenses.value = rows.map((row) => ({
        id: row.id,
        date: row.transaction_date,
        amount: num(row.amount),
        category: asCategory(row.category),
        title: row.title,
        note: row.comment ?? '',
        propertyId: row.object_id ?? null,
        documents: filesToExpenseDocs(row.files),
      }))
      syncPropertyExpenses()
    } catch (err) {
      lastError.value = formatApiError(err, 'Не удалось загрузить транзакции')
    }
    try {
      await loadAnalytics()
    } finally {
      loading.value = false
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
    const expense = getExpenseById(id)
    if (expense && !expense.documents.length) {
      void getTransaction(id).then((detail) => {
        const current = getExpenseById(id)
        if (current && !current.documents.length) {
          current.documents = filesToExpenseDocs(detail.files)
        }
      }).catch(() => {})
    }
  }

  function closeExpenseDetail() {
    expenseDetailOpen.value = false
    expenseDetailId.value = null
  }

  return {
    expenses,
    analytics,
    lastError,
    loading,
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
