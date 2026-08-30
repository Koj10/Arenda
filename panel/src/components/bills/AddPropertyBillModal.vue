<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { FileUp, Loader2, Sparkles } from '@lucide/vue'
import Modal from '@/components/ui/Modal.vue'
import { useUtilityBillsStore } from '@/stores/utilityBillsStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { useAccountingStore } from '@/stores/accountingStore'
import {
  UTILITY_CRITERION_LABELS,
  createEmptyBillLines,
  sumBillLines,
} from '@/types/utilityBills'
import type { InvoiceDocument, ParsedInvoiceAmount } from '@/types/billing'
import { parseInvoiceAmountFromFile, fileToInvoiceDocument } from '@/composables/useInvoiceParser'

const utilityBills = useUtilityBillsStore()
const portfolio = usePortfolioStore()
const accounting = useAccountingStore()

const title = ref('')
const period = ref(currentPeriod())
const dueDate = ref(new Date().toISOString().slice(0, 10))
const lines = ref(createEmptyBillLines())
const document = ref<InvoiceDocument | null>(null)
const parsing = ref(false)
const parseResult = ref<ParsedInvoiceAmount | null>(null)
const errors = ref<Record<string, string>>({})
const inputRef = ref<HTMLInputElement | null>(null)

const inputClass = 'panel-input'

const property = computed(() =>
  utilityBills.addBillPropertyId ? portfolio.getPropertyById(utilityBills.addBillPropertyId) : null,
)

const totalAmount = computed(() => sumBillLines(lines.value))

function currentPeriod() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

watch(
  () => utilityBills.addBillModalOpen,
  (open) => {
    if (!open) return
    title.value = ''
    period.value = currentPeriod()
    dueDate.value = new Date().toISOString().slice(0, 10)
    lines.value = createEmptyBillLines()
    document.value = null
    parseResult.value = null
    errors.value = {}
  },
)

function resetAndClose() {
  utilityBills.closeAddBillModal()
}

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  parsing.value = true
  parseResult.value = null
  errors.value = {}

  try {
    document.value = await fileToInvoiceDocument(file)
    if (!title.value) title.value = file.name.replace(/\.[^.]+$/, '')

    const parsed = await parseInvoiceAmountFromFile(file)
    parseResult.value = parsed
    if (parsed.amount != null && totalAmount.value === 0) {
      lines.value[0]!.amount = parsed.amount
    }
  } finally {
    parsing.value = false
    input.value = ''
  }
}

function validate() {
  errors.value = {}
  if (!document.value) errors.value.document = 'Загрузите файл счёта'
  if (!title.value.trim()) errors.value.title = 'Укажите название'
  if (!period.value) errors.value.period = 'Укажите период'
  if (!dueDate.value) errors.value.dueDate = 'Укажите срок оплаты'
  if (totalAmount.value <= 0) errors.value.total = 'Укажите суммы по критериям'
  return Object.keys(errors.value).length === 0
}

async function submit() {
  if (!property.value || !document.value || !validate()) return

  const ok = await utilityBills.addPropertyBill({
    propertyId: property.value.id,
    period: period.value,
    title: title.value.trim(),
    dueDate: dueDate.value,
    document: document.value,
    lines: lines.value,
  })

  if (!ok) errors.value.total = 'Не удалось сохранить счёт'
}

function confidenceClass(c: ParsedInvoiceAmount['confidence']) {
  const map = {
    high: 'text-emerald-brand bg-emerald-brand/10',
    medium: 'text-emerald-brand bg-emerald-brand/10',
    low: 'text-slate-400 bg-slate-500/10',
    none: 'text-slate-500 bg-slate-500/10',
  }
  return map[c]
}
</script>

<template>
  <Modal
    :open="utilityBills.addBillModalOpen && !!property"
    title="Загрузить счёт на объект"
    size="xl"
    :z-index="110"
    @close="resetAndClose"
  >
    <div v-if="property" class="space-y-5">
      <p class="text-sm text-slate-500 rounded-lg border border-border bg-panel/30 px-3 py-2">
        Счёт на весь адрес: <span class="text-slate-300">{{ property.address }}</span>.
        Укажите суммы по каждому критерию — система распределит их между вами и арендаторами по настройкам помещений.
      </p>

      <div>
        <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Файл счёта</label>
        <div
          class="rounded-xl border-2 border-dashed border-border bg-panel p-5 text-center cursor-pointer hover:border-emerald-brand/40 transition-colors"
          :class="{ 'border-red-500/50': errors.document }"
          @click="inputRef?.click()"
        >
          <input ref="inputRef" type="file" class="hidden" accept=".pdf,.txt,image/*" @change="onFileSelected" />
          <Loader2 v-if="parsing" class="w-7 h-7 text-emerald-brand mx-auto mb-2 animate-spin" />
          <FileUp v-else class="w-7 h-7 text-slate-500 mx-auto mb-2" />
          <p v-if="document" class="text-sm text-slate-200">{{ document.name }}</p>
          <p v-else class="text-sm text-slate-400">PDF, TXT или изображение</p>
        </div>
        <p v-if="errors.document" class="text-xs text-red-400 mt-1">{{ errors.document }}</p>
      </div>

      <div v-if="parseResult" class="rounded-xl border border-border bg-panel/40 p-3">
        <div class="flex items-center gap-2 mb-1">
          <Sparkles class="w-4 h-4 text-emerald-brand" />
          <span class="text-xs text-slate-400">Распознанная сумма</span>
          <span class="text-xs px-2 py-0.5 rounded" :class="confidenceClass(parseResult.confidence)">
            {{ parseResult.amount != null ? accounting.formatMoney(parseResult.amount) : '—' }}
          </span>
        </div>
      </div>

      <div class="grid sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Название</label>
          <input v-model="title" type="text" :class="[inputClass, { 'border-red-500': errors.title }]" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Период</label>
          <input v-model="period" type="month" :class="[inputClass, 'font-mono', { 'border-red-500': errors.period }]" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Оплатить до</label>
          <input v-model="dueDate" type="date" :class="[inputClass, { 'border-red-500': errors.dueDate }]" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Итого</label>
          <p class="panel-input font-mono text-emerald-brand bg-panel/50">{{ utilityBills.formatMoney(totalAmount) }}</p>
        </div>
      </div>

      <div>
        <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Суммы по критериям, ₽</label>
        <div class="grid sm:grid-cols-2 gap-2">
          <div v-for="(line, index) in lines" :key="line.criterion" class="flex items-center gap-2">
            <span class="text-xs text-slate-500 flex-1 min-w-0 truncate">{{ UTILITY_CRITERION_LABELS[line.criterion] }}</span>
            <input
              v-model.number="lines[index]!.amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              class="panel-input font-mono w-28 text-sm py-1.5"
            />
          </div>
        </div>
        <p v-if="errors.total" class="text-xs text-red-400 mt-2">{{ errors.total }}</p>
      </div>
    </div>

    <template #footer>
      <button type="button" class="panel-btn-secondary" @click="resetAndClose">Отмена</button>
      <button type="button" class="panel-btn-primary" :disabled="parsing" @click="submit">
        Загрузить и распределить
      </button>
    </template>
  </Modal>
</template>
