import type {
  ChargeMethod,
  StatementCharge,
  StatementSpaceRow,
  UtilityStatement,
  UtilityUploadItem,
  UtilityCriterion,
} from '@/types/utilityBills'
import {
  VAT_RATE,
  UTILITY_CRITERION_LABELS,
  chargeMethodOf,
} from '@/types/utilityBills'
import type { Space, Tenant } from '@/types/portfolio'

export function money(value: number): number {
  return Math.round(value * 100) / 100
}

export function unitPriceWithVat(unitPrice: number, vatRate = VAT_RATE): number {
  return money(unitPrice * (1 + vatRate))
}

export function meterConsumption(previous: string, current: string): number | null {
  const prev = Number(String(previous).replace(',', '.'))
  const curr = Number(String(current).replace(',', '.'))
  if (!Number.isFinite(prev) || !Number.isFinite(curr)) return null
  const delta = curr - prev
  if (delta < 0) return null
  return delta
}

interface CalcInput {
  propertyId: number
  address: string
  objectArea: number
  period: string
  dueDate: string
  spaces: Space[]
  tenants: Tenant[]
  items: UtilityUploadItem[]
  getPayer: (spaceId: number, criterion: UtilityCriterion) => 'landlord' | 'tenant'
  getConsumption: (spaceId: number, criterion: UtilityCriterion) => number | null
}

export function buildUtilityStatement(input: CalcInput): UtilityStatement {
  const warnings: string[] = []
  const objectArea = input.objectArea > 0 ? input.objectArea : input.spaces.reduce((s, x) => s + x.area, 0)
  if (objectArea <= 0) warnings.push('У объекта не указана площадь — нельзя разделить счета по квадратуре.')

  const raw = new Map<number, StatementCharge[]>()
  for (const space of input.spaces) raw.set(space.id, [])

  const reconciliation = { adjustment: 0 }

  for (const item of input.items) {
    applyItem(item, chargeMethodOf(item.criterion), input, objectArea, raw, warnings, reconciliation)
  }

  const spaces: StatementSpaceRow[] = input.spaces.map((space) => {
    const tenant = input.tenants.find((t) => t.propertyId === input.propertyId && t.space === space.name) ?? null
    const allCharges = raw.get(space.id) ?? []
    const tenantCharges: StatementCharge[] = []
    const lossCharges: StatementCharge[] = []
    for (const charge of allCharges) {
      const payer = charge.criterion === 'septic' ? 'tenant' : input.getPayer(space.id, charge.criterion)
      if (payer === 'tenant' && tenant) tenantCharges.push(charge)
      else lossCharges.push(charge)
    }
    const tenantTotal = money(tenantCharges.reduce((s, c) => s + c.amount, 0))
    const lossTotal = money(lossCharges.reduce((s, c) => s + c.amount, 0))
    const destination: 'tenant' | 'loss' = tenantTotal > 0 ? 'tenant' : 'loss'
    return {
      spaceId: space.id,
      spaceName: space.name,
      area: space.area,
      areaShare: objectArea > 0 ? space.area / objectArea : 0,
      tenantId: tenant?.id ?? null,
      tenantName: tenant?.company ?? null,
      charges: destination === 'tenant' ? tenantCharges : allCharges,
      total: destination === 'tenant' ? tenantTotal : money(tenantTotal + lossTotal),
      destination,
      issued: false,
    }
  })

  const landlordLossBase = money(
    spaces.reduce((sum, row) => {
      const all = raw.get(row.spaceId) ?? []
      const allSum = money(all.reduce((s, c) => s + c.amount, 0))
      if (row.destination === 'tenant') return sum + money(allSum - row.total)
      return sum + allSum
    }, 0),
  )
  const landlordLoss = money(landlordLossBase + reconciliation.adjustment)
  const tenantTotal = money(spaces.filter((r) => r.destination === 'tenant').reduce((s, r) => s + r.total, 0))

  return {
    propertyId: input.propertyId,
    address: input.address,
    period: input.period,
    dueDate: input.dueDate,
    objectArea,
    items: input.items,
    spaces,
    landlordLoss,
    tenantTotal,
    warnings,
  }
}

function sumByCriterion(raw: Map<number, StatementCharge[]>, criterion: UtilityCriterion): number {
  let total = 0
  for (const list of raw.values()) {
    for (const c of list) {
      if (c.criterion === criterion) total += c.amount
    }
  }
  return total
}

function pushCharge(
  raw: Map<number, StatementCharge[]>,
  spaceId: number,
  criterion: UtilityCriterion,
  amount: number,
  method: ChargeMethod,
) {
  if (amount <= 0) return
  const list = raw.get(spaceId)
  if (!list) return
  const existing = list.find((c) => c.criterion === criterion)
  if (existing) existing.amount = money(existing.amount + amount)
  else list.push({ criterion, amount: money(amount), method })
}

interface Reconciliation {
  adjustment: number
}

function applyItem(
  item: UtilityUploadItem,
  method: ChargeMethod,
  input: CalcInput,
  objectArea: number,
  raw: Map<number, StatementCharge[]>,
  warnings: string[],
  reconciliation: Reconciliation,
) {
  const label = UTILITY_CRITERION_LABELS[item.criterion]

  if (method === 'assign') {
    const amount = item.totalAmount ?? 0
    if (amount <= 0) {
      warnings.push(`${label}: укажите сумму счёта.`)
      return
    }
    if (!item.septicSpaceId) {
      warnings.push('Септик: выберите помещение, на которое перевыставить счёт.')
      return
    }
    if (!raw.has(item.septicSpaceId)) {
      warnings.push('Септик: выбранное помещение не найдено.')
      return
    }
    pushCharge(raw, item.septicSpaceId, item.criterion, amount, method)
    return
  }

  if (method === 'area') {
    const amount = item.totalAmount ?? 0
    if (amount <= 0) {
      warnings.push(`${label}: укажите итоговую сумму счёта.`)
      return
    }
    if (objectArea <= 0 || !input.spaces.length) {
      warnings.push(`${label}: нет площади объекта — сумму нельзя распределить.`)
      return
    }
    let allocated = 0
    input.spaces.forEach((space, index) => {
      const share = index === input.spaces.length - 1
        ? money(amount - allocated)
        : money(amount * (space.area / objectArea))
      allocated = money(allocated + share)
      pushCharge(raw, space.id, item.criterion, share, method)
    })
    return
  }

  const vatRate = item.vatRate > 0 ? item.vatRate : VAT_RATE
  let rateWithVat: number | null = item.unitPrice != null && item.unitPrice > 0
    ? unitPriceWithVat(item.unitPrice, vatRate)
    : null

  const consumptions = input.spaces.map((space) => ({
    space,
    qty: input.getConsumption(space.id, item.criterion),
  }))
  const missing = consumptions.filter((c) => !c.qty || c.qty <= 0)
  if (missing.length === input.spaces.length) {
    warnings.push(`${label}: нет показаний счётчиков — на помещения ничего не начислено.`)
    if (item.totalAmount && item.totalAmount > 0) {
      reconciliation.adjustment = money(reconciliation.adjustment + item.totalAmount)
      warnings.push(`${label}: итого ${money(item.totalAmount)} ₽ по счёту отнесено на результаты (убытки).`)
    }
    return
  }
  if (missing.length) {
    warnings.push(
      `${label}: нет показаний у ${missing.map((m) => `№${m.space.name}`).join(', ')} — им начислено 0.`,
    )
  }

  const totalQty = consumptions.reduce((s, c) => s + (c.qty && c.qty > 0 ? c.qty : 0), 0)
  if (rateWithVat == null && item.totalAmount && item.totalAmount > 0 && totalQty > 0) {
    rateWithVat = money(item.totalAmount / totalQty)
    warnings.push(`${label}: тариф не найден в счёте, итого разделено по показаниям (НДС уже в сумме).`)
  }
  if (rateWithVat == null) {
    warnings.push(`${label}: укажите цену за единицу без НДС.`)
    return
  }

  const sumBefore = sumByCriterion(raw, item.criterion)
  for (const { space, qty } of consumptions) {
    if (!qty || qty <= 0) continue
    pushCharge(raw, space.id, item.criterion, money(rateWithVat * qty), method)
  }
  const sumAfter = sumByCriterion(raw, item.criterion)
  const chargedSum = money(sumAfter - sumBefore)

  if (item.totalAmount && item.totalAmount > 0) {
    const diff = money(item.totalAmount - chargedSum)
    if (Math.abs(diff) > 0.01) {
      reconciliation.adjustment = money(reconciliation.adjustment + diff)
      if (diff > 0) {
        warnings.push(
          `${label}: сверка: в счёте ${money(item.totalAmount)} ₽, по тарифу вышло ${chargedSum} ₽. Разница +${diff} ₽ — убыток.`,
        )
      } else {
        warnings.push(
          `${label}: сверка: в счёте ${money(item.totalAmount)} ₽, по тарифу вышло ${chargedSum} ₽. Разница ${diff} ₽ — прибыль.`,
        )
      }
    }
  }
}
