// app/admin/exam-security/session/[id]/page.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Detalle de sesión con panel de acciones de administrador:
// freeze, block, terminate, clear_state, add_note, reopen
// ──────────────────────────────────────────────────────────────────────────────

"use client"

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import Link from "next/link"
import RiskBadgeV2 from "@/app/examen/resultados/[id]/RiskBadgeV2"
import SessionActionTimeline from "@/app/examen/resultados/[id]/SessionActionTimeline"
import IncidentSummaryCard from "@/app/examen/resultados/[id]/IncidentSummaryCard"
import type { ResultIncident } from "@/lib/exam-security/result-utils"

// ── Tipos ─────────────────────────────────────────────────────────────────────

type SessionRow = {
  id: string
  exam_id: string
  submission_id: string | null
  teacher_id: string | null
  student_name: string | null
  student_course: string | null
  student_rut: string | null
  status: string
  risk_score: number | null
  risk_level: string | null
  warning_count: number | null
  freeze_count: number | null
  block_count: number | null
  last_event_at: string | null
  last_heartbeat_at: string | null
  started_at: string
  ended_at: string | null
  client_metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

type EventRow = {
  id: string
  session_id: string
  exam_id: string
  submission_id: string | null
  event_type: string
  event_group: string | null
  severity: string
  score_delta: number | null
  question_index: number | null
  client_time_left: number | null
  visibility_state: string | null
  fullscreen: boolean | null
  window_width: number | null
  window_height: number | null
  user_agent: string | null
  incident_number: number | null
  payload: Record<string, unknown> | null
  created_at: string
}

type ActionRow = {
  id: string
  session_id: string
  exam_id: string
  submission_id: string | null
  action_type: string
  reason: string | null
  duration_seconds: number | null
  applied_by: string
  payload: Record<string, unknown> | null
  created_at: string
}

type NoteRow = {
  id: string
  session_id: string
  submission_id: string | null
  author_id: string
  note: string
  created_at: string
}

type ApiResponse = {
  success: boolean
  error?: string
  data?: {
    session: SessionRow
    events: EventRow[]
    actions: ActionRow[]
    notes: NoteRow[]
  }
}

type AdminActionType = "freeze" | "block" | "terminate" | "clear_state" | "warn" | "flag_review" | "reopen" | "unlock"

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusTone(status?: string | null) {
  switch (status) {
    case "blocked":       return "border-red-400/30 bg-red-500/15 text-red-700"
    case "frozen":        return "border-orange-400/30 bg-orange-500/15 text-orange-700"
    case "flagged":       return "border-fuchsia-400/30 bg-fuchsia-500/15 text-fuchsia-700"
    case "warned":        return "border-yellow-400/30 bg-yellow-500/15 text-yellow-700"
    case "terminated":    return "border-red-500/30 bg-red-600/15 text-red-700"
    case "finished":      return "border-emerald-400/30 bg-emerald-500/15 text-emerald-700"
    case "offline_grace": return "border-sky-400/30 bg-sky-500/15 text-sky-700"
    default:              return "border-emerald-400/30 bg-emerald-500/15 text-emerald-700"
  }
}

function eventTone(severity?: string | null) {
  switch (severity) {
    case "critical": return "border-red-500/30 bg-red-600/10"
    case "high":     return "border-orange-400/30 bg-orange-500/10"
    case "medium":   return "border-yellow-400/30 bg-yellow-500/10"
    default:         return "border-medium bg-card-soft-theme"
  }
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("es-CL", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  })
}

// ── Panel de acciones de admin ────────────────────────────────────────────────

const ADMIN_ACTIONS: {
  action: AdminActionType
  label: string
  confirm: string
  style: string
  icon: string
  disabled?: (status: string) => boolean
}[] = [
  {
    action: "warn",
    label:  "Advertir",
    confirm: "¿Enviar advertencia al estudiante?",
    style:  "border-yellow-400/30 bg-yellow-500/10 text-yellow-700 hover:bg-yellow-500/20",
    icon:   "⚠️",
  },
  {
    action: "freeze",
    label:  "Congelar",
    confirm: "¿Congelar la sesión del estudiante?",
    style:  "border-orange-400/30 bg-orange-500/10 text-orange-700 hover:bg-orange-500/20",
    icon:   "🧊",
    disabled: (s) => s === "frozen",
  },
  {
    action: "block",
    label:  "Bloquear",
    confirm: "¿Bloquear al estudiante? No podrá continuar la evaluación.",
    style:  "border-red-400/30 bg-red-500/10 text-red-700 hover:bg-red-500/20",
    icon:   "🚫",
    disabled: (s) => s === "blocked",
  },
  {
    action: "flag_review",
    label:  "Marcar revisión",
    confirm: "¿Marcar esta sesión para revisión?",
    style:  "border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-700 hover:bg-fuchsia-500/20",
    icon:   "🔍",
    disabled: (s) => s === "flagged",
  },
  {
    action: "terminate",
    label:  "Terminar",
    confirm: "⚠️ ¿TERMINAR la sesión? Esta acción invalida el intento del estudiante.",
    style:  "border-red-600/40 bg-red-600/15 text-red-800 hover:bg-red-600/25",
    icon:   "❌",
    disabled: (s) => ["terminated", "finished"].includes(s),
  },
  {
    action: "unlock",
    label:  "Desbloquear",
    confirm: "¿Desbloquear al estudiante y permitir que continúe el examen?",
    style:  "border-emerald-400/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20",
    icon:   "🔓",
    disabled: (s) => s !== "blocked",
  },
  {
    action: "reopen",
    label:  "Reabrir",
    confirm: "¿Reabrir la sesión y volver a estado activo?",
    style:  "border-emerald-400/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20",
    icon:   "↩️",
    disabled: (s) => s === "active",
  },
  {
    action: "clear_state",
    label:  "Limpiar estado",
    confirm: "¿Resetear todos los contadores (warnings, freezes, blocks) y volver a active?",
    style:  "border-sky-400/30 bg-sky-500/10 text-sky-700 hover:bg-sky-500/20",
    icon:   "🧹",
  },
]

// ── Componente AdminActionPanel ───────────────────────────────────────────────

function AdminActionPanel({
  sessionId,
  studentName,
  currentStatus,
  onActionSuccess,
}: {
  sessionId: string
  studentName: string | null
  currentStatus: string
  onActionSuccess: () => void
}) {
  const [busy,       setBusy]       = useState(false)
  const [feedback,   setFeedback]   = useState<{ ok: boolean; msg: string } | null>(null)
  const [reason,     setReason]     = useState("")
  const [noteText,   setNoteText]   = useState("")
  const [noteLoading,setNoteLoading]= useState(false)
  const [noteFeedback, setNoteFeedback] = useState<{ ok: boolean; msg: string } | null>(null)
  const [communicationKind, setCommunicationKind] = useState<"notify" | "message" | null>(null)
  const [communicationTitle, setCommunicationTitle] = useState("")
  const [communicationText, setCommunicationText] = useState("")
  const [communicationLoading, setCommunicationLoading] = useState(false)
  const [communicationFeedback, setCommunicationFeedback] = useState<{ ok: boolean; msg: string } | null>(null)

  async function handleAction(action: AdminActionType, confirmMsg: string) {
    if (!window.confirm(confirmMsg)) return

    setBusy(true)
    setFeedback(null)

    try {
      const res = await fetch(`/api/exam-security/admin/session/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reason: reason || undefined,
          adminId: "admin",
        }),
      })

      const json = await res.json()

      if (json.success) {
        setFeedback({ ok: true, msg: json.message ?? "Acción ejecutada." })
        setReason("")
        onActionSuccess()
      } else {
        setFeedback({ ok: false, msg: json.error ?? "Error desconocido." })
      }
    } catch (err) {
      console.error("[AdminActionPanel]", err)
      setFeedback({ ok: false, msg: "Error de conexión." })
    } finally {
      setBusy(false)
    }
  }

  async function handleAddNote() {
    if (!noteText.trim()) return

    setNoteLoading(true)
    setNoteFeedback(null)

    try {
      const res = await fetch(`/api/exam-security/admin/session/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_note",
          note: noteText.trim(),
        }),
      })

      const json = await res.json()

      if (json.success) {
        setNoteFeedback({ ok: true, msg: json.message ?? "Nota agregada." })
        setNoteText("")
        onActionSuccess()
      } else {
        setNoteFeedback({ ok: false, msg: json.error ?? "Error al guardar la nota." })
      }
    } catch {
      setNoteFeedback({ ok: false, msg: "Error de conexión." })
    } finally {
      setNoteLoading(false)
    }
  }

  function openCommunication(kind: "notify" | "message") {
    setCommunicationKind(kind)
    setCommunicationTitle(kind === "notify" ? "Notificación del docente" : "Mensaje del docente")
    setCommunicationText("")
    setCommunicationFeedback(null)
  }

  function closeCommunication() {
    setCommunicationKind(null)
    setCommunicationTitle("")
    setCommunicationText("")
  }

  async function handleSendCommunication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!communicationKind) return

    const message = communicationText.trim()
    if (!message) {
      setCommunicationFeedback({ ok: false, msg: "Escribe el texto antes de enviarlo." })
      return
    }

    setCommunicationLoading(true)
    setCommunicationFeedback(null)

    try {
      const res = await fetch("/api/exam-security/admin/sessions/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: communicationKind,
          target: "selected",
          sessionIds: [sessionId],
          title: communicationTitle.trim(),
          message,
        }),
      })

      const json = await res.json().catch(() => null)

      if (!json?.success) {
        setCommunicationFeedback({ ok: false, msg: json?.error || "No se pudo enviar la comunicación." })
        return
      }

      setCommunicationFeedback({ ok: true, msg: json.message || "Comunicación enviada correctamente." })
      closeCommunication()
      onActionSuccess()
    } catch (error) {
      console.error("[AdminActionPanel:handleSendCommunication]", error)
      setCommunicationFeedback({ ok: false, msg: "Error de conexión al enviar la comunicación." })
    } finally {
      setCommunicationLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-soft bg-card-theme p-5 shadow-xl space-y-5">
      <h2 className="text-xl font-semibold text-main">🎛️ Acciones de Administrador</h2>

      {/* Motivo opcional (aplica a todas las acciones de estado) */}
      <div>
        <label className="text-xs uppercase tracking-[0.15em] text-sub block mb-1.5">
          Motivo (opcional)
        </label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ej: múltiples intentos de copia detectados…"
          disabled={busy}
          className="w-full rounded-xl border border-soft bg-card-soft-theme px-3 py-2 text-sm text-main placeholder:text-sub disabled:opacity-50"
        />
      </div>

      {/* Botones de acción */}
      <div className="flex flex-wrap gap-2">
        {ADMIN_ACTIONS.map(({ action, label, confirm, style, icon, disabled }) => {
          const isDisabled = busy || (disabled?.(currentStatus) ?? false)
          return (
            <button
              type="button"
              key={action}
              onClick={() => handleAction(action, confirm)}
              disabled={isDisabled}
              className={[
                "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                style,
              ].join(" ")}
            >
              <span>{icon}</span>
              {label}
            </button>
          )
        })}
      </div>

      {/* Feedback de acción */}
      {feedback && (
        <p
          className={[
            "rounded-xl border px-4 py-2 text-sm",
            feedback.ok
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-700"
              : "border-red-400/30 bg-red-500/10 text-red-700",
          ].join(" ")}
        >
          {feedback.msg}
        </p>
      )}

      {/* Comunicación directa con el estudiante */}
      <hr className="border-soft" />

      <div className="space-y-3 rounded-2xl border border-sky-400/20 bg-sky-500/5 p-4">
        <div>
          <h3 className="text-base font-black text-main">📨 Comunicación directa con el estudiante</h3>
          <p className="mt-1 text-sm text-sub">
            Envía una notificación visible o un mensaje individual a {studentName || "este estudiante"}.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openCommunication("notify")}
            disabled={communicationLoading}
            className="rounded-xl border border-yellow-500 bg-yellow-500 px-4 py-2 text-sm font-black text-white shadow-md transition hover:bg-yellow-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            🔔 Crear notificación
          </button>
          <button
            type="button"
            onClick={() => openCommunication("message")}
            disabled={communicationLoading}
            className="rounded-xl border border-blue-700 bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-md transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            💬 Crear mensaje
          </button>
        </div>

        {communicationKind ? (
          <form onSubmit={handleSendCommunication} className="space-y-3 rounded-2xl border border-soft bg-card-theme p-4">
            <p className="text-sm font-black text-main">
              {communicationKind === "notify" ? "🔔 Enviar notificación" : "💬 Enviar mensaje"}
            </p>
            <label className="block text-sm font-bold text-main">
              Título
              <input
                value={communicationTitle}
                onChange={(event) => setCommunicationTitle(event.target.value)}
                className="mt-2 w-full rounded-xl border border-soft bg-card-soft-theme px-3 py-2 text-sm text-main"
                placeholder="Ej.: Aviso importante"
              />
            </label>
            <label className="block text-sm font-bold text-main">
              Texto
              <textarea
                value={communicationText}
                onChange={(event) => setCommunicationText(event.target.value)}
                rows={4}
                className="mt-2 w-full resize-none rounded-xl border border-soft bg-card-soft-theme px-3 py-2 text-sm text-main"
                placeholder={
                  communicationKind === "notify"
                    ? "Ej.: Mantén la pantalla completa y continúa con tu evaluación."
                    : "Ej.: Tu sesión fue revisada. Continúa desde la pregunta donde quedaste."
                }
              />
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeCommunication}
                className="rounded-xl border border-soft bg-card-soft-theme px-4 py-2 text-sm font-bold text-sub hover:text-main"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={communicationLoading || communicationText.trim().length === 0}
                className="inline-flex min-w-[12rem] items-center justify-center gap-2 rounded-xl border border-blue-700 bg-blue-600 px-5 py-2 text-sm font-black text-white shadow-lg transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
              >
                {communicationLoading
                  ? "Enviando…"
                  : communicationKind === "notify"
                    ? "📨 Enviar notificación"
                    : "📨 Enviar mensaje"}
              </button>
            </div>
          </form>
        ) : null}

        {communicationFeedback ? (
          <p
            className={[
              "rounded-xl border px-4 py-2 text-sm font-semibold",
              communicationFeedback.ok
                ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-700"
                : "border-red-400/30 bg-red-500/10 text-red-700",
            ].join(" ")}
          >
            {communicationFeedback.msg}
          </p>
        ) : null}
      </div>

      {/* Separador */}
      <hr className="border-soft" />

      {/* Agregar nota */}
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-[0.15em] text-sub block">
          📝 Agregar nota administrativa
        </label>
        <p className="text-xs leading-5 text-sub">
          Esta nota queda en el registro interno del administrador. No se envía al estudiante.
        </p>
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Descripción del incidente, observaciones, decisión tomada…"
          rows={3}
          disabled={noteLoading}
          className="w-full rounded-xl border border-soft bg-card-soft-theme px-3 py-2 text-sm text-main placeholder:text-sub resize-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleAddNote}
          disabled={noteLoading || !noteText.trim()}
          className="rounded-xl border border-slate-800 bg-slate-800 px-4 py-2 text-sm font-black text-white shadow-md transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
        >
          {noteLoading ? "Guardando…" : "💾 Guardar nota interna"}
        </button>
        {noteFeedback && (
          <p
            className={[
              "text-sm",
              noteFeedback.ok ? "text-emerald-700" : "text-red-700",
            ].join(" ")}
          >
            {noteFeedback.msg}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function ExamSecuritySessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const [sessionId, setSessionId] = useState<string>("")
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [session,   setSession]   = useState<SessionRow | null>(null)
  const [events,    setEvents]    = useState<EventRow[]>([])
  const [actions,   setActions]   = useState<ActionRow[]>([])
  const [notes,     setNotes]     = useState<NoteRow[]>([])
  const [refreshing, setRefreshing] = useState(false)

  // Resolver params
  useEffect(() => {
    let active = true
    ;(async () => {
      const resolved = await params
      if (!active) return
      setSessionId(resolved.id)
    })()
    return () => { active = false }
  }, [params])

  // Fetch datos de sesión
  const fetchData = useCallback(
    async (manual = false) => {
      if (!sessionId) return
      if (manual) setRefreshing(true)

      try {
        const res  = await fetch(`/api/exam-security/admin/session/${sessionId}`, { cache: "no-store" })
        const json = (await res.json()) as ApiResponse

        if (!json.success || !json.data) {
          setError(json.error || "No se pudo cargar el detalle de la sesión.")
          return
        }

        setSession(json.data.session)
        setEvents(json.data.events)
        setActions(json.data.actions)
        setNotes(json.data.notes)
        setError(null)
      } catch (err) {
        console.error("[ExamSecuritySessionDetailPage]", err)
        setError("Ocurrió un error cargando la sesión.")
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [sessionId]
  )

  useEffect(() => {
    setLoading(true)
    fetchData()
  }, [fetchData])

  // Incidents mapeados para el componente
  const mappedIncidents = useMemo<ResultIncident[]>(() => {
    return events.map((event) => ({
      id:             event.id,
      exam_id:        event.exam_id,
      submission_id:  event.submission_id,
      event_type:     event.event_type,
      severity:       event.severity,
      question_index: event.question_index,
      client_time_left: event.client_time_left,
      created_at:     event.created_at,
      incident_number: event.incident_number,
      metadata:       event.payload ?? {},
    }))
  }, [events])

  // ── Loading / error ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="min-h-screen bg-app p-6 text-main">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-bold">Detalle de sesión</h1>
          <p className="mt-3 text-sub">Cargando sesión…</p>
        </div>
      </main>
    )
  }

  if (error || !session) {
    return (
      <main className="min-h-screen bg-app p-6 text-main">
        <div className="mx-auto max-w-7xl">
          <Link href="/admin/exam-security" className="text-xs text-sub hover:text-main underline">
            ← Centro de Seguridad
          </Link>
          <h1 className="mt-2 text-3xl font-bold">Detalle de sesión</h1>
          <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-5 text-red-700">
            {error || "No se pudo cargar la sesión."}
          </div>
        </div>
      </main>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-app p-6 text-main">
      <div className="mx-auto max-w-7xl space-y-8">

        {/* ── Cabecera ── */}
        <div>
          <Link
            href="/admin/exam-security"
            className="text-xs text-sub hover:text-main underline underline-offset-2"
          >
            ← Centro de Seguridad
          </Link>

          <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Detalle de sesión
              </h1>
              <p className="mt-1 text-sub">
                {session.student_name || "Sin nombre"} ·{" "}
                {session.student_course || "Sin curso"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={[
                  "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
                  statusTone(session.status),
                ].join(" ")}
              >
                {session.status}
              </span>

              <RiskBadgeV2
                level={session.risk_level}
                score={session.risk_score}
                compact={false}
              />

              <button
                onClick={() => fetchData(true)}
                disabled={refreshing}
                className="rounded-xl border border-soft bg-card-soft-theme px-3 py-1.5 text-sm text-sub hover:text-main disabled:opacity-50"
              >
                {refreshing ? "↻ Actualizando…" : "↻ Actualizar"}
              </button>
            </div>
          </div>
        </div>

        {/* ── Info cards ── */}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-soft bg-card-theme p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-sub">Alumno</p>
            <p className="mt-3 text-lg font-semibold text-main">
              {session.student_name || "Sin nombre"}
            </p>
            <p className="mt-1 text-sm text-sub">{session.student_course || "Sin curso"}</p>
            <p className="mt-1 text-xs text-muted2">{session.student_rut || "Sin RUT"}</p>
          </div>

          <div className="rounded-2xl border border-soft bg-card-theme p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-sub">Examen</p>
            <p className="mt-3 break-all text-sm text-main">{session.exam_id}</p>
            <p className="mt-2 text-xs text-muted2">
              Submission: {session.submission_id || "—"}
            </p>
          </div>

          <div className="rounded-2xl border border-soft bg-card-theme p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-sub">Contadores</p>
            <div className="mt-3 space-y-1">
              <p className="text-sm text-main">
                ⚠️ Warnings: <span className="font-semibold">{session.warning_count ?? 0}</span>
              </p>
              <p className="text-sm text-main">
                🧊 Freezes: <span className="font-semibold">{session.freeze_count ?? 0}</span>
              </p>
              <p className="text-sm text-main">
                🚫 Blocks: <span className="font-semibold">{session.block_count ?? 0}</span>
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-soft bg-card-theme p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-sub">Tiempo</p>
            <div className="mt-3 space-y-1">
              <p className="text-sm text-sub">
                Inicio: <span className="text-main">{formatDateTime(session.started_at)}</span>
              </p>
              <p className="text-sm text-sub">
                Último evento: <span className="text-main">{formatDateTime(session.last_event_at)}</span>
              </p>
              <p className="text-sm text-sub">
                Heartbeat: <span className="text-main">{formatDateTime(session.last_heartbeat_at)}</span>
              </p>
            </div>
          </div>
        </section>

        {/* ── Panel de acciones admin ── */}
        <AdminActionPanel
          sessionId={session.id}
          studentName={session.student_name}
          currentStatus={session.status}
          onActionSuccess={() => fetchData()}
        />

        {/* ── Resumen de incidentes ── */}
        <section>
          <IncidentSummaryCard
            incidents={mappedIncidents}
            title="Resumen de incidentes de esta sesión"
          />
        </section>

        {/* ── Timeline de eventos + acciones + notas ── */}
        <section className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">

          {/* Eventos */}
          <div className="rounded-2xl border border-soft bg-card-theme p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-main">Timeline de eventos</h2>
              <span className="text-xs uppercase tracking-[0.18em] text-sub">
                {events.length} eventos
              </span>
            </div>

            {events.length === 0 ? (
              <p className="mt-4 text-sm text-sub">
                No hay eventos registrados en esta sesión.
              </p>
            ) : (
              <div className="mt-5 space-y-3 max-h-[36rem] overflow-y-auto pr-1">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className={[
                      "rounded-2xl border p-4",
                      eventTone(event.severity),
                    ].join(" ")}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-main">
                        {event.event_type}
                      </span>
                      <span className="rounded-full border border-soft bg-card-soft-theme px-2.5 py-1 text-xs text-sub">
                        {event.severity}
                      </span>
                      {typeof event.incident_number === "number" && (
                        <span className="rounded-full border border-soft bg-card-soft-theme px-2.5 py-1 text-xs text-sub">
                          #{event.incident_number}
                        </span>
                      )}
                      {typeof event.score_delta === "number" && (
                        <span className="rounded-full border border-soft bg-card-soft-theme px-2.5 py-1 text-xs text-sub">
                          +{event.score_delta}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 grid gap-2 text-sm text-sub md:grid-cols-2">
                      <p>Grupo: {event.event_group || "—"}</p>
                      <p>Pregunta: {event.question_index ?? "—"}</p>
                      <p>Time left: {event.client_time_left ?? "—"}</p>
                      <p>Visibility: {event.visibility_state || "—"}</p>
                      <p>Fullscreen: {String(event.fullscreen ?? "—")}</p>
                      <p>
                        Ventana:{" "}
                        {event.window_width && event.window_height
                          ? `${event.window_width}×${event.window_height}`
                          : "—"}
                      </p>
                    </div>

                    <p className="mt-3 text-xs text-muted2">
                      {formatDateTime(event.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Panel derecho: acciones + notas + cliente */}
          <div className="space-y-6">
            <SessionActionTimeline
              actions={actions.map((action) => ({
                id:               action.id,
                action_type:      action.action_type,
                reason:           action.reason,
                applied_by:       action.applied_by,
                created_at:       action.created_at,
                duration_seconds: action.duration_seconds,
              }))}
              title="Timeline de acciones"
            />

            {/* Notas administrativas */}
            <div className="rounded-2xl border border-soft bg-card-theme p-5 shadow-xl">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-main">Notas administrativas</h2>
                <span className="text-xs uppercase tracking-[0.18em] text-sub">
                  {notes.length} notas
                </span>
              </div>

              {notes.length === 0 ? (
                <p className="mt-4 text-sm text-sub">
                  No hay notas administrativas para esta sesión.
                </p>
              ) : (
                <div className="mt-5 space-y-3 max-h-60 overflow-y-auto pr-1">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className="rounded-2xl border border-soft bg-card-soft-theme p-4"
                    >
                      <p className="text-sm leading-6 text-main">{note.note}</p>
                      <p className="mt-3 text-xs text-muted2">
                        {note.author_id} · {formatDateTime(note.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Info cliente */}
            <div className="rounded-2xl border border-soft bg-card-theme p-5 shadow-xl">
              <h2 className="text-xl font-semibold text-main">Info del cliente</h2>
              <div className="mt-4 space-y-1.5 text-sm text-sub">
                <p>
                  User agent:{" "}
                  <span className="text-main break-all">
                    {typeof session.client_metadata?.userAgent === "string"
                      ? session.client_metadata.userAgent
                      : "—"}
                  </span>
                </p>
                <p>
                  Idioma:{" "}
                  <span className="text-main">
                    {typeof session.client_metadata?.language === "string"
                      ? session.client_metadata.language
                      : "—"}
                  </span>
                </p>
                <p>
                  Zona horaria:{" "}
                  <span className="text-main">
                    {typeof session.client_metadata?.timezone === "string"
                      ? session.client_metadata.timezone
                      : "—"}
                  </span>
                </p>
                <p>
                  Plataforma:{" "}
                  <span className="text-main">
                    {typeof session.client_metadata?.platform === "string"
                      ? session.client_metadata.platform
                      : "—"}
                  </span>
                </p>
                <p>
                  Resolución:{" "}
                  <span className="text-main">
                    {typeof session.client_metadata?.screenWidth === "number" &&
                    typeof session.client_metadata?.screenHeight === "number"
                      ? `${session.client_metadata.screenWidth}×${session.client_metadata.screenHeight}`
                      : "—"}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
