// app/admin/exam-security/users/page.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Control de estudiantes en examen: usuarios conectados, desbloqueo,
// notificaciones y mensajes individuales/masivos.
// ──────────────────────────────────────────────────────────────────────────────

"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"

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

type DashboardResponse = {
  success: boolean
  error?: string
  data?: {
    summary: DashboardSummary
    sessions: SessionRow[]
  }
}

type ComposerTarget =
  | { mode: "individual"; session: SessionRow; kind: "notify" | "message" }
  | { mode: "selected"; kind: "notify" | "message" }
  | { mode: "all"; kind: "notify" | "message" }

type Feedback = { ok: boolean; msg: string } | null

const HOURS_OPTIONS = [6, 12, 24, 48, 72]
const REFRESH_INTERVAL_MS = 10_000

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function formatTime(iso: string | null | undefined) {
  if (!iso) return "—"
  return new Date(iso).toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function isLive(session: SessionRow) {
  if (!session.last_heartbeat_at) return false
  const diffMs = Date.now() - new Date(session.last_heartbeat_at).getTime()
  return diffMs < 35_000
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    active: "Activo",
    warned: "Advertido",
    frozen: "Congelado",
    blocked: "Bloqueado",
    flagged: "Revisión",
    offline_grace: "Sin conexión",
    finished: "Finalizado",
    terminated: "Terminado",
  }
  return labels[status] || status
}

function toneForStatus(status: string | null | undefined) {
  switch (status) {
    case "blocked":
      return "border-red-400/30 bg-red-500/15 text-red-700"
    case "frozen":
      return "border-orange-400/30 bg-orange-500/15 text-orange-700"
    case "flagged":
      return "border-fuchsia-400/30 bg-fuchsia-500/15 text-fuchsia-700"
    case "warned":
      return "border-yellow-400/30 bg-yellow-500/15 text-yellow-700"
    case "offline_grace":
      return "border-sky-400/30 bg-sky-500/15 text-sky-700"
    case "finished":
      return "border-emerald-400/30 bg-emerald-500/15 text-emerald-700"
    case "terminated":
      return "border-red-500/40 bg-red-600/15 text-red-700"
    default:
      return "border-emerald-400/30 bg-emerald-500/15 text-emerald-700"
  }
}

function toneForRisk(level: string | null | undefined) {
  switch (level) {
    case "high":
      return "border-orange-400/30 bg-orange-500/15 text-orange-700"
    case "medium":
      return "border-yellow-400/30 bg-yellow-500/15 text-yellow-700"
    case "low":
      return "border-sky-400/30 bg-sky-500/15 text-sky-700"
    default:
      return "border-emerald-400/30 bg-emerald-500/15 text-emerald-700"
  }
}

function normalizeText(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

export default function ExamSecurityUsersPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [busyIds, setBusyIds] = useState<Set<string>>(() => new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const [hoursWindow, setHoursWindow] = useState(24)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("live")
  const [courseFilter, setCourseFilter] = useState("")
  const [examFilter, setExamFilter] = useState("")

  const [composer, setComposer] = useState<ComposerTarget | null>(null)
  const [composerTitle, setComposerTitle] = useState("")
  const [composerMessage, setComposerMessage] = useState("")

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStudents = useCallback(
    async (manual = false) => {
      if (manual) setRefreshing(true)

      try {
        const params = new URLSearchParams()
        params.set("hours", String(hoursWindow))
        if (examFilter.trim()) params.set("examId", examFilter.trim())

        const res = await fetch(`/api/exam-security/admin/dashboard?${params.toString()}`, {
          cache: "no-store",
        })
        const json = (await res.json()) as DashboardResponse

        if (!json.success || !json.data) {
          setError(json.error || "No se pudo cargar la lista de estudiantes.")
          return
        }

        setSummary(json.data.summary)
        setSessions(json.data.sessions || [])
        setLastUpdated(new Date())
        setError(null)
      } catch (err) {
        console.error("[ExamSecurityUsersPage] fetchStudents", err)
        setError("Error de conexión al cargar estudiantes.")
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [hoursWindow, examFilter]
  )

  useEffect(() => {
    setLoading(true)
    fetchStudents()

    timerRef.current = setInterval(() => {
      void fetchStudents()
    }, REFRESH_INTERVAL_MS)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [fetchStudents])

  const liveSessions = useMemo(
    () =>
      sessions.filter((session) =>
        ["active", "warned", "frozen", "blocked", "flagged", "offline_grace"].includes(session.status)
      ),
    [sessions]
  )

  const courses = useMemo(() => {
    return Array.from(
      new Set(
        sessions
          .map((session) => session.student_course)
          .filter((course): course is string => Boolean(course))
      )
    ).sort((a, b) => a.localeCompare(b, "es"))
  }, [sessions])

  const filteredSessions = useMemo(() => {
    const q = normalizeText(search)

    return sessions.filter((session) => {
      if (statusFilter === "live") {
        if (!liveSessions.some((live) => live.id === session.id)) return false
      } else if (statusFilter === "blocked") {
        if (session.status !== "blocked") return false
      } else if (statusFilter === "risk") {
        if (!["medium", "high"].includes(String(session.risk_level || ""))) return false
      } else if (statusFilter) {
        if (session.status !== statusFilter) return false
      }

      if (courseFilter && session.student_course !== courseFilter) return false

      if (q) {
        const haystack = normalizeText(
          [
            session.student_name,
            session.student_rut,
            session.student_course,
            session.exam_id,
            session.submission_id,
          ]
            .filter(Boolean)
            .join(" ")
        )
        if (!haystack.includes(q)) return false
      }

      return true
    })
  }, [sessions, search, statusFilter, courseFilter, liveSessions])

  const sortedSessions = useMemo(() => {
    return [...filteredSessions].sort((a, b) => {
      const liveA = isLive(a) ? 1 : 0
      const liveB = isLive(b) ? 1 : 0
      if (liveA !== liveB) return liveB - liveA
      if (a.status === "blocked" && b.status !== "blocked") return -1
      if (b.status === "blocked" && a.status !== "blocked") return 1
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })
  }, [filteredSessions])

  const selectedVisible = useMemo(
    () => sortedSessions.filter((session) => selectedIds.has(session.id)),
    [sortedSessions, selectedIds]
  )

  const blockedCount = sessions.filter((session) => session.status === "blocked").length
  const liveCount = liveSessions.length
  const selectedCount = selectedIds.size

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      const allVisibleSelected = sortedSessions.length > 0 && sortedSessions.every((s) => next.has(s.id))

      if (allVisibleSelected) {
        sortedSessions.forEach((s) => next.delete(s.id))
      } else {
        sortedSessions.forEach((s) => next.add(s.id))
      }

      return next
    })
  }, [sortedSessions])

  const runAction = useCallback(
    async (params: {
      action: "unlock" | "notify" | "message"
      sessionIds?: string[]
      target?: "selected" | "all"
      title?: string
      message?: string
      silent?: boolean
    }) => {
      const sessionIds = params.sessionIds || []
      const target = params.target || "selected"

      if (target === "selected" && sessionIds.length === 0) {
        setFeedback({ ok: false, msg: "Selecciona al menos un usuario." })
        return false
      }

      if (target === "selected") {
        setBusyIds((prev) => {
          const next = new Set(prev)
          sessionIds.forEach((id) => next.add(id))
          return next
        })
      } else {
        setBulkBusy(true)
      }

      setFeedback(null)

      try {
        const res = await fetch("/api/exam-security/admin/sessions/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: params.action,
            target,
            sessionIds,
            examId: examFilter.trim() || undefined,
            hours: hoursWindow,
            title: params.title,
            message: params.message,
          }),
        })

        const json = await res.json().catch(() => null)

        if (!json?.success) {
          setFeedback({ ok: false, msg: json?.error || "No se pudo ejecutar la acción." })
          return false
        }

        if (!params.silent) {
          setFeedback({ ok: true, msg: json.message || "Acción ejecutada correctamente." })
        }

        await fetchStudents(true)
        return true
      } catch (err) {
        console.error("[ExamSecurityUsersPage] runAction", err)
        setFeedback({ ok: false, msg: "Error de conexión al ejecutar la acción." })
        return false
      } finally {
        if (target === "selected") {
          setBusyIds((prev) => {
            const next = new Set(prev)
            sessionIds.forEach((id) => next.delete(id))
            return next
          })
        } else {
          setBulkBusy(false)
        }
      }
    },
    [examFilter, hoursWindow, fetchStudents]
  )

  const unlockOne = useCallback(
    async (session: SessionRow) => {
      const ok = window.confirm(
        `¿Desbloquear a ${session.student_name || "este usuario"} y permitir que continúe el examen?`
      )
      if (!ok) return

      await runAction({ action: "unlock", sessionIds: [session.id] })
    },
    [runAction]
  )

  const unlockSelected = useCallback(async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) {
      setFeedback({ ok: false, msg: "Selecciona al menos un usuario para desbloquear." })
      return
    }

    const ok = window.confirm(`¿Desbloquear ${ids.length} usuario(s) seleccionado(s)?`)
    if (!ok) return

    const done = await runAction({ action: "unlock", sessionIds: ids })
    if (done) setSelectedIds(new Set())
  }, [selectedIds, runAction])

  const unlockAllBlocked = useCallback(async () => {
    if (blockedCount === 0) {
      setFeedback({ ok: false, msg: "No hay usuarios bloqueados en la ventana actual." })
      return
    }

    const ids = sessions.filter((session) => session.status === "blocked").map((session) => session.id)
    const ok = window.confirm(`¿Desbloquear todos los usuarios bloqueados (${ids.length})?`)
    if (!ok) return

    await runAction({ action: "unlock", sessionIds: ids })
  }, [blockedCount, sessions, runAction])

  const openComposer = useCallback((target: ComposerTarget) => {
    setComposer(target)
    setComposerTitle(target.kind === "notify" ? "Notificación del docente" : "Mensaje del docente")
    setComposerMessage("")
  }, [])

  const closeComposer = useCallback(() => {
    setComposer(null)
    setComposerTitle("")
    setComposerMessage("")
  }, [])

  const sendComposer = useCallback(async () => {
    if (!composer) return
    const message = composerMessage.trim()

    if (!message) {
      setFeedback({ ok: false, msg: "Escribe el mensaje antes de enviarlo." })
      return
    }

    let sessionIds: string[] = []
    let target: "selected" | "all" = "selected"

    if (composer.mode === "individual") {
      sessionIds = [composer.session.id]
    } else if (composer.mode === "selected") {
      sessionIds = Array.from(selectedIds)
    } else {
      target = "all"
    }

    const done = await runAction({
      action: composer.kind,
      sessionIds,
      target,
      title: composerTitle.trim(),
      message,
    })

    if (done) {
      closeComposer()
      if (composer.mode === "selected") setSelectedIds(new Set())
    }
  }, [composer, composerMessage, composerTitle, selectedIds, runAction, closeComposer])

  if (loading) {
    return (
      <main className="min-h-screen bg-app p-6 text-main">
        <div className="mx-auto max-w-7xl">
          <Link href="/admin/exam-security" className="text-sm text-sub underline underline-offset-2">
            ← Seguridad de exámenes
          </Link>
          <h1 className="mt-3 text-3xl font-bold">Control de usuarios del examen</h1>
          <p className="mt-3 text-sub">Cargando estudiantes conectados…</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-app p-6 text-main">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-soft bg-card-theme p-6 shadow-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex flex-wrap gap-2 text-xs text-sub">
                <Link href="/admin" className="hover:text-main underline underline-offset-2">
                  ← Panel Admin
                </Link>
                <span>·</span>
                <Link href="/admin/exam-security" className="hover:text-main underline underline-offset-2">
                  Centro de Seguridad
                </Link>
              </div>

              <h1 className="mt-3 text-3xl font-black tracking-tight">
                👥 Control de usuarios del examen
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-sub">
                Aquí aparecen los estudiantes que ingresaron a rendir examen. Puedes desbloquear sesiones bloqueadas,
                enviar notificaciones rápidas y mandar mensajes individuales, seleccionados o a todos los usuarios conectados.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={hoursWindow}
                onChange={(e) => setHoursWindow(Number(e.target.value))}
                className="rounded-xl border border-soft bg-card-soft-theme px-3 py-2 text-sm text-main"
              >
                {HOURS_OPTIONS.map((hours) => (
                  <option key={hours} value={hours}>
                    Últimas {hours}h
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => fetchStudents(true)}
                disabled={refreshing}
                className="rounded-xl border border-soft bg-card-soft-theme px-4 py-2 text-sm font-semibold text-main transition hover:opacity-80 disabled:opacity-50"
              >
                {refreshing ? "↻ Actualizando…" : "↻ Actualizar"}
              </button>
            </div>
          </div>

          {lastUpdated ? (
            <p className="mt-4 text-xs text-sub">
              Última actualización: {lastUpdated.toLocaleTimeString("es-CL")} · actualización automática cada {REFRESH_INTERVAL_MS / 1000}s
            </p>
          ) : null}
        </header>

        {error ? (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        {feedback ? (
          <div
            className={[
              "rounded-2xl border px-4 py-3 text-sm font-semibold",
              feedback.ok
                ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-700"
                : "border-red-400/30 bg-red-500/10 text-red-700",
            ].join(" ")}
          >
            {feedback.msg}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-soft bg-card-theme p-5 shadow-xl">
            <p className="text-xs uppercase tracking-[0.18em] text-sub">Usuarios</p>
            <p className="mt-2 text-3xl font-black text-main">{sessions.length}</p>
            <p className="mt-1 text-xs text-sub">Ingresos registrados</p>
          </div>
          <div className="rounded-2xl border border-soft bg-card-theme p-5 shadow-xl">
            <p className="text-xs uppercase tracking-[0.18em] text-sub">En examen</p>
            <p className="mt-2 text-3xl font-black text-sky-600">{liveCount}</p>
            <p className="mt-1 text-xs text-sub">Activos o monitoreados</p>
          </div>
          <div className="rounded-2xl border border-soft bg-card-theme p-5 shadow-xl">
            <p className="text-xs uppercase tracking-[0.18em] text-sub">Bloqueados</p>
            <p className="mt-2 text-3xl font-black text-red-600">{blockedCount}</p>
            <p className="mt-1 text-xs text-sub">Requieren desbloqueo</p>
          </div>
          <div className="rounded-2xl border border-soft bg-card-theme p-5 shadow-xl">
            <p className="text-xs uppercase tracking-[0.18em] text-sub">Riesgo</p>
            <p className="mt-2 text-3xl font-black text-orange-600">{summary?.highRiskSessions ?? 0}</p>
            <p className="mt-1 text-xs text-sub">Medio o alto</p>
          </div>
          <div className="rounded-2xl border border-soft bg-card-theme p-5 shadow-xl">
            <p className="text-xs uppercase tracking-[0.18em] text-sub">Seleccionados</p>
            <p className="mt-2 text-3xl font-black text-fuchsia-600">{selectedCount}</p>
            <p className="mt-1 text-xs text-sub">Para acción masiva</p>
          </div>
        </section>

        <section className="rounded-3xl border border-soft bg-card-theme p-5 shadow-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-xl font-bold">Acciones rápidas</h2>
              <p className="mt-1 text-sm text-sub">
                Usa acciones por estudiante, por selección o para todos los usuarios conectados.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={unlockSelected}
                disabled={selectedCount === 0 || bulkBusy}
                className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                🔓 Desbloquear seleccionados
              </button>
              <button
                type="button"
                onClick={unlockAllBlocked}
                disabled={blockedCount === 0 || bulkBusy}
                className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                🔓 Desbloquear bloqueados
              </button>
              <button
                type="button"
                onClick={() => openComposer({ mode: "selected", kind: "notify" })}
                disabled={selectedCount === 0 || bulkBusy}
                className="rounded-xl border border-yellow-400/30 bg-yellow-500/10 px-4 py-2 text-sm font-bold text-yellow-700 transition hover:bg-yellow-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                🔔 Notificar seleccionados
              </button>
              <button
                type="button"
                onClick={() => openComposer({ mode: "selected", kind: "message" })}
                disabled={selectedCount === 0 || bulkBusy}
                className="rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-2 text-sm font-bold text-sky-700 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                💬 Mensaje seleccionados
              </button>
              <button
                type="button"
                onClick={() => openComposer({ mode: "all", kind: "notify" })}
                disabled={liveCount === 0 || bulkBusy}
                className="rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/10 px-4 py-2 text-sm font-bold text-fuchsia-700 transition hover:bg-fuchsia-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                📢 Notificar a todos
              </button>
              <button
                type="button"
                onClick={() => openComposer({ mode: "all", kind: "message" })}
                disabled={liveCount === 0 || bulkBusy}
                className="rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-4 py-2 text-sm font-bold text-indigo-700 transition hover:bg-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                💬 Mensaje a todos
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-soft bg-card-theme p-5 shadow-xl">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-xl font-bold">Usuarios que ingresaron al examen</h2>
              <p className="mt-1 text-sm text-sub">
                Mostrando {sortedSessions.length} de {sessions.length} sesión(es).
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar nombre, RUT, curso…"
                className="w-full min-w-[16rem] rounded-xl border border-soft bg-card-soft-theme px-3 py-2 text-sm text-main placeholder:text-sub xl:w-auto"
              />

              <input
                value={examFilter}
                onChange={(e) => setExamFilter(e.target.value)}
                placeholder="Filtrar exam_id opcional"
                className="w-full min-w-[14rem] rounded-xl border border-soft bg-card-soft-theme px-3 py-2 text-sm text-main placeholder:text-sub xl:w-auto"
              />

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-soft bg-card-soft-theme px-3 py-2 text-sm text-main"
              >
                <option value="live">En examen</option>
                <option value="">Todos</option>
                <option value="blocked">Bloqueados</option>
                <option value="risk">Riesgo medio/alto</option>
                <option value="active">Activos</option>
                <option value="warned">Advertidos</option>
                <option value="frozen">Congelados</option>
                <option value="flagged">Marcados revisión</option>
                <option value="finished">Finalizados</option>
                <option value="terminated">Terminados</option>
              </select>

              <select
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                className="rounded-xl border border-soft bg-card-soft-theme px-3 py-2 text-sm text-main"
              >
                <option value="">Todos los cursos</option>
                {courses.map((course) => (
                  <option key={course} value={course}>
                    {course}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-soft text-left text-sub">
                  <th className="px-3 py-3">
                    <button
                      type="button"
                      onClick={toggleAllVisible}
                      className="rounded-lg border border-soft bg-card-soft-theme px-2 py-1 text-xs text-sub hover:text-main"
                    >
                      {sortedSessions.length > 0 && sortedSessions.every((s) => selectedIds.has(s.id)) ? "Quitar" : "Todos"}
                    </button>
                  </th>
                  <th className="px-3 py-3">Nombre</th>
                  <th className="px-3 py-3">RUT</th>
                  <th className="px-3 py-3">Curso</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Riesgo</th>
                  <th className="px-3 py-3">Conexión</th>
                  <th className="px-3 py-3">Ingreso</th>
                  <th className="px-3 py-3">Último heartbeat</th>
                  <th className="px-3 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sortedSessions.map((session) => {
                  const selected = selectedIds.has(session.id)
                  const live = isLive(session)
                  const busy = busyIds.has(session.id)

                  return (
                    <tr
                      key={session.id}
                      className={[
                        "border-b border-soft transition hover:bg-card-soft-theme",
                        selected ? "bg-sky-500/5" : "",
                        session.status === "blocked" ? "border-l-4 border-l-red-500" : "",
                      ].join(" ")}
                    >
                      <td className="px-3 py-3 align-top">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleSelection(session.id)}
                          className="h-4 w-4 rounded border-soft"
                          aria-label={`Seleccionar ${session.student_name || "usuario"}`}
                        />
                      </td>
                      <td className="px-3 py-3 align-top">
                        <p className="font-bold text-main">{session.student_name || "Sin nombre"}</p>
                        <p className="mt-1 max-w-[11rem] truncate text-xs text-sub">ID: {session.id}</p>
                      </td>
                      <td className="px-3 py-3 align-top font-mono text-sub">
                        {session.student_rut || "—"}
                      </td>
                      <td className="px-3 py-3 align-top text-sub">
                        {session.student_course || "—"}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span className={["inline-flex rounded-full border px-2.5 py-1 text-xs font-bold", toneForStatus(session.status)].join(" ")}>
                          {statusLabel(session.status)}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span className={["inline-flex rounded-full border px-2.5 py-1 text-xs font-bold", toneForRisk(session.risk_level)].join(" ")}>
                          {session.risk_level || "clean"} · {session.risk_score ?? 0}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span className={live ? "font-bold text-emerald-600" : "text-sub"}>
                          {live ? "● En línea" : "○ Sin señal"}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top text-sub">
                        {formatDateTime(session.started_at)}
                      </td>
                      <td className="px-3 py-3 align-top text-sub">
                        {formatTime(session.last_heartbeat_at)}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex min-w-[22rem] flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => unlockOne(session)}
                            disabled={busy || session.status === "finished" || session.status === "terminated"}
                            className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-700 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {busy ? "Procesando…" : "🔓 Desbloquear"}
                          </button>
                          <button
                            type="button"
                            onClick={() => openComposer({ mode: "individual", session, kind: "notify" })}
                            disabled={busy || session.status === "finished" || session.status === "terminated"}
                            className="rounded-lg border border-yellow-400/30 bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-700 transition hover:bg-yellow-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            🔔 Notificar
                          </button>
                          <button
                            type="button"
                            onClick={() => openComposer({ mode: "individual", session, kind: "message" })}
                            disabled={busy || session.status === "finished" || session.status === "terminated"}
                            className="rounded-lg border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-bold text-sky-700 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            💬 Mensaje
                          </button>
                          <Link
                            href={`/admin/exam-security/session/${session.id}`}
                            className="rounded-lg border border-soft bg-card-soft-theme px-3 py-1 text-xs font-semibold text-sub transition hover:text-main"
                          >
                            Ver detalle →
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {sortedSessions.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-soft bg-card-soft-theme p-6 text-center text-sm text-sub">
                No hay usuarios que coincidan con los filtros actuales.
              </div>
            ) : null}
          </div>
        </section>
      </div>

      {composer ? (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-soft bg-card-theme p-6 text-main shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-sub">
                  {composer.kind === "notify" ? "Notificación" : "Mensaje"}
                </p>
                <h3 className="mt-2 text-2xl font-black">
                  {composer.mode === "individual"
                    ? `${composer.kind === "notify" ? "Notificar" : "Enviar mensaje"} a ${composer.session.student_name || "usuario"}`
                    : composer.mode === "selected"
                      ? `${composer.kind === "notify" ? "Notificar" : "Enviar mensaje"} a seleccionados (${selectedIds.size})`
                      : `${composer.kind === "notify" ? "Notificar" : "Enviar mensaje"} a todos los usuarios conectados`}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeComposer}
                className="rounded-xl border border-soft bg-card-soft-theme px-3 py-2 text-sm font-bold text-sub hover:text-main"
              >
                ✕
              </button>
            </div>

            {composer.mode === "individual" ? (
              <div className="mt-4 rounded-2xl border border-soft bg-card-soft-theme p-4 text-sm text-sub">
                <strong className="text-main">Estudiante:</strong> {composer.session.student_name || "Sin nombre"} · <strong className="text-main">RUT:</strong> {composer.session.student_rut || "—"} · <strong className="text-main">Curso:</strong> {composer.session.student_course || "—"}
              </div>
            ) : composer.mode === "selected" ? (
              <div className="mt-4 rounded-2xl border border-soft bg-card-soft-theme p-4 text-sm text-sub">
                Se enviará a {selectedVisible.length} usuario(s) seleccionado(s) visible(s). Si seleccionaste estudiantes filtrados fuera de pantalla, también se incluirán.
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-soft bg-card-soft-theme p-4 text-sm text-sub">
                Se enviará a todos los usuarios activos/monitoreados de la ventana actual{examFilter.trim() ? ` para el exam_id ${examFilter.trim()}` : ""}.
              </div>
            )}

            <label className="mt-5 block text-sm font-bold text-main">
              Título
              <input
                value={composerTitle}
                onChange={(e) => setComposerTitle(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-soft bg-card-soft-theme px-4 py-3 text-sm text-main placeholder:text-sub"
                placeholder="Ej.: Aviso importante"
              />
            </label>

            <label className="mt-4 block text-sm font-bold text-main">
              Texto
              <textarea
                value={composerMessage}
                onChange={(e) => setComposerMessage(e.target.value)}
                rows={5}
                className="mt-2 w-full resize-none rounded-2xl border border-soft bg-card-soft-theme px-4 py-3 text-sm leading-6 text-main placeholder:text-sub"
                placeholder={
                  composer.kind === "notify"
                    ? "Ej.: Mantén la pantalla completa y continúa con tu evaluación."
                    : "Ej.: Te desbloqueé la sesión. Continúa desde la pregunta donde quedaste."
                }
              />
            </label>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeComposer}
                className="rounded-xl border border-soft bg-card-soft-theme px-4 py-2 text-sm font-bold text-sub hover:text-main"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={sendComposer}
                disabled={bulkBusy || composerMessage.trim().length === 0}
                className="rounded-xl border border-main/10 bg-main px-5 py-2 text-sm font-black text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {bulkBusy ? "Enviando…" : composer.kind === "notify" ? "Enviar notificación" : "Enviar mensaje"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
