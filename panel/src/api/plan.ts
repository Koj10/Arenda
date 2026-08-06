import { apiRequest, isApiConfigured } from '@/api/http'
import { PLAN_CATALOG } from '@/config/plans'
import type { PlanEntitlements, PlanId, PlanUsage } from '@/types/plan'

/**
 * Контракт бэкенда (реализуй позже):
 *   GET  /api/me/entitlements  → PlanEntitlements
 *   POST /api/billing/checkout { planId } → { url: string }  (опционально)
 *
 * Пока VITE_API_URL пуст — stub по email / роли.
 */

const emptyUsage = (): PlanUsage => ({
  objects: 0,
  spaces: 0,
  tenants: 0,
  users: 1,
  storageMb: 0,
})

function entitlementsFromPlan(
  planId: PlanId,
  extras: Partial<PlanEntitlements> = {},
): PlanEntitlements {
  const def = PLAN_CATALOG[planId]
  return {
    planId,
    renewsAt: planId === 'start' ? null : new Date(Date.now() + 30 * 864e5).toISOString(),
    status: 'active',
    limits: { ...def.limits },
    features: [...def.features],
    usage: emptyUsage(),
    tenantReportsUnlocked: def.features.includes('tenantReportsIncluded'),
    upgradeUrl: '/#pricing',
    ...extras,
  }
}

/** Stub: демо-арендодатель на Profi, новые — Start; арендатор без отчётов пока не купит */
function stubEntitlements(input: {
  email: string
  role: 'landlord' | 'tenant'
}): PlanEntitlements {
  const email = input.email.toLowerCase()

  if (input.role === 'tenant') {
    return entitlementsFromPlan('start', {
      tenantReportsUnlocked: email === 'tenant@propcount.ru' ? false : false,
      features: [],
      limits: {
        maxObjects: null,
        maxSpaces: null,
        maxTenants: null,
        maxUsers: 1,
        storageMb: null,
      },
    })
  }

  if (email === 'demo@propcount.ru') {
    return entitlementsFromPlan('profi')
  }

  return entitlementsFromPlan('start')
}

export async function fetchEntitlements(params: {
  email: string
  role: 'landlord' | 'tenant'
  token?: string | null
}): Promise<PlanEntitlements> {
  if (isApiConfigured()) {
    try {
      return await apiRequest<PlanEntitlements>('/api/me/entitlements', {
        token: params.token,
      })
    } catch {
      // fallback to stub while API is incomplete
    }
  }
  return stubEntitlements(params)
}

/** Заготовка под checkout — вернёт URL оплаты, когда API появится */
export async function createCheckoutSession(
  planId: PlanId,
  token?: string | null,
): Promise<{ url: string } | null> {
  if (!isApiConfigured()) return null
  return apiRequest<{ url: string }>('/api/billing/checkout', {
    method: 'POST',
    token,
    body: { planId },
  })
}
