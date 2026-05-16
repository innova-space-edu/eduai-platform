"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { exportPlanningPdf } from "@/lib/planning-pdf"

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

function getPlanningStats(item: SavedPlanning) {
  return [
    { label: "Nivel", value: item.nivel || "—", tone: "emerald" },
    { label: "Horizonte", value: item.tiempo_planificacion || "—", tone: "sky" },
    { label: "Sesiones", value: String(item.sesiones || 1), tone: "violet" },
    { label: "Duración", value: `${item.duracion_minutos || 45} min`, tone: "amber" },
  ]
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

export default function SavedPlanningsPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [items, setItems] = useState<SavedPlanning[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [exportingId, setExportingId] = useState<string | null>(null)

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
                Vista clara para revisar, editar, exportar y eliminar tus planificaciones.
              </p>
            </div>
          </div>

          <div className="w-full lg:w-[430px]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por título, curso, asignatura o contexto..."
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
          <div className="grid gap-5">
            {filtered.map((item) => {
              const preview = stripMarkdownPreview(item.content || "")
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
                            href={`/educador/planificaciones/${item.id}`}
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
      </div>
    </div>
  )
}
