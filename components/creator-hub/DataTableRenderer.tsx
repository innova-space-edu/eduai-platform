"use client"

import { useEffect, useMemo, useState } from "react"
import { Download, FileSpreadsheet, Image, Pencil, Plus, Save, Search, Trash2 } from "lucide-react"
import { downloadRenderedAsImage } from "@/lib/creator-downloads"
import {
  downloadDataTableAsCSV,
  downloadDataTableAsXLSX,
  normalizeDataTable,
  type DataTableColumn,
  type DataTableData,
  type DataTableRow,
} from "@/lib/data-table-downloads"

const COLUMN_TYPES: Array<{ value: DataTableColumn["type"]; label: string }> = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "percentage", label: "Porcentaje" },
  { value: "date", label: "Fecha" },
  { value: "category", label: "Categoría" },
  { value: "boolean", label: "Sí / No" },
]

function safeFileName(value: string) {
  return (value || "tabla-eduai")
    .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 60) || "tabla-eduai"
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export default function DataTableRenderer({ data }: { data: DataTableData }) {
  const initial = useMemo(() => normalizeDataTable(data), [data])
  const [title, setTitle] = useState(initial.title)
  const [description, setDescription] = useState(initial.description)
  const [columns, setColumns] = useState<DataTableColumn[]>(initial.columns)
  const [rows, setRows] = useState<DataTableRow[]>(initial.rows)
  const [editing, setEditing] = useState(true)
  const [search, setSearch] = useState("")
  const [exporting, setExporting] = useState<string | null>(null)

  useEffect(() => {
    if (!data || typeof data !== "object") return
    data.title = title
    data.description = description
    data.columns = columns
    data.rows = rows
  }, [columns, data, description, rows, title])

  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es")
    if (!query) return rows
    return rows.filter((row) => row.values.some((value) => String(value).toLocaleLowerCase("es").includes(query)))
  }, [rows, search])

  const currentData: DataTableData = {
    ...data,
    title,
    description,
    columns,
    rows,
  }

  const updateColumn = (index: number, patch: Partial<DataTableColumn>) => {
    setColumns((current) => current.map((column, columnIndex) => columnIndex === index ? { ...column, ...patch } : column))
  }

  const addColumn = () => {
    if (columns.length >= 12) return
    const nextColumn: DataTableColumn = {
      id: makeId("col"),
      label: `Columna ${columns.length + 1}`,
      type: "text",
    }
    setColumns((current) => [...current, nextColumn])
    setRows((current) => current.map((row) => ({ ...row, values: [...row.values, ""] })))
  }

  const removeColumn = (index: number) => {
    if (columns.length <= 1) return
    setColumns((current) => current.filter((_, columnIndex) => columnIndex !== index))
    setRows((current) => current.map((row) => ({
      ...row,
      values: row.values.filter((_, columnIndex) => columnIndex !== index),
    })))
  }

  const addRow = () => {
    if (rows.length >= 60) return
    setRows((current) => [
      ...current,
      { id: makeId("row"), values: columns.map(() => "") },
    ])
  }

  const removeRow = (rowId: string) => {
    setRows((current) => current.filter((row) => row.id !== rowId))
  }

  const updateCell = (rowId: string, columnIndex: number, value: string) => {
    setRows((current) => current.map((row) => {
      if (row.id !== rowId) return row
      const values = [...row.values]
      values[columnIndex] = value
      return { ...row, values }
    }))
  }

  const runExport = async (kind: "xlsx" | "csv" | "png") => {
    const fileName = safeFileName(title)
    setExporting(kind)
    try {
      if (kind === "xlsx") await downloadDataTableAsXLSX(currentData, fileName)
      if (kind === "csv") downloadDataTableAsCSV(currentData, fileName)
      if (kind === "png") await downloadRenderedAsImage("creator-data-table-canvas", fileName, "png")
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing((value) => !value)}
            className="inline-flex items-center gap-2 rounded-xl border border-soft bg-card-soft-theme px-3 py-2 text-xs font-bold text-sub transition hover:text-main"
          >
            {editing ? <Save size={14} /> : <Pencil size={14} />}
            {editing ? "Finalizar edición" : "Editar tabla"}
          </button>
          <span className="rounded-full border border-soft bg-card-soft-theme px-3 py-1.5 text-[10px] font-bold text-muted2">
            {rows.length} filas · {columns.length} columnas
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => runExport("xlsx")} disabled={exporting !== null} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-xs font-bold text-emerald-600 disabled:opacity-40">
            <FileSpreadsheet size={14} /> {exporting === "xlsx" ? "Generando..." : "Excel"}
          </button>
          <button type="button" onClick={() => runExport("csv")} disabled={exporting !== null} className="inline-flex items-center gap-1.5 rounded-xl border border-blue-500/25 bg-blue-500/5 px-3 py-2 text-xs font-bold text-blue-600 disabled:opacity-40">
            <Download size={14} /> {exporting === "csv" ? "Generando..." : "CSV"}
          </button>
          <button type="button" onClick={() => runExport("png")} disabled={exporting !== null} className="inline-flex items-center gap-1.5 rounded-xl border border-violet-500/25 bg-violet-500/5 px-3 py-2 text-xs font-bold text-violet-600 disabled:opacity-40">
            <Image size={14} /> {exporting === "png" ? "Generando..." : "PNG"}
          </button>
        </div>
      </div>

      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted2" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar dentro de la tabla..."
          className="w-full rounded-xl border border-soft bg-card-soft-theme py-2.5 pl-9 pr-3 text-xs text-main outline-none placeholder:text-muted2 focus:border-blue-500/30"
        />
      </div>

      <article id="creator-data-table-canvas" className="overflow-hidden rounded-3xl border border-soft bg-card-theme">
        <header className="border-b border-soft bg-gradient-to-br from-blue-500/10 via-violet-500/5 to-transparent p-5 sm:p-6">
          {editing ? (
            <div className="space-y-2">
              <input value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-xl border border-soft bg-card-theme px-3 py-2 text-xl font-black text-main outline-none" />
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} placeholder="Descripción de la tabla" className="w-full resize-none rounded-xl border border-soft bg-card-theme px-3 py-2 text-xs leading-5 text-sub outline-none" />
            </div>
          ) : (
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-500">Tabla editable EduAI</p>
              <h1 className="mt-2 text-2xl font-black text-main">{title}</h1>
              {description && <p className="mt-2 max-w-4xl text-sm leading-6 text-sub">{description}</p>}
            </div>
          )}
        </header>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-soft bg-card-soft-theme">
                {columns.map((column, columnIndex) => (
                  <th key={column.id} className="min-w-[150px] border-r border-soft p-3 align-top last:border-r-0">
                    {editing ? (
                      <div className="space-y-2">
                        <input value={column.label} onChange={(event) => updateColumn(columnIndex, { label: event.target.value })} className="w-full rounded-lg border border-soft bg-card-theme px-2.5 py-2 text-xs font-black text-main outline-none" />
                        <div className="flex gap-1.5">
                          <select value={column.type} onChange={(event) => updateColumn(columnIndex, { type: event.target.value as DataTableColumn["type"] })} className="min-w-0 flex-1 rounded-lg border border-soft bg-card-theme px-2 py-1.5 text-[10px] text-sub outline-none">
                            {COLUMN_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                          </select>
                          <button type="button" onClick={() => removeColumn(columnIndex)} disabled={columns.length <= 1} className="rounded-lg border border-red-500/20 p-1.5 text-red-500 disabled:opacity-25" title="Eliminar columna"><Trash2 size={12} /></button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <span className="text-xs font-black text-main">{column.label}</span>
                        <span className="mt-1 block text-[9px] font-bold uppercase tracking-wider text-muted2">{COLUMN_TYPES.find((item) => item.value === column.type)?.label || "Texto"}{column.unit ? ` · ${column.unit}` : ""}</span>
                      </div>
                    )}
                  </th>
                ))}
                {editing && <th className="w-12 p-2"><button type="button" onClick={addColumn} disabled={columns.length >= 12} className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-500/20 text-blue-500 disabled:opacity-25" title="Agregar columna"><Plus size={14} /></button></th>}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, visibleIndex) => (
                <tr key={row.id} className={`border-b border-soft/70 last:border-b-0 ${visibleIndex % 2 === 0 ? "bg-card-theme" : "bg-card-soft-theme/40"}`}>
                  {columns.map((column, columnIndex) => (
                    <td key={`${row.id}-${column.id}`} className="border-r border-soft/70 p-3 text-xs leading-5 text-sub last:border-r-0">
                      {editing ? (
                        <input
                          value={row.values[columnIndex] || ""}
                          onChange={(event) => updateCell(row.id, columnIndex, event.target.value)}
                          inputMode={column.type === "number" || column.type === "percentage" ? "decimal" : undefined}
                          className="w-full rounded-lg border border-soft bg-card-theme px-2.5 py-2 text-xs text-main outline-none focus:border-blue-500/30"
                        />
                      ) : (
                        <span className={column.type === "number" || column.type === "percentage" ? "font-bold tabular-nums text-main" : ""}>{row.values[columnIndex] || "—"}</span>
                      )}
                    </td>
                  ))}
                  {editing && <td className="w-12 p-2 text-center"><button type="button" onClick={() => removeRow(row.id)} className="rounded-lg p-2 text-red-500 transition hover:bg-red-500/10" title="Eliminar fila"><Trash2 size={13} /></button></td>}
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr><td colSpan={columns.length + (editing ? 1 : 0)} className="p-10 text-center text-sm text-muted2">No hay filas que coincidan con la búsqueda.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {editing && (
          <div className="border-t border-soft p-3">
            <button type="button" onClick={addRow} disabled={rows.length >= 60} className="inline-flex items-center gap-2 rounded-xl border border-dashed border-blue-500/30 px-3 py-2 text-xs font-bold text-blue-500 disabled:opacity-30"><Plus size={14} /> Agregar fila</button>
          </div>
        )}

        {initial.insights.length > 0 && (
          <section className="grid gap-3 border-t border-soft bg-card-soft-theme/50 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {initial.insights.map((insight, index) => (
              <div key={`${insight.title}-${index}`} className="rounded-2xl border border-soft bg-card-theme p-4">
                {insight.value && <p className="text-xl font-black text-blue-500">{insight.value}</p>}
                <h2 className="mt-1 text-xs font-black text-main">{insight.title || `Hallazgo ${index + 1}`}</h2>
                {insight.description && <p className="mt-1.5 text-[11px] leading-5 text-muted2">{insight.description}</p>}
              </div>
            ))}
          </section>
        )}

        {initial.notes.length > 0 && (
          <footer className="border-t border-soft p-4 text-[10px] leading-5 text-muted2">
            <strong className="text-sub">Notas:</strong> {initial.notes.join(" · ")}
          </footer>
        )}
      </article>
    </div>
  )
}
