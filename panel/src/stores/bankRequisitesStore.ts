import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import {
  emptyBankRequisites,
  requisitesHaveContent,
  type BankRequisites,
} from '@/types/bankRequisites'
import { useAuthStore } from '@/stores/authStore'
import {
  fetchLandlordProfileApi,
  updateLandlordProfileApi,
} from '@/api/auth'
import { formatApiError, getAccessToken } from '@/api/http'
import type { LandlordProfileOut } from '@/api/types'

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
  } catch { /* quota */ }
}

function fromApi(row: LandlordProfileOut | null | undefined): BankRequisites {
  return {
    recipient: row?.recipient?.trim() ?? '',
    inn: row?.inn?.trim() ?? '',
    kpp: row?.kpp?.trim() ?? '',
    bankName: row?.bank_name?.trim() ?? '',
    bik: row?.bik?.trim() ?? '',
    account: row?.account?.trim() ?? '',
    corrAccount: row?.corr_account?.trim() ?? '',
    notes: row?.notes?.trim() ?? '',
  }
}

function toApi(data: BankRequisites): LandlordProfileOut {
  const clean = (value: string) => value.trim() || null
  return {
    recipient: clean(data.recipient),
    inn: clean(data.inn),
    kpp: clean(data.kpp),
    bank_name: clean(data.bankName),
    bik: clean(data.bik),
    account: clean(data.account),
    corr_account: clean(data.corrAccount),
    notes: clean(data.notes),
  }
}

export const useBankRequisitesStore = defineStore('bankRequisites', () => {
  const auth = useAuthStore()
  const draft = ref<BankRequisites>(emptyBankRequisites())
  const lastError = ref<string | null>(null)
  const loading = ref(false)
  const saving = ref(false)

  const currentOwner = computed(() => ownerKey(auth.user?.email, auth.user?.id))

  function cacheLocal(data: BankRequisites) {
    const key = currentOwner.value
    if (!key) return
    const map = readJson<ProfileMap>(PROFILE_KEY, {})
    map[key] = { ...data }
    writeJson(PROFILE_KEY, map)
  }

  function readLocal(): BankRequisites {
    const key = currentOwner.value
    if (!key) return emptyBankRequisites()
    const map = readJson<ProfileMap>(PROFILE_KEY, {})
    return { ...emptyBankRequisites(), ...(map[key] ?? {}) }
  }

  function applyDraft(data: BankRequisites) {
    draft.value = { ...emptyBankRequisites(), ...data }
    if (!draft.value.inn && auth.user?.inn) draft.value.inn = auth.user.inn
    if (!draft.value.recipient && auth.user?.name) draft.value.recipient = auth.user.name
  }

  async function loadFromApi() {
    if (!getAccessToken() || auth.isTenant) {
      applyDraft(readLocal())
      return
    }
    loading.value = true
    lastError.value = null
    try {
      const remote = fromApi(await fetchLandlordProfileApi())
      if (requisitesHaveContent(remote)) {
        applyDraft(remote)
        cacheLocal(remote)
        publishToObjects(remote)
        return
      }
      // Миграция: локальные реквизиты → API, если на сервере пусто
      const local = readLocal()
      if (requisitesHaveContent(local)) {
        applyDraft(local)
        await updateLandlordProfileApi(toApi(local))
        publishToObjects(local)
        return
      }
      applyDraft(emptyBankRequisites())
    } catch (err) {
      lastError.value = formatApiError(err, 'Не удалось загрузить реквизиты')
      applyDraft(readLocal())
    } finally {
      loading.value = false
    }
  }

  function loadForOwner() {
    void loadFromApi()
  }

  async function saveLandlord(): Promise<boolean> {
    if (auth.isTenant) return false
    saving.value = true
    lastError.value = null
    const next = { ...draft.value }
    try {
      if (getAccessToken()) {
        const saved = fromApi(await updateLandlordProfileApi(toApi(next)))
        applyDraft(requisitesHaveContent(saved) ? saved : next)
      }
      cacheLocal(draft.value)
      publishToObjects(draft.value)
      return true
    } catch (err) {
      lastError.value = formatApiError(err, 'Не удалось сохранить реквизиты')
      // Fallback: хотя бы локально, чтобы не потерять ввод
      cacheLocal(next)
      publishToObjects(next)
      return false
    } finally {
      saving.value = false
    }
  }

  function publishToObjects(data?: BankRequisites) {
    if (auth.isTenant) return
    const payload = data ?? draft.value
    if (!requisitesHaveContent(payload)) return
    void import('@/stores/portfolioStore').then(({ usePortfolioStore }) => {
      const portfolio = usePortfolioStore()
      const byObject = readJson<ObjectMap>(BY_OBJECT_KEY, {})
      for (const property of portfolio.properties) {
        byObject[String(property.id)] = { ...payload }
      }
      writeJson(BY_OBJECT_KEY, byObject)
    })
  }

  function getForObject(objectId: number | null | undefined): BankRequisites | null {
    if (objectId == null) return null
    // Для арендатора API реквизитов арендодателя пока нет — показываем кэш объекта, если есть
    const byObject = readJson<ObjectMap>(BY_OBJECT_KEY, {})
    const found = byObject[String(objectId)]
    if (found && requisitesHaveContent(found)) return found
    if (!auth.isTenant && requisitesHaveContent(draft.value)) return draft.value
    return null
  }

  const hasContent = computed(() => requisitesHaveContent(draft.value))

  watch(
    () => [auth.user?.email, auth.user?.id, auth.user?.role, getAccessToken()] as const,
    () => loadForOwner(),
    { immediate: true },
  )

  return {
    draft,
    hasContent,
    loading,
    saving,
    lastError,
    loadForOwner,
    loadFromApi,
    saveLandlord,
    publishToObjects,
    getForObject,
  }
})
