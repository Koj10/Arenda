export type ThemeId = 'default' | 'red' | 'corporate' | 'yellow'

export interface ThemePalette {
  id: ThemeId
  name: string
  description: string
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
    preview: { bg: '#101214', accent: '#2dd4bf', card: '#1a1d21', text: '#ffffff' },
  },
  red: {
    id: 'red',
    name: 'Красная',
    description: 'С тёмным фоном и красным акцентом',
    preview: { bg: '#000000', accent: '#EF3124', card: '#505759', text: '#D9D9D9' },
  },
  corporate: {
    id: 'corporate',
    name: 'Корпоративная',
    description: 'Светлая с тёмно-синим акцентом',
    preview: { bg: '#FFFFFF', accent: '#003366', card: '#F5F7FA', text: '#0F172A' },
  },
  yellow: {
    id: 'yellow',
    name: 'Жёлтая',
    description: 'С жёлтым акцентом и глубоким чёрным',
    preview: { bg: '#1A1A1A', accent: '#FFDD2D', card: '#2A2A2A', text: '#FFFFFF' },
  },
}

export const THEME_ORDER: ThemeId[] = ['default', 'corporate', 'red', 'yellow']

export const THEME_STORAGE_KEY = 'propcount.panel.theme'
