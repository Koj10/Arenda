<script setup lang="ts">
import { ref, computed } from 'vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import AddExpenseModal from '@/components/accounting/AddExpenseModal.vue'
import ExpenseDetailModal from '@/components/accounting/ExpenseDetailModal.vue'
import UploadBillModal from '@/components/accounting/UploadBillModal.vue'
import CashFlowChart from '@/components/charts/CashFlowChart.vue'
import ExpenseDonutChart from '@/components/charts/ExpenseDonutChart.vue'
import RevenueBarChart from '@/components/charts/RevenueBarChart.vue'
import { Plus, Search, Receipt, Paperclip, FileUp, TrendingUp, TrendingDown, Wallet, Clock, ArrowUpRight, ArrowDownRight } from '@lucide/vue'
import { useAccountingStore } from '@/stores/accountingStore'
import { useBillingStore } from '@/stores/billingStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { EXPENSE_CATEGORY_LABELS } from '@/types/accounting'
import type { ExpenseCategory } from '@/types/accounting'

const accounting = useAccountingStore()
const billing = useBillingStore()
const portfolio = usePortfolioStore()

const activeTab = ref<'overview' | 'transactions' | 'invoices'>('overview')
const search = ref('')
const categoryFilter = ref<ExpenseCategory | 'all'>('all')

const categories = Object.entries(EXPENSE_CATEGORY_LABELS) as [ExpenseCategory, string][]

const totalIncome = computed(() => portfolio.properties.reduce((s, p) => s + p.income, 0))
const totalExpenses = computed(() => portfolio.properties.reduce((s, p) => s + p.expense, 0))
const netProfit = computed(() => totalIncome.value - totalExpenses.value)

const filtered = computed(() => {
  let list = accounting.expenses
  if (categoryFilter.value !== 'all') {
    list = list.filter((e) => e.category === categoryFilter.value)
  }
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.note.toLowerCase().includes(q) ||
        EXPENSE_CATEGORY_LABELS[e.category].toLowerCase().includes(q),
    )
  }
  return list
})

function categoryClass(category: ExpenseCategory) {
  const map: Record<ExpenseCategory, string> = {
    utilities: 'text-sky-400 bg-sky-500/10',
    maintenance: 'text-orange-400 bg-orange-500/10',
    tax: 'text-violet-400 bg-violet-500/10',
    insurance: 'text-emerald-400 bg-emerald-500/10',
    management: 'text-teal-400 bg-teal-500/10',
    other: 'text-slate-400 bg-slate-500/10',
  }
  return map[category]
}

function propertyShort(propertyId: number | null) {
  if (!propertyId) return 'Общий'
  const p = portfolio.getPropertyById(propertyId)
  if (!p) return '—'
  const parts = p.address.split(',')
  return parts[parts.length - 1]?.trim() ?? p.address
}

function formatShort(n: number) {
  if (n >= 1_000_000) return `₽${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `₽${Math.round(n / 1_000)}K`
  return accounting.formatMoney(n)
}
</script>

<template>
  <AppLayout>
    <div class="max-w-7xl">
      <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            :class="['panel-tab', activeTab === 'overview' && 'panel-tab-active']"
            @click="activeTab = 'overview'"
          >
            Обзор
          </button>
          <button
            type="button"
            :class="['panel-tab', activeTab === 'transactions' && 'panel-tab-active']"
            @click="activeTab = 'transactions'"
          >
            Транзакции
          </button>
          <button
            type="button"
            :class="['panel-tab', activeTab === 'invoices' && 'panel-tab-active']"
            @click="activeTab = 'invoices'"
          >
            Счета
          </button>
        </div>
        <button type="button" class="panel-btn-primary" @click="accounting.openExpenseModal()">
          <Plus class="w-4 h-4" />
          Добавить транзакцию
        </button>
      </div>

      <template v-if="activeTab === 'overview'">
        <div class="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <div class="panel-stat-card">
            <div class="flex items-start justify-between mb-3">
              <span class="text-xs text-slate-500 uppercase tracking-wide">Total Income</span>
              <span class="p-2 rounded-xl bg-emerald-brand/10 text-emerald-brand"><ArrowUpRight class="w-4 h-4" /></span>
            </div>
            <p class="text-2xl font-bold font-mono text-white">{{ formatShort(totalIncome) }}</p>
            <p class="text-xs text-emerald-brand mt-2 flex items-center gap-1"><TrendingUp class="w-3 h-3" />+18.2% к прошлому месяцу</p>
          </div>
          <div class="panel-stat-card">
            <div class="flex items-start justify-between mb-3">
              <span class="text-xs text-slate-500 uppercase tracking-wide">Total Expenses</span>
              <span class="p-2 rounded-xl bg-red-500/10 text-red-400"><ArrowDownRight class="w-4 h-4" /></span>
            </div>
            <p class="text-2xl font-bold font-mono text-white">{{ formatShort(totalExpenses) }}</p>
            <p class="text-xs text-red-400 mt-2 flex items-center gap-1"><TrendingDown class="w-3 h-3" />-8.5% к прошлому месяцу</p>
          </div>
          <div class="panel-stat-card">
            <div class="flex items-start justify-between mb-3">
              <span class="text-xs text-slate-500 uppercase tracking-wide">Net Profit</span>
              <span class="p-2 rounded-xl bg-orange-500/10 text-orange-400"><Wallet class="w-4 h-4" /></span>
            </div>
            <p class="text-2xl font-bold font-mono text-white">{{ formatShort(netProfit) }}</p>
            <p class="text-xs text-emerald-brand mt-2 flex items-center gap-1"><TrendingUp class="w-3 h-3" />+24.3% к прошлому месяцу</p>
          </div>
          <div class="panel-stat-card">
            <div class="flex items-start justify-between mb-3">
              <span class="text-xs text-slate-500 uppercase tracking-wide">Pending Payments</span>
              <span class="p-2 rounded-xl bg-yellow-500/10 text-yellow-400"><Clock class="w-4 h-4" /></span>
            </div>
            <p class="text-2xl font-bold font-mono text-white">₽128K</p>
            <p class="text-xs text-red-400 mt-2">3 просрочено</p>
          </div>
        </div>

        <div class="grid lg:grid-cols-3 gap-4 mb-4">
          <div class="lg:col-span-2">
            <CashFlowChart />
          </div>
          <ExpenseDonutChart />
        </div>
        <RevenueBarChart />
      </template>

      <template v-else-if="activeTab === 'transactions'">
        <div class="flex flex-wrap gap-3 mb-4">
          <div class="relative flex-1 min-w-[200px] max-w-md">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input v-model="search" type="text" placeholder="Поиск по названию..." class="panel-search" />
          </div>
          <select v-model="categoryFilter" class="panel-input w-auto min-w-[160px]">
            <option value="all">Все категории</option>
            <option v-for="[key, label] in categories" :key="key" :value="key">{{ label }}</option>
          </select>
        </div>

        <div class="panel-card">
          <table class="w-full text-sm">
            <thead>
              <tr class="panel-table-head">
                <th class="px-5 py-3 font-medium">Дата</th>
                <th class="px-5 py-3 font-medium">Название</th>
                <th class="px-5 py-3 font-medium hidden sm:table-cell">Категория</th>
                <th class="px-5 py-3 font-medium hidden md:table-cell">Объект</th>
                <th class="px-5 py-3 font-medium">Сумма</th>
                <th class="px-5 py-3 font-medium hidden lg:table-cell">Документы</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="expense in filtered"
                :key="expense.id"
                class="panel-table-row cursor-pointer group"
                @click="accounting.openExpenseDetail(expense.id)"
              >
                <td class="px-5 py-3.5 font-mono text-xs text-slate-400">{{ accounting.formatDate(expense.date) }}</td>
                <td class="px-5 py-3.5">
                  <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-lg bg-panel flex items-center justify-center shrink-0 group-hover:bg-card-hover transition-colors">
                      <Receipt class="w-4 h-4 text-slate-500 group-hover:text-emerald-brand" />
                    </div>
                    <span class="text-white font-medium group-hover:text-emerald-brand transition-colors">{{ expense.title }}</span>
                  </div>
                </td>
                <td class="px-5 py-3.5 hidden sm:table-cell">
                  <span class="inline-flex px-2 py-0.5 rounded text-xs font-medium" :class="categoryClass(expense.category)">
                    {{ EXPENSE_CATEGORY_LABELS[expense.category] }}
                  </span>
                </td>
                <td class="px-5 py-3.5 text-slate-400 text-xs hidden md:table-cell">{{ propertyShort(expense.propertyId) }}</td>
                <td class="px-5 py-3.5 font-mono text-red-400">{{ accounting.formatMoney(expense.amount) }}</td>
                <td class="px-5 py-3.5 hidden lg:table-cell">
                  <span v-if="expense.documents.length" class="inline-flex items-center gap-1 text-xs text-slate-400">
                    <Paperclip class="w-3.5 h-3.5" />
                    {{ expense.documents.length }}
                  </span>
                  <span v-else class="text-xs text-slate-600">—</span>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="filtered.length === 0" class="py-12 text-center text-slate-500 text-sm">
            Расходы не найдены
          </div>
        </div>
      </template>

      <template v-else>
        <div class="panel-card p-8 text-center">
          <div class="w-14 h-14 rounded-2xl bg-emerald-brand/10 text-emerald-brand flex items-center justify-center mx-auto mb-4">
            <FileUp class="w-7 h-7" />
          </div>
          <h3 class="text-lg font-semibold mb-2">Входящие счета</h3>
          <p class="text-sm text-slate-500 mb-6 max-w-md mx-auto">
            Загружайте PDF-счета — система распознает сумму и привяжет к объекту.
          </p>
          <button type="button" class="panel-btn-primary" @click="billing.openUploadBillModal()">
            <FileUp class="w-4 h-4" />
            Загрузить счёт
          </button>
        </div>
      </template>
    </div>

    <AddExpenseModal />
    <ExpenseDetailModal />
    <UploadBillModal />
  </AppLayout>
</template>
