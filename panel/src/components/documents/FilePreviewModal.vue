<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Download, FileText } from '@lucide/vue'
import Modal from '@/components/ui/Modal.vue'
import { downloadFileBlob, saveBlobFile } from '@/api/http'
import { formatFileSize } from '@/composables/useDocuments'

const props = defineProps<{
  open: boolean
  fileId: number | null
  fileName: string
  mimeType: string
  size?: number
}>()

const emit = defineEmits<{ close: [] }>()

const loading = ref(false)
const error = ref('')
const objectUrl = ref('')
const textContent = ref('')
const downloading = ref(false)

const previewKind = computed(() => {
  const mime = (props.mimeType || '').toLowerCase()
  const name = props.fileName.toLowerCase()
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(name)) return 'image'
  if (mime.includes('pdf') || name.endsWith('.pdf')) return 'pdf'
  if (mime.startsWith('text/') || mime.includes('json') || /\.(txt|csv|json|md|xml|log)$/.test(name)) return 'text'
  return 'other'
})

function revoke() {
  if (objectUrl.value) {
    URL.revokeObjectURL(objectUrl.value)
    objectUrl.value = ''
  }
  textContent.value = ''
}

watch(
  () => [props.open, props.fileId] as const,
  async ([open, id]) => {
    revoke()
    error.value = ''
    if (!open || id == null) return
    loading.value = true
    try {
      if (previewKind.value === 'other') {
        loading.value = false
        return
      }
      const blob = await downloadFileBlob(id)
      if (previewKind.value === 'text') {
        textContent.value = await blob.text()
      } else if (previewKind.value === 'image' || previewKind.value === 'pdf') {
        objectUrl.value = URL.createObjectURL(blob)
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Не удалось открыть файл'
    } finally {
      loading.value = false
    }
  },
)

onBeforeUnmount(revoke)

async function download() {
  if (props.fileId == null || downloading.value) return
  downloading.value = true
  try {
    const blob = await downloadFileBlob(props.fileId)
    saveBlobFile(blob, props.fileName || 'file')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Не удалось скачать файл'
  } finally {
    downloading.value = false
  }
}
</script>

<template>
  <Modal :open="open" :title="fileName || 'Файл'" size="3xl" :z-index="130" @close="emit('close')">
    <p v-if="size" class="text-xs text-slate-500 mb-3">{{ mimeType || 'файл' }} · {{ formatFileSize(size) }}</p>
    <p v-if="error" class="text-sm text-rose-400 mb-3">{{ error }}</p>
    <p v-else-if="loading" class="text-sm text-slate-500 py-10 text-center">Загрузка...</p>
    <div v-else class="min-h-[240px]">
      <img
        v-if="previewKind === 'image' && objectUrl"
        :src="objectUrl"
        :alt="fileName"
        class="max-h-[70vh] w-full object-contain rounded-xl bg-panel"
      />
      <iframe
        v-else-if="previewKind === 'pdf' && objectUrl"
        :src="objectUrl"
        class="w-full h-[70vh] rounded-xl border border-border bg-white"
        title="Просмотр PDF"
      />
      <pre
        v-else-if="previewKind === 'text'"
        class="max-h-[70vh] overflow-auto rounded-xl border border-border bg-panel p-4 text-xs text-slate-200 whitespace-pre-wrap break-words"
      >{{ textContent }}</pre>
      <div v-else class="py-12 text-center">
        <FileText class="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <p class="text-sm text-slate-400">Предпросмотр для этого типа недоступен — скачайте файл.</p>
      </div>
    </div>
    <template #footer>
      <button type="button" class="panel-btn-secondary" @click="emit('close')">Закрыть</button>
      <button type="button" class="panel-btn-primary" :disabled="downloading || fileId == null" @click="download">
        <Download class="w-4 h-4" />
        {{ downloading ? 'Скачивание...' : 'Скачать' }}
      </button>
    </template>
  </Modal>
</template>
