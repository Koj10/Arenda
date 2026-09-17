<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { FileUp, Plus, Trash2, FileText } from '@lucide/vue'
import Modal from '@/components/ui/Modal.vue'
import { useUtilityBillsStore } from '@/stores/utilityBillsStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import {
  UPLOAD_CRITERIA,
  UTILITY_CRITERION_LABELS,
  VAT_RATE,
  isAssignCriterion,
  isMeteredCriterion,
  isAreaCriterion,
  type UtilityCriterion,
  type UtilityUploadItem,
} from '@/types/utilityBills'
import { unitPriceWithVat } from '@/composables/utilityCalc'
import { currentPeriod, todayISODate } from '@/utils/dates'
import { fileToInvoiceDocument } from '@/composables/useInvoiceParser'

const utilityBills = useUtilityBillsStore()
const portfolio = usePortfolioStore()

const period = ref(currentPeriod())
const dueDate = ref(todayISODate())
const items = ref<UtilityUploadItem[]>([])
const errors = ref<Record<string, string>>({})

const inputClass = 'panel-input'

const property = computed(() =>
  utilityBills.addBillPropertyId ? portfolio.getPropertyById(utilityBills.addBillPropertyId) : null,
)

const spaces = computed(() =>
  property.value ? portfolio.getSpacesForProperty(property.value.id) : [],
)

watch(
  () => utilityBills.addBillModalOpen,
  (open) => {
    if (!open) return
    period.value = currentPeriod()
    dueDate.value = todayISODate()
    items.value = []
    errors.value = {}
  },
)

function resetAndClose() {
  utilityBills.closeAddBillModal()
}

function newId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function createEmptyItem(criterion: UtilityCriterion = 'electricity'): UtilityUploadItem {
  return {
    id: newId(),
    fileName: '',
    document: { name: '', mimeType: '', size: 0, dataUrl: '' },
    criterion,
    unitPrice: isMeteredCriterion(criterion) ? 0 : null,
    vatRate: VAT_RATE,
    totalAmount: null,
    septicSpaceId: null,
    parsedTitle: '',
    source: '',
  }
}

function addItem() {
  items.value.push(createEmptyItem())
}

function removeItem(id: string) {
  items.value = items.value.filter((item) => item.id !== id)
}

async function onFileSelected(item: UtilityUploadItem, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const document = await fileToInvoiceDocument(file)
    item.fileName = file.name
    item.document = document
  } catch {
    /* ignore */
  } finally {
    input.value = ''
  }
}

function clearFile(item: UtilityUploadItem) {
  item.fileName = ''
  item.document = { name: '', mimeType: '', size: 0, dataUrl: '' }
}

function methodHint(criterion: UtilityCriterion) {
  if (isMeteredCriterion(criterion)) return 'тариф × (1 + НДС) × показания счётчиков'
  if (isAssignCriterion(criterion)) return 'вся сумма на выбранное помещение'
  return 'распределение по доле площади помещений'
}

function itemCalculatedSumLabel(item: UtilityUploadItem) {
  if (isMeteredCriterion(item.criterion) && item.unitPrice && item.unitPrice > 0) {
    return `С НДС: ${utilityBills.formatMoney(unitPriceWithVat(item.unitPrice, item.vatRate))} × показания`
  }
  if (isAreaCriterion(item.criterion) && item.totalAmount && item.totalAmount > 0) {
    return `По площадям: ${utilityBills.formatMoney(item.totalAmount)}`
  }
  return ''
}

function validate() {
  errors.value = {}
  if (!items.value.length) errors.value.items = 'Добавьте хотя бы один счёт'
  if (!period.value) errors.value.period = 'Укажите период'
  if (!dueDate.value) errors.value.dueDate = 'Укажите срок оплаты'

  for (const item of items.value) {
    const label = UTILITY_CRITERION_LABELS[item.criterion]

    if (isMeteredCriterion(item.criterion)) {
      if (!item.unitPrice || item.unitPrice <= 0) {
        errors.value.items = `${label}: укажите цену за единицу без НДС`
        return false
      }
      if (!item.totalAmount || item.totalAmount <= 0) {
        errors.value.items = `${label}: укажите итоговую сумму из счёта (обязательна для сверки)`
        return false
      }
    } else if (isAreaCriterion(item.criterion)) {
      if (!item.totalAmount || item.totalAmount <= 0) {
        errors.value.items = `${label}: укажите итоговую сумму из счёта`
        return false
      }
    } else if (isAssignCriterion(item.criterion)) {
      if (!item.totalAmount || item.totalAmount <= 0) {
        errors.value.items = `${label}: укажите сумму счёта`
        return false
      }
      if (!item.septicSpaceId) {
        errors.value.items = `${label}: выберите помещение`
        return false
      }
    }
  }
  return Object.keys(errors.value).length === 0
}

async function submit() {
  if (!property.value || !validate()) return
  const ok = await utilityBills.calculateStatement({
    propertyId: property.value.id,
    period: period.value,
    dueDate: dueDate.value,
    items: items.value.map((item) => ({ ...item })),
  })
  if (!ok) errors.value.items = utilityBills.statementError || 'Не удалось рассчитать'
}
</script>

<template>
  <Modal
    :open="utilityBills.addBillModalOpen && !!property"
    title="Счета на объект"
    size="3xl"
    :z-index="110"
    @close="resetAndClose"
  >
    <div v-if="property" class="space-y-5">
      <p class="text-sm text-slate-500 rounded-lg border border-border bg-panel/30 px-3 py-2">
        Объект: <span class="text-slate-300">{{ property.address }}</span>.
        Введите данные счетов вручную. Для электричества, воды, газа и канализации укажите
        <span class="text-emerald-brand font-medium">тариф без НДС</span>
        и <span class="text-emerald-brand font-medium">итоговую сумму из счёта</span>
        (для сверки: расчёт пойдёт по тарифу × показания, разница отразится как прибыль или убыток).
        К каждому показателю прикрепите файл счёта (PDF/изображение) — он будет доступен в карточке объекта.
      </p>

      <div class="grid sm:grid-cols-2 gap-3">
        <div>
          <label class="panel-label">Период</label>
          <input v-model="period" type="month" :class="[inputClass, 'font-mono', { 'border-red-500': errors.period }]" />
          <p v-if="errors.period" class="text-xs text-red-400 mt-1">{{ errors.period }}</p>
        </div>
        <div>
          <label class="panel-label">Оплатить до</label>
          <input v-model="dueDate" type="date" :class="[inputClass, { 'border-red-500': errors.dueDate }]" />
          <p v-if="errors.dueDate" class="text-xs text-red-400 mt-1">{{ errors.dueDate }}</p>
        </div>
      </div>

      <div class="space-y-3">
        <div
          v-for="item in items"
          :key="item.id"
          class="rounded-xl border border-border bg-panel/40 p-3 sm:p-4 space-y-3"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span v-if="item.fileName" class="inline-flex items-center gap-1 text-[11px] text-emerald-brand/80 truncate">
                  <FileText class="w-3 h-3 shrink-0" />
                  <span class="truncate">{{ item.fileName }}</span>
                </span>
              </div>
            </div>
            <button type="button" class="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 shrink-0" @click="removeItem(item.id)">
              <Trash2 class="w-4 h-4" />
            </button>
          </div>

          <div class="grid sm:grid-cols-2 gap-3">
            <label class="block">
              <span class="panel-label">Показатель</span>
              <select v-model="item.criterion" class="panel-input text-sm">
                <option v-for="key in UPLOAD_CRITERIA" :key="key" :value="key">
                  {{ UTILITY_CRITERION_LABELS[key] }}
                </option>
              </select>
              <span class="text-[10px] text-slate-600 mt-1 block">{{ methodHint(item.criterion) }}</span>
            </label>

            <label v-if="isAssignCriterion(item.criterion)" class="block">
              <span class="panel-label">Помещение для септика</span>
              <select v-model.number="item.septicSpaceId" class="panel-input text-sm">
                <option :value="null">Выберите помещение</option>
                <option v-for="space in spaces" :key="space.id" :value="space.id">
                  №{{ space.name }} · {{ space.area }} м²
                </option>
              </select>
            </label>

            <div v-else class="block">
              <span class="panel-label">Файл счёта</span>
              <div class="flex gap-2">
                <label class="flex-1 cursor-pointer">
                  <input
                    type="file"
                    class="hidden"
                    accept=".pdf,.txt,image/*"
                    @change="onFileSelected(item, $event)"
                  />
                  <div class="panel-input text-sm flex items-center justify-between gap-2 overflow-hidden">
                    <span class="truncate text-slate-500">
                      {{ item.fileName || 'Прикрепить PDF/изображение' }}
                    </span>
                    <FileUp class="w-4 h-4 text-slate-500 shrink-0" />
                  </div>
                </label>
                <button
                  v-if="item.fileName"
                  type="button"
                  class="panel-btn-secondary !py-2 !px-2 text-xs"
                  @click="clearFile(item)"
                  title="Убрать файл"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <template v-if="isMeteredCriterion(item.criterion)">
              <label class="block">
                <span class="panel-label">Цена за ед. без НДС</span>
                <input
                  v-model.number="item.unitPrice"
                  type="number"
                  min="0"
                  step="0.00001"
                  class="panel-input font-mono text-sm"
                  placeholder="0,0000"
                />
              </label>
              <label class="block">
                <span class="panel-label">Ставка НДС, %</span>
                <select v-model.number="item.vatRate" class="panel-input font-mono text-sm">
                  <option :value="0">0 (без НДС)</option>
                  <option :value="0.1">10</option>
                  <option :value="0.2">20</option>
                  <option :value="0.22">22</option>
                </select>
                <p class="text-[10px] text-slate-600 mt-1">
                  С НДС:
                  {{
                    item.unitPrice && item.unitPrice > 0
                      ? utilityBills.formatMoney(unitPriceWithVat(item.unitPrice, item.vatRate))
                      : '—'
                  }}
                </p>
              </label>
              <label class="block">
                <span class="panel-label">Итого в счёте, ₽ *</span>
                <input
                  v-model.number="item.totalAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  class="panel-input font-mono text-sm border-emerald-brand/40 focus:border-emerald-brand"
                  placeholder="Сумма из квитанции"
                />
                <p class="text-[10px] text-slate-600 mt-1">Обязательно. Для сверки с расчётом по тарифу.</p>
              </label>
            </template>

            <template v-else-if="isAreaCriterion(item.criterion)">
              <label class="block sm:col-span-2 lg:col-span-2">
                <span class="panel-label">Итого в счёте, ₽ *</span>
                <input
                  v-model.number="item.totalAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  class="panel-input font-mono text-sm"
                  placeholder="Общая сумма из счёта"
                />
                <p class="text-[10px] text-slate-600 mt-1">
                  Будет распределена между помещениями пропорционально их площади.
                </p>
              </label>
            </template>

            <template v-else>
              <label class="block sm:col-span-2 lg:col-span-2">
                <span class="panel-label">Сумма счёта, ₽ *</span>
                <input
                  v-model.number="item.totalAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  class="panel-input font-mono text-sm"
                  placeholder="0,00"
                />
              </label>
            </template>

            <div v-if="itemCalculatedSumLabel(item)" class="block sm:col-span-2 lg:col-span-3">
              <p class="text-[11px] text-emerald-brand/80 rounded-lg bg-emerald-brand/5 border border-emerald-brand/20 px-2.5 py-1.5">
                {{ itemCalculatedSumLabel(item) }}
              </p>
            </div>
          </div>
        </div>

        <button type="button" class="w-full panel-btn-secondary !py-3 gap-2" @click="addItem">
          <Plus class="w-4 h-4" />
          Добавить счёт
        </button>

        <p v-if="errors.items" class="text-xs text-red-400">{{ errors.items }}</p>
      </div>
    </div>

    <template #footer>
      <button type="button" class="panel-btn-secondary" @click="resetAndClose">Отмена</button>
      <button type="button" class="panel-btn-primary" @click="submit">
        Рассчитать выписку
      </button>
    </template>
  </Modal>
</template>
