<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Download, Eye, FileText, Search } from '@lucide/vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import FilePreviewModal from '@/components/documents/FilePreviewModal.vue'
import { listFiles, fileDisplayName } from '@/api/auth'
import { downloadFileBlob, formatApiError, saveBlobFile } from '@/api/http'
import { asList } from '@/api/types'
import type { FileOut } from '@/api/types'
import { formatFileSize } from '@/composables/useDocuments'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { formatDateRu } from '@/utils/dates'

const portfolio = usePortfolioStore()

const files = ref<FileOut[]>([])
const loading = ref(false)
const error = ref('')
const search = ref('')
const typeFilter = ref('all')
const sortKey = ref<'date' | 'name' | 'size' | 'type'>('date')
const sortDir = ref<'asc' | 'desc'>('desc')
const preview = ref<FileOut | null>(null)
const downloadingId = ref<number | null>(null)

const KIND_LABELS: Record<string, string> = {
  title: 'Правоустанавливающий',
  service: 'Сервисный',
  supporting: 'Подтверждающий',
  contract: 'Договор',
  receipt: 'Чек',
}

const LINK_LABELS: Record<string, string> = {
  object: 'Объект',
  unit: 'Помещение',
  lease: 'Договор',
  tenant: 'Арендатор',
  transaction: 'Транзакция',
  bill: 'Коммуналка',
  invoice: 'Счёт',
  cadastre: 'Кадастр',
}

function kindLabel(kind?: string | null) {
  if (!kind) return 'Файл'
  return KIND_LABELS[kind] ?? kind
}

function linkLabel(type?: string | null) {
  if (!type) return 'Без привязки'
  return LINK_LABELS[type] ?? type
}

function contextOf(file: FileOut): string {
  const type = file.linked_type
  const id = file.linked_id
  if (!type || id == null) return '—'
  if (type === 'object') return portfolio.getPropertyById(id)?.address ?? `Объект #${id}`
  if (type === 'unit') {
    const space = portfolio.getSpaceById(id)
    if (!space) return `Помещение #${id}`
    const property = portfolio.getPropertyById(space.propertyId)
    return `${property?.address ?? 'Объект'} · ${space.name}`
  }
  if (type === 'lease' || type === 'tenant') {
    const tenant = type === 'tenant'
      ? portfolio.getTenantById(id)
      : portfolio.getTenantByLeaseId(id)
    return tenant ? `${tenant.company}${tenant.space ? ` · ${tenant.space}` : ''}` : `#${id}`
  }
  return `${linkLabel(type)} #${id}`
}

function fromAttached(): FileOut[] {
  const byId = new Map<number, FileOut>()
  for (const doc of portfolio.documents) {
    byId.set(doc.id, {
      id: doc.id,
      original_name: doc.name,
      mime_type: doc.mimeType,
      size: doc.size,
      kind: doc.category,
      linked_type: doc.entityType === 'property' ? 'object' : 'lease',
      linked_id: doc.entityId,
      created_at: doc.uploadedAt,
    })
  }
  return [...byId.values()]
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const remote = asList<FileOut>(await listFiles())
    const local = fromAttached()
    const byId = new Map<number, FileOut>()
    for (const file of [...local, ...remote]) byId.set(file.id, file)
    files.value = [...byId.values()]
  } catch (err) {
    files.value = fromAttached()
    if (!files.value.length) error.value = formatApiError(err, 'Не удалось загрузить документы')
  } finally {
    loading.value = false
  }
}

const typeOptions = computed(() => {
  const set = new Set(files.value.map((file) => file.linked_type || 'none'))
  return [...set]
})

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  let list = files.value
  if (typeFilter.value !== 'all') {
    list = list.filter((file) => (file.linked_type || 'none') === typeFilter.value)
  }
  if (q) {
    list = list.filter((file) => {
      const name = fileDisplayName(file).toLowerCase()
      const ctx = contextOf(file).toLowerCase()
      return name.includes(q) || ctx.includes(q) || kindLabel(file.kind).toLowerCase().includes(q)
    })
  }
  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...list].sort((a, b) => {
    if (sortKey.value === 'name') return fileDisplayName(a).localeCompare(fileDisplayName(b), 'ru') * dir
    if (sortKey.value === 'size') return ((a.size ?? 0) - (b.size ?? 0)) * dir
    if (sortKey.value === 'type') return linkLabel(a.linked_type).localeCompare(linkLabel(b.linked_type), 'ru') * dir
    return String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')) * dir
  })
})

function toggleSort(key: typeof sortKey.value) {
  if (sortKey.value === key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  else {
    sortKey.value = key
    sortDir.value = key === 'name' || key === 'type' ? 'asc' : 'desc'
  }
}

function sortMark(key: typeof sortKey.value) {
  if (sortKey.value !== key) return ''
  return sortDir.value === 'asc' ? ' ↑' : ' ↓'
}

async function download(file: FileOut) {
  downloadingId.value = file.id
  try {
    const blob = await downloadFileBlob(file.id)
    saveBlobFile(blob, fileDisplayName(file))
  } catch (err) {
    error.value = formatApiError(err, 'Не удалось скачать файл')
  } finally {
    downloadingId.value = null
  }
}

onMounted(() => {
  void load()
})
</script>

<template>
  <AppLayout>
    <div class="panel-page-wide">
      <div class="panel-toolbar mb-4">
        <div class="panel-toolbar-search">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input v-model="search" type="search" placeholder="Поиск по имени или объекту..." class="panel-search" />
        </div>
        <select v-model="typeFilter" class="panel-input w-full sm:w-auto sm:min-w-[180px]">
          <option value="all">Все привязки</option>
          <option v-for="type in typeOptions" :key="type" :value="type">
            {{ type === 'none' ? 'Без привязки' : linkLabel(type) }}
          </option>
        </select>
      </div>

      <p v-if="error" class="mb-4 text-sm text-rose-400">{{ error }}</p>
      <p v-else-if="loading" class="mb-4 text-sm text-slate-500">Загрузка документов...</p>

      <div class="panel-card">
        <div class="panel-table-wrap">
          <table class="w-full text-sm">
            <thead>
              <tr class="panel-table-head">
                <th class="px-5 py-3 font-medium">
                  <button type="button" class="hover:text-white" @click="toggleSort('name')">Файл{{ sortMark('name') }}</button>
                </th>
                <th class="px-5 py-3 font-medium hidden md:table-cell">
                  <button type="button" class="hover:text-white" @click="toggleSort('type')">Привязка{{ sortMark('type') }}</button>
                </th>
                <th class="px-5 py-3 font-medium hidden lg:table-cell">Тип</th>
                <th class="px-5 py-3 font-medium hidden sm:table-cell">
                  <button type="button" class="hover:text-white" @click="toggleSort('size')">Размер{{ sortMark('size') }}</button>
                </th>
                <th class="px-5 py-3 font-medium hidden lg:table-cell">
                  <button type="button" class="hover:text-white" @click="toggleSort('date')">Дата{{ sortMark('date') }}</button>
                </th>
                <th class="px-5 py-3 font-medium text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="file in filtered" :key="file.id" class="panel-table-row">
                <td class="px-5 py-3.5">
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="w-8 h-8 rounded-lg bg-panel flex items-center justify-center shrink-0">
                      <FileText class="w-4 h-4 text-slate-500" />
                    </span>
                    <div class="min-w-0">
                      <p class="text-white truncate">{{ fileDisplayName(file) }}</p>
                      <p class="text-xs text-slate-500 truncate md:hidden">{{ contextOf(file) }}</p>
                    </div>
                  </div>
                </td>
                <td class="px-5 py-3.5 hidden md:table-cell">
                  <p class="text-slate-300 text-xs">{{ linkLabel(file.linked_type) }}</p>
                  <p class="text-slate-500 text-xs truncate max-w-[16rem]">{{ contextOf(file) }}</p>
                </td>
                <td class="px-5 py-3.5 text-slate-400 text-xs hidden lg:table-cell">{{ kindLabel(file.kind) }}</td>
                <td class="px-5 py-3.5 font-mono text-xs text-slate-400 hidden sm:table-cell">{{ formatFileSize(file.size ?? 0) }}</td>
                <td class="px-5 py-3.5 font-mono text-xs text-slate-500 hidden lg:table-cell">
                  {{ file.created_at ? formatDateRu(file.created_at) : '—' }}
                </td>
                <td class="px-5 py-3.5">
                  <div class="flex justify-end gap-2">
                    <button type="button" class="panel-btn-secondary !px-2.5 !py-1.5" @click="preview = file">
                      <Eye class="w-3.5 h-3.5" />
                      Смотреть
                    </button>
                    <button
                      type="button"
                      class="panel-btn-primary !px-2.5 !py-1.5"
                      :disabled="downloadingId === file.id"
                      @click="download(file)"
                    >
                      <Download class="w-3.5 h-3.5" />
                      {{ downloadingId === file.id ? '...' : 'Скачать' }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="!loading && filtered.length === 0" class="py-12 text-center text-slate-500 text-sm">
          Документы не найдены
        </div>
      </div>
    </div>

    <FilePreviewModal
      :open="!!preview"
      :file-id="preview?.id ?? null"
      :file-name="preview ? fileDisplayName(preview) : ''"
      :mime-type="preview?.mime_type || ''"
      :size="preview?.size"
      @close="preview = null"
    />
  </AppLayout>
</template>
