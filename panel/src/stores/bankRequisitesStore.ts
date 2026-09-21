import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import {
  emptyBankRequisites,
  requisitesHaveContent,
  type BankRequisites,
} from '@/types/bankRequisites'
import { useAuthStore } from '@/stores/authStore'
import { usePortfolioStore } from '@/stores/portfolioStore'

const PROFILE_KEY = 'propcount.panel.bank-requisites'
const BY_OBJECT_KEY = 'propcount.panel.bank-requisites.by-object'

type ProfileMap = Record<string, BankRequisites>
type ObjectMap = Record<string, BankRequisites>

function ownerKey(email?: string | null, id?: number) {
  if (id != null) return `id:${id}`
  if (email) return `email:${email.toLowerCase()}`
  return ''
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

export const useBankRequisitesStore = defineStore('bankRequisites', () => {
  const auth = useAuthStore()
  const draft = ref<BankRequisites>(emptyBankRequisites())

  const currentOwner = computed(() => ownerKey(auth.user?.email, auth.user?.id))

  function loadForOwner() {
    const key = currentOwner.value
    if (!key) {
      draft.value = emptyBankRequisites()
      return
    }
    const map = readJson<ProfileMap>(PROFILE_KEY, {})
    draft.value = { ...emptyBankRequisites(), ...(map[key] ?? {}) }
    if (!draft.value.inn && auth.user?.inn) draft.value.inn = auth.user.inn
    if (!draft.value.recipient && auth.user?.name) draft.value.recipient = auth.user.name
  }

  function saveLandlord(): boolean {
    const key = currentOwner.value
    if (!key || auth.isTenant) return false
    const next = { ...draft.value }
    const map = readJson<ProfileMap>(PROFILE_KEY, {})
    map[key] = next
    writeJson(PROFILE_KEY, map)
    publishToObjects(next)
    return true
  }

  function publishToObjects(data?: BankRequisites) {
    if (auth.isTenant) return
    const payload = data ?? draft.value
    if (!requisitesHaveContent(payload)) return
    const portfolio = usePortfolioStore()
    const byObject = readJson<ObjectMap>(BY_OBJECT_KEY, {})
    for (const property of portfolio.properties) {
      byObject[String(property.id)] = { ...payload }
    }
    writeJson(BY_OBJECT_KEY, byObject)
  }

  function getForObject(objectId: number | null | undefined): BankRequisites | null {
    if (objectId == null) return null
    const byObject = readJson<ObjectMap>(BY_OBJECT_KEY, {})
    const found = byObject[String(objectId)]
    return found && requisitesHaveContent(found) ? found : null
  }

  const hasContent = computed(() => requisitesHaveContent(draft.value))

  watch(
    () => [auth.user?.email, auth.user?.id, auth.user?.role] as const,
    () => loadForOwner(),
    { immediate: true },
  )

  return {
    draft,
    hasContent,
    loadForOwner,
    saveLandlord,
    publishToObjects,
    getForObject,
  }
})
