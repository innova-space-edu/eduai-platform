"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Bot,
  ExternalLink,
  FileSpreadsheet,
  Layers3,
  Loader2,
  Search,
  ShieldCheck,
  X,
} from "lucide-react"

type ModuleRow = {
  key: string
  name: string
  category: string
  href: string
  icon: string
  agentKey: string | null
  agentName: string | null
  events: number
  storedRecords: number
}

type AgentRow = {
  key: string
  name: string
  modules: string[]
  events: number
  uniqueUsers: number
}

type NavigationReport = {
  moduleRows: ModuleRow[]
  agentRows: AgentRow[]
}

export default function AdminAnonymousReportButton() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState<"modules" | "agents">("modules")
  const [search, setSearch] = useState("")
  const [report, setReport] = useState<NavigationReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const visible = pathname === "/admin" || pathname === "/admin/reporte"

  useEffect(() => {
    if (!open) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [open])

  const filteredModules = useMemo(() => {
    if (!report) return []
    const needle = search.trim().toLowerCase()
    if (!needle) return report.moduleRows
    return report.moduleRows.filter(module => [
      module.name,
      module.category,
      module.agentName || "",
    ].some(value => value.toLowerCase().includes(needle)))
  }, [report, search])

  const filteredAgents = useMemo(() => {
    if (!report) return []
    const needle = search.trim().toLowerCase()
    if (!needle) return report.agentRows
    return report.agentRows.filter(agent => [agent.name, ...agent.modules]
      .some(value => value.toLowerCase().includes(needle)))
  }, [report, search])

  if (!visible) return null

  async function loadNavigation() {
    if (loading || report) return
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin?action=analytics&period=30", { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "No se pudo cargar la navegación")
      setReport({
        moduleRows: Array.isArray(data.moduleRows) ? data.moduleRows : [],
        agentRows: Array.isArray(data.agentRows) ? data.agentRows : [],
      })
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la navegación")
    } finally {
      setLoading(false)
    }
  }

  function openNavigator() {
    setOpen(true)
    void loadNavigation()
  }

  function agentHref(agent: AgentRow) {
    const module = report?.moduleRows.find(item =>
      item.agentKey === agent.key || item.agentName === agent.name
    )
    return module?.href || "/agentes"
  }

  return (
    <>
      <div className="fixed bottom-20 left-5 z-40 flex flex-col items-start gap-2 print:hidden">
        <button
          type="button"
          onClick={openNavigator}
          className="inline-flex items-center gap-2 rounded-full border border-violet-500/25 bg-app/95 px-4 py-2.5 text-xs font-semibold text-violet-600 shadow-lg backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-violet-500/50"
          title="Abrir navegación por módulos y agentes"
        >
          <Layers3 size={16} />
          Abrir módulos/agentes
        </button>

        <Link
          href="/admin/reporte/anonimo"
          className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-app/95 px-4 py-2.5 text-xs font-semibold text-emerald-600 shadow-lg backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-emerald-500/50"
          title="Descargar reporte anónimo detallado en PDF o Excel"
        >
          <span className="relative">
            <FileSpreadsheet size={16} />
            <ShieldCheck size={9} className="absolute -bottom-1 -right-1" />
          </span>
          Reporte anónimo PDF/Excel
        </Link>
      </div>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm print:hidden" role="dialog" aria-modal="true" aria-label="Navegación administrativa">
          <button
            type="button"
            aria-label="Cerrar navegación"
            className="absolute inset-0 cursor-default"
            onClick={() => setOpen(false)}
          />

          <section className="relative z-10 flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-soft bg-app shadow-2xl">
            <header className="flex items-center gap-3 border-b border-soft px-4 py-4 sm:px-6">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 text-white">
                <Layers3 size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-bold text-main sm:text-base">Navegación del dashboard</h2>
                <p className="truncate text-[11px] text-muted2">Abre directamente cada módulo o agente de EduAI.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-xl border border-soft bg-card-soft-theme text-sub hover:text-main"
                aria-label="Cerrar"
              >
                <X size={16} />
              </button>
            </header>

            <div className="flex flex-col gap-3 border-b border-soft p-4 sm:flex-row sm:items-center sm:px-6">
              <div className="flex rounded-xl border border-soft bg-card-soft-theme p-1">
                <button
                  type="button"
                  onClick={() => setSection("modules")}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${section === "modules" ? "bg-violet-600 text-white" : "text-sub"}`}
                >
                  <Layers3 size={13} /> Módulos
                </button>
                <button
                  type="button"
                  onClick={() => setSection("agents")}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${section === "agents" ? "bg-violet-600 text-white" : "text-sub"}`}
                >
                  <Bot size={13} /> Agentes
                </button>
              </div>

              <div className="relative min-w-0 flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted2" />
                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder={section === "modules" ? "Buscar módulo, categoría o agente…" : "Buscar agente o módulo…"}
                  className="w-full rounded-xl border border-soft bg-card-soft-theme py-2.5 pl-9 pr-3 text-xs text-main outline-none focus:border-violet-500/40"
                  autoFocus
                />
              </div>
            </div>

            <div className="min-h-64 flex-1 overflow-y-auto p-4 sm:p-6">
              {loading && (
                <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-muted2">
                  <Loader2 size={28} className="animate-spin text-violet-500" />
                  <p className="text-xs">Sincronizando módulos y agentes…</p>
                </div>
              )}

              {error && !loading && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-red-500">
                  <p className="font-semibold">No se pudo cargar la navegación</p>
                  <p className="mt-1 text-xs">{error}</p>
                  <button
                    type="button"
                    onClick={() => { setReport(null); void loadNavigation() }}
                    className="mt-3 rounded-xl border border-red-500/20 px-3 py-1.5 text-xs font-semibold"
                  >
                    Reintentar
                  </button>
                </div>
              )}

              {!loading && !error && section === "modules" && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredModules.map(module => (
                    <Link
                      key={module.key}
                      href={module.href}
                      onClick={() => setOpen(false)}
                      className="group flex min-h-28 items-start gap-3 rounded-2xl border border-soft bg-card-soft-theme p-4 transition hover:-translate-y-0.5 hover:border-cyan-500/35 hover:bg-cyan-500/5"
                    >
                      <span className="text-2xl">{module.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-main group-hover:text-cyan-600">{module.name}</span>
                        <span className="mt-1 block text-[10px] text-muted2">{module.category}{module.agentName ? ` · ${module.agentName}` : ""}</span>
                        <span className="mt-3 block text-[10px] text-sub">{module.events} eventos · {module.storedRecords} registros</span>
                      </span>
                      <ExternalLink size={14} className="mt-1 shrink-0 text-muted2 group-hover:text-cyan-500" />
                    </Link>
                  ))}
                  {filteredModules.length === 0 && (
                    <div className="col-span-full rounded-2xl border border-dashed border-soft p-10 text-center text-sm text-muted2">No se encontraron módulos.</div>
                  )}
                </div>
              )}

              {!loading && !error && section === "agents" && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredAgents.map(agent => (
                    <Link
                      key={agent.key}
                      href={agentHref(agent)}
                      onClick={() => setOpen(false)}
                      className="group flex min-h-28 items-start gap-3 rounded-2xl border border-soft bg-card-soft-theme p-4 transition hover:-translate-y-0.5 hover:border-pink-500/35 hover:bg-pink-500/5"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-pink-500/20 bg-pink-500/10 text-pink-500"><Bot size={17} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-main group-hover:text-pink-600">{agent.name}</span>
                        <span className="mt-1 block line-clamp-2 text-[10px] text-muted2">{agent.modules.join(" · ")}</span>
                        <span className="mt-3 block text-[10px] text-sub">{agent.events} eventos · {agent.uniqueUsers} usuarios</span>
                      </span>
                      <ExternalLink size={14} className="mt-1 shrink-0 text-muted2 group-hover:text-pink-500" />
                    </Link>
                  ))}
                  {filteredAgents.length === 0 && (
                    <div className="col-span-full rounded-2xl border border-dashed border-soft p-10 text-center text-sm text-muted2">No se encontraron agentes.</div>
                  )}
                </div>
              )}
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-soft px-4 py-3 text-[10px] text-muted2 sm:px-6">
              <span>Datos sincronizados desde el reporte administrativo.</span>
              <Link href="/admin/reporte" onClick={() => setOpen(false)} className="font-semibold text-violet-600 hover:underline">
                Abrir reporte completo
              </Link>
            </footer>
          </section>
        </div>
      )}
    </>
  )
}
