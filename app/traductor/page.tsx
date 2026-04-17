"use client"
import { useState, useRef, useEffect, useCallback } from "react"
import Link from "next/link"
import { ArrowLeft, Send, Upload, FileText, X, Loader2, Globe, ChevronDown, Languages } from "lucide-react"

// ─── Languages ────────────────────────────────────────────────────────────────
const IDIOMAS = [
  { name: "Inglés",      code: "en", flag: "🇬🇧" },
  { name: "Francés",     code: "fr", flag: "🇫🇷" },
  { name: "Alemán",      code: "de", flag: "🇩🇪" },
  { name: "Portugués",   code: "pt", flag: "🇧🇷" },
  { name: "Italiano",    code: "it", flag: "🇮🇹" },
  { name: "Chino",       code: "zh", flag: "🇨🇳" },
  { name: "Japonés",     code: "ja", flag: "🇯🇵" },
  { name: "Coreano",     code: "ko", flag: "🇰🇷" },
  { name: "Árabe",       code: "ar", flag: "🇸🇦" },
  { name: "Ruso",        code: "ru", flag: "🇷🇺" },
  { name: "Hindi",       code: "hi", flag: "🇮🇳" },
  { name: "Turco",       code: "tr", flag: "🇹🇷" },
  { name: "Polaco",      code: "pl", flag: "🇵🇱" },
  { name: "Holandés",    code: "nl", flag: "🇳🇱" },
  { name: "Sueco",       code: "sv", flag: "🇸🇪" },
  { name: "Noruego",     code: "no", flag: "🇳🇴" },
  { name: "Griego",      code: "el", flag: "🇬🇷" },
  { name: "Vietnamita",  code: "vi", flag: "🇻🇳" },
  { name: "Tailandés",   code: "th", flag: "🇹🇭" },
  { name: "Hebreo",      code: "he", flag: "🇮🇱" },
  { name: "Indonesio",   code: "id", flag: "🇮🇩" },
  { name: "Ucraniano",   code: "uk", flag: "🇺🇦" },
  { name: "Rumano",      code: "ro", flag: "🇷🇴" },
  { name: "Catalán",     code: "ca", flag: "🏳️" },
  { name: "Quechua",     code: "qu", flag: "🌿" },
]

// ─── Quick Actions ────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { icon: "🗣️",  label: "Traducir",        hint: "Traducción natural y fluida" },
  { icon: "🎓",  label: "Texto formal",    hint: "Registro académico o profesional" },
  { icon: "💬",  label: "Coloquial",       hint: "Como habla la gente en la calle" },
  { icon: "📝",  label: "Explicar",        hint: "Gramática, matices y uso" },
  { icon: "🌍",  label: "Cultura",         hint: "Contexto cultural de la frase" },
  { icon: "⚡",  label: "Modismos",        hint: "Expresiones idiomáticas" },
  { icon: "🔤",  label: "Pronunciación",   hint: "Cómo suena y cómo se lee" },
  { icon: "↔️",  label: "Bilingüe",        hint: "Original y traducción juntos" },
]

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  role: "user" | "assistant"
  content: string
  isFile?: boolean
  fileName?: string
}

// ─── Markdown renderer (lightweight) ─────────────────────────────────────────
function renderMd(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code class='px-1 rounded bg-cyan-500/10 text-cyan-300 text-xs font-mono'>$1</code>")
    .replace(/^### (.+)$/gm, "<h4 class='font-semibold text-main text-sm mt-3 mb-1'>$1</h4>")
    .replace(/^## (.+)$/gm,  "<h3 class='font-bold text-main mt-3 mb-1.5'>$1</h3>")
    .replace(/^[-•] (.+)$/gm,"<li class='flex gap-2 items-start ml-1'><span class='mt-1.5 w-1.5 h-1.5 rounded-full bg-cyan-400/70 flex-shrink-0 inline-block'></span><span>$1</span></li>")
    .replace(/(<li.*<\/li>(\n|$))+/g, (m) => `<ul class='space-y-1.5 my-2'>${m}</ul>`)
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/\n/g, "<br/>")
}

// ─── Language Selector ────────────────────────────────────────────────────────
function LangSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = IDIOMAS.find(l => l.name === value) || IDIOMAS[0]

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 rounded-xl border border-soft bg-card-soft-theme px-3 py-1.5 text-sm text-main hover:border-cyan-500/40 transition"
      >
        <span>{selected.flag}</span>
        <span className="hidden sm:block">{selected.name}</span>
        <ChevronDown size={12} className="text-muted2" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-52 rounded-2xl border border-soft bg-card-soft-theme shadow-xl shadow-black/20 overflow-hidden">
          <div className="max-h-72 overflow-y-auto p-1">
            {IDIOMAS.map(lang => (
              <button
                key={lang.code}
                onClick={() => { onChange(lang.name); setOpen(false) }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-left transition
                  ${value === lang.name ? "bg-cyan-500/15 text-cyan-400" : "text-sub hover:bg-card-soft-theme hover:text-main"}`}
              >
                <span className="text-base">{lang.flag}</span>
                <span>{lang.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── File Upload Drop Area ────────────────────────────────────────────────────
function FileUploadArea({
  onFile,
  loading,
}: {
  onFile: (text: string, fileName: string) => void
  loading: boolean
}) {
  const [drag, setDrag] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [err, setErr] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  async function processFile(file: File) {
    setErr("")
    setProcessing(true)
    try {
      const ext = file.name.split(".").pop()?.toLowerCase()

      if (ext === "txt" || ext === "md") {
        const text = await file.text()
        if (!text.trim()) throw new Error("El archivo está vacío.")
        onFile(text.slice(0, 12000), file.name)
        return
      }

      if (ext === "pdf") {
        // Send PDF as base64 to the translation API, which uses Gemini to extract + translate
        const reader = new FileReader()
        const base64 = await new Promise<string>((res, rej) => {
          reader.onload  = () => res((reader.result as string).split(",")[1])
          reader.onerror = () => rej(new Error("Error leyendo PDF"))
          reader.readAsDataURL(file)
        })
        const estimatedMB = (base64.length * 0.75) / (1024 * 1024)
        if (estimatedMB > 18) throw new Error(`PDF demasiado grande (~${estimatedMB.toFixed(0)} MB). Máximo ~18 MB.`)

        // Extract text via Gemini
        const res = await fetch("/api/agents/traductor/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pdfBase64: base64, fileName: file.name }),
        })
        if (!res.ok) throw new Error("No se pudo extraer el texto del PDF.")
        const data = await res.json()
        if (!data.text?.trim()) throw new Error("No se encontró texto en el PDF.")
        onFile(data.text.slice(0, 12000), file.name)
        return
      }

      throw new Error(`Formato no soportado: .${ext}. Usa TXT, MD o PDF.`)
    } catch (e: any) {
      setErr(e?.message || "Error procesando el archivo.")
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="space-y-2">
      <div
        onDragEnter={e => { e.preventDefault(); setDrag(true) }}
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) processFile(f) }}
        onClick={() => inputRef.current?.click()}
        className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition
          ${drag ? "border-cyan-400 bg-cyan-500/10" : "border-soft hover:border-cyan-500/40 hover:bg-cyan-500/5"}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".txt,.md,.pdf"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = "" }}
        />
        {processing ? (
          <div className="flex items-center justify-center gap-2 text-cyan-400 text-sm">
            <Loader2 size={16} className="animate-spin" />
            Leyendo archivo...
          </div>
        ) : (
          <>
            <Upload size={20} className="mx-auto mb-2 text-muted2" />
            <p className="text-sm text-sub">Arrastra un archivo o <span className="text-cyan-400">haz clic aquí</span></p>
            <p className="text-xs text-muted2 mt-1">TXT · MD · PDF · máx. 18 MB</p>
          </>
        )}
      </div>
      {err && <p className="text-xs text-red-400 px-1">{err}</p>}
    </div>
  )
}

// ─── Poly Avatar ──────────────────────────────────────────────────────────────
function PolyAvatar({ size = 30 }: { size?: number }) {
  return (
    <div
      className="flex-shrink-0 rounded-xl flex items-center justify-center text-white font-bold"
      style={{
        width: size, height: size,
        background: "linear-gradient(135deg, #06b6d4 0%, #0ea5e9 100%)",
        boxShadow: "0 0 10px rgba(6,182,212,0.3)",
        fontSize: size * 0.5,
      }}
    >
      🌐
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TraductorPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState("")
  const [loading, setLoading]   = useState(false)
  const [idiomaTarget, setIdiomaTarget] = useState("Inglés")
  const [showFilePanel, setShowFilePanel] = useState(false)
  const [pendingFile, setPendingFile]     = useState<{ text: string; name: string } | null>(null)

  const bottomRef  = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const selectedLang = IDIOMAS.find(l => l.name === idiomaTarget) || IDIOMAS[0]

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  async function send(text: string, isFile = false, fileName?: string) {
    if (!text.trim() || loading) return
    setInput("")
    setShowFilePanel(false)
    setPendingFile(null)

    const userMsg: Message = {
      role: "user",
      content: text,
      isFile,
      fileName,
    }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setLoading(true)

    try {
      const res = await fetch("/api/agents/traductor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: nextMessages.slice(-10).map(m => ({ role: m.role, content: m.content })),
          idiomaTarget,
          isFile,
          fileName,
        }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: "assistant", content: data.text || "Error." }])
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Ups, algo salió mal. Intenta de nuevo." }])
    } finally {
      setLoading(false)
    }
  }

  function handleQuickAction(action: typeof QUICK_ACTIONS[0]) {
    const prompts: Record<string, string> = {
      "Traducir":       `Traduce esto al ${idiomaTarget}: `,
      "Texto formal":   `Traduce al ${idiomaTarget} en registro formal y académico: `,
      "Coloquial":      `¿Cómo diría un hablante nativo en ${idiomaTarget} de forma casual: `,
      "Explicar":       `Explícame la gramática y el uso de esta frase en ${idiomaTarget}: `,
      "Cultura":        `Explícame el contexto cultural de esta expresión en ${idiomaTarget}: `,
      "Modismos":       `¿Qué modismos o expresiones idiomáticas en ${idiomaTarget} corresponden a: `,
      "Pronunciación":  `¿Cómo se pronuncia esto en ${idiomaTarget}? Dame la fonética: `,
      "Bilingüe":       `Muéstrame el texto original y su traducción al ${idiomaTarget} línea a línea: `,
    }
    setInput(prompts[action.label] || "")
    textareaRef.current?.focus()
  }

  function handleFileReady(text: string, name: string) {
    setPendingFile({ text, name })
    setShowFilePanel(false)
  }

  function submitFile() {
    if (!pendingFile) return
    const msg = `Traduce el siguiente documento al ${idiomaTarget}:\n\n${pendingFile.text}`
    send(msg, true, pendingFile.name)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  const hasMessages = messages.length > 0

  return (
    <div className="min-h-screen bg-app text-main flex flex-col">

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b border-soft bg-app/90 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard"
            className="w-8 h-8 rounded-xl flex items-center justify-center border border-soft bg-card-soft-theme text-sub hover:text-main transition">
            <ArrowLeft size={15} />
          </Link>

          <PolyAvatar size={36} />

          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-sm">Poly · Traductor</h1>
            <p className="text-xs text-muted2">
              {selectedLang.flag} {idiomaTarget} · {IDIOMAS.length} idiomas disponibles
            </p>
          </div>

          {/* File upload toggle */}
          <button
            onClick={() => setShowFilePanel(v => !v)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition
              ${showFilePanel
                ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-400"
                : "border-soft bg-card-soft-theme text-sub hover:text-main"}`}
          >
            <FileText size={12} />
            <span className="hidden sm:block">Archivo</span>
          </button>

          <LangSelector value={idiomaTarget} onChange={setIdiomaTarget} />
        </div>

        {/* File upload panel */}
        {showFilePanel && (
          <div className="border-t border-soft bg-app/95">
            <div className="max-w-3xl mx-auto px-4 py-3 space-y-2">
              <FileUploadArea onFile={handleFileReady} loading={loading} />
              {pendingFile && (
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/8 px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={14} className="text-cyan-400 flex-shrink-0" />
                    <span className="text-sm text-main truncate">{pendingFile.name}</span>
                    <span className="text-xs text-muted2 flex-shrink-0">
                      {(pendingFile.text.length / 1000).toFixed(1)}k chars
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={submitFile}
                      disabled={loading}
                      className="rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 text-white px-4 py-1.5 text-xs font-semibold disabled:opacity-50"
                    >
                      Traducir →
                    </button>
                    <button onClick={() => setPendingFile(null)} className="text-muted2 hover:text-main">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ── Quick actions chips (only when no messages) ── */}
      {!hasMessages && (
        <div className="border-b border-soft bg-app/80 backdrop-blur">
          <div className="max-w-3xl mx-auto px-4 py-2 overflow-x-auto flex gap-2 no-scrollbar">
            {QUICK_ACTIONS.map(a => (
              <button
                key={a.label}
                onClick={() => handleQuickAction(a)}
                title={a.hint}
                className="flex-shrink-0 flex items-center gap-1.5 rounded-full border border-soft bg-card-soft-theme hover:border-cyan-500/40 hover:bg-cyan-500/5 px-3 py-1.5 text-xs text-sub hover:text-main transition"
              >
                <span>{a.icon}</span>
                <span>{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

          {/* Empty state */}
          {!hasMessages && (
            <div className="flex flex-col items-center py-16 text-center">
              <div
                className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mb-5"
                style={{ background: "linear-gradient(135deg,rgba(6,182,212,0.15) 0%,rgba(14,165,233,0.15) 100%)", border: "1px solid rgba(6,182,212,0.2)" }}
              >
                🌐
              </div>
              <h2 className="font-bold text-main text-lg mb-2">Hola, soy Poly</h2>
              <p className="text-sub text-sm max-w-sm leading-relaxed mb-2">
                Soy tu compañero de idiomas. Puedo traducir, explicar gramática, hablar de cultura y
                conversar sobre la vida en cualquiera de los <strong className="text-main">{IDIOMAS.length} idiomas</strong> que conozco.
              </p>
              <p className="text-muted2 text-xs max-w-xs">
                Escribe algo para traducir, sube un archivo PDF o TXT, o simplemente pregúntame algo sobre {idiomaTarget}.
              </p>

              {/* Quick action grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-8 w-full max-w-lg">
                {QUICK_ACTIONS.map(a => (
                  <button
                    key={a.label}
                    onClick={() => handleQuickAction(a)}
                    className="rounded-2xl border border-soft bg-card-soft-theme hover:border-cyan-500/30 hover:bg-cyan-500/5 px-3 py-3 text-left transition"
                  >
                    <div className="text-xl mb-1">{a.icon}</div>
                    <div className="text-xs font-medium text-main">{a.label}</div>
                    <div className="text-[10px] text-muted2 mt-0.5 leading-tight">{a.hint}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "gap-3 items-start"}`}>
              {msg.role === "assistant" && <PolyAvatar size={30} />}

              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "rounded-tr-sm bg-gradient-to-r from-cyan-600 to-sky-600 text-white"
                  : "rounded-tl-sm bg-card-soft-theme border border-soft text-main"
              }`}>
                {msg.role === "user" ? (
                  <div>
                    {msg.isFile && msg.fileName && (
                      <div className="flex items-center gap-1.5 mb-2 opacity-75 text-xs">
                        <FileText size={11} /> {msg.fileName}
                      </div>
                    )}
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {msg.isFile
                        ? msg.content.replace(/^Traduce el siguiente documento al .+?:\n\n/, "").slice(0, 120) + "…"
                        : msg.content}
                    </p>
                  </div>
                ) : (
                  <div
                    className="text-sm leading-relaxed prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: renderMd(msg.content) }}
                  />
                )}
              </div>
            </div>
          ))}

          {/* Typing dots */}
          {loading && (
            <div className="flex gap-3 items-start">
              <PolyAvatar size={30} />
              <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-card-soft-theme border border-soft">
                <div className="flex gap-1.5 items-center py-0.5">
                  {[0,150,300].map(d => (
                    <div key={d} className="w-2 h-2 bg-cyan-400/60 rounded-full animate-bounce"
                      style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Input ── */}
      <div className="sticky bottom-0 z-10 border-t border-soft bg-app/90 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 py-3">

          {/* Quick chips in chat mode */}
          {hasMessages && (
            <div className="overflow-x-auto flex gap-2 mb-2 no-scrollbar">
              {QUICK_ACTIONS.slice(0, 6).map(a => (
                <button
                  key={a.label}
                  onClick={() => handleQuickAction(a)}
                  disabled={loading}
                  className="flex-shrink-0 flex items-center gap-1 rounded-full border border-soft bg-card-soft-theme hover:border-cyan-500/40 hover:bg-cyan-500/5 px-2.5 py-1 text-[11px] text-sub hover:text-main transition disabled:opacity-40"
                >
                  {a.icon} {a.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={e => {
                const el = e.currentTarget
                el.style.height = "auto"
                el.style.height = Math.min(el.scrollHeight, 140) + "px"
              }}
              placeholder={`Escribe algo para traducir al ${idiomaTarget}… o hazme cualquier pregunta`}
              disabled={loading}
              rows={1}
              style={{ minHeight: 44, maxHeight: 140, resize: "none" }}
              className="flex-1 rounded-2xl bg-card-soft-theme border border-soft px-4 py-3 text-sm text-main placeholder:text-muted2 focus:outline-none focus:border-cyan-500/50 disabled:opacity-40 leading-normal"
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || loading}
              className="h-11 w-11 rounded-2xl bg-gradient-to-r from-cyan-600 to-sky-600 text-white flex items-center justify-center disabled:opacity-40 transition flex-shrink-0"
            >
              <Send size={15} />
            </button>
          </div>
          <p className="text-center text-[10px] text-muted2 mt-1.5">
            Enter para enviar · Shift+Enter para nueva línea · Arrastra un PDF o TXT al área de archivo
          </p>
        </div>
      </div>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}
