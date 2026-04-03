// app/admin/exam-security/session/[id]/page.tsx

"use client"

import { useEffect, useMemo, useState } from "react"
import RiskBadgeV2 from "@/app/examen/resultados/[id]/RiskBadgeV2"
import SessionActionTimeline from "@/app/examen/resultados/[id]/SessionActionTimeline"
import IncidentSummaryCard from "@/app/examen/resultados/[id]/IncidentSummaryCard"
import type { ResultIncident } from "@/lib/exam-security/result-utils"

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

function statusTone(status?: string | null) {
  switch (status) {
    case "blocked":
      return "border-red-400/30 bg-red-500/15 text-red-200"
    case "frozen":
      return "border-orange-400/30 bg-orange-500/15 text-orange-200"
    case "flagged":
      return "border-fuchsia-400/30 bg-fuchsia-500/15 text-fuchsia-200"
    case "warned":
      return "border-yellow-400/30 bg-yellow-500/15 text-yellow-200"
    case "terminated":
      return "border-red-500/30 bg-red-600/15 text-red-100"
    case "finished":
      return "border-emerald-400/30 bg-emerald-500/15 text-emerald-200"
    case "offline_grace":
      return "border-sky-400/30 bg-sky-500/15 text-sky-200"
    default:
      return "border-emerald-400/30 bg-emerald-500/15 text-emerald-200"
  }
}

function eventTone(severity?: string | null) {
  switch (severity) {
    case "critical":
      return "border-red-500/30 bg-red-600/10"
    case "high":
      return "border-orange-400/30 bg-orange-500/10"
    case "medium":
      return "border-yellow-400/30 bg-yellow-500/10"
    default:
      return "border-slate-700 bg-white/5"
  }
}

export default function ExamSecuritySessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const [sessionId, setSessionId] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<SessionRow | null>(null)
  const [events, setEvents] = useState<EventRow[]>([])
  const [actions, setActions] = useState<ActionRow[]>([])
  const [notes, setNotes] = useState<NoteRow[]>([])

  useEffect(() => {
    let active = true

    ;(async () => {
      const resolved = await params
      if (!active) return
      setSessionId(resolved.id)
    })()

    return () => {
      active = false
    }
  }, [params])

  useEffect(() => {
    if (!sessionId) return

    let active = true

    ;(async () => {
      try {
        setLoading(true)
        setError(null)

        const res = await fetch(`/api/exam-security/admin/session/${sessionId}`, {
          cache: "no-store",
        })

        const json = (await res.json()) as ApiResponse

        if (!active) return

        if (!json.success || !json.data) {
          setError(json.error || "No se pudo cargar el detalle de la sesión.")
          return
        }

        setSession(json.data.session)
        setEvents(json.data.events)
        setActions(json.data.actions)
        setNotes(json.data.notes)
      } catch (err) {
        console.error("[ExamSecuritySessionDetailPage]", err)
        if (!active) return
        setError("Ocurrió un error cargando la sesión.")
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [sessionId])

  const mappedIncidents = useMemo<ResultIncident[]>(() => {
    return events.map((event) => ({
      id: event.id,
      exam_id: event.exam_id,
      submission_id: event.submission_id,
      event_type: event.event_type,
      severity: event.severity,
      question_index: event.question_index,
      client_time_left: event.client_time_left,
      created_at: event.created_at,
      incident_number: event.incident_number,
      metadata: event.payload ?? {},
    }))
  }, [events])

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-bold">Detalle de sesión</h1>
          <p className="mt-3 text-slate-300">Cargando sesión...</p>
        </div>
      </main>
    )
  }

  if (error || !session) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-bold">Detalle de sesión</h1>
          <div className="mt-6 rounded-3xl border border-red-400/20 bg-red-500/10 p-5 text-red-100">
            {error || "No se pudo cargar la sesión."}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Detalle de sesión</h1>
            <p className="mt-2 text-slate-300">
              Revisión completa de eventos, acciones y estado de seguridad.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
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
          </div>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Alumno</p>
            <p className="mt-3 text-lg font-semibold text-white">
              {session.student_name || "Sin nombre"}
            </p>
            <p className="mt-2 text-sm text-slate-300">
              {session.student_course || "Sin curso"}
            </p>
            <p className="mt-1 text-xs text-slate-500">{session.student_rut || "Sin RUT"}</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Examen</p>
            <p className="mt-3 break-all text-sm text-white">{session.exam_id}</p>
            <p className="mt-2 text-xs text-slate-500">
              Submission: {session.submission_id || "—"}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Contadores</p>
            <p className="mt-3 text-sm text-slate-200">
              Warnings: {session.warning_count ?? 0}
            </p>
            <p className="mt-1 text-sm text-slate-200">
              Freezes: {session.freeze_count ?? 0}
            </p>
            <p className="mt-1 text-sm text-slate-200">
              Blocks: {session.block_count ?? 0}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Tiempo</p>
            <p className="mt-3 text-sm text-slate-200">Inicio: {session.started_at}</p>
            <p className="mt-1 text-sm text-slate-200">
              Último evento: {session.last_event_at || "—"}
            </p>
            <p className="mt-1 text-sm text-slate-200">
              Último heartbeat: {session.last_heartbeat_at || "—"}
            </p>
          </div>
        </section>

        <section className="mt-8">
          <IncidentSummaryCard
            incidents={mappedIncidents}
            title="Resumen de incidentes de esta sesión"
          />
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-white">Timeline de eventos</h2>
              <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                {events.length} eventos
              </span>
            </div>

            {events.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400">
                No hay eventos registrados en esta sesión.
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className={[
                      "rounded-2xl border p-4",
                      eventTone(event.severity),
                    ].join(" ")}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-white">
                        {event.event_type}
                      </span>

                      <span className="rounded-full border border-white/10 bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                        {event.severity}
                      </span>

                      {typeof event.incident_number === "number" ? (
                        <span className="rounded-full border border-white/10 bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                          #{event.incident_number}
                        </span>
                      ) : null}

                      {typeof event.score_delta === "number" ? (
                        <span className="rounded-full border border-white/10 bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                          +{event.score_delta}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-3 grid gap-2 text-sm text-slate-300 md:grid-cols-2">
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

                    <p className="mt-3 text-xs text-slate-500">{event.created_at}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <SessionActionTimeline
              actions={actions.map((action) => ({
                id: action.id,
                action_type: action.action_type,
                reason: action.reason,
                applied_by: action.applied_by,
                created_at: action.created_at,
                duration_seconds: action.duration_seconds,
              }))}
              title="Timeline de acciones"
            />

            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-xl">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-white">Notas administrativas</h2>
                <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  {notes.length} notas
                </span>
              </div>

              {notes.length === 0 ? (
                <p className="mt-4 text-sm text-slate-400">
                  No hay notas administrativas registradas para esta sesión.
                </p>
              ) : (
                <div className="mt-5 space-y-3">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <p className="text-sm leading-6 text-slate-200">{note.note}</p>
                      <p className="mt-3 text-xs text-slate-500">
                        {note.author_id} · {note.created_at}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-xl">
              <h2 className="text-xl font-semibold text-white">Cliente</h2>

              <div className="mt-4 space-y-2 text-sm text-slate-300">
                <p>
                  User agent:{" "}
                  {typeof session.client_metadata?.userAgent === "string"
                    ? session.client_metadata.userAgent
                    : "—"}
                </p>
                <p>
                  Idioma:{" "}
                  {typeof session.client_metadata?.language === "string"
                    ? session.client_metadata.language
                    : "—"}
                </p>
                <p>
                  Zona horaria:{" "}
                  {typeof session.client_metadata?.timezone === "string"
                    ? session.client_metadata.timezone
                    : "—"}
                </p>
                <p>
                  Plataforma:{" "}
                  {typeof session.client_metadata?.platform === "string"
                    ? session.client_metadata.platform
                    : "—"}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
