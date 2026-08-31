export type ApiRole = 'landlord' | 'tenant'

export interface UserPublic {
  id: number
  name: string
  email: string
  provider?: string | null
  created_at: string
}

export interface TenantProfileOut {
  id: number
  user_id: number
  company_name: string
  inn: string
  created_at: string
}

export interface AuthResponse {
  access_token: string
  refresh_token: string
  token_type?: string
  user: UserPublic
  roles: ApiRole[]
  current_role: ApiRole | '' | null
}

export interface MeResponse {
  user: UserPublic
  roles: ApiRole[]
  current_role: ApiRole | '' | null
  tenant_profile?: TenantProfileOut | null
}

export interface ObjectListItem {
  id: number
  address: string
  type: 'office' | 'retail' | 'warehouse'
  total_area: string
  created_at: string
  occupied_area: string
  free_area: string
  occupancy_percent: number
  monthly_income: string
}

export interface CadastreOut {
  id: number
  object_id: number
  number: string
  cadastral_value: string
  purchase_price?: string | null
}

export interface UnitInObjectOut {
  id: number
  object_id: number
  number: string
  area: string
  rent_rate?: string | null
  cadastre_id?: number | null
  utility_payers: Record<string, 'landlord' | 'tenant'>
  created_at: string
  is_occupied?: boolean
  active_tenant_name?: string | null
  active_lease_end_date?: string | null
  active_rent_monthly?: string | null
}

export interface ObjectDetailOut {
  id: number
  address: string
  type: 'office' | 'retail' | 'warehouse'
  total_area: string
  created_at: string
  metrics: {
    occupied_area: string
    free_area: string
    occupancy_percent: number
    monthly_income: string
  }
  units?: UnitInObjectOut[]
  cadastre_entries?: CadastreOut[]
}

export interface TenantOut {
  id: number
  name: string
  inn: string
  created_at: string
  active_leases_count?: number
}

export interface LeaseInTenantDetail {
  id: number
  unit_id: number
  unit_number?: string
  object_id?: number
  rent_monthly: string
  start_date?: string | null
  end_date: string
  status: string
  invoice_day?: number
}

export interface TenantDetailOut extends TenantOut {
  leases?: LeaseInTenantDetail[]
}

export interface TransactionOut {
  id: number
  user_id: number
  type: 'income' | 'expense'
  title: string
  amount: string
  category: string
  object_id?: number | null
  comment?: string | null
  transaction_date: string
  created_at: string
}

export interface FileOut {
  id: number
  name?: string
  filename?: string
  original_name?: string
  mime_type?: string
  size?: number
}

export interface UnitPayerRow {
  unit_id: number
  number: string
  area: string
  utility_payers: Record<string, 'landlord' | 'tenant'>
  active_tenant_name?: string | null
}

export interface PayersMatrixOut {
  object_id?: number
  units: UnitPayerRow[]
}

export interface UtilityBillListItem {
  id: number
  object_id: number
  file_id?: number | null
  title: string
  period: string
  pay_by: string
  total: string
  landlord_loss?: string
  created_at: string
}

export interface MeterReadingOut {
  id: number
  object_id: number
  unit_id: number
  unit_number: string
  criterion: string
  period: string
  previous_value: string
  current_value: string
  consumption: string
  submitted_by_role: string
  updated_at: string
}

export interface ObjectMetersOut {
  object_id: number
  period: string
  criteria: string[]
  readings: MeterReadingOut[]
}

export interface TenantSpaceOut {
  lease_id: number
  status: string
  start_date?: string | null
  end_date: string
  rent_monthly: string | number
  unit_id: number
  unit_number: string
  unit_area: string | number
  object_id: number
  object_address: string
  tenant_name?: string
  tenant_inn?: string
}

export interface TenantSpacesResponse {
  matched: boolean
  message?: string | null
  spaces: TenantSpaceOut[]
}

export interface TenantInvoiceOut {
  id: number
  kind: string
  period: string
  amount: string | number
  due_date: string
  status: string
  computed_status: string
  object_address?: string | null
  unit_number?: string | null
  unit_id?: number | null
  payment_method?: string | null
  files?: FileOut[]
}

export interface LandlordInvoiceOut {
  id: number
  tenant_id: number
  unit_id?: number | null
  kind: string
  period: string
  amount: string | number
  due_date: string
  status: string
  computed_status: string
  paid_at?: string | null
  payment_method?: string | null
  tenant_name: string
  unit_number?: string | null
  object_address?: string | null
  files?: FileOut[]
}

export type InvoiceDetailOut = LandlordInvoiceOut

export interface TenantInvoicesResponse {
  matched: boolean
  message?: string | null
  invoices: TenantInvoiceOut[]
}

export interface TenantMetersOut {
  period: string
  criteria: string[]
  readings: MeterReadingOut[]
  units: { unit_id: number; unit_number: string; object_id: number; object_address: string }[]
}

export interface LandlordSubscriptionResponse {
  plan: string
  status: string
  started_at: string
  expires_at?: string | null
  objects: { limit: number; occupied: number; display: string }
  tenants: { limit: number; occupied: number; display: string }
  units: { limit: number; occupied: number; display: string }
}

export interface NotificationOut {
  id: number | string
  title?: string
  body?: string
  message?: string
  created_at?: string
  is_read?: boolean
  read?: boolean
}

export function num(value: string | number | null | undefined, fallback = 0): number {
  if (value == null || value === '') return fallback
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}
