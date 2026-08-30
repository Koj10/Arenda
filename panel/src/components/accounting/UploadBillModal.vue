<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { FileUp, Loader2, Sparkles, User, Building2 } from '@lucide/vue'
import Modal from '@/components/ui/Modal.vue'
import { useBillingStore } from '@/stores/billingStore'
import { useAccountingStore } from '@/stores/accountingStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import type { BillRecipientType, InvoiceDocument, ParsedInvoiceAmount } from '@/types/billing'
import { BILL_RECIPIENT_LABELS } from '@/types/billing'
import type { ExpenseCategory } from '@/types/accounting'
import { EXPENSE_CATEGORY_LABELS } from '@/types/accounting'
import { parseInvoiceAmountFromFile, fileToInvoiceDocument } from '@/composables/useInvoiceParser'

const billing = useBillingStore()
const accounting = useAccountingStore()
const portfolio = usePortfolioStore()

const recipientType = ref<BillRecipientType>('landlord')
const tenantInn = ref('')
const tenantId = ref<number | null>(null)
const title = ref('')
const amount = ref(0)
const dueDate = ref(new Date().toISOString().slice(0, 10))
const category = ref<ExpenseCategory>('utilities')
const propertyId = ref<number | null>(null)
const document = ref<InvoiceDocument | null>(null)

const parsing = ref(false)
const parseResult = ref<ParsedInvoiceAmount | null>(null)
const errors = ref<Record<string, string>>({})
const inputRef = ref<HTMLInputElement | null>(null)

const inputClass =
  'panel-input'

const categories = Object.entries(EXPENSE_CATEGORY_LABELS) as [ExpenseCategory, string][]

const tenantsByInn = computed(() => {
  if (!/^\d{10}$|^\d{12}$/.test(tenantInn.value)) return []
  return portfolio.getTenantsByInn(tenantInn.value)
})

const knownInns = computed(() => {
  const map = new Map<string, string>()
  portfolio.tenants.forEach((t) => map.set(t.inn, t.company))
  return [...map.entries()].map(([inn, company]) => ({ inn, company }))
})

watch(tenantsByInn, (list) => {
  if (list.length === 1) tenantId.value = list[0]!.id
  else if (!list.some((t) => t.id === tenantId.value)) tenantId.value = list.length > 0 ? list[0]!.id : null
})

function resetForm() {
  recipientType.value = 'landlord'
  tenantInn.value = ''
  tenantId.value = null
  title.value = ''
  amount.value = 0
  dueDate.value = new Date().toISOString().slice(0, 10)
  category.value = 'utilities'
  propertyId.value = null
  document.value = null
  parseResult.value = null
  errors.value = {}
}

function onClose() {
  billing.closeUploadBillModal()
  resetForm()
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
    if (parsed.amount != null) amount.value = parsed.amount
  } finally {
    parsing.value = false
    input.value = ''
  }
}

function validate() {
  errors.value = {}
  if (!document.value) errors.value.document = 'Загрузите файл счёта'
  if (!title.value.trim()) errors.value.title = 'Укажите название'
  if (amount.value <= 0) errors.value.amount = 'Укажите сумму к оплате'
  if (!dueDate.value) errors.value.dueDate = 'Укажите срок оплаты'

  if (recipientType.value === 'tenant') {
    if (!/^\d{10}$|^\d{12}$/.test(tenantInn.value)) errors.value.tenantInn = 'ИНН: 10 или 12 цифр'
    else if (tenantsByInn.value.length === 0) errors.value.tenantInn = 'Арендатор с таким ИНН не найден'
    else if (!tenantId.value) errors.value.tenantId = 'Выберите арендатора'
  }

  return Object.keys(errors.value).length === 0
}

async function submit() {
  if (!validate() || !document.value) return

  const payload = {
    recipientType: recipientType.value,
    tenantInn: tenantInn.value,
    tenantId: tenantId.value,
    title: title.value.trim(),
    amount: amount.value,
    dueDate: dueDate.value,
    category: category.value,
    propertyId: propertyId.value,
    document: document.value,
  }

  if (recipientType.value === 'landlord') {
    await accounting.addExpense({
      date: new Date().toISOString().slice(0, 10),
      amount: amount.value,
      category: category.value,
      title: title.value.trim(),
      note: 'Загруженный счёт',
      propertyId: propertyId.value,
      documents: [{
        name: document.value.name,
        mimeType: document.value.mimeType,
        size: document.value.size,
        dataUrl: document.value.dataUrl,
      }],
    })
  } else {
    const tenant = portfolio.getTenantById(tenantId.value!)
    if (!tenant) return
    billing.addTenantInvoice(payload, tenant)
  }

  onClose()
}

function confidenceLabel(c: ParsedInvoiceAmount['confidence']) {
  const map = { high: 'Высокая', medium: 'Средняя', low: 'Низкая', none: '—' }
  return map[c]
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
  <Modal :open="billing.uploadBillModalOpen" title="Загрузить счёт" size="xl" @close="onClose">
    <div class="space-y-5">
      <!-- File upload -->
      <div>
        <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Файл счёта</label>
        <div
          class="rounded-xl border-2 border-dashed border-border bg-panel p-6 text-center cursor-pointer hover:border-emerald-brand/40 hover:bg-card-hover/30 transition-colors"
          :class="{ 'border-red-500/50': errors.document }"
          @click="inputRef?.click()"
        >
          <input ref="inputRef" type="file" class="hidden" accept=".pdf,.txt,image/*" @change="onFileSelected" />
          <Loader2 v-if="parsing" class="w-8 h-8 text-emerald-brand mx-auto mb-2 animate-spin" />
          <FileUp v-else class="w-8 h-8 text-slate-500 mx-auto mb-2" />
          <p v-if="document" class="text-sm text-slate-200 font-medium">{{ document.name }}</p>
          <p v-else class="text-sm text-slate-400">PDF, TXT или изображение</p>
          <p class="text-xs text-slate-500 mt-1">Нажмите для выбора файла</p>
        </div>
        <p v-if="errors.document" class="text-xs text-red-400 mt-1">{{ errors.document }}</p>
      </div>

      <!-- Parsed amount -->
      <div v-if="parseResult" class="rounded-xl border border-border bg-panel/40 p-4">
        <div class="flex items-center gap-2 mb-2">
          <Sparkles class="w-4 h-4 text-emerald-brand" />
          <span class="text-xs font-medium text-slate-400 uppercase tracking-wide">Распознанная сумма</span>
          <span class="text-xs px-2 py-0.5 rounded" :class="confidenceClass(parseResult.confidence)">
            {{ confidenceLabel(parseResult.confidence) }}
          </span>
        </div>
        <p v-if="parseResult.amount != null" class="text-xl font-mono text-emerald-brand">
          {{ accounting.formatMoney(parseResult.amount) }}
        </p>
        <p v-else class="text-sm text-slate-500">Сумма не распознана — введите вручную</p>
        <p v-if="parseResult.source" class="text-xs text-slate-600 mt-1 truncate">{{ parseResult.source }}</p>
      </div>

      <!-- Recipient type -->
      <div>
        <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Кому счёт</label>
        <div class="grid sm:grid-cols-2 gap-2">
          <button
            type="button"
            class="flex items-center gap-2 px-4 py-3 rounded-xl border text-sm text-left transition-colors"
            :class="recipientType === 'landlord' ? 'border-emerald-brand/50 bg-emerald-brand/10 text-white' : 'border-border text-slate-400 hover:bg-card-hover'"
            @click="recipientType = 'landlord'"
          >
            <Building2 class="w-4 h-4 shrink-0" />
            {{ BILL_RECIPIENT_LABELS.landlord }}
          </button>
          <button
            type="button"
            class="flex items-center gap-2 px-4 py-3 rounded-xl border text-sm text-left transition-colors"
            :class="recipientType === 'tenant' ? 'border-emerald-brand/50 bg-emerald-brand/10 text-white' : 'border-border text-slate-400 hover:bg-card-hover'"
            @click="recipientType = 'tenant'"
          >
            <User class="w-4 h-4 shrink-0" />
            {{ BILL_RECIPIENT_LABELS.tenant }}
          </button>
        </div>
      </div>

      <!-- Tenant INN -->
      <div v-if="recipientType === 'tenant'" class="space-y-3 p-4 rounded-xl border border-border bg-panel/20">
        <div>
          <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">ИНН арендатора</label>
          <input
            v-model="tenantInn"
            type="text"
            placeholder="7707083893"
            list="known-inns"
            :class="[inputClass, 'font-mono', { 'border-red-500': errors.tenantInn }]"
          />
          <datalist id="known-inns">
            <option v-for="item in knownInns" :key="item.inn" :value="item.inn">{{ item.company }}</option>
          </datalist>
          <p v-if="errors.tenantInn" class="text-xs text-red-400 mt-1">{{ errors.tenantInn }}</p>
        </div>
        <div v-if="tenantsByInn.length > 1">
          <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Помещение</label>
          <select v-model="tenantId" :class="[inputClass, { 'border-red-500': errors.tenantId }]">
            <option v-for="t in tenantsByInn" :key="t.id" :value="t.id">
              {{ t.company }} · {{ t.space }}
            </option>
          </select>
        </div>
        <p v-else-if="tenantsByInn.length === 1" class="text-xs text-slate-500">
          {{ tenantsByInn[0]!.company }} · помещение {{ tenantsByInn[0]!.space }}
        </p>
      </div>

      <!-- Common fields -->
      <div>
        <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Название</label>
        <input v-model="title" type="text" :class="[inputClass, { 'border-red-500': errors.title }]" />
        <p v-if="errors.title" class="text-xs text-red-400 mt-1">{{ errors.title }}</p>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Сумма к оплате, ₽</label>
          <input v-model.number="amount" type="number" min="0" step="0.01" :class="[inputClass, 'font-mono', { 'border-red-500': errors.amount }]" />
          <p v-if="errors.amount" class="text-xs text-red-400 mt-1">{{ errors.amount }}</p>
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Оплатить до</label>
          <input v-model="dueDate" type="date" :class="[inputClass, { 'border-red-500': errors.dueDate }]" />
        </div>
      </div>

      <div v-if="recipientType === 'landlord'" class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Категория</label>
          <select v-model="category" :class="inputClass">
            <option v-for="[key, label] in categories" :key="key" :value="key">{{ label }}</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Объект</label>
          <select v-model="propertyId" :class="inputClass">
            <option :value="null">Общий</option>
            <option v-for="p in portfolio.properties" :key="p.id" :value="p.id">{{ p.address }}</option>
          </select>
        </div>
      </div>

      <p v-if="recipientType === 'tenant'" class="text-xs text-slate-500 rounded-lg bg-emerald-brand/5 border border-emerald-brand/20 px-3 py-2">
        После сохранения счёт появится в панели арендатора в разделе «Счета».
      </p>
    </div>

    <template #footer>
      <button type="button" class="panel-btn-secondary" @click="onClose">Отмена</button>
      <button
        type="button"
        class="panel-btn-primary disabled:opacity-50"
        :disabled="parsing"
        @click="submit"
      >
        {{ recipientType === 'tenant' ? 'Отправить арендатору' : 'Сохранить расход' }}
      </button>
    </template>
  </Modal>
</template>
