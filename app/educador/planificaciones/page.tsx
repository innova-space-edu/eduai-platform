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
  content: string
  created_at: string
  updated_at: string
}

function formatDate(date: string) {
  return new Date(date).toLocaleString("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

export default function SavedPlanningsPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [items, setItems] = useState<SavedPlanning[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)

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
        setError(error.message)
      } else {
        setItems((data || []) as SavedPlanning[])
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
      [item.title, item.curso, item.asignatura, item.nivel, item.content]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    )
  }, [items, query])

  async function handleDelete(id: string, title: string) {
    const ok = window.confirm(`¿Seguro que deseas eliminar la planificación \"${title}\"?`)
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
      item.content
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="sticky top-0 z-20 border-b border-gray-800 bg-gray-950/90 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/educador")}
              className="rounded-2xl border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-gray-300 hover:border-emerald-500/40 hover:text-white"
            >
              ← Volver
            </button>
            <div>
              <h1 className="text-lg font-semibold">Planificaciones guardadas</h1>
              <p className="text-sm text-gray-400">Ver, editar, exportar y eliminar planificaciones.</p>
            </div>
          </div>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por título, curso o asignatura..."
            className="w-full max-w-sm rounded-2xl border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm text-gray-200 placeholder:text-gray-500 focus:border-emerald-500/40 focus:outline-none"
          />
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {loading ? (
          <div className="rounded-3xl border border-gray-800 bg-gray-900 p-8 text-center text-gray-400">
            Cargando planificaciones...
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-center text-red-200">
            No se pudieron cargar las planificaciones. {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-700 bg-gray-900/60 p-10 text-center">
            <div className="text-4xl mb-3">🗂️</div>
            <h2 className="text-lg font-medium">Aún no hay planificaciones guardadas</h2>
            <p className="mt-2 text-sm text-gray-400">
              Crea una planificación en el agente y guárdala para verla aquí.
            </p>
            <Link
              href="/educador"
              className="mt-5 inline-flex rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
            >
              Ir al planificador
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="rounded-3xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-950 p-5 shadow-lg shadow-black/20"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                        {item.nivel || "Planificación"}
                      </span>
                      <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
                        {item.tiempo_planificacion || "sin horizonte"}
                      </span>
                      <span className="rounded-full border border-gray-700 bg-gray-800 px-3 py-1 text-xs text-gray-300">
                        Creada: {formatDate(item.created_at)}
                      </span>
                    </div>

                    <h2 className="text-xl font-semibold text-white">{item.title}</h2>
                    <p className="mt-2 text-sm text-gray-300">
                      {item.curso || "Sin curso"} · {item.asignatura || "Sin asignatura"}
                    </p>
                    <p className="mt-2 line-clamp-3 text-sm text-gray-400">
                      {item.content.replace(/[#*_`>-]/g, " ").slice(0, 280)}...
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[360px]">
                    <Link
                      href={`/educador/planificaciones/${item.id}`}
                      className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-center text-sm text-cyan-200 hover:bg-cyan-500/20"
                    >
                      Editar
                    </Link>
                    <button
                      onClick={() => handleExport(item)}
                      className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-200 hover:bg-amber-500/20"
                    >
                      Exportar PDF
                    </button>
                    <button
                      onClick={() => router.push(`/educador/planificaciones/${item.id}`)}
                      className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 hover:bg-emerald-500/20"
                    >
                      Ver
                    </button>
                    <button
                      onClick={() => handleDelete(item.id, item.title)}
                      disabled={deletingId === item.id}
                      className="rounded-2xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-200 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      {deletingId === item.id ? "Eliminando..." : "Eliminar"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
