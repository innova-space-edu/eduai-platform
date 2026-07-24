"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  LifeBuoy,
  Loader2,
  MessageSquare,
  Send,
} from "lucide-react"
import LegalFooter from "@/components/legal/LegalFooter"

const CATEGORIES = [
  { id: "problema", label: "Error o problema técnico" },
  { id: "cuenta", label: "Problema con mi cuenta" },
  { id: "contenido", label: "Problema con contenido" },
  { id: "sugerencia", label: "Sugerencia de mejora" },
  { id: "privacidad", label: "Privacidad o datos personales" },
  { id: "seguridad", label: "Seguridad" },
  { id: "otro", label: "Otro" },
]

const PRIORITIES = ["baja", "normal", "alta", "urgente"]

type Report = {
  id: string
  subject: string
  category: string
  status: string
  priority: string
  admin_reply?: string
  created_at: string
}

export default function SupportPage() {
  const pathname = usePathname()
  const [tab, setTab] = useState<"new" | "history">("new")
  const [category, setCategory] = useState("problema")
  const [priority, setPriority] = useState("normal")
  const [subject, setSubject] = useState("")
  const [description, setDescription] = useState("")
  const [reports, setReports] = useState<Report[]>([])
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  async function loadReports() {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/reports", { cache: "no-store" })
      const data = await response.json()
      if (response.status === 401) throw new Error("Debes iniciar sesión para revisar o enviar reportes.")
      if (!response.ok) throw new Error(data.error || "No se pudieron cargar los reportes")
      setReports(data.reports || [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los reportes")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (tab === "history") loadReports()
  }, [tab])

  async function submitReport(event: React.FormEvent) {
    event.preventDefault()
    if (!subject.trim() || !description.trim()) {
      setError("Completa el asunto y la descripción.")
      return
    }

    setSending(true)
    setError("")
    try {
      const context = [
        "",
        "--- Contexto técnico adjunto automáticamente ---",
        `Ruta: ${pathname || window.location.pathname}`,
        `Fecha: ${new Date().toISOString()}`,
        `Navegador: ${navigator.userAgent}`,
      ].join("\n")

      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          description: `${description.trim()}${context}`,
          category,
          priority,
        }),
      })
      const data = await response.json()
      if (response.status === 401) throw new Error("Debes iniciar sesión para enviar un reporte.")
      if (!response.ok || !data.success) throw new Error(data.error || "No se pudo enviar el reporte")

      setSent(true)
      setSubject("")
      setDescription("")
      setCategory("problema")
      setPriority("normal")
      window.setTimeout(() => {
        setSent(false)
        setTab("history")
      }, 1600)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo enviar el reporte")
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="min-h-screen bg-app text-main">
      <header className="sticky top-0 z-30 border-b border-soft bg-app/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/dashboard" className="grid h-9 w-9 place-items-center rounded-xl border border-soft bg-card-soft-theme text-sub hover:text-main" aria-label="Volver">
            <ArrowLeft size={16} />
          </Link>
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-white">
            <LifeBuoy size={19} />
          </div>
          <div>
            <h1 className="text-sm font-bold">Soporte y reportes</h1>
            <p className="text-[11px] text-muted2">Mensaje directo al equipo administrador de EduAI</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <section className="rounded-3xl border border-soft bg-card-soft-theme p-5 sm:p-8">
          <div className="flex border-b border-soft">
            <button onClick={() => setTab("new")} className={`flex-1 py-3 text-sm font-semibold ${tab === "new" ? "border-b-2 border-blue-500 text-blue-500" : "text-muted2"}`}>
              <span className="inline-flex items-center gap-2"><Send size={14} /> Nuevo reporte</span>
            </button>
            <button onClick={() => setTab("history")} className={`flex-1 py-3 text-sm font-semibold ${tab === "history" ? "border-b-2 border-blue-500 text-blue-500" : "text-muted2"}`}>
              <span className="inline-flex items-center gap-2"><MessageSquare size={14} /> Mis reportes</span>
            </button>
          </div>

          {tab === "new" && (
            <form onSubmit={submitReport} className="mt-6 space-y-5">
              {sent && (
                <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-emerald-500">
                  <CheckCircle2 size={20} />
                  <p className="text-sm font-semibold">Reporte enviado al administrador.</p>
                </div>
              )}

              <div>
                <label className="mb-2 block text-xs font-semibold text-sub">Categoría</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {CATEGORIES.map(item => (
                    <button key={item.id} type="button" onClick={() => setCategory(item.id)} className="rounded-xl border px-3 py-2.5 text-left text-xs transition" style={{ borderColor: category === item.id ? "rgba(59,130,246,.45)" : "var(--border-soft)", background: category === item.id ? "rgba(59,130,246,.08)" : "var(--bg-card-soft)" }}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-sub">Prioridad</label>
                <div className="grid grid-cols-4 gap-2">
                  {PRIORITIES.map(item => (
                    <button key={item} type="button" onClick={() => setPriority(item)} className={`rounded-xl border px-2 py-2 text-[11px] font-semibold capitalize ${priority === item ? "border-amber-500/40 bg-amber-500/10 text-amber-500" : "border-soft text-muted2"}`}>
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-sub">Asunto</label>
                <input value={subject} onChange={event => setSubject(event.target.value)} maxLength={160} required placeholder="Describe brevemente qué ocurrió" className="w-full rounded-xl border border-soft bg-app px-4 py-3 text-sm outline-none focus:border-blue-500/40" />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-sub">Descripción</label>
                <textarea value={description} onChange={event => setDescription(event.target.value)} maxLength={5000} rows={7} required placeholder="Indica los pasos realizados, qué esperabas y qué ocurrió. No incluyas contraseñas, RUT, notas ni datos sensibles." className="w-full resize-y rounded-xl border border-soft bg-app px-4 py-3 text-sm outline-none focus:border-blue-500/40" />
                <p className="mt-2 text-[10px] text-muted2">Se adjuntarán automáticamente la ruta, fecha y navegador. No se adjunta el contenido de la página.</p>
              </div>

              {error && <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-500"><AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}</div>}

              <button type="submit" disabled={sending} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {sending ? "Enviando…" : "Enviar reporte al administrador"}
              </button>
            </form>
          )}

          {tab === "history" && (
            <div className="mt-6">
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 size={26} className="animate-spin text-blue-500" /></div>
              ) : error ? (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-500">{error}</div>
              ) : reports.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-soft p-10 text-center text-sm text-muted2">Aún no has enviado reportes.</div>
              ) : (
                <div className="space-y-3">
                  {reports.map(report => (
                    <article key={report.id} className="rounded-2xl border border-soft bg-app/40 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="text-sm font-semibold">{report.subject}</h2>
                          <p className="mt-1 text-[10px] text-muted2">{report.category} · prioridad {report.priority}</p>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/5 px-2 py-1 text-[10px] font-semibold text-blue-500"><Clock size={10} /> {report.status}</span>
                      </div>
                      <p className="mt-3 text-[10px] text-muted2">Enviado: {new Date(report.created_at).toLocaleString("es-CL")}</p>
                      {report.admin_reply && (
                        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500">Respuesta del administrador</p>
                          <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-sub">{report.admin_reply}</p>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <LegalFooter />
      </div>
    </main>
  )
}
