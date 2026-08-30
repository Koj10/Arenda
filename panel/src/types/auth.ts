export type UserRole = 'landlord' | 'tenant'

export interface AuthUser {
  id?: number
  name: string
  email: string
  role: UserRole
  /** ИНН арендатора — связь с записями в БД арендодателя */
  inn?: string
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
