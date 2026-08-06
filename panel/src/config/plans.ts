import type { PlanDefinition, PlanFeature, PlanId, PlanLimits } from '@/types/plan'

/** Каталог тарифов — должен совпадать с лендингом и будущим биллингом API */
export const PLAN_CATALOG: Record<PlanId, PlanDefinition> = {
  start: {
    id: 'start',
    name: 'Start',
    priceMonthly: 0,
    description: 'До 3 помещений, базовый учёт',
    limits: {
      maxObjects: 3,
      maxSpaces: 10,
      maxTenants: 5,
      maxUsers: 1,
      storageMb: 500,
    },
    features: [],
  },
  profi: {
    id: 'profi',
    name: 'Profi',
    priceMonthly: 4990,
    description: 'До 30 помещений, полный функционал',
    limits: {
      maxObjects: 30,
      maxSpaces: 200,
      maxTenants: 60,
      maxUsers: 3,
      storageMb: 10_240,
    },
    features: [
      'fullAnalytics',
      'exportReports',
      'autoInvoices',
      'tenantReportsIncluded',
      'multiUser',
      'prioritySupport',
    ],
  },
  elite: {
    id: 'elite',
    name: 'Elite',
    priceMonthly: 8990,
    description: 'Без лимитов, кастомизация панели',
    limits: {
      maxObjects: null,
      maxSpaces: null,
      maxTenants: null,
      maxUsers: null,
      storageMb: 102_400,
    },
    features: [
      'fullAnalytics',
      'exportReports',
      'autoInvoices',
      'tenantReportsIncluded',
      'multiUser',
      'branding',
      'customFields',
      'apiAccess',
      'prioritySupport',
      'dedicatedManager',
    ],
  },
}

export const PLAN_UPGRADE_TARGET: Record<PlanId, PlanId | null> = {
  start: 'profi',
  profi: 'elite',
  elite: null,
}

export function getPlanDefinition(id: PlanId): PlanDefinition {
  return PLAN_CATALOG[id]
}

export function planHasFeature(id: PlanId, feature: PlanFeature): boolean {
  return PLAN_CATALOG[id].features.includes(feature)
}

export function mergeLimits(base: PlanLimits, override?: Partial<PlanLimits>): PlanLimits {
  return { ...base, ...override }
}
