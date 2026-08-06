export type PropertyType = 'office' | 'retail' | 'warehouse'
export type TenantStatus = 'active' | 'expiring' | 'overdue'
export type DocumentEntityType = 'property' | 'space' | 'tenant'

export interface Property {
  id: number
  address: string
  type: PropertyType
  spacesOccupied: number
  spacesTotal: number
  occupancy: number
  income: number
  expense: number
}

export type SpaceStatus = 'active' | 'inactive' | 'vacant'
export type RenovationType = 'cosmetic' | 'design' | 'none'

export interface Space {
  id: number
  propertyId: number
  name: string
  area: number
  monthlyRate: number
  accountNumber?: string
  cadastralNumber?: string
  ceilingHeight?: number
  renovation?: RenovationType
  spaceType?: string
  status?: SpaceStatus
  floor?: string
}

export interface Tenant {
  id: number
  company: string
  inn: string
  propertyId: number
  space: string
  rent: number
  contract: string
  status: TenantStatus
}

export interface AttachedDocument {
  id: number
  entityType: DocumentEntityType
  entityId: number
  name: string
  mimeType: string
  size: number
  uploadedAt: string
  dataUrl: string
}

export interface PendingDocument {
  name: string
  mimeType: string
  size: number
  dataUrl: string
}

export interface SpaceWithTenant extends Space {
  tenant: Tenant | null
  occupied: boolean
}

export interface TenantModalPrefill {
  propertyId?: number
  space?: string
}

/** Аренда арендатора — данные из БД арендодателя, только чтение в портале арендатора */
export interface TenantLeaseView {
  tenant: Tenant
  property: Property
  space: Space
}

export interface ReportRow {
  address: string
  tenant: string
  income: number
  expense: number
  type: string
  occupancy: number
}

export interface SpaceReportRow {
  address: string
  space: string
  tenant: string
  income: number
  monthlyRate: number
  area: number
  expense: number
  occupancy: number
}

export type ReportColumnKey = keyof ReportRow
export type SpaceReportColumnKey = keyof SpaceReportRow

export interface ReportColumn {
  key: ReportColumnKey
  label: string
  selected: boolean
}

export interface SpaceReportColumn {
  key: SpaceReportColumnKey
  label: string
  selected: boolean
}

export interface ExportColumn {
  key: string
  label: string
  selected: boolean
}

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  office: 'Офис',
  retail: 'Ритейл',
  warehouse: 'Склад',
}

export const RENOVATION_LABELS: Record<RenovationType, string> = {
  cosmetic: 'Косметический',
  design: 'Дизайнерский',
  none: 'Без отделки',
}

export const SPACE_STATUS_LABELS: Record<SpaceStatus, string> = {
  active: 'Активно',
  inactive: 'Неактивно',
  vacant: 'Свободно',
}

export interface SpaceFormItem {
  name: string
  area: number
  monthlyRate: number
}

export interface PropertyFormData {
  address: string
  type: PropertyType
  spaces: SpaceFormItem[]
  documents: PendingDocument[]
}

export interface TenantFormData {
  company: string
  inn: string
  propertyId: number | null
  space: string
  rent: number
  contract: string
  documents: PendingDocument[]
}

export interface SpaceUpdateData {
  name: string
  area: number
  monthlyRate: number
  accountNumber: string
  cadastralNumber: string
  ceilingHeight: number | null
  renovation: RenovationType | ''
  spaceType: string
  status: SpaceStatus
  floor: string
}

export interface TenantUpdateData {
  company: string
  inn: string
  rent: number
  contract: string
}

export function createEmptySpace(): SpaceFormItem {
  return { name: '', area: 0, monthlyRate: 0 }
}
