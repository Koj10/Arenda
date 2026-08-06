import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AuthUser, UserRole } from '@/types/auth'
import {
  isValidInn,
  lookupTenantInnByEmail,
  resolveDemoAccount,
  saveTenantProfile,
} from '@/types/auth'

export type { AuthUser, UserRole }

const PENDING_KEY = 'propcount-pending-role'

export type RoleChoiceMode = 'login' | 'register'

export interface PendingRoleChoice {
  email: string
  name: string
  mode: RoleChoiceMode
}

export type CompleteRoleResult =
  | { ok: true }
  | { ok: false; error: string }

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const pendingRoleChoice = ref<PendingRoleChoice | null>(null)

  const isAuthenticated = computed(() => !!user.value)
  const isLandlord = computed(() => user.value?.role === 'landlord')
  const isTenant = computed(() => user.value?.role === 'tenant')
  const tenantInn = computed(() => user.value?.inn ?? null)
  const needsRoleChoice = computed(() => !!pendingRoleChoice.value && !user.value)

  /** @deprecated use pendingRoleChoice */
  const pendingRegistration = computed(() => pendingRoleChoice.value)

  function login(email: string, name?: string, options?: { role?: UserRole; inn?: string }) {
    const demo = resolveDemoAccount(email)
    user.value = {
      email,
      name: name ?? demo?.name ?? email.split('@')[0] ?? 'User',
      role: options?.role ?? demo?.role ?? 'landlord',
      inn: options?.inn ?? demo?.inn,
    }
    localStorage.setItem('propcount-auth', JSON.stringify(user.value))
    clearPendingRoleChoice()
  }

  function beginRoleChoice(email: string, name: string, mode: RoleChoiceMode = 'register') {
    pendingRoleChoice.value = { email, name, mode }
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(pendingRoleChoice.value))
    user.value = null
    localStorage.removeItem('propcount-auth')
  }

  /** @deprecated use beginRoleChoice */
  function beginRegistration(email: string, name: string) {
    beginRoleChoice(email, name, 'register')
  }

  function completeRoleChoice(role: UserRole, inn?: string): CompleteRoleResult {
    const pending = pendingRoleChoice.value
    if (!pending) return { ok: false, error: 'Сессия выбора роли истекла' }

    if (role === 'landlord') {
      login(pending.email, pending.name, { role: 'landlord' })
      return { ok: true }
    }

    // Tenant — registration: INN required
    if (pending.mode === 'register') {
      const value = inn?.trim() ?? ''
      if (!value) return { ok: false, error: 'Укажите ИНН компании' }
      if (!isValidInn(value)) return { ok: false, error: 'ИНН: 10 или 12 цифр' }

      saveTenantProfile({ email: pending.email, name: pending.name, inn: value })
      login(pending.email, pending.name, { role: 'tenant', inn: value })
      return { ok: true }
    }

    // Tenant — login: INN from DB (stub: local profiles + demo)
    const storedInn = lookupTenantInnByEmail(pending.email)
    if (!storedInn) {
      return {
        ok: false,
        error: 'ИНН для этого аккаунта не найден. Зарегистрируйтесь как арендатор или обратитесь к арендодателю.',
      }
    }

    login(pending.email, pending.name, { role: 'tenant', inn: storedInn })
    return { ok: true }
  }

  /** @deprecated use completeRoleChoice */
  function completeRegistration(role: UserRole, inn?: string) {
    return completeRoleChoice(role, inn).ok
  }

  function clearPendingRoleChoice() {
    pendingRoleChoice.value = null
    sessionStorage.removeItem(PENDING_KEY)
    sessionStorage.removeItem('propcount-pending-reg')
  }

  /** @deprecated use clearPendingRoleChoice */
  function clearPendingRegistration() {
    clearPendingRoleChoice()
  }

  function logout() {
    user.value = null
    clearPendingRoleChoice()
    localStorage.removeItem('propcount-auth')
  }

  function hydrate() {
    const pendingRaw =
      sessionStorage.getItem(PENDING_KEY) || sessionStorage.getItem('propcount-pending-reg')
    if (pendingRaw) {
      try {
        const parsed = JSON.parse(pendingRaw) as Partial<PendingRoleChoice> & {
          email: string
          name: string
        }
        pendingRoleChoice.value = {
          email: parsed.email,
          name: parsed.name,
          mode: parsed.mode === 'login' ? 'login' : 'register',
        }
      } catch {
        sessionStorage.removeItem(PENDING_KEY)
        sessionStorage.removeItem('propcount-pending-reg')
      }
    }

    const raw = localStorage.getItem('propcount-auth')
    if (!raw) return
    const parsed = JSON.parse(raw) as Partial<AuthUser>
    user.value = {
      name: parsed.name ?? 'User',
      email: parsed.email ?? '',
      role: parsed.role ?? 'landlord',
      inn: parsed.inn,
    }
  }

  return {
    user,
    pendingRoleChoice,
    pendingRegistration,
    isAuthenticated,
    isLandlord,
    isTenant,
    tenantInn,
    needsRoleChoice,
    login,
    beginRoleChoice,
    beginRegistration,
    completeRoleChoice,
    completeRegistration,
    clearPendingRoleChoice,
    clearPendingRegistration,
    logout,
    hydrate,
  }
})
