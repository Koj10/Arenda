<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import {
  Building2,
  ChevronRight,
  Download,
  MapPin,
  Plus,
  Landmark,
  Trash2,
  FileText,
  FileDown,
  CalendarDays,
  Tag,
  TrendingDown,
  TrendingUp,
  Upload,
} from '@lucide/vue'
import Modal from '@/components/ui/Modal.vue'
import FileAttachments from '@/components/ui/FileAttachments.vue'
import AddPropertyBillModal from '@/components/bills/AddPropertyBillModal.vue'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { PROPERTY_TYPE_LABELS, PROPERTY_DOCUMENT_LABELS, formatAreaShare } from '@/types/portfolio'
import { usePlan } from '@/composables/usePlan'
import { downloadDocumentsArchive } from '@/composables/useDocuments'
import { useUtilityBillsStore } from '@/stores/utilityBillsStore'
import {
  UTILITY_CRITERION_LABELS,
  UPLOAD_CRITERIA,
  type UtilityCriterion,
  type PropertyBill,
} from '@/types/utilityBills'
import { dataUrlToBlob } from '@/api/auth'

type PropertyTab = 'spaces' | 'documents' | 'bills'

const store = usePortfolioStore()
const utilityBills = useUtilityBillsStore()
const { canAddSpace, requireCanAddSpace } = usePlan()

const activeTab = ref<PropertyTab>('spaces')
const downloadingAll = ref(false)
const downloadError = ref<string | null>(null)
const deletingSpaceId = ref<number | null>(null)
const spaceDeleteError = ref<string | null>(null)
const deletingProperty = ref(false)
const propertyDeleteError = ref<string | null>(null)

const billsFilterCriterion = ref<UtilityCriterion | 'all'>('all')
const billsFilterPeriod = ref<string>('')
const loadingBills = ref(false)

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

const spacesAreaTotal = computed(() =>
  property.value ? store.getTotalAreaForProperty(property.value.id) : 0,
)

const availableArea = computed(() =>
  property.value ? store.getAvailableAreaForProperty(property.value.id) : 0,
)

const totalCadastralValue = computed(() =>
  property.value ? store.getTotalCadastralValueForProperty(property.value.id) : 0,
)

const allBills = computed(() =>
  property.value ? utilityBills.getBillsForProperty(property.value.id) : [],
)

const filteredBills = computed(() => {
  let list = [...allBills.value]
  if (billsFilterCriterion.value !== 'all') {
    list = list.filter((b) =>
      b.lines?.some((l) => l.criterion === billsFilterCriterion.value),
    )
  }
  if (billsFilterPeriod.value) {
    list = list.filter((b) => b.period === billsFilterPeriod.value)
  }
  return list.sort((a, b) => (a.period < b.period ? 1 : -1))
})

const availablePeriods = computed(() => {
  const set = new Set<string>()
  for (const b of allBills.value) if (b.period) set.add(b.period)
  return [...set].sort().reverse()
})

const TABS: { id: PropertyTab; label: string }[] = [
  { id: 'spaces', label: 'Помещения' },
  { id: 'bills', label: 'Счета' },
  { id: 'documents', label: 'Документы' },
]

watch(
  () => store.propertyDetailOpen,
  async (open) => {
    if (!open) return
    if (property.value) {
      loadingBills.value = true
      try {
        await utilityBills.loadForProperty(property.value.id)
      } finally {
        loadingBills.value = false
      }
    }
  },
  { immediate: true },
)

function onClose() {
  activeTab.value = 'spaces'
  downloadError.value = null
  spaceDeleteError.value = null
  propertyDeleteError.value = null
  billsFilterCriterion.value = 'all'
  billsFilterPeriod.value = ''
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

function onAddBill() {
  if (!property.value) return
  utilityBills.openAddBillModal(property.value.id)
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

function downloadBillFile(bill: PropertyBill) {
  const doc = bill.document
  if (!doc?.dataUrl) return
  const blob = dataUrlToBlob(doc.dataUrl, doc.mimeType)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = doc.name || `счёт-${bill.period}.${doc.mimeType.split('/')[1] || 'bin'}`
  a.click()
  URL.revokeObjectURL(url)
}

function billCriteriaBadges(bill: PropertyBill) {
  if (bill.lines?.length) return bill.lines.map((l) => l.criterion)
  return []
}

function formatPeriodLabel(period: string) {
  return utilityBills.formatPeriod(period)
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

function lossClass(value: number) {
  if (Math.abs(value) < 0.01) return 'text-slate-500'
  if (value > 0) return 'text-rose-500'
  return 'text-emerald-500'
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
          <span v-if="tab.id === 'documents'" class="text-slate-600 font-normal">({{ propertyDocuments.length }})</span>
          <span v-if="tab.id === 'bills'" class="text-slate-600 font-normal">({{ allBills.length }})</span>
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
        <div class="flex flex-wrap items-stretch gap-3 justify-between">
          <div class="flex flex-wrap items-stretch gap-2 flex-1 min-w-0">
            <div class="flex items-center gap-2 rounded-xl border border-border bg-panel px-3 py-2 min-w-[12rem]">
              <Tag class="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <select
                v-model="billsFilterCriterion"
                class="bg-transparent outline-none text-sm text-white w-full"
              >
                <option value="all">Все показатели</option>
                <option v-for="c in UPLOAD_CRITERIA" :key="c" :value="c">
                  {{ UTILITY_CRITERION_LABELS[c] }}
                </option>
              </select>
            </div>

            <div class="flex items-center gap-2 rounded-xl border border-border bg-panel px-3 py-2 min-w-[11rem]">
              <CalendarDays class="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <select
                v-model="billsFilterPeriod"
                class="bg-transparent outline-none text-sm text-white w-full"
              >
                <option value="">За все месяцы</option>
                <option v-for="p in availablePeriods" :key="p" :value="p">
                  {{ formatPeriodLabel(p) }}
                </option>
              </select>
            </div>
          </div>

          <button
            type="button"
            class="panel-btn-primary !py-2 text-xs shrink-0"
            @click="onAddBill"
          >
            <Upload class="w-3.5 h-3.5" />
            Добавить счёт
          </button>
        </div>

        <div v-if="loadingBills" class="text-sm text-slate-500 text-center py-6">
          Загрузка счетов…
        </div>

        <div v-else-if="filteredBills.length === 0" class="text-sm text-slate-500 text-center py-10 rounded-xl border border-dashed border-border">
          <FileText class="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-70" />
          <p>Счётов по этим фильтрам пока нет</p>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 mt-3 text-xs text-emerald-brand hover:underline"
            @click="onAddBill"
          >
            <Plus class="w-3.5 h-3.5" />
            Добавить первый счёт
          </button>
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="bill in filteredBills"
            :key="bill.id"
            class="rounded-xl border border-border bg-panel/40 p-3 sm:p-4 hover:bg-card-hover/60 transition-colors"
          >
            <div class="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2 mb-1">
                  <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-brand/10 text-emerald-brand text-[11px] font-mono">
                    <CalendarDays class="w-3 h-3" />
                    {{ formatPeriodLabel(bill.period) }}
                  </span>
                  <span
                    v-for="c in billCriteriaBadges(bill).slice(0, 4)"
                    :key="c"
                    class="px-2 py-0.5 rounded-md bg-card border border-border text-[11px] text-slate-300"
                  >
                    {{ UTILITY_CRITERION_LABELS[c] || c }}
                  </span>
                  <span
                    v-if="billCriteriaBadges(bill).length > 4"
                    class="px-2 py-0.5 rounded-md bg-card border border-border text-[11px] text-slate-500"
                  >
                    +{{ billCriteriaBadges(bill).length - 4 }}
                  </span>
                </div>
                <p class="text-sm text-white font-medium truncate">{{ bill.title || 'Коммунальный счёт' }}</p>
              </div>
              <div class="text-right shrink-0">
                <p class="text-sm font-mono text-white font-semibold">
                  {{ utilityBills.formatMoney(bill.totalAmount) }}
                </p>
                <p
                  class="text-[11px] font-mono inline-flex items-center gap-1 mt-1"
                  :class="lossClass(bill.landlordLoss)"
                >
                  <TrendingDown v-if="bill.landlordLoss > 0.01" class="w-3 h-3" />
                  <TrendingUp v-else-if="bill.landlordLoss < -0.01" class="w-3 h-3" />
                  <span v-else class="w-3 h-3" />
                  {{
                    Math.abs(bill.landlordLoss) < 0.01
                      ? 'Сверка ОК'
                      : bill.landlordLoss > 0
                        ? `Убыток ${utilityBills.formatMoney(bill.landlordLoss)}`
                        : `Прибыль ${utilityBills.formatMoney(-bill.landlordLoss)}`
                  }}
                </p>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 font-mono">
              <span>Создан: {{ utilityBills.formatDate(bill.issuedAt) }}</span>
              <span v-if="bill.dueDate">Оплатить до: {{ utilityBills.formatDate(bill.dueDate) }}</span>
              <span v-if="bill.status" class="uppercase tracking-wide text-slate-600">{{ bill.status }}</span>
            </div>

            <div v-if="bill.document?.dataUrl" class="mt-3 flex items-center justify-between gap-2 pt-3 border-t border-border/60">
              <span class="inline-flex items-center gap-1.5 text-[11px] text-slate-400 truncate min-w-0">
                <FileText class="w-3.5 h-3.5 shrink-0 text-emerald-brand/70" />
                <span class="truncate">{{ bill.document.name || 'Файл счёта' }}</span>
              </span>
              <button
                type="button"
                class="inline-flex items-center gap-1 panel-btn-secondary !py-1.5 !px-2.5 text-[11px] shrink-0"
                @click="downloadBillFile(bill)"
              >
                <FileDown class="w-3 h-3" />
                Скачать
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Документы -->
      <div v-else class="space-y-4">
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

  <AddPropertyBillModal />
</template>
