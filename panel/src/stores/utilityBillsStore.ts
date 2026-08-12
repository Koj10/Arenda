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
  UTILITY_CRITERION_LABELS,
} from '@/types/utilityBills'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { useBillingStore } from '@/stores/billingStore'
import { useAccountingStore } from '@/stores/accountingStore'

const initialSettings: SpaceUtilitySettings[] = [
  {
    spaceId: 101,
    propertyId: 1,
    payers: {
      electricity: 'tenant',
      water: 'tenant',
      heating: 'landlord',
      management: 'landlord',
      garbage: 'tenant',
      gas: 'landlord',
      sewerage: 'tenant',
      cleaning: 'landlord',
    },
  },
  {
    spaceId: 102,
    propertyId: 1,
    payers: {
      electricity: 'tenant',
      water: 'tenant',
      heating: 'landlord',
      management: 'landlord',
      garbage: 'tenant',
      gas: 'landlord',
      sewerage: 'tenant',
      cleaning: 'landlord',
    },
  },
  {
    spaceId: 103,
    propertyId: 1,
    payers: {
      electricity: 'tenant',
      water: 'tenant',
      heating: 'tenant',
      management: 'tenant',
      garbage: 'tenant',
      gas: 'tenant',
      sewerage: 'tenant',
      cleaning: 'tenant',
    },
  },
  {
    spaceId: 104,
    propertyId: 1,
    payers: {
      electricity: 'tenant',
      water: 'tenant',
      heating: 'tenant',
      management: 'tenant',
      garbage: 'tenant',
      gas: 'tenant',
      sewerage: 'tenant',
      cleaning: 'tenant',
    },
  },
]

export const useUtilityBillsStore = defineStore('utilityBills', () => {
  const spaceSettings = ref<SpaceUtilitySettings[]>([...initialSettings])
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

  function setSpacePayer(spaceId: number, criterion: UtilityCriterion, payer: BillPayer) {
    const existing = getSettingsForSpace(spaceId)
    if (existing) {
      existing.payers[criterion] = payer
      return
    }
    const portfolio = usePortfolioStore()
    const space = portfolio.getSpaceById(spaceId)
    if (!space) return
    spaceSettings.value.push({
      spaceId,
      propertyId: space.propertyId,
      payers: { ...createDefaultSpaceUtilityPayers(), [criterion]: payer },
    })
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

  function distributeBill(bill: PropertyBill) {
    const portfolio = usePortfolioStore()
    const billing = useBillingStore()
    const accounting = useAccountingStore()

    const spaces = portfolio.getSpacesForProperty(bill.propertyId)
    if (!spaces.length) return

    const totalArea = spaces.reduce((sum, s) => sum + s.area, 0)
    const tenantShares = new Map<number, { amount: number; parts: string[] }>()
    let landlordTotal = 0

    for (const line of bill.lines) {
      if (line.amount <= 0) continue
      const label = UTILITY_CRITERION_LABELS[line.criterion]

      for (const space of spaces) {
        const share = totalArea > 0 ? (space.area / totalArea) * line.amount : 0
        if (share <= 0) continue

        const payer = getPayer(space.id, line.criterion)
        if (payer === 'landlord') {
          landlordTotal += share
        } else {
          const current = tenantShares.get(space.id) ?? { amount: 0, parts: [] }
          current.amount += share
          current.parts.push(`${label}: ${Math.round(share).toLocaleString('ru-RU')} ₽`)
          tenantShares.set(space.id, current)
        }
      }
    }

    if (landlordTotal > 0) {
      accounting.addExpense({
        date: bill.issuedAt,
        amount: Math.round(landlordTotal * 100) / 100,
        category: 'utilities',
        title: `${bill.title} (моя доля)`,
        note: `Коммунальные услуги · ${bill.period}`,
        propertyId: bill.propertyId,
        documents: bill.document
          ? [{
              name: bill.document.name,
              mimeType: bill.document.mimeType,
              size: bill.document.size,
              dataUrl: bill.document.dataUrl,
            }]
          : [],
      })
    }

    for (const [spaceId, data] of tenantShares) {
      if (data.amount <= 0) continue
      const space = portfolio.getSpaceById(spaceId)
      if (!space) continue
      const tenant = portfolio.getTenantForSpace(bill.propertyId, space.name)
      if (!tenant) continue

      billing.addTenantInvoice(
        {
          recipientType: 'tenant',
          tenantInn: tenant.inn,
          tenantId: tenant.id,
          title: `${bill.title} · пом. ${space.name}`,
          amount: Math.round(data.amount * 100) / 100,
          dueDate: bill.dueDate,
          category: 'utilities',
          propertyId: bill.propertyId,
          document: bill.document!,
        },
        tenant,
        bill.period,
      )
    }
  }

  function addPropertyBill(data: PropertyBillFormData): boolean {
    const totalAmount = data.lines.reduce((sum, l) => sum + (l.amount > 0 ? l.amount : 0), 0)
    if (totalAmount <= 0) return false

    const bill: PropertyBill = {
      id: Date.now(),
      propertyId: data.propertyId,
      period: data.period,
      title: data.title.trim(),
      totalAmount,
      dueDate: data.dueDate,
      issuedAt: new Date().toISOString().slice(0, 10),
      status: 'distributed',
      document: data.document,
      lines: data.lines.filter((l) => l.amount > 0),
    }

    propertyBills.value.unshift(bill)
    distributeBill(bill)
    closeAddBillModal()
    return true
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
    ensureSettingsForProperty,
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
