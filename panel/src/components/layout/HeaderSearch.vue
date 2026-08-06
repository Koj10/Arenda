<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  Search,
  Building2,
  Users,
  DoorOpen,
  Wallet,
  FileText,
  LayoutGrid,
  X,
} from '@lucide/vue'
import { usePanelSearchStore, type PanelSearchHit } from '@/stores/panelSearchStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { useAccountingStore } from '@/stores/accountingStore'

withDefaults(
  defineProps<{
    mobile?: boolean
  }>(),
  { mobile: false },
)

const router = useRouter()
const search = usePanelSearchStore()
const portfolio = usePortfolioStore()
const accounting = useAccountingStore()

const focused = ref(false)
const root = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)
const activeIndex = ref(0)
const picking = ref(false)

const showDropdown = computed(
  () => search.open && search.query.trim().length > 0 && (focused.value || picking.value),
)

watch(
  () => search.results,
  () => {
    activeIndex.value = 0
  },
)

const kindIcon = {
  property: Building2,
  tenant: Users,
  space: DoorOpen,
  expense: Wallet,
  invoice: FileText,
  page: LayoutGrid,
} as const

const kindLabel = {
  property: 'Объект',
  tenant: 'Арендатор',
  space: 'Помещение',
  expense: 'Расход',
  invoice: 'Счёт',
  page: 'Раздел',
} as const

function onInput(e: Event) {
  search.setQuery((e.target as HTMLInputElement).value)
}

function onFocus() {
  focused.value = true
  if (search.query.trim()) search.open = true
}

function onBlur() {
  window.setTimeout(() => {
    if (!picking.value) focused.value = false
  }, 180)
}

async function selectHit(hit: PanelSearchHit) {
  picking.value = true
  const target = hit.to
  const propertyId = hit.propertyId
  const tenantId = hit.tenantId
  const expenseId = hit.expenseId

  search.clear()
  focused.value = false

  try {
    if (target) {
      await router.push(target)
      await nextTick()
      // дождаться монтирования модалок на целевой странице
      await new Promise((r) => setTimeout(r, 50))
    }

    if (propertyId != null) portfolio.openPropertyDetail(propertyId)
    else if (tenantId != null) portfolio.openTenantDetail(tenantId)
    else if (expenseId != null) accounting.openExpenseDetail(expenseId)
  } finally {
    picking.value = false
  }
}

function onKeydown(e: KeyboardEvent) {
  if (!showDropdown.value || !search.results.length) {
    if (e.key === 'Escape') search.clear()
    return
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % search.results.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value = (activeIndex.value - 1 + search.results.length) % search.results.length
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const hit = search.results[activeIndex.value]
    if (hit) void selectHit(hit)
  } else if (e.key === 'Escape') {
    search.clear()
    inputEl.value?.blur()
  }
}

function clearBtn() {
  search.clear()
  inputEl.value?.focus()
}

function onDocPointer(e: PointerEvent) {
  if (!showDropdown.value || !root.value) return
  const t = e.target as Node | null
  if (t && root.value.contains(t)) return
  // клик в другом экземпляре поиска (mobile/desktop) — не трогаем
  if (t instanceof Element && t.closest('[data-panel-search]')) return
  search.close()
  focused.value = false
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointer, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointer, true)
})
</script>

<template>
  <div
    ref="root"
    data-panel-search
    class="relative w-full"
    :class="mobile ? '' : 'max-w-[640px] xl:max-w-[720px] 2xl:max-w-[840px]'"
  >
    <label
      class="relative flex w-full items-center rounded-full border bg-panel transition-colors"
      :class="focused || showDropdown ? 'border-emerald-brand/50 ring-1 ring-emerald-brand/20' : 'border-border hover:border-slate-600'"
    >
      <Search class="absolute left-3.5 sm:left-4 w-4 h-4 text-slate-500 pointer-events-none" />
      <input
        ref="inputEl"
        :value="search.query"
        type="search"
        placeholder="Поиск: объекты, арендаторы, счета..."
        autocomplete="off"
        class="w-full bg-transparent border-0 pl-10 sm:pl-11 pr-10 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none rounded-full"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
        @keydown="onKeydown"
      />
      <button
        v-if="search.query"
        type="button"
        class="absolute right-3 p-1 rounded-full text-slate-500 hover:text-white"
        aria-label="Очистить"
        @pointerdown.prevent="clearBtn"
      >
        <X class="w-3.5 h-3.5" />
      </button>
    </label>

    <div
      v-if="showDropdown"
      class="absolute left-0 right-0 top-full mt-2 z-[60] rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
    >
      <ul v-if="search.results.length" class="max-h-[min(24rem,60vh)] overflow-y-auto py-1">
        <li v-for="(hit, i) in search.results" :key="hit.id">
          <button
            type="button"
            class="w-full flex items-start gap-3 px-3.5 py-2.5 text-left transition-colors"
            :class="i === activeIndex ? 'bg-emerald-brand/10' : 'hover:bg-card-hover'"
            @mouseenter="activeIndex = i"
            @pointerdown.prevent="selectHit(hit)"
          >
            <span
              class="mt-0.5 w-8 h-8 rounded-lg bg-panel border border-border flex items-center justify-center text-emerald-brand shrink-0"
            >
              <component :is="kindIcon[hit.kind]" class="w-4 h-4" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm text-white truncate">{{ hit.title }}</span>
              <span class="block text-xs text-slate-500 truncate mt-0.5">
                {{ kindLabel[hit.kind] }} · {{ hit.subtitle }}
              </span>
            </span>
          </button>
        </li>
      </ul>
      <p v-else class="px-4 py-6 text-center text-sm text-slate-500">
        Ничего не найдено по «{{ search.query }}»
      </p>
      <p class="px-3.5 py-2 border-t border-border text-[10px] text-slate-600">
        ↑↓ выбор · Enter открыть · Esc закрыть
      </p>
    </div>
  </div>
</template>
