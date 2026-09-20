"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, BookOpen, CalendarDays, ChevronDown, ChevronRight, Cloud, Download, FileText, Folder, FolderOpen, Pencil, Plus, Search, Trash2 } from "lucide-react"
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

function countFolderItems(folder: PlanningYearFolder | PlanningMonthFolder | PlanningDateFolder): number {
  if ("months" in folder) {
    return folder.months.reduce((total, month) => total + countFolderItems(month), 0)
  }
  if ("dates" in folder) {
    return folder.dates.reduce((total, date) => total + countFolderItems(date), 0)
  }
  return folder.areas.reduce((total, area) => total + area.items.length, 0)
}


type BrowserNode =
  | { type: "home"; key: "home"; label: "Inicio" }
  | { type: "year"; key: string; label: string; year: PlanningYearFolder }
  | { type: "month"; key: string; label: string; year: PlanningYearFolder; month: PlanningMonthFolder }
  | { type: "date"; key: string; label: string; year: PlanningYearFolder; month: PlanningMonthFolder; date: PlanningDateFolder }
  | { type: "area"; key: string; label: string; year: PlanningYearFolder; month: PlanningMonthFolder; date: PlanningDateFolder; area: PlanningAreaFolder }

function yearNodeKey(year: PlanningYearFolder) {
  return "year:" + year.key
}

function monthNodeKey(year: PlanningYearFolder, month: PlanningMonthFolder) {
  return "month:" + year.key + ":" + month.key
}

function dateNodeKey(year: PlanningYearFolder, month: PlanningMonthFolder, date: PlanningDateFolder) {
  return "date:" + year.key + ":" + month.key + ":" + date.key
}

function areaNodeKey(year: PlanningYearFolder, month: PlanningMonthFolder, date: PlanningDateFolder, area: PlanningAreaFolder) {
  return "area:" + year.key + ":" + month.key + ":" + date.key + ":" + area.key
}

function findBrowserNode(tree: PlanningYearFolder[], selectedKey: string): BrowserNode {
  if (selectedKey === "home") return { type: "home", key: "home", label: "Inicio" }

  for (const year of tree) {
    if (yearNodeKey(year) === selectedKey) {
      return { type: "year", key: selectedKey, label: year.label, year }
    }
    for (const month of year.months) {
      if (monthNodeKey(year, month) === selectedKey) {
        return { type: "month", key: selectedKey, label: month.label, year, month }
      }
      for (const date of month.dates) {
        if (dateNodeKey(year, month, date) === selectedKey) {
          return { type: "date", key: selectedKey, label: date.label, year, month, date }
        }
        for (const area of date.areas) {
          if (areaNodeKey(year, month, date, area) === selectedKey) {
            return { type: "area", key: selectedKey, label: area.label, year, month, date, area }
          }
        }
      }
    }
  }

  return { type: "home", key: "home", label: "Inicio" }
}

function pluralizePlan(count: number) {
  return count === 1 ? "1 planificación" : count + " planificaciones"
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
  const [selectedKey, setSelectedKey] = useState("home")

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
  const selectedNode = useMemo(() => findBrowserNode(folderTree, selectedKey), [folderTree, selectedKey])

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


  function renderPlanningCard(item: SavedPlanning) {
    const stats = getPlanningStats(item)
    return (
      <article
        key={item.id}
        className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg"
      >
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_220px]">
          <div className="p-5 md:p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {stats.map((stat) => (
                <span
                  key={stat.label}
                  className={"rounded-full border px-3 py-1 text-[11px] font-bold " + badgeClass(stat.tone)}
                >
                  <span className="mr-1 opacity-70">{stat.label}:</span>
                  {stat.value}
                </span>
              ))}
            </div>

            <div className="flex items-start gap-4">
              <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                <FileText className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h3 className="line-clamp-2 text-lg font-black leading-tight text-slate-950 md:text-xl">
                  {compactTitle(item)}
                </h3>
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  {(item.curso || "Sin curso") + " · " + (item.asignatura || "Sin asignatura")}
                </p>
              </div>
            </div>

            <p className="mt-4 line-clamp-3 text-sm font-medium leading-6 text-slate-600">
              {planningPreview(item)}
            </p>

            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-slate-400">
              <span>Creada {formatDate(item.created_at)}</span>
              <span>Editada {formatDate(item.updated_at)}</span>
            </div>
          </div>

          <div className="border-t border-slate-100 bg-slate-50/80 p-4 xl:border-l xl:border-t-0">
            <div className="grid h-full content-center gap-2">
              <Link
                href={"/educador/planificaciones/" + item.id + (getParvulariaDocument(item) ? "?edit=1" : "")}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700"
              >
                <Pencil className="h-4 w-4" />
                Abrir y editar
              </Link>
              <button
                onClick={() => handleExport(item)}
                disabled={exportingId === item.id}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                {exportingId === item.id ? "Exportando..." : "PDF"}
              </button>
              <button
                onClick={() => handleDelete(item.id, item.title)}
                disabled={deletingId === item.id}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {deletingId === item.id ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      </article>
    )
  }

  function renderFolderCard(
    key: string,
    label: string,
    eyebrow: string,
    count: number,
    icon: "folder" | "calendar" | "book"
  ) {
    const Icon = icon === "calendar" ? CalendarDays : icon === "book" ? BookOpen : Folder
    return (
      <button
        key={key}
        type="button"
        onClick={() => setSelectedKey(key)}
        className="group flex min-h-32 flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <Icon className="h-5 w-5" />
          </span>
          <ChevronRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-indigo-500" />
        </div>
        <div className="mt-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{eyebrow}</p>
          <p className="mt-1 truncate text-base font-black text-slate-900">{label}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{pluralizePlan(count)}</p>
        </div>
      </button>
    )
  }

  function renderMainContent() {
    if (selectedNode.type === "home") {
      const latest = filtered.slice(0, 4)
      return (
        <div className="space-y-6">
          <section className="overflow-hidden rounded-[32px] border border-indigo-100 bg-gradient-to-br from-white via-indigo-50/50 to-violet-50 shadow-sm">
            <div className="grid lg:grid-cols-[1.35fr_0.65fr]">
              <div className="p-7 md:p-10">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg shadow-indigo-200">
                  <Cloud className="h-7 w-7" />
                </div>
                <p className="mt-7 text-xs font-black uppercase tracking-[0.24em] text-indigo-600">Tu archivo docente</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                  Planificaciones organizadas como una nube
                </h2>
                <p className="mt-4 max-w-2xl text-sm font-medium leading-7 text-slate-600 md:text-base">
                  Cada planificación queda ordenada automáticamente por año, mes, fecha y asignatura o ámbito. Usa el panel izquierdo para navegar por la estructura sin perder la vista del documento.
                </p>
                <Link
                  href="/educador"
                  className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-indigo-700"
                >
                  <Plus className="h-4 w-4" />
                  Crear planificación
                </Link>
              </div>
              <div className="border-t border-indigo-100 bg-white/60 p-6 lg:border-l lg:border-t-0">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600">Colección actual</p>
                <div className="mt-5 grid gap-3">
                  <div className="rounded-2xl border border-white bg-white p-5 shadow-sm">
                    <p className="text-3xl font-black text-slate-950">{filtered.length}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">planificaciones guardadas</p>
                  </div>
                  <div className="rounded-2xl border border-white bg-white p-5 shadow-sm">
                    <p className="text-3xl font-black text-slate-950">{folderTree.length}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">años con contenido</p>
                  </div>
                  <div className="rounded-2xl border border-white bg-white p-5 shadow-sm">
                    <p className="text-3xl font-black text-slate-950">
                      {folderTree.reduce((total, year) => total + year.months.length, 0)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">meses organizados</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {latest.length > 0 ? (
            <section>
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Acceso rápido</p>
                  <h3 className="mt-1 text-xl font-black text-slate-950">Planificaciones recientes</h3>
                </div>
              </div>
              <div className="grid gap-4">{latest.map(renderPlanningCard)}</div>
            </section>
          ) : null}
        </div>
      )
    }

    if (selectedNode.type === "year") {
      return (
        <div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {selectedNode.year.months.map((month) =>
              renderFolderCard(
                monthNodeKey(selectedNode.year, month),
                month.label,
                "Mes",
                countFolderItems(month),
                "folder"
              )
            )}
          </div>
        </div>
      )
    }

    if (selectedNode.type === "month") {
      return (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {selectedNode.month.dates.map((date) =>
            renderFolderCard(
              dateNodeKey(selectedNode.year, selectedNode.month, date),
              date.label,
              "Fecha",
              countFolderItems(date),
              "calendar"
            )
          )}
        </div>
      )
    }

    if (selectedNode.type === "date") {
      return (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {selectedNode.date.areas.map((area) =>
            renderFolderCard(
              areaNodeKey(selectedNode.year, selectedNode.month, selectedNode.date, area),
              area.label,
              area.kind,
              area.items.length,
              "book"
            )
          )}
        </div>
      )
    }

    return <div className="grid gap-4">{selectedNode.area.items.map(renderPlanningCard)}</div>
  }

  function selectedBreadcrumbs() {
    if (selectedNode.type === "home") return ["Inicio"]
    if (selectedNode.type === "year") return ["Inicio", selectedNode.year.label]
    if (selectedNode.type === "month") return ["Inicio", selectedNode.year.label, selectedNode.month.label]
    if (selectedNode.type === "date") return ["Inicio", selectedNode.year.label, selectedNode.month.label, selectedNode.date.label]
    return ["Inicio", selectedNode.year.label, selectedNode.month.label, selectedNode.date.label, selectedNode.area.label]
  }

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="flex min-h-[74px] items-center justify-between gap-4 px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/educador")}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              aria-label="Volver al planificador"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-md shadow-indigo-100">
              <FolderOpen className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-black tracking-tight text-slate-950 md:text-xl">Planificaciones EduAI</h1>
              <p className="hidden text-xs font-medium text-slate-500 sm:block">Año · mes · fecha · asignatura o ámbito</p>
            </div>
          </div>

          <Link
            href="/educador"
            className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nueva planificación</span>
            <span className="sm:hidden">Nueva</span>
          </Link>
        </div>
      </header>

      <div className="grid lg:h-[calc(100vh-74px)] lg:grid-cols-[310px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-white lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div className="p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setSelectedKey("home")
                }}
                placeholder="Buscar planificaciones..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              />
            </div>

            <div className="mt-4 flex items-center justify-between px-1 text-[11px] font-bold text-slate-400">
              <span>{pluralizePlan(filtered.length)}</span>
              <span>{folderTree.length} años</span>
            </div>
          </div>

          <nav className="px-2 pb-5">
            <button
              type="button"
              onClick={() => setSelectedKey("home")}
              className={
                "mb-2 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-bold transition " +
                (selectedNode.type === "home"
                  ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")
              }
            >
              <Cloud className="h-4 w-4" />
              <span>Inicio</span>
              <ChevronRight className="ml-auto h-4 w-4" />
            </button>

            {folderTree.map((year) => {
              const yKey = yearNodeKey(year)
              const yOpen = isFolderOpen(yKey)
              return (
                <div key={year.key} className="mb-1">
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => toggleFolder(yKey)}
                      className="flex h-9 w-8 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      aria-label={yOpen ? "Cerrar año" : "Abrir año"}
                    >
                      {yOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedKey(yKey)}
                      className={
                        "flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm font-bold transition " +
                        (selectedKey === yKey ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-slate-50")
                      }
                    >
                      {yOpen ? <FolderOpen className="h-4 w-4 shrink-0" /> : <Folder className="h-4 w-4 shrink-0" />}
                      <span className="truncate">{year.label}</span>
                      <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500">
                        {countFolderItems(year)}
                      </span>
                    </button>
                  </div>

                  {yOpen ? (
                    <div className="ml-4 border-l border-slate-200 pl-2">
                      {year.months.map((month) => {
                        const mKey = monthNodeKey(year, month)
                        const mOpen = isFolderOpen(mKey)
                        return (
                          <div key={month.key}>
                            <div className="flex items-center">
                              <button
                                type="button"
                                onClick={() => toggleFolder(mKey)}
                                className="flex h-8 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                              >
                                {mOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedKey(mKey)}
                                className={
                                  "flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-1.5 text-left text-[13px] font-bold transition " +
                                  (selectedKey === mKey ? "bg-sky-50 text-sky-700" : "text-slate-600 hover:bg-slate-50")
                                }
                              >
                                <Folder className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{month.label}</span>
                              </button>
                            </div>

                            {mOpen ? (
                              <div className="ml-3 border-l border-slate-200 pl-2">
                                {month.dates.map((date) => {
                                  const dKey = dateNodeKey(year, month, date)
                                  const dOpen = isFolderOpen(dKey)
                                  return (
                                    <div key={date.key}>
                                      <div className="flex items-center">
                                        <button
                                          type="button"
                                          onClick={() => toggleFolder(dKey)}
                                          className="flex h-8 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                                        >
                                          {dOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setSelectedKey(dKey)}
                                          className={
                                            "flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-1.5 text-left text-xs font-bold transition " +
                                            (selectedKey === dKey ? "bg-violet-50 text-violet-700" : "text-slate-600 hover:bg-slate-50")
                                          }
                                        >
                                          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                                          <span className="truncate">{date.label}</span>
                                        </button>
                                      </div>

                                      {dOpen ? (
                                        <div className="ml-3 border-l border-slate-200 pl-2">
                                          {date.areas.map((area) => {
                                            const aKey = areaNodeKey(year, month, date, area)
                                            return (
                                              <button
                                                key={area.key}
                                                type="button"
                                                onClick={() => setSelectedKey(aKey)}
                                                className={
                                                  "flex w-full min-w-0 items-center gap-2 rounded-xl px-2 py-1.5 text-left text-xs font-bold transition " +
                                                  (selectedKey === aKey ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700")
                                                }
                                              >
                                                <BookOpen className="h-3.5 w-3.5 shrink-0" />
                                                <span className="truncate">{area.label}</span>
                                                <span className="ml-auto text-[10px] text-slate-400">{area.items.length}</span>
                                              </button>
                                            )
                                          })}
                                        </div>
                                      ) : null}
                                    </div>
                                  )
                                })}
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </nav>
        </aside>

        <main className="min-w-0 bg-[#f6f8fc] lg:overflow-y-auto">
          <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-36 animate-pulse rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="h-10 w-10 rounded-2xl bg-slate-100" />
                    <div className="mt-6 h-4 w-2/3 rounded bg-slate-100" />
                    <div className="mt-2 h-3 w-1/3 rounded bg-slate-100" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center text-sm font-bold text-rose-800">
                No se pudieron cargar las planificaciones. {error}
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-[32px] border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
                <Folder className="mx-auto h-12 w-12 text-slate-300" />
                <h2 className="mt-4 text-2xl font-black text-slate-950">No hay planificaciones en esta vista</h2>
                <p className="mx-auto mt-2 max-w-lg text-sm font-medium leading-6 text-slate-500">
                  Cambia la búsqueda o crea una nueva planificación desde el agente.
                </p>
                <Link
                  href="/educador"
                  className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white"
                >
                  <Plus className="h-4 w-4" />
                  Crear planificación
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-400">
                      {selectedBreadcrumbs().map((crumb, index, crumbs) => (
                        <span key={crumb + index} className="flex items-center gap-1.5">
                          <span>{crumb}</span>
                          {index < crumbs.length - 1 ? <ChevronRight className="h-3.5 w-3.5" /> : null}
                        </span>
                      ))}
                    </div>
                    <h2 className="mt-2 truncate text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
                      {selectedNode.type === "home" ? "Mis planificaciones" : selectedNode.label}
                    </h2>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                      {selectedNode.type === "home"
                        ? "Navega por las carpetas del panel izquierdo."
                        : selectedNode.type === "area"
                          ? pluralizePlan(selectedNode.area.items.length)
                          : "Selecciona una carpeta para seguir profundizando."}
                    </p>
                  </div>
                </div>

                {renderMainContent()}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
