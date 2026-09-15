<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { FileUp, Trash2 } from '@lucide/vue'
import Modal from '@/components/ui/Modal.vue'
import { useUtilityBillsStore } from '@/stores/utilityBillsStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import {
  UPLOAD_CRITERIA,
  UTILITY_CRITERION_LABELS,
  VAT_RATE,
  isAssignCriterion,
  isMeteredCriterion,
  type UtilityCriterion,
  type UtilityUploadItem,
} from '@/types/utilityBills'
import { unitPriceWithVat } from '@/composables/utilityCalc'
import { currentPeriod, todayISODate } from '@/utils/dates'
import type { InvoiceDocument } from '@/types/billing'

const utilityBills = useUtilityBillsStore()
const portfolio = usePortfolioStore()

const period = ref(currentPeriod())
const dueDate = ref(todayISODate())
const items = ref<UtilityUploadItem[]>([])
const errors = ref<Record<string, string>>({})
const inputRef = ref<HTMLInputElement | null>(null)

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

async function readFileAsDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.readAsDataURL(file)
  })
}

async function onFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  if (!files.length) return
  errors.value = {}
  for (const file of files) {
    const dataUrl = await readFileAsDataUrl(file)
    const document: InvoiceDocument = {
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/pdf',
      dataUrl,
    }
    items.value.push({
      id: newId(),
      fileName: file.name,
      document,
      criterion: 'electricity',
      unitPrice: null,
      vatRate: VAT_RATE,
      totalAmount: null,
      septicSpaceId: null,
    })
  }
  input.value = ''
}

function removeItem(id: string) {
  items.value = items.value.filter((item) => item.id !== id)
}

function validate() {
  errors.value = {}
  if (!items.value.length) errors.value.files = 'Загрузите один или несколько счетов'
  if (!period.value) errors.value.period = 'Укажите период'
  if (!dueDate.value) errors.value.dueDate = 'Укажите срок оплаты'
  for (const item of items.value) {
    if (isAssignCriterion(item.criterion) && !item.septicSpaceId) {
      errors.value.items = 'Для септика выберите помещение'
    }
    if (isMeteredCriterion(item.criterion)) {
      if (!(item.unitPrice && item.unitPrice > 0)) {
        errors.value.items = 'Для счётчика укажите цену за единицу (тариф)'
      } else if (!(item.totalAmount && item.totalAmount > 0)) {
        errors.value.items = 'Для счётчика укажите итоговую сумму в счёте (для сверки)'
      }
    }
    if (!isMeteredCriterion(item.criterion) && !(item.totalAmount && item.totalAmount > 0)) {
      errors.value.items = 'Укажите сумму счёта'
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

function methodHint(criterion: UtilityCriterion) {
  if (isMeteredCriterion(criterion)) return 'тариф × НДС × показания · сумма в счёте — для сверки (разница в результатах)'
  if (isAssignCriterion(criterion)) return 'перевыставить на помещение'
  return 'доля площади помещения'
}
</script>

<template>
  <Modal
    :open="utilityBills.addBillModalOpen && !!property"
    title="Загрузить счета на объект"
    size="3xl"
    :z-index="110"
    @close="resetAndClose"
  >
    <div v-if="property" class="space-y-5">
      <p class="text-sm text-slate-500 rounded-lg border border-border bg-panel/30 px-3 py-2">
        Объект: <span class="text-slate-300">{{ property.address }}</span>.
        Загрузите счета в любом формате (PDF, изображение, TXT) и заполните все поля вручную.
        Для каждого счёта выберите показатель и заполните суммы / тариф.
        Прикрепленные файлы будут доступны на вкладке «Счета» в карточке объекта.
      </p>

      <div>
        <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Файлы счетов</label>
        <div
          class="rounded-xl border-2 border-dashed border-border bg-panel p-5 text-center cursor-pointer hover:border-emerald-brand/40 transition-colors"
          :class="{ 'border-red-500/50': errors.files }"
          @click="inputRef?.click()"
        >
          <input
            ref="inputRef"
            type="file"
            class="hidden"
            accept=".pdf,.txt,image/*"
            multiple
            @change="onFilesSelected"
          />
          <FileUp class="w-7 h-7 text-slate-500 mx-auto mb-2" />
          <p class="text-sm text-slate-400">Прикрепить счета (PDF, TXT, изображение) — можно несколько сразу</p>
        </div>
        <p v-if="errors.files" class="text-xs text-red-400 mt-1">{{ errors.files }}</p>
      </div>

      <div class="grid sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Период</label>
          <input v-model="period" type="month" :class="[inputClass, 'font-mono', { 'border-red-500': errors.period }]" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Оплатить до</label>
          <input v-model="dueDate" type="date" :class="[inputClass, { 'border-red-500': errors.dueDate }]" />
        </div>
      </div>

      <div v-if="items.length" class="space-y-3">
        <div
          v-for="item in items"
          :key="item.id"
          class="rounded-xl border border-border bg-panel/40 p-3 space-y-3"
        >
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="text-sm text-white">{{ item.fileName }}</p>
              <p class="text-[11px] text-slate-500 mt-0.5">
                Файл счёта прикреплен, поля ниже заполняются вручную
              </p>
            </div>
            <button type="button" class="p-1.5 rounded-lg text-slate-500 hover:text-rose-400" @click="removeItem(item.id)">
              <Trash2 class="w-4 h-4" />
            </button>
          </div>

          <div class="grid sm:grid-cols-2 gap-2">
            <label class="block">
              <span class="text-[11px] text-slate-500 mb-1 block">Показатель</span>
              <select v-model="item.criterion" class="panel-input text-sm">
                <option v-for="key in UPLOAD_CRITERIA" :key="key" :value="key">
                  {{ UTILITY_CRITERION_LABELS[key] }}
                </option>
              </select>
              <span class="text-[10px] text-slate-600 mt-1 block">{{ methodHint(item.criterion) }}</span>
            </label>

            <label v-if="isAssignCriterion(item.criterion)" class="block">
              <span class="text-[11px] text-slate-500 mb-1 block">Помещение для септика</span>
              <select v-model.number="item.septicSpaceId" class="panel-input text-sm">
                <option :value="null">Выберите помещение</option>
                <option v-for="space in spaces" :key="space.id" :value="space.id">№{{ space.name }} · {{ space.area }} м²</option>
              </select>
            </label>
          </div>

          <div
            class="grid gap-2"
            :class="isMeteredCriterion(item.criterion) ? 'sm:grid-cols-3' : 'sm:grid-cols-3'"
          >
            <template v-if="isMeteredCriterion(item.criterion)">
              <label class="block">
                <span class="text-[11px] text-slate-500 mb-1 block">Цена за единицу без НДС</span>
                <input v-model.number="item.unitPrice" type="number" min="0" step="0.00001" class="panel-input font-mono text-sm" />
              </label>
              <label class="block">
                <span class="text-[11px] text-slate-500 mb-1 block">НДС</span>
                <p class="panel-input font-mono text-sm bg-panel/50">
                  {{ Math.round((item.vatRate || VAT_RATE) * 100) }}%
                  · с НДС
                  {{
                    item.unitPrice
                      ? utilityBills.formatMoney(unitPriceWithVat(item.unitPrice, item.vatRate || VAT_RATE))
                      : '—'
                  }}
                </p>
              </label>
              <label class="block">
                <span class="text-[11px] text-slate-500 mb-1 block">
                  Итого в счёте <span class="text-amber-400/80">(для сверки)</span>
                </span>
                <input v-model.number="item.totalAmount" type="number" min="0" step="0.01" class="panel-input font-mono text-sm" />
              </label>
            </template>
            <template v-else>
              <label class="block sm:col-span-3">
                <span class="text-[11px] text-slate-500 mb-1 block">Сумма счёта</span>
                <input v-model.number="item.totalAmount" type="number" min="0" step="0.01" class="panel-input font-mono text-sm" />
              </label>
            </template>
          </div>
        </div>
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
