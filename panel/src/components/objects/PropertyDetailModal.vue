<script setup lang="ts">
import { computed } from 'vue'
import { Building2, ChevronRight, DoorOpen, MapPin } from '@lucide/vue'
import Modal from '@/components/ui/Modal.vue'
import FileAttachments from '@/components/ui/FileAttachments.vue'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { PROPERTY_TYPE_LABELS } from '@/types/portfolio'

const store = usePortfolioStore()

const property = computed(() =>
  store.propertyDetailId ? store.getPropertyById(store.propertyDetailId) : null,
)

const spaces = computed(() =>
  property.value ? store.getSpacesWithTenants(property.value.id) : [],
)

const totalArea = computed(() =>
  property.value ? store.getTotalAreaForProperty(property.value.id) : 0,
)

function onClose() {
  store.closePropertyDetail()
}

function openSpace(spaceId: number) {
  store.openSpaceDetail(spaceId)
}

function occupancyClass(occupied: boolean) {
  return occupied
    ? 'text-emerald-brand bg-emerald-brand/10'
    : 'text-slate-400 bg-panel'
}
</script>

<template>
  <Modal
    :open="store.propertyDetailOpen && !!property"
    :title="property?.address ?? 'Объект'"
    size="xl"
    @close="onClose"
  >
    <template v-if="property">
      <div class="flex flex-wrap items-center gap-3 mb-5">
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-panel text-xs text-slate-300">
          <Building2 class="w-3.5 h-3.5 text-emerald-brand" />
          {{ PROPERTY_TYPE_LABELS[property.type] }}
        </span>
        <span class="text-xs text-slate-500 font-mono">
          {{ property.spacesOccupied }} / {{ property.spacesTotal }} занято · {{ property.occupancy }}%
        </span>
        <span class="text-xs text-slate-500 font-mono">{{ store.formatArea(totalArea) }}</span>
        <span class="text-xs text-emerald-brand font-mono">{{ store.formatMoney(property.income) }}/мес</span>
      </div>

      <div class="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500 mb-3">
        <DoorOpen class="w-3.5 h-3.5" />
        Помещения
        <span class="text-slate-600 font-normal normal-case">({{ spaces.length }})</span>
      </div>

      <div class="space-y-2">
        <button
          v-for="space in spaces"
          :key="space.id"
          type="button"
          class="w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border border-border bg-panel/40 text-left hover:border-emerald-brand/40 hover:bg-card-hover transition-colors group"
          @click="openSpace(space.id)"
        >
          <div class="min-w-0">
            <div class="flex items-center gap-2 mb-0.5">
              <span class="font-mono font-semibold text-white group-hover:text-emerald-brand transition-colors">
                №{{ space.name }}
              </span>
              <span
                class="text-xs px-2 py-0.5 rounded shrink-0"
                :class="occupancyClass(space.occupied)"
              >
                {{ space.occupied ? 'Занято' : 'Свободно' }}
              </span>
            </div>
            <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
              <span>{{ store.formatArea(space.area) }}</span>
              <span class="font-mono text-emerald-brand">{{ store.formatMoney(space.monthlyRate) }}/мес</span>
              <span v-if="space.tenant" class="truncate">{{ space.tenant.company }}</span>
            </div>
          </div>
          <ChevronRight class="w-4 h-4 text-slate-600 group-hover:text-emerald-brand shrink-0" />
        </button>
      </div>

      <p v-if="spaces.length === 0" class="text-sm text-slate-500 text-center py-8 rounded-xl border border-dashed border-border">
        В этом объекте пока нет помещений
      </p>

      <div class="mt-5 pt-4 border-t border-border flex items-start gap-2 text-xs text-slate-500 mb-5">
        <MapPin class="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>Выберите помещение, чтобы открыть карточку с информацией и сделкой</span>
      </div>

      <FileAttachments
        entity-type="property"
        :entity-id="property.id"
        label="Документы объекта"
        compact
      />
    </template>

    <template #footer>
      <button type="button" class="panel-btn-secondary" @click="onClose">
        Закрыть
      </button>
    </template>
  </Modal>
</template>
