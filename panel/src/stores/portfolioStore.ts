import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type {
  Property,
  Space,
  Tenant,
  PropertyFormData,
  TenantFormData,
  ReportRow,
  SpaceReportRow,
  TenantStatus,
  SpaceWithTenant,
  TenantModalPrefill,
  TenantLeaseView,
  AttachedDocument,
  DocumentEntityType,
  PendingDocument,
  SpaceUpdateData,
  TenantUpdateData,
} from '@/types/portfolio'
import { PROPERTY_TYPE_LABELS } from '@/types/portfolio'

const initialProperties: Property[] = [
  { id: 1, address: 'г. Москва, ул. Тверская, д. 12', type: 'office', spacesOccupied: 3, spacesTotal: 4, occupancy: 75, income: 1890000, expense: 320000 },
  { id: 2, address: 'г. Москва, Ленинградский пр-т, д. 39', type: 'office', spacesOccupied: 2, spacesTotal: 3, occupancy: 67, income: 3448000, expense: 580000 },
  { id: 3, address: 'г. Москва, ул. Арбат, д. 24', type: 'retail', spacesOccupied: 1, spacesTotal: 2, occupancy: 50, income: 1650000, expense: 210000 },
  { id: 4, address: 'г. Москва, ул. Садовническая, д. 82', type: 'warehouse', spacesOccupied: 2, spacesTotal: 3, occupancy: 67, income: 10950000, expense: 890000 },
  { id: 5, address: 'г. Москва, Пресненская наб., д. 10', type: 'office', spacesOccupied: 2, spacesTotal: 3, occupancy: 67, income: 5088000, expense: 720000 },
]

const initialSpaces: Space[] = [
  { id: 101, propertyId: 1, name: '101', area: 85, monthlyRate: 420000, accountNumber: '6453435434343', cadastralNumber: '77:01:0004012:1670', ceilingHeight: 3.25, renovation: 'cosmetic', spaceType: 'Офисное помещение', status: 'active', floor: '1' },
  { id: 102, propertyId: 1, name: '102', area: 62, monthlyRate: 280000, ceilingHeight: 3.1, renovation: 'cosmetic', spaceType: 'Офисное помещение', status: 'active', floor: '1' },
  { id: 103, propertyId: 1, name: '202', area: 120, monthlyRate: 540000, ceilingHeight: 3.4, renovation: 'design', spaceType: 'Офисное помещение', status: 'active', floor: '2' },
  { id: 104, propertyId: 1, name: '203', area: 95, monthlyRate: 450000, ceilingHeight: 3.2, renovation: 'cosmetic', spaceType: 'Офисное помещение', status: 'vacant', floor: '2' },
  { id: 201, propertyId: 2, name: 'A-01', area: 340, monthlyRate: 1890000 },
  { id: 202, propertyId: 2, name: 'A-02', area: 280, monthlyRate: 1600000 },
  { id: 203, propertyId: 2, name: 'A-03', area: 210, monthlyRate: 1200000 },
  { id: 301, propertyId: 3, name: 'R-1', area: 150, monthlyRate: 1650000 },
  { id: 302, propertyId: 3, name: 'R-2', area: 110, monthlyRate: 900000 },
  { id: 401, propertyId: 4, name: 'WH-1', area: 2400, monthlyRate: 6000000 },
  { id: 402, propertyId: 4, name: 'WH-2', area: 1800, monthlyRate: 4500000 },
  { id: 403, propertyId: 4, name: 'WH-3', area: 1600, monthlyRate: 4000000 },
  { id: 501, propertyId: 5, name: 'B-01', area: 420, monthlyRate: 2800000 },
  { id: 502, propertyId: 5, name: 'B-02', area: 380, monthlyRate: 2400000 },
  { id: 503, propertyId: 5, name: 'B-03', area: 290, monthlyRate: 1900000 },
]

const initialTenants: Tenant[] = [
  { id: 1, company: 'ООО «ТехноСофт»', inn: '7707083893', propertyId: 1, space: '101', rent: 420000, contract: '2026-12-31', status: 'active' },
  { id: 2, company: 'АО «МедиаГрупп»', inn: '7710140679', propertyId: 1, space: '102', rent: 272000, contract: '2025-05-31', status: 'expiring' },
  { id: 3, company: 'ООО «ФинансКонсалт»', inn: '7728168971', propertyId: 1, space: '202', rent: 540000, contract: '2025-02-28', status: 'expiring' },
  { id: 4, company: 'ООО «Инновации Плюс»', inn: '7701234567', propertyId: 2, space: 'A-01', rent: 1890000, contract: '2025-01-14', status: 'active' },
  { id: 5, company: 'ООО «ЛогистикПро»', inn: '7702345678', propertyId: 2, space: 'A-02', rent: 1558000, contract: '2024-08-31', status: 'overdue' },
  { id: 6, company: 'ООО «СкладСервис»', inn: '7704567890', propertyId: 4, space: 'WH-1', rent: 6000000, contract: '2026-03-31', status: 'active' },
  { id: 7, company: 'ООО «РитейлМаркет»', inn: '7703456789', propertyId: 3, space: 'R-1', rent: 1650000, contract: '2026-06-30', status: 'active' },
  { id: 8, company: 'ООО «БизнесЦентр»', inn: '7705678901', propertyId: 5, space: 'B-01', rent: 2800000, contract: '2025-11-30', status: 'active' },
  { id: 9, company: 'ООО «ПремиумОфис»', inn: '7706789012', propertyId: 5, space: 'B-02', rent: 2288000, contract: '2026-01-15', status: 'active' },
]

function recalcPropertyStats(property: Property, propertyTenants: Tenant[]) {
  const occupiedSpaces = new Set(propertyTenants.map((t) => t.space))
  property.spacesOccupied = occupiedSpaces.size
  property.occupancy = property.spacesTotal > 0
    ? Math.round((property.spacesOccupied / property.spacesTotal) * 100)
    : 0
  property.income = propertyTenants.reduce((sum, t) => sum + t.rent, 0)
}

function attachPendingDocuments(docs: PendingDocument[], entityType: DocumentEntityType, entityId: number) {
  const store_docs: Omit<AttachedDocument, 'id' | 'uploadedAt'>[] = docs.map((d) => ({
    entityType,
    entityId,
    name: d.name,
    mimeType: d.mimeType,
    size: d.size,
    dataUrl: d.dataUrl,
  }))
  return store_docs
}

export const usePortfolioStore = defineStore('portfolio', () => {
  const properties = ref<Property[]>([...initialProperties])
  const spaces = ref<Space[]>([...initialSpaces])
  const tenants = ref<Tenant[]>([...initialTenants])
  const documents = ref<AttachedDocument[]>([])

  const propertyModalOpen = ref(false)
  const tenantModalOpen = ref(false)
  const tenantModalPrefill = ref<TenantModalPrefill | null>(null)
  const propertyDetailOpen = ref(false)
  const propertyDetailId = ref<number | null>(null)
  const spaceDetailOpen = ref(false)
  const spaceDetailId = ref<number | null>(null)
  const tenantDetailOpen = ref(false)
  const tenantDetailId = ref<number | null>(null)

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

  function getSpaceById(id: number) {
    return spaces.value.find((s) => s.id === id)
  }

  function getSpacesForProperty(propertyId: number) {
    return spaces.value.filter((s) => s.propertyId === propertyId)
  }

  function getTotalAreaForProperty(propertyId: number) {
    return getSpacesForProperty(propertyId).reduce((sum, s) => sum + s.area, 0)
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

  function getDocuments(entityType: DocumentEntityType, entityId: number) {
    return documents.value.filter((d) => d.entityType === entityType && d.entityId === entityId)
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

  function syncPropertyStats(propertyId: number) {
    const property = getPropertyById(propertyId)
    if (!property) return
    recalcPropertyStats(property, getTenantsForProperty(propertyId))
  }

  function addProperty(data: PropertyFormData) {
    const id = Date.now()
    const createdSpaces: Space[] = data.spaces.map((s, i) => ({
      id: id + i + 1,
      propertyId: id,
      name: s.name.trim(),
      area: s.area,
      monthlyRate: s.monthlyRate,
    }))

    properties.value.push({
      id,
      address: data.address,
      type: data.type,
      spacesOccupied: 0,
      spacesTotal: createdSpaces.length,
      occupancy: 0,
      income: 0,
      expense: 0,
    })
    spaces.value.push(...createdSpaces)

    addDocumentsBatch(attachPendingDocuments(data.documents, 'property', id))

    propertyModalOpen.value = false
  }

  function addTenant(data: TenantFormData) {
    if (!data.propertyId) return
    const existing = getTenantForSpace(data.propertyId, data.space)
    if (existing) return

    const tenantId = Date.now()
    tenants.value.push({
      id: tenantId,
      company: data.company,
      inn: data.inn,
      propertyId: data.propertyId,
      space: data.space,
      rent: data.rent,
      contract: data.contract,
      status: getTenantStatus(data.contract),
    })
    addDocumentsBatch(attachPendingDocuments(data.documents, 'tenant', tenantId))
    syncPropertyStats(data.propertyId)
    tenantModalOpen.value = false
    tenantModalPrefill.value = null
  }

  function updateSpace(id: number, data: SpaceUpdateData) {
    const space = getSpaceById(id)
    if (!space) return false

    const oldName = space.name
    space.name = data.name.trim()
    space.area = data.area
    space.monthlyRate = data.monthlyRate
    space.accountNumber = data.accountNumber.trim() || undefined
    space.cadastralNumber = data.cadastralNumber.trim() || undefined
    space.ceilingHeight = data.ceilingHeight ?? undefined
    space.renovation = data.renovation || undefined
    space.spaceType = data.spaceType.trim() || undefined
    space.status = data.status
    space.floor = data.floor.trim() || undefined

    if (space.name !== oldName) {
      const tenant = getTenantForSpace(space.propertyId, oldName)
      if (tenant) tenant.space = space.name
    }

    return true
  }

  function updateTenant(id: number, data: TenantUpdateData) {
    const tenant = getTenantById(id)
    if (!tenant) return false

    tenant.company = data.company.trim()
    tenant.inn = data.inn.trim()
    tenant.rent = data.rent
    tenant.contract = data.contract
    tenant.status = getTenantStatus(data.contract)
    syncPropertyStats(tenant.propertyId)
    return true
  }

  function openPropertyModal() {
    propertyModalOpen.value = true
  }

  function closePropertyModal() {
    propertyModalOpen.value = false
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

  function openTenantDetail(tenantId: number) {
    tenantDetailId.value = tenantId
    tenantDetailOpen.value = true
  }

  function closeTenantDetail() {
    tenantDetailOpen.value = false
    tenantDetailId.value = null
  }

  return {
    properties,
    spaces,
    tenants,
    documents,
    propertyModalOpen,
    tenantModalOpen,
    tenantModalPrefill,
    propertyDetailOpen,
    propertyDetailId,
    spaceDetailOpen,
    spaceDetailId,
    tenantDetailOpen,
    tenantDetailId,
    reportRows,
    getSpaceReportRows,
    buildSpaceReportRow,
    getPropertyById,
    getTenantById,
    getTenantsByInn,
    getLeasesByInn,
    getSpaceById,
    getSpacesForProperty,
    getTotalAreaForProperty,
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
    addProperty,
    addTenant,
    updateSpace,
    updateTenant,
    openPropertyModal,
    closePropertyModal,
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
