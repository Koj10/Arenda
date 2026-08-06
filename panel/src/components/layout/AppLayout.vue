<script setup lang="ts">
import PanelLayout from '@/components/layout/PanelLayout.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
</script>

<template>
  <PanelLayout :sidebar="AppSidebar" accent="amber">
    <template #header-action>
      <slot name="header-action" />
    </template>
    <slot />
  </PanelLayout>
</template>
