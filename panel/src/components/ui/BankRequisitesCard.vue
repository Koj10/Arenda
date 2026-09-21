<script setup lang="ts">
import { computed, ref } from 'vue'
import { BANK_REQUISITES_FIELD_LABELS, type BankRequisites } from '@/types/bankRequisites'

const props = defineProps<{
  data: BankRequisites | null
  emptyText?: string
}>()

const copied = ref(false)

const rows = computed(() =>
  BANK_REQUISITES_FIELD_LABELS
    .map((field) => ({ ...field, value: props.data?.[field.key]?.trim() ?? '' }))
    .filter((row) => row.value),
)

const textBlock = computed(() =>
  rows.value.map((row) => `${row.label}: ${row.value}`).join('\n'),
)

async function copyAll() {
  if (!textBlock.value) return
  try {
    await navigator.clipboard.writeText(textBlock.value)
    copied.value = true
    window.setTimeout(() => {
      copied.value = false
    }, 1600)
  } catch {}
}
</script>

<template>
  <div>
    <p v-if="!rows.length" class="text-sm text-slate-500">
      {{ emptyText || 'Арендодатель ещё не указал реквизиты.' }}
    </p>
    <div v-else class="space-y-2">
      <div
        v-for="row in rows"
        :key="row.key"
        class="flex items-start justify-between gap-3 text-sm"
      >
        <span class="text-xs text-slate-500 shrink-0 pt-0.5">{{ row.label }}</span>
        <span class="font-mono text-slate-200 text-right break-all">{{ row.value }}</span>
      </div>
      <button type="button" class="panel-btn-secondary text-xs mt-2" @click="copyAll">
        {{ copied ? 'Скопировано' : 'Скопировать реквизиты' }}
      </button>
    </div>
  </div>
</template>
