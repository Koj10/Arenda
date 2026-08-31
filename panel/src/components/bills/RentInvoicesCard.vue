<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Check, FileText } from '@lucide/vue'
import { confirmInvoicePayment, getLandlordInvoice, listLandlordInvoices } from '@/api/landlord'
import { downloadFileBlob, formatApiError } from '@/api/http'
import { num, type FileOut, type LandlordInvoiceOut } from '@/api/types'
import { INVOICE_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@/types/billing'
import type { InvoiceStatus, PaymentMethod } from '@/types/billing'

const invoices = ref<LandlordInvoiceOut[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const confirmingId = ref<number | null>(null)
const filesByInvoice = ref<Record<number, FileOut[]>>({})

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
    <div class="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
      <div>
        <h2 class="text-sm font-semibold text-white">Счета на аренду</h2>
        <p class="text-xs text-slate-500 mt-1">
          Создаются автоматически при добавлении арендатора. Доходы — только после подтверждения оплаты
          (кроме оплаты в приложении).
        </p>
      </div>
    </div>
    <p v-if="error" class="px-5 py-3 text-sm text-rose-400">{{ error }}</p>
    <p v-else-if="loading" class="px-5 py-8 text-sm text-slate-500 text-center">Загрузка...</p>
    <div v-else-if="invoices.length === 0" class="px-5 py-8 text-sm text-slate-500 text-center">
      Счетов на аренду пока нет
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
          <tr v-for="row in invoices" :key="row.id" class="border-b border-border/80 align-top">
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
              <span v-else class="text-xs text-slate-600">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
