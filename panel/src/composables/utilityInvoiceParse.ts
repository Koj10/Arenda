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
  { re: /\bмэк\b|межрегионал[\s\S]{0,30}распред/i, criterion: 'electricity', short: 'МЭК' },
  { re: /россети|сетев[\s\S]{0,10}компан/i, criterion: 'electricity', short: 'Россети' },
  { re: /газпром|межрегионгаз/i, criterion: 'gas', short: 'Газпром' },
  { re: /жилищник|\bжэк\b|\bук\b|управл[\s\S]{0,10}дом|тсж| homeowners/i, criterion: 'management', short: 'УК / ТСЖ' },
]

export function parseRuNumber(raw: string): number | null {
  if (!raw) return null
  const cleaned = String(raw)
    .replace(/\u00a0/g, ' ')
    .replace(/\s/g, '')
  if (!cleaned) return null
  let normalized = cleaned
  const hasComma = cleaned.includes(',')
  const hasDot = cleaned.includes('.')
  if (hasComma && hasDot) {
    const commaPos = cleaned.lastIndexOf(',')
    const dotPos = cleaned.lastIndexOf('.')
    if (commaPos > dotPos) {
      normalized = cleaned.replace(/\./g, '').replace(',', '.')
    } else {
      normalized = cleaned.replace(/,/g, '')
    }
  } else if (hasComma) {
    normalized = cleaned.replace(',', '.')
  } else if (hasDot) {
    const lastDot = cleaned.lastIndexOf('.')
    const afterDot = cleaned.length - lastDot - 1
    const dots = [...cleaned].filter((c) => c === '.').length
    if (dots === 1 && (afterDot === 3 && !/^\d{1,3}$/.test(cleaned.slice(0, lastDot)) || afterDot !== 3 || afterDot >= 4)) {
      normalized = cleaned
    } else if (dots > 1) {
      normalized = cleaned.slice(0, lastDot).replace(/\./g, '') + '.' + cleaned.slice(lastDot + 1)
    }
  }
  const value = Number.parseFloat(normalized)
  if (!Number.isFinite(value) || value <= 0 || value > 99_999_999) return null
  return Math.round(value * 100000) / 100000
}

function collectMoney(text: string): number[] {
  const patterns: RegExp[] = [
    /(\d{1,3}(?:[\s\u00a0]\d{3})+|\d+)[.,]\d{2}(?!\d)/g,
    /(\d{1,3}(?:[\s\u00a0]\d{3})+|\d+)[.,]\d{3,5}(?!\d)/g,
    /(\d+)\s*(?:руб(?:\.|ля)?|₽|коп(?:\.|ейки)?)/gi,
  ]
  const out: number[] = []
  const seen = new Set<number>()
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const raw = m[1] ?? m[0]
      const n = parseRuNumber(raw)
      if (n != null) {
        const key = Math.round(n * 100)
        if (!seen.has(key)) {
          seen.add(key)
          out.push(n)
        }
      }
    }
  }
  return out
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
  let t = text
    .replace(/\u00a0/g, ' ')
    .replace(/ё/gi, 'е')
    .replace(/\r/g, '')
  t = t
    .replace(/\n[\s\u00a0]*\n/g, '\n\n')
    .replace(/\n/g, ' ')
    .replace(/[ \t]+/g, ' ')
  t = t
    .replace(/Ц\s*е\s*н\s*а/gi, 'Цена')
    .replace(/Т\s*а\s*р\s*и\s*ф/gi, 'тариф')
    .replace(/з\s*а\s*е\s*д\s*и\s*н\s*и\s*ц/gi, 'за единиц')
    .replace(/и\s*з\s*м\s*е\s*р\s*е\s*н/gi, 'измерен')
    .replace(/С\s*т\s*о\s*и\s*м\s*о\s*с\s*т\s*ь/gi, 'Стоимость')
    .replace(/т\s*о\s*в\s*а\s*р\s*о\s*в/gi, 'товаров')
    .replace(/у\s*с\s*л\s*у\s*г/gi, 'услуг')
    .replace(/н\s*а\s*л\s*о\s*г/gi, 'налог')
    .replace(/в\s*с\s*е\s*г\s*о/gi, 'всего')
    .replace(/М\s*Э\s*К/gi, 'МЭК')
  return t
}

function mentionedCriteria(text: string): UtilityCriterion[] {
  const found: UtilityCriterion[] = []
  for (const { criterion, patterns } of CRITERION_KEYWORDS) {
    if (patterns.some((re) => re.test(text))) found.push(criterion)
  }
  return found
}

function extractTariff(text: string): { unitPrice: number | null; vatRate: number } {
  const has20 = /20\s*%/.test(text) || /стоимость.*(?:товар|работ|услуг|имуществ).*налог.*всего/i.test(text)
  const has22 = /22\s*%/.test(text)
  const vatRate = has20 ? 0.20 : has22 ? 0.22 : VAT_RATE
  const candidates: number[] = []

  const unitPriceHeaderRe =
    /(?:Цена\s*\(тариф\)\s*за\s*единиц\s*у?\s*измерен|Цена\s+за\s+единиц|тариф\s+за\s+единиц|Ставка\s+за\s+единиц)[\s\S]{0,300}?/gi
  for (const headerMatch of text.matchAll(unitPriceHeaderRe)) {
    const startIdx = (headerMatch.index ?? 0) + headerMatch[0]!.length
    const tail = text.slice(startIdx, startIdx + 1500)
    const priceMatches = [
      ...tail.matchAll(/(\d{1,3}(?:\s\d{3})*[.,]\d{2,5}|\d+[.,]\d{2,5})/g),
    ]
    for (const pm of priceMatches) {
      const p = parseRuNumber(pm[1]!)
      if (p && p > 0.0001 && p < 100000) candidates.push(p)
    }
  }

  const triplePatterns = [
    /([\d\s]+[.,]\d+)\s+[×xх*]\s+([\d\s]+[.,]\d+)\s*[=:]\s*([\d\s]+[.,]\d{2})/gi,
    /([\d\s]+[.,]\d+)\s+([\d\s]+[.,]\d+)\s+([\d\s]+[.,]\d{2})\s+Без акциза/gi,
    /([\d\s]+[.,]\d+)\s+([\d\s]+[.,]\d+)\s+([\d\s]+[.,]\d{2})(?:\s|$)/g,
    /(\d[\d\s]*[.,]\d+)\s{1,5}(\d[\d\s]*[.,]\d+)\s{1,5}(\d[\d\s]*[.,]\d{2,5})/g,
  ]
  for (const re of triplePatterns) {
    for (const m of text.matchAll(re)) {
      const qty = parseRuNumber(m[1]!)
      const price = parseRuNumber(m[2]!)
      const net = parseRuNumber(m[3]!)
      if (qty && price && net && qty > 0 && price > 0 && net > 0) {
        const ratio = qty * price / net
        if (ratio > 0.85 && ratio < 1.25) {
          candidates.push(price)
        }
      }
    }
  }

  const tariffKeywordPatterns = [
    /(?:тариф|ставка|цена\s+за\s+единиц|цена\s+за\s+1|стоимость\s+единиц)[\s\S]{0,80}?(\d[\d\s]*[.,]\d{2,5})/gi,
    /(?:тариф|ставка|цена)[^\d]{0,30}(\d[\d\s]*[.,]\d{2,5})/gi,
    /(\d[\d\s]*[.,]\d{2,5})[\s\S]{0,30}?(?:руб\.?|коп\.?|₽)\s*(?:за|в|на)?[\s\S]{0,30}?(?:кВт|квт|м3|м³|Гкал|куб|единиц|штук)/gi,
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
    /(\d[\d\s]*[.,]\d{2,5})\s*(?:руб\.?|₽)?\s*(?:за|в|на)\s*(?:1\s*)?(?:кВт|квт·ч|кВтч|квт|м3|м³|Гкал|куб\.?\s*м|кубометр|единиц)/gi,
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
        if (price > 0.0001 && price < 100000) {
          candidates.push(Math.round(price * 100000) / 100000)
        }
      }
    }
  }

  const qtyMatch = text.match(/([\d\s]+[.,]\d+|\d+)\s*(?:кВт|квт|м3|м³|Гкал)/i)
  const netMatch = text.match(/([\d\s]+[.,]\d{2})\s+Без акциза/i)
  if (qtyMatch && netMatch) {
    const qty = parseRuNumber(qtyMatch[1]!) ?? Number(qtyMatch[1]!)
    const net = parseRuNumber(netMatch[1]!)
    if (qty && net) candidates.push(Math.round((net / qty) * 100000) / 100000)
  }

  const precisionPrices = collectMoney(text).filter((n) => {
    const str = n.toFixed(5)
    return /\.\d{3,5}/.test(str) || (n > 0 && n < 1000 && !Number.isInteger(n))
  })
  for (const p of precisionPrices) candidates.push(p)

  if (candidates.length) {
    const filtered = candidates.filter((c) => c > 0.0001 && c < 100000)
    if (filtered.length) {
      filtered.sort((a, b) => {
        const ca = candidates.filter((x) => Math.abs(x - a) / (a || 1) < 0.1).length
        const cb = candidates.filter((x) => Math.abs(x - b) / (b || 1) < 0.1).length
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
    /стоимость[\s\S]{0,40}(?:товар|работ|услуг|имуществ)[\s\S]{0,40}(?:с\s*налог|без\s*налог|ндс)[\s\S]{0,40}всего[\s\S]{0,80}?(\d{1,3}(?:\s\d{3})*[.,]\d{2}|\d+[.,]\d{2})/gi,
    /(?:стоимость|сумма)[\s\S]{0,60}(?:всего|итого)[\s\S]{0,60}?(\d{1,3}(?:\s\d{3})*[.,]\d{2}|\d+[.,]\d{2})/gi,
    /в том числе[\s\S]{0,20}ндс[\s\S]{0,60}?(\d{1,3}(?:\s\d{3})*[.,]\d{2}|\d+[.,]\d{2})/gi,
  ]
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const chunk = (m[1] ?? '') as string
      const fallback = lastMoney(text.slice(m.index ?? 0, (m.index ?? 0) + 200))
      const amount = parseRuNumber(chunk) ?? fallback
      if (amount == null) continue
      const start = Math.max(0, (m.index ?? 0) - 900)
      results.push({ amount, before: text.slice(start, m.index) })
    }
  }

  const sfHeader = /стоимость\s*\(?\s*товар|работ\s*,\s*услуг\s*\)|имущественн(?:ых)?\s*прав(?:\s*с\s*налогом)?\s*-\s*всего/i
  if (sfHeader.test(text)) {
    const idx = text.search(sfHeader)
    const tail = text.slice(idx, idx + 4000)
    const tailMoneys = collectMoney(tail).sort((a, b) => b - a)
    for (const big of tailMoneys.slice(0, 3)) {
      if (!results.some((r) => Math.abs(r.amount - big) < 0.009)) {
        results.push({ amount: big, before: text.slice(Math.max(0, idx - 900), idx) })
      }
    }
  }

  const lastLines = text.split(/\n+/).slice(-30).join('\n')
  const finalMoney = collectMoney(lastLines).sort((a, b) => b - a)
  for (const big of finalMoney.slice(0, 3)) {
    if (!results.some((r) => Math.abs(r.amount - big) < 0.009)) {
      const idx = text.lastIndexOf(String(Math.floor(big)))
      results.push({ amount: big, before: text.slice(Math.max(0, idx - 900), idx) })
    }
  }

  const allMoneySorted = collectMoney(text).sort((a, b) => b - a)
  for (const big of allMoneySorted.slice(0, 2)) {
    if (!results.some((r) => Math.abs(r.amount - big) < 0.009)) {
      const idx = text.search(new RegExp(String(Math.floor(big)).replace(/\D/g, '')))
      results.push({ amount: big, before: text.slice(Math.max(0, idx - 900), idx) })
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
