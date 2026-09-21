<script setup lang="ts">
import { RouterView } from 'vue-router'
import { useThemeStore } from '@/stores/themeStore'

useThemeStore()
</script>

<template>
  <RouterView />
</template>
