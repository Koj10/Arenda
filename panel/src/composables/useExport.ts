import * as XLSX from 'xlsx'
import type { ExportColumn } from '@/types/portfolio'

export function useExport() {
  function exportReport(rows: Record<string, string | number>[], columns: ExportColumn[], filename: string) {
    const selected = columns.filter((c) => c.selected)
    const data = rows.map((row) => {
      const obj: Record<string, string | number> = {}
      selected.forEach((col) => {
        obj[col.label] = row[col.key] ?? ''
      })
      return obj
    })

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Отчёт')
    XLSX.writeFile(wb, `${filename}.xlsx`)
  }

  return { exportReport }
}
