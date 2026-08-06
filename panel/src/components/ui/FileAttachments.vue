<script setup lang="ts">
import { computed, ref } from 'vue'
import { Download, FileText, Paperclip, Trash2, Upload } from '@lucide/vue'
import { usePortfolioStore } from '@/stores/portfolioStore'
import type { DocumentEntityType, PendingDocument, AttachedDocument } from '@/types/portfolio'
import { ACCEPTED_FILE_TYPES, fileToPendingDocument, formatFileSize } from '@/composables/useDocuments'

const props = withDefaults(defineProps<{
  entityType: DocumentEntityType
  entityId?: number | null
  modelValue?: PendingDocument[]
  label?: string
  compact?: boolean
  readonly?: boolean
}>(), {
  entityId: null,
  modelValue: () => [],
  label: 'Документы',
  compact: false,
  readonly: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: PendingDocument[]]
}>()

const store = usePortfolioStore()
const uploading = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

const isPersisted = computed(() => props.entityId != null && props.entityId > 0)

const persistedDocs = computed(() =>
  isPersisted.value
    ? store.getDocuments(props.entityType, props.entityId!)
    : [],
)

const pendingDocs = computed({
  get: () => props.modelValue ?? [],
  set: (value) => emit('update:modelValue', value),
})

type DisplayDocument = PendingDocument | AttachedDocument

const allDocs = computed<DisplayDocument[]>(() =>
  isPersisted.value ? persistedDocs.value : pendingDocs.value,
)

function isAttachedDocument(doc: DisplayDocument): doc is AttachedDocument {
  return 'id' in doc
}

async function onFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (!files?.length) return

  uploading.value = true
  try {
    for (const file of Array.from(files)) {
      const pending = await fileToPendingDocument(file)
      if (isPersisted.value) {
        store.addDocument({
          entityType: props.entityType,
          entityId: props.entityId!,
          ...pending,
        })
      } else {
        pendingDocs.value = [...pendingDocs.value, pending]
      }
    }
  } finally {
    uploading.value = false
    input.value = ''
  }
}

function removePending(index: number) {
  pendingDocs.value = pendingDocs.value.filter((_, i) => i !== index)
}

function removePersisted(id: number) {
  store.removeDocument(id)
}

function openDoc(doc: { name: string; dataUrl: string }) {
  const link = document.createElement('a')
  link.href = doc.dataUrl
  link.download = doc.name
  link.target = '_blank'
  link.rel = 'noopener'
  link.click()
}
</script>

<template>
  <div :class="compact ? 'space-y-2' : 'space-y-3'">
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        <Paperclip class="w-3.5 h-3.5" />
        {{ label }}
        <span v-if="allDocs.length" class="text-slate-600 font-normal normal-case">({{ allDocs.length }})</span>
      </div>
      <button
        v-if="!readonly"
        type="button"
        class="panel-btn-secondary text-xs py-1.5 px-2.5 disabled:opacity-50"
        :disabled="uploading"
        @click="inputRef?.click()"
      >
        <Upload class="w-3.5 h-3.5" />
        {{ uploading ? 'Загрузка...' : 'Прикрепить' }}
      </button>
      <input
        ref="inputRef"
        type="file"
        class="hidden"
        multiple
        :accept="ACCEPTED_FILE_TYPES"
        @change="onFilesSelected"
      />
    </div>

    <div
      v-if="allDocs.length === 0"
      class="rounded-xl border border-dashed border-border bg-panel/20 px-4 py-5 text-center text-xs text-slate-500"
    >
      PDF, DOC, JPG, PNG — договоры и другие документы
    </div>

    <ul v-else class="space-y-1.5">
      <li
        v-for="(doc, index) in allDocs"
        :key="isAttachedDocument(doc) ? doc.id : index"
        class="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-panel/40 group"
      >
        <FileText class="w-4 h-4 text-emerald-brand shrink-0" />
        <div class="flex-1 min-w-0">
          <p class="text-sm text-slate-200 truncate">{{ doc.name }}</p>
          <p class="text-xs text-slate-500">{{ formatFileSize(doc.size) }}</p>
        </div>
        <button
          type="button"
          class="p-1.5 rounded-lg text-slate-400 hover:text-emerald-brand hover:bg-card-hover transition-colors"
          title="Скачать"
          @click="openDoc(doc)"
        >
          <Download class="w-3.5 h-3.5" />
        </button>
        <button
          v-if="!readonly"
          type="button"
          class="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-card-hover transition-colors"
          title="Удалить"
          @click="isAttachedDocument(doc) ? removePersisted(doc.id) : removePending(index)"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </li>
    </ul>
  </div>
</template>
