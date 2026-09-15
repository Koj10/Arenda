import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Invoice, UploadBillFormData } from '@/types/billing'
import type { Tenant } from '@/types/portfolio'
import { currentPeriod, formatDateRu, todayISODate } from '@/utils/dates'

export const useBillingStore = defineStore('billing', () => {
  const invoices = ref<Invoice[]>([])
  const uploadBillModalOpen = ref(false)

  function getInvoicesByInn(inn: string) {
    return invoices.value.filter((i) => i.inn === inn)
  }

  function getInvoicesByTenantId(tenantId: number) {
    return invoices.value.filter((i) => i.tenantId === tenantId)
  }

  function addTenantInvoice(data: UploadBillFormData, tenant: Tenant, period?: string) {
    const today = todayISODate()
    invoices.value.unshift({
      id: Date.now() + Math.random(),
      tenantId: tenant.id,
      inn: tenant.inn,
      propertyId: tenant.propertyId,
      space: tenant.space,
      period: period ?? currentPeriod(),
      type: 'utilities',
      title: data.title || data.document.name,
      amount: data.amount,
      status: 'pending',
      dueDate: data.dueDate || today,
      issuedAt: today,
      document: data.document,
    })
  }

  function formatMoney(value: number) {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value)
  }

  function formatDate(date: string) {
    return formatDateRu(date)
  }

  function formatPeriod(period: string) {
    const [year, month] = period.split('-')
    const d = new Date(Number(year), Number(month) - 1, 1)
    return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(d)
  }

  function openUploadBillModal() {
    uploadBillModalOpen.value = true
  }

  function closeUploadBillModal() {
    uploadBillModalOpen.value = false
  }

  return {
    invoices,
    uploadBillModalOpen,
    getInvoicesByInn,
    getInvoicesByTenantId,
    addTenantInvoice,
    formatMoney,
    formatDate,
    formatPeriod,
    openUploadBillModal,
    closeUploadBillModal,
  }
})
