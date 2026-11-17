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
    <ul
      v-if="isOpen && (suggestions.length || isLoading)"
      id="address-suggestions"
      role="listbox"
      class="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border bg-slate-900 py-1 shadow-xl"
    >
      <li v-if="isLoading && !suggestions.length" class="px-3 py-2 text-sm text-slate-400">Ищем адреса…</li>
      <li v-for="(suggestion, index) in suggestions" :key="suggestion.id" role="presentation">
        <button
          :id="`address-option-${index}`"
          type="button"
          role="option"
          :aria-selected="activeIndex === index"
          class="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
          :class="{ 'bg-slate-800': activeIndex === index }"
          @mousedown.prevent="selectSuggestion(suggestion)"
        >{{ suggestion.label }}</button>
      </li>
    </ul>
  </div>
</template>
