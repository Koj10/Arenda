import JSZip from 'jszip'
import type { AttachedDocument, PropertyDocumentCategory } from '@/types/portfolio'
import { PROPERTY_DOCUMENT_LABELS } from '@/types/portfolio'
import type { PendingDocument } from '@/types/portfolio'

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

export function fileToPendingDocument(file: File): Promise<PendingDocument> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve({
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        dataUrl: reader.result as string,
      })
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export const ACCEPTED_FILE_TYPES = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp'

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1]! : dataUrl
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function sanitizeArchiveName(name: string): string {
  const cleaned = name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
  return cleaned || 'documents'
}

function uniqueFileName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name)
    return name
  }
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  let index = 2
  while (used.has(`${base} (${index})${ext}`)) index++
  const unique = `${base} (${index})${ext}`
  used.add(unique)
  return unique
}

function folderForDocument(doc: AttachedDocument): string {
  if (doc.category === 'title' || doc.category === 'service') {
    return PROPERTY_DOCUMENT_LABELS[doc.category as PropertyDocumentCategory]
  }
  return doc.category
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/** Скачать набор документов одним ZIP-архивом, сгруппированным по категориям. */
export async function downloadDocumentsArchive(
  documents: AttachedDocument[],
  archiveName: string,
): Promise<boolean> {
  if (!documents.length) return false

  const zip = new JSZip()
  const usedByFolder = new Map<string, Set<string>>()

  for (const doc of documents) {
    const folder = folderForDocument(doc)
    if (!usedByFolder.has(folder)) usedByFolder.set(folder, new Set())
    const usedNames = usedByFolder.get(folder)!
    const fileName = uniqueFileName(doc.name, usedNames)
    zip.folder(folder)?.file(fileName, dataUrlToUint8Array(doc.dataUrl))
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  triggerBlobDownload(blob, `${sanitizeArchiveName(archiveName)}.zip`)
  return true
}
