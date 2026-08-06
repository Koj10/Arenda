<script setup lang="ts">
import { computed } from 'vue'
import { Sparkles } from '@lucide/vue'
import Modal from '@/components/ui/Modal.vue'
import { usePlanStore } from '@/stores/planStore'
import { PLAN_CATALOG } from '@/config/plans'
import type { PlanFeature } from '@/types/plan'

const FEATURE_HINT: Partial<Record<PlanFeature, string>> = {
  fullAnalytics: 'Полная аналитика портфеля',
  exportReports: 'Экспорт отчётов в Excel/PDF',
  autoInvoices: 'Автосчета и напоминания',
  tenantReportsIncluded: 'Отчёты в кабинете арендатора',
  multiUser: 'Несколько пользователей',
  branding: 'Брендинг и кастом панели',
  customFields: 'Кастомные поля',
  apiAccess: 'API и интеграции',
  prioritySupport: 'Приоритетная поддержка',
  dedicatedManager: 'Персональный менеджер',
}

const plan = usePlanStore()

const target = computed(() => plan.nextPlan ?? PLAN_CATALOG.profi)

const title = computed(() => {
  if (plan.upgradeFeature && FEATURE_HINT[plan.upgradeFeature]) {
    return FEATURE_HINT[plan.upgradeFeature]!
  }
  return `Перейти на ${target.value.name}`
})

const priceLabel = computed(() =>
  target.value.priceMonthly === 0
    ? 'Бесплатно'
    : `₽${target.value.priceMonthly.toLocaleString('ru-RU')}/мес`,
)

async function onUpgrade() {
  await plan.startCheckout(target.value.id)
  if (import.meta.env.DEV) {
    plan.stubSetPlan(target.value.id)
    plan.closeUpgrade()
  }
}
</script>

<template>
  <Modal :open="plan.upgradeOpen" :title="title" @close="plan.closeUpgrade()">
    <p class="text-xs text-slate-500 mb-3">Текущий тариф: {{ plan.plan.name }}</p>
    <p v-if="plan.upgradeReason" class="text-sm text-slate-400 mb-4 leading-relaxed">
      {{ plan.upgradeReason }}
    </p>

    <div class="rounded-xl border border-border bg-panel p-4">
      <div class="flex items-center gap-2 mb-1">
        <Sparkles class="w-4 h-4 text-emerald-brand" />
        <span class="font-semibold text-white">{{ target.name }}</span>
      </div>
      <p class="text-sm text-slate-400 mb-2">{{ target.description }}</p>
      <p class="text-xl font-bold text-white">{{ priceLabel }}</p>
    </div>

    <p class="mt-3 text-[11px] text-slate-600">
      Checkout через API · в dev апгрейд применяется локально (stub)
    </p>

    <template #footer>
      <button type="button" class="panel-btn-secondary" @click="plan.closeUpgrade()">Позже</button>
      <button type="button" class="panel-btn-primary" @click="onUpgrade">
        Перейти на {{ target.name }}
      </button>
    </template>
  </Modal>
</template>
