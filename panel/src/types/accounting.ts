import type { PendingDocument } from '@/types/portfolio'

export type ExpenseCategory =
  | 'utilities'
  | 'maintenance'
  | 'tax'
  | 'insurance'
  | 'management'
  | 'other'

export interface ExpenseDocument {
  id: number
  name: string
  mimeType: string
  size: number
  dataUrl: string
  uploadedAt: string
}

export interface Expense {
  id: number
  date: string
  amount: number
  category: ExpenseCategory
  title: string
  note: string
  propertyId: number | null
  documents: ExpenseDocument[]
}

export interface ExpenseFormData {
  date: string
  amount: number
  category: ExpenseCategory
  title: string
  note: string
  propertyId: number | null
  documents: PendingDocument[]
}

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  utilities: 'Коммунальные',
  maintenance: 'Ремонт и обслуживание',
  tax: 'Налоги и сборы',
  insurance: 'Страхование',
  management: 'Управление',
  other: 'Прочее',
}

export function createEmptyExpenseForm(): ExpenseFormData {
  const today = new Date().toISOString().slice(0, 10)
  return {
    date: today,
    amount: 0,
    category: 'other',
    title: '',
    note: '',
    propertyId: null,
    documents: [],
  }
}
