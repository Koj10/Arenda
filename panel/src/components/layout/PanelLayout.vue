<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Component } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { Menu, X, Bell, Search, ChevronDown } from '@lucide/vue'

defineProps<{
  sidebar: Component
  accent?: 'amber' | 'teal'
}>()

const route = useRoute()
const auth = useAuthStore()
const sidebarOpen = ref(false)
const headerSearch = ref('')

const pageTitle = computed(() => (route.meta.pageTitle as string) ?? 'PropCount')
const pageSubtitle = computed(() => (route.meta.pageSubtitle as string) ?? '')

function closeMobile() {
  sidebarOpen.value = false
}
</script>

<template>
  <div class="min-h-screen bg-navy text-white">
    <div
      v-if="sidebarOpen"
      class="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
      @click="sidebarOpen = false"
    />

    <div
      class="fixed inset-y-0 left-0 z-50 w-[260px] transition-transform duration-300"
      :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'"
    >
      <div class="relative h-full">
        <button
          type="button"
          class="lg:hidden absolute top-4 right-3 z-10 p-1.5 rounded-lg bg-card border border-border text-slate-400"
          @click="closeMobile"
        >
          <X class="w-4 h-4" />
        </button>
        <component :is="sidebar" class="h-full" @navigate="closeMobile" />
      </div>
    </div>

    <div class="flex flex-col min-w-0 min-h-screen lg:pl-[260px]">
      <header class="sticky top-0 z-30 flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 h-[72px] border-b border-border bg-navy/95 backdrop-blur-md">
        <div class="flex items-center gap-3 min-w-0">
          <button
            type="button"
            class="lg:hidden p-2 rounded-xl text-slate-400 hover:bg-card border border-transparent hover:border-border"
            @click="sidebarOpen = true"
          >
            <Menu class="w-5 h-5" />
          </button>
          <div class="min-w-0">
            <h1 class="text-lg sm:text-xl font-bold truncate" style="font-family: var(--font-display)">
              {{ pageTitle }}
            </h1>
            <p v-if="pageSubtitle" class="text-xs text-slate-500 truncate hidden sm:block">{{ pageSubtitle }}</p>
          </div>
        </div>

        <div class="hidden md:flex flex-1 max-w-md mx-4 lg:mx-8">
          <div class="relative w-full">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              v-model="headerSearch"
              type="text"
              placeholder="Поиск..."
              class="panel-search"
            />
          </div>
        </div>

        <div class="flex items-center gap-2 sm:gap-3 shrink-0">
          <slot name="header-action" />
          <button type="button" class="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-card border border-transparent hover:border-border relative">
            <Bell class="w-4 h-4" />
            <span class="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 ring-2 ring-navy" />
          </button>
          <button
            type="button"
            class="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-card border border-transparent hover:border-border transition-colors"
          >
            <span class="w-9 h-9 rounded-full bg-emerald-brand/20 text-emerald-brand text-sm font-bold flex items-center justify-center shrink-0">
              {{ auth.user?.name?.charAt(0) ?? 'U' }}
            </span>
            <span class="hidden lg:block text-left min-w-0">
              <span class="block text-sm font-medium truncate max-w-[120px]">{{ auth.user?.name ?? 'Пользователь' }}</span>
              <span class="block text-[11px] text-slate-500 truncate max-w-[120px]">{{ auth.user?.email ?? '' }}</span>
            </span>
            <ChevronDown class="w-3.5 h-3.5 text-slate-500 hidden lg:block shrink-0" />
          </button>
        </div>
      </header>

      <main class="flex-1 p-4 sm:p-6 lg:p-8">
        <slot />
      </main>
    </div>
  </div>
</template>
