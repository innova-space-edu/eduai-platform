"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
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

function normalizePlanning(item: SavedPlanning): SavedPlanning {
  return {
    ...item,
    curso: item.curso || item.course || null,
    asignatura: item.asignatura || item.subject || null,
    unidad_id: item.unidad_id || item.unit || null,
    content: item.content || item.planning_text || "",
  }
}

function formatDate(value?: string | null) {
  if (!value) return "—"
  try {
    return new Date(value).toLocaleString("es-CL")
  } catch {
    return value
  }
}

export default function SavedPlanningDetailPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = useMemo(() => createClient(), [])

  const planningId = Array.isArray(params?.id) ? params.id[0] : params?.id

  const [item, setItem] = useState<SavedPlanning | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [status, setStatus] = useState("")
  const [viewMode, setViewMode] = useState<"preview" | "edit">("preview")

  useEffect(() => {
    let active = true

    async function load() {
      if (!planningId) return

      setLoading(true)
      setStatus("")

      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData.user) {
        router.replace(`/login?next=/educador/planificaciones/${planningId}`)
        return
      }

      const { data, error } = await supabase
        .from("saved_plannings")
        .select("*")
        .eq("id", planningId)
        .eq("user_id", authData.user.id)
        .maybeSingle()

      if (!active) return

      if (error) {
        setStatus(`No se pudo cargar: ${error.message}`)
        setItem(null)
      } else if (!data) {
        setStatus("No se encontró la planificación.")
        setItem(null)
      } else {
        setItem(normalizePlanning(data as SavedPlanning))
      }

      setLoading(false)
    }

    load()

    return () => {
      active = false
    }
  }, [planningId, router, supabase])

  async function handleSave() {
    if (!item) return

    setSaving(true)
    setStatus("")

    const payload = {
      title: item.title,
      contexto: item.contexto,
      content: item.content,
      planning_text: item.content,
      planning_json: {
        title: item.title,
        nivel: item.nivel,
        curso: item.curso,
        asignatura: item.asignatura,
        contexto: item.contexto,
        mes: item.mes,
        unidad_id: item.unidad_id,
        selected_oa_ids: item.selected_oa_ids,
        selected_oat_ids: item.selected_oat_ids,
        tiempo_planificacion: item.tiempo_planificacion,
        sesiones: item.sesiones,
        duracion_minutos: item.duracion_minutos,
        content: item.content,
        updated_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from("saved_plannings")
      .update(payload)
      .eq("id", item.id)

    setSaving(false)

    if (error) {
      setStatus(`No se pudo guardar: ${error.message}`)
      return
    }

    setStatus("Cambios guardados correctamente.")
  }

  async function handleDelete() {
    if (!item) return

    const ok = window.confirm(`¿Seguro que deseas eliminar "${item.title}"?`)
    if (!ok) return

    setDeleting(true)
    setStatus("")

    const { error } = await supabase
      .from("saved_plannings")
      .delete()
      .eq("id", item.id)

    setDeleting(false)

    if (error) {
      setStatus(`No se pudo eliminar: ${error.message}`)
      return
    }

    router.push("/educador/planificaciones")
  }

  async function handleExport() {
    if (!item?.content?.trim()) {
      setStatus("No hay contenido para exportar.")
      return
    }

    setExporting(true)
    setStatus("")

    try {
      await exportPlanningPdf(
        {
          title: item.title,
          subtitle: "Planificación guardada",
          curso: item.curso || "—",
          asignatura: item.asignatura || "—",
          nivel: item.nivel || "—",
          mes: item.mes || "—",
          horizonte: item.tiempo_planificacion || "—",
          sesiones: item.sesiones || 1,
          duracionMinutos: item.duracion_minutos || 45,
          fechaCreacion: formatDate(item.created_at),
          contexto: item.contexto || "",
        },
        item.content
      )
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020817] text-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-10 w-64 rounded-2xl bg-slate-800" />
            <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
              <div className="h-[520px] rounded-3xl bg-slate-900/70 border border-slate-800" />
              <div className="h-[520px] rounded-3xl bg-slate-900/70 border border-slate-800" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-[#020817] text-white">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8">
            <Link
              href="/educador/planificaciones"
              className="mb-6 inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
            >
              ← Volver
            </Link>
            <h1 className="text-2xl font-semibold">Planificación no disponible</h1>
            <p className="mt-3 text-slate-400">{status || "No se encontró el registro."}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#020817] text-white">
      <div className="border-b border-slate-800 bg-[#061127]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <Link
              href="/educador/planificaciones"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
            >
              ← Volver
            </Link>

            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Editar planificación</h1>
              <p className="mt-1 text-sm text-slate-400">
                Creada el {formatDate(item.created_at)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-2.5 text-sm text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-50"
            >
              {exporting ? "Exportando..." : "Exportar PDF"}
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-2.5 text-sm text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>

            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-2.5 text-sm text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
            >
              {deleting ? "Eliminando..." : "Eliminar"}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6">
        {status && (
          <div className="mb-6 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
            {status}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-black/20">
            <h2 className="mb-4 text-xl font-semibold text-emerald-300">Resumen</h2>

            <div className="space-y-4">
              {[
                ["Curso", item.curso || "—"],
                ["Asignatura", item.asignatura || "—"],
                ["Nivel", item.nivel || "—"],
                [
                  "Horizonte",
                  `${item.tiempo_planificacion || "—"} · ${item.sesiones || 1} sesiones · ${item.duracion_minutos || 45} min`,
                ],
                ["Mes", item.mes || "—"],
                ["Última edición", formatDate(item.updated_at)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-3xl border border-slate-800 bg-[#040b1a] px-5 py-4"
                >
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
                  <p className="mt-2 text-2xl font-medium leading-snug text-slate-100">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </aside>

          <main className="space-y-6">
            <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-black/20">
              <label className="mb-3 block text-sm font-medium text-slate-200">Título</label>
              <input
                value={item.title}
                onChange={(e) => setItem({ ...item, title: e.target.value })}
                className="w-full rounded-3xl border border-slate-700 bg-[#020817] px-5 py-4 text-lg text-white outline-none transition focus:border-emerald-500/50"
              />
            </section>

            <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-black/20">
              <label className="mb-3 block text-sm font-medium text-slate-200">
                Contexto pedagógico
              </label>
              <textarea
                value={item.contexto || ""}
                onChange={(e) => setItem({ ...item, contexto: e.target.value })}
                rows={5}
                className="w-full resize-y rounded-3xl border border-slate-700 bg-[#020817] px-5 py-4 text-base text-white outline-none transition focus:border-emerald-500/50"
                placeholder="Describe el contexto pedagógico..."
              />
            </section>

            <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-black/20">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-xl font-semibold text-slate-100">Contenido de la planificación</h3>

                <div className="inline-flex rounded-2xl border border-slate-700 bg-[#071224] p-1">
                  <button
                    onClick={() => setViewMode("preview")}
                    className={`rounded-xl px-4 py-2 text-sm transition ${
                      viewMode === "preview"
                        ? "bg-emerald-500/15 text-emerald-200"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Vista previa
                  </button>
                  <button
                    onClick={() => setViewMode("edit")}
                    className={`rounded-xl px-4 py-2 text-sm transition ${
                      viewMode === "edit"
                        ? "bg-cyan-500/15 text-cyan-200"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Editar markdown
                  </button>
                </div>
              </div>

              {viewMode === "edit" ? (
                <textarea
                  value={item.content || ""}
                  onChange={(e) => setItem({ ...item, content: e.target.value })}
                  rows={24}
                  className="min-h-[620px] w-full resize-y rounded-3xl border border-slate-700 bg-[#020817] px-5 py-4 font-mono text-[15px] leading-7 text-slate-100 outline-none transition focus:border-cyan-500/50"
                />
              ) : (
                <div className="rounded-3xl border border-slate-800 bg-[#040b1a] p-6">
                  <article className="prose prose-invert prose-slate max-w-none prose-headings:scroll-mt-24 prose-headings:text-white prose-p:text-slate-300 prose-strong:text-white prose-li:text-slate-300 prose-hr:border-slate-700 prose-th:border-slate-700 prose-th:bg-slate-800 prose-th:text-slate-100 prose-td:border-slate-800 prose-td:text-slate-300 prose-table:w-full">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {item.content || ""}
                    </ReactMarkdown>
                  </article>
                </div>
              )}
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}
