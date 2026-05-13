// app/admin/exam-security/page.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Panel de seguridad de evaluaciones — Dashboard con auto-refresh, filtros,
// navegación a detalle de sesión y monitoreo en tiempo real.
// ──────────────────────────────────────────────────────────────────────────────

"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"

// ── Tipos ─────────────────────────────────────────────────────────────────────

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

// ── Helpers de color ──────────────────────────────────────────────────────────

function toneForRisk(level: string | null | undefined) {
  switch (level) {
    case "high":     return "bg-orange-500/15 text-orange-700 border-orange-400/30"
    case "medium":   return "bg-yellow-500/15 text-yellow-700 border-yellow-400/30"
    case "low":      return "bg-sky-500/15 text-sky-700 border-sky-400/30"
    default:         return "bg-emerald-500/15 text-emerald-700 border-emerald-400/30"
  }
}

function toneForStatus(status: string | null | undefined) {
  switch (status) {
    case "blocked":      return "bg-red-500/15 text-red-700 border-red-400/30"
    case "frozen":       return "bg-orange-500/15 text-orange-700 border-orange-400/30"
    case "flagged":      return "bg-fuchsia-500/15 text-fuchsia-700 border-fuchsia-400/30"
    case "warned":       return "bg-yellow-500/15 text-yellow-700 border-yellow-400/30"
    case "offline_grace":return "bg-sky-500/15 text-sky-700 border-sky-400/30"
    case "finished":     return "bg-emerald-500/15 text-emerald-700 border-emerald-400/30"
    case "terminated":   return "bg-red-600/15 text-red-700 border-red-400/30"
    default:             return "bg-emerald-500/15 text-emerald-700 border-emerald-400/30"
  }
}

function rowRiskBorder(level: string | null | undefined) {
  switch (level) {
    case "high":   return "border-l-4 border-l-orange-500"
    case "medium": return "border-l-4 border-l-yellow-500"
    default:       return ""
  }
}

function formatTime(iso: string | null | undefined) {
  if (!iso) return "—"
  return new Date(iso).toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  subtitle,
  accent,
}: {
  title: string
  value: number
  subtitle?: string
  accent?: "red" | "orange" | "yellow" | "emerald" | "sky" | "fuchsia"
}) {
  const accentColors: Record<string, string> = {
    red:     "text-red-600",
    orange:  "text-orange-600",
    yellow:  "text-yellow-600",
    emerald: "text-emerald-600",
    sky:     "text-sky-600",
    fuchsia: "text-fuchsia-600",
  }
  const accentClass = (accent && accentColors[accent]) || "text-main"

  return (
    <div className="rounded-2xl border border-soft bg-card-theme p-5 shadow-xl">
      <p className="text-xs uppercase tracking-[0.18em] text-sub">{title}</p>
      <p className={`mt-3 text-3xl font-bold ${accentClass}`}>{value}</p>
      {subtitle ? <p className="mt-2 text-sm text-sub">{subtitle}</p> : null}
    </div>
  )
}

function LiveDot({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
    </span>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

const HOURS_OPTIONS = [6, 12, 24, 48, 72]
const REFRESH_INTERVAL_MS = 15_000

export default function ExamSecurityAdminPage() {
  const [loading,       setLoading]       = useState(true)
  const [refreshing,    setRefreshing]    = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [summary,       setSummary]       = useState<DashboardSummary | null>(null)
  const [sessions,      setSessions]      = useState<SessionRow[]>([])
  const [recentEvents,  setRecentEvents]  = useState<EventRow[]>([])
  const [recentActions, setRecentActions] = useState<ActionRow[]>([])
  const [lastUpdated,   setLastUpdated]   = useState<Date | null>(null)

  // Filtros
  const [hoursWindow,   setHoursWindow]   = useState(24)
  const [filterStatus,  setFilterStatus]  = useState("")
  const [filterRisk,    setFilterRisk]    = useState("")
  const [searchName,    setSearchName]    = useState("")

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const fetchDashboard = useCallback(
    async (isManual = false) => {
      if (isManual) setRefreshing(true)

      try {
        const url = `/api/exam-security/admin/dashboard?hours=${hoursWindow}`
        const res = await fetch(url, { cache: "no-store" })
        const json = (await res.json()) as DashboardResponse

        if (!json.success || !json.data) {
          setError(json.error || "No se pudo cargar el dashboard.")
          return
        }

        setSummary(json.data.summary)
        setSessions(json.data.sessions)
        setRecentEvents(json.data.recentEvents)
        setRecentActions(json.data.recentActions)
        setLastUpdated(new Date())
        setError(null)
      } catch (err) {
        console.error("[ExamSecurityAdminPage] fetch error", err)
        setError("Error de conexión al cargar el dashboard.")
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [hoursWindow]
  )

  // Primer fetch + auto-refresh
  useEffect(() => {
    setLoading(true)
    fetchDashboard()

    timerRef.current = setInterval(() => {
      fetchDashboard()
    }, REFRESH_INTERVAL_MS)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [fetchDashboard])

  // ── Sesiones filtradas ────────────────────────────────────────────────────────

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (filterStatus && s.status !== filterStatus) return false
      if (filterRisk && s.risk_level !== filterRisk) return false
      if (searchName) {
        const haystack = (s.student_name ?? "").toLowerCase()
        if (!haystack.includes(searchName.toLowerCase())) return false
      }
      return true
    })
  }, [sessions, filterStatus, filterRisk, searchName])

  const sortedSessions = useMemo(
    () =>
      [...filteredSessions].sort(
        (a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0)
      ),
    [filteredSessions]
  )

  // ── Render: loading / error ───────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="min-h-screen bg-app p-6 text-main">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-bold">Centro de Seguridad</h1>
          <p className="mt-3 text-sub">Cargando dashboard de seguridad…</p>
        </div>
      </main>
    )
  }

  if (error || !summary) {
    return (
      <main className="min-h-screen bg-app p-6 text-main">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-bold">Centro de Seguridad</h1>
          <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-5 text-red-700">
            {error || "No se pudo cargar la información del dashboard."}
          </div>
          <button
            onClick={() => fetchDashboard(true)}
            className="mt-4 rounded-xl bg-card-theme border border-soft px-4 py-2 text-sm text-main hover:opacity-80"
          >
            Reintentar
          </button>
        </div>
      </main>
    )
  }

  const hasActiveSessions = summary.activeSessions > 0

  // ── Render: dashboard ─────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-app p-6 text-main">
      <div className="mx-auto max-w-7xl space-y-8">

        {/* ── Cabecera ── */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <Link
              href="/admin"
              className="text-xs text-sub hover:text-main underline underline-offset-2"
            >
              ← Panel Admin
            </Link>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              🛡️ Centro de Seguridad
            </h1>
            <p className="mt-1 text-sub">
              Monitor de sesiones, incidentes y acciones automáticas en evaluaciones.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Indicador live */}
            <div className="flex items-center gap-2 rounded-full border border-soft bg-card-theme px-3 py-1.5">
              <LiveDot active={hasActiveSessions} />
              <span className="text-xs text-sub">
                {hasActiveSessions
                  ? `${summary.activeSessions} activa${summary.activeSessions !== 1 ? "s" : ""}`
                  : "Sin sesiones activas"}
              </span>
            </div>

            {/* Ventana de tiempo */}
            <select
              value={hoursWindow}
              onChange={(e) => setHoursWindow(Number(e.target.value))}
              className="rounded-xl border border-soft bg-card-theme px-3 py-1.5 text-sm text-main"
            >
              {HOURS_OPTIONS.map((h) => (
                <option key={h} value={h}>
                  Últimas {h}h
                </option>
              ))}
            </select>

            {/* Botón actualizar */}
            <button
              onClick={() => fetchDashboard(true)}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-xl border border-soft bg-card-theme px-4 py-1.5 text-sm text-main hover:opacity-80 disabled:opacity-50"
            >
              <span className={refreshing ? "animate-spin" : ""}>↻</span>
              {refreshing ? "Actualizando…" : "Actualizar"}
            </button>
          </div>
        </div>

        {/* Última actualización */}
        {lastUpdated && (
          <p className="-mt-4 text-xs text-sub">
            Última actualización: {lastUpdated.toLocaleTimeString("es-CL")} · Actualización
            automática cada {REFRESH_INTERVAL_MS / 1000}s
          </p>
        )}

        {/* ── Stats principales ── */}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Sesiones totales"
            value={summary.totalSessions}
            subtitle={`Ventana de ${hoursWindow}h`}
          />
          <StatCard
            title="Sesiones activas"
            value={summary.activeSessions}
            subtitle="Active, warned, frozen, blocked, flagged"
            accent={summary.activeSessions > 0 ? "sky" : undefined}
          />
          <StatCard
            title="Riesgo medio/alto"
            value={summary.highRiskSessions}
            subtitle="Requieren revisión"
            accent={summary.highRiskSessions > 0 ? "orange" : undefined}
          />
          <StatCard
            title="Eventos registrados"
            value={summary.totalEvents}
            subtitle="Incidentes en la ventana"
          />
        </section>

        {/* ── Stats secundarios ── */}
        <section className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <StatCard
            title="Frozen"
            value={summary.frozenSessions}
            accent={summary.frozenSessions > 0 ? "orange" : undefined}
          />
          <StatCard
            title="Blocked"
            value={summary.blockedSessions}
            accent={summary.blockedSessions > 0 ? "red" : undefined}
          />
          <StatCard
            title="Flagged"
            value={summary.flaggedSessions}
            accent={summary.flaggedSessions > 0 ? "fuchsia" : undefined}
          />
          <StatCard title="Acciones" value={summary.totalActions} />
        </section>

        {/* ── Incidentes por severidad ── */}
        <section className="rounded-2xl border border-soft bg-card-theme p-5 shadow-xl">
          <h2 className="text-xl font-semibold text-main">Incidentes por severidad</h2>
          <div className="mt-5 grid gap-4 grid-cols-2 md:grid-cols-4">
            {(
              [
                { key: "low",      label: "Low",      color: "text-sky-700"     },
                { key: "medium",   label: "Medium",   color: "text-yellow-700"  },
                { key: "high",     label: "High",     color: "text-orange-700"  },
                { key: "critical", label: "Critical", color: "text-red-700"     },
              ] as const
            ).map(({ key, label, color }) => (
              <div
                key={key}
                className="rounded-2xl border border-soft bg-card-soft-theme p-4"
              >
                <p className="text-xs uppercase tracking-[0.18em] text-sub">{label}</p>
                <p className={`mt-2 text-2xl font-bold ${color}`}>
                  {summary.incidentsBySeverity[key]}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Tabla de sesiones ── */}
        <section className="rounded-2xl border border-soft bg-card-theme p-5 shadow-xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-xl font-semibold text-main">
              Sesiones ({sortedSessions.length})
            </h2>

            {/* Filtros */}
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                placeholder="Buscar alumno…"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="rounded-xl border border-soft bg-card-soft-theme px-3 py-1.5 text-sm text-main placeholder:text-sub w-44"
              />

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="rounded-xl border border-soft bg-card-soft-theme px-3 py-1.5 text-sm text-main"
              >
                <option value="">Todos los estados</option>
                {["active","warned","frozen","blocked","flagged","finished","terminated","offline_grace"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <select
                value={filterRisk}
                onChange={(e) => setFilterRisk(e.target.value)}
                className="rounded-xl border border-soft bg-card-soft-theme px-3 py-1.5 text-sm text-main"
              >
                <option value="">Todos los riesgos</option>
                {["clean","low","medium","high"].map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              {(filterStatus || filterRisk || searchName) && (
                <button
                  onClick={() => {
                    setFilterStatus("")
                    setFilterRisk("")
                    setSearchName("")
                  }}
                  className="rounded-xl border border-soft bg-card-soft-theme px-3 py-1.5 text-sm text-sub hover:text-main"
                >
                  ✕ Limpiar
                </button>
              )}
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-soft text-left text-sub">
                  <th className="px-3 py-3">Alumno</th>
                  <th className="px-3 py-3">Curso</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Riesgo</th>
                  <th className="px-3 py-3 text-right">Score</th>
                  <th className="px-3 py-3 text-right">W</th>
                  <th className="px-3 py-3 text-right">F</th>
                  <th className="px-3 py-3 text-right">B</th>
                  <th className="px-3 py-3">Último evento</th>
                  <th className="px-3 py-3">Inicio</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {sortedSessions.map((session) => (
                  <tr
                    key={session.id}
                    className={[
                      "border-b border-soft transition-colors hover:bg-card-soft-theme",
                      rowRiskBorder(session.risk_level),
                    ].join(" ")}
                  >
                    <td className="px-3 py-3 font-medium text-main">
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
                    <td className="px-3 py-3 text-right font-mono text-main">
                      {session.risk_score ?? 0}
                    </td>
                    <td className="px-3 py-3 text-right text-sub">
                      {session.warning_count ?? 0}
                    </td>
                    <td className="px-3 py-3 text-right text-sub">
                      {session.freeze_count ?? 0}
                    </td>
                    <td className="px-3 py-3 text-right text-sub">
                      {session.block_count ?? 0}
                    </td>
                    <td className="px-3 py-3 text-sub">
                      {formatTime(session.last_event_at)}
                    </td>
                    <td className="px-3 py-3 text-sub">
                      {formatDateTime(session.started_at)}
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/admin/exam-security/session/${session.id}`}
                        className="rounded-lg border border-soft bg-card-soft-theme px-3 py-1 text-xs text-sub hover:text-main hover:border-main/30 transition-colors"
                      >
                        Ver →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {sortedSessions.length === 0 && (
              <p className="mt-4 text-sm text-sub">
                {sessions.length === 0
                  ? "No hay sesiones en la ventana actual."
                  : "Ninguna sesión coincide con los filtros aplicados."}
              </p>
            )}
          </div>
        </section>

        {/* ── Eventos y Acciones recientes ── */}
        <section className="grid gap-6 xl:grid-cols-2">
          {/* Eventos recientes */}
          <div className="rounded-2xl border border-soft bg-card-theme p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-main">Incidentes recientes</h2>
              <span className="text-xs text-sub">{recentEvents.length} eventos</span>
            </div>

            <div className="mt-4 space-y-3 max-h-[28rem] overflow-y-auto pr-1">
              {recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="rounded-2xl border border-soft bg-card-soft-theme p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-main">
                      {event.event_type}
                    </span>
                    <span
                      className={[
                        "rounded-full border px-2 py-0.5 text-xs font-medium",
                        event.severity === "critical"
                          ? "border-red-400/30 bg-red-500/15 text-red-700"
                          : event.severity === "high"
                          ? "border-orange-400/30 bg-orange-500/15 text-orange-700"
                          : event.severity === "medium"
                          ? "border-yellow-400/30 bg-yellow-500/15 text-yellow-700"
                          : "border-soft bg-card-soft-theme text-sub",
                      ].join(" ")}
                    >
                      {event.severity}
                    </span>
                    {typeof event.incident_number === "number" && (
                      <span className="rounded-full border border-soft bg-card-soft-theme px-2 py-0.5 text-xs text-sub">
                        #{event.incident_number}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-sub truncate">
                    Sesión: {event.session_id}
                  </p>
                  <p className="mt-1 text-xs text-muted2">
                    {formatDateTime(event.created_at)}
                  </p>
                </div>
              ))}

              {recentEvents.length === 0 && (
                <p className="text-sm text-sub">No hay incidentes recientes.</p>
              )}
            </div>
          </div>

          {/* Acciones recientes */}
          <div className="rounded-2xl border border-soft bg-card-theme p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-main">Acciones recientes</h2>
              <span className="text-xs text-sub">{recentActions.length} acciones</span>
            </div>

            <div className="mt-4 space-y-3 max-h-[28rem] overflow-y-auto pr-1">
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
                  {action.reason && (
                    <p className="mt-1.5 text-sm text-sub">{action.reason}</p>
                  )}
                  <p className="mt-1.5 text-xs text-sub truncate">
                    Sesión: {action.session_id}
                  </p>
                  <p className="mt-1 text-xs text-muted2">
                    {formatDateTime(action.created_at)}
                  </p>
                </div>
              ))}

              {recentActions.length === 0 && (
                <p className="text-sm text-sub">No hay acciones recientes.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
