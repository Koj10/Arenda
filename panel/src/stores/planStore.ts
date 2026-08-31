import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { createCheckoutSession, fetchEntitlements } from '@/api/plan'
import { PLAN_CATALOG, PLAN_UPGRADE_TARGET } from '@/config/plans'
import type { LimitKey, PlanEntitlements, PlanFeature, PlanId, PlanUsage } from '@/types/plan'

const STORAGE_KEY = 'propcount-plan'

export const usePlanStore = defineStore('plan', () => {
  const entitlements = ref<PlanEntitlements | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const upgradeOpen = ref(false)
  const upgradeReason = ref<string | null>(null)
  const upgradeFeature = ref<PlanFeature | null>(null)

  const planId = computed<PlanId>(() => entitlements.value?.planId ?? 'start')
  const plan = computed(() => PLAN_CATALOG[planId.value])
  const limits = computed(() => entitlements.value?.limits ?? PLAN_CATALOG.start.limits)
  const usage = computed(() => entitlements.value?.usage)
  const features = computed(() => entitlements.value?.features ?? [])
  const status = computed(() => entitlements.value?.status ?? 'active')
  const tenantReportsUnlocked = computed(() => entitlements.value?.tenantReportsUnlocked ?? false)
  const nextPlanId = computed(() => PLAN_UPGRADE_TARGET[planId.value])
  const nextPlan = computed(() => (nextPlanId.value ? PLAN_CATALOG[nextPlanId.value] : null))
  const isPaid = computed(() => planId.value !== 'start')

  function persist() {
    if (entitlements.value) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entitlements.value))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  function can(feature: PlanFeature): boolean {
    return features.value.includes(feature)
  }

  function limitOf(key: LimitKey): number | null {
    return limits.value[key]
  }

  function usageOf(key: keyof PlanUsage): number {
    return usage.value?.[key] ?? 0
  }

  /** null limit = безлимит */
  function isAtLimit(key: LimitKey): boolean {
    const max = limitOf(key)
    if (max === null) return false
    const map: Record<LimitKey, keyof PlanUsage> = {
      maxObjects: 'objects',
      maxSpaces: 'spaces',
      maxTenants: 'tenants',
      maxUsers: 'users',
      storageMb: 'storageMb',
    }
    return usageOf(map[key]) >= max
  }

  function canAddObject(): boolean {
    return !isAtLimit('maxObjects')
  }

  function canAddSpace(): boolean {
    return !isAtLimit('maxSpaces')
  }

  function canAddTenant(): boolean {
    return !isAtLimit('maxTenants')
  }

  function canAddUser(): boolean {
    if (!can('multiUser') && usageOf('users') >= 1) return false
    return !isAtLimit('maxUsers')
  }

  function setUsage(partial: Partial<PlanUsage>) {
    if (!entitlements.value) return
    const current = entitlements.value.usage
    entitlements.value = {
      ...entitlements.value,
      usage: {
        objects: current?.objects ?? 0,
        spaces: current?.spaces ?? 0,
        tenants: current?.tenants ?? 0,
        users: current?.users ?? 1,
        storageMb: current?.storageMb ?? 0,
        ...partial,
      },
    }
    persist()
  }

  async function loadForUser(input: {
    email: string
    role: 'landlord' | 'tenant'
    token?: string | null
  }) {
    loading.value = true
    error.value = null
    try {
      const data = await fetchEntitlements(input)
      entitlements.value = data
      persist()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Не удалось загрузить тариф'
    } finally {
      loading.value = false
    }
  }

  function clear() {
    entitlements.value = null
    error.value = null
    upgradeOpen.value = false
    upgradeReason.value = null
    upgradeFeature.value = null
    localStorage.removeItem(STORAGE_KEY)
  }

  function openUpgrade(opts?: { reason?: string; feature?: PlanFeature }) {
    upgradeReason.value = opts?.reason ?? null
    upgradeFeature.value = opts?.feature ?? null
    upgradeOpen.value = true
  }

  function closeUpgrade() {
    upgradeOpen.value = false
  }

  /** Попытка открыть оплату; без API — просто модалка */
  async function startCheckout(target?: PlanId) {
    const id = target ?? nextPlanId.value
    if (!id) return
    try {
      const session = await createCheckoutSession(id)
      if (session?.url) {
        window.location.href = session.url
        return
      }
    } catch {
      /* stub */
    }
    openUpgrade({ reason: `Переход на ${PLAN_CATALOG[id].name}` })
  }

  /**
   * Dev/stub: сменить тариф локально, пока нет биллинга.
   * Удали или спрячь, когда API будет писать plan в БД.
   */
  function stubSetPlan(id: PlanId) {
    const def = PLAN_CATALOG[id]
    entitlements.value = {
      planId: id,
      renewsAt: id === 'start' ? null : new Date(Date.now() + 30 * 864e5).toISOString(),
      status: 'active',
      limits: { ...def.limits },
      features: [...def.features],
      usage: entitlements.value?.usage ?? emptyUsageFallback(),
      tenantReportsUnlocked: def.features.includes('tenantReportsIncluded'),
      upgradeUrl: entitlements.value?.upgradeUrl ?? '/#pricing',
    }
    persist()
  }

  function stubUnlockTenantReports(unlocked = true) {
    if (!entitlements.value) return
    entitlements.value = { ...entitlements.value, tenantReportsUnlocked: unlocked }
    persist()
  }

  return {
    entitlements,
    loading,
    error,
    upgradeOpen,
    upgradeReason,
    upgradeFeature,
    planId,
    plan,
    limits,
    usage,
    features,
    status,
    tenantReportsUnlocked,
    nextPlanId,
    nextPlan,
    isPaid,
    can,
    limitOf,
    usageOf,
    isAtLimit,
    canAddObject,
    canAddSpace,
    canAddTenant,
    canAddUser,
    setUsage,
    loadForUser,
    clear,
    openUpgrade,
    closeUpgrade,
    startCheckout,
    stubSetPlan,
    stubUnlockTenantReports,
  }
})

function emptyUsageFallback(): PlanUsage {
  return { objects: 0, spaces: 0, tenants: 0, users: 1, storageMb: 0 }
}
