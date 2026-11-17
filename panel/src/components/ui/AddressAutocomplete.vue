<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

interface AddressSuggestion {
  id: string
  label: string
}

const props = defineProps<{ modelValue: string; placeholder?: string; error?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const query = ref(props.modelValue)
const suggestions = ref<AddressSuggestion[]>([])
const isOpen = ref(false)
const isLoading = ref(false)
const activeIndex = ref(-1)
let debounceTimer: ReturnType<typeof setTimeout> | undefined
let controller: AbortController | undefined

watch(() => props.modelValue, (value) => {
  if (value !== query.value) query.value = value
})

watch(query, (value) => {
  emit('update:modelValue', value)
  suggestions.value = []
  activeIndex.value = -1
  if (debounceTimer) clearTimeout(debounceTimer)
  controller?.abort()

  const search = value.trim()
  if (search.length < 3) {
    isLoading.value = false
    isOpen.value = false
    return
  }

  isOpen.value = true
  isLoading.value = true
  debounceTimer = setTimeout(() => void loadSuggestions(search), 400)
})

const activeDescendant = computed(() =>
  activeIndex.value >= 0 ? `address-option-${activeIndex.value}` : undefined,
)

function formatAddress(properties: Record<string, unknown>) {
  const street = typeof properties.street === 'string' ? properties.street : ''
  const house = typeof properties.housenumber === 'string' ? properties.housenumber : ''
  const name = typeof properties.name === 'string' ? properties.name : ''
  const locality = [properties.city, properties.town, properties.village, properties.locality]
    .find((value) => typeof value === 'string' && value) as string | undefined
  const parts = [street ? `${street}${house ? `, ${house}` : ''}` : name, locality, properties.state]
    .filter((part): part is string => typeof part === 'string' && Boolean(part.trim()))
  return [...new Set(parts)].join(', ') || name
}

async function loadSuggestions(search: string) {
  const requestController = new AbortController()
  controller = requestController
  try {
    const params = new URLSearchParams({ q: search, limit: '20' })
    const response = await fetch(`https://photon.komoot.io/api/?${params}`, {
      signal: requestController.signal,
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`Address lookup failed: ${response.status}`)
    const data = await response.json() as { features?: { properties?: Record<string, unknown> }[] }
    if (requestController.signal.aborted) return
    suggestions.value = (data.features ?? [])
      .filter((feature) => feature.properties?.countrycode === 'RU')
      .slice(0, 6)
      .map((feature, index) => {
        const label = formatAddress(feature.properties ?? {})
        return { id: `${label}-${index}`, label }
      })
      .filter((item) => item.label)
    isOpen.value = true
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'AbortError')) suggestions.value = []
  } finally {
    if (!requestController.signal.aborted) isLoading.value = false
  }
}

function selectSuggestion(suggestion: AddressSuggestion) {
  query.value = suggestion.label
  suggestions.value = []
  isOpen.value = false
  activeIndex.value = -1
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' && suggestions.value.length) {
    event.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % suggestions.value.length
  } else if (event.key === 'ArrowUp' && suggestions.value.length) {
    event.preventDefault()
    activeIndex.value = activeIndex.value <= 0 ? suggestions.value.length - 1 : activeIndex.value - 1
  } else if (event.key === 'Enter' && activeIndex.value >= 0) {
    event.preventDefault()
    selectSuggestion(suggestions.value[activeIndex.value])
  } else if (event.key === 'Escape') {
    isOpen.value = false
  }
}

function closeSuggestions() {
  window.setTimeout(() => { isOpen.value = false }, 120)
}

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
  controller?.abort()
})
</script>

<template>
  <div class="relative">
    <input
      v-model="query"
      type="text"
      role="combobox"
      aria-autocomplete="list"
      :aria-expanded="isOpen && suggestions.length > 0"
      aria-controls="address-suggestions"
      :aria-activedescendant="activeDescendant"
      :placeholder="placeholder || 'Начните вводить адрес'"
      class="panel-input w-full"
      :class="{ 'border-red-500': error }"
      autocomplete="street-address"
      @focus="isOpen = suggestions.length > 0"
      @blur="closeSuggestions"
      @keydown="onKeydown"
    />

    <div
      v-if="isOpen && (suggestions.length || isLoading)"
      class="panel-popover absolute z-50 mt-2 w-full overflow-hidden"
    >
      <div class="flex items-center gap-2 border-b border-border-subtle px-3.5 py-2.5">
        <span class="flex size-7 items-center justify-center rounded-lg bg-emerald-brand/10 text-emerald-brand">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
        </span>
        <span class="text-xs font-medium text-slate-400">Адреса</span>
        <span v-if="isLoading" class="ml-auto size-3.5 animate-spin rounded-full border-2 border-emerald-brand/25 border-t-emerald-brand" aria-label="Загрузка" />
      </div>

      <ul id="address-suggestions" role="listbox" class="max-h-64 overflow-auto p-1.5">
        <li v-if="isLoading && !suggestions.length" class="px-3 py-3 text-sm text-slate-400">
          Ищем подходящие адреса…
        </li>
        <li v-for="(suggestion, index) in suggestions" :key="suggestion.id" role="presentation">
          <button
            :id="`address-option-${index}`"
            type="button"
            role="option"
            :aria-selected="activeIndex === index"
            class="group flex w-full items-start gap-3 rounded-lg px-2.5 py-2.5 text-left text-sm text-slate-300 transition-colors hover:bg-card-hover hover:text-white"
            :class="{ 'bg-emerald-brand/10 text-emerald-brand': activeIndex === index }"
            @mousedown.prevent="selectSuggestion(suggestion)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" class="mt-0.5 size-4 shrink-0 text-slate-500 transition-colors group-hover:text-emerald-brand" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
            <span class="min-w-0 leading-5">{{ suggestion.label }}</span>
          </button>
        </li>
      </ul>

      <div class="border-t border-border-subtle px-3.5 py-2 text-[10px] text-slate-500">
        Подсказки адресов · © OpenStreetMap
      </div>
    </div>
  </div>
</template>
