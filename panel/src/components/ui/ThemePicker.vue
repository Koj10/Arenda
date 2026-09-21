<script setup lang="ts">
import { Check, Palette } from '@lucide/vue'
import { useThemeStore } from '@/stores/themeStore'

const theme = useThemeStore()
</script>

<template>
  <section class="panel-card p-5 sm:p-6">
    <div class="flex items-center gap-2 mb-2">
      <Palette class="w-4 h-4 text-emerald-brand" />
      <h2 class="text-base font-semibold text-white">Оформление панели</h2>
    </div>
    <p class="text-sm text-slate-400 mb-5 leading-relaxed">
      Выберите тему, которая вам больше нравится. Цвета логотипа и акценты автоматически подстраиваются под тему.
    </p>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <button
        v-for="item in theme.allThemes"
        :key="item.id"
        type="button"
        class="rounded-2xl border p-3 text-left transition-colors"
        :class="
          theme.themeId === item.id
            ? 'border-emerald-brand/80 ring-1 ring-emerald-brand/30 bg-emerald-brand/5'
            : 'border-border bg-transparent hover:border-emerald-brand/40'
        "
        @click="theme.setTheme(item.id)"
      >
        <div
          class="relative h-[4.25rem] rounded-xl overflow-hidden mb-3 border"
          :style="{ background: item.preview.bg, borderColor: item.preview.card }"
        >
          <div
            class="absolute top-3 left-3 right-12 h-1.5 rounded-full"
            :style="{ background: item.preview.accent }"
          />
          <div
            class="absolute top-[1.7rem] left-3 right-16 h-1 rounded-full opacity-35"
            :style="{ background: item.preview.text }"
          />
          <div
            class="absolute top-[2.35rem] left-3 w-1/2 h-1 rounded-full opacity-20"
            :style="{ background: item.preview.text }"
          />
          <div
            v-if="theme.themeId === item.id"
            class="absolute top-2.5 right-2.5 w-5 h-5 rounded-md flex items-center justify-center"
            :style="{ background: item.preview.accent }"
          >
            <Check class="w-3.5 h-3.5 text-[#ffffff]" :stroke-width="3" />
          </div>
          <div
            v-else
            class="absolute top-2.5 right-2.5 w-5 h-5 rounded-md"
            :style="{ background: item.preview.accent }"
          />
        </div>

        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-white truncate">{{ item.name }}</p>
            <p class="text-[11px] text-slate-500 mt-0.5 leading-snug">{{ item.description }}</p>
          </div>
          <span
            class="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md border"
            :class="
              item.mode === 'dark'
                ? 'border-border bg-panel text-slate-400'
                : 'border-border bg-card-hover text-slate-500'
            "
          >
            {{ item.mode === 'dark' ? 'Тёмн.' : 'Светл.' }}
          </span>
        </div>
      </button>
    </div>
  </section>
</template>
