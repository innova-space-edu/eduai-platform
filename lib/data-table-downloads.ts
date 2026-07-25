export type DataTableColumn = {
  id: string
  label: string
  type: "text" | "number" | "percentage" | "date" | "category" | "boolean"
  unit?: string
}

export type DataTableRow = {
  id: string
  label?: string
  values: string[]
}

export type DataTableData = {
  title?: string
  subtitle?: string
  description?: string
  tableType?: string
  columns?: DataTableColumn[]
  rows?: DataTableRow[]
  insights?: Array<{ title?: string; description?: string; value?: string }>
  notes?: string[]
  [key: string]: unknown
}

function safeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim()
}

export function normalizeDataTable(data: DataTableData) {
  const rawColumns = Array.isArray(data?.columns) ? data.columns : []
  const columns: DataTableColumn[] = rawColumns.slice(0, 12).map((column, index) => ({
    id: safeText(column?.id) || `col-${index + 1}`,
    label: safeText(column?.label) || `Columna ${index + 1}`,
    type: ["text", "number", "percentage", "date", "category", "boolean"].includes(column?.type)
      ? column.type
      : "text",
    unit: safeText(column?.unit) || undefined,
  }))

  const safeColumns = columns.length > 0
    ? columns
    : [
        { id: "col-1", label: "Elemento", type: "text" as const },
        { id: "col-2", label: "Descripción", type: "text" as const },
      ]

  const rawRows = Array.isArray(data?.rows) ? data.rows : []
  const rows: DataTableRow[] = rawRows.slice(0, 60).map((row, index) => {
    const values = Array.isArray(row?.values) ? row.values : []
    return {
      id: safeText(row?.id) || `row-${index + 1}`,
      label: safeText(row?.label) || undefined,
      values: safeColumns.map((_, columnIndex) => safeText(values[columnIndex])),
    }
  })

  return {
    title: safeText(data?.title) || "Tabla de datos",
    subtitle: safeText(data?.subtitle),
    description: safeText(data?.description),
    tableType: safeText(data?.tableType) || "dataset",
    columns: safeColumns,
    rows,
    insights: Array.isArray(data?.insights) ? data.insights.slice(0, 8) : [],
    notes: Array.isArray(data?.notes) ? data.notes.map(safeText).filter(Boolean).slice(0, 10) : [],
  }
}

function toArrayOfArrays(data: DataTableData) {
  const table = normalizeDataTable(data)
  const header = table.columns.map((column) => column.unit ? `${column.label} (${column.unit})` : column.label)
  const rows = table.rows.map((row) => table.columns.map((_, index) => row.values[index] || ""))
  return { table, values: [header, ...rows] }
}

export async function downloadDataTableAsXLSX(data: DataTableData, fileName: string) {
  const XLSX = await import("xlsx")
  const { table, values } = toArrayOfArrays(data)
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.aoa_to_sheet(values)

  worksheet["!cols"] = table.columns.map((column, columnIndex) => {
    const maxLength = Math.max(
      column.label.length,
      ...table.rows.map((row) => String(row.values[columnIndex] || "").length),
    )
    return { wch: Math.min(50, Math.max(12, maxLength + 2)) }
  })
  worksheet["!freeze"] = { xSplit: 0, ySplit: 1 }
  worksheet["!autofilter"] = values.length > 1
    ? { ref: `A1:${XLSX.utils.encode_col(Math.max(0, table.columns.length - 1))}${values.length}` }
    : undefined

  XLSX.utils.book_append_sheet(workbook, worksheet, "Tabla")

  if (table.insights.length > 0 || table.notes.length > 0) {
    const summaryRows: string[][] = [
      ["Título", table.title],
      ["Descripción", table.description],
      [],
      ["Hallazgos"],
      ...table.insights.map((item) => [safeText(item?.title), safeText(item?.value), safeText(item?.description)]),
      [],
      ["Notas"],
      ...table.notes.map((note) => [note]),
    ]
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows)
    summarySheet["!cols"] = [{ wch: 28 }, { wch: 22 }, { wch: 70 }]
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumen")
  }

  XLSX.writeFile(workbook, `${fileName}.xlsx`, { compression: true })
}

export function downloadDataTableAsCSV(data: DataTableData, fileName: string) {
  const { values } = toArrayOfArrays(data)
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`
  const csv = `\uFEFF${values.map((row) => row.map(escape).join(",")).join("\r\n")}`
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${fileName}.csv`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}
