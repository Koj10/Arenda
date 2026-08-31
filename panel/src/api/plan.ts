import { PLAN_CATALOG } from '@/config/plans'
import type { PlanEntitlements, PlanId, PlanUsage } from '@/types/plan'
import { apiRequest, getAccessToken } from '@/api/http'
import { getSubscription, upgradeSubscription } from '@/api/landlord'

const emptyUsage = (): PlanUsage => ({
  objects: 0,
  spaces: 0,
  tenants: 0,
  users: 1,
  storageMb: 0,
})

function asPlanId(plan: string): PlanId {
  if (plan === 'profi' || plan === 'elite') return plan
  return 'start'
}

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

function stubEntitlements(input: {
  email: string
  role: 'landlord' | 'tenant'
}): PlanEntitlements {
  if (input.role === 'tenant') {
    return entitlementsFromPlan('start', {
      tenantReportsUnlocked: false,
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
  return entitlementsFromPlan('start')
}

export async function fetchEntitlements(params: {
  email: string
  role: 'landlord' | 'tenant'
  token?: string | null
}): Promise<PlanEntitlements> {
  if (!getAccessToken() && !params.token) return stubEntitlements(params)

  try {
    if (params.role === 'tenant') {
      const sub = await apiRequest<{
        plan: string
        status: string
        expires_at?: string | null
        can_export?: boolean
      }>('/tenant/subscription', { token: params.token })
      return entitlementsFromPlan('start', {
        renewsAt: sub.expires_at ?? null,
        tenantReportsUnlocked: Boolean(sub.can_export) || sub.plan === 'tenant_reports',
        features: sub.can_export ? ['exportReports', 'tenantReportsIncluded'] : [],
      })
    }

    const sub = await getSubscription() as {
      plan: string
      status: string
      expires_at?: string | null
      objects: { limit: number; occupied: number }
      tenants: { limit: number; occupied: number }
      units: { limit: number; occupied: number }
    }
    const planId = asPlanId(sub.plan)
    const def = PLAN_CATALOG[planId]
    return entitlementsFromPlan(planId, {
      renewsAt: sub.expires_at ?? null,
      status: sub.status === 'active' ? 'active' : 'active',
      limits: {
        maxObjects: sub.objects?.limit ?? def.limits.maxObjects,
        maxSpaces: sub.units?.limit ?? def.limits.maxSpaces,
        maxTenants: sub.tenants?.limit ?? def.limits.maxTenants,
        maxUsers: def.limits.maxUsers,
        storageMb: def.limits.storageMb,
      },
      usage: {
        objects: sub.objects?.occupied ?? 0,
        spaces: sub.units?.occupied ?? 0,
        tenants: sub.tenants?.occupied ?? 0,
        users: 1,
        storageMb: 0,
      },
    })
  } catch {
    return stubEntitlements(params)
  }
}

export async function createCheckoutSession(
  planId: PlanId,
  _token?: string | null,
): Promise<{ url: string } | null> {
  try {
    const result = await upgradeSubscription(planId) as { url?: string }
    if (result?.url) return { url: result.url }
  } catch {
    /* no billing url */
  }
  return null
}
