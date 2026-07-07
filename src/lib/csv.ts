export type CsvValue = string | number | boolean | null | undefined

function escapeCsvValue(value: CsvValue): string {
  const s = value === null || value === undefined ? "" : String(value)
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
