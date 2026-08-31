/** Тарифы PropCount — контракт для API и фронта */

export type PlanId = 'start' | 'profi' | 'elite'

/** Фичи, которые можно гейтить на UI и проверять на API */
export type PlanFeature =
  | 'fullAnalytics'
  | 'exportReports'
  | 'autoInvoices'
  | 'tenantReportsIncluded'
  | 'multiUser'
  | 'branding'
  | 'customFields'
  | 'apiAccess'
  | 'prioritySupport'
  | 'dedicatedManager'

export interface PlanLimits {
  maxObjects: number | null
  /** Общий лимит помещений по аккаунту; null = без лимита */
  maxSpaces: number | null
  /** Лимит помещений в одном объекте; null = без лимита */
  maxSpacesPerObject: number | null
  maxTenants: number | null
  maxUsers: number | null
  storageMb: number | null
}

export interface PlanUsage {
  objects: number
  spaces: number
  tenants: number
  users: number
  storageMb: number
}

export interface PlanDefinition {
  id: PlanId
  name: string
  priceMonthly: number
  description: string
  limits: PlanLimits
  features: PlanFeature[]
}

/**
 * Ответ API: GET /api/me/entitlements (или часть /api/me)
 * Подставь реальный эндпоинт позже — форма уже готова.
 */
export interface PlanEntitlements {
  planId: PlanId
  /** ISO date или null если бессрочно / free */
  renewsAt: string | null
  status: 'active' | 'trialing' | 'past_due' | 'canceled'
  limits: PlanLimits
  features: PlanFeature[]
  usage: PlanUsage
  /** Арендатор: доступ к расширенным отчётам (подписка 249₽ или тариф владельца) */
  tenantReportsUnlocked: boolean
  upgradeUrl?: string
}

export type LimitKey = keyof PlanLimits
