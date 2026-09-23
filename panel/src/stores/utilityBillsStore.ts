import { defineStore } from 'pinia'
import { ref } from 'vue'
import type {
  PropertyBill,
  PropertyBillFormData,
  PropertyBillLine,
  SpaceUtilitySettings,
  UtilityCriterion,
  BillPayer,
  UtilityStatement,
  UtilityUploadItem,
} from '@/types/utilityBills'
import {
  createDefaultSpaceUtilityPayers,
  UTILITY_CRITERIA,
  UTILITY_CRITERION_LABELS,
} from '@/types/utilityBills'
import { getAccessToken, formatApiError, ApiError } from '@/api/http'
import { dataUrlToBlob, uploadFileApi } from '@/api/auth'
import { formatDateRu } from '@/utils/dates'
import {
  createLandlordInvoice,
  createUtilityBill,
  getObjectPayers,
  getUtilityBill,
  listObjectBills,
  listObjectMeters,
  updateUnitPayer,
  upsertMeter,
} from '@/api/landlord'
import { num, type UtilityBillDetailOut, type UtilityBillListItem } from '@/api/types'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { buildUtilityStatement, meterConsumption } from '@/composables/utilityCalc'
import { buildMeterDrafts, meterKey, shiftPeriod } from '@/composables/meters'

function linesFromAmounts(amounts?: Record<string, string | number> | null): PropertyBillLine[] {
  if (!amounts) return []
  return Object.entries(amounts)
    .filter(([, value]) => num(value) > 0)
    .map(([criterion, amount]) => ({
      criterion: (UTILITY_CRITERIA.includes(criterion as UtilityCriterion)
        ? criterion
        : 'management') as UtilityCriterion,
      amount: num(amount),
    }))
}

function mapPropertyBill(bill: UtilityBillListItem, detail?: UtilityBillDetailOut | null): PropertyBill {
  return {
    id: bill.id,
    propertyId: bill.object_id,
    period: bill.period,
    title: bill.title,
    totalAmount: num(bill.total),
    landlordLoss: num(bill.landlord_loss ?? detail?.landlord_loss),
    dueDate: bill.pay_by,
    issuedAt: bill.created_at.slice(0, 10),
    status: 'distributed',
    fileId: bill.file_id ?? detail?.file_id ?? null,
    lines: linesFromAmounts(detail?.amounts),
  }
}

export const useUtilityBillsStore = defineStore('utilityBills', () => {
  const spaceSettings = ref<SpaceUtilitySettings[]>([])
  const propertyBills = ref<PropertyBill[]>([])
  const addBillModalOpen = ref(false)
  const addBillPropertyId = ref<number | null>(null)

  function getSettingsForSpace(spaceId: number): SpaceUtilitySettings | null {
    return spaceSettings.value.find((s) => s.spaceId === spaceId) ?? null
  }

  function getSettingsForProperty(propertyId: number): SpaceUtilitySettings[] {
    return spaceSettings.value.filter((s) => s.propertyId === propertyId)
  }

  function getPayer(spaceId: number, criterion: UtilityCriterion): BillPayer {
    return getSettingsForSpace(spaceId)?.payers[criterion] ?? 'landlord'
  }

  function removeSettingsForSpace(spaceId: number) {
    spaceSettings.value = spaceSettings.value.filter((s) => s.spaceId !== spaceId)
  }

  function removeForProperty(propertyId: number) {
    spaceSettings.value = spaceSettings.value.filter((s) => s.propertyId !== propertyId)
    propertyBills.value = propertyBills.value.filter((b) => b.propertyId !== propertyId)
    if (addBillPropertyId.value === propertyId) {
      addBillModalOpen.value = false
      addBillPropertyId.value = null
    }
  }

  function ensureSettingsForProperty(propertyId: number) {
    const portfolio = usePortfolioStore()
    const spaces = portfolio.getSpacesForProperty(propertyId)
    for (const space of spaces) {
      if (!getSettingsForSpace(space.id)) {
        spaceSettings.value.push({
          spaceId: space.id,
          propertyId,
          payers: createDefaultSpaceUtilityPayers(),
        })
      }
    }
  }

  async function loadForProperty(propertyId: number) {
    if (!getAccessToken()) return
    try {
      const matrix = await getObjectPayers(propertyId)
      const units = matrix.units ?? []
      for (const row of units) {
        const payers = { ...createDefaultSpaceUtilityPayers(), ...row.utility_payers }
        const existing = getSettingsForSpace(row.unit_id)
        if (existing) {
          existing.propertyId = propertyId
          existing.payers = payers
        } else {
          spaceSettings.value.push({ spaceId: row.unit_id, propertyId, payers })
        }
      }
      const bills = await listObjectBills(propertyId)
      const details = await Promise.all(
        bills.map((bill) => getUtilityBill(bill.id).catch(() => null)),
      )
      propertyBills.value = [
        ...propertyBills.value.filter((b) => b.propertyId !== propertyId),
        ...bills.map((bill, index) => mapPropertyBill(bill, details[index])),
      ]
    } catch {
      /* keep local settings */
    }
  }

  async function setSpacePayer(spaceId: number, criterion: UtilityCriterion, payer: BillPayer) {
    const existing = getSettingsForSpace(spaceId)
    const previous = existing?.payers[criterion]
    if (existing) existing.payers[criterion] = payer
    else {
      const portfolio = usePortfolioStore()
      const space = portfolio.getSpaceById(spaceId)
      if (!space) return
      spaceSettings.value.push({
        spaceId,
        propertyId: space.propertyId,
        payers: { ...createDefaultSpaceUtilityPayers(), [criterion]: payer },
      })
    }
    if (criterion === 'septic') return
    try {
      await updateUnitPayer(spaceId, criterion, payer)
    } catch {
      if (existing && previous) existing.payers[criterion] = previous
    }
  }

  function getBillsForProperty(propertyId: number) {
    return propertyBills.value.filter((b) => b.propertyId === propertyId)
  }

  function openAddBillModal(propertyId: number) {
    addBillPropertyId.value = propertyId
    addBillModalOpen.value = true
  }

  const statement = ref<UtilityStatement | null>(null)
  const statementError = ref<string | null>(null)
  const issuing = ref(false)

  function closeAddBillModal() {
    addBillModalOpen.value = false
    addBillPropertyId.value = null
  }

  function closeStatement() {
    statement.value = null
    statementError.value = null
  }

  async function calculateStatement(params: {
    propertyId: number
    period: string
    dueDate: string
    items: UtilityUploadItem[]
  }): Promise<boolean> {
    statementError.value = null
    const portfolio = usePortfolioStore()
    const property = portfolio.getPropertyById(params.propertyId)
    if (!property) {
      statementError.value = 'Объект не найден'
      return false
    }
    if (!params.items.length) {
      statementError.value = 'Загрузите хотя бы один счёт'
      return false
    }
    await loadMeters(params.propertyId, params.period)
    const spaces = portfolio.getSpacesForProperty(params.propertyId)
    statement.value = buildUtilityStatement({
      propertyId: property.id,
      address: property.address,
      objectArea: property.totalArea,
      period: params.period,
      dueDate: params.dueDate,
      spaces,
      tenants: portfolio.getTenantsForProperty(property.id),
      items: params.items,
      getPayer,
      getConsumption: (spaceId, criterion) => {
        const draft = meterDrafts.value[meterKey(spaceId, criterion)]
        if (!draft) return null
        return meterConsumption(draft.previous, draft.current)
      },
    })
    closeAddBillModal()
    void persistUploadedBills(params.propertyId, params.period, params.dueDate, params.items)
    return true
  }

  async function persistUploadedBills(
    propertyId: number,
    period: string,
    dueDate: string,
    items: UtilityUploadItem[],
  ) {
    const groups = new Map<string, UtilityUploadItem[]>()
    for (const item of items) {
      const key = `${item.document.name}:${item.document.size}`
      const list = groups.get(key) ?? []
      list.push(item)
      groups.set(key, list)
    }
    for (const group of groups.values()) {
      const first = group[0]!
      const amounts: Record<string, number> = {}
      for (const item of group) {
        if (item.totalAmount != null && item.totalAmount > 0) {
          amounts[item.criterion] = (amounts[item.criterion] ?? 0) + item.totalAmount
        }
      }
      if (!Object.keys(amounts).length) continue
      let fileId: number | undefined
      try {
        if (first.document.dataUrl) {
          const uploaded = await uploadFileApi(
            dataUrlToBlob(first.document.dataUrl, first.document.mimeType),
            { filename: first.document.name, kind: 'supporting' },
          )
          fileId = uploaded.id
        }
      } catch {
        fileId = undefined
      }
      const criteria = Object.keys(amounts) as UtilityCriterion[]
      const title = criteria.length === 1
        ? UTILITY_CRITERION_LABELS[criteria[0]!]
        : first.fileName.replace(/\.[^.]+$/, '') || 'Коммунальный счёт'
      try {
        const created = await createUtilityBill({
          object_id: propertyId,
          file_id: fileId,
          title,
          period,
          pay_by: dueDate,
          amounts,
        })
        if (!propertyBills.value.some((bill) => bill.id === created.id)) {
          propertyBills.value.unshift(mapPropertyBill(created, created))
        }
      } catch {
        /* расчёт уже показан, сохранение не блокирует */
      }
    }
    void import('@/stores/accountingStore').then(({ useAccountingStore }) => {
      void useAccountingStore().loadAnalytics()
    })
  }

  async function uploadStatementFiles(items: UtilityUploadItem[]): Promise<number[]> {
    const current = statement.value
    if (current?.fileIds) return current.fileIds

    const ids: number[] = []
    const seen = new Set<string>()
    let skippedLarge = false
    for (const item of items) {
      const key = `${item.document.name}:${item.document.size}:${item.document.dataUrl.slice(0, 40)}`
      if (seen.has(key) || !item.document.dataUrl) continue
      seen.add(key)
      try {
        const uploaded = await uploadFileApi(
          dataUrlToBlob(item.document.dataUrl, item.document.mimeType),
          { filename: item.document.name, kind: 'supporting' },
        )
        ids.push(uploaded.id)
      } catch (err) {
        skippedLarge = skippedLarge || (err instanceof ApiError && err.status === 413)
      }
    }
    if (current) {
      current.fileIds = ids
      if (skippedLarge && ids.length === 0) {
        current.warnings = [
          ...current.warnings,
          'Вложения не загрузились: прокси отклонил файл (413). Счета выставляются без сканов — поднимите client_max_body_size на nginx до 50m.',
        ]
      }
    }
    return ids
  }

  async function issueStatementRow(spaceId: number): Promise<boolean> {
    const current = statement.value
    if (!current) return false
    const row = current.spaces.find((s) => s.spaceId === spaceId)
    if (!row || row.issued || row.destination !== 'tenant' || !row.tenantId || row.total <= 0) return false
    issuing.value = true
    statementError.value = null
    try {
      const fileIds = await uploadStatementFiles(current.items)
      await createLandlordInvoice({
        tenant_id: row.tenantId,
        unit_id: row.spaceId,
        kind: 'utility',
        period: current.period,
        amount: row.total,
        due_date: current.dueDate,
        file_ids: fileIds.length ? fileIds : undefined,
      })
      row.issued = true
      void import('@/stores/accountingStore').then(({ useAccountingStore }) => {
        void useAccountingStore().loadAnalytics()
      })
      return true
    } catch (err) {
      statementError.value = formatApiError(err, 'Не удалось выставить счёт')
      return false
    } finally {
      issuing.value = false
    }
  }

  async function issueAllStatementRows(): Promise<boolean> {
    const current = statement.value
    if (!current) return false
    const pending = current.spaces.filter(
      (row) => !row.issued && row.destination === 'tenant' && row.tenantId && row.total > 0,
    )
    if (!pending.length) {
      statementError.value = 'Нет помещений для выставления'
      return false
    }
    issuing.value = true
    statementError.value = null
    try {
      const fileIds = await uploadStatementFiles(current.items)
      for (const row of pending) {
        await createLandlordInvoice({
          tenant_id: row.tenantId!,
          unit_id: row.spaceId,
          kind: 'utility',
          period: current.period,
          amount: row.total,
          due_date: current.dueDate,
          file_ids: fileIds.length ? fileIds : undefined,
        })
        row.issued = true
      }
      void import('@/stores/accountingStore').then(({ useAccountingStore }) => {
        void useAccountingStore().loadAnalytics()
      })
      return true
    } catch (err) {
      statementError.value = formatApiError(err, 'Не удалось выставить счета')
      return false
    } finally {
      issuing.value = false
    }
  }

  async function addPropertyBill(data: PropertyBillFormData): Promise<boolean> {
    const totalAmount = data.lines.reduce((sum, l) => sum + (l.amount > 0 ? l.amount : 0), 0)
    if (totalAmount <= 0) return false

    try {
      let fileId: number | undefined
      if (data.document?.dataUrl) {
        const uploaded = await uploadFileApi(
          dataUrlToBlob(data.document.dataUrl, data.document.mimeType),
          { filename: data.document.name, kind: 'supporting' },
        )
        fileId = uploaded.id
      }

      const amounts: Record<string, number> = {}
      for (const line of data.lines) {
        if (line.amount > 0) amounts[line.criterion] = line.amount
      }

      const created = await createUtilityBill({
        object_id: data.propertyId,
        file_id: fileId,
        title: data.title.trim(),
        period: data.period,
        pay_by: data.dueDate,
        amounts,
      })

      propertyBills.value.unshift({
        ...mapPropertyBill(created, created),
        document: data.document,
        lines: data.lines.filter((l) => l.amount > 0),
      })
      closeAddBillModal()
      void import('@/stores/accountingStore').then(({ useAccountingStore }) => {
        void useAccountingStore().loadAnalytics()
      })
      return true
    } catch {
      return false
    }
  }

  const meterDrafts = ref<Record<string, { previous: string; current: string }>>({})
  const meterMeta = ref<Record<string, string>>({})
  const meterCarried = ref<Record<string, boolean>>({})
  const metersError = ref<string | null>(null)

  function getMeterDraft(unitId: number, criterion: string) {
    const key = meterKey(unitId, criterion)
    if (!meterDrafts.value[key]) meterDrafts.value[key] = { previous: '', current: '' }
    return meterDrafts.value[key]!
  }

  async function loadMeters(propertyId: number, period: string) {
    metersError.value = null
    try {
      const prevPeriod = shiftPeriod(period, -1)
      const [data, prevData] = await Promise.all([
        listObjectMeters(propertyId, period),
        prevPeriod
          ? listObjectMeters(propertyId, prevPeriod).catch(() => null)
          : Promise.resolve(null),
      ])
      const built = buildMeterDrafts(data.readings ?? [], prevData?.readings ?? [])
      meterDrafts.value = built.drafts
      meterMeta.value = built.meta
      meterCarried.value = built.carried
    } catch (err) {
      metersError.value = formatApiError(err, 'Не удалось загрузить показания')
    }
  }

  async function saveMeters(
    period: string,
    spaces: { id: number }[],
    criteria: string[],
  ): Promise<boolean> {
    metersError.value = null
    try {
      for (const space of spaces) {
        for (const criterion of criteria) {
          const draft = meterDrafts.value[meterKey(space.id, criterion)]
          if (!draft) continue
          const previous = Number(String(draft.previous).replace(',', '.'))
          const current = Number(String(draft.current).replace(',', '.'))
          if (!Number.isFinite(previous) || !Number.isFinite(current)) continue
          if (previous === 0 && current === 0) continue
          await upsertMeter({
            unit_id: space.id,
            period,
            criterion,
            previous_value: previous,
            current_value: current,
          })
        }
      }
      return true
    } catch (err) {
      metersError.value = formatApiError(err, 'Не удалось сохранить показания')
      return false
    }
  }

  function formatMoney(value: number) {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 }).format(value)
  }

  function formatPeriod(period: string) {
    const [year, month] = period.split('-')
    const d = new Date(Number(year), Number(month) - 1, 1)
    return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(d)
  }

  function formatDate(date: string) {
    return formatDateRu(date)
  }

  return {
    spaceSettings,
    propertyBills,
    addBillModalOpen,
    addBillPropertyId,
    getSettingsForSpace,
    getSettingsForProperty,
    getPayer,
    removeSettingsForSpace,
    removeForProperty,
    ensureSettingsForProperty,
    loadForProperty,
    setSpacePayer,
    getBillsForProperty,
    openAddBillModal,
    closeAddBillModal,
    addPropertyBill,
    statement,
    statementError,
    issuing,
    closeStatement,
    calculateStatement,
    issueStatementRow,
    issueAllStatementRows,
    meterDrafts,
    meterMeta,
    meterCarried,
    metersError,
    getMeterDraft,
    loadMeters,
    saveMeters,
    formatMoney,
    formatPeriod,
    formatDate,
  }
})
