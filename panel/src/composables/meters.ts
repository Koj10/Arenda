import type { MeterReadingOut } from '@/api/types'

export function meterKey(unitId: number, criterion: string) {
  return `${unitId}:${criterion}`
}

export function shiftPeriod(period: string, months: number): string | null {
  const [year, month] = period.split('-').map(Number)
  if (!year || !month) return null
  const date = new Date(Date.UTC(year, month - 1, 1))
  date.setUTCMonth(date.getUTCMonth() + months)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function formatMeterValue(value: string | number | null | undefined): string {
  if (value == null || value === '') return ''
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
  if (!Number.isFinite(n)) return ''
  return String(n)
}

export interface MeterDraftsResult {
  drafts: Record<string, { previous: string; current: string }>
  meta: Record<string, string>
  carried: Record<string, boolean>
}

export function buildMeterDrafts(
  currentReadings: MeterReadingOut[],
  previousReadings: MeterReadingOut[],
): MeterDraftsResult {
  const prevByKey = new Map<string, MeterReadingOut>()
  for (const row of previousReadings) {
    prevByKey.set(meterKey(row.unit_id, row.criterion), row)
  }

  const drafts: MeterDraftsResult['drafts'] = {}
  const meta: Record<string, string> = {}
  const carried: Record<string, boolean> = {}
  const seen = new Set<string>()

  for (const row of currentReadings) {
    const key = meterKey(row.unit_id, row.criterion)
    seen.add(key)
    drafts[key] = {
      previous: formatMeterValue(row.previous_value),
      current: formatMeterValue(row.current_value),
    }
    if (row.submitted_by_role) meta[key] = row.submitted_by_role
  }

  for (const [key, prev] of prevByKey) {
    if (seen.has(key)) continue
    const lastCurrent = formatMeterValue(prev.current_value)
    if (lastCurrent === '') continue
    drafts[key] = { previous: lastCurrent, current: '' }
    carried[key] = true
  }

  return { drafts, meta, carried }
}

export function isMeterLockedForTenant(submittedByRole?: string | null) {
  return submittedByRole === 'landlord'
}
