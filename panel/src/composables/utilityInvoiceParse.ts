import type { UtilityCriterion } from '@/types/utilityBills'
import { UTILITY_CRITERION_LABELS, VAT_RATE, createEmptyBillLines } from '@/types/utilityBills'
import type { ParsedInvoiceAmount } from '@/types/billing'

export interface ParsedUtilityLine {
  criterion: UtilityCriterion
  amount: number
  label: string
}

export interface ParsedUtilityInvoice {
  title: string
  seller: string | null
  invoiceNumber: string | null
  period: string | null
  dueDate: string | null
  total: number | null
  unitPrice: number | null
  vatRate: number
  lines: ParsedUtilityLine[]
  confidence: ParsedInvoiceAmount['confidence']
  source: string
}

const MONTHS: Record<string, number> = {
  январ: 1,
  феврал: 2,
  март: 3,
  апрел: 4,
  мая: 5,
  май: 5,
  июн: 6,
  июл: 7,
  август: 8,
  сентябр: 9,
  октябр: 10,
  ноябр: 11,
  декабр: 12,
}

const CRITERION_KEYWORDS: { criterion: UtilityCriterion; patterns: RegExp[] }[] = [
  {
    criterion: 'sewerage',
    patterns: [
      /водоотвед/i,
      /канализац/i,
      /сточн/i,
      /негативн[\s\S]{0,40}воздейств/i,
      /цс\s*водоотвед/i,
    ],
  },
  {
    criterion: 'water',
    patterns: [
      /водоснабжен/i,
      /холодн[\s\S]{0,40}вод/i,
      /горяч[\s\S]{0,40}вод/i,
      /питьев[\s\S]{0,20}вод/i,
      /\bхвс\b/i,
      /\bгвс\b/i,
      /водоканал/i,
      /boaoc/i,
      /boaoora/i,
    ],
  },
  {
    criterion: 'electricity',
    patterns: [/электроэнерг/i, /электрическ[\s\S]{0,20}энерг/i, /энергосбыт/i, /квт[·\s]*ч/i],
  },
  {
    criterion: 'heating',
    patterns: [
      /теплофикац/i,
      /тепловая\s+энерг/i,
      /теплоснабжен/i,
      /отоплен/i,
      /гкал/i,
      /tennoban/i,
      /tennovuyu/i,
      /tennovuju/i,
    ],
  },
  {
    criterion: 'garbage',
    patterns: [/\bтко\b/i, /тверд[\s\S]{0,20}коммунал/i, /обращен[\s\S]{0,30}тко/i, /вывоз[\s\S]{0,20}мусор/i],
  },
  {
    criterion: 'gas',
    patterns: [/газоснабжен/i, /природн[\s\S]{0,12}газ/i, /газ\s*\(/i],
  },
  {
    criterion: 'management',
    patterns: [/управляющ[\s\S]{0,20}компан/i, /содержан[\s\S]{0,20}имуществ/i, /содержан[\s\S]{0,12}дом/i],
  },
  {
    criterion: 'septic',
    patterns: [/септик/i, /выгребн/i],
  },
]

const SELLER_DEFAULT: { re: RegExp; criterion: UtilityCriterion; short: string }[] = [
  { re: /водоканал/i, criterion: 'water', short: 'Водоканал' },
  { re: /энергосбытов[\s\S]{0,20}восток|эк\s*[«"]?восток/i, criterion: 'electricity', short: 'ЭК Восток' },
  { re: /уралэнергосбыт|уральская энергосбытов/i, criterion: 'electricity', short: 'Уралэнергосбыт' },
  { re: /центр коммунального сервиса|\bцкс\b/i, criterion: 'garbage', short: 'ЦКС' },
  { re: /электротепловые сети|\bэтс\b/i, criterion: 'water', short: 'ЭТС' },
  { re: /тепловодосет/i, criterion: 'heating', short: 'Тепловодосети' },
]

export function parseRuNumber(raw: string): number | null {
  const cleaned = raw.replace(/\u00a0/g, ' ').replace(/\s/g, '').replace(',', '.')
  const value = Number.parseFloat(cleaned)
  if (!Number.isFinite(value) || value <= 0 || value > 99_999_999) return null
  return Math.round(value * 100) / 100
}

function collectMoney(text: string): number[] {
  const matches = [...text.matchAll(/(\d{1,3}(?:\s\d{3})+|\d+)[.,]\d{2}/g)]
  return matches.map((m) => parseRuNumber(m[0]!)).filter((n): n is number => n != null)
}

function lastMoney(text: string): number | null {
  const nums = collectMoney(text)
  return nums.length ? nums[nums.length - 1]! : null
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function periodFromParts(year: number, month: number): string | null {
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return null
  return `${year}-${pad2(month)}`
}

function addMonths(period: string, delta: number): string {
  const [y, m] = period.split('-').map(Number)
  const d = new Date(y!, (m! - 1) + delta, 1)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

function dueFromPeriod(period: string): string {
  const next = addMonths(period, 1)
  return `${next}-15`
}

function parseDateRu(value: string): { iso: string; period: string } | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim())
  if (!m) return null
  const day = Number(m[1])
  const month = Number(m[2])
  const year = Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return { iso: `${year}-${pad2(month)}-${pad2(day)}`, period: periodFromParts(year, month)! }
}

function normalize(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/ё/gi, 'е')
    .replace(/[ \t]+/g, ' ')
    .replace(/\r/g, '')
}

function mentionedCriteria(text: string): UtilityCriterion[] {
  const found: UtilityCriterion[] = []
  for (const { criterion, patterns } of CRITERION_KEYWORDS) {
    if (patterns.some((re) => re.test(text))) found.push(criterion)
  }
  return found
}

function extractTariff(text: string): { unitPrice: number | null; vatRate: number } {
  const vatRate = /20\s*%/.test(text) ? 0.20 : /22\s*%/.test(text) ? 0.22 : VAT_RATE
  const candidates: number[] = []

  const triplePatterns = [
    /([\d\s]+[.,]\d+)\s+[×xх*]\s+([\d\s]+[.,]\d+)\s*[=:]\s*([\d\s]+[.,]\d{2})/gi,
    /([\d\s]+[.,]\d+)\s+([\d\s]+[.,]\d+)\s+([\d\s]+[.,]\d{2})\s+Без акциза/gi,
    /([\d\s]+[.,]\d+)\s+([\d\s]+[.,]\d+)\s+([\d\s]+[.,]\d{2})(?:\s|$)/g,
    /(\d[\d\s]*[.,]\d+)\s{1,5}(\d[\d\s]*[.,]\d+)\s{1,5}(\d[\d\s]*[.,]\d{2})/g,
  ]
  for (const re of triplePatterns) {
    for (const m of text.matchAll(re)) {
      const qty = parseRuNumber(m[1]!)
      const price = parseRuNumber(m[2]!)
      const net = parseRuNumber(m[3]!)
      if (qty && price && net && qty > 0 && price > 0 && net > 0) {
        const ratio = qty * price / net
        if (ratio > 0.9 && ratio < 1.1) {
          candidates.push(price)
        }
      }
    }
  }

  const tariffKeywordPatterns = [
    /(?:тариф|ставка|цена\s+за\s+единиц|цена\s+за\s+1|стоимость\s+единиц)[\s\S]{0,40}?(\d[\d\s]*[.,]\d{2,5})/gi,
    /(?:тариф|ставка)[^\d]{0,20}(\d[\d\s]*[.,]\d{2,5})/gi,
    /(\d[\d\s]*[.,]\d{2,5})[\s\S]{0,20}?(?:руб\.?|коп\.?|₽)\s*(?:за|в|на)?[\s\S]{0,20}?(?:кВт|квт|м3|м³|Гкал|куб|единиц)/gi,
  ]
  for (const re of tariffKeywordPatterns) {
    for (const m of text.matchAll(re)) {
      const price = parseRuNumber(m[1]!)
      if (price && price > 0 && price < 100000) {
        candidates.push(price)
      }
    }
  }

  const unitPatterns = [
    /(\d[\d\s]*[.,]\d{2,5})\s*(?:руб\.?|₽)?\s*(?:за|в)\s*(?:1\s*)?(?:кВт|квт·ч|кВтч|квт|м3|м³|Гкал|куб\.?\s*м|кубометр)/gi,
  ]
  for (const re of unitPatterns) {
    for (const m of text.matchAll(re)) {
      const price = parseRuNumber(m[1]!)
      if (price && price > 0 && price < 100000) {
        candidates.push(price)
      }
    }
  }

  const qtyUnitMatch = text.match(/([\d\s]+[.,]\d+|\d+)\s*(?:кВт|квт·ч|кВтч|квт|м3|м³|Гкал|куб)/i)
  const allNets = collectMoney(text).sort((a, b) => b - a)
  if (qtyUnitMatch && allNets.length) {
    const qty = parseRuNumber(qtyUnitMatch[1]!) ?? Number(qtyUnitMatch[1]!)
    for (const net of allNets.slice(0, 5)) {
      if (qty && qty > 0 && net > 0) {
        const price = net / qty
        if (price > 0.001 && price < 100000) {
          candidates.push(Math.round(price * 100000) / 100000)
        }
      }
    }
  }

  const qtyMatch = text.match(/([\d\s]+[.,]\d+)\s*(?:кВт|квт|м3|м³|Гкал)/i)
  const netMatch = text.match(/([\d\s]+[.,]\d{2})\s+Без акциза/i)
  if (qtyMatch && netMatch) {
    const qty = parseRuNumber(qtyMatch[1]!)
    const net = parseRuNumber(netMatch[1]!)
    if (qty && net) candidates.push(Math.round((net / qty) * 100000) / 100000)
  }

  if (candidates.length) {
    const filtered = candidates.filter((c) => c > 0.01 && c < 100000)
    if (filtered.length) {
      filtered.sort((a, b) => {
        const ca = candidates.filter((x) => Math.abs(x - a) / a < 0.1).length
        const cb = candidates.filter((x) => Math.abs(x - b) / b < 0.1).length
        return cb - ca
      })
      return { unitPrice: filtered[0]!, vatRate }
    }
  }
  return { unitPrice: null, vatRate }
}

function extractSeller(text: string): string | null {
  const patterns = [
    /Продавец\s+([^\n(]+?)\s*\(2\)/i,
    /Получатель:\s+([^\n]+)/i,
    /Поставщик[\s\S]{0,40}?((?:ООО|АО|МУП|ГУП|ИП)[^\n,]{3,80})/i,
  ]
  for (const re of patterns) {
    const m = re.exec(text)
    if (m?.[1]) return m[1].replace(/^["«]+|["»]+$/g, '').trim()
  }
  return null
}

function extractInvoiceMeta(text: string): { number: string | null; date: ReturnType<typeof parseDateRu> } {
  const patterns = [
    /Счет-фактура\s*№\s*([^\s]+)\s+от\s+(\d{2}\.\d{2}\.\d{4})/i,
    /СЧЕТ\s*N+\s+(\S+)\s+от\s+(\d{2}\.\d{2}\.\d{4})/i,
    /Счет\s+на\s+оплату\s*№?\s*(\S+)\s+от\s+(\d{2}\.\d{2}\.\d{4})/i,
  ]
  for (const re of patterns) {
    const m = re.exec(text)
    if (m) return { number: m[1] ?? null, date: parseDateRu(m[2] ?? '') }
  }
  const anyDate = text.match(/от\s+(\d{2}\.\d{2}\.\d{4})/i)
  return { number: null, date: anyDate ? parseDateRu(anyDate[1]!) : null }
}

function extractPeriod(text: string, invoiceDate: ReturnType<typeof parseDateRu>): string | null {
  const named = text.match(
    /за\s+(январ[ьяе]?|феврал[ьяе]?|март[ае]?|апрел[ьяе]?|ма[йяе]|июн[ьяе]?|июл[ьяе]?|август[ае]?|сентябр[ьяе]?|октябр[ьяе]?|ноябр[ьяе]?|декабр[ьяе]?)\s+(\d{4})/i,
  )
  if (named) {
    const key = Object.keys(MONTHS).find((k) => named[1]!.toLowerCase().startsWith(k))
    if (key) return periodFromParts(Number(named[2]), MONTHS[key]!)
  }
  const dotted = text.match(/\(([А-Яа-я]+)-(\d{4})\)/)
  if (dotted) {
    const key = Object.keys(MONTHS).find((k) => dotted[1]!.toLowerCase().startsWith(k))
    if (key) return periodFromParts(Number(dotted[2]), MONTHS[key]!)
  }
  return invoiceDate?.period ?? null
}

function extractDocumentTotals(text: string): { amount: number; before: string }[] {
  const results: { amount: number; before: string }[] = []
  const patterns = [
    /(?:всего\s*к\s*оплате|итого\s*к\s*оплате(?:\s*\(с\s*ндс\))?|bcero\s*k\s*onnare)\s*[:.(9)\s]*([\d\s.,xх]+)/gi,
    /(?:итого|всего)(?:\s*по\s*счету)?(?:\s*\(?\s*с?\s*н?д?с?\s*\)?)?\s*[:.\s]+(\d{1,3}(?:\s\d{3})*[.,]\d{2}|\d+[.,]\d{2})/gi,
    /(?:к\s*оплате|сумма\s*к\s*оплате|общая\s*сумма)(?:\s*\(с\s*ндс\))?\s*[:.\s]+(\d{1,3}(?:\s\d{3})*[.,]\d{2}|\d+[.,]\d{2})/gi,
    /(?:общая\s*стоимость|стоимость\s*услуг)\s*[:.\s]+(\d{1,3}(?:\s\d{3})*[.,]\d{2}|\d+[.,]\d{2})/gi,
  ]
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const chunk = (m[1] ?? '') as string
      const fallback = lastMoney(text.slice(m.index ?? 0, (m.index ?? 0) + 120))
      const amount = parseRuNumber(chunk) ?? fallback
      if (amount == null) continue
      const start = Math.max(0, (m.index ?? 0) - 900)
      results.push({ amount, before: text.slice(start, m.index) })
    }
  }

  const lastLines = text.split('\n').slice(-20).join('\n')
  const finalMoney = collectMoney(lastLines)
  if (finalMoney.length) {
    const biggest = Math.max(...finalMoney)
    if (!results.some((r) => Math.abs(r.amount - biggest) < 0.009)) {
      const idx = text.lastIndexOf(String(Math.floor(biggest)))
      results.push({ amount: biggest, before: text.slice(Math.max(0, idx - 900), idx) })
    }
  }

  const unique: { amount: number; before: string }[] = []
  for (const row of results) {
    if (!unique.some((u) => Math.abs(u.amount - row.amount) < 0.009)) unique.push(row)
  }
  return unique
}

function amountNearKeywords(text: string, patterns: RegExp[]): number | null {
  for (const re of patterns) {
    const matches = [...text.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))]
    for (const m of matches) {
      if (m.index == null) continue
      const window = text.slice(Math.max(0, m.index - 100), m.index + 800)
      const vatPatterns = [
        /22%\s+[\d\s.,]+\s+(\d{1,3}(?:\s\d{3})*[.,]\d{2}|\d+[.,]\d{2})/,
        /20%\s+[\d\s.,]+\s+(\d{1,3}(?:\s\d{3})*[.,]\d{2}|\d+[.,]\d{2})/,
        /ндс\s*\d*%?[\s\S]{0,30}?(\d{1,3}(?:\s\d{3})*[.,]\d{2}|\d+[.,]\d{2})/i,
        /(?:в том числе ндс|в т.ч. ндс)[\s\S]{0,30}?(\d{1,3}(?:\s\d{3})*[.,]\d{2}|\d+[.,]\d{2})/i,
      ]
      for (const vatRe of vatPatterns) {
        const v = window.match(vatRe)
        if (v) {
          const n = parseRuNumber(v[1]!)
          if (n != null) return n
        }
      }
      const noVatPatterns = [
        /без\s*ндс[\s\S]{0,60}?(\d{1,3}(?:\s\d{3})*[.,]\d{2}|\d+[.,]\d{2})/i,
        /(?:сумма|стоимость|итого)\s*(?:без\s*ндс)?\s*[:.\s]+(\d{1,3}(?:\s\d{3})*[.,]\d{2}|\d+[.,]\d{2})/i,
        /(\d{1,3}(?:\s\d{3})*[.,]\d{2}|\d+[.,]\d{2})\s*(?:руб\.?|₽)/i,
      ]
      for (const nvRe of noVatPatterns) {
        const nv = window.match(nvRe)
        if (nv) {
          const n = parseRuNumber(nv[1]!)
          if (n != null) return n
        }
      }
      const nums = collectMoney(window)
      if (nums.length) return Math.max(...nums)
    }
  }
  return null
}

function shortSeller(seller: string | null, text: string): string {
  for (const row of SELLER_DEFAULT) {
    if (row.re.test(text) || (seller && row.re.test(seller))) return row.short
  }
  if (!seller) return 'Коммунальный счёт'
  return seller.replace(/^["«]+|["»]+$/g, '').replace(/общество с ограниченной ответственностью/i, 'ООО').slice(0, 48)
}

function defaultCriterion(text: string, seller: string | null): UtilityCriterion | null {
  for (const row of SELLER_DEFAULT) {
    if (row.re.test(text) || (seller && row.re.test(seller))) return row.criterion
  }
  return null
}

function mergeLines(items: ParsedUtilityLine[]): ParsedUtilityLine[] {
  const map = new Map<UtilityCriterion, number>()
  for (const item of items) {
    if (item.amount <= 0) continue
    map.set(item.criterion, Math.round(((map.get(item.criterion) ?? 0) + item.amount) * 100) / 100)
  }
  return [...map.entries()].map(([criterion, amount]) => ({
    criterion,
    amount,
    label: UTILITY_CRITERION_LABELS[criterion],
  }))
}

function buildTitle(sellerLabel: string, invoiceNumber: string | null, period: string | null, lines: ParsedUtilityLine[]) {
  const parts = [sellerLabel]
  if (invoiceNumber) parts.push(`№${invoiceNumber}`)
  if (period) {
    const [y, m] = period.split('-')
    const d = new Date(Number(y), Number(m) - 1, 1)
    parts.push(new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(d))
  } else if (lines.length === 1) {
    parts.push(lines[0]!.label)
  }
  return parts.join(' · ')
}

export function parseUtilityInvoice(rawText: string): ParsedUtilityInvoice {
  const text = normalize(rawText)
  const seller = extractSeller(text)
  const meta = extractInvoiceMeta(text)
  const period = extractPeriod(text, meta.date)
  const totals = extractDocumentTotals(text)

  let total: number | null = totals.length
    ? totals.reduce((s, t) => s + t.amount, 0)
    : lastMoney(text.match(/итого[^\n]{0,40}/i)?.[0] ?? '')

  if (total == null) {
    const allMoney = collectMoney(text)
    if (allMoney.length) {
      const sorted = [...allMoney].sort((a, b) => b - a)
      total = sorted[0] ?? null
    }
  }

  const mentioned = mentionedCriteria(text)
  let lines: ParsedUtilityLine[] = []

  if (totals.length > 1) {
    for (const row of totals) {
      const local = mentionedCriteria(row.before)
      const criterion = local[0] ?? defaultCriterion(row.before, seller) ?? mentioned[0]
      if (criterion) {
        lines.push({ criterion, amount: row.amount, label: UTILITY_CRITERION_LABELS[criterion] })
      }
    }
  } else if (mentioned.length === 1 && total != null) {
    lines = [{ criterion: mentioned[0]!, amount: total, label: UTILITY_CRITERION_LABELS[mentioned[0]!] }]
  } else if (mentioned.length > 1) {
    for (const criterion of mentioned) {
      const group = CRITERION_KEYWORDS.find((c) => c.criterion === criterion)
      const amount = group ? amountNearKeywords(text, group.patterns) : null
      if (amount != null) {
        lines.push({ criterion, amount, label: UTILITY_CRITERION_LABELS[criterion] })
      }
    }
    const sum = lines.reduce((s, l) => s + l.amount, 0)
    if (total != null && lines.length && Math.abs(sum - total) > 1) {
      if (sum < total * 0.5) {
        const primary = mentioned[0]!
        lines = [{ criterion: primary, amount: total, label: UTILITY_CRITERION_LABELS[primary] }]
      }
    } else if (!lines.length && total != null) {
      const primary = mentioned[0]!
      lines = [{ criterion: primary, amount: total, label: UTILITY_CRITERION_LABELS[primary] }]
    } else if (lines.length > 1 && total != null && Math.abs(sum - total) > total * 0.3) {
      const diff = total - sum
      if (Math.abs(diff) > 1) {
        const last = lines[lines.length - 1]!
        last.amount = Math.round((last.amount + diff) * 100) / 100
      }
    }
  } else if (total != null) {
    const fallback = defaultCriterion(text, seller) ?? mentioned[0]
    if (fallback) {
      lines = [{ criterion: fallback, amount: total, label: UTILITY_CRITERION_LABELS[fallback] }]
    }
  }

  lines = mergeLines(lines)
  const tariff = extractTariff(text)
  const sellerLabel = shortSeller(seller, text)
  const finalTotal = total ?? (lines.length ? lines.reduce((s, l) => s + l.amount, 0) : null)
  const confidence: ParsedInvoiceAmount['confidence'] =
    lines.length && finalTotal != null ? 'high' : lines.length ? 'medium' : finalTotal != null ? 'low' : 'none'

  return {
    title: buildTitle(sellerLabel, meta.number, period, lines),
    seller,
    invoiceNumber: meta.number,
    period,
    dueDate: period ? dueFromPeriod(period) : meta.date ? dueFromPeriod(meta.date.period) : null,
    total: finalTotal,
    unitPrice: tariff.unitPrice,
    vatRate: tariff.vatRate,
    lines,
    confidence,
    source: lines.map((l) => `${l.label} ${l.amount}`).join(' · ') || 'Суммы не найдены — укажите вручную',
  }
}

export function applyParsedLines(parsed: ParsedUtilityInvoice) {
  const lines = createEmptyBillLines()
  for (const item of parsed.lines) {
    const row = lines.find((l) => l.criterion === item.criterion)
    if (row) row.amount = item.amount
  }
  return lines
}

export function toParsedAmount(parsed: ParsedUtilityInvoice): ParsedInvoiceAmount {
  return {
    amount: parsed.total,
    confidence: parsed.confidence,
    source: parsed.source,
  }
}
