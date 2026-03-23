"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, Plus, ClipboardList, Pencil,
  BarChart2, Clock, Trash2, RotateCcw,
  Archive, ChevronLeft
} from "lucide-react"

export default function ExamenesDocentePage() {
  const [user,          setUser]          = useState<any>(null)
  const [exams,         setExams]         = useState<any[]>([])
  const [deletedExams,  setDeletedExams]  = useState<any[]>([])
  const [loading,       setLoading]       = useState(true)
  const [loadingTrash,  setLoadingTrash]  = useState(false)
  const [showTrash,     setShowTrash]     = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [confirmPerm,   setConfirmPerm]   = useState<string | null>(null)
  const supabase = createClient()
  const router   = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/login"); return }
      setUser(user)
      await loadExams(user.id)
      setLoading(false)
    })
  }, [])

  async function loadExams(uid: string) {
    const res  = await fetch(`/api/agents/examen-docente?teacherId=${uid}`)
    const data = await res.json()
    setExams(data.exams || [])
  }

  async function loadTrash(uid: string) {
    setLoadingTrash(true)
    const res  = await fetch(`/api/agents/examen-docente?teacherId=${uid}&showDeleted=true`)
    const data = await res.json()
    setDeletedExams(data.exams || [])
    setLoadingTrash(false)
  }

  function toggleTrash() {
    const next = !showTrash
    setShowTrash(next)
    if (next && user) loadTrash(user.id)
  }

  // ── Soft delete ───────────────────────────────────────────────────────────
  async function deleteExam(examId: string) {
    if (!user) return
    setConfirmDelete(null)
    const res  = await fetch("/api/agents/examen-docente", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", examId, teacherId: user.id }),
    })
    const data = await res.json()
    if (data.success) {
      setExams(prev => prev.filter(e => e.id !== examId))
    }
  }

  // ── Restaurar desde papelera ──────────────────────────────────────────────
  async function restoreExam(examId: string) {
    if (!user) return
    const res  = await fetch("/api/agents/examen-docente", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore", examId, teacherId: user.id }),
    })
    const data = await res.json()
    if (data.success) {
      const restored = deletedExams.find(e => e.id === examId)
      setDeletedExams(prev => prev.filter(e => e.id !== examId))
      if (restored) setExams(prev => [{ ...restored, deleted_at: null }, ...prev])
    }
  }

  // ── Eliminar permanente ───────────────────────────────────────────────────
  async function permanentDelete(examId: string) {
    if (!user) return
    setConfirmPerm(null)
    const res  = await fetch("/api/agents/examen-docente", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "permanent_delete", examId, teacherId: user.id }),
    })
    const data = await res.json()
    if (data.success) {
      setDeletedExams(prev => prev.filter(e => e.id !== examId))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-blue-400 animate-spin" />
      </div>
    )
  }

  // ── Shared card component ─────────────────────────────────────────────────
  function ExamCard({ exam, inTrash }: { exam: any; inTrash?: boolean }) {
    return (
      <div className="rounded-2xl border p-4 transition-all"
           style={{ background: inTrash ? "rgba(239,68,68,0.04)" : "rgba(255,255,255,0.02)", borderColor: inTrash ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.07)" }}>

        {/* Título + badge */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <h3 className="text-white font-semibold text-sm truncate">{exam.title}</h3>
              {!inTrash && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
                      style={{
                        background: exam.status === "active" ? "rgba(34,197,94,0.1)"   : "rgba(107,114,128,0.1)",
                        color:      exam.status === "active" ? "#4ade80"              : "#9ca3af",
                        border:     `1px solid ${exam.status === "active" ? "rgba(34,197,94,0.2)" : "rgba(107,114,128,0.15)"}`,
                      }}>
                  {exam.status === "active" ? "Activo" : "Cerrado"}
                </span>
              )}
              {inTrash && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
                      style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
                  🗑 En papelera
                </span>
              )}
            </div>
            <p className="text-gray-500 text-xs truncate">{exam.topic}</p>
          </div>
          <div className="text-center flex-shrink-0">
            <p className="text-blue-400 font-bold text-xl leading-none">{exam.submissionCount}</p>
            <p className="text-gray-600 text-[10px] mt-0.5">respuestas</p>
          </div>
        </div>

        {/* Info */}
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <span className="text-gray-600 text-xs flex items-center gap-1">
            <ClipboardList size={10} /> {exam.settings?.questionCount || "?"} preguntas
          </span>
          <span className="text-gray-600 text-xs flex items-center gap-1">
            <Clock size={10} /> {exam.settings?.timeLimit || "?"} min
          </span>
          <span className="text-gray-700 text-xs">
            {new Date(exam.created_at).toLocaleDateString("es-CL")}
          </span>
          {inTrash && exam.deleted_at && (
            <span className="text-red-400/70 text-[10px] ml-auto">
              Eliminado {new Date(exam.deleted_at).toLocaleDateString("es-CL")}
            </span>
          )}
          {!inTrash && (
            <span className="text-gray-700 font-mono text-xs ml-auto">{exam.code}</span>
          )}
        </div>

        {/* Botones */}
        {!inTrash ? (
          <div className="flex gap-2">
            <Link href={`/examen/resultados/${exam.id}`}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-medium transition-all"
              style={{ background: "rgba(59,130,246,0.08)", borderColor: "rgba(59,130,246,0.2)", color: "#93c5fd" }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(59,130,246,0.15)"; el.style.borderColor = "rgba(59,130,246,0.35)" }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(59,130,246,0.08)"; el.style.borderColor = "rgba(59,130,246,0.2)" }}>
              <BarChart2 size={12} /> Ver resultados
              {exam.submissionCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                      style={{ background: "rgba(59,130,246,0.25)", color: "#93c5fd" }}>
                  {exam.submissionCount}
                </span>
              )}
            </Link>
            <Link href={`/examen/editar/${exam.id}`}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-medium transition-all"
              style={{ background: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.2)", color: "#fcd34d" }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(245,158,11,0.15)"; el.style.borderColor = "rgba(245,158,11,0.35)" }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(245,158,11,0.08)"; el.style.borderColor = "rgba(245,158,11,0.2)" }}>
              <Pencil size={12} /> Editar
            </Link>
            {exam.status === "closed" && (
              <button
                onClick={() => setConfirmDelete(exam.id)}
                className="w-9 flex items-center justify-center rounded-xl border transition-all flex-shrink-0"
                style={{ background: "rgba(239,68,68,0.06)", borderColor: "rgba(239,68,68,0.18)", color: "#f87171" }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(239,68,68,0.15)"; el.style.borderColor = "rgba(239,68,68,0.35)" }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(239,68,68,0.06)"; el.style.borderColor = "rgba(239,68,68,0.18)" }}
                title="Mover a papelera">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => restoreExam(exam.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-medium transition-all"
              style={{ background: "rgba(34,197,94,0.08)", borderColor: "rgba(34,197,94,0.2)", color: "#4ade80" }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(34,197,94,0.15)"; el.style.borderColor = "rgba(34,197,94,0.35)" }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(34,197,94,0.08)"; el.style.borderColor = "rgba(34,197,94,0.2)" }}>
              <RotateCcw size={12} /> Restaurar
            </button>
            <button onClick={() => setConfirmPerm(exam.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-medium transition-all"
              style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.2)", color: "#f87171" }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(239,68,68,0.15)"; el.style.borderColor = "rgba(239,68,68,0.35)" }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(239,68,68,0.08)"; el.style.borderColor = "rgba(239,68,68,0.2)" }}>
              <Trash2 size={12} /> Eliminar definitivo
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950">

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-gray-950/90 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard"
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.06] text-gray-400 hover:text-white transition-all">
              <ArrowLeft size={15} />
            </Link>
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center shadow-md"
                 style={{ background: "linear-gradient(135deg, #dc2626, #ef4444)", boxShadow: "0 4px 12px rgba(220,38,38,0.3)" }}>
              <ClipboardList size={17} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-sm">Exámenes para Docentes</h1>
              <p className="text-gray-600 text-[11px]">Crea exámenes y comparte el link con tus estudiantes</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Botón papelera */}
            <button onClick={toggleTrash}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all"
              style={{
                background:  showTrash ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.04)",
                borderColor: showTrash ? "rgba(239,68,68,0.3)"  : "rgba(255,255,255,0.08)",
                color:       showTrash ? "#f87171"               : "#9ca3af",
              }}
              title="Ver papelera">
              <Archive size={13} />
              {!showTrash ? "Papelera" : "← Volver"}
            </button>

            {!showTrash && (
              <Link href="/examen/crear"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white flex-shrink-0 transition-all"
                style={{ background: "linear-gradient(135deg, #dc2626, #ef4444)", boxShadow: "0 2px 8px rgba(220,38,38,0.25)" }}>
                <Plus size={14} /> Crear examen
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Modal: mover a papelera */}
        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
            <div className="relative w-full max-w-sm rounded-2xl p-6 shadow-2xl"
                 style={{ background: "#0f172a", border: "1px solid rgba(239,68,68,0.3)" }}>
              <div className="text-3xl mb-3 text-center">🗑️</div>
              <h3 className="text-white font-bold text-center mb-1">¿Mover a la papelera?</h3>
              <p className="text-gray-400 text-sm text-center mb-5">
                El examen se guardará en la papelera. Podrás restaurarlo cuando quieras.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-2.5 rounded-xl border text-sm font-medium text-gray-400"
                  style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                  Cancelar
                </button>
                <button onClick={() => deleteExam(confirmDelete)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
                  style={{ background: "#dc2626" }}>
                  Mover a papelera
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: eliminar permanente */}
        {confirmPerm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmPerm(null)} />
            <div className="relative w-full max-w-sm rounded-2xl p-6 shadow-2xl"
                 style={{ background: "#0f172a", border: "1px solid rgba(239,68,68,0.4)" }}>
              <div className="text-3xl mb-3 text-center">⚠️</div>
              <h3 className="text-white font-bold text-center mb-1">¿Eliminar definitivamente?</h3>
              <p className="text-gray-400 text-sm text-center mb-5">
                Se eliminarán el examen y todas las respuestas de estudiantes. <strong className="text-red-400">Esta acción no se puede deshacer.</strong>
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmPerm(null)}
                  className="flex-1 py-2.5 rounded-xl border text-sm font-medium text-gray-400"
                  style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                  Cancelar
                </button>
                <button onClick={() => permanentDelete(confirmPerm)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
                  style={{ background: "#7f1d1d" }}>
                  Sí, eliminar para siempre
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Vista principal ─────────────────────────────────────────────── */}
        {!showTrash && (
          exams.length === 0 ? (
            <div className="flex flex-col items-center py-16 rounded-2xl border text-center"
                 style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.07)" }}>
              <div className="text-4xl mb-3">📝</div>
              <h3 className="text-white font-bold mb-2">Sin exámenes aún</h3>
              <p className="text-gray-500 text-sm mb-5">Crea tu primer examen con IA y comparte el link</p>
              <Link href="/examen/crear"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #dc2626, #ef4444)" }}>
                <Plus size={16} /> Crear mi primer examen
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {exams.map(exam => <ExamCard key={exam.id} exam={exam} />)}
            </div>
          )
        )}

        {/* ── Vista papelera ──────────────────────────────────────────────── */}
        {showTrash && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Archive size={16} className="text-red-400" />
              <h2 className="text-white font-semibold text-sm">Papelera de exámenes</h2>
              <span className="text-gray-600 text-xs ml-auto">
                Los exámenes aquí pueden restaurarse o eliminarse permanentemente
              </span>
            </div>

            {loadingTrash ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-red-400 animate-spin" />
              </div>
            ) : deletedExams.length === 0 ? (
              <div className="flex flex-col items-center py-16 rounded-2xl border text-center"
                   style={{ background: "rgba(239,68,68,0.03)", borderColor: "rgba(239,68,68,0.12)" }}>
                <Archive size={32} className="text-gray-700 mb-3" />
                <h3 className="text-gray-400 font-medium mb-1">Papelera vacía</h3>
                <p className="text-gray-600 text-sm">Los exámenes eliminados aparecerán aquí</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {deletedExams.map(exam => <ExamCard key={exam.id} exam={exam} inTrash />)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
