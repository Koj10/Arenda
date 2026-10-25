export type UserRole = 'landlord' | 'tenant'

export interface AuthUser {
  id?: number
  name: string
  email: string
  role: UserRole
  /** ИНН арендатора — связь с записями в БД арендодателя */
  inn?: string
  /** Налоговая ставка арендодателя, % (например 22). Налог = сумма × ставка / 100 */
  taxRate?: number
}

export interface DemoAccount {
  role: UserRole
  name: string
  inn?: string
}

/** Демо-аккаунты до подключения API авторизации */
export const DEMO_ACCOUNTS: Record<string, DemoAccount> = {
  'demo@propcount.ru': { role: 'landlord', name: 'Арендодатель' },
  'tenant@propcount.ru': { role: 'tenant', name: 'ООО «ТехноСофт»', inn: '7707083893' },
}

const TENANT_PROFILES_KEY = 'propcount-tenant-profiles'

export interface TenantProfile {
  email: string
  name: string
  inn: string
}

function readTenantProfiles(): Record<string, TenantProfile> {
  try {
    const raw = localStorage.getItem(TENANT_PROFILES_KEY)
    return raw ? (JSON.parse(raw) as Record<string, TenantProfile>) : {}
  } catch {
    return {}
  }
}

/** Сохранить ИНН арендатора при регистрации (до появления API/БД) */
export function saveTenantProfile(profile: TenantProfile) {
  const all = readTenantProfiles()
  all[profile.email.toLowerCase()] = {
    email: profile.email,
    name: profile.name,
    inn: profile.inn,
  }
  localStorage.setItem(TENANT_PROFILES_KEY, JSON.stringify(all))
}

/**
 * Подтянуть ИНН арендатора по email.
 * Сейчас: локальные профили + демо. Позже заменить на запрос к БД/API.
 */
export function lookupTenantInnByEmail(email: string): string | null {
  const key = email.toLowerCase()
  const profile = readTenantProfiles()[key]
  if (profile?.inn) return profile.inn

  const demo = DEMO_ACCOUNTS[key]
  if (demo?.role === 'tenant' && demo.inn) return demo.inn

  return null
}

export function resolveDemoAccount(email: string): DemoAccount | null {
  return DEMO_ACCOUNTS[email.toLowerCase()] ?? null
}

export function defaultHomeForRole(role: UserRole): string {
  return role === 'tenant' ? '/tenant/spaces' : '/landlord/objects'
}

export function isValidInn(inn: string): boolean {
  return /^\d{10}$|^\d{12}$/.test(inn)
}

/** Ставка 0–100 % */
export function isValidTaxRate(rate: number): boolean {
  return Number.isFinite(rate) && rate >= 0 && rate <= 100
}

/** Налог, входящий в сумму (gross): 90_000 при 22% → 19_800 */
export function taxAmountFromGross(amount: number, taxRatePercent: number): number {
  if (!Number.isFinite(amount) || !Number.isFinite(taxRatePercent) || taxRatePercent <= 0) return 0
  return Math.round((amount * taxRatePercent) / 100)
}

const LANDLORD_TAX_RATES_KEY = 'propcount.landlordTaxRates'

function readStoredTaxRates(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LANDLORD_TAX_RATES_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, number>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function rememberLandlordTaxRate(userKey: string, rate: number) {
  const key = userKey.trim().toLowerCase()
  if (!key || !isValidTaxRate(rate)) return
  const stored = readStoredTaxRates()
  stored[key] = rate
  try {
    localStorage.setItem(LANDLORD_TAX_RATES_KEY, JSON.stringify(stored))
  } catch {
    /* quota / private mode */
  }
}

export function storedLandlordTaxRate(userKey: string): number | undefined {
  const key = userKey.trim().toLowerCase()
  if (!key) return undefined
  const value = readStoredTaxRates()[key]
  return typeof value === 'number' && isValidTaxRate(value) ? value : undefined
}

export function pickTaxRate(
  ...sources: Array<{ tax_rate?: number | null; taxRate?: number | null } | number | null | undefined>
): number | undefined {
  for (const src of sources) {
    if (typeof src === 'number' && isValidTaxRate(src)) return src
    if (src && typeof src === 'object') {
      const value = src.tax_rate ?? src.taxRate
      if (typeof value === 'number' && isValidTaxRate(value)) return value
    }
  }
  return undefined
}
