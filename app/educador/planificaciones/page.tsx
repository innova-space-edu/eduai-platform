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

function stripMarkdownPreview(text: string, max = 320) {
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
    {
      label: "Nivel",
      value: item.nivel || "—",
      tone: "emerald",
    },
    {
      label: "Horizonte",
      value: item.tiempo_planificacion || "—",
      tone: "cyan",
    },
    {
      label: "Sesiones",
      value: String(item.sesiones || 1),
      tone: "violet",
    },
    {
      label: "Duración",
      value: `${item.duracion_minutos || 45} min`,
      tone: "amber",
    },
  ]
}

function badgeClass(tone: string) {
  switch (tone) {
    case "emerald":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
    case "cyan":
      return "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
    case "violet":
      return "border-violet-500/30 bg-violet-500/10 text-violet-300"
    case "amber":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300"
    default:
      return "border-slate-700 bg-slate-800 text-slate-300"
  }
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
      [
        item.title,
        item.curso,
        item.asignatura,
        item.nivel,
        item.contexto,
        item.content,
        item.mes,
      ]
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
          title: item.title,
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
    <div className="min-h-screen bg-[#020817] text-white">
      <div className="sticky top-0 z-20 border-b border-slate-800 bg-[#061127]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <button
              onClick={() => router.push("/educador")}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
            >
              ← Volver
            </button>

            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                Planificaciones guardadas
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                Ver, editar, exportar y eliminar planificaciones.
              </p>
            </div>
          </div>

          <div className="w-full lg:w-[420px]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por título, curso o asignatura..."
              className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 outline-none transition focus:border-emerald-500/40"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6">
        {loading ? (
          <div className="grid gap-5">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className="animate-pulse rounded-3xl border border-slate-800 bg-slate-900/70 p-6"
              >
                <div className="mb-5 flex flex-wrap gap-2">
                  <div className="h-7 w-20 rounded-full bg-slate-800" />
                  <div className="h-7 w-24 rounded-full bg-slate-800" />
                  <div className="h-7 w-40 rounded-full bg-slate-800" />
                </div>
                <div className="h-8 w-2/3 rounded-xl bg-slate-800" />
                <div className="mt-4 h-5 w-40 rounded-xl bg-slate-800" />
                <div className="mt-6 space-y-2">
                  <div className="h-4 w-full rounded bg-slate-800" />
                  <div className="h-4 w-full rounded bg-slate-800" />
                  <div className="h-4 w-2/3 rounded bg-slate-800" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-8 text-center text-rose-200">
            No se pudieron cargar las planificaciones. {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/60 p-12 text-center">
            <div className="mb-4 text-5xl">🗂️</div>
            <h2 className="text-2xl font-semibold">Aún no hay planificaciones guardadas</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-400">
              Crea una planificación en el agente y guárdala para verla aquí.
            </p>
            <Link
              href="/educador"
              className="mt-6 inline-flex rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-500"
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
                  className="overflow-hidden rounded-[28px] border border-slate-800 bg-gradient-to-br from-slate-900 via-[#081224] to-[#050b16] shadow-2xl shadow-black/20"
                >
                  <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="p-6">
                      <div className="mb-4 flex flex-wrap items-center gap-2">
                        {stats.map((stat) => (
                          <span
                            key={stat.label}
                            className={`rounded-full border px-3 py-1 text-xs ${badgeClass(stat.tone)}`}
                          >
                            <span className="mr-1 opacity-80">{stat.label}:</span>
                            {stat.value}
                          </span>
                        ))}

                        <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-300">
                          Creada: {formatDate(item.created_at)}
                        </span>
                      </div>

                      <h2 className="text-2xl font-semibold leading-tight text-white">
                        {item.title}
                      </h2>

                      <p className="mt-3 text-base text-slate-300">
                        {item.curso || "Sin curso"} · {item.asignatura || "Sin asignatura"}
                      </p>

                      {item.contexto ? (
                        <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3">
                          <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                            Contexto pedagógico
                          </p>
                          <p className="line-clamp-2 text-sm leading-6 text-slate-300">
                            {item.contexto}
                          </p>
                        </div>
                      ) : null}

                      <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                        <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                          Vista previa del contenido
                        </p>
                        <p className="text-sm leading-7 text-slate-300">
                          {preview}
                        </p>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-3 text-xs text-slate-500">
                        <span>
                          Última edición: <span className="text-slate-300">{formatDate(item.updated_at)}</span>
                        </span>
                        {item.mes ? (
                          <span>
                            Mes: <span className="text-slate-300">{item.mes}</span>
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="border-t border-slate-800/80 bg-slate-950/30 p-6 xl:border-l xl:border-t-0">
                      <div className="flex h-full flex-col justify-between">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                            Acciones
                          </p>
                          <h3 className="mt-2 text-lg font-semibold text-slate-100">
                            Gestionar planificación
                          </h3>
                          <p className="mt-2 text-sm leading-6 text-slate-400">
                            Abre la vista completa, edita el contenido, exporta el PDF o elimina este registro.
                          </p>
                        </div>

                        <div className="mt-6 grid gap-3">
                          <Link
                            href={`/educador/planificaciones/${item.id}`}
                            className="inline-flex items-center justify-center rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/20"
                          >
                            Ver y editar
                          </Link>

                          <button
                            onClick={() => handleExport(item)}
                            disabled={exportingId === item.id}
                            className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-50"
                          >
                            {exportingId === item.id ? "Exportando..." : "Exportar PDF"}
                          </button>

                          <button
                            onClick={() => handleDelete(item.id, item.title)}
                            disabled={deletingId === item.id}
                            className="rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
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
