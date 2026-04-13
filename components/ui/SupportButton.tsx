"use client"

import { usePathname } from "next/navigation"

import { useEffect, useState } from "react"
import {
  LifeBuoy, X, Send, ChevronRight, Loader2,
  CheckCircle2, Clock, AlertCircle, XCircle, MessageSquare
} from "lucide-react"

const CATEGORIES = [
  { id: "problema",    label: "🐛 Error / Problema técnico" },
  { id: "cuenta",      label: "👤 Problema con mi cuenta"   },
  { id: "contenido",   label: "📚 Problema con contenido"   },
  { id: "sugerencia",  label: "💡 Sugerencia de mejora"     },
  { id: "otro",        label: "📝 Otro"                     },
]

const PRIORITIES = [
  { id: "baja",    label: "Baja",    color: "#9ca3af" },
  { id: "normal",  label: "Normal",  color: "#60a5fa" },
  { id: "alta",    label: "Alta",    color: "#fbbf24" },
  { id: "urgente", label: "Urgente", color: "#f87171" },
]

const STATUS_META: Record<string, { label: string; icon: typeof CheckCircle2; color: string }> = {
  abierto:     { label: "Abierto",      icon: Clock,         color: "#60a5fa" },
  en_revision: { label: "En revisión",  icon: AlertCircle,   color: "#fbbf24" },
  resuelto:    { label: "Resuelto",     icon: CheckCircle2,  color: "#4ade80" },
  cerrado:     { label: "Cerrado",      icon: XCircle,       color: "#9ca3af" },
}

interface Report {
  id: string
  subject: string
  category: string
  status: string
  priority: string
  admin_reply?: string
  created_at: string
  updated_at: string
}

export default function SupportButton() {
  const pathname = usePathname()
  if (pathname?.startsWith("/examen/p/")) return null

  const [open,        setOpen]        = useState(false)
  const [tab,         setTab]         = useState<"new" | "history">("new")
  const [reports,     setReports]     = useState<Report[]>([])
  const [loadingHist, setLoadingHist] = useState(false)

  // Form state
  const [category,    setCategory]    = useState("problema")
  const [priority,    setPriority]    = useState("normal")
  const [subject,     setSubject]     = useState("")
  const [description, setDescription]= useState("")
  const [sending,     setSending]     = useState(false)
  const [sent,        setSent]        = useState(false)
  const [error,       setError]       = useState("")

  // Unread badge
  const [unreadReply, setUnreadReply] = useState(0)

  useEffect(() => {
    if (open && tab === "history") loadHistory()
  }, [open, tab])

  useEffect(() => {
    // Revisar respuestas no leídas al montar
    fetch("/api/reports")
      .then(r => r.json())
      .then(d => {
        const withReply = (d.reports || []).filter((r: Report) => r.admin_reply && r.status !== "cerrado")
        setUnreadReply(withReply.length)
      })
      .catch(() => {})
  }, [])

  async function loadHistory() {
    setLoadingHist(true)
    try {
      const res  = await fetch("/api/reports")
      const data = await res.json()
      setReports(data.reports || [])
    } catch {}
    finally { setLoadingHist(false) }
  }

  async function handleSubmit() {
    if (!subject.trim() || !description.trim()) {
      setError("Completa el asunto y la descripción.")
      return
    }
    setSending(true); setError("")
    try {
      const res  = await fetch("/api/reports", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, description, category, priority }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setSent(true)
      setSubject(""); setDescription(""); setCategory("problema"); setPriority("normal")
      setTimeout(() => { setSent(false); setTab("history"); loadHistory() }, 2000)
    } catch (e: any) { setError(e.message || "Error al enviar el reporte") }
    finally { setSending(false) }
  }

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition-all hover:scale-110"
        style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed)", boxShadow: "0 4px 20px rgba(37,99,235,0.4)" }}
        title="Soporte y reportes"
      >
        <LifeBuoy size={22} className="text-main" />
        {unreadReply > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-green-400 text-gray-950 text-[10px] font-bold flex items-center justify-center">
            {unreadReply}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end sm:pr-6 sm:pb-6">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 sm:hidden" onClick={() => setOpen(false)} />

          <div
            className="relative w-full sm:w-[420px] max-h-[85vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-soft flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                     style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed)" }}>
                  <LifeBuoy size={16} className="text-main" />
                </div>
                <div>
                  <p className="text-main font-bold text-sm">Centro de soporte</p>
                  <p className="text-muted2 text-[10px]">Colegio Providencia</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted2 hover:text-main transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-soft flex-shrink-0">
              {[
                { id: "new",     label: "Nuevo reporte",  icon: Send          },
                { id: "history", label: "Mis reportes",   icon: MessageSquare },
              ].map(t => {
                const Icon = t.icon
                return (
                  <button key={t.id} onClick={() => setTab(t.id as any)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium transition-all"
                    style={{
                      color:        tab === t.id ? "#60a5fa" : "#6b7280",
                      borderBottom: tab === t.id ? "2px solid #3b82f6" : "2px solid transparent",
                    }}>
                    <Icon size={13} />
                    {t.label}
                  </button>
                )
              })}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">

              {/* ── Nuevo reporte ─────────────────────────── */}
              {tab === "new" && (
                <div className="p-5 space-y-4">
                  {sent ? (
                    <div className="flex flex-col items-center py-8 gap-3 animate-fade-in">
                      <CheckCircle2 size={40} className="text-green-400" />
                      <p className="text-main font-bold">¡Reporte enviado!</p>
                      <p className="text-sub text-sm text-center">El administrador revisará tu reporte y te responderá pronto.</p>
                    </div>
                  ) : (
                    <>
                      {/* Categoría */}
                      <div>
                        <label className="text-muted2 text-[10px] font-semibold uppercase tracking-widest block mb-2">Categoría</label>
                        <div className="grid grid-cols-1 gap-1.5">
                          {CATEGORIES.map(c => (
                            <button key={c.id} onClick={() => setCategory(c.id)}
                              className="text-left px-3 py-2 rounded-xl border text-xs transition-all"
                              style={{
                                background:  category === c.id ? "rgba(59,130,246,0.1)" : "var(--bg-card-soft)",
                                borderColor: category === c.id ? "rgba(59,130,246,0.3)" : "var(--bg-card-soft)",
                                color:       category === c.id ? "#93c5fd" : "#9ca3af",
                              }}>
                              {c.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Prioridad */}
                      <div>
                        <label className="text-muted2 text-[10px] font-semibold uppercase tracking-widest block mb-2">Urgencia</label>
                        <div className="flex gap-2">
                          {PRIORITIES.map(p => (
                            <button key={p.id} onClick={() => setPriority(p.id)}
                              className="flex-1 py-2 rounded-xl border text-[10px] font-semibold transition-all"
                              style={{
                                background:  priority === p.id ? `${p.color}18` : "var(--bg-card-soft)",
                                borderColor: priority === p.id ? `${p.color}50` : "var(--bg-card-soft)",
                                color:       priority === p.id ? p.color : "#6b7280",
                              }}>
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Asunto */}
                      <div>
                        <label className="text-muted2 text-[10px] font-semibold uppercase tracking-widest block mb-2">Asunto *</label>
                        <input
                          value={subject} onChange={e => setSubject(e.target.value)}
                          placeholder="Describe brevemente el problema..."
                          className="w-full bg-card-soft-theme border border-soft rounded-xl px-3 py-2.5 text-sm text-main placeholder-gray-400 focus:outline-none focus:border-blue-500/40 transition-all"
                        />
                      </div>

                      {/* Descripción */}
                      <div>
                        <label className="text-muted2 text-[10px] font-semibold uppercase tracking-widest block mb-2">Descripción *</label>
                        <textarea
                          value={description} onChange={e => setDescription(e.target.value)}
                          placeholder="Explica con detalle qué ocurrió, qué esperabas que pasara y cualquier información adicional relevante..."
                          rows={4}
                          className="w-full bg-card-soft-theme border border-soft rounded-xl px-3 py-2.5 text-sm text-main placeholder-gray-400 focus:outline-none focus:border-blue-500/40 resize-none transition-all"
                        />
                      </div>

                      {error && (
                        <p className="text-red-400 text-xs px-3 py-2 rounded-xl border border-red-500/20" style={{ background: "rgba(239,68,68,0.08)" }}>
                          {error}
                        </p>
                      )}

                      <button onClick={handleSubmit} disabled={sending}
                        className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed)", boxShadow: "0 4px 16px rgba(37,99,235,0.3)" }}>
                        {sending ? <><Loader2 size={15} className="animate-spin" /> Enviando...</> : <><Send size={15} /> Enviar reporte</>}
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* ── Historial ────────────────────────────── */}
              {tab === "history" && (
                <div className="p-4">
                  {loadingHist ? (
                    <div className="flex justify-center py-10">
                      <div className="w-8 h-8 rounded-full border-2 border-soft border-t-blue-400 animate-spin" />
                    </div>
                  ) : reports.length === 0 ? (
                    <div className="text-center py-10">
                      <MessageSquare size={32} className="text-muted2 mx-auto mb-2" />
                      <p className="text-muted2 text-sm">Sin reportes enviados</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {reports.map(r => {
                        const meta = STATUS_META[r.status] || STATUS_META.abierto
                        const Icon = meta.icon
                        return (
                          <div key={r.id} className="rounded-2xl border p-3.5 space-y-2"
                               style={{ background: "var(--bg-card-soft)", borderColor: "var(--bg-card-soft)" }}>
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-main text-xs font-semibold leading-snug flex-1">{r.subject}</p>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <Icon size={11} style={{ color: meta.color }} />
                                <span className="text-[10px] font-medium" style={{ color: meta.color }}>{meta.label}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] text-muted2">
                                {new Date(r.created_at).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
                              </span>
                              {PRIORITIES.find(p => p.id === r.priority) && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                                      style={{
                                        color:      PRIORITIES.find(p => p.id === r.priority)!.color,
                                        background: `${PRIORITIES.find(p => p.id === r.priority)!.color}15`,
                                      }}>
                                  {PRIORITIES.find(p => p.id === r.priority)!.label}
                                </span>
                              )}
                            </div>
                            {r.admin_reply && (
                              <div className="rounded-xl p-2.5 mt-1 border border-green-500/20"
                                   style={{ background: "rgba(34,197,94,0.06)" }}>
                                <p className="text-green-400 text-[10px] font-semibold mb-1">✓ Respuesta del administrador:</p>
                                <p className="text-sub text-xs leading-relaxed">{r.admin_reply}</p>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
