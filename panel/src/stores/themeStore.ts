import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { type ThemeId, THEMES, THEME_ORDER, THEME_STORAGE_KEY } from '@/types/theme'

function readStoredTheme(): ThemeId | null {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    if (raw && raw in THEMES) return raw as ThemeId
  } catch {}
  return null
}

function applyThemeToDocument(id: ThemeId) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.setAttribute('data-theme', id)
  root.style.colorScheme = id === 'corporate' ? 'light' : 'dark'
}

export const useThemeStore = defineStore('theme', () => {
  const stored = readStoredTheme()
  const themeId = ref<ThemeId>(stored ?? 'default')

  const currentTheme = computed(() => THEMES[themeId.value])
  const allThemes = computed(() => THEME_ORDER.map((id) => THEMES[id]))

  function setTheme(id: ThemeId) {
    themeId.value = id
  }

  watch(
    themeId,
    (val) => {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, val)
      } catch {}
      applyThemeToDocument(val)
    },
    { immediate: true },
  )

  return {
    themeId,
    currentTheme,
    allThemes,
    setTheme,
  }
})
