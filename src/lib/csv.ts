export type CsvValue = string | number | boolean | null | undefined

// Excel, Sheets and Numbers treat a leading =, +, - or @ as the start of a
// formula, so a roster name synced from Clerk could execute on open. Prefixing
// with an apostrophe forces the cell to text.
//
// Genuine numbers are left alone — "-3.5" is data, not a formula — so negative
// numeric columns keep sorting and summing correctly in the spreadsheet.
const FORMULA_PREFIX = /^[=+\-@\t\r]/

function neutralizeFormula(s: string): string {
  if (!FORMULA_PREFIX.test(s)) return s
  if (s.trim() !== "" && Number.isFinite(Number(s))) return s
  return `'${s}`
}

function escapeCsvValue(value: CsvValue): string {
  if (value === null || value === undefined) return ""
  const s = typeof value === "string" ? neutralizeFormula(value) : String(value)
  if (!/[",\n\r]/.test(s)) return s
  return `"${s.replaceAll('"', '""')}"`
}

export function csvFromRows(rows: CsvValue[][]): string {
  return rows.map((row) => row.map(escapeCsvValue).join(",")).join("\r\n")
}

export function downloadCsv(filename: string, rows: CsvValue[][]) {
  const blob = new Blob([csvFromRows(rows)], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
