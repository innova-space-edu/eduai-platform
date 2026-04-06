"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
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

export default function SavedPlanningDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const supabase = useMemo(() => createClient(), [])
  const [item, setItem] = useState<SavedPlanning | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState("")

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) {
        router.replace(`/login?next=/educador/planificaciones/${params.id}`)
        return
      }

      const { data, error } = await supabase
        .from("saved_plannings")
        .select("*")
        .eq("id", params.id)
        .eq("user_id", auth.user.id)
        .maybeSingle()

      if (!active) return

      if (error || !data) {
        setStatus(error?.message || "No se encontró la planificación solicitada.")
      } else {
        setItem(normalizePlanning(data as SavedPlanning))
      }
      setLoading(false)
    }

    if (params.id) load()
    return () => {
      active = false
    }
  }, [params.id, router, supabase])

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
    setStatus(error ? `No se pudo guardar: ${error.message}` : "Cambios guardados correctamente.")
  }

  async function handleDelete() {
    if (!item) return
    const ok = window.confirm(`¿Seguro que deseas eliminar la planificación \"${item.title}\"?`)
    if (!ok) return

    const { error } = await supabase.from("saved_plannings").delete().eq("id", item.id)
    if (error) {
      setStatus(`No se pudo eliminar: ${error.message}`)
      return
    }

    router.push("/educador/planificaciones")
  }

  async function handleExport() {
    if (!item) return
    await exportPlanningPdf(
      {
        title: item.title,
        subtitle: "Planificación editada desde la biblioteca de planificaciones",
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
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-300">
        Cargando planificación...
      </div>
    )
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-gray-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-center">
          <p>{status || "Planificación no encontrada."}</p>
          <button
            onClick={() => router.push("/educador/planificaciones")}
            className="mt-4 rounded-2xl border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-gray-200"
          >
            ← Volver
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="sticky top-0 z-20 border-b border-gray-800 bg-gray-950/90 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/educador/planificaciones")}
              className="rounded-2xl border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-gray-300 hover:border-emerald-500/40 hover:text-white"
            >
              ← Volver
            </button>
            <div>
              <h1 className="text-lg font-semibold">Editar planificación</h1>
              <p className="text-sm text-gray-400">Creada el {formatDate(item.created_at)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExport}
              className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-2 text-sm text-amber-200 hover:bg-amber-500/20"
            >
              Exportar PDF
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
            <button
              onClick={handleDelete}
              className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-2 text-sm text-red-200 hover:bg-red-500/20"
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-3xl border border-gray-800 bg-gray-900 p-5">
          <h2 className="mb-4 text-sm font-semibold text-emerald-300">Resumen</h2>
          <div className="space-y-3 text-sm text-gray-300">
            <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">Curso</p>
              <p className="mt-1 text-white">{item.curso || "—"}</p>
            </div>
            <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">Asignatura</p>
              <p className="mt-1 text-white">{item.asignatura || "—"}</p>
            </div>
            <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">Nivel</p>
              <p className="mt-1 text-white">{item.nivel || "—"}</p>
            </div>
            <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">Horizonte</p>
              <p className="mt-1 text-white">
                {item.tiempo_planificacion || "—"} · {item.sesiones || 0} sesiones · {item.duracion_minutos || 0} min
              </p>
            </div>
            <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">Última edición</p>
              <p className="mt-1 text-white">{formatDate(item.updated_at)}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-gray-800 bg-gray-900 p-5">
            <label className="mb-2 block text-sm font-medium text-gray-300">Título</label>
            <input
              value={item.title}
              onChange={(e) => setItem((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
              className="w-full rounded-2xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white focus:border-emerald-500/40 focus:outline-none"
            />
          </div>

          <div className="rounded-3xl border border-gray-800 bg-gray-900 p-5">
            <label className="mb-2 block text-sm font-medium text-gray-300">Contexto pedagógico</label>
            <textarea
              value={item.contexto || ""}
              onChange={(e) => setItem((prev) => (prev ? { ...prev, contexto: e.target.value } : prev))}
              rows={5}
              className="w-full rounded-2xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white focus:border-emerald-500/40 focus:outline-none"
            />
          </div>

          <div className="rounded-3xl border border-gray-800 bg-gray-900 p-5">
            <label className="mb-2 block text-sm font-medium text-gray-300">Contenido de la planificación</label>
            <textarea
              value={item.content || ""}
              onChange={(e) => setItem((prev) => (prev ? { ...prev, content: e.target.value } : prev))}
              rows={24}
              className="w-full rounded-2xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm leading-relaxed text-white focus:border-emerald-500/40 focus:outline-none"
            />
          </div>

          {status && (
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
              {status}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
