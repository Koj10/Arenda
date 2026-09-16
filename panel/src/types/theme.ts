export type ThemeId = 'gold' | 'blue' | 'red'

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
  gold: {
    id: 'gold',
    name: 'Золотая',
    description: 'Тёмная с золотым акцентом',
    preview: { bg: '#0d0e0f', accent: '#c9a227', card: '#1a1712', text: '#ffffff' },
  },
  blue: {
    id: 'blue',
    name: 'Голубая',
    description: 'Светлая с синим акцентом',
    preview: { bg: '#eef1f5', accent: '#1a56db', card: '#ffffff', text: '#1f2937' },
  },
  red: {
    id: 'red',
    name: 'Красная',
    description: 'Тёмная с бордовым акцентом',
    preview: { bg: '#0d0d0d', accent: '#b91c1c', card: '#1a1110', text: '#ffffff' },
  },
}

export const THEME_ORDER: ThemeId[] = ['gold', 'blue', 'red']

export const THEME_STORAGE_KEY = 'propcount.panel.theme'
