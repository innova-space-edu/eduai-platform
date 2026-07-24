"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bot,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  FileBarChart,
  Filter,
  Gauge,
  Layers3,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  Users,
  XCircle,
  Zap,
} from "lucide-react"

type ModuleRow = {
  key: string
  name: string
  category: string
  href: string
  icon: string
  description: string
  agentKey: string | null
  agentName: string | null
  events: number
  pageViews: number
  actions: number
  uniqueUsers: number
  successes: number
  errors: number
  successRate: number
  avgLatencyMs: number
  inputTokens: number
  outputTokens: number
  estimatedCost: number
  storedRecords: number
  sourceBreakdown: Array<{ table: string; label: string; count: number; available: boolean }>
  lastActivity: string | null
  status: "active" | "stored-data" | "no-data"
}

type AgentRow = {
  key: string
  name: string
  modules: string[]
  events: number
  pageViews: number
  actions: number
  uniqueUsers: number
  successes: number
  errors: number
  successRate: number
  avgLatencyMs: number
  inputTokens: number
  outputTokens: number
  estimatedCost: number
  storedRecords: number
  lastActivity: string | null
}

type AnalyticsReport = {
  generatedAt: string
  period: { key: string; days: number | null; label: string }
  overview: {
    totalUsers: number
    activeUsers: number
    totalEvents: number
    activeModules: number
    totalModules: number
    activeAgents: number
    totalAgents: number
    successes: number
    errors: number
    successRate: number
    avgLatencyMs: number
    inputTokens: number
    outputTokens: number
    estimatedCost: number
    totalStoredRecords: number
  }
  moduleRows: ModuleRow[]
  agentRows: AgentRow[]
  activityByDay: Array<{ date: string; events: number; uniqueUsers: number; errors: number }>
  eventTypes: Array<{ type: string; count: number }>
  topUsers: Array<{ id: string; name: string; email: string; events: number }>
  recentErrors: Array<{
    moduleKey: string
    moduleName: string
    agentName: string | null
    eventType: string
    path: string | null
    errorCode: string | null
    createdAt: string
  }>
  coverage: {
    trackingEnabled: boolean
    trackingError: string | null
    eventLimitReached: boolean
    availableSources: number
    totalSources: number
    missingSources: Array<{ table: string; label: string; error?: string }>
  }
}

const PERIODS = [
  { value: "7", label: "7 días" },
  { value: "30", label: "30 días" },
  { value: "90", label: "90 días" },
  { value: "365", label: "1 año" },
  { value: "all", label: "Todo" },
]

const EVENT_LABELS: Record<string, string> = {
  page_view: "Visitas",
  action: "Acciones",
  generation: "Generaciones",
  export: "Exportaciones",
  upload: "Subidas",
  download: "Descargas",
  error: "Errores",
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-CL").format(value || 0)
}

function formatCost(value: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value > 0 && value < 1 ? 4 : 2,
    maximumFractionDigits: 6,
  }).format(value || 0)
}

function formatDate(value: string | null) {
  if (!value) return "Sin actividad"
  return new Date(value).toLocaleString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatLatency(value: number) {
  if (!value) return "—"
  if (value < 1000) return `${value} ms`
  return `${(value / 1000).toFixed(1)} s`
}

function escapeCsv(value: unknown) {
  const text = String(value ?? "")
  return `"${text.replace(/"/g, '""')}"`
}

function statusMeta(status: ModuleRow["status"]) {
  if (status === "active") return { label: "Activo", color: "#22c55e", icon: CheckCircle2 }
  if (status === "stored-data") return { label: "Con datos", color: "#38bdf8", icon: Database }
  return { label: "Sin datos", color: "#94a3b8", icon: Clock3 }
}

export default function AdminAnalyticsReportPage() {
  const [period, setPeriod] = useState("30")
  const [report, setReport] = useState<AnalyticsReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("Todos")
  const [section, setSection] = useState<"modules" | "agents">("modules")

  const loadReport = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch(`/api/admin?action=analytics&period=${period}`, { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "No se pudo cargar el reporte")
      setReport(data)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error al cargar el reporte")
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  const categories = useMemo(() => {
    if (!report) return ["Todos"]
    return ["Todos", ...Array.from(new Set(report.moduleRows.map(row => row.category))).sort()]
  }, [report])

  const filteredModules = useMemo(() => {
    if (!report) return []
    const needle = search.trim().toLowerCase()
    return report.moduleRows.filter(row => {
      const matchesCategory = category === "Todos" || row.category === category
      const matchesSearch = !needle || [row.name, row.category, row.agentName, row.description]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(needle))
      return matchesCategory && matchesSearch
    })
  }, [report, search, category])

  const filteredAgents = useMemo(() => {
    if (!report) return []
    const needle = search.trim().toLowerCase()
    return report.agentRows.filter(row => !needle || [row.name, ...row.modules].some(value => value.toLowerCase().includes(needle)))
  }, [report, search])

  const maxDailyEvents = Math.max(1, ...(report?.activityByDay.map(day => day.events) || [1]))

  function downloadCsv() {
    if (!report) return

    const moduleHeader = [
      "Tipo", "Módulo", "Categoría", "Agente", "Eventos", "Visitas", "Acciones",
      "Usuarios únicos", "Éxitos", "Errores", "Tasa de éxito", "Latencia promedio",
      "Tokens entrada", "Tokens salida", "Costo estimado USD", "Registros almacenados", "Última actividad",
    ]
    const moduleRows = report.moduleRows.map(row => [
      "Módulo", row.name, row.category, row.agentName || "", row.events, row.pageViews, row.actions,
      row.uniqueUsers, row.successes, row.errors, `${row.successRate}%`, row.avgLatencyMs,
      row.inputTokens, row.outputTokens, row.estimatedCost, row.storedRecords, row.lastActivity || "",
    ])
    const agentRows = report.agentRows.map(row => [
      "Agente", row.modules.join(" · "), "IA", row.name, row.events, row.pageViews, row.actions,
      row.uniqueUsers, row.successes, row.errors, `${row.successRate}%`, row.avgLatencyMs,
      row.inputTokens, row.outputTokens, row.estimatedCost, row.storedRecords, row.lastActivity || "",
    ])
    const csv = [moduleHeader, ...moduleRows, ...agentRows]
      .map(row => row.map(escapeCsv).join(";"))
      .join("\n")

    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `eduai-reporte-modulos-agentes-${new Date().toISOString().slice(0, 10)}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-app text-main">
      <header className="sticky top-0 z-30 border-b border-soft bg-app/95 backdrop-blur-xl print:static">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-3 lg:px-6">
          <Link
            href="/admin"
            className="grid h-9 w-9 place-items-center rounded-xl border border-soft bg-card-soft-theme text-sub transition hover:text-main"
            title="Volver a administración"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 shadow-lg shadow-violet-900/20">
            <FileBarChart size={19} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-bold sm:text-base">Reporte integral de EduAI</h1>
            <p className="truncate text-[11px] text-muted2">Uso, producción y actividad por módulo y agente</p>
          </div>

          <div className="hidden items-center gap-2 print:hidden sm:flex">
            <select
              value={period}
              onChange={event => setPeriod(event.target.value)}
              className="rounded-xl border border-soft bg-card-soft-theme px-3 py-2 text-xs text-sub outline-none"
            >
              {PERIODS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <button onClick={loadReport} className="grid h-9 w-9 place-items-center rounded-xl border border-soft bg-card-soft-theme text-sub hover:text-main" title="Actualizar">
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
            <button onClick={downloadCsv} disabled={!report} className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-500 disabled:opacity-40">
              <Download size={14} /> CSV
            </button>
            <button onClick={() => window.print()} disabled={!report} className="inline-flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-500 disabled:opacity-40">
              <Printer size={14} /> Imprimir
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] space-y-6 px-4 py-6 lg:px-6">
        <div className="flex gap-2 sm:hidden print:hidden">
          <select value={period} onChange={event => setPeriod(event.target.value)} className="flex-1 rounded-xl border border-soft bg-card-soft-theme px-3 py-2 text-xs text-sub">
            {PERIODS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <button onClick={downloadCsv} className="grid h-9 w-9 place-items-center rounded-xl border border-soft bg-card-soft-theme"><Download size={14} /></button>
          <button onClick={() => window.print()} className="grid h-9 w-9 place-items-center rounded-xl border border-soft bg-card-soft-theme"><Printer size={14} /></button>
        </div>

        {loading && !report && (
          <div className="flex min-h-[55vh] flex-col items-center justify-center gap-3">
            <Loader2 size={34} className="animate-spin text-violet-500" />
            <p className="text-sm text-muted2">Construyendo el reporte completo…</p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/5 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 text-red-500" size={20} />
              <div className="flex-1">
                <p className="font-semibold text-red-500">No se pudo cargar el reporte</p>
                <p className="mt-1 text-sm text-sub">{error}</p>
              </div>
              <button onClick={loadReport} className="rounded-xl border border-red-500/20 px-3 py-1.5 text-xs text-red-500">Reintentar</button>
            </div>
          </div>
        )}

        {report && (
          <>
            <section className="rounded-3xl border border-soft bg-card-soft-theme p-5 print:border-gray-300 print:bg-white">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-[11px] font-semibold text-violet-500">
                    <CalendarDays size={12} /> {report.period.label}
                  </div>
                  <h2 className="text-xl font-bold sm:text-2xl">Estado general de la plataforma</h2>
                  <p className="mt-1 max-w-3xl text-sm text-sub">
                    Consolidado de usuarios, visitas, acciones, recursos almacenados y actividad de cada agente.
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted2">Generado</p>
                  <p className="mt-1 text-xs font-medium text-sub">{formatDate(report.generatedAt)}</p>
                </div>
              </div>
            </section>

            {!report.coverage.trackingEnabled && (
              <section className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={19} className="mt-0.5 shrink-0 text-amber-500" />
                  <div>
                    <p className="text-sm font-semibold text-amber-500">Falta ejecutar la tabla de analítica en Supabase</p>
                    <p className="mt-1 text-xs leading-relaxed text-sub">
                      El dashboard ya muestra los registros existentes por módulo, pero las visitas y acciones comenzarán a registrarse después de ejecutar el SQL entregado.
                    </p>
                  </div>
                </div>
              </section>
            )}

            <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
              {[
                { label: "Usuarios", value: formatNumber(report.overview.totalUsers), detail: `${formatNumber(report.overview.activeUsers)} activos`, icon: Users, color: "#3b82f6" },
                { label: "Eventos", value: formatNumber(report.overview.totalEvents), detail: "visitas y acciones", icon: Activity, color: "#8b5cf6" },
                { label: "Módulos", value: `${report.overview.activeModules}/${report.overview.totalModules}`, detail: "con actividad o datos", icon: Layers3, color: "#06b6d4" },
                { label: "Agentes", value: `${report.overview.activeAgents}/${report.overview.totalAgents}`, detail: "con actividad o datos", icon: Bot, color: "#ec4899" },
                { label: "Registros", value: formatNumber(report.overview.totalStoredRecords), detail: "recursos almacenados", icon: Database, color: "#14b8a6" },
                { label: "Éxito", value: `${report.overview.successRate}%`, detail: `${formatNumber(report.overview.errors)} errores`, icon: CheckCircle2, color: "#22c55e" },
                { label: "Latencia", value: formatLatency(report.overview.avgLatencyMs), detail: "promedio registrado", icon: Gauge, color: "#f59e0b" },
                { label: "Costo IA", value: formatCost(report.overview.estimatedCost), detail: `${formatNumber(report.overview.inputTokens + report.overview.outputTokens)} tokens`, icon: Zap, color: "#f97316" },
              ].map(card => {
                const Icon = card.icon
                return (
                  <article key={card.label} className="rounded-2xl border p-4" style={{ borderColor: `${card.color}28`, background: `${card.color}08` }}>
                    <Icon size={17} style={{ color: card.color }} />
                    <p className="mt-3 text-xl font-bold leading-none">{card.value}</p>
                    <p className="mt-2 text-[11px] font-semibold text-sub">{card.label}</p>
                    <p className="mt-0.5 text-[10px] text-muted2">{card.detail}</p>
                  </article>
                )
              })}
            </section>

            <section className="grid gap-4 xl:grid-cols-[2fr_1fr]">
              <article className="rounded-2xl border border-soft bg-card-soft-theme p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold">Actividad de los últimos {report.activityByDay.length} días</h3>
                    <p className="mt-1 text-xs text-muted2">Eventos registrados por día</p>
                  </div>
                  <Activity size={18} className="text-violet-500" />
                </div>
                <div className="mt-6 flex h-44 items-end gap-1.5 overflow-hidden">
                  {report.activityByDay.map((day, index) => {
                    const height = Math.max(day.events ? 8 : 2, (day.events / maxDailyEvents) * 100)
                    const showLabel = report.activityByDay.length <= 10 || index % 5 === 0 || index === report.activityByDay.length - 1
                    return (
                      <div key={day.date} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                        <div className="relative flex h-36 w-full items-end justify-center">
                          <div
                            className="w-full max-w-8 rounded-t-md bg-gradient-to-t from-violet-600 to-blue-400 transition-all group-hover:brightness-110"
                            style={{ height: `${height}%`, opacity: day.events ? 1 : 0.18 }}
                            title={`${day.date}: ${day.events} eventos · ${day.uniqueUsers} usuarios · ${day.errors} errores`}
                          />
                        </div>
                        <span className="h-4 truncate text-[8px] text-muted2">
                          {showLabel ? new Date(`${day.date}T12:00:00`).toLocaleDateString("es-CL", { day: "2-digit", month: "short" }) : ""}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </article>

              <article className="rounded-2xl border border-soft bg-card-soft-theme p-5">
                <h3 className="font-bold">Tipos de actividad</h3>
                <p className="mt-1 text-xs text-muted2">Distribución de eventos registrados</p>
                <div className="mt-5 space-y-3">
                  {report.eventTypes.length ? report.eventTypes.slice(0, 7).map(item => {
                    const ratio = report.overview.totalEvents ? (item.count / report.overview.totalEvents) * 100 : 0
                    return (
                      <div key={item.type}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-sub">{EVENT_LABELS[item.type] || item.type}</span>
                          <span className="font-semibold">{formatNumber(item.count)}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-card-soft-theme">
                          <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.max(ratio, item.count ? 3 : 0)}%` }} />
                        </div>
                      </div>
                    )
                  }) : (
                    <div className="rounded-xl border border-dashed border-soft p-5 text-center text-xs text-muted2">Aún no hay eventos registrados.</div>
                  )}
                </div>
              </article>
            </section>

            <section className="rounded-2xl border border-soft bg-card-soft-theme">
              <div className="flex flex-col gap-3 border-b border-soft p-4 lg:flex-row lg:items-center">
                <div className="flex rounded-xl border border-soft bg-app p-1">
                  <button
                    onClick={() => setSection("modules")}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${section === "modules" ? "bg-violet-600 text-white" : "text-sub"}`}
                  >
                    <Layers3 size={13} /> Por módulo
                  </button>
                  <button
                    onClick={() => setSection("agents")}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${section === "agents" ? "bg-violet-600 text-white" : "text-sub"}`}
                  >
                    <Bot size={13} /> Por agente
                  </button>
                </div>

                <div className="relative min-w-0 flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted2" />
                  <input
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder={section === "modules" ? "Buscar módulo, agente o categoría…" : "Buscar agente…"}
                    className="w-full rounded-xl border border-soft bg-app py-2 pl-9 pr-3 text-xs text-main outline-none focus:border-violet-500/40"
                  />
                </div>

                {section === "modules" && (
                  <div className="relative">
                    <Filter size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted2" />
                    <select value={category} onChange={event => setCategory(event.target.value)} className="rounded-xl border border-soft bg-app py-2 pl-8 pr-8 text-xs text-sub outline-none">
                      {categories.map(item => <option key={item}>{item}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                {section === "modules" ? (
                  <table className="min-w-[1280px] w-full">
                    <thead>
                      <tr className="border-b border-soft text-left text-[10px] uppercase tracking-widest text-muted2">
                        <th className="px-4 py-3">Módulo</th>
                        <th className="px-3 py-3">Estado</th>
                        <th className="px-3 py-3 text-right">Eventos</th>
                        <th className="px-3 py-3 text-right">Visitas</th>
                        <th className="px-3 py-3 text-right">Acciones</th>
                        <th className="px-3 py-3 text-right">Usuarios</th>
                        <th className="px-3 py-3 text-right">Éxito</th>
                        <th className="px-3 py-3 text-right">Errores</th>
                        <th className="px-3 py-3 text-right">Latencia</th>
                        <th className="px-3 py-3 text-right">Tokens</th>
                        <th className="px-3 py-3 text-right">Registros</th>
                        <th className="px-4 py-3">Última actividad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredModules.map(row => {
                        const meta = statusMeta(row.status)
                        const StatusIcon = meta.icon
                        return (
                          <tr key={row.key} className="border-b border-soft/70 align-top transition hover:bg-app/40">
                            <td className="px-4 py-4">
                              <div className="flex min-w-[240px] items-start gap-3">
                                <span className="text-xl">{row.icon}</span>
                                <div>
                                  <Link href={row.href} className="text-sm font-semibold hover:text-violet-500">{row.name}</Link>
                                  <p className="mt-0.5 text-[10px] text-muted2">{row.category}{row.agentName ? ` · ${row.agentName}` : ""}</p>
                                  <p className="mt-1 max-w-[320px] text-[10px] leading-relaxed text-muted2">{row.description}</p>
                                  {row.sourceBreakdown.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                      {row.sourceBreakdown.map(source => (
                                        <span key={source.table} className={`rounded-md border px-1.5 py-0.5 text-[9px] ${source.available ? "border-cyan-500/15 bg-cyan-500/5 text-cyan-500" : "border-gray-500/15 text-muted2"}`}>
                                          {source.label}: {formatNumber(source.count)}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-4">
                              <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold" style={{ color: meta.color, borderColor: `${meta.color}30`, background: `${meta.color}0d` }}>
                                <StatusIcon size={11} /> {meta.label}
                              </span>
                            </td>
                            <td className="px-3 py-4 text-right text-sm font-bold">{formatNumber(row.events)}</td>
                            <td className="px-3 py-4 text-right text-xs text-sub">{formatNumber(row.pageViews)}</td>
                            <td className="px-3 py-4 text-right text-xs text-sub">{formatNumber(row.actions)}</td>
                            <td className="px-3 py-4 text-right text-xs text-sub">{formatNumber(row.uniqueUsers)}</td>
                            <td className="px-3 py-4 text-right text-xs font-semibold text-emerald-500">{row.events ? `${row.successRate}%` : "—"}</td>
                            <td className="px-3 py-4 text-right text-xs font-semibold text-red-500">{formatNumber(row.errors)}</td>
                            <td className="px-3 py-4 text-right text-xs text-sub">{formatLatency(row.avgLatencyMs)}</td>
                            <td className="px-3 py-4 text-right text-xs text-sub">{formatNumber(row.inputTokens + row.outputTokens)}</td>
                            <td className="px-3 py-4 text-right text-sm font-semibold text-cyan-500">{formatNumber(row.storedRecords)}</td>
                            <td className="px-4 py-4 text-[10px] text-muted2">{formatDate(row.lastActivity)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                ) : (
                  <table className="min-w-[1100px] w-full">
                    <thead>
                      <tr className="border-b border-soft text-left text-[10px] uppercase tracking-widest text-muted2">
                        <th className="px-4 py-3">Agente</th>
                        <th className="px-3 py-3 text-right">Eventos</th>
                        <th className="px-3 py-3 text-right">Usuarios</th>
                        <th className="px-3 py-3 text-right">Acciones</th>
                        <th className="px-3 py-3 text-right">Éxito</th>
                        <th className="px-3 py-3 text-right">Errores</th>
                        <th className="px-3 py-3 text-right">Latencia</th>
                        <th className="px-3 py-3 text-right">Tokens</th>
                        <th className="px-3 py-3 text-right">Costo</th>
                        <th className="px-3 py-3 text-right">Registros</th>
                        <th className="px-4 py-3">Última actividad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAgents.map(row => (
                        <tr key={row.key} className="border-b border-soft/70 transition hover:bg-app/40">
                          <td className="px-4 py-4">
                            <div className="flex min-w-[220px] items-start gap-3">
                              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-violet-500/20 bg-violet-500/10 text-violet-500"><Bot size={16} /></div>
                              <div>
                                <p className="text-sm font-semibold">{row.name}</p>
                                <p className="mt-1 max-w-[300px] text-[10px] text-muted2">{row.modules.join(" · ")}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-4 text-right text-sm font-bold">{formatNumber(row.events)}</td>
                          <td className="px-3 py-4 text-right text-xs text-sub">{formatNumber(row.uniqueUsers)}</td>
                          <td className="px-3 py-4 text-right text-xs text-sub">{formatNumber(row.actions)}</td>
                          <td className="px-3 py-4 text-right text-xs font-semibold text-emerald-500">{row.events ? `${row.successRate}%` : "—"}</td>
                          <td className="px-3 py-4 text-right text-xs font-semibold text-red-500">{formatNumber(row.errors)}</td>
                          <td className="px-3 py-4 text-right text-xs text-sub">{formatLatency(row.avgLatencyMs)}</td>
                          <td className="px-3 py-4 text-right text-xs text-sub">{formatNumber(row.inputTokens + row.outputTokens)}</td>
                          <td className="px-3 py-4 text-right text-xs text-orange-500">{formatCost(row.estimatedCost)}</td>
                          <td className="px-3 py-4 text-right text-sm font-semibold text-cyan-500">{formatNumber(row.storedRecords)}</td>
                          <td className="px-4 py-4 text-[10px] text-muted2">{formatDate(row.lastActivity)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              <article className="rounded-2xl border border-soft bg-card-soft-theme p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold">Usuarios con más actividad</h3>
                    <p className="mt-1 text-xs text-muted2">Según eventos del período</p>
                  </div>
                  <Users size={17} className="text-blue-500" />
                </div>
                <div className="mt-4 space-y-2">
                  {report.topUsers.length ? report.topUsers.map((user, index) => (
                    <div key={user.id} className="flex items-center gap-3 rounded-xl border border-soft bg-app/40 px-3 py-2.5">
                      <div className="grid h-7 w-7 place-items-center rounded-lg bg-blue-500/10 text-xs font-bold text-blue-500">{index + 1}</div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold">{user.name}</p>
                        <p className="truncate text-[10px] text-muted2">{user.email || "Sin email visible"}</p>
                      </div>
                      <span className="text-sm font-bold text-blue-500">{formatNumber(user.events)}</span>
                    </div>
                  )) : <p className="rounded-xl border border-dashed border-soft p-6 text-center text-xs text-muted2">Sin actividad registrada.</p>}
                </div>
              </article>

              <article className="rounded-2xl border border-soft bg-card-soft-theme p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold">Errores recientes</h3>
                    <p className="mt-1 text-xs text-muted2">Eventos fallidos registrados</p>
                  </div>
                  <XCircle size={17} className="text-red-500" />
                </div>
                <div className="mt-4 max-h-[370px] space-y-2 overflow-y-auto pr-1">
                  {report.recentErrors.length ? report.recentErrors.map((item, index) => (
                    <div key={`${item.createdAt}-${index}`} className="rounded-xl border border-red-500/15 bg-red-500/5 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-red-500">{item.moduleName}</p>
                          <p className="mt-0.5 text-[10px] text-muted2">{item.agentName || item.eventType}{item.errorCode ? ` · ${item.errorCode}` : ""}</p>
                        </div>
                        <span className="shrink-0 text-[9px] text-muted2">{formatDate(item.createdAt)}</span>
                      </div>
                      {item.path && <p className="mt-2 truncate font-mono text-[9px] text-sub">{item.path}</p>}
                    </div>
                  )) : (
                    <div className="flex min-h-32 flex-col items-center justify-center rounded-xl border border-dashed border-soft text-center">
                      <CheckCircle2 size={24} className="mb-2 text-emerald-500" />
                      <p className="text-xs font-semibold">Sin errores registrados</p>
                      <p className="mt-1 text-[10px] text-muted2">No hay eventos fallidos en este período.</p>
                    </div>
                  )}
                </div>
              </article>
            </section>

            <section className="rounded-2xl border border-soft bg-card-soft-theme p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="font-bold">Cobertura de datos</h3>
                  <p className="mt-1 text-xs text-muted2">Estado de las fuentes usadas para construir este reporte.</p>
                </div>
                <div className="flex flex-wrap gap-2 text-[10px]">
                  <span className={`rounded-full border px-3 py-1.5 font-semibold ${report.coverage.trackingEnabled ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500" : "border-amber-500/20 bg-amber-500/10 text-amber-500"}`}>
                    Tracking: {report.coverage.trackingEnabled ? "activo" : "pendiente SQL"}
                  </span>
                  <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 font-semibold text-cyan-500">
                    Fuentes: {report.coverage.availableSources}/{report.coverage.totalSources}
                  </span>
                  {report.coverage.eventLimitReached && <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 font-semibold text-amber-500">Límite de 10.000 eventos alcanzado</span>}
                </div>
              </div>

              {report.coverage.missingSources.length > 0 && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {report.coverage.missingSources.map(source => (
                    <div key={source.table} className="rounded-xl border border-gray-500/15 bg-app/40 p-3">
                      <p className="text-xs font-semibold text-sub">{source.label}</p>
                      <p className="mt-1 font-mono text-[9px] text-muted2">{source.table}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
