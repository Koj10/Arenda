import type { ExpenseCategory } from '@/types/accounting'

export type InvoiceType = 'rent' | 'utilities' | 'other'
export type InvoiceStatus = 'pending' | 'paid' | 'overdue'

export interface InvoiceDocument {
  name: string
  mimeType: string
  size: number
  dataUrl: string
}

export interface Invoice {
  id: number
  tenantId: number
  inn: string
  propertyId: number
  space: string
  period: string
  type: InvoiceType
  title: string
  amount: number
  status: InvoiceStatus
  dueDate: string
  issuedAt: string
  document?: InvoiceDocument
}

export type BillRecipientType = 'landlord' | 'tenant'

export interface UploadBillFormData {
  recipientType: BillRecipientType
  tenantInn: string
  tenantId: number | null
  title: string
  amount: number
  dueDate: string
  category: ExpenseCategory
  propertyId: number | null
  document: InvoiceDocument
}

export interface ParsedInvoiceAmount {
  amount: number | null
  confidence: 'high' | 'medium' | 'low' | 'none'
  source: string
}

export const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  rent: 'Аренда',
  utilities: 'ЖКХ',
  other: 'Прочее',
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  pending: 'К оплате',
  paid: 'Оплачен',
  overdue: 'Просрочен',
}

export const BILL_RECIPIENT_LABELS: Record<BillRecipientType, string> = {
  landlord: 'Мой счёт (оплачиваю я)',
  tenant: 'Счёт арендатора',
}
