<script setup lang="ts">
import { RouterView } from 'vue-router'
import { useThemeStore } from '@/stores/themeStore'
import AppToast from '@/components/ui/AppToast.vue'

useThemeStore()
</script>

<template>
  <RouterView />
  <AppToast />
</template>
