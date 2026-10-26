"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  BookOpenText, Download, FileText, Loader2, MessageCircle,
  Save, Send, Sparkles, WandSparkles,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

type Action = "chat" | "summary" | "document"
type Message = { id: string; role: "assistant" | "user"; content: string; sources?: string[] }
type Props = { projectId: string; projectName: string; onSaved: () => void }

const SUGGESTIONS: { label: string; text: string; action: Action; icon: typeof FileText }[] = [
  { label: "Resumir proyecto", text: "Haz un resumen de lo que tenemos trabajado en este proyecto, con los avances principales.", action: "summary", icon: BookOpenText },
  { label: "Crear documento", text: "Redacta un documento organizado con los materiales de este proyecto, incluyendo introducción, desarrollo y conclusiones.", action: "document", icon: FileText },
  { label: "Próximos pasos", text: "Con base en nuestras notas, ¿cuáles son los próximos pasos y qué falta por resolver?", action: "chat", icon: WandSparkles },
]

function pdfFileName(name: string) {
  return (name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w -]+/g, "").trim().slice(0, 55) || "eduai-workspace").replace(/\s+/g, "-")
}

async function exportPdf(text: string, projectName: string) {
  const { jsPDF } = await import("jspdf")
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  doc.setProperties({ title: "EDUAI Workspace - " + projectName, author: "EDUAI" })
  const margin = 18
  const lineWidth = 174
  let y = 23
  doc.setFont("helvetica", "bold")
  doc.setFontSize(17)
  for (const line of doc.splitTextToSize(projectName, lineWidth)) {
    doc.text(line, margin, y); y += 8
  }
  doc.setDrawColor(148, 163, 184)
  doc.line(margin, y, 192, y); y += 9
  const printable = text.replace(/<[^>]*>/g, "").replace(/^#{1,6}\s*/gm, "").replace(/\*\*/g, "").replace(/\[(.+?)\]\((.+?)\)/g, "$1 ($2)")
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10.5)
  const lines = doc.splitTextToSize(printable, lineWidth)
  for (const line of lines) {
    if (y > 278) { doc.addPage(); y = 19 }
    doc.text(line, margin, y); y += 5.3
  }
  doc.save(pdfFileName(projectName) + "-workspace.pdf")
}

export default function WorkspaceAssistant({ projectId, projectName, onSaved }: Props) {
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [coverage, setCoverage] = useState<{ indexed: number; total: number; limited: boolean } | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessages([])
    setInput("")
    setCoverage(null)
    setError("")
  }, [projectId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }) }, [messages, pending])

  async function ask(message: string, action: Action = "chat") {
    const clean = message.trim()
    if (!clean || pending) return
    const prior = messages.slice(-8).map(({ role, content }) => ({ role, content }))
    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content: clean }
    setMessages((previous) => [...previous, userMessage])
    setInput("")
    setError("")
    setPending(true)
    try {
      const res = await fetch("/api/workspace/" + encodeURIComponent(projectId) + "/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: clean, action, history: prior }),
      })
      const data = await res.json()
      if (!res.ok || !data.text) throw new Error(data.error || "No se recibió una respuesta")
      setMessages((previous) => [...previous, {
        id: crypto.randomUUID(), role: "assistant", content: data.text, sources: data.sourceTitles || [],
      }])
      setCoverage({ indexed: data.indexedCount || 0, total: data.totalCount || 0, limited: !!data.limited })
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "No fue posible obtener una respuesta")
    } finally {
      setPending(false)
    }
  }

  async function saveAsNote(message: Message) {
    if (savingId) return
    setSavingId(message.id)
    setError("")
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Inicia sesión nuevamente")
      const title = message.content.split("\n").find((line) => line.trim())?.replace(/^#+\s*/, "").slice(0, 90) || "Resultado del asistente"
      const { error: insertError } = await supabase.from("workspace_items").insert({
        project_id: projectId,
        user_id: user.id,
        item_type: "document",
        title,
        content_text: message.content,
        content_url: "",
        metadata: { originalType: "assistant-result", source: "workspace-assistant" },
      })
      if (insertError) throw insertError
      onSaved()
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el resultado")
    } finally {
      setSavingId(null)
    }
  }

  return (
    <section aria-label="Asistente del proyecto" className="flex flex-col h-[min(78vh,760px)] min-h-[440px] rounded-[26px] overflow-hidden border border-emerald-900/10 dark:border-emerald-200/10 bg-white/85 dark:bg-slate-900/75 shadow-sm backdrop-blur-md">
      <div className="px-5 py-4 border-b border-emerald-900/10 dark:border-white/10 bg-gradient-to-r from-teal-50/90 via-sky-50/60 to-violet-50/80 dark:from-teal-900/20 dark:via-slate-900 dark:to-indigo-900/20">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center h-9 w-9 rounded-2xl bg-teal-600/10 text-teal-700 dark:text-teal-300"><MessageCircle size={18} /></span>
          <div className="min-w-0">
            <h2 className="font-semibold text-sm text-slate-800 dark:text-slate-100">Asistente del proyecto</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Conversación contextual · EDUAI</p>
          </div>
          <Sparkles size={15} className="ml-auto text-teal-600/70 dark:text-teal-300/70" />
        </div>
      </div>

      <div aria-live="polite" className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
        {messages.length === 0 && (
          <div className="space-y-5">
            <div className="rounded-2xl bg-teal-50/80 dark:bg-teal-900/15 p-4 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
              <p className="font-semibold mb-1">Tu trabajo, en conversación.</p>
              <p className="text-xs text-slate-600 dark:text-slate-300">Puedo ayudarte a comprender tus notas, relacionar materiales y crear textos para guardar o exportar.</p>
            </div>
            <div className="space-y-2">
              {SUGGESTIONS.map((suggestion) => {
                const Icon = suggestion.icon
                return (
                  <button key={suggestion.label} type="button" disabled={pending} onClick={() => ask(suggestion.text, suggestion.action)}
                    className="w-full flex items-center gap-2.5 rounded-xl px-3 py-3 text-left border border-slate-200/70 dark:border-white/10 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors text-xs font-medium text-slate-700 dark:text-slate-200">
                    <Icon size={15} className="text-teal-600 dark:text-teal-300 shrink-0" /> {suggestion.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        {messages.map((message) => (
          <article key={message.id} className={message.role === "user" ? "ml-7" : "mr-2"}>
            <div className={message.role === "user"
              ? "rounded-2xl rounded-tr-sm bg-teal-700 px-4 py-3 text-sm leading-relaxed text-white whitespace-pre-wrap"
              : "rounded-2xl rounded-tl-sm bg-slate-50 dark:bg-slate-800/80 px-4 py-3 text-sm leading-relaxed text-slate-800 dark:text-slate-100"}>
              {message.role === "user" ? message.content : (
                <div className="prose prose-sm dark:prose-invert max-w-none break-words prose-p:my-2 prose-li:my-1">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                </div>
              )}
            </div>
            {message.role === "assistant" && (
              <div className="mt-1.5 flex items-center flex-wrap gap-2">
                <button type="button" onClick={() => exportPdf(message.content, projectName)} className="flex items-center gap-1 text-[11px] text-teal-700 dark:text-teal-300 hover:underline"><Download size={12} /> PDF</button>
                <button type="button" disabled={savingId !== null} onClick={() => saveAsNote(message)} className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300 hover:underline"><Save size={12} /> {savingId === message.id ? "Guardando..." : "Guardar como nota"}</button>
                {message.sources && message.sources.length > 0 && (
                  <span className="text-[10px] text-slate-400" title={message.sources.join(" · ")}>Basado en {message.sources.length} fuente(s)</span>
                )}
              </div>
            )}
          </article>
        ))}
        {pending && <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-300"><Loader2 size={13} className="animate-spin" /> Revisando los materiales del proyecto…</p>}
        {error && <p role="alert" className="rounded-xl bg-rose-50 dark:bg-rose-900/20 p-3 text-xs text-rose-700 dark:text-rose-300">{error}</p>}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-slate-200/70 dark:border-white/10 px-4 py-3">
        {coverage && <p className="mb-2 text-[10px] text-slate-500 dark:text-slate-400">{coverage.indexed} de {coverage.total} materiales con texto disponible{coverage.limited ? " · consulta parcial" : ""}. Los otros se identifican solo por su título.</p>}
        <form onSubmit={(event) => { event.preventDefault(); ask(input) }} className="flex items-end gap-2">
          <label className="sr-only" htmlFor="workspace-chat-message">Mensaje al asistente</label>
          <textarea id="workspace-chat-message" value={input} onChange={(event) => setInput(event.target.value)} rows={2} maxLength={4000}
            onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); ask(input) } }}
            placeholder="Pregunta sobre tus notas o pide un documento…"
            className="min-w-0 flex-1 resize-none rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/25"
          />
          <button type="submit" disabled={!input.trim() || pending} aria-label="Enviar mensaje" className="shrink-0 flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-50"><Send size={16} /></button>
        </form>
        <p className="mt-2 text-[10px] text-slate-400">El asistente solo consulta este proyecto; no modifica notas sin tu acción.</p>
      </div>
    </section>
  )
}
