import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type {
  Property,
  Space,
  Tenant,
  PropertyFormData,
  TenantFormData,
  SpaceFormData,
  ReportRow,
  SpaceReportRow,
  TenantStatus,
  SpaceWithTenant,
  TenantModalPrefill,
  TenantLeaseView,
  AttachedDocument,
  DocumentEntityType,
  PendingDocument,
  DocumentCategory,
  CadastralParcel,
  CadastralParcelFormData,
  SplitCadastralFormData,
  SpaceUpdateData,
  TenantUpdateData,
} from '@/types/portfolio'
import { PROPERTY_TYPE_LABELS } from '@/types/portfolio'
import { ApiError, formatApiError, getAccessToken, isPaymentRequired } from '@/api/http'
import { dataUrlToBlob, uploadFileApi } from '@/api/auth'
import * as landlordApi from '@/api/landlord'
import { num } from '@/api/types'
import type { ObjectDetailOut } from '@/api/types'

function recalcPropertyStats(property: Property, propertyTenants: Tenant[]) {
  const occupiedSpaces = new Set(propertyTenants.map((t) => t.space))
  property.spacesOccupied = occupiedSpaces.size
  property.occupancy = property.spacesTotal > 0
    ? Math.round((property.spacesOccupied / property.spacesTotal) * 100)
    : 0
  property.income = propertyTenants.reduce((sum, t) => sum + t.rent, 0)
}

function attachPendingDocuments(
  docs: PendingDocument[],
  entityType: DocumentEntityType,
  entityId: number,
  category: DocumentCategory,
) {
  const store_docs: Omit<AttachedDocument, 'id' | 'uploadedAt'>[] = docs.map((d) => ({
    entityType,
    entityId,
    category,
    name: d.name,
    mimeType: d.mimeType,
    size: d.size,
    dataUrl: d.dataUrl,
  }))
  return store_docs
}

export const usePortfolioStore = defineStore('portfolio', () => {
  const properties = ref<Property[]>([])
  const cadastralParcels = ref<CadastralParcel[]>([])
  const spaces = ref<Space[]>([])
  const tenants = ref<Tenant[]>([])
  const documents = ref<AttachedDocument[]>([])
  const lastError = ref<string | null>(null)
  const loadingRemote = ref(Boolean(getAccessToken()))

  const cadastralModalOpen = ref(false)
  const cadastralModalPropertyId = ref<number | null>(null)
  const cadastralEditId = ref<number | null>(null)
  const splitCadastralModalOpen = ref(false)
  const splitCadastralParcelId = ref<number | null>(null)

  const propertyModalOpen = ref(false)
  const spaceModalOpen = ref(false)
  const spaceModalPropertyId = ref<number | null>(null)
  const tenantModalOpen = ref(false)
  const tenantModalPrefill = ref<TenantModalPrefill | null>(null)
  const propertyDetailOpen = ref(false)
  const propertyDetailId = ref<number | null>(null)
  const spaceDetailOpen = ref(false)
  const spaceDetailId = ref<number | null>(null)
  const tenantDetailOpen = ref(false)
  const tenantDetailId = ref<number | null>(null)
  const tenantDetailLeaseId = ref<number | null>(null)

  const reportRows = computed<ReportRow[]>(() =>
    properties.value.map((p) => {
      const propertyTenants = tenants.value.filter((t) => t.propertyId === p.id)
      const tenantNames = propertyTenants.map((t) => t.company).join(', ') || '—'
      return {
        address: p.address,
        tenant: tenantNames,
        income: p.income,
        expense: p.expense,
        type: PROPERTY_TYPE_LABELS[p.type],
        occupancy: p.occupancy,
      }
    }),
  )

  function buildSpaceReportRow(space: Space): SpaceReportRow {
    const property = getPropertyById(space.propertyId)
    const tenant = getTenantForSpace(space.propertyId, space.name)
    const expenseShare = property && property.spacesTotal > 0
      ? Math.round(property.expense / property.spacesTotal)
      : 0

    return {
      address: property?.address ?? '—',
      space: space.name,
      tenant: tenant?.company ?? '—',
      income: tenant?.rent ?? 0,
      monthlyRate: space.monthlyRate,
      area: space.area,
      expense: expenseShare,
      occupancy: tenant ? 100 : 0,
    }
  }

  function getSpaceReportRows(filter?: { propertyId?: number; spaceId?: number }): SpaceReportRow[] {
    let list = spaces.value
    if (filter?.spaceId) {
      list = list.filter((s) => s.id === filter.spaceId)
    } else if (filter?.propertyId) {
      list = list.filter((s) => s.propertyId === filter.propertyId)
    }
    return list.map(buildSpaceReportRow)
  }

  function getPropertyById(id: number) {
    return properties.value.find((p) => p.id === id)
  }

  function getTenantById(id: number) {
    return tenants.value.find((t) => t.id === id)
  }

  function getTenantByLeaseId(leaseId: number) {
    return tenants.value.find((t) => t.leaseId === leaseId)
  }

  function getSpaceById(id: number) {
    return spaces.value.find((s) => s.id === id)
  }

  function getSpacesForProperty(propertyId: number) {
    return spaces.value.filter((s) => s.propertyId === propertyId)
  }

  function getCadastralParcelsForProperty(propertyId: number) {
    return cadastralParcels.value.filter((p) => p.propertyId === propertyId)
  }

  function getCadastralParcelById(id: number) {
    return cadastralParcels.value.find((p) => p.id === id) ?? null
  }

  function getTotalCadastralAreaForProperty(propertyId: number, excludeParcelId?: number) {
    return getCadastralParcelsForProperty(propertyId)
      .filter((p) => p.id !== excludeParcelId)
      .reduce((sum, p) => sum + p.area, 0)
  }

  function getAvailableCadastralAreaForProperty(propertyId: number, excludeParcelId?: number) {
    const property = getPropertyById(propertyId)
    if (!property) return 0
    return Math.max(0, property.totalArea - getTotalCadastralAreaForProperty(propertyId, excludeParcelId))
  }

  function getSpacesAreaForParcel(parcelId: number, excludeSpaceId?: number) {
    return spaces.value
      .filter((s) => s.cadastralParcelId === parcelId && s.id !== excludeSpaceId)
      .reduce((sum, s) => sum + s.area, 0)
  }

  function syncParcelAreaFromSpaces(parcelId: number) {
    const parcel = getCadastralParcelById(parcelId)
    if (!parcel) return
    parcel.area = getSpacesAreaForParcel(parcelId)
  }

  function getAvailableAreaForParcel(parcelId: number, excludeSpaceId?: number) {
    const parcel = getCadastralParcelById(parcelId)
    if (!parcel) return 0
    return Math.max(0, parcel.area - getSpacesAreaForParcel(parcelId, excludeSpaceId))
  }

  function getSpacesForParcel(parcelId: number) {
    return spaces.value.filter((s) => s.cadastralParcelId === parcelId)
  }

  function getUnassignedSpacesForProperty(propertyId: number) {
    return getSpacesForProperty(propertyId).filter((s) => !s.cadastralParcelId)
  }

  function canAssignSpaceToParcel(spaceId: number, parcelId: number) {
    const space = getSpaceById(spaceId)
    const parcel = getCadastralParcelById(parcelId)
    return !!(space && parcel && space.propertyId === parcel.propertyId)
  }

  async function assignSpaceToCadastral(spaceId: number, parcelId: number | null) {
    const space = getSpaceById(spaceId)
    if (!space) return false

    const previousParcelId = space.cadastralParcelId

    if (parcelId !== null && !canAssignSpaceToParcel(spaceId, parcelId)) return false

    try {
      await landlordApi.updateUnit(spaceId, { cadastre_id: parcelId })
    } catch (err) {
      lastError.value = formatApiError(err, 'Не удалось привязать помещение')
      return false
    }

    if (parcelId === null) {
      space.cadastralParcelId = undefined
      if (previousParcelId) syncParcelAreaFromSpaces(previousParcelId)
      return true
    }

    space.cadastralParcelId = parcelId
    syncParcelAreaFromSpaces(parcelId)
    if (previousParcelId && previousParcelId !== parcelId) {
      syncParcelAreaFromSpaces(previousParcelId)
    }
    return true
  }

  function getTotalCadastralValueForProperty(propertyId: number) {
    return getCadastralParcelsForProperty(propertyId).reduce((sum, p) => sum + p.cadastralValue, 0)
  }

  function getTotalAreaForProperty(propertyId: number) {
    return getSpacesForProperty(propertyId).reduce((sum, s) => sum + s.area, 0)
  }

  function getAllocatedAreaForProperty(propertyId: number, excludeSpaceId?: number) {
    return getSpacesForProperty(propertyId)
      .filter((s) => s.id !== excludeSpaceId)
      .reduce((sum, s) => sum + s.area, 0)
  }

  function getAvailableAreaForProperty(propertyId: number, excludeSpaceId?: number) {
    const property = getPropertyById(propertyId)
    if (!property) return 0
    return Math.max(0, property.totalArea - getAllocatedAreaForProperty(propertyId, excludeSpaceId))
  }

  function canAllocateArea(propertyId: number, area: number, excludeSpaceId?: number) {
    return area > 0 && area <= getAvailableAreaForProperty(propertyId, excludeSpaceId)
  }

  function getTotalMonthlyRateForProperty(propertyId: number) {
    return getSpacesForProperty(propertyId).reduce((sum, s) => sum + s.monthlyRate, 0)
  }

  function getSpaceByName(propertyId: number, spaceName: string) {
    return getSpacesForProperty(propertyId).find((s) => s.name === spaceName) ?? null
  }

  function getTenantForSpace(propertyId: number, spaceName: string) {
    return tenants.value.find((t) => t.propertyId === propertyId && t.space === spaceName) ?? null
  }

  function getTenantsByInn(inn: string) {
    return tenants.value.filter((t) => t.inn === inn)
  }

  function getLeasesByInn(inn: string): TenantLeaseView[] {
    return getTenantsByInn(inn)
      .map((tenant) => {
        const property = getPropertyById(tenant.propertyId)
        const space = getSpaceByName(tenant.propertyId, tenant.space)
        if (!property || !space) return null
        return { tenant, property, space }
      })
      .filter((lease): lease is TenantLeaseView => lease !== null)
  }

  function getTenantsForProperty(propertyId: number) {
    return tenants.value.filter((t) => t.propertyId === propertyId)
  }

  function getSpacesWithTenants(propertyId: number): SpaceWithTenant[] {
    return getSpacesForProperty(propertyId).map((space) => {
      const tenant = getTenantForSpace(propertyId, space.name)
      return {
        ...space,
        tenant,
        occupied: tenant !== null,
      }
    })
  }

  function getDocuments(entityType: DocumentEntityType, entityId: number, category?: DocumentCategory) {
    return documents.value.filter(
      (d) =>
        d.entityType === entityType &&
        d.entityId === entityId &&
        (category == null || d.category === category),
    )
  }

  function addDocument(data: Omit<AttachedDocument, 'id' | 'uploadedAt'>) {
    documents.value.push({
      ...data,
      id: Date.now() + Math.random(),
      uploadedAt: new Date().toISOString(),
    })
  }

  function addDocumentsBatch(items: Omit<AttachedDocument, 'id' | 'uploadedAt'>[]) {
    items.forEach((item) => addDocument(item))
  }

  function removeDocument(id: number) {
    documents.value = documents.value.filter((d) => d.id !== id)
  }

  function formatMoney(value: number) {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value)
  }

  function formatDate(date: string) {
    return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date))
  }

  function formatArea(area: number) {
    return `${new Intl.NumberFormat('ru-RU').format(area)} м²`
  }

  function getTenantStatus(contract: string): TenantStatus {
    const days = Math.ceil((new Date(contract).getTime() - Date.now()) / (86400000))
    if (days < 0) return 'overdue'
    if (days <= 60) return 'expiring'
    return 'active'
  }

  function applyObjectDetail(detail: ObjectDetailOut) {
    const totalArea = num(detail.total_area)
    const occupancy = Math.round(detail.metrics?.occupancy_percent ?? 0)
    const income = num(detail.metrics?.monthly_income)
    const units = detail.units ?? []
    const occupied = units.filter((u) => u.is_occupied).length

    const existing = getPropertyById(detail.id)
    const nextProperty: Property = {
      id: detail.id,
      address: detail.address,
      type: detail.type,
      totalArea,
      spacesOccupied: occupied,
      spacesTotal: units.length,
      occupancy,
      income,
      expense: existing?.expense ?? 0,
    }
    if (existing) Object.assign(existing, nextProperty)
    else properties.value.push(nextProperty)

    cadastralParcels.value = cadastralParcels.value.filter((p) => p.propertyId !== detail.id)
    for (const entry of detail.cadastre_entries ?? []) {
      cadastralParcels.value.push({
        id: entry.id,
        propertyId: entry.object_id,
        cadastralNumber: entry.number,
        area: 0,
        cadastralValue: num(entry.cadastral_value),
        purchasePrice: entry.purchase_price ? num(entry.purchase_price) : undefined,
      })
    }

    spaces.value = spaces.value.filter((s) => s.propertyId !== detail.id)
    for (const unit of units) {
      spaces.value.push({
        id: unit.id,
        propertyId: unit.object_id,
        cadastralParcelId: unit.cadastre_id ?? undefined,
        name: unit.number,
        area: num(unit.area),
        monthlyRate: num(unit.rent_rate),
      })
    }
    for (const entry of detail.cadastre_entries ?? []) {
      syncParcelAreaFromSpaces(entry.id)
    }
  }

  async function uploadPending(
    docs: PendingDocument[],
    kind: 'title' | 'service' | 'contract' | 'supporting',
    linkedType?: string,
    linkedId?: number,
  ) {
    const ids: number[] = []
    for (const doc of docs) {
      const blob = dataUrlToBlob(doc.dataUrl, doc.mimeType)
      const uploaded = await uploadFileApi(blob, {
        filename: doc.name,
        kind,
        ...(linkedId != null && linkedType
          ? { linked_type: linkedType, linked_id: linkedId }
          : {}),
      })
      ids.push(uploaded.id)
    }
    return ids
  }

  function reset() {
    properties.value = []
    cadastralParcels.value = []
    spaces.value = []
    tenants.value = []
    documents.value = []
    lastError.value = null
    loadingRemote.value = false
  }

  let loadInFlight: Promise<void> | null = null

  async function loadFromApi() {
    if (!getAccessToken()) return
    if (loadInFlight) return loadInFlight
    loadingRemote.value = true
    loadInFlight = (async () => {
      lastError.value = null
      try {
        const list = await landlordApi.listObjects()
        properties.value = []
        spaces.value = []
        cadastralParcels.value = []
        tenants.value = []
        for (const item of list) {
          const detail = await landlordApi.getObject(item.id)
          applyObjectDetail(detail)
        }

        const tenantList = await landlordApi.listTenants()
        for (const row of tenantList) {
          const detail = await landlordApi.getTenant(row.id)
          const leases = detail.leases ?? []
          if (!leases.length) {
            tenants.value.push({
              id: row.id,
              company: row.name,
              inn: row.inn,
              propertyId: 0,
              space: '',
              rent: 0,
              contract: '',
              status: 'active',
            })
            continue
          }
          for (const lease of leases) {
            const space = lease.unit_id ? getSpaceById(lease.unit_id) : null
            tenants.value.push({
              id: row.id,
              company: row.name,
              inn: row.inn,
              propertyId: space?.propertyId ?? lease.object_id ?? 0,
              space: space?.name ?? lease.unit_number ?? '',
              rent: num(lease.rent_monthly),
              contract: lease.end_date,
              status: getTenantStatus(lease.end_date),
              leaseId: lease.id,
            })
          }
        }

        for (const property of properties.value) {
          syncPropertyStats(property.id)
        }
        syncPlanUsage()
      } catch (err) {
        lastError.value = formatApiError(err, 'Не удалось загрузить объекты')
      } finally {
        loadingRemote.value = false
      }
    })()
    try {
      await loadInFlight
    } finally {
      loadInFlight = null
    }
  }

  function syncPlanUsage() {
    void import('@/stores/planStore').then(({ usePlanStore }) => {
      usePlanStore().setUsage({
        objects: properties.value.length,
        spaces: spaces.value.length,
        tenants: tenants.value.length,
      })
    })
  }

  function onPaymentRequired(err: unknown, fallback: string) {
    lastError.value = formatApiError(err, fallback)
    if (!isPaymentRequired(err)) return
    void import('@/stores/planStore').then(({ usePlanStore }) => {
      usePlanStore().openUpgrade({ reason: lastError.value ?? fallback })
    })
  }

  function syncPropertyStats(propertyId: number) {
    const property = getPropertyById(propertyId)
    if (!property) return
    recalcPropertyStats(property, getTenantsForProperty(propertyId))
  }

  async function addProperty(data: PropertyFormData) {
    lastError.value = null
    if (!getAccessToken()) {
      lastError.value = 'Нет сессии API'
      return false
    }
    try {
      const created = await landlordApi.createObject({
        address: data.address.trim(),
        type: data.type,
        total_area: data.totalArea,
        ...(data.cadastralNumber.trim()
          ? {
              cadastre_number: data.cadastralNumber.trim(),
              cadastral_value: data.cadastralValue,
              purchase_price: data.purchasePrice,
            }
          : {}),
      })
      applyObjectDetail(created)
      await uploadPending(data.titleDocuments, 'title', 'object', created.id)
      await uploadPending(data.serviceDocuments, 'service', 'object', created.id)
      addDocumentsBatch([
        ...attachPendingDocuments(data.titleDocuments, 'property', created.id, 'title'),
        ...attachPendingDocuments(data.serviceDocuments, 'property', created.id, 'service'),
      ])
      propertyModalOpen.value = false
      syncPlanUsage()
      return true
    } catch (err) {
      onPaymentRequired(err, 'Не удалось создать объект')
      return false
    }
  }

  async function removeProperty(id: number) {
    const property = getPropertyById(id)
    if (!property) return false
    lastError.value = null
    try {
      await landlordApi.deleteObject(id)
      const spaceIds = new Set(getSpacesForProperty(id).map((s) => s.id))
      properties.value = properties.value.filter((p) => p.id !== id)
      spaces.value = spaces.value.filter((s) => s.propertyId !== id)
      cadastralParcels.value = cadastralParcels.value.filter((p) => p.propertyId !== id)
      tenants.value = tenants.value.filter((t) => t.propertyId !== id)
      documents.value = documents.value.filter(
        (d) => !(d.entityType === 'property' && d.entityId === id),
      )
      if (propertyDetailId.value === id) closePropertyDetail()
      if (spaceDetailId.value && spaceIds.has(spaceDetailId.value)) closeSpaceDetail()
      void import('@/stores/utilityBillsStore').then(({ useUtilityBillsStore }) => {
        useUtilityBillsStore().removeForProperty(id)
      })
      syncPlanUsage()
      return true
    } catch (err) {
      lastError.value = formatApiError(err, 'Не удалось удалить объект')
      return false
    }
  }

  async function addSpace(propertyId: number, data: SpaceFormData) {
    const property = getPropertyById(propertyId)
    if (!property) return false
    const name = data.name.trim()
    if (getSpaceByName(propertyId, name)) return false
    if (!canAllocateArea(propertyId, data.area)) return false
    lastError.value = null
    try {
      await landlordApi.createUnit(propertyId, {
        number: name,
        area: data.area,
        rent_rate: data.monthlyRate,
      })
      const detail = await landlordApi.getObject(propertyId)
      applyObjectDetail(detail)
      syncPropertyStats(propertyId)
      syncPlanUsage()
      spaceModalOpen.value = false
      return true
    } catch (err) {
      onPaymentRequired(err, 'Не удалось добавить помещение')
      return false
    }
  }

  async function addTenant(data: TenantFormData) {
    if (!data.propertyId) return false
    const existing = getTenantForSpace(data.propertyId, data.space)
    if (existing) return false
    const space = getSpaceByName(data.propertyId, data.space)
    if (!space) return false
    lastError.value = null
    try {
      const inn = data.inn.trim()
      let tenant
      try {
        tenant = await landlordApi.createTenant({
          name: data.company.trim(),
          inn,
        })
      } catch (err) {
        if (!(err instanceof ApiError) || err.status !== 409) throw err
        const list = await landlordApi.listTenants(inn)
        const existingTenant = list.find((row) => row.inn === inn)
        if (!existingTenant) throw err
        tenant = existingTenant
      }

      const fileIds = await uploadPending(data.documents, 'contract')
      const today = new Date().toISOString().slice(0, 10)
      const endDate = data.contract
      const rent = Number(data.rent)
      if (!Number.isFinite(rent) || rent < 0) {
        lastError.value = 'Некорректная сумма аренды'
        return false
      }

      await landlordApi.createLease({
        tenant_id: tenant.id,
        unit_id: space.id,
        rent_monthly: rent,
        start_date: endDate < today ? endDate : today,
        end_date: endDate,
        file_ids: fileIds.length ? fileIds : undefined,
      })
      addDocumentsBatch(attachPendingDocuments(data.documents, 'tenant', tenant.id, 'lease'))
      await loadFromApi()
      tenantModalOpen.value = false
      tenantModalPrefill.value = null
      return true
    } catch (err) {
      onPaymentRequired(err, 'Не удалось добавить арендатора')
      return false
    }
  }

  async function updateSpace(id: number, data: SpaceUpdateData) {
    const space = getSpaceById(id)
    if (!space) return false
    if (!canAllocateArea(space.propertyId, data.area, id)) return false
    lastError.value = null
    try {
      await landlordApi.updateUnit(id, {
        number: data.name.trim(),
        area: data.area,
        rent_rate: data.monthlyRate,
        cadastre_id: space.cadastralParcelId ?? null,
      })
      const oldName = space.name
      space.name = data.name.trim()
      space.area = data.area
      space.monthlyRate = data.monthlyRate
      space.accountNumber = data.accountNumber.trim() || undefined
      space.ceilingHeight = data.ceilingHeight ?? undefined
      space.renovation = data.renovation || undefined
      space.spaceType = data.spaceType.trim() || undefined
      space.status = data.status
      space.floor = data.floor.trim() || undefined
      if (space.name !== oldName) {
        const tenant = getTenantForSpace(space.propertyId, oldName)
        if (tenant) tenant.space = space.name
      }
      if (space.cadastralParcelId) syncParcelAreaFromSpaces(space.cadastralParcelId)
      return true
    } catch (err) {
      lastError.value = formatApiError(err, 'Не удалось сохранить помещение')
      return false
    }
  }

  async function removeSpace(id: number) {
    const space = getSpaceById(id)
    if (!space) return false
    lastError.value = null
    try {
      await landlordApi.deleteUnit(id)
      const parcelId = space.cadastralParcelId
      spaces.value = spaces.value.filter((s) => s.id !== id)
      tenants.value = tenants.value.filter(
        (t) => !(t.propertyId === space.propertyId && t.space === space.name),
      )
      if (parcelId) syncParcelAreaFromSpaces(parcelId)
      try {
        const detail = await landlordApi.getObject(space.propertyId)
        applyObjectDetail(detail)
      } catch {
        /* список уже обновлён локально */
      }
      syncPropertyStats(space.propertyId)
      if (spaceDetailId.value === id) closeSpaceDetail()
      void import('@/stores/utilityBillsStore').then(({ useUtilityBillsStore }) => {
        useUtilityBillsStore().removeSettingsForSpace(id)
      })
      syncPlanUsage()
      return true
    } catch (err) {
      lastError.value = formatApiError(err, 'Не удалось удалить помещение')
      return false
    }
  }

  async function addCadastralParcel(propertyId: number, data: CadastralParcelFormData) {
    if (!data.cadastralNumber.trim() || data.cadastralValue <= 0) return false
    lastError.value = null
    try {
      const created = await landlordApi.createCadastre(propertyId, {
        number: data.cadastralNumber.trim(),
        cadastral_value: data.cadastralValue,
        purchase_price: data.purchasePrice,
      })
      cadastralParcels.value.push({
        id: created.id,
        propertyId: created.object_id,
        cadastralNumber: created.number,
        area: 0,
        cadastralValue: num(created.cadastral_value),
        purchasePrice: created.purchase_price ? num(created.purchase_price) : undefined,
      })
      cadastralModalOpen.value = false
      cadastralEditId.value = null
      return true
    } catch (err) {
      lastError.value = formatApiError(err, 'Не удалось добавить кадастр')
      return false
    }
  }

  async function updateCadastralParcel(id: number, data: CadastralParcelFormData) {
    const parcel = getCadastralParcelById(id)
    if (!parcel) return false
    if (!data.cadastralNumber.trim() || data.cadastralValue <= 0) return false
    lastError.value = null
    try {
      await landlordApi.updateCadastre(id, {
        number: data.cadastralNumber.trim(),
        cadastral_value: data.cadastralValue,
        purchase_price: data.purchasePrice,
      })
      parcel.cadastralNumber = data.cadastralNumber.trim()
      parcel.cadastralValue = data.cadastralValue
      parcel.purchasePrice = data.purchasePrice && data.purchasePrice > 0 ? data.purchasePrice : undefined
      syncParcelAreaFromSpaces(id)
      cadastralModalOpen.value = false
      cadastralEditId.value = null
      return true
    } catch (err) {
      lastError.value = formatApiError(err, 'Не удалось сохранить кадастр')
      return false
    }
  }

  async function removeCadastralParcel(id: number) {
    const parcel = getCadastralParcelById(id)
    if (!parcel) return false
    lastError.value = null
    try {
      await landlordApi.deleteCadastre(id)
      for (const space of spaces.value) {
        if (space.cadastralParcelId === id) space.cadastralParcelId = undefined
      }
      cadastralParcels.value = cadastralParcels.value.filter((p) => p.id !== id)
      if (cadastralEditId.value === id) closeCadastralModal()
      return true
    } catch (err) {
      lastError.value = formatApiError(err, 'Не удалось удалить кадастр')
      return false
    }
  }

  function openCadastralModal(propertyId: number, parcelId?: number) {
    cadastralModalPropertyId.value = propertyId
    cadastralEditId.value = parcelId ?? null
    cadastralModalOpen.value = true
  }

  function closeCadastralModal() {
    cadastralModalOpen.value = false
    cadastralModalPropertyId.value = null
    cadastralEditId.value = null
  }

  function openSplitCadastralModal(parcelId: number) {
    splitCadastralParcelId.value = parcelId
    splitCadastralModalOpen.value = true
  }

  function closeSplitCadastralModal() {
    splitCadastralModalOpen.value = false
    splitCadastralParcelId.value = null
  }

  /** Делит один кадастровый номер на два: сумма площадей = исходная площадь номера */
  async function splitCadastralParcel(parcelId: number, data: SplitCadastralFormData) {
    const original = getCadastralParcelById(parcelId)
    if (!original) return false
    if (!data.newCadastralNumber.trim()) return false
    if (data.firstCadastralValue <= 0 || data.secondCadastralValue <= 0) return false
    lastError.value = null
    try {
      await landlordApi.updateCadastre(parcelId, {
        cadastral_value: data.firstCadastralValue,
        purchase_price: data.firstPurchasePrice,
      })
      const created = await landlordApi.createCadastre(original.propertyId, {
        number: data.newCadastralNumber.trim(),
        cadastral_value: data.secondCadastralValue,
        purchase_price: data.secondPurchasePrice,
      })
      original.cadastralValue = data.firstCadastralValue
      original.purchasePrice = data.firstPurchasePrice && data.firstPurchasePrice > 0
        ? data.firstPurchasePrice
        : undefined
      cadastralParcels.value.push({
        id: created.id,
        propertyId: created.object_id,
        cadastralNumber: created.number,
        area: 0,
        cadastralValue: num(created.cadastral_value),
        purchasePrice: created.purchase_price ? num(created.purchase_price) : undefined,
      })
      splitCadastralModalOpen.value = false
      splitCadastralParcelId.value = null
      return true
    } catch (err) {
      lastError.value = formatApiError(err, 'Не удалось разделить кадастр')
      return false
    }
  }

  async function updateTenant(id: number, data: TenantUpdateData, leaseId?: number) {
    const tenant = leaseId ? getTenantByLeaseId(leaseId) ?? getTenantById(id) : getTenantById(id)
    if (!tenant) return false
    lastError.value = null
    try {
      await landlordApi.updateTenant(tenant.id, {
        name: data.company.trim(),
        inn: data.inn.trim(),
      })
      if (tenant.leaseId) {
        await landlordApi.updateLease(tenant.leaseId, {
          rent_monthly: data.rent,
          end_date: data.contract,
        })
      }
      tenant.company = data.company.trim()
      tenant.inn = data.inn.trim()
      tenant.rent = data.rent
      tenant.contract = data.contract
      tenant.status = getTenantStatus(data.contract)
      syncPropertyStats(tenant.propertyId)
      return true
    } catch (err) {
      lastError.value = formatApiError(err, 'Не удалось сохранить арендатора')
      return false
    }
  }

  function openPropertyModal() {
    propertyModalOpen.value = true
  }

  function closePropertyModal() {
    propertyModalOpen.value = false
  }

  function openSpaceModal(propertyId: number) {
    spaceModalPropertyId.value = propertyId
    spaceModalOpen.value = true
  }

  function closeSpaceModal() {
    spaceModalOpen.value = false
    spaceModalPropertyId.value = null
  }

  function openTenantModal(prefill?: TenantModalPrefill) {
    tenantModalPrefill.value = prefill ?? null
    tenantModalOpen.value = true
  }

  function closeTenantModal() {
    tenantModalOpen.value = false
    tenantModalPrefill.value = null
  }

  function openPropertyDetail(propertyId: number) {
    propertyDetailId.value = propertyId
    propertyDetailOpen.value = true
  }

  function closePropertyDetail() {
    propertyDetailOpen.value = false
    propertyDetailId.value = null
  }

  function openSpaceDetail(spaceId: number) {
    spaceDetailId.value = spaceId
    spaceDetailOpen.value = true
  }

  function closeSpaceDetail() {
    spaceDetailOpen.value = false
    spaceDetailId.value = null
  }

  function openTenantDetail(tenantId: number, leaseId?: number) {
    tenantDetailId.value = tenantId
    tenantDetailLeaseId.value = leaseId ?? null
    tenantDetailOpen.value = true
  }

  function closeTenantDetail() {
    tenantDetailOpen.value = false
    tenantDetailId.value = null
    tenantDetailLeaseId.value = null
  }

  return {
    properties,
    cadastralParcels,
    spaces,
    tenants,
    documents,
    lastError,
    loadingRemote,
    cadastralModalOpen,
    cadastralModalPropertyId,
    cadastralEditId,
    splitCadastralModalOpen,
    splitCadastralParcelId,
    propertyModalOpen,
    spaceModalOpen,
    spaceModalPropertyId,
    tenantModalOpen,
    tenantModalPrefill,
    propertyDetailOpen,
    propertyDetailId,
    spaceDetailOpen,
    spaceDetailId,
    tenantDetailOpen,
    tenantDetailId,
    tenantDetailLeaseId,
    reportRows,
    getSpaceReportRows,
    buildSpaceReportRow,
    getPropertyById,
    getTenantById,
    getTenantByLeaseId,
    getTenantsByInn,
    getLeasesByInn,
    getSpaceById,
    getCadastralParcelsForProperty,
    getCadastralParcelById,
    getTotalCadastralAreaForProperty,
    getAvailableCadastralAreaForProperty,
    getSpacesAreaForParcel,
    syncParcelAreaFromSpaces,
    getAvailableAreaForParcel,
    getSpacesForParcel,
    getUnassignedSpacesForProperty,
    canAssignSpaceToParcel,
    assignSpaceToCadastral,
    getTotalCadastralValueForProperty,
    getSpacesForProperty,
    getTotalAreaForProperty,
    getAllocatedAreaForProperty,
    getAvailableAreaForProperty,
    canAllocateArea,
    getTotalMonthlyRateForProperty,
    getSpaceByName,
    getTenantForSpace,
    getTenantsForProperty,
    getSpacesWithTenants,
    getDocuments,
    addDocument,
    removeDocument,
    formatMoney,
    formatDate,
    formatArea,
    reset,
    addProperty,
    removeProperty,
    addSpace,
    removeSpace,
    addTenant,
    updateSpace,
    updateTenant,
    addCadastralParcel,
    updateCadastralParcel,
    removeCadastralParcel,
    splitCadastralParcel,
    loadFromApi,
    openCadastralModal,
    closeCadastralModal,
    openSplitCadastralModal,
    closeSplitCadastralModal,
    openPropertyModal,
    closePropertyModal,
    openSpaceModal,
    closeSpaceModal,
    openTenantModal,
    closeTenantModal,
    openPropertyDetail,
    closePropertyDetail,
    openSpaceDetail,
    closeSpaceDetail,
    openTenantDetail,
    closeTenantDetail,
  }
})
