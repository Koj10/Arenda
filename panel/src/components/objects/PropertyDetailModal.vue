<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  Building2,
  ChevronRight,
  Download,
  MapPin,
  Plus,
  Landmark,
  Trash2,
  Calendar as CalendarIcon,
  FileText,
} from '@lucide/vue'
import Modal from '@/components/ui/Modal.vue'
import FileAttachments from '@/components/ui/FileAttachments.vue'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { useUtilityBillsStore } from '@/stores/utilityBillsStore'
import { PROPERTY_TYPE_LABELS, PROPERTY_DOCUMENT_LABELS, formatAreaShare } from '@/types/portfolio'
import type { AttachedDocument } from '@/types/portfolio'
import { usePlan } from '@/composables/usePlan'
import { downloadDocumentsArchive } from '@/composables/useDocuments'
import { formatDateRu } from '@/utils/dates'

type PropertyTab = 'spaces' | 'documents' | 'bills'

const store = usePortfolioStore()
const utilityBills = useUtilityBillsStore()
const { canAddSpace, requireCanAddSpace } = usePlan()

const activeTab = ref<PropertyTab>('spaces')
const downloadingAll = ref(false)
const downloadingBills = ref(false)
const downloadError = ref<string | null>(null)
const billDownloadError = ref<string | null>(null)
const deletingSpaceId = ref<number | null>(null)
const spaceDeleteError = ref<string | null>(null)
const deletingProperty = ref(false)
const propertyDeleteError = ref<string | null>(null)

const billPeriodFilter = ref<string>('')

const property = computed(() =>
  store.propertyDetailId ? store.getPropertyById(store.propertyDetailId) : null,
)

const parcels = computed(() =>
  property.value ? store.getCadastralParcelsForProperty(property.value.id) : [],
)

const spaces = computed(() =>
  property.value ? store.getSpacesWithTenants(property.value.id) : [],
)

const propertyDocuments = computed(() =>
  property.value ? store.getDocuments('property', property.value.id) : [],
)

const propertyBills = computed(() =>
  property.value ? utilityBills.getBillsForProperty(property.value.id) : [],
)

const filteredPropertyBills = computed(() => {
  const list = propertyBills.value
  if (!billPeriodFilter.value) return list
  return list.filter((b) => b.period === billPeriodFilter.value)
})

const billPeriods = computed(() => {
  const set = new Set<string>()
  for (const b of propertyBills.value) set.add(b.period)
  return [...set].sort().reverse()
})

const spacesAreaTotal = computed(() =>
  property.value ? store.getTotalAreaForProperty(property.value.id) : 0,
)

const availableArea = computed(() =>
  property.value ? store.getAvailableAreaForProperty(property.value.id) : 0,
)

const totalCadastralValue = computed(() =>
  property.value ? store.getTotalCadastralValueForProperty(property.value.id) : 0,
)

const TABS: { id: PropertyTab; label: string }[] = [
  { id: 'spaces', label: 'Помещения' },
  { id: 'bills', label: 'Счета' },
  { id: 'documents', label: 'Документы' },
]

function formatPeriod(period: string) {
  const [y, m] = period.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(d)
}

async function onDownloadBillDocuments() {
  if (!property.value || !filteredPropertyBills.value.length || downloadingBills.value) return
  downloadingBills.value = true
  billDownloadError.value = null
  const propId = property.value.id
  try {
    type BillDoc = { name?: string; dataUrl?: string; mimeType?: string; size?: number }
    const docs: AttachedDocument[] = []
    for (const b of filteredPropertyBills.value) {
      const docMaybe = (b as unknown as { document?: BillDoc }).document
      if (!docMaybe?.dataUrl) continue
      docs.push({
        id: Number(b.id) || Date.now() + Math.floor(Math.random() * 10000),
        entityType: 'property',
        entityId: propId,
        category: 'service',
        name: docMaybe.name || `Счёт_${b.period}_${b.id}.pdf`,
        mimeType: docMaybe.mimeType || 'application/pdf',
        size: docMaybe.size || 0,
        uploadedAt: b.issuedAt || new Date().toISOString().slice(0, 10),
        dataUrl: docMaybe.dataUrl,
      })
    }
    if (!docs.length) {
      billDownloadError.value = 'Нет прикрепленных PDF к этим счетам для выгрузки'
      return
    }
    const ok = await downloadDocumentsArchive(docs, `Счета — ${property.value.address} — ${billPeriodFilter.value || 'все периоды'}`)
    if (!ok) billDownloadError.value = 'Нет документов для выгрузки'
  } catch {
    billDownloadError.value = 'Не удалось собрать архив счетов'
  } finally {
    downloadingBills.value = false
  }
}

function onClose() {
  activeTab.value = 'spaces'
  billPeriodFilter.value = ''
  downloadError.value = null
  billDownloadError.value = null
  spaceDeleteError.value = null
  propertyDeleteError.value = null
  store.closePropertyDetail()
}

function openSpace(spaceId: number) {
  store.openSpaceDetail(spaceId)
}

async function onDeleteSpace(space: (typeof spaces.value)[number], e: Event) {
  e.stopPropagation()
  e.preventDefault()
  if (deletingSpaceId.value) return
  const occupiedNote = space.occupied && space.tenant
    ? `\n\nСейчас его занимает ${space.tenant.company}. Договор будет отвязан.`
    : ''
  if (!confirm(`Удалить помещение №${space.name}?${occupiedNote}`)) return
  deletingSpaceId.value = space.id
  spaceDeleteError.value = null
  const ok = await store.removeSpace(space.id)
  deletingSpaceId.value = null
  if (!ok) spaceDeleteError.value = store.lastError || 'Не удалось удалить помещение'
}

async function onDeleteProperty() {
  if (!property.value || deletingProperty.value) return
  const extra = property.value.spacesTotal
    ? `\n\nБудут удалены помещения (${property.value.spacesTotal}) и связанные данные объекта.`
    : ''
  if (!confirm(`Удалить объект «${property.value.address}»?${extra}`)) return
  deletingProperty.value = true
  propertyDeleteError.value = null
  const ok = await store.removeProperty(property.value.id)
  deletingProperty.value = false
  if (!ok) propertyDeleteError.value = store.lastError || 'Не удалось удалить объект'
}

function onAddSpace() {
  if (!property.value) return
  if (!requireCanAddSpace(property.value.id)) return
  store.openSpaceModal(property.value.id)
}

async function onDownloadAllDocuments() {
  if (!property.value || !propertyDocuments.value.length || downloadingAll.value) return
  downloadingAll.value = true
  downloadError.value = null
  try {
    const ok = await downloadDocumentsArchive(
      propertyDocuments.value,
      `Документы — ${property.value.address}`,
    )
    if (!ok) downloadError.value = 'Нет документов для выгрузки'
  } catch {
    downloadError.value = 'Не удалось собрать архив'
  } finally {
    downloadingAll.value = false
  }
}

function areaShareLabel(spaceArea: number) {
  if (!property.value) return ''
  return formatAreaShare(spaceArea, property.value.totalArea)
}

function occupancyClass(occupied: boolean) {
  return occupied
    ? 'text-emerald-brand bg-emerald-brand/10'
    : 'text-slate-400 bg-panel'
}
</script>

<template>
  <Modal
    :open="store.propertyDetailOpen && !!property"
    :title="property?.address ?? 'Объект'"
    size="xl"
    @close="onClose"
  >
    <template v-if="property">
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-panel text-xs text-slate-300">
          <Building2 class="w-3.5 h-3.5 text-emerald-brand" />
          {{ PROPERTY_TYPE_LABELS[property.type] }}
        </span>
        <span class="text-xs text-slate-500 font-mono">
          {{ property.spacesOccupied }} / {{ property.spacesTotal }} занято · {{ property.occupancy }}%
        </span>
        <span class="text-xs text-emerald-brand font-mono">{{ store.formatMoney(property.income) }}/мес</span>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5 p-4 rounded-xl border border-border bg-panel/30">
        <div>
          <p class="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Общая площадь</p>
          <p class="text-sm font-mono text-white">{{ store.formatArea(property.totalArea) }}</p>
          <p class="text-[10px] text-slate-500 mt-1 font-mono">
            помещения {{ store.formatArea(spacesAreaTotal) }} · свободно {{ store.formatArea(availableArea) }}
          </p>
        </div>
        <div>
          <p class="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Кадастровые номера</p>
          <p class="text-sm font-mono text-white">{{ parcels.length }}</p>
          <RouterLink
            :to="{ path: '/landlord/cadastral', query: { property: property.id } }"
            class="inline-flex items-center gap-1 text-[10px] text-emerald-brand hover:underline mt-1"
            @click="onClose"
          >
            <Landmark class="w-3 h-3" />
            Управление кадастром
          </RouterLink>
        </div>
        <div>
          <p class="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Кадастровая стоимость</p>
          <p class="text-sm font-mono text-white">{{ store.formatMoney(totalCadastralValue) }}</p>
        </div>
      </div>

      <nav class="flex gap-1 overflow-x-auto border-b border-border mb-5 -mx-1 px-1">
        <button
          v-for="tab in TABS"
          :key="tab.id"
          type="button"
          class="px-4 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors -mb-px"
          :class="
            activeTab === tab.id
              ? 'border-emerald-brand text-emerald-brand font-medium'
              : 'border-transparent text-slate-500 hover:text-slate-300'
          "
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
          <span v-if="tab.id === 'spaces'" class="text-slate-600 font-normal">({{ spaces.length }})</span>
          <span v-if="tab.id === 'bills'" class="text-slate-600 font-normal">({{ propertyBills.length }})</span>
          <span v-if="tab.id === 'documents'" class="text-slate-600 font-normal">({{ propertyDocuments.length }})</span>
        </button>
      </nav>

      <!-- Помещения -->
      <div v-if="activeTab === 'spaces'">
        <div class="flex items-center justify-between gap-3 mb-3">
          <p class="text-xs text-slate-500">
            Помещения добавляются здесь. Привязку к кадастру — в разделе
            <RouterLink
              :to="{ path: '/landlord/cadastral', query: { property: property.id } }"
              class="text-emerald-brand hover:underline"
              @click="onClose"
            >Кадастр</RouterLink>.
          </p>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 text-xs text-emerald-brand hover:underline shrink-0"
            :class="{ 'opacity-60': !canAddSpace(property.id) }"
            @click="onAddSpace"
          >
            <Plus class="w-3.5 h-3.5" />
            Добавить помещение
          </button>
        </div>

        <p v-if="spaceDeleteError" class="text-xs text-rose-400 mb-3">{{ spaceDeleteError }}</p>

        <div class="space-y-2">
          <div
            v-for="space in spaces"
            :key="space.id"
            class="flex items-stretch gap-1"
          >
          <button
            type="button"
            class="flex-1 min-w-0 flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border border-border bg-panel/40 text-left hover:border-emerald-brand/40 hover:bg-card-hover transition-colors group"
            @click="openSpace(space.id)"
          >
            <div class="min-w-0">
              <div class="flex items-center gap-2 mb-0.5">
                <span class="font-mono font-semibold text-white group-hover:text-emerald-brand transition-colors">
                  №{{ space.name }}
                </span>
                <span class="text-xs px-2 py-0.5 rounded shrink-0" :class="occupancyClass(space.occupied)">
                  {{ space.occupied ? 'Занято' : 'Свободно' }}
                </span>
              </div>
              <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                <span class="font-mono">{{ areaShareLabel(space.area) }}</span>
                <span v-if="space.cadastralParcelId" class="font-mono truncate text-slate-400">
                  {{ store.getCadastralParcelById(space.cadastralParcelId)?.cadastralNumber }}
                </span>
                <span v-else class="text-amber-400/80">без кадастра</span>
                <span class="font-mono text-emerald-brand">{{ store.formatMoney(space.monthlyRate) }}/мес</span>
              </div>
            </div>
            <ChevronRight class="w-4 h-4 text-slate-600 group-hover:text-emerald-brand shrink-0" />
          </button>
          <button
            type="button"
            class="px-3 rounded-xl border border-border text-slate-500 hover:text-rose-400 hover:border-rose-400/40 hover:bg-rose-500/10 transition-colors disabled:opacity-40"
            :disabled="deletingSpaceId === space.id"
            title="Удалить помещение"
            @click="onDeleteSpace(space, $event)"
          >
            <Trash2 class="w-4 h-4" />
          </button>
          </div>
        </div>

        <p v-if="spaces.length === 0" class="text-sm text-slate-500 text-center py-8 rounded-xl border border-dashed border-border">
          Помещений пока нет
        </p>

        <div class="mt-5 pt-4 border-t border-border flex items-start gap-2 text-xs text-slate-500">
          <MapPin class="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>Выберите помещение для карточки с арендатором и ставкой</span>
        </div>
      </div>

      <!-- Счета -->
      <div v-else-if="activeTab === 'bills'" class="space-y-4">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-[auto_auto]">
            <label class="block">
              <span class="text-[11px] uppercase tracking-wide text-slate-500 mb-1 block">Период</span>
              <div class="flex items-center gap-2">
                <CalendarIcon class="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <select v-model="billPeriodFilter" class="panel-input text-xs py-2">
                  <option value="">Все месяцы</option>
                  <option v-for="period in billPeriods" :key="period" :value="period">
                    {{ formatPeriod(period) }}
                  </option>
                </select>
              </div>
            </label>
            <label class="block">
              <span class="text-[11px] uppercase tracking-wide text-slate-500 mb-1 block">&nbsp;</span>
              <input v-model="billPeriodFilter" type="month" class="panel-input text-xs py-2" />
            </label>
          </div>
          <button
            type="button"
            class="panel-btn-secondary text-xs py-2 px-3 disabled:opacity-50"
            :disabled="!filteredPropertyBills.length || downloadingBills"
            @click="onDownloadBillDocuments"
          >
            <Download class="w-3.5 h-3.5" />
            {{ downloadingBills ? 'Сборка архива...' : 'Скачать за период' }}
          </button>
        </div>
        <p v-if="billDownloadError" class="text-xs text-rose-400">{{ billDownloadError }}</p>

        <div v-if="filteredPropertyBills.length === 0" class="py-10 text-center rounded-xl border border-dashed border-border">
          <FileText class="w-10 h-10 text-slate-600 mx-auto mb-2 opacity-60" />
          <p class="text-sm text-slate-500">
            {{ billPeriodFilter ? 'Счетов за выбранный месяц нет' : 'Счетов пока нет' }}
          </p>
          <p class="text-xs text-slate-600 mt-1">
            Загружайте счета на вкладке «Счета» приложения
          </p>
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="bill in filteredPropertyBills"
            :key="bill.id"
            class="rounded-xl border border-border bg-panel/40 p-4 flex flex-wrap items-center justify-between gap-3"
          >
            <div class="min-w-0">
              <p class="text-sm font-medium text-white truncate">{{ bill.title }}</p>
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-slate-500">
                <span class="inline-flex items-center gap-1">
                  <CalendarIcon class="w-3 h-3" />{{ formatPeriod(bill.period) }}
                </span>
                <span>Создан: {{ formatDateRu(bill.issuedAt || bill.dueDate) }}</span>
                <span>Оплатить до: {{ formatDateRu(bill.dueDate) }}</span>
              </div>
              <div v-if="bill.lines && bill.lines.length" class="mt-2 flex flex-wrap gap-x-2 gap-y-1">
                <span
                  v-for="(line, i) in bill.lines"
                  :key="i"
                  class="inline-block text-[10px] px-2 py-0.5 rounded bg-panel border border-border text-slate-400"
                >
                  {{ line.label || line.criterion }} · {{ utilityBills.formatMoney(line.amount) }}
                </span>
              </div>
            </div>
            <div class="text-right shrink-0">
              <p class="text-sm font-mono font-semibold text-white">
                {{ utilityBills.formatMoney(bill.totalAmount) }}
              </p>
              <p v-if="bill.landlordLoss > 0.009" class="text-[11px] text-rose-400 mt-0.5">
                Убыток: {{ utilityBills.formatMoney(bill.landlordLoss) }}
              </p>
              <p v-else-if="bill.landlordLoss < -0.009" class="text-[11px] text-emerald-brand mt-0.5">
                Прибыль: {{ utilityBills.formatMoney(-bill.landlordLoss) }}
              </p>
              <p class="text-[10px] text-slate-600 mt-0.5">{{ bill.status === 'distributed' ? 'Распределен' : bill.status }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Документы -->
      <div v-else-if="activeTab === 'documents'" class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-xs text-slate-500">
            Все документы объекта можно скачать одним ZIP-архивом
          </p>
          <button
            type="button"
            class="panel-btn-secondary text-xs py-1.5 px-2.5 disabled:opacity-50"
            :disabled="!propertyDocuments.length || downloadingAll"
            @click="onDownloadAllDocuments"
          >
            <Download class="w-3.5 h-3.5" />
            {{ downloadingAll ? 'Сборка архива...' : 'Скачать все' }}
          </button>
        </div>
        <p v-if="downloadError" class="text-xs text-rose-400">{{ downloadError }}</p>

        <FileAttachments
          entity-type="property"
          :entity-id="property.id"
          category="title"
          :label="PROPERTY_DOCUMENT_LABELS.title"
          compact
        />
        <FileAttachments
          entity-type="property"
          :entity-id="property.id"
          category="service"
          :label="PROPERTY_DOCUMENT_LABELS.service"
          compact
        />
      </div>
    </template>

    <template #footer>
      <p v-if="propertyDeleteError" class="text-xs text-rose-400 mr-auto">{{ propertyDeleteError }}</p>
      <button
        type="button"
        class="panel-btn-secondary text-rose-400 hover:text-rose-300 hover:border-rose-400/40"
        :disabled="deletingProperty"
        @click="onDeleteProperty"
      >
        <Trash2 class="w-4 h-4" />
        {{ deletingProperty ? 'Удаление...' : 'Удалить объект' }}
      </button>
      <button type="button" class="panel-btn-secondary" @click="onClose">
        Закрыть
      </button>
    </template>
  </Modal>
</template>
