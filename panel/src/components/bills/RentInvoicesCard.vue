<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Check, ChevronDown, ChevronUp, FileText } from '@lucide/vue'
import { confirmInvoicePayment, generateLandlordInvoices, getLandlordInvoice, listLandlordInvoices, sendLandlordInvoice } from '@/api/landlord'
import { downloadFileBlob, formatApiError } from '@/api/http'
import { num, type FileOut, type LandlordInvoiceOut } from '@/api/types'
import { INVOICE_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@/types/billing'
import type { InvoiceStatus, PaymentMethod } from '@/types/billing'
import { currentPeriod } from '@/utils/dates'

type StatusFilter = InvoiceStatus | 'all'

const invoices = ref<LandlordInvoiceOut[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const confirmingId = ref<number | null>(null)
const sendingId = ref<number | null>(null)
const generating = ref(false)
const filesByInvoice = ref<Record<number, FileOut[]>>({})
const collapsed = ref(true)
const statusFilter = ref<StatusFilter>('all')

const STATUS_RANK: Record<InvoiceStatus, number> = {
  awaiting_confirmation: 0,
  overdue: 1,
  pending: 2,
  paid: 3,
}

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'awaiting_confirmation', label: 'Подтвердить' },
  { id: 'overdue', label: 'Просроченные' },
  { id: 'pending', label: 'К оплате' },
  { id: 'paid', label: 'Оплаченные' },
]

function statusOf(row: LandlordInvoiceOut): InvoiceStatus {
  const value = row.computed_status || row.status
  if (value === 'paid' || value === 'overdue' || value === 'pending' || value === 'awaiting_confirmation') return value
  return 'pending'
}

function statusClass(status: InvoiceStatus) {
  const map: Record<InvoiceStatus, string> = {
    pending: 'text-accent-amber bg-accent-amber/10',
    paid: 'text-emerald-400 bg-emerald-500/10',
    overdue: 'text-rose-400 bg-rose-500/10',
    awaiting_confirmation: 'text-sky-300 bg-sky-500/10',
  }
  return map[status]
}

function countByStatus(status: InvoiceStatus) {
  return invoices.value.filter((row) => statusOf(row) === status).length
}

const visibleInvoices = computed(() => {
  const rows = invoices.value.filter((row) => {
    if (statusFilter.value === 'all') return true
    return statusOf(row) === statusFilter.value
  })
  return [...rows].sort((a, b) => {
    const rank = STATUS_RANK[statusOf(a)] - STATUS_RANK[statusOf(b)]
    if (rank !== 0) return rank
    return (b.period || '').localeCompare(a.period || '')
  })
})

const awaitingCount = computed(() => countByStatus('awaiting_confirmation'))
const overdueCount = computed(() => countByStatus('overdue'))

const collapseSummary = computed(() => {
  if (loading.value) return 'Загрузка счетов...'
  const total = invoices.value.length
  if (!total) return 'Счетов на аренду пока нет'
  const parts = [`${total} ${pluralInvoices(total)}`]
  if (awaitingCount.value) parts.push(`${awaitingCount.value} ждут подтверждения`)
  if (overdueCount.value) parts.push(`${overdueCount.value} просрочены`)
  return parts.join(' · ')
})

function pluralInvoices(n: number) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'счёт'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'счёта'
  return 'счетов'
}

function filterCount(id: StatusFilter) {
  if (id === 'all') return invoices.value.length
  return countByStatus(id)
}

function filterChipClass(id: StatusFilter) {
  const active = statusFilter.value === id
  if (active) return 'bg-emerald-brand/15 text-emerald-brand border-emerald-brand/40'
  if (id === 'awaiting_confirmation' && awaitingCount.value) return 'text-sky-300 border-sky-500/30 hover:bg-sky-500/10'
  if (id === 'overdue' && overdueCount.value) return 'text-rose-300 border-rose-500/30 hover:bg-rose-500/10'
  return 'text-slate-400 border-border hover:bg-white/5'
}

async function load() {
  loading.value = true
  error.value = null
  try {
    invoices.value = await listLandlordInvoices()
    const awaiting = invoices.value.filter((row) => statusOf(row) === 'awaiting_confirmation')
    const files: Record<number, FileOut[]> = {}
    await Promise.all(
      awaiting.map(async (row) => {
        const detail = await getLandlordInvoice(row.id)
        files[row.id] = detail.files ?? []
      }),
    )
    filesByInvoice.value = files
  } catch (err) {
    error.value = formatApiError(err, 'Не удалось загрузить счета аренды')
  } finally {
    loading.value = false
  }
}

async function confirm(id: number) {
  confirmingId.value = id
  error.value = null
  try {
    await confirmInvoicePayment(id)
    await load()
  } catch (err) {
    error.value = formatApiError(err, 'Не удалось подтвердить оплату')
  } finally {
    confirmingId.value = null
  }
}

async function generate() {
  generating.value = true
  error.value = null
  try {
    await generateLandlordInvoices(currentPeriod())
    await load()
    collapsed.value = false
  } catch (err) {
    error.value = formatApiError(err, 'Не удалось сгенерировать счета')
  } finally {
    generating.value = false
  }
}

async function send(id: number) {
  sendingId.value = id
  error.value = null
  try {
    await sendLandlordInvoice(id)
    await load()
  } catch (err) {
    error.value = formatApiError(err, 'Не удалось отправить счёт')
  } finally {
    sendingId.value = null
  }
}

async function openFile(file: FileOut) {
  const blob = await downloadFileBlob(file.id)
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener')
}

onMounted(() => {
  void load()
})
</script>

<template>
  <section class="panel-card overflow-hidden">
    <div class="px-5 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
      <div class="min-w-0">
        <h2 class="text-sm font-semibold text-white">Счета арендаторам</h2>
        <p class="text-xs text-slate-500 mt-1">
          {{ collapseSummary || 'Счёт появляется, как только вы добавили арендатора.' }}
        </p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button
          type="button"
          class="panel-btn-secondary text-xs"
          :disabled="loading || invoices.length === 0"
          :title="collapsed ? 'Показать таблицу счетов' : 'Свернуть таблицу счетов'"
          @click="collapsed = !collapsed"
        >
          <ChevronDown v-if="collapsed" class="w-4 h-4" />
          <ChevronUp v-else class="w-4 h-4" />
          {{ collapsed ? 'Показать счета' : 'Свернуть' }}
        </button>
        <button type="button" class="panel-btn-primary text-xs" :disabled="generating" @click="generate">
          {{ generating ? 'Генерация...' : 'Сгенерировать за месяц' }}
        </button>
      </div>
    </div>
    <p v-if="error" class="px-5 py-3 text-sm text-rose-400 border-b border-border">{{ error }}</p>
    <div v-show="!collapsed">
      <p v-if="loading" class="px-5 py-8 text-sm text-slate-500 text-center">Загрузка...</p>
      <div v-else-if="invoices.length === 0" class="px-5 py-8 text-sm text-slate-500 text-center">
        Счетов на аренду пока нет
      </div>
      <template v-else>
        <div class="px-5 py-3 border-b border-border flex flex-wrap gap-2">
          <button
            v-for="item in FILTERS"
            :key="item.id"
            type="button"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-colors"
            :class="filterChipClass(item.id)"
            @click="statusFilter = item.id"
          >
            {{ item.label }}
            <span class="font-mono text-[10px] opacity-80">{{ filterCount(item.id) }}</span>
          </button>
        </div>
        <div v-if="visibleInvoices.length === 0" class="px-5 py-8 text-sm text-slate-500 text-center">
          Нет счетов с таким статусом
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-border">
                <th class="px-5 py-3 font-medium">Арендатор</th>
                <th class="px-5 py-3 font-medium">Период</th>
                <th class="px-5 py-3 font-medium">Сумма</th>
                <th class="px-5 py-3 font-medium">Статус</th>
                <th class="px-5 py-3 font-medium">Действие</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in visibleInvoices" :key="row.id" class="border-b border-border/80 align-top">
                <td class="px-5 py-3.5">
                  <p class="text-slate-200">{{ row.tenant_name }}</p>
                  <p class="text-xs text-slate-500">{{ row.object_address }} · {{ row.unit_number }}</p>
                </td>
                <td class="px-5 py-3.5 text-slate-400 font-mono text-xs">{{ row.period }}</td>
                <td class="px-5 py-3.5 font-mono text-slate-200">
                  {{ new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(num(row.amount)) }}
                </td>
                <td class="px-5 py-3.5">
                  <span class="inline-flex px-2 py-0.5 rounded text-xs font-medium" :class="statusClass(statusOf(row))">
                    {{ INVOICE_STATUS_LABELS[statusOf(row)] }}
                  </span>
                  <p v-if="row.payment_method" class="text-[11px] text-slate-500 mt-1">
                    {{ PAYMENT_METHOD_LABELS[row.payment_method as PaymentMethod] || row.payment_method }}
                  </p>
                  <div v-if="filesByInvoice[row.id]?.length" class="mt-2 space-y-1">
                    <button
                      v-for="file in filesByInvoice[row.id]"
                      :key="file.id"
                      type="button"
                      class="inline-flex items-center gap-1 text-xs text-accent-teal hover:underline"
                      @click="openFile(file)"
                    >
                      <FileText class="w-3 h-3" />
                      {{ file.original_name || file.filename || file.name || 'Чек' }}
                    </button>
                  </div>
                </td>
                <td class="px-5 py-3.5">
                  <div class="flex flex-col gap-2 items-start">
                    <button
                      v-if="statusOf(row) === 'awaiting_confirmation'"
                      type="button"
                      class="panel-btn-primary text-xs"
                      :disabled="confirmingId === row.id"
                      @click="confirm(row.id)"
                    >
                      <Check class="w-3.5 h-3.5" />
                      {{ confirmingId === row.id ? 'Подтверждение...' : 'Подтвердить оплату' }}
                    </button>
                    <button
                      v-if="statusOf(row) !== 'paid'"
                      type="button"
                      class="panel-btn-secondary text-xs"
                      :disabled="sendingId === row.id"
                      @click="send(row.id)"
                    >
                      {{ sendingId === row.id ? 'Отправка...' : 'Отправить арендатору' }}
                    </button>
                    <span v-if="statusOf(row) === 'paid'" class="text-xs text-slate-600">—</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>
  </section>
</template>

