<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import type { Component } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { Menu, X } from '@lucide/vue'
import HeaderNotifications from '@/components/layout/HeaderNotifications.vue'
import HeaderProfileMenu from '@/components/layout/HeaderProfileMenu.vue'
import HeaderSearch from '@/components/layout/HeaderSearch.vue'
import { useNotificationsStore } from '@/stores/notificationsStore'
import { usePanelSearchStore } from '@/stores/panelSearchStore'

defineProps<{
  sidebar: Component
  accent?: 'amber' | 'teal'
}>()

const route = useRoute()
const auth = useAuthStore()
const notifications = useNotificationsStore()
const panelSearch = usePanelSearchStore()
const sidebarOpen = ref(false)
const isNarrow = ref(false)

const pageTitle = computed(() => (route.meta.pageTitle as string) ?? 'PropCount')
const pageSubtitle = computed(() => (route.meta.pageSubtitle as string) ?? '')

function syncViewport() {
  isNarrow.value = window.matchMedia('(max-width: 767px)').matches
}

watch(
  () => [auth.user?.email, auth.user?.role] as const,
  ([email, role]) => {
    if (email && role) notifications.hydrate(role, email)
    else notifications.clear()
  },
  { immediate: true },
)

watch(
  () => route.fullPath,
  () => {
    panelSearch.clear()
  },
)

onMounted(() => {
  syncViewport()
  window.addEventListener('resize', syncViewport)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', syncViewport)
})

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

    <aside
      class="fixed inset-y-0 left-0 z-50 w-[min(100vw-3rem,16.25rem)] sm:w-[260px] transition-transform duration-300 ease-out"
      :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'"
    >
      <div class="relative h-full">
        <button
          type="button"
          class="lg:hidden absolute top-3 right-3 z-10 p-2 rounded-xl bg-card border border-border text-slate-400 hover:text-white"
          aria-label="Закрыть меню"
          @click="closeMobile"
        >
          <X class="w-4 h-4" />
        </button>
        <component :is="sidebar" class="h-full" @navigate="closeMobile" />
      </div>
    </aside>

    <div class="flex flex-col min-w-0 min-h-screen lg:pl-[260px]">
      <header class="sticky top-0 z-30 border-b border-border bg-navy/95 backdrop-blur-md">
        <div
          class="panel-header-bar grid items-center gap-x-3 sm:gap-x-4 min-h-[64px] sm:min-h-[72px] px-3 sm:px-5 lg:px-8 py-2"
        >
          <div class="flex items-center gap-2 sm:gap-3 min-w-0 justify-self-start">
            <button
              type="button"
              class="lg:hidden shrink-0 p-2 rounded-xl text-slate-400 hover:bg-card border border-transparent hover:border-border"
              aria-label="Открыть меню"
              @click="sidebarOpen = true"
            >
              <Menu class="w-5 h-5" />
            </button>
            <div class="min-w-0">
              <h1
                class="text-base sm:text-lg font-bold truncate leading-tight"
                style="font-family: var(--font-display)"
              >
                {{ pageTitle }}
              </h1>
              <p
                v-if="pageSubtitle"
                class="text-[11px] text-slate-500 truncate mt-0.5 hidden xl:block max-w-[16rem] 2xl:max-w-[20rem]"
              >
                {{ pageSubtitle }}
              </p>
            </div>
          </div>

          <div v-if="!isNarrow" class="flex justify-center justify-self-center w-full px-2">
            <HeaderSearch />
          </div>

          <div class="flex items-center justify-end gap-1.5 sm:gap-2 justify-self-end min-w-0">
            <div class="flex items-center min-w-0 [&_.panel-btn-primary]:!px-2.5 sm:[&_.panel-btn-primary]:!px-3 lg:[&_.panel-btn-primary]:!px-4 [&_.panel-btn-primary]:text-xs sm:[&_.panel-btn-primary]:text-sm">
              <slot name="header-action" />
            </div>
            <HeaderNotifications />
            <HeaderProfileMenu />
          </div>
        </div>

        <div v-if="isNarrow" class="px-3 pb-3">
          <HeaderSearch mobile />
        </div>
      </header>

      <main class="flex-1 overflow-x-hidden">
        <div class="panel-main-inner">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>
