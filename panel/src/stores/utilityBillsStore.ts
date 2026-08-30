import { defineStore } from 'pinia'
import { ref } from 'vue'
import type {
  PropertyBill,
  PropertyBillFormData,
  SpaceUtilitySettings,
  UtilityCriterion,
  BillPayer,
} from '@/types/utilityBills'
import {
  createDefaultSpaceUtilityPayers,
} from '@/types/utilityBills'
import { getAccessToken } from '@/api/http'
import { dataUrlToBlob, uploadFileApi } from '@/api/auth'
import {
  createUtilityBill,
  getObjectPayers,
  listObjectBills,
  updateUnitPayer,
} from '@/api/landlord'
import { num } from '@/api/types'
import { usePortfolioStore } from '@/stores/portfolioStore'

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
      propertyBills.value = [
        ...propertyBills.value.filter((b) => b.propertyId !== propertyId),
        ...bills.map((bill) => ({
          id: bill.id,
          propertyId: bill.object_id,
          period: bill.period,
          title: bill.title,
          totalAmount: num(bill.total),
          dueDate: bill.pay_by,
          issuedAt: bill.created_at.slice(0, 10),
          status: 'distributed' as const,
          lines: [],
        })),
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

  function closeAddBillModal() {
    addBillModalOpen.value = false
    addBillPropertyId.value = null
  }

  async function addPropertyBill(data: PropertyBillFormData): Promise<boolean> {
    const totalAmount = data.lines.reduce((sum, l) => sum + (l.amount > 0 ? l.amount : 0), 0)
    if (totalAmount <= 0) return false

    try {
      let fileId: number | undefined
      if (data.document?.dataUrl) {
        const uploaded = await uploadFileApi(
          dataUrlToBlob(data.document.dataUrl, data.document.mimeType),
          { filename: data.document.name, kind: 'supporting', linked_type: 'bill' },
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
      }) as { id?: number; total?: string; created_at?: string }

      propertyBills.value.unshift({
        id: created.id ?? Date.now(),
        propertyId: data.propertyId,
        period: data.period,
        title: data.title.trim(),
        totalAmount: created.total ? num(created.total) : totalAmount,
        dueDate: data.dueDate,
        issuedAt: created.created_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
        status: 'distributed',
        document: data.document,
        lines: data.lines.filter((l) => l.amount > 0),
      })
      closeAddBillModal()
      return true
    } catch {
      return false
    }
  }

  function formatMoney(value: number) {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value)
  }

  function formatPeriod(period: string) {
    const [year, month] = period.split('-')
    const d = new Date(Number(year), Number(month) - 1, 1)
    return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(d)
  }

  function formatDate(date: string) {
    return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date))
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
    formatMoney,
    formatPeriod,
    formatDate,
  }
})
