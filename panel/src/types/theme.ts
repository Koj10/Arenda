export type ThemeId = 'default' | 'red-light' | 'red-dark' | 'gold-dark' | 'blue-light'

export interface ThemePalette {
  id: ThemeId
  name: string
  description: string
  mode: 'light' | 'dark'
  preview: {
    bg: string
    accent: string
    card: string
    text: string
  }
}

export const THEMES: Record<ThemeId, ThemePalette> = {
  default: {
    id: 'default',
    name: 'Базовая',
    description: 'Тёмная с бирюзовым акцентом',
    mode: 'dark',
    preview: { bg: '#101214', accent: '#2dd4bf', card: '#1a1d21', text: '#ffffff' },
  },
  'red-light': {
    id: 'red-light',
    name: 'Красная светлая',
    description: 'Светлая тема с бордовым акцентом',
    mode: 'light',
    preview: { bg: '#F5F5F7', accent: '#7F1D1D', card: '#FFFFFF', text: '#111827' },
  },
  'red-dark': {
    id: 'red-dark',
    name: 'Красная тёмная',
    description: 'Тёмная тема с ярко-красным акцентом',
    mode: 'dark',
    preview: { bg: '#0F0F0F', accent: '#DC2626', card: '#1C1C1C', text: '#FFFFFF' },
  },
  'gold-dark': {
    id: 'gold-dark',
    name: 'Золотая тёмная',
    description: 'Тёмная тема с золотым акцентом',
    mode: 'dark',
    preview: { bg: '#0D0D0D', accent: '#FACC15', card: '#1A1A1A', text: '#FFFFFF' },
  },
  'blue-light': {
    id: 'blue-light',
    name: 'Синяя светлая',
    description: 'Светлая тема с тёмно-синим акцентом',
    mode: 'light',
    preview: { bg: '#F5F7FA', accent: '#1E40AF', card: '#FFFFFF', text: '#0F172A' },
  },
}

export const THEME_ORDER: ThemeId[] = ['default', 'red-light', 'red-dark', 'gold-dark', 'blue-light']

export const THEME_STORAGE_KEY = 'propcount.panel.theme'
