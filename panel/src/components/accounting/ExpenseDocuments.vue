<script setup lang="ts">
import { ref } from 'vue'
import { Download, FileText, Paperclip, Trash2, Upload } from '@lucide/vue'
import type { ExpenseDocument } from '@/types/accounting'
import type { PendingDocument } from '@/types/portfolio'
import { ACCEPTED_FILE_TYPES, fileToPendingDocument, formatFileSize } from '@/composables/useDocuments'

const props = withDefaults(defineProps<{
  documents: ExpenseDocument[] | PendingDocument[]
  label?: string
  compact?: boolean
  readonly?: boolean
}>(), {
  label: 'Документы',
  compact: false,
  readonly: false,
})

const emit = defineEmits<{
  upload: [doc: PendingDocument]
  remove: [index: number, documentId?: number]
}>()

const uploading = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

function isPersisted(doc: ExpenseDocument | PendingDocument): doc is ExpenseDocument {
  return 'id' in doc && 'uploadedAt' in doc
}

async function onFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (!files?.length) return

  uploading.value = true
  try {
    for (const file of Array.from(files)) {
      emit('upload', await fileToPendingDocument(file))
    }
  } finally {
    uploading.value = false
    input.value = ''
  }
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
        <span v-if="documents.length" class="text-slate-600 font-normal normal-case">({{ documents.length }})</span>
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
      v-if="documents.length === 0"
      class="rounded-xl border border-dashed border-border bg-panel/20 px-4 py-5 text-center text-xs text-slate-500"
    >
      Счета, акты, квитанции — PDF, DOC, JPG, PNG
    </div>

    <ul v-else class="space-y-1.5">
      <li
        v-for="(doc, index) in documents"
        :key="isPersisted(doc) ? doc.id : index"
        class="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-panel/40"
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
          @click="emit('remove', index, isPersisted(doc) ? doc.id : undefined)"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </li>
    </ul>
  </div>
</template>
