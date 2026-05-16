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
    return new Date(value).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" })
  } catch {
    return value
  }
}

function compactTitle(item: SavedPlanning) {
  const course = item.curso || item.course || "Curso"
  const subject = item.asignatura || item.subject || "Asignatura"
  const date = new Date(item.created_at).toLocaleDateString("es-CL")
  return `Planificación ${course} · ${subject} · ${date}`
}

function infoCardClass(index: number) {
  const tones = [
    "border-emerald-200 bg-emerald-50 text-emerald-950",
    "border-sky-200 bg-sky-50 text-sky-950",
    "border-violet-200 bg-violet-50 text-violet-950",
    "border-amber-200 bg-amber-50 text-amber-950",
    "border-slate-200 bg-white text-slate-950",
    "border-slate-200 bg-white text-slate-950",
  ]
  return tones[index] || "border-slate-200 bg-white text-slate-950"
}

function getContentStats(content?: string | null) {
  const text = content || ""
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const headings = (text.match(/^#{1,6}\s+/gm) || []).length
  return { words, headings }
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

    const { error } = await supabase.from("saved_plannings").update(payload).eq("id", item.id)
    setSaving(false)

    if (error) {
      setStatus(`No se pudo guardar: ${error.message}`)
      return
    }

    setStatus("Cambios guardados correctamente.")
    setItem({ ...item, updated_at: payload.updated_at })
  }

  async function handleDelete() {
    if (!item) return
    const ok = window.confirm(`¿Seguro que deseas eliminar "${item.title}"?`)
    if (!ok) return

    setDeleting(true)
    setStatus("")

    const { error } = await supabase.from("saved_plannings").delete().eq("id", item.id)
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
          title: compactTitle(item),
          subtitle: "Planificación guardada en EduAI Platform",
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
      <div className="min-h-screen bg-[#f8fafc] text-slate-950">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="animate-pulse space-y-5">
            <div className="h-20 rounded-[28px] border border-slate-200 bg-white" />
            <div className="grid gap-6 xl:grid-cols-[310px_minmax(0,1fr)]">
              <div className="h-[680px] rounded-[28px] border border-slate-200 bg-white" />
              <div className="h-[680px] rounded-[28px] border border-slate-200 bg-white" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-950">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
            <Link
              href="/educador/planificaciones"
              className="mb-6 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              ← Volver
            </Link>
            <h1 className="text-2xl font-black text-slate-950">Planificación no disponible</h1>
            <p className="mt-3 font-medium text-slate-600">{status || "No se encontró el registro."}</p>
          </div>
        </div>
      </div>
    )
  }

  const summaryItems = [
    ["Curso", item.curso || "—"],
    ["Asignatura", item.asignatura || "—"],
    ["Nivel", item.nivel || "—"],
    ["Horizonte", `${item.tiempo_planificacion || "—"} · ${item.sesiones || 1} sesiones · ${item.duracion_minutos || 45} min`],
    ["Mes", item.mes || "—"],
    ["Última edición", formatDate(item.updated_at)],
  ] as const

  const contentStats = getContentStats(item.content)

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-950">
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/94 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <Link
                href="/educador/planificaciones"
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
              >
                ← Volver
              </Link>

              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
                    {item.nivel || "planificación"}
                  </span>
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-bold text-sky-800">
                    {item.tiempo_planificacion || "sin horizonte"}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                    Creada: {formatDate(item.created_at)}
                  </span>
                </div>

                <h1 className="line-clamp-2 text-2xl font-black tracking-tight text-slate-950 xl:text-3xl">
                  {compactTitle(item)}
                </h1>
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  {item.curso || "Sin curso"} · {item.asignatura || "Sin asignatura"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleExport}
                disabled={exporting}
                className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-2.5 text-sm font-bold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
              >
                {exporting ? "Exportando..." : "Exportar PDF"}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-2xl border border-emerald-200 bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-2.5 text-sm font-bold text-rose-800 transition hover:bg-rose-100 disabled:opacity-50"
              >
                {deleting ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6">
        {status && (
          <div className="mb-6 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-800">
            {status}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-xl font-black text-emerald-800">Resumen</h2>
              <div className="space-y-3">
                {summaryItems.map(([label, value], index) => (
                  <div key={label} className={`rounded-2xl border px-4 py-3 ${infoCardClass(index)}`}>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
                    <p className="mt-1 text-base font-black leading-snug">{value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-lg font-black text-slate-950">Vista del documento</h3>
              <div className="inline-flex w-full rounded-2xl border border-slate-200 bg-slate-100 p-1">
                <button
                  onClick={() => setViewMode("preview")}
                  className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                    viewMode === "preview" ? "bg-white text-emerald-800 shadow-sm" : "text-slate-600 hover:text-slate-950"
                  }`}
                >
                  Vista previa
                </button>
                <button
                  onClick={() => setViewMode("edit")}
                  className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                    viewMode === "edit" ? "bg-white text-sky-800 shadow-sm" : "text-slate-600 hover:text-slate-950"
                  }`}
                >
                  Editar
                </button>
              </div>
              <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
                {contentStats.words} palabras · {contentStats.headings} secciones detectadas.
              </p>
            </section>
          </aside>

          <main className="space-y-6">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <label className="mb-3 block text-sm font-black text-slate-900">Título</label>
              <input
                value={item.title}
                onChange={(e) => setItem({ ...item, title: e.target.value })}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-lg font-semibold text-slate-950 outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100"
              />
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <label className="block text-sm font-black text-slate-900">Contexto pedagógico</label>
                <span className="text-xs font-semibold text-slate-500">{item.contexto?.length || 0} caracteres</span>
              </div>
              <textarea
                value={item.contexto || ""}
                onChange={(e) => setItem({ ...item, contexto: e.target.value })}
                rows={4}
                className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-base font-medium leading-7 text-slate-950 outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                placeholder="Describe el contexto pedagógico..."
              />
            </section>

            <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-black text-slate-950">Contenido de la planificación</h3>
                    <p className="mt-1 text-sm font-medium text-slate-600">
                      {viewMode === "preview" ? "Lectura clara tipo documento." : "Edición directa del contenido markdown."}
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600">
                    {viewMode === "preview" ? "Vista previa activa" : "Modo edición activo"}
                  </span>
                </div>
              </div>

              <div className="p-5">
                {viewMode === "edit" ? (
                  <textarea
                    value={item.content || ""}
                    onChange={(e) => setItem({ ...item, content: e.target.value })}
                    rows={24}
                    className="min-h-[680px] w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 font-mono text-[15px] leading-7 text-slate-950 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                  />
                ) : (
                  <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 bg-emerald-50/70 px-6 py-4">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-800">Documento</p>
                      <h4 className="mt-2 text-lg font-black text-slate-950">{compactTitle(item)}</h4>
                      <p className="mt-1 text-sm font-semibold text-slate-700">{item.curso || "—"} · {item.asignatura || "—"} · {item.mes || "—"}</p>
                    </div>
                    <div className="p-6 md:p-8">
                      <article className="prose prose-slate max-w-none
                        prose-headings:scroll-mt-28 prose-headings:font-black prose-headings:text-slate-950
                        prose-h1:text-3xl prose-h2:mt-9 prose-h2:text-2xl prose-h3:mt-7 prose-h3:text-xl
                        prose-p:font-medium prose-p:leading-8 prose-p:text-slate-700
                        prose-strong:text-slate-950 prose-li:font-medium prose-li:text-slate-700
                        prose-ul:leading-8 prose-ol:leading-8 prose-hr:border-slate-200
                        prose-blockquote:border-l-emerald-500 prose-blockquote:text-slate-700
                        prose-table:my-8 prose-table:w-full prose-table:overflow-hidden
                        prose-th:border prose-th:border-slate-200 prose-th:bg-slate-100 prose-th:px-3 prose-th:py-3 prose-th:text-left prose-th:text-slate-950
                        prose-td:border prose-td:border-slate-200 prose-td:px-3 prose-td:py-3 prose-td:text-slate-700">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.content || ""}</ReactMarkdown>
                      </article>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}
