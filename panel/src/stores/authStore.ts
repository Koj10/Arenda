import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AuthUser, UserRole } from '@/types/auth'
import { isValidInn } from '@/types/auth'
import { usePlanStore } from '@/stores/planStore'
import { formatApiError, getAccessToken, setTokens } from '@/api/http'
import type { AuthResponse } from '@/api/types'
import {
  fetchMe,
  logoutApi,
  selectRoleApi,
  updateTenantProfileApi,
} from '@/api/auth'

export type { AuthUser, UserRole }

const PENDING_KEY = 'propcount-pending-role'
const USER_KEY = 'propcount-auth'

export type RoleChoiceMode = 'login' | 'register'

export interface PendingRoleChoice {
  email: string
  name: string
  mode: RoleChoiceMode
}

export type CompleteRoleResult =
  | { ok: true }
  | { ok: false; error: string }

function toUser(data: {
  name: string
  email: string
  role?: string | null
  inn?: string
  id?: number
}): AuthUser {
  const role: UserRole = data.role === 'tenant' ? 'tenant' : 'landlord'
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    role,
    inn: data.inn,
  }
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const pendingRoleChoice = ref<PendingRoleChoice | null>(null)

  const isAuthenticated = computed(() => !!user.value && !!getAccessToken())
  const isLandlord = computed(() => user.value?.role === 'landlord')
  const isTenant = computed(() => user.value?.role === 'tenant')
  const tenantInn = computed(() => user.value?.inn ?? null)
  const needsRoleChoice = computed(() => !!pendingRoleChoice.value && !user.value)

  const pendingRegistration = computed(() => pendingRoleChoice.value)

  let remoteLoadsStarted = false

  function persistUser() {
    if (user.value) localStorage.setItem(USER_KEY, JSON.stringify(user.value))
    else localStorage.removeItem(USER_KEY)
  }

  function kickRemoteLoads() {
    if (remoteLoadsStarted) return
    remoteLoadsStarted = true
    const current = user.value
    if (current) {
      void usePlanStore().loadForUser({
        email: current.email,
        role: current.role,
        token: getAccessToken(),
      })
    }
    void import('@/stores/portfolioStore').then(({ usePortfolioStore }) => {
      void usePortfolioStore().loadFromApi()
    })
    void import('@/stores/accountingStore').then(({ useAccountingStore }) => {
      void useAccountingStore().loadFromApi()
    })
    void import('@/stores/notificationsStore').then(({ useNotificationsStore }) => {
      void useNotificationsStore().loadFromApi()
    })
  }

  function applyUser(next: AuthUser) {
    const prevRole = user.value?.role
    if (prevRole && prevRole !== next.role) {
      remoteLoadsStarted = false
      usePlanStore().clear()
      void import('@/stores/portfolioStore').then(({ usePortfolioStore }) => {
        usePortfolioStore().reset()
        void usePortfolioStore().loadFromApi()
      })
    }
    user.value = next
    persistUser()
    clearPendingRoleChoice()
    void usePlanStore().loadForUser({
      email: next.email,
      role: next.role,
      token: getAccessToken(),
    })
    kickRemoteLoads()
  }

  function applyAuthResponse(session: AuthResponse, fallbackRole?: UserRole) {
    setTokens(session.access_token, session.refresh_token)
    const role = (session.current_role || fallbackRole) as UserRole | undefined
    applyUser(toUser({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role,
    }))
  }

  function applyTokens(access: string, refresh?: string | null) {
    setTokens(access, refresh)
  }

  function login(email: string, name?: string, options?: { role?: UserRole; inn?: string; id?: number }) {
    applyUser(toUser({
      email,
      name: name ?? email.split('@')[0] ?? 'User',
      role: options?.role,
      inn: options?.inn,
      id: options?.id,
    }))
  }

  function beginRoleChoice(email: string, name: string, mode: RoleChoiceMode = 'register') {
    pendingRoleChoice.value = { email, name, mode }
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(pendingRoleChoice.value))
    user.value = null
    localStorage.removeItem(USER_KEY)
  }

  function beginRegistration(email: string, name: string) {
    beginRoleChoice(email, name, 'register')
  }

  async function completeRoleChoice(role: UserRole, inn?: string): Promise<CompleteRoleResult> {
    const pending = pendingRoleChoice.value
    if (!pending) return { ok: false, error: 'Сессия выбора роли истекла' }

    if (role === 'tenant') {
      const value = inn?.trim() ?? ''
      if (!value) return { ok: false, error: 'Укажите ИНН компании' }
      if (!isValidInn(value)) return { ok: false, error: 'ИНН: 10 или 12 цифр' }
    }

    try {
      await selectRoleApi(role)
      let tenantInnValue = inn?.trim()
      if (role === 'tenant' && tenantInnValue) {
        const profile = await updateTenantProfileApi({
          company_name: pending.name,
          inn: tenantInnValue,
        })
        tenantInnValue = profile.inn
      }

      login(pending.email, pending.name, {
        role,
        inn: role === 'tenant' ? tenantInnValue : undefined,
      })
      return { ok: true }
    } catch (err) {
      return { ok: false, error: formatApiError(err, 'Не удалось выбрать роль') }
    }
  }

  function completeRegistration(role: UserRole, inn?: string) {
    return completeRoleChoice(role, inn)
  }

  function clearPendingRoleChoice() {
    pendingRoleChoice.value = null
    sessionStorage.removeItem(PENDING_KEY)
    sessionStorage.removeItem('propcount-pending-reg')
  }

  function clearPendingRegistration() {
    clearPendingRoleChoice()
  }

  function logout() {
    remoteLoadsStarted = false
    void logoutApi()
    user.value = null
    clearPendingRoleChoice()
    localStorage.removeItem(USER_KEY)
    usePlanStore().clear()
    void import('@/stores/portfolioStore').then(({ usePortfolioStore }) => {
      usePortfolioStore().reset()
    })
    void import('@/stores/accountingStore').then(({ useAccountingStore }) => {
      useAccountingStore().reset()
    })
    void import('@/stores/notificationsStore').then(({ useNotificationsStore }) => {
      useNotificationsStore().clear()
    })
  }

  function updateProfile(patch: Partial<Pick<AuthUser, 'name' | 'email' | 'inn'>>) {
    if (!user.value) return
    user.value = { ...user.value, ...patch }
    persistUser()
  }

  async function saveProfile(patch: Partial<Pick<AuthUser, 'name' | 'inn'>>): Promise<CompleteRoleResult> {
    if (!user.value) return { ok: false, error: 'Нет сессии' }
    const inn = patch.inn?.trim()
    if (inn) {
      if (!isValidInn(inn)) return { ok: false, error: 'ИНН: 10 или 12 цифр' }
      try {
        const profile = await updateTenantProfileApi({
          company_name: (patch.name ?? user.value.name).trim() || user.value.name,
          inn,
        })
        updateProfile({ name: patch.name ?? user.value.name, inn: profile.inn })
        return { ok: true }
      } catch (err) {
        return { ok: false, error: formatApiError(err, 'Не удалось сохранить ИНН') }
      }
    }
    updateProfile({ name: patch.name ?? user.value.name })
    return { ok: true }
  }

  async function hydrateFromApi() {
    if (!getAccessToken()) return
    try {
      const me = await fetchMe()
      const role = me.current_role === 'tenant' || me.current_role === 'landlord' ? me.current_role : user.value?.role
      applyUser(toUser({
        id: me.user.id,
        name: me.user.name,
        email: me.user.email,
        role,
        inn: me.tenant_profile?.inn ?? user.value?.inn,
      }))
    } catch {
      /* keep local snapshot */
    }
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

    if (pendingRoleChoice.value) {
      user.value = null
      return
    }

    if (user.value) {
      if (getAccessToken()) kickRemoteLoads()
      return
    }

    const raw = localStorage.getItem(USER_KEY)
    if (raw && getAccessToken()) {
      const parsed = JSON.parse(raw) as Partial<AuthUser>
      user.value = {
        id: parsed.id,
        name: parsed.name ?? 'User',
        email: parsed.email ?? '',
        role: parsed.role ?? 'landlord',
        inn: parsed.inn,
      }
      kickRemoteLoads()
      void hydrateFromApi()
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
    applyAuthResponse,
    applyTokens,
    beginRoleChoice,
    beginRegistration,
    completeRoleChoice,
    completeRegistration,
    clearPendingRoleChoice,
    clearPendingRegistration,
    logout,
    updateProfile,
    saveProfile,
    hydrate,
    hydrateFromApi,
  }
})
