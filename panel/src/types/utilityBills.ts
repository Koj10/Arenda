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
  | 'septic'

export const VAT_RATE = 0.22

export type ChargeMethod = 'meter' | 'area' | 'assign'

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

export const AREA_CRITERIA: UtilityCriterion[] = [
  'heating',
  'management',
  'garbage',
  'cleaning',
]

export const METERED_CRITERIA: UtilityCriterion[] = [
  'electricity',
  'water',
  'gas',
  'sewerage',
]

export const ASSIGN_CRITERIA: UtilityCriterion[] = ['septic']

export const UPLOAD_CRITERIA: UtilityCriterion[] = [
  'electricity',
  'water',
  'sewerage',
  'gas',
  'heating',
  'management',
  'garbage',
  'septic',
]

export function isMeteredCriterion(criterion: UtilityCriterion): boolean {
  return (METERED_CRITERIA as string[]).includes(criterion)
}

export function isAreaCriterion(criterion: UtilityCriterion): boolean {
  return (AREA_CRITERIA as string[]).includes(criterion)
}

export function isAssignCriterion(criterion: UtilityCriterion): boolean {
  return (ASSIGN_CRITERIA as string[]).includes(criterion)
}

export function chargeMethodOf(criterion: UtilityCriterion): ChargeMethod {
  if (isMeteredCriterion(criterion)) return 'meter'
  if (isAssignCriterion(criterion)) return 'assign'
  return 'area'
}

export const UTILITY_CRITERION_LABELS: Record<UtilityCriterion, string> = {
  electricity: 'Электроэнергия',
  water: 'Вода Гор/Хол',
  heating: 'Теплофикация',
  management: 'Управляющая компания',
  garbage: 'Вывоз мусора',
  gas: 'Газ',
  sewerage: 'Канализация',
  cleaning: 'Уборка рядом',
  septic: 'Септик',
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
    septic: 'tenant',
  }
}

export interface PropertyBillLine {
  criterion: UtilityCriterion
  amount: number
  label?: string
}

export interface PropertyBill {
  id: number
  propertyId: number
  period: string
  title: string
  totalAmount: number
  landlordLoss: number
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

export interface UtilityUploadItem {
  id: string
  fileName: string
  document: InvoiceDocument
  criterion: UtilityCriterion
  unitPrice: number | null
  vatRate: number
  totalAmount: number | null
  septicSpaceId: number | null
  parsedTitle?: string
  source?: string
}

export interface StatementCharge {
  criterion: UtilityCriterion
  amount: number
  method: ChargeMethod
}

export interface StatementSpaceRow {
  spaceId: number
  spaceName: string
  area: number
  areaShare: number
  tenantId: number | null
  tenantName: string | null
  charges: StatementCharge[]
  total: number
  destination: 'tenant' | 'loss'
  issued: boolean
}

export interface UtilityStatement {
  propertyId: number
  address: string
  period: string
  dueDate: string
  objectArea: number
  items: UtilityUploadItem[]
  spaces: StatementSpaceRow[]
  landlordLoss: number
  tenantTotal: number
  warnings: string[]
}
