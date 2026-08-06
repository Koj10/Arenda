export interface TenantLeaseReportRow {
  address: string
  space: string
  area: number
  rent: number
  contract: string
  status: string
}

export interface TenantBillReportRow {
  period: string
  title: string
  type: string
  space: string
  amount: number
  status: string
  dueDate: string
}

export type TenantReportKind = 'leases' | 'bills'

export interface TenantReportColumn {
  key: string
  label: string
  selected: boolean
}

export const TENANT_LEASE_COLUMNS: TenantReportColumn[] = [
  { key: 'address', label: 'Адрес', selected: true },
  { key: 'space', label: 'Помещение', selected: true },
  { key: 'area', label: 'Площадь', selected: true },
  { key: 'rent', label: 'Аренда', selected: true },
  { key: 'contract', label: 'Договор до', selected: true },
  { key: 'status', label: 'Статус', selected: true },
]

export const TENANT_BILL_COLUMNS: TenantReportColumn[] = [
  { key: 'period', label: 'Период', selected: true },
  { key: 'title', label: 'Счёт', selected: true },
  { key: 'type', label: 'Тип', selected: true },
  { key: 'space', label: 'Помещение', selected: true },
  { key: 'amount', label: 'Сумма', selected: true },
  { key: 'dueDate', label: 'Оплатить до', selected: true },
  { key: 'status', label: 'Статус', selected: true },
]

export type TenantReportScope =
  | { kind: 'all' }
  | { kind: 'lease'; tenantId: number }
  | { kind: 'space'; tenantId: number; spaceName: string }
