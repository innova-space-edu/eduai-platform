"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowUp,
  Check,
  Copy,
  Download,
  ExternalLink,
  Globe2,
  Loader2,
  Paperclip,
  Square,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import { getWorkMode } from "@/lib/work/config"
import type { ResearchScope, WorkCitation, WorkMode } from "@/lib/work/types"

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  provider?: string
  model?: string
  toolUsed?: string
  citations?: WorkCitation[]
  loading?: boolean
}

type WorkChatProps = {
  mode: WorkMode
  notebookId: string | null
  notebookTitle?: string
  readySourceCount: number
  onCitationsChange: (citations: WorkCitation[]) => void
  onResultCreated: (result: { id: string; title: string; type: string; href?: string }) => void
}

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content: "## Bienvenido a Open EDUAI Work\n\nPuedo investigar con fuentes, crear materiales, coordinar agentes y convertir tus ideas en acciones dentro de EDUAI. Selecciona un modo o escribe directamente qué necesitas.",
}

// Las herramientas devuelven Markdown y, para TTS, un reproductor HTML. El
// parser Markdown no interpreta HTML crudo por seguridad, por lo que lo
// transformamos a un enlace especial que se renderiza como audio real.
function normalizeToolMedia(content: string) {
  return content.replace(
    /<audio\s+controls\s+src="(data:audio\/mpeg;base64,[^"]+)"><\/audio>/g,
    "[▶ Reproducir narración]($1)",
  )
}

function isSafeWorkUrl(url: string) {
  return /^https?:\/\//i.test(url) || /^mailto:/i.test(url) || url.startsWith("/") || url.startsWith("#")
}

function downloadAsWord(content: string, title: string) {
  const safeTitle = title.replace(/[^a-z0-9áéíóúñ _-]/gi, "").trim() || "eduai-documento"
  const body = content
    .replace(/<audio[\s\S]*?<\/audio>/g, "[Audio generado en EduAI Work]")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br />")
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title><style>body{font-family:Arial,sans-serif;line-height:1.55;color:#172033;margin:48px}h1{color:#2563eb}</style></head><body><h1>${safeTitle}</h1><p>${body}</p></body></html>`
  const url = URL.createObjectURL(new Blob([html], { type: "application/msword" }))
  const link = document.createElement("a")
  link.href = url
  link.download = `${safeTitle}.doc`
  link.click()
  URL.revokeObjectURL(url)
}

function messageId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function WorkChat({
  mode,
  notebookId,
  notebookTitle,
  readySourceCount,
  onCitationsChange,
  onResultCreated,
}: WorkChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [scope, setScope] = useState<ResearchScope>("sources_web")
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [hydratedKey, setHydratedKey] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const activeMode = getWorkMode(mode)
  const storageKey = `open-eduai-work:${notebookId || "general"}`

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      const parsed = saved ? JSON.parse(saved) : null
      setMessages(Array.isArray(parsed) && parsed.length ? parsed : [WELCOME])
    } catch {
      setMessages([WELCOME])
    } finally {
      setHydratedKey(storageKey)
    }
  }, [storageKey])

  useEffect(() => {
    if (hydratedKey !== storageKey) return
    if (messages.length === 1 && messages[0].id === "welcome") return
    localStorage.setItem(storageKey, JSON.stringify(messages.filter((message) => !message.loading).slice(-60)))
  }, [hydratedKey, messages, storageKey])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => () => abortRef.current?.abort(), [])

  const copyMessage = async (message: ChatMessage) => {
    await navigator.clipboard.writeText(message.content)
    setCopiedId(message.id)
    window.setTimeout(() => setCopiedId(null), 1_500)
  }

  const sendMessage = useCallback(async (override?: string) => {
    const content = (override ?? input).trim()
    if (!content || loading) return

    const userMessage: ChatMessage = { id: messageId(), role: "user", content }
    const pendingId = messageId()
    setMessages((current) => [...current, userMessage, { id: pendingId, role: "assistant", content: "", loading: true }])
    setInput("")
    setLoading(true)
    onCitationsChange([])
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    const history = messages
      .filter((message) => !message.loading && message.id !== "welcome")
      .slice(-10)
      .map(({ role, content: messageContent }) => ({ role, content: messageContent }))

    try {
      if (mode === "research") {
        const response = await fetch("/api/work/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abortRef.current.signal,
          body: JSON.stringify({ message: content, history, notebookId, scope }),
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data?.error || "No fue posible completar la investigación")
        const citations = Array.isArray(data?.citations) ? data.citations : []
        onCitationsChange(citations)
        setMessages((current) => current.map((message) => message.id === pendingId ? {
          id: pendingId,
          role: "assistant",
          content: data.text,
          provider: data.provider,
          model: data.model,
          citations,
        } : message))
        return
      }

      const response = await fetch("/api/superagent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          messages: [...history, { role: "user", content }],
          task: "general",
          maxTokens: 3_000,
          context: {
            page: "open-eduai-work",
            pageMode: mode,
            subject: notebookTitle,
          },
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data?.success) throw new Error(data?.error || "No fue posible obtener una respuesta")

      setMessages((current) => current.map((message) => message.id === pendingId ? {
        id: pendingId,
        role: "assistant",
        content: data.text,
        provider: data.provider,
        model: data.model,
        toolUsed: data.toolUsed,
      } : message))

      if (data.toolUsed) {
        onResultCreated({
          id: `${pendingId}-${data.toolUsed}`,
          title: data.toolUsed.replace(/_/g, " "),
          type: "Acción de EDUAI",
        })
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setMessages((current) => current.filter((message) => message.id !== pendingId))
        return
      }
      const errorMessage = error instanceof Error ? error.message : "Ocurrió un error inesperado"
      setMessages((current) => current.map((message) => message.id === pendingId ? {
        id: pendingId,
        role: "assistant",
        content: `No pude completar esta acción: ${errorMessage}`,
      } : message))
    } finally {
      setLoading(false)
      textareaRef.current?.focus()
    }
  }, [input, loading, messages, mode, notebookId, notebookTitle, onCitationsChange, onResultCreated, scope])

  const stop = () => {
    abortRef.current?.abort()
    setLoading(false)
  }

  const attachSourceFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (fileInputRef.current) fileInputRef.current.value = ""
    if (!notebookId) {
      setMessages((current) => [...current, {
        id: messageId(), role: "assistant",
        content: "Primero crea o selecciona un Work para poder leer y conservar el archivo.",
      }])
      return
    }

    const extension = file.name.split(".").pop()?.toLowerCase()
    const type = extension === "pdf" ? "pdf" : extension === "docx" ? "docx" : extension === "txt" ? "txt" : null
    if (!type) {
      setMessages((current) => [...current, {
        id: messageId(), role: "assistant",
        content: "Por ahora puedes adjuntar PDF, DOCX o TXT. El archivo se agregará como fuente para leerlo y trabajar con él.",
      }])
      return
    }

    setUploadingFile(true)
    try {
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(new Error("No se pudo leer el archivo"))
        reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "")
        reader.readAsDataURL(file)
      })
      const rawText = type === "txt" ? await file.text() : undefined
      const sourceResponse = await fetch(`/api/notebooks/${notebookId}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, title: file.name, raw_text: rawText, metadata: { importedFrom: "open-eduai-work" } }),
      })
      const sourceData = await sourceResponse.json().catch(() => ({}))
      if (!sourceResponse.ok || !sourceData?.source?.id) throw new Error(sourceData?.error || "No se pudo registrar el archivo")
      const ingestResponse = await fetch(`/api/notebooks/${notebookId}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: sourceData.source.id, fileBase64: type === "txt" ? undefined : fileBase64 }),
      })
      const ingestData = await ingestResponse.json().catch(() => ({}))
      if (!ingestResponse.ok || !ingestData?.ok) throw new Error(ingestData?.error || "No se pudo extraer contenido del archivo")
      setMessages((current) => [...current, {
        id: messageId(), role: "assistant",
        content: `📎 **Archivo listo:** ${file.name}\n\nExtraje ${ingestData.chunkCount || 0} fragmentos. Ahora puedes pedirme: “resume este archivo”, “traduce el archivo”, “crea un podcast desde las fuentes” o “investiga usando solo las fuentes”.`,
        provider: "EduAI Files",
        model: "Notebook Reader",
      }])
      onResultCreated({ id: `source-${sourceData.source.id}`, title: file.name, type: "Fuente procesada" })
    } catch (error) {
      setMessages((current) => [...current, {
        id: messageId(), role: "assistant",
        content: `No pude procesar el archivo: ${error instanceof Error ? error.message : "Error inesperado"}`,
      }])
    } finally {
      setUploadingFile(false)
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-card-theme">
      <div className="flex items-center justify-between gap-3 border-b border-soft px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: activeMode.accent }} />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-main">Modo {activeMode.label}</p>
            <p className="truncate text-[10px] text-muted2">{activeMode.description}</p>
          </div>
        </div>

        {mode === "research" && (
          <label className="flex shrink-0 items-center gap-1.5 rounded-xl border border-soft bg-card-soft-theme px-2 py-1.5 text-[10px] text-sub">
            <Globe2 size={12} />
            <span className="sr-only">Alcance de investigación</span>
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value as ResearchScope)}
              className="max-w-32 bg-transparent font-semibold outline-none"
            >
              <option value="sources_web">Fuentes + web</option>
              <option value="sources" disabled={!notebookId || readySourceCount === 0}>Solo fuentes</option>
              <option value="web">Solo web</option>
            </select>
          </label>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-10">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          {messages.map((message) => (
            <article key={message.id} className={message.role === "user" ? "ml-auto max-w-[88%]" : "mr-auto w-full max-w-[95%]"}>
              {message.role === "assistant" && (
                <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted2">
                  <span className="grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 text-[11px] text-white">W</span>
                  Open EDUAI Work
                </div>
              )}
              <div className={message.role === "user"
                ? "rounded-[22px] rounded-br-md bg-blue-600 px-4 py-3 text-sm text-white shadow-sm"
                : "group rounded-[22px] border border-soft bg-card-soft-theme px-4 py-4 text-sm text-main sm:px-5"
              }>
                {message.loading ? (
                  <div className="flex items-center gap-2 text-muted2">
                    <Loader2 size={14} className="animate-spin" />
                    <span>Analizando y coordinando herramientas…</span>
                  </div>
                ) : (
                  <>
                    <div className="prose prose-sm max-w-none text-inherit prose-headings:text-inherit prose-strong:text-inherit prose-a:text-blue-500 prose-code:text-inherit">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        urlTransform={(url) => url.startsWith("data:audio/mpeg;base64,") || isSafeWorkUrl(url) ? url : ""}
                        components={{
                          a: ({ href, children }) => href?.startsWith("data:audio/mpeg;base64,") ? (
                            <span className="my-3 block rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 not-prose">
                              <span className="mb-2 block text-xs font-semibold text-blue-600">Narración generada</span>
                              <audio controls preload="metadata" src={href} className="w-full" />
                            </span>
                          ) : (
                            <a href={href} target={href?.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="inline-flex items-center gap-0.5 font-medium underline underline-offset-2">
                              {children}{href?.startsWith("http") && <ExternalLink size={10} />}
                            </a>
                          ),
                          img: ({ src, alt }) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={src} alt={alt || "Imagen generada por EduAI"} className="my-3 max-h-[520px] w-full rounded-xl border border-soft bg-white object-contain" />
                          ),
                        }}
                      >{normalizeToolMedia(message.content)}</ReactMarkdown>
                    </div>
                    {message.role === "assistant" && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-soft pt-2 text-[10px] text-muted2">
                        {message.provider && <span>{message.provider}{message.model ? ` · ${message.model}` : ""}</span>}
                        {message.toolUsed && <span className="rounded-full bg-teal-500/10 px-2 py-0.5 text-teal-600">{message.toolUsed.replace(/_/g, " ")}</span>}
                        {!!message.citations?.length && <span>{message.citations.length} fuentes</span>}
                        <button type="button" onClick={() => downloadAsWord(message.content, message.toolUsed || "resultado-eduai")} className="rounded-lg p-1 hover:bg-card-theme" title="Descargar como Word">
                          <Download size={12} />
                        </button>
                        <button type="button" onClick={() => void copyMessage(message)} className="ml-auto rounded-lg p-1 hover:bg-card-theme" title="Copiar respuesta">
                          {copiedId === message.id ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </article>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      <footer className="shrink-0 border-t border-soft bg-card-theme px-3 py-3 sm:px-6">
        <div className="mx-auto max-w-3xl">
          {messages.length <= 1 && (
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {activeMode.prompts.map((prompt) => (
                <button key={prompt} type="button" onClick={() => void sendMessage(prompt)} className="shrink-0 rounded-full border border-soft bg-card-soft-theme px-3 py-1.5 text-[10px] font-medium text-sub hover:border-blue-400/40 hover:text-blue-500">
                  {prompt}
                </button>
              ))}
            </div>
          )}
          <div className="rounded-[22px] border border-soft bg-card-soft-theme p-2 shadow-sm focus-within:border-blue-500/40">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  void sendMessage()
                }
              }}
              rows={2}
              placeholder={`¿Qué quieres ${mode === "ask" ? "preguntar" : activeMode.label.toLowerCase()}?`}
              className="max-h-40 w-full resize-none bg-transparent px-2 py-1 text-sm text-main outline-none placeholder:text-muted2"
            />
            <div className="flex items-center gap-2 px-1 pt-1">
              {notebookId ? (
                <>
                  <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={(event) => void attachSourceFile(event)} className="hidden" />
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingFile} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-muted2 hover:bg-card-theme hover:text-main disabled:opacity-50" title="Adjuntar PDF, Word o texto">
                    {uploadingFile ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />} {uploadingFile ? "Leyendo…" : `${readySourceCount} fuentes`}
                  </button>
                </>
              ) : (
                <Link href="/notebooks" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-muted2 hover:bg-card-theme hover:text-main">
                  <Paperclip size={12} /> Agregar fuentes
                </Link>
              )}
              <span className="ml-auto text-[9px] text-muted2">Enter para enviar</span>
              <button
                type="button"
                onClick={loading ? stop : () => void sendMessage()}
                disabled={!loading && !input.trim()}
                className="grid h-8 w-8 place-items-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-500 disabled:opacity-35"
                title={loading ? "Detener" : "Enviar"}
              >
                {loading ? <Square size={12} fill="currentColor" /> : <ArrowUp size={15} />}
              </button>
            </div>
          </div>
          <p className="mt-1.5 text-center text-[9px] text-muted2">Verifica información importante y revisa las fuentes antes de utilizar un resultado.</p>
        </div>
      </footer>
    </section>
  )
}
