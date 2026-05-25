"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ClipboardList, RefreshCw, Search, ShieldAlert, ChevronRight } from "lucide-react"

type AdminExam = {
  id: string
  code: string | null
  title: string | null
  topic: string | null
  status: string | null
  created_at: string | null
  deleted_at: string | null
  closed_at: string | null
  teacher?: { name?: string | null; email?: string | null } | null
  submissionCount: number
  securitySessionCount: number
  blockedCount: number
  frozenCount: number
  incidentCount: number
}

export default function AdminExamenesPage() {
  const [exams, setExams] = useState<AdminExam[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (search.trim()) params.set("search", search.trim())
    if (status) params.set("status", status)
    return params.toString()
  }, [search, status])

  async function loadExams() {
    setLoading(true)
    setError("")
    const res = await fetch(`/api/admin/exams${queryString ? `?${queryString}` : ""}`)
    const data = await res.json()
    if (!data?.success) setError(data?.error || "No se pudieron cargar los exámenes.")
    setExams(data?.exams || [])
    setLoading(false)
  }

  async function runAction(examId: string, action: "close" | "reopen" | "soft_delete" | "restore") {
    setBusyId(examId)
    setError("")
    const res = await fetch("/api/admin/exams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ examId, action }),
    })
    const data = await res.json()
    if (!data?.success) setError(data?.error || "No se pudo actualizar el examen.")
    await loadExams()
    setBusyId(null)
  }

  useEffect(() => {
    loadExams()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString])

  return (
    <div className="min-h-screen bg-app text-main">
      <header className="sticky top-0 z-20 border-b border-soft bg-app/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link href="/admin" className="flex h-9 w-9 items-center justify-center rounded-xl bg-card-soft-theme text-sub hover:text-main">
            <ArrowLeft size={16} />
          </Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
            <ClipboardList size={19} />
          </div>
          <div className="flex-1">
            <h1 className="text-sm font-black">Administración de exámenes</h1>
            <p className="text-[11px] text-muted2">Ver, cerrar, reabrir, restaurar y revisar incidencias.</p>
          </div>
          <button onClick={loadExams} className="rounded-xl bg-card-soft-theme p-2 text-sub hover:text-main">
            <RefreshCw size={15} />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título, tema o código..."
              className="w-full rounded-2xl border border-soft bg-card-soft-theme py-3 pl-10 pr-4 text-sm outline-none focus:border-emerald-400/50"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-2xl border border-soft bg-card-soft-theme px-4 py-3 text-sm outline-none focus:border-emerald-400/50"
          >
            <option value="">Todos</option>
            <option value="active">Activos</option>
            <option value="closed">Cerrados</option>
            <option value="deleted">Papelera</option>
          </select>
        </div>

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {loading ? (
          <div className="rounded-3xl border border-soft bg-card-soft-theme p-10 text-center text-sub">Cargando exámenes...</div>
        ) : exams.length === 0 ? (
          <div className="rounded-3xl border border-soft bg-card-soft-theme p-10 text-center text-sub">No hay exámenes para mostrar.</div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-soft bg-card-theme">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-card-soft-theme text-left text-[11px] uppercase tracking-widest text-muted2">
                  <tr>
                    <th className="px-4 py-3">Examen</th>
                    <th className="px-4 py-3">Docente</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Respuestas</th>
                    <th className="px-4 py-3">Incidencias</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {exams.map((exam) => {
                    const deleted = Boolean(exam.deleted_at)
                    const closed = exam.status === "closed"
                    return (
                      <tr key={exam.id} className="border-t border-soft align-top">
                        <td className="px-4 py-4">
                          <p className="font-bold text-main">{exam.title || "Examen sin título"}</p>
                          <p className="text-xs text-sub">{exam.topic || "Sin tema"}</p>
                          <p className="mt-1 font-mono text-[11px] text-muted2">Código: {exam.code || "—"}</p>
                        </td>
                        <td className="px-4 py-4 text-xs text-sub">
                          <p>{exam.teacher?.name || "Docente"}</p>
                          <p className="text-muted2">{exam.teacher?.email || "—"}</p>
                        </td>
                        <td className="px-4 py-4">
                          <span className="rounded-full bg-card-soft-theme px-3 py-1 text-xs font-bold text-sub">
                            {deleted ? "Papelera" : closed ? "Cerrado" : exam.status || "Activo"}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sub">{exam.submissionCount}</td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-600">{exam.incidentCount} eventos</span>
                            <span className="rounded-full bg-red-500/10 px-2 py-1 text-red-600">{exam.blockedCount} bloqueados</span>
                            <span className="rounded-full bg-orange-500/10 px-2 py-1 text-orange-600">{exam.frozenCount} congelados</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Link href={`/examen/resultados/${exam.id}`} className="rounded-xl border border-soft px-3 py-1.5 text-xs text-sub hover:text-main">
                              Resultados <ChevronRight size={11} className="inline" />
                            </Link>
                            <Link href={`/admin/exam-security?examId=${exam.id}`} className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
                              <ShieldAlert size={11} className="inline" /> Seguridad
                            </Link>
                            {deleted ? (
                              <button disabled={busyId === exam.id} onClick={() => runAction(exam.id, "restore")} className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">Restaurar</button>
                            ) : closed ? (
                              <button disabled={busyId === exam.id} onClick={() => runAction(exam.id, "reopen")} className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">Reabrir</button>
                            ) : (
                              <button disabled={busyId === exam.id} onClick={() => runAction(exam.id, "close")} className="rounded-xl bg-slate-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">Cerrar</button>
                            )}
                            {!deleted && (
                              <button disabled={busyId === exam.id} onClick={() => runAction(exam.id, "soft_delete")} className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 disabled:opacity-50">Papelera</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
