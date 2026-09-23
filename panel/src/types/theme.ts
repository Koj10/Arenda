export type ThemeId =
  | 'default'
  | 'default-light'
  | 'red-light'
  | 'red-dark'
  | 'gold-light'
  | 'gold-dark'
  | 'blue-light'
  | 'blue-dark'
  | 'purple-light'
  | 'purple-dark'

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
    name: 'Базовая тёмная',
    description: 'Тёмная с бирюзовым акцентом',
    mode: 'dark',
    preview: { bg: '#0e1312', accent: '#2dd4bf', card: '#171d1c', text: '#dce8e5' },
  },
  'default-light': {
    id: 'default-light',
    name: 'Базовая светлая',
    description: 'Светлая с бирюзовым акцентом',
    mode: 'light',
    preview: { bg: '#e8f0ee', accent: '#0f766e', card: '#ffffff', text: '#10221f' },
  },
  'red-light': {
    id: 'red-light',
    name: 'Красная светлая',
    description: 'Светлая тема с бордовым акцентом',
    mode: 'light',
    preview: { bg: '#f4eeee', accent: '#b42318', card: '#ffffff', text: '#1f1212' },
  },
  'red-dark': {
    id: 'red-dark',
    name: 'Красная тёмная',
    description: 'Тёмная тема в духе Альфа-Банка',
    mode: 'dark',
    preview: { bg: '#111111', accent: '#ef3124', card: '#1a1a1a', text: '#f2f2f2' },
  },
  'gold-light': {
    id: 'gold-light',
    name: 'Золотая светлая',
    description: 'Светлая тема с золотисто-коричневым акцентом',
    mode: 'light',
    preview: { bg: '#f3efe4', accent: '#92650a', card: '#fffcf6', text: '#1c1508' },
  },
  'gold-dark': {
    id: 'gold-dark',
    name: 'Золотая тёмная',
    description: 'Тёмная тема в духе Т-Банка',
    mode: 'dark',
    preview: { bg: '#111111', accent: '#ffdd2d', card: '#1c1c1c', text: '#f6f7f8' },
  },
  'blue-light': {
    id: 'blue-light',
    name: 'Синяя светлая',
    description: 'Светлая тема с тёмно-синим акцентом',
    mode: 'light',
    preview: { bg: '#eef2f7', accent: '#1d4ed8', card: '#ffffff', text: '#0f172a' },
  },
  'blue-dark': {
    id: 'blue-dark',
    name: 'Синяя тёмная',
    description: 'Тёмная тема с синим акцентом',
    mode: 'dark',
    preview: { bg: '#0c111a', accent: '#6ba3f5', card: '#151c2b', text: '#dbe6f5' },
  },
  'purple-light': {
    id: 'purple-light',
    name: 'Фиолетовая светлая',
    description: 'Светлая тема с фиолетовым акцентом',
    mode: 'light',
    preview: { bg: '#f3eef8', accent: '#7c3aed', card: '#ffffff', text: '#1c1228' },
  },
  'purple-dark': {
    id: 'purple-dark',
    name: 'Фиолетовая тёмная',
    description: 'Тёмная тема с фиолетовым акцентом',
    mode: 'dark',
    preview: { bg: '#160824', accent: '#5b21b6', card: '#24103c', text: '#eee6f8' },
  },
}

export const THEME_ORDER: ThemeId[] = [
  'default-light',
  'default',
  'red-light',
  'red-dark',
  'gold-light',
  'gold-dark',
  'blue-light',
  'blue-dark',
  'purple-light',
  'purple-dark',
]

export const THEME_STORAGE_KEY = 'propcount.panel.theme'
