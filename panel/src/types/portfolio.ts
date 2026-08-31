export type PropertyType = 'office' | 'retail' | 'warehouse'
export type TenantStatus = 'active' | 'expiring' | 'overdue'
export type DocumentEntityType = 'property' | 'tenant'
export type PropertyDocumentCategory = 'title' | 'service'
export type TenantDocumentCategory = 'lease'
export type DocumentCategory = PropertyDocumentCategory | TenantDocumentCategory

export const PROPERTY_DOCUMENT_LABELS: Record<PropertyDocumentCategory, string> = {
  title: 'Правоустанавливающие документы',
  service: 'Сервисные и коммунальные документы',
}

export const TENANT_DOCUMENT_LABEL = 'Договор с арендатором'

export interface Property {
  id: number
  address: string
  type: PropertyType
  /** Общая площадь здания, м² */
  totalArea: number
  spacesOccupied: number
  spacesTotal: number
  occupancy: number
  income: number
  expense: number
}

/** Кадастровый участок / номер внутри объекта */
export interface CadastralParcel {
  id: number
  propertyId: number
  cadastralNumber: string
  /** Площадь по кадастру, м² — считается автоматически по привязанным помещениям */
  area: number
  /** Кадастровая стоимость */
  cadastralValue: number
  /** Цена покупки (необязательно) */
  purchasePrice?: number
}

export type SpaceStatus = 'active' | 'inactive' | 'vacant'
export type RenovationType = 'cosmetic' | 'design' | 'none'

export interface Space {
  id: number
  propertyId: number
  /** Привязка к кадастровому номеру */
  cadastralParcelId?: number
  name: string
  area: number
  monthlyRate: number
  accountNumber?: string
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
  leaseId?: number
  invoiceDay: number
}

export const INVOICE_DAYS = Array.from({ length: 31 }, (_, i) => i + 1)

export interface AttachedDocument {
  id: number
  entityType: DocumentEntityType
  entityId: number
  category: DocumentCategory
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
  cadastralNumber: string
  cadastralValue: number
  purchasePrice?: number
  totalArea: number
  titleDocuments: PendingDocument[]
  serviceDocuments: PendingDocument[]
}

export function createEmptyPropertyFormData(): PropertyFormData {
  return {
    address: '',
    type: 'office',
    cadastralNumber: '',
    cadastralValue: 0,
    purchasePrice: undefined,
    totalArea: 0,
    titleDocuments: [],
    serviceDocuments: [],
  }
}

export interface CadastralParcelFormData {
  cadastralNumber: string
  cadastralValue: number
  purchasePrice?: number
}

export function createEmptyCadastralParcelFormData(): CadastralParcelFormData {
  return {
    cadastralNumber: '',
    cadastralValue: 0,
    purchasePrice: undefined,
  }
}

/** Разделение одного кадастрового номера на два */
export interface SplitCadastralFormData {
  firstCadastralValue: number
  firstPurchasePrice?: number
  newCadastralNumber: string
  secondCadastralValue: number
  secondPurchasePrice?: number
}

export function createSplitCadastralFormData(source: CadastralParcel): SplitCadastralFormData {
  return {
    firstCadastralValue: Math.round(source.cadastralValue / 2),
    firstPurchasePrice: source.purchasePrice ? Math.round(source.purchasePrice / 2) : undefined,
    newCadastralNumber: '',
    secondCadastralValue: Math.round(source.cadastralValue / 2),
    secondPurchasePrice: source.purchasePrice ? source.purchasePrice - Math.round(source.purchasePrice / 2) : undefined,
  }
}

export interface TenantFormData {
  company: string
  inn: string
  propertyId: number | null
  space: string
  rent: number
  contract: string
  documents: PendingDocument[]
  invoiceDay: number
}

export interface SpaceUpdateData {
  name: string
  area: number
  monthlyRate: number
  accountNumber: string
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
  invoiceDay: number
}

export interface SpaceFormData {
  name: string
  area: number
  monthlyRate: number
  accountNumber: string
  ceilingHeight: number | null
  renovation: 'none' | 'cosmetic' | 'design'
  spaceType: string
  status: 'vacant' | 'active' | 'inactive'
  floor: string
}

export function createEmptySpace(): SpaceFormItem {
  return { name: '', area: 0, monthlyRate: 0 }
}

export function createEmptySpaceFormData(): SpaceFormData {
  return {
    name: '',
    area: 0,
    monthlyRate: 0,
    accountNumber: '',
    ceilingHeight: null,
    renovation: 'none',
    spaceType: '',
    status: 'vacant',
    floor: '',
  }
}

/** Доля площади помещения от общей площади объекта */
export function formatAreaShare(spaceArea: number, propertyTotalArea: number): string {
  if (propertyTotalArea <= 0) return `${spaceArea} м²`
  return `${new Intl.NumberFormat('ru-RU').format(spaceArea)} из ${new Intl.NumberFormat('ru-RU').format(propertyTotalArea)} м²`
}
