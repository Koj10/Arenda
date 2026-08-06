<script setup lang="ts">
import PanelLayout from '@/components/layout/PanelLayout.vue'
import TenantSidebar from '@/components/layout/TenantSidebar.vue'
</script>

<template>
  <PanelLayout :sidebar="TenantSidebar" accent="teal">
    <template #header-action>
      <slot name="header-action" />
    </template>
    <slot />
  </PanelLayout>
</template>
