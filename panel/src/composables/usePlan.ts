import { storeToRefs } from 'pinia'
import { usePlanStore } from '@/stores/planStore'
import type { PlanFeature } from '@/types/plan'

/**
 * UX-слой тарифов. Проверки на API всё равно обязательны.
 *
 * @example
 * const { can, canAddObject, requireFeature, requireCanAddObject } = usePlan()
 * if (!requireCanAddObject()) return
 */
export function usePlan() {
  const store = usePlanStore()
  const {
    planId,
    plan,
    limits,
    usage,
    features,
    status,
    tenantReportsUnlocked,
    nextPlan,
    isPaid,
    loading,
    upgradeOpen,
  } = storeToRefs(store)

  function requireFeature(feature: PlanFeature, reason?: string): boolean {
    if (store.can(feature)) return true
    store.openUpgrade({ feature, reason })
    return false
  }

  function requireCanAddObject(reason = 'Лимит объектов на текущем тарифе исчерпан'): boolean {
    if (store.canAddObject()) return true
    store.openUpgrade({ reason })
    return false
  }

  function requireCanAddTenant(reason = 'Лимит арендаторов на текущем тарифе исчерпан'): boolean {
    if (store.canAddTenant()) return true
    store.openUpgrade({ reason })
    return false
  }

  function requireTenantReports(reason = 'Расширенные отчёты доступны по подписке'): boolean {
    if (store.tenantReportsUnlocked) return true
    store.openUpgrade({ reason, feature: 'tenantReportsIncluded' })
    return false
  }

  return {
    planId,
    plan,
    limits,
    usage,
    features,
    status,
    tenantReportsUnlocked,
    nextPlan,
    isPaid,
    loading,
    upgradeOpen,
    can: store.can,
    canAddObject: store.canAddObject,
    canAddTenant: store.canAddTenant,
    canAddUser: store.canAddUser,
    isAtLimit: store.isAtLimit,
    openUpgrade: store.openUpgrade,
    closeUpgrade: store.closeUpgrade,
    startCheckout: store.startCheckout,
    requireFeature,
    requireCanAddObject,
    requireCanAddTenant,
    requireTenantReports,
    /** только stub/dev */
    stubSetPlan: store.stubSetPlan,
    stubUnlockTenantReports: store.stubUnlockTenantReports,
  }
}
