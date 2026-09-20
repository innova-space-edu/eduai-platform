"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { exportPlanningPdf } from "@/lib/planning-pdf"
import { exportParvulariaPlanningPdf } from "@/lib/parvularia-planning-pdf"
import { parseParvulariaPlanningDocument } from "@/lib/parvularia-planning"

type SavedPlanning = {
  id: string
  user_id: string
  title: string
  nivel: string | null
  curso: string | null
  asignatura: string | null
  contexto: string | null
  mes: string | null
  unidad_id: string | null
  selected_oa_ids: string[] | null
  selected_oat_ids: string[] | null
  tiempo_planificacion: string | null
  sesiones: number | null
  duracion_minutos: number | null
  content: string | null
  course: string | null
  subject: string | null
  unit: string | null
  planning_text: string | null
  planning_json: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

function formatDate(date: string) {
  return new Date(date).toLocaleString("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function normalizePlanning(item: SavedPlanning): SavedPlanning {
  return {
    ...item,
    curso: item.curso || item.course || null,
    asignatura: item.asignatura || item.subject || null,
    unidad_id: item.unidad_id || item.unit || null,
    content: item.content || item.planning_text || "",
  }
}

function stripMarkdownPreview(text: string, max = 250) {
  const cleaned = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[.*?\]\(.*?\)/g, " ")
    .replace(/\[([^\]]+)\]\((.*?)\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\|/g, " ")
    .replace(/---+/g, " ")
    .replace(/[*_>#~]/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()

  if (!cleaned) return "Sin vista previa disponible."
  return cleaned.length > max ? `${cleaned.slice(0, max).trim()}…` : cleaned
}

function getParvulariaDocument(item: SavedPlanning) {
  if (item.nivel !== "parvularia" || !item.content) return null
  try {
    return parseParvulariaPlanningDocument(item.content)
  } catch {
    return null
  }
}

function getPlanningStats(item: SavedPlanning) {
  const parv = getParvulariaDocument(item)
  if (item.nivel === "parvularia") {
    return [
      { label: "Nivel", value: "Parvularia", tone: "emerald" },
      { label: "Horizonte", value: item.tiempo_planificacion || parv?.horizonte || "—", tone: "sky" },
      { label: "Período", value: parv?.fechas || "—", tone: "violet" },
      { label: "Formato", value: "BCEP institucional", tone: "amber" },
    ]
  }
  return [
    { label: "Nivel", value: item.nivel || "—", tone: "emerald" },
    { label: "Horizonte", value: item.tiempo_planificacion || "—", tone: "sky" },
    { label: "Sesiones", value: String(item.sesiones || 1), tone: "violet" },
    { label: "Duración", value: `${item.duracion_minutos || 45} min`, tone: "amber" },
  ]
}

function planningPreview(item: SavedPlanning) {
  const parv = getParvulariaDocument(item)
  if (parv) {
    return [parv.objetivoAprendizaje, parv.focoExperiencia, parv.filas[0]?.experienciaAprendizaje]
      .filter(Boolean)
      .join(" · ")
      .replace(/\s+/g, " ")
      .slice(0, 360)
  }
  return stripMarkdownPreview(item.content || "")
}

function badgeClass(tone: string) {
  switch (tone) {
    case "emerald":
      return "border-emerald-200 bg-emerald-50 text-emerald-800"
    case "sky":
      return "border-sky-200 bg-sky-50 text-sky-800"
    case "violet":
      return "border-violet-200 bg-violet-50 text-violet-800"
    case "amber":
      return "border-amber-200 bg-amber-50 text-amber-800"
    default:
      return "border-slate-200 bg-slate-50 text-slate-700"
  }
}

function compactTitle(item: SavedPlanning) {
  const course = item.curso || item.course || "Curso"
  const subject = item.asignatura || item.subject || "Asignatura"
  const date = new Date(item.created_at).toLocaleDateString("es-CL")
  return `Planificación ${course} · ${subject} · ${date}`
}


type PlanningAreaFolder = {
  key: string
  label: string
  kind: "Ámbito" | "Asignatura"
  items: SavedPlanning[]
}

type PlanningDateFolder = {
  key: string
  label: string
  sortValue: number
  areas: PlanningAreaFolder[]
}

type PlanningMonthFolder = {
  key: string
  label: string
  sortValue: number
  dates: PlanningDateFolder[]
}

type PlanningYearFolder = {
  key: string
  label: string
  sortValue: number
  months: PlanningMonthFolder[]
}

function capitalize(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value
}

function safePlanningDate(value?: string | null) {
  if (!value) return null
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

function getPlanningReferenceDate(item: SavedPlanning) {
  const saved = item.planning_json || {}
  const organization =
    saved.folder_organization && typeof saved.folder_organization === "object"
      ? saved.folder_organization as Record<string, unknown>
      : null

  const candidates = [
    typeof organization?.date === "string" ? organization.date : "",
    typeof saved.fechaInicioParvularia === "string" ? saved.fechaInicioParvularia : "",
    typeof saved.fechaPlanificacion === "string" ? saved.fechaPlanificacion : "",
    typeof saved.fecha === "string" ? saved.fecha : "",
    item.created_at,
  ]

  for (const candidate of candidates) {
    const date = safePlanningDate(candidate)
    if (date) return date
  }

  return new Date()
}

function getPlanningFolderPath(item: SavedPlanning) {
  const saved = item.planning_json || {}
  const organization =
    saved.folder_organization && typeof saved.folder_organization === "object"
      ? saved.folder_organization as Record<string, unknown>
      : null
  const date = getPlanningReferenceDate(item)
  const year = String(
    typeof organization?.year === "number" || typeof organization?.year === "string"
      ? organization.year
      : date.getFullYear()
  )
  const monthNumber = date.getMonth() + 1
  const monthLabel =
    typeof organization?.month_label === "string" && organization.month_label.trim()
      ? capitalize(organization.month_label.trim())
      : capitalize(date.toLocaleDateString("es-CL", { month: "long" }))
  const dateKey =
    typeof organization?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(organization.date)
      ? organization.date
      : `${date.getFullYear()}-${String(monthNumber).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
  const area =
    (typeof organization?.area === "string" && organization.area.trim())
      ? organization.area.trim()
      : (item.asignatura || item.subject || (item.nivel === "parvularia" ? "Ámbito sin nombre" : "Sin asignatura"))
  const kind: "Ámbito" | "Asignatura" =
    organization?.area_kind === "ambito" || item.nivel === "parvularia" ? "Ámbito" : "Asignatura"

  return {
    year,
    yearNumber: Number(year) || date.getFullYear(),
    monthKey: `${year}-${String(monthNumber).padStart(2, "0")}`,
    monthLabel,
    monthNumber,
    dateKey,
    dateLabel: capitalize(date.toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" })),
    dateSortValue: date.getTime(),
    area,
    kind,
  }
}

function buildPlanningTree(items: SavedPlanning[]): PlanningYearFolder[] {
  const years = new Map<string, {
    key: string
    label: string
    sortValue: number
    months: Map<string, {
      key: string
      label: string
      sortValue: number
      dates: Map<string, {
        key: string
        label: string
        sortValue: number
        areas: Map<string, PlanningAreaFolder>
      }>
    }>
  }>()

  for (const item of items) {
    const path = getPlanningFolderPath(item)
    const year = years.get(path.year) || {
      key: path.year,
      label: path.year,
      sortValue: path.yearNumber,
      months: new Map(),
    }
    years.set(path.year, year)

    const month = year.months.get(path.monthKey) || {
      key: path.monthKey,
      label: path.monthLabel,
      sortValue: path.monthNumber,
      dates: new Map(),
    }
    year.months.set(path.monthKey, month)

    const date = month.dates.get(path.dateKey) || {
      key: path.dateKey,
      label: path.dateLabel,
      sortValue: path.dateSortValue,
      areas: new Map(),
    }
    month.dates.set(path.dateKey, date)

    const areaKey = `${path.kind}:${path.area.toLocaleLowerCase("es-CL")}`
    const area = date.areas.get(areaKey) || {
      key: areaKey,
      label: path.area,
      kind: path.kind,
      items: [],
    }
    area.items.push(item)
    date.areas.set(areaKey, area)
  }

  return Array.from(years.values())
    .sort((a, b) => b.sortValue - a.sortValue)
    .map((year) => ({
      key: year.key,
      label: year.label,
      sortValue: year.sortValue,
      months: Array.from(year.months.values())
        .sort((a, b) => b.sortValue - a.sortValue)
        .map((month) => ({
          key: month.key,
          label: month.label,
          sortValue: month.sortValue,
          dates: Array.from(month.dates.values())
            .sort((a, b) => b.sortValue - a.sortValue)
            .map((date) => ({
              key: date.key,
              label: date.label,
              sortValue: date.sortValue,
              areas: Array.from(date.areas.values())
                .sort((a, b) => a.label.localeCompare(b.label, "es-CL"))
                .map((area) => ({
                  ...area,
                  items: [...area.items].sort(
                    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
                  ),
                })),
            })),
        })),
    }))
}

function countFolderItems(folder: PlanningYearFolder | PlanningMonthFolder | PlanningDateFolder) {
  if ("months" in folder) {
    return folder.months.reduce((total, month) => total + countFolderItems(month), 0)
  }
  if ("dates" in folder) {
    return folder.dates.reduce((total, date) => total + countFolderItems(date), 0)
  }
  return folder.areas.reduce((total, area) => total + area.items.length, 0)
}

export default function SavedPlanningsPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [items, setItems] = useState<SavedPlanning[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [exportingId, setExportingId] = useState<string | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError("")

      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) {
        router.replace("/login?next=/educador/planificaciones")
        return
      }

      const { data, error } = await supabase
        .from("saved_plannings")
        .select("*")
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: false })

      if (!active) return

      if (error) {
        console.error("Error cargando planificaciones:", error)
        setError(error.message)
      } else {
        const normalized = ((data || []) as SavedPlanning[]).map(normalizePlanning)
        setItems(normalized)
      }

      setLoading(false)
    }

    load()

    return () => {
      active = false
    }
  }, [router, supabase])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items

    return items.filter((item) =>
      [item.title, item.curso, item.asignatura, item.nivel, item.contexto, item.content, item.mes]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    )
  }, [items, query])

  const folderTree = useMemo(() => buildPlanningTree(filtered), [filtered])

  useEffect(() => {
    if (!items.length) return
    const path = getPlanningFolderPath(items[0])
    setExpandedFolders((current) => {
      if (current.size) return current
      return new Set([
        `year:${path.year}`,
        `month:${path.year}:${path.monthKey}`,
        `date:${path.year}:${path.monthKey}:${path.dateKey}`,
        `area:${path.year}:${path.monthKey}:${path.dateKey}:${path.kind}:${path.area.toLocaleLowerCase("es-CL")}`,
      ])
    })
  }, [items])

  function isFolderOpen(key: string) {
    return Boolean(query.trim()) || expandedFolders.has(key)
  }

  function toggleFolder(key: string) {
    setExpandedFolders((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleDelete(id: string, title: string) {
    const ok = window.confirm(`¿Seguro que deseas eliminar la planificación "${title}"?`)
    if (!ok) return

    setDeletingId(id)
    const { error } = await supabase.from("saved_plannings").delete().eq("id", id)
    setDeletingId(null)

    if (error) {
      window.alert(`No se pudo eliminar: ${error.message}`)
      return
    }

    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  async function handleExport(item: SavedPlanning) {
    setExportingId(item.id)

    try {
      if (item.nivel === "parvularia" && item.content && getParvulariaDocument(item)) {
        await exportParvulariaPlanningPdf(item.content)
        return
      }
      await exportPlanningPdf(
        {
          title: compactTitle(item),
          subtitle: "Planificación guardada en EduAI Platform",
          curso: item.curso || undefined,
          asignatura: item.asignatura || undefined,
          nivel: item.nivel || undefined,
          mes: item.mes || undefined,
          horizonte: item.tiempo_planificacion || undefined,
          sesiones: item.sesiones || undefined,
          duracionMinutos: item.duracion_minutos || undefined,
          fechaCreacion: formatDate(item.created_at),
          contexto: item.contexto || undefined,
        },
        item.content || ""
      )
    } finally {
      setExportingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-950">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <button
              onClick={() => router.push("/educador")}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
            >
              ← Volver
            </button>

            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-700">
                Planificador MINEDUC
              </p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">
                Planificaciones guardadas
              </h1>
              <p className="mt-1 text-sm font-medium text-slate-600">
                Tus planificaciones se organizan automáticamente por año, mes, fecha y asignatura o ámbito.
              </p>
            </div>
          </div>

          <div className="w-full lg:w-[430px]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por título, curso, asignatura, ámbito o contexto..."
              className="w-full rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6">
        {loading ? (
          <div className="grid gap-5">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="animate-pulse rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex flex-wrap gap-2">
                  <div className="h-7 w-20 rounded-full bg-slate-100" />
                  <div className="h-7 w-24 rounded-full bg-slate-100" />
                  <div className="h-7 w-40 rounded-full bg-slate-100" />
                </div>
                <div className="h-8 w-2/3 rounded-xl bg-slate-100" />
                <div className="mt-4 h-5 w-40 rounded-xl bg-slate-100" />
                <div className="mt-6 space-y-2">
                  <div className="h-4 w-full rounded bg-slate-100" />
                  <div className="h-4 w-full rounded bg-slate-100" />
                  <div className="h-4 w-2/3 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-8 text-center font-semibold text-rose-800">
            No se pudieron cargar las planificaciones. {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
            <div className="mb-4 text-5xl">🗂️</div>
            <h2 className="text-2xl font-black text-slate-950">Aún no hay planificaciones guardadas</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm font-medium text-slate-600">
              Crea una planificación en el agente y guárdala para verla aquí.
            </p>
            <Link
              href="/educador"
              className="mt-6 inline-flex rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
            >
              Ir al planificador
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {folderTree.map((yearFolder) => {
              const yearKey = `year:${yearFolder.key}`
              return (
                <section key={yearFolder.key} className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => toggleFolder(yearKey)}
                    className="flex w-full items-center justify-between gap-4 bg-slate-950 px-5 py-4 text-left text-white transition hover:bg-slate-900"
                  >
                    <span className="flex items-center gap-3">
                      <span className="text-xl">📁</span>
                      <span>
                        <span className="block text-xs font-black uppercase tracking-[0.18em] text-slate-300">Año</span>
                        <span className="text-xl font-black">{yearFolder.label}</span>
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold">{countFolderItems(yearFolder)} planificaciones</span>
                      <span className="text-lg">{isFolderOpen(yearKey) ? "▾" : "▸"}</span>
                    </span>
                  </button>

                  {isFolderOpen(yearKey) && (
                    <div className="space-y-3 bg-slate-50 p-3 md:p-4">
                      {yearFolder.months.map((monthFolder) => {
                        const monthKey = `month:${yearFolder.key}:${monthFolder.key}`
                        return (
                          <section key={monthFolder.key} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                            <button
                              type="button"
                              onClick={() => toggleFolder(monthKey)}
                              className="flex w-full items-center justify-between gap-4 px-5 py-3 text-left transition hover:bg-emerald-50"
                            >
                              <span className="flex items-center gap-3">
                                <span>📂</span>
                                <span className="font-black text-slate-900">{monthFolder.label}</span>
                              </span>
                              <span className="flex items-center gap-3 text-xs font-bold text-slate-500">
                                <span>{countFolderItems(monthFolder)}</span>
                                <span>{isFolderOpen(monthKey) ? "▾" : "▸"}</span>
                              </span>
                            </button>

                            {isFolderOpen(monthKey) && (
                              <div className="space-y-3 border-t border-slate-100 bg-slate-50/70 p-3">
                                {monthFolder.dates.map((dateFolder) => {
                                  const dateKey = `date:${yearFolder.key}:${monthFolder.key}:${dateFolder.key}`
                                  return (
                                    <section key={dateFolder.key} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                                      <button
                                        type="button"
                                        onClick={() => toggleFolder(dateKey)}
                                        className="flex w-full items-center justify-between gap-4 px-5 py-3 text-left transition hover:bg-sky-50"
                                      >
                                        <span className="flex items-center gap-3">
                                          <span>🗓️</span>
                                          <span>
                                            <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Fecha</span>
                                            <span className="font-extrabold text-slate-800">{dateFolder.label}</span>
                                          </span>
                                        </span>
                                        <span className="flex items-center gap-3 text-xs font-bold text-slate-500">
                                          <span>{countFolderItems(dateFolder)}</span>
                                          <span>{isFolderOpen(dateKey) ? "▾" : "▸"}</span>
                                        </span>
                                      </button>

                                      {isFolderOpen(dateKey) && (
                                        <div className="space-y-3 border-t border-slate-100 p-3">
                                          {dateFolder.areas.map((areaFolder) => {
                                            const areaKey = `area:${yearFolder.key}:${monthFolder.key}:${dateFolder.key}:${areaFolder.key}`
                                            return (
                                              <section key={areaFolder.key} className="overflow-hidden rounded-2xl border border-emerald-100 bg-emerald-50/40">
                                                <button
                                                  type="button"
                                                  onClick={() => toggleFolder(areaKey)}
                                                  className="flex w-full items-center justify-between gap-4 px-5 py-3 text-left transition hover:bg-emerald-50"
                                                >
                                                  <span className="flex items-center gap-3">
                                                    <span>📚</span>
                                                    <span>
                                                      <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">{areaFolder.kind}</span>
                                                      <span className="font-black text-slate-900">{areaFolder.label}</span>
                                                    </span>
                                                  </span>
                                                  <span className="flex items-center gap-3 text-xs font-bold text-emerald-800">
                                                    <span>{areaFolder.items.length}</span>
                                                    <span>{isFolderOpen(areaKey) ? "▾" : "▸"}</span>
                                                  </span>
                                                </button>

                                                {isFolderOpen(areaKey) && (
                                                  <div className="grid gap-4 border-t border-emerald-100 bg-white p-3 md:p-4">
                                                    {areaFolder.items.map((item) => {
                                                      const preview = planningPreview(item)
                                                      const stats = getPlanningStats(item)

                                                      return (
                                                        <article
                  key={item.id}
                  className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_280px]">
                    <div className="p-6">
                      <div className="mb-4 flex flex-wrap items-center gap-2">
                        {stats.map((stat) => (
                          <span key={stat.label} className={`rounded-full border px-3 py-1 text-xs font-bold ${badgeClass(stat.tone)}`}>
                            <span className="mr-1 opacity-80">{stat.label}:</span>{stat.value}
                          </span>
                        ))}
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                          Creada: {formatDate(item.created_at)}
                        </span>
                      </div>

                      <h2 className="line-clamp-2 text-2xl font-black leading-tight text-slate-950">
                        {compactTitle(item)}
                      </h2>

                      <p className="mt-2 text-base font-semibold text-slate-700">
                        {item.curso || "Sin curso"} · {item.asignatura || "Sin asignatura"}
                      </p>

                      {item.contexto ? (
                        <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
                          <p className="mb-1 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-800">
                            Contexto pedagógico
                          </p>
                          <p className="line-clamp-2 text-sm font-medium leading-6 text-slate-800">
                            {item.contexto}
                          </p>
                        </div>
                      ) : null}

                      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                          Vista previa del contenido
                        </p>
                        <p className="text-sm font-medium leading-7 text-slate-700">{preview}</p>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
                        <span>Última edición: <span className="text-slate-700">{formatDate(item.updated_at)}</span></span>
                        {item.mes ? <span>Mes: <span className="text-slate-700">{item.mes}</span></span> : null}
                      </div>
                    </div>

                    <div className="border-t border-slate-200 bg-slate-50 p-6 xl:border-l xl:border-t-0">
                      <div className="flex h-full flex-col justify-between">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Acciones</p>
                          <h3 className="mt-2 text-lg font-black text-slate-950">Gestionar planificación</h3>
                          <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                            Abre la vista completa, edita el contenido, exporta PDF o elimina el registro.
                          </p>
                        </div>

                        <div className="mt-6 grid gap-3">
                          <Link
                            href={`/educador/planificaciones/${item.id}${getParvulariaDocument(item) ? "?edit=1" : ""}`}
                            className="inline-flex items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-bold text-sky-800 transition hover:bg-sky-100"
                          >
                            Ver y editar
                          </Link>
                          <button
                            onClick={() => handleExport(item)}
                            disabled={exportingId === item.id}
                            className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
                          >
                            {exportingId === item.id ? "Exportando..." : "Exportar PDF"}
                          </button>
                          <button
                            onClick={() => handleDelete(item.id, item.title)}
                            disabled={deletingId === item.id}
                            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800 transition hover:bg-rose-100 disabled:opacity-50"
                          >
                            {deletingId === item.id ? "Eliminando..." : "Eliminar"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                                                        </article>
                                                      )
                                                    })}
                                                  </div>
                                                )}
                                              </section>
                                            )
                                          })}
                                        </div>
                                      )}
                                    </section>
                                  )
                                })}
                              </div>
                            )}
                          </section>
                        )
                      })}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
