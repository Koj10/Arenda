<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  ChevronRight,
  FileText,
  Pencil,
  Plus,
  Trash2,
  User,
} from '@lucide/vue'
import Modal from '@/components/ui/Modal.vue'
import { RouterLink } from 'vue-router'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { useAccountingStore } from '@/stores/accountingStore'
import {
  PROPERTY_TYPE_LABELS,
  RENOVATION_LABELS,
  SPACE_STATUS_LABELS,
  INVOICE_DAYS,
  formatAreaShare,
} from '@/types/portfolio'
import { EXPENSE_CATEGORY_LABELS } from '@/types/accounting'
import type { RenovationType, SpaceStatus, SpaceUpdateData, TenantUpdateData } from '@/types/portfolio'

type MainTab = 'info' | 'persons' | 'expenses' | 'income' | 'deals' | 'competitors'
type DealTab = 'rent' | 'rates' | 'extra' | 'purchase' | 'history'

const INPUT_CLASS =
  'panel-input'

const store = usePortfolioStore()
const accounting = useAccountingStore()

const mainTab = ref<MainTab>('info')
const dealTab = ref<DealTab>('rent')
const editingInfo = ref(false)
const editingDeal = ref(false)
const infoErrors = ref<Partial<Record<keyof SpaceUpdateData, string>>>({})
const dealErrors = ref<Partial<Record<keyof TenantUpdateData, string>>>({})
const deleting = ref(false)
const deleteError = ref<string | null>(null)

const infoForm = ref<SpaceUpdateData>({
  name: '',
  area: 0,
  monthlyRate: 0,
  accountNumber: '',
  ceilingHeight: null,
  renovation: '',
  spaceType: '',
  status: 'vacant',
  floor: '',
})

const dealForm = ref<TenantUpdateData>({
  company: '',
  inn: '',
  rent: 0,
  contract: '',
  invoiceDay: 1,
})

const MAIN_TABS: { id: MainTab; label: string }[] = [
  { id: 'info', label: 'Информация' },
  { id: 'persons', label: 'Физические лица' },
  { id: 'expenses', label: 'Расходы' },
  { id: 'income', label: 'Доходы' },
  { id: 'deals', label: 'Сделки' },
  { id: 'competitors', label: 'Конкуренты' },
]

const DEAL_TABS: { id: DealTab; label: string }[] = [
  { id: 'rent', label: 'Аренда' },
  { id: 'rates', label: 'График ставок' },
  { id: 'extra', label: 'Доп. платежи' },
  { id: 'purchase', label: 'Покупка' },
  { id: 'history', label: 'История изменений' },
]

const space = computed(() =>
  store.spaceDetailId ? store.getSpaceById(store.spaceDetailId) : null,
)

const property = computed(() =>
  space.value ? store.getPropertyById(space.value.propertyId) : null,
)

const tenant = computed(() =>
  space.value && property.value
    ? store.getTenantForSpace(property.value.id, space.value.name)
    : null,
)

const propertyShort = computed(() => {
  if (!property.value) return ''
  const parts = property.value.address.split(',')
  return parts[parts.length - 1]?.trim() ?? property.value.address
})

const modalTitle = computed(() => {
  if (!space.value || !property.value) return 'Помещение'
  return `№${space.value.name}, ${store.formatArea(space.value.area)} · ${propertyShort.value}`
})

const spaceStatus = computed((): SpaceStatus => {
  if (!space.value) return 'vacant'
  if (space.value.status) return space.value.status
  return tenant.value ? 'active' : 'vacant'
})

const spaceTypeLabel = computed(() =>
  space.value?.spaceType ?? (property.value ? `${PROPERTY_TYPE_LABELS[property.value.type]}` : '—'),
)

const renovationLabel = computed(() => {
  const r = space.value?.renovation as RenovationType | undefined
  return r ? RENOVATION_LABELS[r] : '—'
})

const accountNumber = computed(() =>
  space.value?.accountNumber ?? (space.value ? `645${space.value.propertyId}${space.value.id}` : '—'),
)

const cadastralParcel = computed(() =>
  space.value?.cadastralParcelId
    ? store.getCadastralParcelById(space.value.cadastralParcelId)
    : null,
)

const ceilingHeight = computed(() =>
  space.value?.ceilingHeight ? `${space.value.ceilingHeight} м` : '—',
)

const propertyExpenses = computed(() =>
  property.value
    ? accounting.expenses.filter((e) => e.propertyId === property.value!.id)
    : [],
)

const expenseShare = computed(() =>
  property.value && property.value.spacesTotal > 0
    ? Math.round(property.value.expense / property.value.spacesTotal)
    : 0,
)

const availableArea = computed(() =>
  space.value && property.value
    ? store.getAvailableAreaForProperty(property.value.id, space.value.id)
    : 0,
)

const areaShareLabel = computed(() =>
  space.value && property.value
    ? formatAreaShare(space.value.area, property.value.totalArea)
    : '—',
)

function onClose() {
  store.closeSpaceDetail()
}

async function onDelete() {
  if (!space.value || deleting.value) return
  const occupiedNote = tenant.value
    ? `\n\nСейчас его занимает ${tenant.value.company}. Договор будет отвязан.`
    : ''
  if (!confirm(`Удалить помещение №${space.value.name}?${occupiedNote}`)) return
  deleting.value = true
  deleteError.value = null
  const ok = await store.removeSpace(space.value.id)
  deleting.value = false
  if (!ok) deleteError.value = store.lastError || 'Не удалось удалить помещение'
}

function statusLabel(status: string) {
  const map: Record<string, string> = { active: 'Активен', expiring: 'Истекает', overdue: 'Просрочен' }
  return map[status] ?? status
}

function statusClass(status: string) {
  const map: Record<string, string> = {
    active: 'text-emerald-brand bg-emerald-brand/10',
    expiring: 'text-emerald-brand bg-emerald-brand/10',
    overdue: 'text-rose-400 bg-rose-500/10',
  }
  return map[status] ?? ''
}

function addTenant() {
  if (!property.value || !space.value) return
  store.openTenantModal({ propertyId: property.value.id, space: space.value.name })
}

function openTenantDetail() {
  if (tenant.value) store.openTenantDetail(tenant.value.id, tenant.value.leaseId)
}

function resetEditing() {
  editingInfo.value = false
  editingDeal.value = false
  infoErrors.value = {}
  dealErrors.value = {}
}

function fillInfoForm() {
  if (!space.value) return
  infoForm.value = {
    name: space.value.name,
    area: space.value.area,
    monthlyRate: space.value.monthlyRate,
    accountNumber: space.value.accountNumber ?? `645${space.value.propertyId}${space.value.id}`,
    ceilingHeight: space.value.ceilingHeight ?? null,
    renovation: space.value.renovation ?? '',
    spaceType: space.value.spaceType ?? '',
    status: space.value.status ?? (tenant.value ? 'active' : 'vacant'),
    floor: space.value.floor ?? '',
  }
}

function fillDealForm() {
  if (!tenant.value) return
  dealForm.value = {
    company: tenant.value.company,
    inn: tenant.value.inn,
    rent: tenant.value.rent,
    contract: tenant.value.contract,
    invoiceDay: tenant.value.invoiceDay || 1,
  }
}

function startEditInfo() {
  fillInfoForm()
  editingInfo.value = true
  editingDeal.value = false
}

function cancelEditInfo() {
  editingInfo.value = false
  infoErrors.value = {}
}

function validateInfo() {
  infoErrors.value = {}
  if (!infoForm.value.name.trim()) infoErrors.value.name = 'Укажите номер помещения'
  if (infoForm.value.area <= 0) infoErrors.value.area = 'Укажите площадь'
  if (space.value && property.value) {
    const maxArea = store.getAvailableAreaForProperty(property.value.id, space.value.id)
    if (infoForm.value.area > maxArea) {
      infoErrors.value.area = `Максимум ${maxArea} м²`
    }
  }
  if (infoForm.value.monthlyRate < 0) infoErrors.value.monthlyRate = 'Ставка не может быть отрицательной'
  return Object.keys(infoErrors.value).length === 0
}

async function saveInfo() {
  if (!space.value || !validateInfo()) return
  const ok = await store.updateSpace(space.value.id, { ...infoForm.value })
  if (!ok) {
    infoErrors.value.area = store.lastError || 'Площадь превышает доступный остаток объекта'
    return
  }
  editingInfo.value = false
}

function startEditDeal() {
  if (!tenant.value) {
    addTenant()
    return
  }
  fillDealForm()
  dealTab.value = 'rent'
  editingDeal.value = true
  editingInfo.value = false
}

function cancelEditDeal() {
  editingDeal.value = false
  dealErrors.value = {}
}

function validateDeal() {
  dealErrors.value = {}
  if (!dealForm.value.company.trim()) dealErrors.value.company = 'Укажите название'
  if (!/^\d{10}$|^\d{12}$/.test(dealForm.value.inn)) dealErrors.value.inn = 'ИНН: 10 или 12 цифр'
  if (dealForm.value.rent <= 0) dealErrors.value.rent = 'Укажите сумму аренды'
  if (!dealForm.value.contract) dealErrors.value.contract = 'Укажите дату окончания'
  if (dealForm.value.invoiceDay < 1 || dealForm.value.invoiceDay > 31) {
    dealErrors.value.invoiceDay = 'День от 1 до 31'
  }
  return Object.keys(dealErrors.value).length === 0
}

async function saveDeal() {
  if (!tenant.value || !validateDeal()) return
  const ok = await store.updateTenant(tenant.value.id, { ...dealForm.value }, tenant.value.leaseId)
  if (!ok) {
    dealErrors.value.company = store.lastError || 'Не удалось сохранить'
    return
  }
  editingDeal.value = false
}

const ratesSaving = ref(false)
const ratesError = ref<string | null>(null)
const ratesInvoiceDay = ref(1)

watch(
  tenant,
  (value) => {
    ratesInvoiceDay.value = value?.invoiceDay || 1
    ratesError.value = null
  },
  { immediate: true },
)

async function saveRatesSchedule() {
  if (!tenant.value) return
  ratesSaving.value = true
  ratesError.value = null
  const ok = await store.updateTenant(
    tenant.value.id,
    {
      company: tenant.value.company,
      inn: tenant.value.inn,
      rent: tenant.value.rent,
      contract: tenant.value.contract,
      invoiceDay: ratesInvoiceDay.value,
    },
    tenant.value.leaseId,
  )
  ratesSaving.value = false
  if (!ok) ratesError.value = store.lastError || 'Не удалось сохранить график'
}

watch(
  () => store.spaceDetailOpen,
  (open) => {
    if (!open) {
      resetEditing()
      deleting.value = false
      deleteError.value = null
    }
  },
)
</script>

<template>
  <Modal
    :open="store.spaceDetailOpen && !!space && !!property"
    size="3xl"
    :z-index="110"
    @close="onClose"
  >
    <template #header>
      <div class="min-w-0 flex-1">
        <p class="text-xs text-slate-500 mb-1 flex items-center gap-1">
          <span>Объекты</span>
          <ChevronRight class="w-3 h-3" />
          <span class="truncate">{{ property?.address }}</span>
        </p>
        <h2 class="text-lg font-semibold text-white truncate">{{ modalTitle }}</h2>
      </div>
    </template>

    <template v-if="space && property">
      <!-- Main tabs -->
      <nav class="flex gap-1 overflow-x-auto border-b border-border -mx-1 mb-5 pb-px">
        <button
          v-for="tab in MAIN_TABS"
          :key="tab.id"
          type="button"
          class="px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors -mb-px"
          :class="
            mainTab === tab.id
              ? 'border-emerald-brand text-emerald-brand font-medium'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          "
          @click="mainTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </nav>

      <!-- Информация -->
      <div v-if="mainTab === 'info'" class="space-y-5">
        <!-- Основная информация -->
        <section class="panel-section">
          <div class="flex items-center justify-between px-4 py-3 border-b border-border gap-2">
            <h3 class="text-sm font-semibold text-white">Основная информация</h3>
            <div v-if="editingInfo" class="flex items-center gap-2">
              <button type="button" class="panel-btn-secondary text-xs py-1.5 px-3" @click="cancelEditInfo">
                Отмена
              </button>
              <button type="button" class="panel-btn-primary text-xs py-1.5 px-3" @click="saveInfo">
                Сохранить
              </button>
            </div>
            <button
              v-else
              type="button"
              class="p-1.5 rounded-lg text-emerald-brand hover:bg-card-hover transition-colors"
              title="Редактировать"
              @click="startEditInfo"
            >
              <Pencil class="w-4 h-4" />
            </button>
          </div>

          <div v-if="editingInfo" class="p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">
            <div>
              <label class="block text-xs text-slate-500 mb-1">Номер помещения</label>
              <input v-model="infoForm.name" type="text" :class="[INPUT_CLASS, { 'border-red-500': infoErrors.name }]" />
              <p v-if="infoErrors.name" class="text-xs text-red-400 mt-1">{{ infoErrors.name }}</p>
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1">Площадь, м²</label>
              <input v-model.number="infoForm.area" type="number" min="0" step="0.1" :class="[INPUT_CLASS, { 'border-red-500': infoErrors.area }]" />
              <p v-if="infoErrors.area" class="text-xs text-red-400 mt-1">{{ infoErrors.area }}</p>
              <p v-else-if="property" class="text-xs text-slate-500 mt-1 font-mono">
                из {{ property.totalArea }} м² объекта · свободно {{ availableArea }} м²
              </p>
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1">Базовая ставка, ₽</label>
              <input v-model.number="infoForm.monthlyRate" type="number" min="0" :class="[INPUT_CLASS, { 'border-red-500': infoErrors.monthlyRate }]" />
              <p v-if="infoErrors.monthlyRate" class="text-xs text-red-400 mt-1">{{ infoErrors.monthlyRate }}</p>
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1">Лицевой счёт</label>
              <input v-model="infoForm.accountNumber" type="text" :class="INPUT_CLASS" />
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1">Статус помещения</label>
              <select v-model="infoForm.status" :class="INPUT_CLASS">
                <option v-for="(label, key) in SPACE_STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1">Тип помещения</label>
              <input v-model="infoForm.spaceType" type="text" placeholder="Офисное помещение" :class="INPUT_CLASS" />
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1">Высота потолков, м</label>
              <input v-model.number="infoForm.ceilingHeight" type="number" min="0" step="0.01" :class="INPUT_CLASS" />
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1">Ремонт</label>
              <select v-model="infoForm.renovation" :class="INPUT_CLASS">
                <option value="">—</option>
                <option v-for="(label, key) in RENOVATION_LABELS" :key="key" :value="key">{{ label }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1">Этаж</label>
              <input v-model="infoForm.floor" type="text" placeholder="1" :class="INPUT_CLASS" />
            </div>
            <div class="sm:col-span-2 lg:col-span-3">
              <p class="text-xs text-slate-500">Адрес объекта: {{ property.address }}</p>
            </div>
          </div>

          <div v-else class="p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
            <div>
              <p class="text-xs text-slate-500 mb-1">Объект</p>
              <p class="text-sm text-emerald-brand">{{ propertyShort }}</p>
            </div>
            <div class="sm:col-span-2">
              <p class="text-xs text-slate-500 mb-1">Адрес</p>
              <p class="text-sm text-slate-200">{{ property.address }}</p>
            </div>
            <div>
              <p class="text-xs text-slate-500 mb-1">Кадастровый номер</p>
              <template v-if="cadastralParcel">
                <p class="text-sm font-mono text-slate-200">{{ cadastralParcel.cadastralNumber }}</p>
                <p class="text-xs text-slate-500 mt-0.5">
                  {{ store.formatMoney(cadastralParcel.cadastralValue) }} · {{ store.formatArea(cadastralParcel.area) }}
                </p>
              </template>
              <template v-else-if="property">
                <p class="text-sm text-amber-400/90">Не привязано</p>
                <RouterLink
                  :to="{ path: '/landlord/cadastral', query: { property: property.id } }"
                  class="text-xs text-emerald-brand hover:underline"
                  @click="onClose"
                >
                  Привязать в разделе «Кадастр»
                </RouterLink>
              </template>
            </div>
            <div>
              <p class="text-xs text-slate-500 mb-1">Лицевой счёт</p>
              <p class="text-sm font-mono text-slate-200">{{ accountNumber }}</p>
            </div>
            <div>
              <p class="text-xs text-slate-500 mb-1">Статус помещения</p>
              <p class="text-sm text-slate-200">{{ SPACE_STATUS_LABELS[spaceStatus] }}</p>
            </div>
            <div>
              <p class="text-xs text-slate-500 mb-1">Тип помещения</p>
              <p class="text-sm text-slate-200">{{ spaceTypeLabel }}</p>
            </div>
            <div>
              <p class="text-xs text-slate-500 mb-1">Площадь</p>
              <p class="text-sm font-mono text-slate-200">{{ areaShareLabel }}</p>
              <p v-if="property" class="text-xs text-slate-500 mt-0.5">
                {{ Math.round((space.area / property.totalArea) * 100) }}% объекта
              </p>
            </div>
            <div>
              <p class="text-xs text-slate-500 mb-1">Высота потолков</p>
              <p class="text-sm text-slate-200">{{ ceilingHeight }}</p>
            </div>
            <div>
              <p class="text-xs text-slate-500 mb-1">Ремонт</p>
              <p class="text-sm text-slate-200">{{ renovationLabel }}</p>
            </div>
            <div v-if="space.floor">
              <p class="text-xs text-slate-500 mb-1">Этаж</p>
              <p class="text-sm text-slate-200">{{ space.floor }}</p>
            </div>
            <div>
              <p class="text-xs text-slate-500 mb-1">Базовая ставка</p>
              <p class="text-sm font-mono text-emerald-brand">{{ store.formatMoney(space.monthlyRate) }}/мес</p>
            </div>
          </div>
        </section>

        <!-- Текущая сделка -->
        <section class="panel-section">
          <div class="flex items-center justify-between px-4 py-3 border-b border-border gap-2">
            <h3 class="text-sm font-semibold text-white">Текущая сделка</h3>
            <div v-if="editingDeal && tenant" class="flex items-center gap-2">
              <button type="button" class="panel-btn-secondary text-xs py-1.5 px-3" @click="cancelEditDeal">
                Отмена
              </button>
              <button type="button" class="panel-btn-primary text-xs py-1.5 px-3" @click="saveDeal">
                Сохранить
              </button>
            </div>
            <button
              v-else
              type="button"
              class="p-1.5 rounded-lg text-emerald-brand hover:bg-card-hover transition-colors"
              :title="tenant ? 'Редактировать' : 'Добавить арендатора'"
              @click="startEditDeal"
            >
              <Pencil v-if="tenant" class="w-4 h-4" />
              <Plus v-else class="w-4 h-4" />
            </button>
          </div>

          <nav class="flex gap-1 overflow-x-auto px-4 pt-3 border-b border-border">
            <button
              v-for="tab in DEAL_TABS"
              :key="tab.id"
              type="button"
              class="px-3 py-2 text-xs whitespace-nowrap border-b-2 transition-colors -mb-px"
              :class="
                dealTab === tab.id
                  ? 'border-emerald-brand text-emerald-brand font-medium'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              "
              @click="dealTab = tab.id"
            >
              {{ tab.label }}
            </button>
          </nav>

          <div class="p-4">
            <template v-if="dealTab === 'rent'">
              <div v-if="editingDeal && tenant" class="space-y-3">
                <p class="text-xs font-medium uppercase tracking-wide text-slate-500">Арендатор</p>
                <div class="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs text-slate-500 mb-1">Юр. лицо</label>
                    <input v-model="dealForm.company" type="text" :class="[INPUT_CLASS, { 'border-red-500': dealErrors.company }]" />
                    <p v-if="dealErrors.company" class="text-xs text-red-400 mt-1">{{ dealErrors.company }}</p>
                  </div>
                  <div>
                    <label class="block text-xs text-slate-500 mb-1">ИНН</label>
                    <input v-model="dealForm.inn" type="text" :class="[INPUT_CLASS, { 'border-red-500': dealErrors.inn }]" />
                    <p v-if="dealErrors.inn" class="text-xs text-red-400 mt-1">{{ dealErrors.inn }}</p>
                  </div>
                  <div>
                    <label class="block text-xs text-slate-500 mb-1">Аренда / мес, ₽</label>
                    <input v-model.number="dealForm.rent" type="number" min="0" :class="[INPUT_CLASS, { 'border-red-500': dealErrors.rent }]" />
                    <p v-if="dealErrors.rent" class="text-xs text-red-400 mt-1">{{ dealErrors.rent }}</p>
                  </div>
                  <div>
                    <label class="block text-xs text-slate-500 mb-1">Договор до</label>
                    <input v-model="dealForm.contract" type="date" :class="[INPUT_CLASS, { 'border-red-500': dealErrors.contract }]" />
                    <p v-if="dealErrors.contract" class="text-xs text-red-400 mt-1">{{ dealErrors.contract }}</p>
                  </div>
                  <div class="sm:col-span-2">
                    <label class="block text-xs text-slate-500 mb-1">Счёт за аренду</label>
                    <select v-model.number="dealForm.invoiceDay" :class="[INPUT_CLASS, { 'border-red-500': dealErrors.invoiceDay }]">
                      <option v-for="day in INVOICE_DAYS" :key="day" :value="day">{{ day }}-е число каждого месяца</option>
                    </select>
                    <p v-if="dealErrors.invoiceDay" class="text-xs text-red-400 mt-1">{{ dealErrors.invoiceDay }}</p>
                  </div>
                </div>
              </div>
              <div v-else-if="tenant" class="space-y-4">
                <p class="text-xs font-medium uppercase tracking-wide text-slate-500">Арендатор</p>
                <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                  <div>
                    <p class="text-xs text-slate-500 mb-1">Юр. лицо</p>
                    <button
                      type="button"
                      class="text-sm text-emerald-brand hover:underline text-left"
                      @click="openTenantDetail"
                    >
                      {{ tenant.company }}
                    </button>
                  </div>
                  <div>
                    <p class="text-xs text-slate-500 mb-1">ИНН</p>
                    <p class="text-sm font-mono text-slate-200">{{ tenant.inn }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-slate-500 mb-1">Аренда / мес</p>
                    <p class="text-sm font-mono text-emerald-brand">{{ store.formatMoney(tenant.rent) }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-slate-500 mb-1">Договор до</p>
                    <p class="text-sm font-mono text-slate-200">{{ store.formatDate(tenant.contract) }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-slate-500 mb-1">Счёт за аренду</p>
                    <p class="text-sm text-slate-200">{{ tenant.invoiceDay || 1 }}-е число каждого месяца</p>
                  </div>
                  <div>
                    <p class="text-xs text-slate-500 mb-1">Статус</p>
                    <span class="inline-flex px-2 py-0.5 rounded text-xs font-medium" :class="statusClass(tenant.status)">
                      {{ statusLabel(tenant.status) }}
                    </span>
                  </div>
                  <div>
                    <p class="text-xs text-slate-500 mb-1">Категория</p>
                    <p class="text-sm text-slate-200">{{ PROPERTY_TYPE_LABELS[property.type] }}</p>
                  </div>
                </div>
              </div>
              <div v-else class="text-center py-8">
                <User class="w-8 h-8 text-slate-600 mx-auto mb-3" />
                <p class="text-sm text-slate-400 mb-1">Помещение свободно</p>
                <p class="text-xs text-slate-500 mb-4">Ставка {{ store.formatMoney(space.monthlyRate) }}/мес · {{ store.formatArea(space.area) }}</p>
                <button
                  type="button"
                  class="panel-btn-primary"
                  @click="addTenant"
                >
                  <Plus class="w-4 h-4" />
                  Добавить арендатора
                </button>
              </div>
            </template>

            <template v-else-if="dealTab === 'rates'">
              <div class="grid sm:grid-cols-2 gap-4">
                <div class="rounded-lg border border-border bg-panel p-3">
                  <p class="text-xs text-slate-500 mb-1">Текущая ставка</p>
                  <p class="text-lg font-mono text-emerald-brand">{{ store.formatMoney(tenant?.rent ?? space.monthlyRate) }}</p>
                </div>
                <div class="rounded-lg border border-border bg-panel p-3">
                  <p class="text-xs text-slate-500 mb-1">Базовая ставка помещения</p>
                  <p class="text-lg font-mono text-slate-200">{{ store.formatMoney(space.monthlyRate) }}</p>
                </div>
              </div>
              <div v-if="tenant" class="mt-4 rounded-lg border border-border bg-panel p-4">
                <p class="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">График выставления счёта</p>
                <div class="flex flex-col sm:flex-row sm:items-end gap-3">
                  <div class="flex-1">
                    <label class="block text-xs text-slate-500 mb-1.5">День месяца</label>
                    <select v-model.number="ratesInvoiceDay" class="panel-input">
                      <option v-for="day in INVOICE_DAYS" :key="day" :value="day">{{ day }}-е число каждого месяца</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    class="panel-btn-primary"
                    :disabled="ratesSaving || ratesInvoiceDay === tenant.invoiceDay"
                    @click="saveRatesSchedule"
                  >
                    {{ ratesSaving ? 'Сохранение…' : 'Сохранить' }}
                  </button>
                </div>
                <p class="text-xs text-slate-500 mt-2">
                  В этот день каждый месяц арендатору приходит счёт за аренду. Если в месяце меньше дней — в последний день месяца.
                </p>
                <p v-if="ratesError" class="text-xs text-red-400 mt-2">{{ ratesError }}</p>
              </div>
              <p v-else class="text-xs text-slate-500 mt-4">Добавьте арендатора, чтобы задать график выставления счёта</p>
            </template>

            <template v-else-if="dealTab === 'extra'">
              <p class="text-sm text-slate-500 text-center py-6">Дополнительные платежи не настроены</p>
            </template>

            <template v-else-if="dealTab === 'purchase'">
              <p class="text-sm text-slate-500 text-center py-6">Условия покупки не заданы</p>
            </template>

            <template v-else>
              <p class="text-sm text-slate-500 text-center py-6">История изменений пока пуста</p>
            </template>
          </div>
        </section>
      </div>

      <!-- Физические лица -->
      <div v-else-if="mainTab === 'persons'" class="py-4">
        <div v-if="tenant" class="rounded-xl border border-border bg-panel/20 p-4">
          <p class="text-xs font-medium uppercase tracking-wide text-slate-500 mb-4">Контактные лица арендатора</p>
          <div class="grid sm:grid-cols-2 gap-4">
            <div>
              <p class="text-xs text-slate-500 mb-1">Компания</p>
              <p class="text-sm text-slate-200">{{ tenant.company }}</p>
            </div>
            <div>
              <p class="text-xs text-slate-500 mb-1">ИНН</p>
              <p class="text-sm font-mono text-slate-200">{{ tenant.inn }}</p>
            </div>
          </div>
          <p class="text-xs text-slate-500 mt-4">Подробные контакты физических лиц — в карточке арендатора</p>
          <button
            type="button"
            class="mt-3 text-sm text-emerald-brand hover:underline"
            @click="openTenantDetail"
          >
            Открыть карточку арендатора
          </button>
        </div>
        <p v-else class="text-sm text-slate-500 text-center py-10">Нет привязанного арендатора</p>
      </div>

      <!-- Расходы -->
      <div v-else-if="mainTab === 'expenses'">
        <div class="flex items-center justify-between mb-4">
          <p class="text-sm text-slate-400">
            Расходы объекта · доля помещения ≈ {{ store.formatMoney(expenseShare) }}/мес
          </p>
        </div>
        <div v-if="propertyExpenses.length" class="rounded-xl border border-border overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-border bg-panel/30">
                <th class="px-3 py-2 font-medium">Дата</th>
                <th class="px-3 py-2 font-medium">Название</th>
                <th class="px-3 py-2 font-medium hidden sm:table-cell">Категория</th>
                <th class="px-3 py-2 font-medium">Сумма</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="expense in propertyExpenses"
                :key="expense.id"
                class="border-b border-border/80 last:border-0"
              >
                <td class="px-3 py-2.5 font-mono text-xs text-slate-400">{{ accounting.formatDate(expense.date) }}</td>
                <td class="px-3 py-2.5 text-slate-200">{{ expense.title }}</td>
                <td class="px-3 py-2.5 text-slate-400 text-xs hidden sm:table-cell">{{ EXPENSE_CATEGORY_LABELS[expense.category] }}</td>
                <td class="px-3 py-2.5 font-mono text-rose-400/90">{{ accounting.formatMoney(expense.amount) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="text-sm text-slate-500 text-center py-10 rounded-xl border border-dashed border-border">
          Расходов по этому объекту пока нет
        </p>
      </div>

      <!-- Доходы -->
      <div v-else-if="mainTab === 'income'">
        <div v-if="tenant" class="grid sm:grid-cols-3 gap-4 mb-4">
          <div class="rounded-xl border border-border bg-panel/20 p-4">
            <p class="text-xs text-slate-500 mb-1">Аренда / мес</p>
            <p class="text-xl font-mono text-emerald-brand">{{ store.formatMoney(tenant.rent) }}</p>
          </div>
          <div class="rounded-xl border border-border bg-panel/20 p-4">
            <p class="text-xs text-slate-500 mb-1">Ставка помещения</p>
            <p class="text-xl font-mono text-slate-200">{{ store.formatMoney(space.monthlyRate) }}</p>
          </div>
          <div class="rounded-xl border border-border bg-panel/20 p-4">
            <p class="text-xs text-slate-500 mb-1">Площадь</p>
            <p class="text-xl font-mono text-slate-200">{{ store.formatArea(space.area) }}</p>
          </div>
        </div>
        <p v-else class="text-sm text-slate-500 text-center py-10">Доходов нет — помещение свободно</p>
      </div>

      <!-- Сделки -->
      <div v-else-if="mainTab === 'deals'">
        <div v-if="tenant" class="rounded-xl border border-border overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-border bg-panel/30">
                <th class="px-3 py-2 font-medium">Арендатор</th>
                <th class="px-3 py-2 font-medium">Аренда</th>
                <th class="px-3 py-2 font-medium">До</th>
                <th class="px-3 py-2 font-medium">Статус</th>
              </tr>
            </thead>
            <tbody>
              <tr class="border-b border-border/80">
                <td class="px-3 py-2.5">
                  <button type="button" class="text-slate-200 hover:text-emerald-brand" @click="openTenantDetail">
                    {{ tenant.company }}
                  </button>
                </td>
                <td class="px-3 py-2.5 font-mono text-slate-400">{{ store.formatMoney(tenant.rent) }}</td>
                <td class="px-3 py-2.5 font-mono text-xs text-slate-400">{{ store.formatDate(tenant.contract) }}</td>
                <td class="px-3 py-2.5">
                  <span class="inline-flex px-2 py-0.5 rounded text-xs font-medium" :class="statusClass(tenant.status)">
                    {{ statusLabel(tenant.status) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="text-center py-10">
          <FileText class="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p class="text-sm text-slate-500 mb-4">Активных сделок нет</p>
          <button
            type="button"
            class="panel-btn-primary"
            @click="addTenant"
          >
            <Plus class="w-4 h-4" />
            Заключить договор
          </button>
        </div>
      </div>

      <!-- Конкуренты -->
      <div v-else class="text-sm text-slate-500 text-center py-12 rounded-xl border border-dashed border-border">
        Раздел «Конкуренты» в разработке
      </div>
    </template>

    <template #footer>
      <p v-if="deleteError" class="text-xs text-rose-400 mr-auto">{{ deleteError }}</p>
      <button
        type="button"
        class="panel-btn-secondary text-rose-400 hover:text-rose-300 hover:border-rose-400/40"
        :disabled="deleting"
        @click="onDelete"
      >
        <Trash2 class="w-4 h-4" />
        {{ deleting ? 'Удаление...' : 'Удалить помещение' }}
      </button>
      <button type="button" class="panel-btn-secondary" @click="onClose">
        Закрыть
      </button>
    </template>
  </Modal>
</template>
