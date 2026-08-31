<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/components/layout/AppLayout.vue'
import CadastralParcelModal from '@/components/objects/CadastralParcelModal.vue'
import SplitCadastralModal from '@/components/objects/SplitCadastralModal.vue'
import { Building2, GripVertical, Pencil, Plus, Scissors, Search, Trash2 } from '@lucide/vue'
import { usePortfolioStore } from '@/stores/portfolioStore'
import type { Space } from '@/types/portfolio'
import { PROPERTY_TYPE_LABELS } from '@/types/portfolio'

const route = useRoute()
const router = useRouter()
const store = usePortfolioStore()

const search = ref('')
const selectedPropertyId = ref<number | null>(null)
const draggingSpaceId = ref<number | null>(null)
const dropTarget = ref<'unassigned' | number | null>(null)
const assignError = ref<string | null>(null)
const deletingParcelId = ref<number | null>(null)

const filteredProperties = computed(() => {
  if (!search.value) return store.properties
  const q = search.value.toLowerCase()
  return store.properties.filter((p) => p.address.toLowerCase().includes(q))
})

const selectedProperty = computed(() =>
  selectedPropertyId.value ? store.getPropertyById(selectedPropertyId.value) : null,
)

const parcels = computed(() =>
  selectedProperty.value ? store.getCadastralParcelsForProperty(selectedProperty.value.id) : [],
)

const unassignedSpaces = computed(() =>
  selectedProperty.value ? store.getUnassignedSpacesForProperty(selectedProperty.value.id) : [],
)

const totalCadastralValue = computed(() =>
  selectedProperty.value ? store.getTotalCadastralValueForProperty(selectedProperty.value.id) : 0,
)

watch(
  () => route.query.property,
  (id) => {
    const num = Number(id)
    if (id && !Number.isNaN(num) && store.getPropertyById(num)) {
      selectedPropertyId.value = num
    }
  },
  { immediate: true },
)

watch(selectedPropertyId, (id) => {
  const query = id ? { property: String(id) } : {}
  if (String(route.query.property ?? '') !== String(id ?? '')) {
    void router.replace({ query })
  }
})

function selectProperty(id: number) {
  selectedPropertyId.value = id
  assignError.value = null
}

function onAddParcel() {
  if (!selectedProperty.value) return
  store.openCadastralModal(selectedProperty.value.id)
}

function onEditParcel(parcelId: number) {
  if (!selectedProperty.value) return
  store.openCadastralModal(selectedProperty.value.id, parcelId)
}

function onSplitParcel(parcelId: number) {
  store.openSplitCadastralModal(parcelId)
}

async function onDeleteParcel(parcelId: number) {
  const parcel = store.getCadastralParcelById(parcelId)
  if (!parcel || deletingParcelId.value) return
  const spacesCount = store.getSpacesForParcel(parcelId).length
  const spacesNote = spacesCount
    ? `\n\nПомещения (${spacesCount}) останутся на объекте, но будут без кадастра.`
    : ''
  if (!confirm(`Удалить кадастровый номер ${parcel.cadastralNumber}?${spacesNote}`)) return
  deletingParcelId.value = parcelId
  assignError.value = null
  const ok = await store.removeCadastralParcel(parcelId)
  deletingParcelId.value = null
  if (!ok) assignError.value = store.lastError || 'Не удалось удалить кадастр'
}

function onDragStart(spaceId: number, e: DragEvent) {
  draggingSpaceId.value = spaceId
  e.dataTransfer?.setData('text/plain', String(spaceId))
  e.dataTransfer!.effectAllowed = 'move'
}

function onDragEnd() {
  draggingSpaceId.value = null
  dropTarget.value = null
}

function onDragOverZone(target: 'unassigned' | number, e: DragEvent) {
  e.preventDefault()
  dropTarget.value = target
}

function onDragLeaveZone() {
  dropTarget.value = null
}

async function onDropZone(target: 'unassigned' | number, e: DragEvent) {
  e.preventDefault()
  const raw = e.dataTransfer?.getData('text/plain')
  const spaceId = draggingSpaceId.value ?? (raw ? Number(raw) : null)
  if (!spaceId) return

  assignError.value = null
  const parcelId = target === 'unassigned' ? null : target
  const ok = await store.assignSpaceToCadastral(spaceId, parcelId)
  if (!ok) {
    assignError.value = store.lastError || 'Не удалось привязать помещение'
  }

  draggingSpaceId.value = null
  dropTarget.value = null
}

async function onSelectParcel(space: Space, parcelId: string) {
  assignError.value = null
  const id = parcelId === '' ? null : Number(parcelId)
  const ok = await store.assignSpaceToCadastral(space.id, id)
  if (!ok) {
    assignError.value = store.lastError || 'Не удалось привязать помещение'
  }
}

function zoneClass(target: 'unassigned' | number) {
  return dropTarget.value === target
    ? 'border-emerald-brand bg-emerald-brand/10'
    : 'border-border bg-panel/20'
}

function chipClass(spaceId: number) {
  return draggingSpaceId.value === spaceId ? 'opacity-40 scale-95' : ''
}
</script>

<template>
  <AppLayout>
    <div class="panel-page-wide space-y-5">
      <div class="panel-card p-5 border-emerald-brand/20 bg-emerald-brand/5">
        <h2 class="text-sm font-semibold text-white mb-3">Как привязать помещения к кадастру</h2>
        <ol class="space-y-2 text-sm text-slate-400 list-decimal list-inside">
          <li>Добавьте <span class="text-slate-300">объект</span> и <span class="text-slate-300">помещения</span> в разделе «Объекты».</li>
          <li>Здесь создайте <span class="text-slate-300">кадастровые номера</span> (стоимость, цена покупки).</li>
          <li>
            Перетащите плашки помещений в нужный кадастровый номер
            <span class="text-slate-500">— площадь кадастра пересчитается автоматически</span>.
          </li>
        </ol>
      </div>

      <p v-if="assignError" class="text-sm text-rose-400 px-1">{{ assignError }}</p>

      <div class="grid lg:grid-cols-[minmax(240px,300px)_1fr] gap-5">
        <div class="panel-card overflow-hidden">
          <div class="p-3 border-b border-border">
            <div class="relative">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input v-model="search" type="search" placeholder="Поиск адреса..." class="panel-search pl-9" />
            </div>
          </div>
          <ul class="max-h-[480px] overflow-y-auto divide-y divide-border">
            <li v-if="store.loadingRemote" class="px-4 py-8 text-center text-sm text-slate-500">
              Загрузка объектов...
            </li>
            <li v-else-if="filteredProperties.length === 0" class="px-4 py-8 text-center text-sm text-slate-500">
              Нет объектов
            </li>
            <template v-else>
            <li v-for="p in filteredProperties" :key="p.id">
              <button
                type="button"
                class="w-full px-4 py-3 text-left hover:bg-card-hover transition-colors"
                :class="selectedPropertyId === p.id ? 'bg-emerald-brand/10 border-l-2 border-emerald-brand' : ''"
                @click="selectProperty(p.id)"
              >
                <p class="text-sm text-white truncate">{{ p.address }}</p>
                <p class="text-xs text-slate-500 mt-0.5 font-mono">
                  {{ store.getUnassignedSpacesForProperty(p.id).length }} без кадастра
                  · {{ store.getCadastralParcelsForProperty(p.id).length }} ном.
                </p>
              </button>
            </li>
            </template>
          </ul>
        </div>

        <div class="space-y-4" v-if="selectedProperty">
          <div class="panel-card p-5">
            <div class="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <h2 class="text-lg font-semibold text-white">{{ selectedProperty.address }}</h2>
                <p class="text-xs text-slate-500 mt-1">
                  {{ PROPERTY_TYPE_LABELS[selectedProperty.type] }}
                  · {{ store.formatArea(selectedProperty.totalArea) }}
                  · {{ store.formatMoney(totalCadastralValue) }}
                </p>
              </div>
              <button
                type="button"
                class="panel-btn-secondary text-xs"
                @click="onAddParcel"
              >
                <Plus class="w-4 h-4" />
                Добавить номер
              </button>
            </div>

            <!-- Нераспределённые помещения -->
            <section class="mb-5">
              <p class="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">
                Помещения без кадастра ({{ unassignedSpaces.length }})
              </p>
              <div
                class="min-h-[72px] rounded-xl border border-dashed p-3 transition-colors"
                :class="zoneClass('unassigned')"
                @dragover="onDragOverZone('unassigned', $event)"
                @dragleave="onDragLeaveZone"
                @drop="onDropZone('unassigned', $event)"
              >
                <div v-if="unassignedSpaces.length" class="flex flex-wrap gap-2">
                  <div
                    v-for="space in unassignedSpaces"
                    :key="space.id"
                    class="inline-flex items-center gap-1.5 pl-2 pr-1 py-1.5 rounded-lg border border-border bg-card text-sm transition-all cursor-grab active:cursor-grabbing"
                    :class="chipClass(space.id)"
                    draggable="true"
                    @dragstart="onDragStart(space.id, $event)"
                    @dragend="onDragEnd"
                  >
                    <GripVertical class="w-3.5 h-3.5 text-slate-600 shrink-0" />
                    <span class="font-mono text-white">№{{ space.name }}</span>
                    <span class="text-xs text-slate-500">{{ space.area }} м²</span>
                    <select
                      class="ml-1 text-[10px] bg-panel border border-border rounded px-1.5 py-0.5 text-slate-400 max-w-[120px]"
                      @change="onSelectParcel(space, ($event.target as HTMLSelectElement).value)"
                      @click.stop
                    >
                      <option value="" selected>→ в кадастр</option>
                      <option v-for="p in parcels" :key="p.id" :value="p.id">
                        {{ p.cadastralNumber }}
                      </option>
                    </select>
                  </div>
                </div>
                <p v-else class="text-xs text-slate-500 text-center py-3">
                  Все помещения распределены · перетащите сюда, чтобы отвязать
                </p>
              </div>
            </section>

            <!-- Кадастровые номера -->
            <div class="space-y-3">
              <div
                v-for="parcel in parcels"
                :key="parcel.id"
                class="rounded-xl border border-border bg-panel/40 overflow-hidden"
              >
                <div class="p-4 border-b border-border/60">
                  <div class="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p class="font-mono text-sm text-white">{{ parcel.cadastralNumber }}</p>
                      <p class="text-xs text-slate-500 mt-0.5">
                        {{ store.formatArea(parcel.area) }}
                        · {{ store.getSpacesForParcel(parcel.id).length }} пом.
                        · {{ store.formatMoney(parcel.cadastralValue) }}
                      </p>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        class="inline-flex items-center gap-1 text-xs text-emerald-brand hover:underline"
                        @click="onSplitParcel(parcel.id)"
                      >
                        <Scissors class="w-3.5 h-3.5" />
                        Разделить
                      </button>
                      <button
                        type="button"
                        class="p-1.5 rounded-lg text-slate-500 hover:text-emerald-brand hover:bg-card-hover"
                        @click="onEditParcel(parcel.id)"
                      >
                        <Pencil class="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        class="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-40"
                        :disabled="deletingParcelId === parcel.id"
                        title="Удалить кадастровый номер"
                        @click="onDeleteParcel(parcel.id)"
                      >
                        <Trash2 class="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div
                  class="min-h-[64px] p-3 transition-colors"
                  :class="zoneClass(parcel.id)"
                  @dragover="onDragOverZone(parcel.id, $event)"
                  @dragleave="onDragLeaveZone"
                  @drop="onDropZone(parcel.id, $event)"
                >
                  <div v-if="store.getSpacesForParcel(parcel.id).length" class="flex flex-wrap gap-2">
                    <div
                      v-for="space in store.getSpacesForParcel(parcel.id)"
                      :key="space.id"
                      class="inline-flex items-center gap-1.5 pl-2 pr-1 py-1.5 rounded-lg border border-emerald-brand/30 bg-emerald-brand/5 text-sm transition-all cursor-grab active:cursor-grabbing"
                      :class="chipClass(space.id)"
                      draggable="true"
                      @dragstart="onDragStart(space.id, $event)"
                      @dragend="onDragEnd"
                    >
                      <GripVertical class="w-3.5 h-3.5 text-emerald-brand/60 shrink-0" />
                      <span class="font-mono text-white">№{{ space.name }}</span>
                      <span class="text-xs text-slate-500">{{ space.area }} м²</span>
                      <select
                        class="ml-1 text-[10px] bg-panel border border-border rounded px-1.5 py-0.5 text-slate-400 max-w-[130px]"
                        :value="parcel.id"
                        @change="onSelectParcel(space, ($event.target as HTMLSelectElement).value)"
                        @click.stop
                      >
                        <option value="">Без кадастра</option>
                        <option v-for="p in parcels" :key="p.id" :value="p.id">
                          {{ p.cadastralNumber }}
                        </option>
                      </select>
                    </div>
                  </div>
                  <p v-else class="text-xs text-slate-500 text-center py-2">
                    Перетащите помещения сюда
                  </p>
                </div>
              </div>
            </div>

            <p v-if="parcels.length === 0" class="text-sm text-slate-500 text-center py-6">
              Создайте кадастровый номер, затем распределите помещения
            </p>
          </div>
        </div>

        <div v-else class="panel-card flex flex-col items-center justify-center py-20 text-slate-500">
          <Building2 class="w-10 h-10 mb-3 opacity-40" />
          <p class="text-sm">Выберите объект слева</p>
        </div>
      </div>
    </div>

    <CadastralParcelModal />
    <SplitCadastralModal />
  </AppLayout>
</template>
