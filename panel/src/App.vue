<script setup lang="ts">
import { RouterView } from 'vue-router'
import { useThemeStore } from '@/stores/themeStore'
import AppToast from '@/components/ui/AppToast.vue'
import AppRequestBusy from '@/components/ui/AppRequestBusy.vue'

useThemeStore()
</script>

<template>
  <RouterView />
  <AppToast />
  <AppRequestBusy />
</template>
