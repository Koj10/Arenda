<script setup lang="ts">
import { watchEffect } from 'vue'
import PanelLayout from '@/components/layout/PanelLayout.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import UpgradeModal from '@/components/plan/UpgradeModal.vue'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { usePlanStore } from '@/stores/planStore'
import { useBankRequisitesStore } from '@/stores/bankRequisitesStore'

const portfolio = usePortfolioStore()
const plan = usePlanStore()
const requisites = useBankRequisitesStore()

watchEffect(() => {
  plan.setUsage({
    objects: portfolio.properties.length,
    spaces: portfolio.spaces.length,
    tenants: portfolio.tenants.length,
  })
  if (portfolio.properties.length) requisites.publishToObjects()
})
</script>

<template>
  <PanelLayout :sidebar="AppSidebar" accent="amber">
    <template #header-action>
      <slot name="header-action" />
    </template>
    <slot />
  </PanelLayout>
  <UpgradeModal />
</template>
