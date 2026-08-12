import type { InvoiceDocument } from '@/types/billing'

/** 8 платёжных критериев коммунальных услуг */
export type UtilityCriterion =
  | 'electricity'
  | 'water'
  | 'heating'
  | 'management'
  | 'garbage'
  | 'gas'
  | 'sewerage'
  | 'cleaning'

export type BillPayer = 'landlord' | 'tenant'

export const UTILITY_CRITERIA: UtilityCriterion[] = [
  'electricity',
  'water',
  'heating',
  'management',
  'garbage',
  'gas',
  'sewerage',
  'cleaning',
]

export const UTILITY_CRITERION_LABELS: Record<UtilityCriterion, string> = {
  electricity: 'Электроэнергия',
  water: 'Вода Гор/Хол',
  heating: 'Теплофикация',
  management: 'Управляющая компания',
  garbage: 'Вывоз мусора',
  gas: 'Газ',
  sewerage: 'Канализация',
  cleaning: 'Уборка рядом',
}

export const BILL_PAYER_LABELS: Record<BillPayer, string> = {
  landlord: 'Я',
  tenant: 'Арендатор',
}

export type SpaceUtilityPayers = Record<UtilityCriterion, BillPayer>

export interface SpaceUtilitySettings {
  spaceId: number
  propertyId: number
  payers: SpaceUtilityPayers
}

export function createDefaultSpaceUtilityPayers(): SpaceUtilityPayers {
  return {
    electricity: 'landlord',
    water: 'landlord',
    heating: 'landlord',
    management: 'landlord',
    garbage: 'landlord',
    gas: 'landlord',
    sewerage: 'landlord',
    cleaning: 'landlord',
  }
}

export interface PropertyBillLine {
  criterion: UtilityCriterion
  amount: number
}

export interface PropertyBill {
  id: number
  propertyId: number
  period: string
  title: string
  totalAmount: number
  dueDate: string
  issuedAt: string
  status: 'distributed' | 'paid'
  document?: InvoiceDocument
  lines: PropertyBillLine[]
}

export interface PropertyBillFormData {
  propertyId: number
  period: string
  title: string
  dueDate: string
  document: InvoiceDocument
  lines: PropertyBillLine[]
}

export function createEmptyBillLines(): PropertyBillLine[] {
  return UTILITY_CRITERIA.map((criterion) => ({ criterion, amount: 0 }))
}

export function sumBillLines(lines: PropertyBillLine[]): number {
  return lines.reduce((sum, line) => sum + (line.amount > 0 ? line.amount : 0), 0)
}
