// app/admin/exam-security/page.tsx

"use client"

import { useEffect, useMemo, useState } from "react"

type DashboardSummary = {
  totalSessions: number
  activeSessions: number
  frozenSessions: number
  blockedSessions: number
  flaggedSessions: number
  highRiskSessions: number
  totalEvents: number
  totalActions: number
  incidentsBySeverity: {
    low: number
    medium: number
    high: number
    critical: number
  }
}

type SessionRow = {
  id: string
  exam_id: string
  submission_id: string | null
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
  created_at: string
  updated_at: string
}

type EventRow = {
  id: string
  session_id: string
  exam_id: string
  submission_id: string | null
  event_type: string
  severity: string
  incident_number: number | null
  created_at: string
}

type ActionRow = {
  id: string
  session_id: string
  exam_id: string
  submission_id: string | null
  action_type: string
  reason: string | null
  applied_by: string
  created_at: string
}

type DashboardResponse = {
  success: boolean
  error?: string
  data?: {
    summary: DashboardSummary
    sessions: SessionRow[]
    recentEvents: EventRow[]
    recentActions: ActionRow[]
  }
}

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string
  value: number
  subtitle?: string
}) {
  return (
    <div className="rounded-2xl border border-soft bg-card-theme p-5 shadow-xl">
      <p className="text-xs uppercase tracking-[0.18em] text-sub">{title}</p>
      <p className="mt-3 text-3xl font-bold text-main">{value}</p>
      {subtitle ? <p className="mt-2 text-sm text-sub">{subtitle}</p> : null}
    </div>
  )
}

function toneForRisk(riskLevel: string | null | undefined) {
  switch (riskLevel) {
    case "high":
      return "bg-orange-500/15 text-orange-700 border-orange-400/30"
    case "medium":
      return "bg-yellow-500/15 text-yellow-700 border-yellow-400/30"
    case "low":
      return "bg-sky-500/15 text-sky-300 border-sky-400/30"
    default:
      return "bg-emerald-500/15 text-emerald-700 border-emerald-400/30"
  }
}

function toneForStatus(status: string | null | undefined) {
  switch (status) {
    case "blocked":
      return "bg-red-500/15 text-red-700 border-red-400/30"
    case "frozen":
      return "bg-orange-500/15 text-orange-700 border-orange-400/30"
    case "flagged":
      return "bg-fuchsia-500/15 text-fuchsia-700 border-fuchsia-400/30"
    case "warned":
      return "bg-yellow-500/15 text-yellow-700 border-yellow-400/30"
    case "offline_grace":
      return "bg-sky-500/15 text-sky-300 border-sky-400/30"
    case "finished":
      return "bg-emerald-500/15 text-emerald-700 border-emerald-400/30"
    case "terminated":
      return "bg-red-600/15 text-red-700 border-red-400/30"
    default:
      return "bg-emerald-500/15 text-emerald-700 border-emerald-400/30"
  }
}

export default function ExamSecurityAdminPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [recentEvents, setRecentEvents] = useState<EventRow[]>([])
  const [recentActions, setRecentActions] = useState<ActionRow[]>([])

  useEffect(() => {
    let active = true

    ;(async () => {
      try {
        setLoading(true)
        setError(null)

        const res = await fetch("/api/exam-security/admin/dashboard", {
          cache: "no-store",
        })

        const json = (await res.json()) as DashboardResponse

        if (!active) return

        if (!json.success || !json.data) {
          setError(json.error || "No se pudo cargar el dashboard.")
          return
        }

        setSummary(json.data.summary)
        setSessions(json.data.sessions)
        setRecentEvents(json.data.recentEvents)
        setRecentActions(json.data.recentActions)
      } catch (err) {
        console.error("[ExamSecurityAdminPage]", err)
        if (!active) return
        setError("Ocurrió un error cargando el dashboard.")
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [])

  const topSessions = useMemo(() => {
    return [...sessions]
      .sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0))
      .slice(0, 10)
  }, [sessions])

  if (loading) {
    return (
      <main className="min-h-screen bg-app p-6 text-main">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-bold">Exam Security Admin</h1>
          <p className="mt-3 text-sub">Cargando dashboard de seguridad...</p>
        </div>
      </main>
    )
  }

  if (error || !summary) {
    return (
      <main className="min-h-screen bg-app p-6 text-main">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-bold">Exam Security Admin</h1>
          <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-5 text-red-700">
            {error || "No se pudo cargar la información del dashboard."}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-app p-6 text-main">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Exam Security Admin
            </h1>
            <p className="mt-2 text-sub">
              Panel general de sesiones, incidentes y acciones automáticas.
            </p>
          </div>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Sesiones totales"
            value={summary.totalSessions}
            subtitle="Ventana reciente del dashboard"
          />
          <StatCard
            title="Sesiones activas"
            value={summary.activeSessions}
            subtitle="Active, warned, frozen, blocked, flagged"
          />
          <StatCard
            title="Riesgo medio / alto"
            value={summary.highRiskSessions}
            subtitle="Casos que requieren revisión"
          />
          <StatCard
            title="Eventos registrados"
            value={summary.totalEvents}
            subtitle="Incidentes en la ventana consultada"
          />
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          <StatCard title="Frozen" value={summary.frozenSessions} />
          <StatCard title="Blocked" value={summary.blockedSessions} />
          <StatCard title="Flagged" value={summary.flaggedSessions} />
          <StatCard title="Acciones" value={summary.totalActions} />
        </section>

        <section className="mt-8 rounded-2xl border border-soft bg-card-theme p-5 shadow-xl">
          <h2 className="text-xl font-semibold text-main">Incidentes por severidad</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-soft bg-card-soft-theme p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-sub">Low</p>
              <p className="mt-2 text-2xl font-bold text-sky-300">
                {summary.incidentsBySeverity.low}
              </p>
            </div>
            <div className="rounded-2xl border border-soft bg-card-soft-theme p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-sub">Medium</p>
              <p className="mt-2 text-2xl font-bold text-yellow-700">
                {summary.incidentsBySeverity.medium}
              </p>
            </div>
            <div className="rounded-2xl border border-soft bg-card-soft-theme p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-sub">High</p>
              <p className="mt-2 text-2xl font-bold text-orange-700">
                {summary.incidentsBySeverity.high}
              </p>
            </div>
            <div className="rounded-2xl border border-soft bg-card-soft-theme p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-sub">Critical</p>
              <p className="mt-2 text-2xl font-bold text-red-700">
                {summary.incidentsBySeverity.critical}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-soft bg-card-theme p-5 shadow-xl">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-main">Sesiones con mayor riesgo</h2>
            <span className="text-sm text-sub">Top 10</span>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-soft text-left text-sub">
                  <th className="px-3 py-3">Alumno</th>
                  <th className="px-3 py-3">Curso</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Riesgo</th>
                  <th className="px-3 py-3">Score</th>
                  <th className="px-3 py-3">Warnings</th>
                  <th className="px-3 py-3">Freezes</th>
                  <th className="px-3 py-3">Blocks</th>
                </tr>
              </thead>
              <tbody>
                {topSessions.map((session) => (
                  <tr key={session.id} className="border-b border-soft">
                    <td className="px-3 py-3 text-main">
                      {session.student_name || "Sin nombre"}
                    </td>
                    <td className="px-3 py-3 text-sub">
                      {session.student_course || "—"}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={[
                          "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                          toneForStatus(session.status),
                        ].join(" ")}
                      >
                        {session.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={[
                          "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                          toneForRisk(session.risk_level),
                        ].join(" ")}
                      >
                        {session.risk_level || "clean"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-main">{session.risk_score ?? 0}</td>
                    <td className="px-3 py-3 text-sub">
                      {session.warning_count ?? 0}
                    </td>
                    <td className="px-3 py-3 text-sub">
                      {session.freeze_count ?? 0}
                    </td>
                    <td className="px-3 py-3 text-sub">
                      {session.block_count ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {topSessions.length === 0 ? (
              <p className="mt-4 text-sm text-sub">
                No hay sesiones registradas en la ventana actual.
              </p>
            ) : null}
          </div>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-soft bg-card-theme p-5 shadow-xl">
            <h2 className="text-xl font-semibold text-main">Incidentes recientes</h2>

            <div className="mt-4 space-y-3">
              {recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="rounded-2xl border border-soft bg-card-soft-theme p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-main">
                      {event.event_type}
                    </span>
                    <span className="rounded-full border border-soft bg-card-soft-theme px-2 py-0.5 text-xs text-sub">
                      {event.severity}
                    </span>
                    {typeof event.incident_number === "number" ? (
                      <span className="rounded-full border border-soft bg-card-soft-theme px-2 py-0.5 text-xs text-sub">
                        #{event.incident_number}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-2 text-xs text-sub">
                    Sesión: {event.session_id}
                  </p>
                  <p className="mt-1 text-xs text-muted2">{event.created_at}</p>
                </div>
              ))}

              {recentEvents.length === 0 ? (
                <p className="text-sm text-sub">
                  No hay incidentes recientes.
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-soft bg-card-theme p-5 shadow-xl">
            <h2 className="text-xl font-semibold text-main">Acciones recientes</h2>

            <div className="mt-4 space-y-3">
              {recentActions.map((action) => (
                <div
                  key={action.id}
                  className="rounded-2xl border border-soft bg-card-soft-theme p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-main">
                      {action.action_type}
                    </span>
                    <span className="rounded-full border border-soft bg-card-soft-theme px-2 py-0.5 text-xs text-sub">
                      {action.applied_by}
                    </span>
                  </div>

                  {action.reason ? (
                    <p className="mt-2 text-sm text-sub">{action.reason}</p>
                  ) : null}

                  <p className="mt-2 text-xs text-sub">
                    Sesión: {action.session_id}
                  </p>
                  <p className="mt-1 text-xs text-muted2">{action.created_at}</p>
                </div>
              ))}

              {recentActions.length === 0 ? (
                <p className="text-sm text-sub">
                  No hay acciones recientes.
                </p>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
