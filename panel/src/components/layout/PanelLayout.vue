<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import type { Component } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { Menu, X } from '@lucide/vue'
import HeaderNotifications from '@/components/layout/HeaderNotifications.vue'
import HeaderProfileMenu from '@/components/layout/HeaderProfileMenu.vue'
import HeaderSearch from '@/components/layout/HeaderSearch.vue'
import SupportChatWidget from '@/components/support/SupportChatWidget.vue'
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
  isNarrow.value = window.matchMedia('(max-width: 1279px)').matches
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
      class="fixed inset-y-0 left-0 z-50 w-[min(100vw-2.5rem,260px)] lg:w-[220px] xl:w-[260px] transition-transform duration-300 ease-out"
      :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'"
      :style="{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }"
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

    <div class="flex flex-col min-w-0 min-h-screen lg:pl-[220px] xl:pl-[260px]">
      <header
        class="sticky top-0 z-30 border-b border-border bg-navy/95 backdrop-blur-md"
        :style="{ paddingTop: 'env(safe-area-inset-top)' }"
      >
        <div
          class="panel-header-bar min-h-[56px] sm:min-h-[64px] lg:min-h-[72px] px-3 sm:px-5 lg:px-6 xl:px-8 py-2"
        >
          <div class="panel-header-title flex items-center gap-2 sm:gap-3 min-w-0">
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
                class="text-sm sm:text-base lg:text-lg font-bold truncate leading-tight"
                style="font-family: var(--font-display)"
              >
                {{ pageTitle }}
              </h1>
              <p
                v-if="pageSubtitle"
                class="text-[11px] text-slate-500 truncate mt-0.5 hidden 2xl:block max-w-[20rem]"
              >
                {{ pageSubtitle }}
              </p>
            </div>
          </div>

          <div v-if="!isNarrow" class="panel-header-search flex justify-center w-full min-w-0 px-1">
            <HeaderSearch />
          </div>

          <div class="panel-header-cta">
            <slot name="header-action" />
          </div>

          <div class="panel-header-tools flex items-center justify-end gap-1 sm:gap-1.5 shrink-0">
            <HeaderNotifications />
            <HeaderProfileMenu />
          </div>
        </div>

        <div v-if="isNarrow" class="px-3 sm:px-5 pb-3">
          <HeaderSearch mobile />
        </div>
      </header>

      <main class="flex-1 overflow-x-hidden">
        <div class="panel-main-inner">
          <slot />
        </div>
      </main>
    </div>
    <SupportChatWidget />
  </div>
</template>
