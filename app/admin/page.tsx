"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, Users, MessageSquare, BarChart2,
  ClipboardList, Search, RefreshCw, Loader2,
  CheckCircle2, Clock, AlertCircle, XCircle,
  ChevronRight, Zap, BookOpen, FileBarChart,
  Activity, Layers3, Bot, ArrowUpRight
} from "lucide-react"

const STATUS_META: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  abierto:     { label: "Abierto",     color: "#60a5fa", icon: Clock        },
  en_revision: { label: "En revisión", color: "#fbbf24", icon: AlertCircle  },
  resuelto:    { label: "Resuelto",    color: "#4ade80", icon: CheckCircle2 },
  cerrado:     { label: "Cerrado",     color: "var(--text-muted)", icon: XCircle      },
}

const CATEGORY_LABELS: Record<string, string> = {
  problema: "🐛 Error", cuenta: "👤 Cuenta", contenido: "📚 Contenido",
  sugerencia: "💡 Sugerencia", otro: "📝 Otro",
}

export default function AdminPage() {
  const supabase = createClient()
  const router   = useRouter()

  const [loading,      setLoading]      = useState(true)
  const [activeTab,    setActiveTab]    = useState<"dashboard"|"usuarios"|"reportes">("dashboard")
  const [stats,        setStats]        = useState<any>(null)
  const [users,        setUsers]        = useState<any[]>([])
  const [usersTotal,   setUsersTotal]   = useState(0)
  const [usersPage,    setUsersPage]    = useState(1)
  const [userSearch,   setUserSearch]   = useState("")
  const [searchInput,  setSearchInput]  = useState("")
  const [reports,      setReports]      = useState<any[]>([])
  const [reportFilter, setReportFilter] = useState("")
  const [busy,         setBusy]         = useState(false)
  const [error,        setError]        = useState("")

  // ── Auth check ──────────────────────────────────────────────────────────
  const [accessError, setAccessError] = useState("")

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/login"); return }

      // Verificar si es admin — intentar primero con la tabla admin_emails
      try {
        const { data, error } = await supabase
          .from("admin_emails")
          .select("email")
          .eq("email", user.email!)
          .maybeSingle()

        if (error) {
          // RLS puede estar bloqueando — mostrar mensaje informativo
          setAccessError(`Error de acceso: ${error.message}. Verifica que la migración SQL fue ejecutada correctamente.`)
          setLoading(false)
          return
        }

        if (!data) {
          setAccessError(`El correo ${user.email} no está registrado como administrador.`)
          setLoading(false)
          return
        }

        loadStats()
        setLoading(false)
      } catch (e: any) {
        setAccessError(`Error inesperado: ${e.message}`)
        setLoading(false)
      }
    })
  }, [])

  useEffect(() => { if (activeTab === "usuarios") loadUsers() }, [activeTab, usersPage, userSearch])
  useEffect(() => { if (activeTab === "reportes") loadReports() }, [activeTab, reportFilter])

  async function loadStats() {
    setError("")
    try {
      const [statsResponse, analyticsResponse] = await Promise.all([
        fetch("/api/admin?action=stats", { cache: "no-store" }),
        fetch("/api/admin?action=analytics&period=30", { cache: "no-store" }),
      ])
      const [statsData, analyticsData] = await Promise.all([
        statsResponse.json(),
        analyticsResponse.json(),
      ])
      if (!statsResponse.ok) throw new Error(statsData.error || "No se pudo cargar el resumen")
      setStats({
        ...statsData,
        analytics: analyticsResponse.ok ? analyticsData : null,
      })
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el dashboard")
      setStats({
        totalUsers: 0,
        totalSessions: 0,
        activeToday: 0,
        totalExams: 0,
        openReports: 0,
        analytics: null,
      })
    }
  }

  async function loadUsers() {
    setBusy(true)
    const res  = await fetch(`/api/admin?action=users&page=${usersPage}&search=${userSearch}`)
    const data = await res.json()
    setUsers(data.users || [])
    setUsersTotal(data.total || 0)
    setBusy(false)
  }

  async function loadReports() {
    setBusy(true)
    const res  = await fetch(`/api/admin?action=reports&status=${reportFilter}`)
    const data = await res.json()
    setReports(data.reports || [])
    setBusy(false)
  }

  async function updateReportStatus(reportId: string, status: string) {
    await fetch("/api/admin", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_report_status", reportId, status }),
    })
    loadReports()
  }

  if (loading) return (
    <div className="min-h-screen bg-app flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-soft border-t-blue-400 animate-spin" />
    </div>
  )

  // Mostrar error de acceso con instrucciones claras
  if (accessError) return (
    <div className="min-h-screen bg-app flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl p-6 border text-center"
           style={{ background: "rgba(239,68,68,0.06)", borderColor: "rgba(239,68,68,0.25)" }}>
        <div className="text-4xl mb-4">🔒</div>
        <h2 className="text-main font-bold text-lg mb-2">Acceso denegado</h2>
        <p className="text-red-700 text-sm mb-5 leading-relaxed">{accessError}</p>
        <div className="text-left rounded-xl p-4 mb-5 text-xs space-y-2"
             style={{ background: "var(--bg-card)", borderColor: "var(--border-soft)", border: "1px solid" }}>
          <p className="text-sub font-semibold mb-2">Para solucionar esto:</p>
          <p className="text-muted2">1. Ir a <span className="text-blue-400 font-mono">Supabase → SQL Editor</span></p>
          <p className="text-muted2">2. Ejecutar la migración <span className="font-mono text-amber-400">20260401000000_create_admin_system.sql</span></p>
          <p className="text-muted2">3. Luego ejecutar <span className="font-mono text-amber-400">20260403000000_exam_softdelete_admin_fix.sql</span></p>
          <p className="text-muted2">4. Verificar que tu correo está en la tabla <span className="font-mono text-green-400">admin_emails</span></p>
        </div>
        <Link href="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-sub border border-medium hover:bg-card-soft-theme transition-all">
          <ArrowLeft size={14} /> Volver al dashboard
        </Link>
      </div>
    </div>
  )

  const TABS = [
    { id: "dashboard", label: "Resumen",  icon: BarChart2       },
    { id: "usuarios",  label: "Usuarios", icon: Users            },
    { id: "reportes",  label: "Soporte",  icon: MessageSquare    },
  ] as const

  return (
    <div className="min-h-screen bg-app">

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-soft bg-app backdrop-blur-xl">
        <div className="max-w-[1500px] mx-auto px-4 lg:px-6 py-3 flex items-center gap-3">
          <Link href="/dashboard"
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-card-soft-theme text-sub hover:text-main transition-all">
            <ArrowLeft size={15} />
          </Link>
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center shadow-md"
               style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)", boxShadow: "0 4px 12px rgba(124,58,237,0.3)" }}>
            <ClipboardList size={17} className="text-main" />
          </div>
          <div className="flex-1">
            <h1 className="text-main font-bold text-sm">Panel de Administración</h1>
            <p className="text-muted2 text-[11px]">EduAI — Colegio Providencia</p>
          </div>
          <Link href="/admin/reporte"
            className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all"
            style={{ background: "rgba(124,58,237,0.1)", borderColor: "rgba(124,58,237,0.25)", color: "#8b5cf6" }}>
            <FileBarChart size={14} /> Reporte completo
          </Link>
          <button onClick={() => { loadStats(); if (activeTab === "usuarios") loadUsers(); if (activeTab === "reportes") loadReports() }}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-card-soft-theme text-sub hover:text-main transition-all">
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-soft">
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-medium transition-all"
                style={{
                  color:        activeTab === t.id ? "#a78bfa" : "#6b7280",
                  borderBottom: activeTab === t.id ? "2px solid #7c3aed" : "2px solid transparent",
                }}>
                <Icon size={13} /> {t.label}
              </button>
            )
          })}
        </div>
      </header>

      <div className="max-w-[1500px] mx-auto px-4 lg:px-6 py-6">

        {/* ── TAB: DASHBOARD ─────────────────────────────────────── */}
        {activeTab === "dashboard" && !stats && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 rounded-full border-2 border-soft border-t-purple-400 animate-spin" />
          </div>
        )}

        {activeTab === "dashboard" && stats && (
          <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-main">Dashboard general</h2>
                <p className="text-sub text-sm mt-1">Resumen de usuarios, módulos, agentes, actividad y contenido almacenado.</p>
              </div>
              <Link href="/admin/reporte"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)", boxShadow: "0 8px 24px rgba(124,58,237,0.2)" }}>
                <FileBarChart size={16} /> Ver reporte por módulo/agente <ArrowUpRight size={14} />
              </Link>
            </div>

            {error && (
              <div className="rounded-xl border px-4 py-3 text-sm text-red-500" style={{ borderColor: "rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.05)" }}>
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
              {[
                { label: "Usuarios", value: stats.totalUsers, detail: "registrados", icon: Users, color: "#3b82f6" },
                { label: "Activos hoy", value: stats.activeToday, detail: "sesiones en 24 h", icon: Zap, color: "#f59e0b" },
                { label: "Sesiones", value: stats.totalSessions, detail: "de estudio", icon: BookOpen, color: "#8b5cf6" },
                { label: "Exámenes", value: stats.totalExams, detail: "creados", icon: ClipboardList, color: "#10b981" },
                { label: "Eventos", value: stats.analytics?.overview?.totalEvents ?? 0, detail: "últimos 30 días", icon: Activity, color: "#a855f7" },
                { label: "Módulos activos", value: stats.analytics ? `${stats.analytics.overview.activeModules}/${stats.analytics.overview.totalModules}` : "—", detail: "con datos o uso", icon: Layers3, color: "#06b6d4" },
                { label: "Agentes activos", value: stats.analytics ? `${stats.analytics.overview.activeAgents}/${stats.analytics.overview.totalAgents}` : "—", detail: "con datos o uso", icon: Bot, color: "#ec4899" },
                { label: "Reportes abiertos", value: stats.openReports, detail: "soporte pendiente", icon: MessageSquare, color: stats.openReports > 0 ? "#f87171" : "#64748b" },
              ].map(item => {
                const Icon = item.icon
                return (
                  <div key={item.label} className="rounded-2xl p-4 border"
                       style={{ background: `${item.color}08`, borderColor: `${item.color}20` }}>
                    <Icon size={17} style={{ color: item.color }} />
                    <p className="text-xl font-bold text-main mt-3">{item.value ?? "—"}</p>
                    <p className="text-sub text-[11px] font-semibold mt-1">{item.label}</p>
                    <p className="text-muted2 text-[10px] mt-0.5">{item.detail}</p>
                  </div>
                )
              })}
            </div>

            {/* Accesos rápidos */}
            <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
              <button onClick={() => setActiveTab("reportes")}
                className="flex items-center gap-4 p-5 rounded-2xl border text-left transition-all"
                style={{ background: "rgba(248,113,113,0.06)", borderColor: "rgba(248,113,113,0.2)" }}>
                <MessageSquare size={24} className="text-red-400 flex-shrink-0" />
                <div>
                  <p className="text-main font-semibold">Reportes pendientes</p>
                  <p className="text-sub text-sm">{stats.openReports || 0} reportes sin resolver</p>
                </div>
                <ChevronRight size={18} className="text-muted2 ml-auto" />
              </button>

              <button onClick={() => setActiveTab("usuarios")}
                className="flex items-center gap-4 p-5 rounded-2xl border text-left transition-all"
                style={{ background: "rgba(59,130,246,0.06)", borderColor: "rgba(59,130,246,0.2)" }}>
                <Users size={24} className="text-blue-400 flex-shrink-0" />
                <div>
                  <p className="text-main font-semibold">Gestionar usuarios</p>
                  <p className="text-sub text-sm">{stats.totalUsers || 0} usuarios registrados</p>
                </div>
                <ChevronRight size={18} className="text-muted2 ml-auto" />
              </button>

              <Link href="/admin/examenes"
                className="flex items-center gap-4 p-5 rounded-2xl border text-left transition-all"
                style={{ background: "rgba(16,185,129,0.06)", borderColor: "rgba(16,185,129,0.2)" }}>
                <ClipboardList size={24} className="text-emerald-400 flex-shrink-0" />
                <div>
                  <p className="text-main font-semibold">Exámenes y seguridad</p>
                  <p className="text-sub text-sm">Incidencias, bloqueos y sesiones vigiladas</p>
                </div>
                <ChevronRight size={18} className="text-muted2 ml-auto" />
              </Link>

              <Link href="/admin/exam-security/users"
                className="flex items-center gap-4 p-5 rounded-2xl border text-left transition-all"
                style={{ background: "rgba(14,165,233,0.06)", borderColor: "rgba(14,165,233,0.2)" }}>
                <Users size={24} className="text-sky-400 flex-shrink-0" />
                <div>
                  <p className="text-main font-semibold">Control examen en vivo</p>
                  <p className="text-sub text-sm">Desbloquear, notificar y enviar mensajes</p>
                </div>
                <ChevronRight size={18} className="text-muted2 ml-auto" />
              </Link>
            </div>

            {stats.analytics && (
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border p-5" style={{ background: "var(--bg-card-soft)", borderColor: "var(--border-soft)" }}>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <h3 className="text-main font-bold">Módulos con mayor actividad</h3>
                      <p className="text-muted2 text-xs mt-1">Eventos y registros de los últimos 30 días</p>
                    </div>
                    <Layers3 size={18} className="text-cyan-500" />
                  </div>
                  <div className="space-y-2">
                    {stats.analytics.moduleRows.slice(0, 6).map((module: any) => (
                      <div key={module.key} className="flex items-center gap-3 rounded-xl border border-soft bg-app/40 px-3 py-2.5">
                        <span className="text-lg">{module.icon}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-main">{module.name}</p>
                          <p className="text-[10px] text-muted2">{module.category}{module.agentName ? ` · ${module.agentName}` : ""}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-cyan-500">{module.events}</p>
                          <p className="text-[9px] text-muted2">{module.storedRecords} registros</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border p-5" style={{ background: "var(--bg-card-soft)", borderColor: "var(--border-soft)" }}>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <h3 className="text-main font-bold">Agentes con mayor uso</h3>
                      <p className="text-muted2 text-xs mt-1">Actividad consolidada por agente</p>
                    </div>
                    <Bot size={18} className="text-pink-500" />
                  </div>
                  <div className="space-y-2">
                    {stats.analytics.agentRows.slice(0, 6).map((agent: any) => (
                      <div key={agent.key} className="flex items-center gap-3 rounded-xl border border-soft bg-app/40 px-3 py-2.5">
                        <div className="grid h-8 w-8 place-items-center rounded-lg border border-pink-500/20 bg-pink-500/10 text-pink-500"><Bot size={14} /></div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-main">{agent.name}</p>
                          <p className="truncate text-[10px] text-muted2">{agent.modules.join(" · ")}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-pink-500">{agent.events}</p>
                          <p className="text-[9px] text-muted2">{agent.uniqueUsers} usuarios</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: USUARIOS ──────────────────────────────────────── */}
        {activeTab === "usuarios" && (
          <div className="space-y-4">
            {/* Búsqueda */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted2" />
                <input
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { setUserSearch(searchInput); setUsersPage(1) } }}
                  placeholder="Buscar por nombre o email... (Enter)"
                  className="w-full bg-card-soft-theme border border-soft rounded-xl pl-9 pr-4 py-2.5 text-sm text-main placeholder-gray-400 focus:outline-none focus:border-purple-500/40 transition-all"
                />
              </div>
              <button onClick={() => { setUserSearch(searchInput); setUsersPage(1) }}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-main transition-all"
                style={{ background: "#7c3aed" }}>
                Buscar
              </button>
            </div>

            {/* Lista */}
            {busy ? (
              <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-purple-400" /></div>
            ) : (
              <>
                <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--bg-card-soft)" }}>
                  <table className="w-full">
                    <thead>
                      <tr style={{ background: "var(--bg-card-soft)", borderBottom: "1px solid var(--border-soft)" }}>
                        {["Usuario", "Email", "Nivel", "XP", "Racha", "Registrado", ""].map(h => (
                          <th key={h} className="text-left py-3 px-4 text-muted2 text-[11px] font-semibold uppercase tracking-widest">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id}
                          className="border-b border-soft hover:bg-card-soft-theme transition-colors">
                          <td className="py-3 px-4 text-main text-sm font-medium">{u.name || "—"}</td>
                          <td className="py-3 px-4 text-sub text-xs">{u.email}</td>
                          <td className="py-3 px-4 text-sub text-xs">{u.level || 1}</td>
                          <td className="py-3 px-4 text-amber-400 text-sm font-bold">{u.xp || 0}</td>
                          <td className="py-3 px-4 text-orange-400 text-xs">{u.streak_days || 0}d</td>
                          <td className="py-3 px-4 text-muted2 text-xs">
                            {new Date(u.created_at).toLocaleDateString("es-CL")}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Link href={`/admin/usuarios/${u.id}`}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ml-auto"
                              style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)", color: "#c4b5fd" }}>
                              Editar <ChevronRight size={11} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Paginación */}
                {usersTotal > 30 && (
                  <div className="flex items-center justify-between">
                    <p className="text-muted2 text-xs">{usersTotal} usuarios total</p>
                    <div className="flex gap-2">
                      <button onClick={() => setUsersPage(p => Math.max(1, p - 1))} disabled={usersPage === 1}
                        className="px-3 py-1.5 rounded-xl border text-xs disabled:opacity-40 transition-all"
                        style={{ borderColor: "var(--border-soft)", color: "var(--text-muted)" }}>
                        ← Anterior
                      </button>
                      <span className="px-3 py-1.5 text-xs text-muted2">Pág. {usersPage}</span>
                      <button onClick={() => setUsersPage(p => p + 1)} disabled={usersPage * 30 >= usersTotal}
                        className="px-3 py-1.5 rounded-xl border text-xs disabled:opacity-40 transition-all"
                        style={{ borderColor: "var(--border-soft)", color: "var(--text-muted)" }}>
                        Siguiente →
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── TAB: REPORTES ──────────────────────────────────────── */}
        {activeTab === "reportes" && (
          <div className="space-y-4">
            {/* Filtro estado */}
            <div className="flex gap-2 flex-wrap">
              {["", "abierto", "en_revision", "resuelto", "cerrado"].map(s => (
                <button key={s} onClick={() => setReportFilter(s)}
                  className="px-3 py-1.5 rounded-xl border text-xs font-medium transition-all"
                  style={{
                    background:  reportFilter === s ? "rgba(124,58,237,0.1)" : "var(--bg-card-soft)",
                    borderColor: reportFilter === s ? "rgba(124,58,237,0.3)" : "var(--bg-card-soft)",
                    color:       reportFilter === s ? "#c4b5fd" : "#6b7280",
                  }}>
                  {s === "" ? "Todos" : STATUS_META[s]?.label || s}
                </button>
              ))}
            </div>

            {busy ? (
              <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-purple-400" /></div>
            ) : reports.length === 0 ? (
              <div className="text-center py-16 rounded-2xl border" style={{ borderColor: "var(--bg-card-soft)" }}>
                <MessageSquare size={36} className="text-muted2 mx-auto mb-3" />
                <p className="text-muted2">No hay reportes{reportFilter ? ` con estado "${STATUS_META[reportFilter]?.label}"` : ""}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reports.map(r => {
                  const meta = STATUS_META[r.status] || STATUS_META.abierto
                  const Icon = meta.icon
                  return (
                    <div key={r.id} className="rounded-2xl border p-4 space-y-3"
                         style={{ background: "var(--bg-card-soft)", borderColor: "var(--bg-card-soft)" }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-main font-semibold text-sm">{r.subject}</span>
                            <span className="text-[10px] text-muted2">{CATEGORY_LABELS[r.category] || r.category}</span>
                          </div>
                          <p className="text-sub text-xs">
                            <span className="font-medium text-sub">{r.user_name}</span> — {r.user_email}
                          </p>
                          <p className="text-muted2 text-[10px] mt-0.5">
                            {new Date(r.created_at).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Icon size={13} style={{ color: meta.color }} />
                          <span className="text-[11px] font-medium" style={{ color: meta.color }}>{meta.label}</span>
                        </div>
                      </div>

                      <p className="text-sub text-xs leading-relaxed bg-card-soft-theme rounded-xl px-3 py-2 border border-soft">
                        {r.description}
                      </p>

                      {r.admin_reply && (
                        <div className="rounded-xl p-3 border border-green-500/20" style={{ background: "rgba(34,197,94,0.06)" }}>
                          <p className="text-green-400 text-[10px] font-semibold mb-1">Tu respuesta:</p>
                          <p className="text-sub text-xs">{r.admin_reply}</p>
                        </div>
                      )}

                      {/* Acciones rápidas de estado */}
                      <div className="flex flex-wrap gap-2">
                        {[
                          { s: "en_revision", label: "Marcar en revisión", color: "#fbbf24" },
                          { s: "resuelto",    label: "Marcar resuelto",    color: "#4ade80" },
                          { s: "cerrado",     label: "Cerrar",             color: "var(--text-muted)" },
                        ].filter(a => a.s !== r.status).map(a => (
                          <button key={a.s}
                            onClick={() => updateReportStatus(r.id, a.s)}
                            className="px-3 py-1.5 rounded-xl border text-[10px] font-medium transition-all"
                            style={{ borderColor: `${a.color}30`, color: a.color, background: `${a.color}10` }}>
                            {a.label}
                          </button>
                        ))}
                        <Link href={`/admin/reportes/${r.id}`}
                          className="px-3 py-1.5 rounded-xl border text-[10px] font-medium transition-all ml-auto"
                          style={{ borderColor: "rgba(124,58,237,0.3)", color: "#c4b5fd", background: "rgba(124,58,237,0.08)" }}>
                          Ver completo / Responder →
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
