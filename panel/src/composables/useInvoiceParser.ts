import * as pdfjsLib from 'pdfjs-dist'
import type { InvoiceDocument, ParsedInvoiceAmount } from '@/types/billing'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).href

function normalizeAmount(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, '').replace(',', '.')
  const value = Number.parseFloat(cleaned)
  if (!Number.isFinite(value) || value <= 0 || value > 999_999_999) return null
  return Math.round(value * 100) / 100
}

/** Извлекает сумму к оплате из текста счёта (рус./eng.) */
export function extractAmountFromText(text: string): ParsedInvoiceAmount {
  const normalized = text.replace(/\u00a0/g, ' ')

  const priorityPatterns: { re: RegExp; confidence: ParsedInvoiceAmount['confidence'] }[] = [
    { re: /(?:итого\s*к\s*оплате|к\s*оплате|amount\s*due|total\s*due)\s*[:\s]*([\d\s]+[,.]?\d*)/gi, confidence: 'high' },
    { re: /(?:итого|всего\s*к\s*оплате|сумма\s*к\s*оплате)\s*[:\s]*([\d\s]+[,.]?\d*)/gi, confidence: 'high' },
    { re: /(?:сумма|total|amount)\s*[:\s]*([\d\s]+[,.]?\d*)\s*(?:руб|₽|rub)?/gi, confidence: 'medium' },
    { re: /([\d\s]+[,.]\d{2})\s*(?:руб\.?|₽|RUB)/gi, confidence: 'medium' },
  ]

  for (const { re, confidence } of priorityPatterns) {
    const matches = [...normalized.matchAll(re)]
    if (matches.length > 0) {
      const last = matches[matches.length - 1]!
      const amount = normalizeAmount(last[1]!)
      if (amount != null) {
        return { amount, confidence, source: last[0].trim().slice(0, 80) }
      }
    }
  }

  const allNumbers = [...normalized.matchAll(/([\d\s]+[,.]\d{2})/g)]
    .map((m) => normalizeAmount(m[1]!))
    .filter((n): n is number => n != null && n >= 100)

  if (allNumbers.length > 0) {
    const amount = Math.max(...allNumbers)
    return { amount, confidence: 'low', source: 'Наибольшая сумма в документе' }
  }

  return { amount: null, confidence: 'none', source: '' }
}

async function extractTextFromPdf(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const parts: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    parts.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '))
  }
  return parts.join('\n')
}

async function extractTextFromFile(file: File): Promise<string> {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return extractTextFromPdf(file)
  }
  if (file.type.startsWith('text/') || file.name.endsWith('.txt')) {
    return file.text()
  }
  return ''
}

export async function parseInvoiceAmountFromFile(file: File): Promise<ParsedInvoiceAmount> {
  try {
    const text = await extractTextFromFile(file)
    if (!text.trim()) {
      return { amount: null, confidence: 'none', source: 'Текст в файле не распознан — укажите сумму вручную' }
    }
    return extractAmountFromText(text)
  } catch {
    return { amount: null, confidence: 'none', source: 'Не удалось прочитать файл — укажите сумму вручную' }
  }
}

export async function fileToInvoiceDocument(file: File): Promise<InvoiceDocument> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
  return {
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    dataUrl,
  }
}
