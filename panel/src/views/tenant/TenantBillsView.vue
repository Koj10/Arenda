<script setup lang="ts">
import { computed, ref } from 'vue'
import TenantLayout from '@/components/layout/TenantLayout.vue'
import { FileText, Download } from '@lucide/vue'
import type { Invoice } from '@/types/billing'
import { useAuthStore } from '@/stores/authStore'
import { useBillingStore } from '@/stores/billingStore'
import { INVOICE_TYPE_LABELS, INVOICE_STATUS_LABELS } from '@/types/billing'
import type { InvoiceStatus } from '@/types/billing'

const auth = useAuthStore()
const billing = useBillingStore()

const statusFilter = ref<InvoiceStatus | 'all'>('all')

const bills = computed(() => {
  const inn = auth.tenantInn
  if (!inn) return []
  let list = billing.getInvoicesByInn(inn)
  if (statusFilter.value !== 'all') {
    list = list.filter((b) => b.status === statusFilter.value)
  }
  return list.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
})

const pendingTotal = computed(() =>
  bills.value.filter((b) => b.status === 'pending' || b.status === 'overdue').reduce((s, b) => s + b.amount, 0),
)

function downloadBill(bill: Invoice) {
  if (!bill.document) return
  const link = document.createElement('a')
  link.href = bill.document.dataUrl
  link.download = bill.document.name
  link.target = '_blank'
  link.rel = 'noopener'
  link.click()
}

function statusClass(status: string) {
  const map: Record<string, string> = {
    pending: 'text-accent-amber bg-accent-amber/10',
    paid: 'text-emerald-400 bg-emerald-500/10',
    overdue: 'text-rose-400 bg-rose-500/10',
  }
  return map[status] ?? ''
}
</script>

<template>
  <TenantLayout>
    <div class="max-w-4xl">
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-white mb-1" style="font-family: Poppins, Inter, sans-serif">Счета</h1>
        <p class="text-sm text-slate-400">Ежемесячные счета на аренду, ЖКХ и другие услуги</p>
      </div>

      <div class="grid sm:grid-cols-2 gap-4 mb-6">
        <div class="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <p class="text-xs text-slate-500 uppercase tracking-wide mb-1">К оплате</p>
          <p class="text-xl font-mono text-rose-400">{{ billing.formatMoney(pendingTotal) }}</p>
        </div>
        <div class="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <p class="text-xs text-slate-500 uppercase tracking-wide mb-1">Всего счетов</p>
          <p class="text-xl font-mono text-slate-200">{{ bills.length }}</p>
        </div>
      </div>

      <div class="flex flex-wrap gap-2 mb-4">
        <button
          v-for="opt in ([['all', 'Все'], ['pending', 'К оплате'], ['paid', 'Оплаченные'], ['overdue', 'Просроченные']] as const)"
          :key="opt[0]"
          type="button"
          class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          :class="statusFilter === opt[0] ? 'bg-teal-500/20 text-accent-teal' : 'bg-slate-800 text-slate-400 hover:text-slate-200'"
          @click="statusFilter = opt[0]"
        >
          {{ opt[1] }}
        </button>
      </div>

      <div class="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-800">
              <th class="px-5 py-3 font-medium">Счёт</th>
              <th class="px-5 py-3 font-medium hidden sm:table-cell">Период</th>
              <th class="px-5 py-3 font-medium hidden md:table-cell">Помещение</th>
              <th class="px-5 py-3 font-medium">Сумма</th>
              <th class="px-5 py-3 font-medium">Статус</th>
              <th class="px-5 py-3 font-medium hidden lg:table-cell">Файл</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="bill in bills"
              :key="bill.id"
              class="border-b border-slate-800/80"
            >
              <td class="px-5 py-3.5">
                <div class="flex items-center gap-2">
                  <FileText class="w-4 h-4 text-slate-500 shrink-0" />
                  <div>
                    <p class="text-slate-200">{{ bill.title }}</p>
                    <p class="text-xs text-slate-500">{{ INVOICE_TYPE_LABELS[bill.type] }} · до {{ billing.formatDate(bill.dueDate) }}</p>
                  </div>
                </div>
              </td>
              <td class="px-5 py-3.5 text-slate-400 text-xs hidden sm:table-cell">{{ billing.formatPeriod(bill.period) }}</td>
              <td class="px-5 py-3.5 font-mono text-slate-400 hidden md:table-cell">{{ bill.space }}</td>
              <td class="px-5 py-3.5 font-mono text-slate-200">{{ billing.formatMoney(bill.amount) }}</td>
              <td class="px-5 py-3.5">
                <span class="inline-flex px-2 py-0.5 rounded text-xs font-medium" :class="statusClass(bill.status)">
                  {{ INVOICE_STATUS_LABELS[bill.status] }}
                </span>
              </td>
              <td class="px-5 py-3.5 hidden lg:table-cell">
                <button
                  v-if="bill.document"
                  type="button"
                  class="inline-flex items-center gap-1 text-xs text-accent-teal hover:underline"
                  @click="downloadBill(bill)"
                >
                  <Download class="w-3.5 h-3.5" />
                  Скачать
                </button>
                <span v-else class="text-xs text-slate-600">—</span>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="bills.length === 0" class="py-12 text-center text-slate-500 text-sm">
          Счетов не найдено
        </div>
      </div>

      <p class="text-xs text-slate-600 mt-4 text-center">
        Счета формируются арендодателем и будут приходить автоматически через API
      </p>
    </div>
  </TenantLayout>
</template>
