"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { createClient as createSupabaseClient } from "@/lib/supabase/client"
import MathRenderer from "@/components/ui/MathRenderer"
import Link from "next/link"
import { ArrowLeft, Loader2, X } from "lucide-react"

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface Message {
  role: "user" | "assistant"
  content: string
  provider?: string
}

// ── Constantes IDÉNTICAS al original ─────────────────────────────────────────
const QUICK_QUESTIONS = [
  "¿Cuál es la hipótesis principal de este paper?",
  "¿Qué metodología utilizan los autores?",
  "¿Cuáles son los resultados más importantes?",
  "¿Cuáles son las limitaciones del estudio?",
  "¿Cómo se compara con la literatura existente?",
  "¿Qué conclusiones extraen los autores?",
  "Resume el abstract en términos simples",
  "¿Qué preguntas quedan abiertas para futuras investigaciones?",
]

const STORAGE_BUCKET                   = "papers"
const MAX_PDF_SIZE_MB                  = 50
const MAX_PDF_SIZE_BYTES               = MAX_PDF_SIZE_MB * 1024 * 1024
const RESUMABLE_UPLOAD_THRESHOLD_BYTES = 6 * 1024 * 1024

// ── Helpers IDÉNTICOS al original ─────────────────────────────────────────────
async function safeJson(res: Response) {
  try { return await res.json() } catch { return null }
}

function sanitizeFilename(name: string) {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
  return cleaned || "documento.pdf"
}

function getProjectRefFromSupabaseUrl(url: string) {
  const parsed = new URL(url)
  return parsed.hostname.split(".")[0]
}

function getResumableEndpoint() {
  const projectRef = getProjectRefFromSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL!)
  return `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`
}

// ═════════════════════════════════════════════════════════════════════════════
export default function PaperPage() {
  const [messages,      setMessages]      = useState<Message[]>([])
  const [input,         setInput]         = useState("")
  const [loading,       setLoading]       = useState(false)
  const [paperTitle,    setPaperTitle]    = useState("")
  const [uploading,     setUploading]     = useState(false)
  const [paperLoaded,   setPaperLoaded]   = useState(false)
  const [dragOver,      setDragOver]      = useState(false)
  const [uploadMessage, setUploadMessage] = useState("")
  const [uploadError,   setUploadError]   = useState("")
  const [storagePath,   setStoragePath]   = useState("")

  const fileRef   = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const router    = useRouter()
  const supabase  = useMemo(() => createSupabaseClient(), [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  // ── Toda la lógica IDÉNTICA al original ──────────────────────────────────
  const resetPaperState = useCallback(() => {
    setPaperLoaded(false); setPaperTitle(""); setMessages([])
    setInput(""); setUploadMessage(""); setUploadError(""); setStoragePath("")
    if (fileRef.current) fileRef.current.value = ""
  }, [])

  const uploadWithStandard = useCallback(async (file: File, uniquePath: string) => {
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(uniquePath, file, {
      cacheControl: "3600", upsert: false, contentType: "application/pdf",
    })
    if (error) throw new Error(error.message || "No se pudo subir el archivo a Storage.")
  }, [supabase])

  const uploadWithResumable = useCallback(async (file: File, uniquePath: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error("No se pudo obtener la sesión para la subida reanudable.")
    const tus = await import("tus-js-client")
    await new Promise<void>((resolve, reject) => {
      const upload = new tus.Upload(file, {
        endpoint: getResumableEndpoint(),
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: { authorization: `Bearer ${session.access_token}` },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        chunkSize: 6 * 1024 * 1024,
        metadata: { bucketName: STORAGE_BUCKET, objectName: uniquePath, contentType: "application/pdf", cacheControl: "3600" },
        onError(error) { reject(error) },
        onProgress(bytesUploaded, bytesTotal) {
          const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2)
          setUploadMessage(`Subiendo PDF a Supabase Storage... ${percentage}%`)
        },
        onSuccess() { resolve() },
      })
      upload.findPreviousUploads().then(previousUploads => {
        if (previousUploads.length > 0) upload.resumeFromPreviousUpload(previousUploads[0])
        upload.start()
      }).catch(reject)
    })
  }, [supabase])

  const processPDF = useCallback(async (file: File) => {
    const isPdf = file?.type === "application/pdf" || file?.name?.toLowerCase().endsWith(".pdf")
    if (!file || !isPdf) { alert("Solo se aceptan archivos PDF"); return }
    if (file.size > MAX_PDF_SIZE_BYTES) {
      const sizeMb = (file.size / 1024 / 1024).toFixed(2)
      const message = `El PDF pesa ${sizeMb} MB.\n\nEl límite actual configurado es ${MAX_PDF_SIZE_MB} MB.`
      setUploadError(message); alert(message); return
    }
    setUploading(true); setUploadError(""); setUploadMessage("Validando sesión y preparando subida...")
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) throw new Error("Debes iniciar sesión para subir y analizar PDFs.")
      const safeName   = sanitizeFilename(file.name)
      const uniquePath = `${user.id}/${Date.now()}-${crypto.randomUUID()}-${safeName}`
      if (file.size >= RESUMABLE_UPLOAD_THRESHOLD_BYTES) {
        setUploadMessage("Subiendo PDF con modo reanudable...")
        await uploadWithResumable(file, uniquePath)
      } else {
        setUploadMessage("Subiendo PDF a Supabase Storage...")
        await uploadWithStandard(file, uniquePath)
      }
      setStoragePath(uniquePath)
      setUploadMessage("PDF subido. Extrayendo texto desde Storage...")
      const res  = await fetch("/api/agents/paper/extract", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket: STORAGE_BUCKET, filePath: uniquePath, filename: file.name }),
      })
      const data = await safeJson(res)
      console.log("Extraction result:", {
        title: data?.title, pageCount: data?.pageCount,
        extractionMethod: data?.extractionMethod, hasText: !!data?.text, textLength: data?.text?.length,
      })
      if (!res.ok) throw new Error(data?.error || "Error al extraer el texto del PDF almacenado en Supabase.")
      const detectedTitle = data?.title || file.name.replace(/\.pdf$/i, "")
      const summary = data?.summary?.trim() || "No se pudo generar un resumen inicial automáticamente."
      setPaperTitle(detectedTitle)
      setPaperLoaded(true)
      setMessages([{
        role: "assistant",
        content:
          `📄 **Paper cargado: "${detectedTitle}"**\n\n` +
          `**Resumen rápido:**\n${summary}\n\n` +
          `---\n¿Qué quieres saber sobre este paper? Puedo explicar la metodología, los resultados, las conclusiones, o debatir sus argumentos.`,
      }])
      setUploadMessage("PDF procesado correctamente.")
      if (fileRef.current) fileRef.current.value = ""
    } catch (error: any) {
      const message = error?.message || "Error al procesar el PDF. Intenta de nuevo."
      setUploadError(message); alert(message)
    } finally { setUploading(false) }
  }, [supabase, uploadWithStandard, uploadWithResumable])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files?.[0]; if (file) processPDF(file)
  }, [processPDF])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (file) processPDF(file)
  }, [processPDF])

  async function send(text: string) {
    const cleanText = text.trim()
    if (!cleanText || loading || !paperLoaded) return
    setInput("")
    setMessages(prev => [...prev, { role: "user", content: cleanText }])
    setLoading(true)
    try {
      const res  = await fetch("/api/agents/paper", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: cleanText, history: messages.slice(-10), paperTitle, storagePath, storageBucket: STORAGE_BUCKET }),
      })
      const data = await safeJson(res)
      if (!res.ok) throw new Error(data?.error || "Error al analizar el paper.")
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data?.text || "No se recibió una respuesta válida.",
        provider: data?.provider,
      }])
    } catch (error: any) {
      setMessages(prev => [...prev, { role: "assistant", content: error?.message || "Error al conectar." }])
    } finally { setLoading(false) }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — misma estructura, design system v2
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-white/[0.06] bg-gray-950/90 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/dashboard"
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.06] text-gray-400 hover:text-white hover:bg-white/[0.07] transition-all flex-shrink-0"
            >
              <ArrowLeft size={15} />
            </Link>

            <div
              className="w-9 h-9 rounded-2xl flex items-center justify-center text-lg flex-shrink-0 shadow-md"
              style={{ background: "linear-gradient(135deg, #4338ca, #6366f1)", boxShadow: "0 4px 12px rgba(99,102,241,0.3)" }}
            >
              📄
            </div>

            <div className="min-w-0">
              <h1 className="text-white font-bold text-sm">Chat con tu Paper</h1>
              <p className="text-gray-500 text-xs truncate">
                {paperLoaded ? `📎 ${paperTitle}` : "Sube un PDF para comenzar"}
              </p>
            </div>
          </div>

          {paperLoaded && (
            <button
              onClick={resetPaperState}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-white/[0.08] hover:bg-white/[0.04] px-3 py-1.5 rounded-xl transition-all flex-shrink-0"
            >
              <X size={12} /> Cambiar paper
            </button>
          )}
        </div>
      </header>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto w-full flex-1 px-4 py-6 flex flex-col gap-4">

        {/* Drop zone */}
        {!paperLoaded && !uploading && (
          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all"
            style={{
              background:  dragOver ? "rgba(99,102,241,0.06)" : "rgba(255,255,255,0.02)",
              borderColor: dragOver ? "rgba(99,102,241,0.50)" : "rgba(255,255,255,0.10)",
            }}
          >
            <div className="text-5xl mb-4">📄</div>
            <h2 className="text-white font-semibold text-lg mb-2">Sube tu paper o documento</h2>
            <p className="text-gray-500 text-sm mb-2">Arrastra un PDF aquí o haz click para seleccionar</p>
            <p className="text-gray-600 text-xs mb-1">Límite configurado actual: {MAX_PDF_SIZE_MB} MB</p>
            <p className="text-gray-700 text-[11px] mb-5">Desde 6 MB se usa subida reanudable automáticamente</p>

            <div className="flex flex-wrap justify-center gap-2">
              {["Papers científicos", "Tesis", "Informes", "Artículos", "Libros"].map(t => (
                <span key={t} className="text-xs px-3 py-1 rounded-full"
                      style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "#a5b4fc" }}>
                  {t}
                </span>
              ))}
            </div>

            {uploadError && (
              <div className="mt-5 max-w-xl mx-auto rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-left">
                <p className="text-red-300 text-sm font-medium">No se pudo cargar el PDF</p>
                <p className="text-red-200/80 text-xs mt-1 whitespace-pre-line">{uploadError}</p>
              </div>
            )}

            <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleFileChange} />
          </div>
        )}

        {/* Uploading */}
        {uploading && (
          <div className="rounded-2xl p-8 text-center border"
               style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.07)" }}>
            <Loader2 size={32} className="mx-auto mb-4 animate-spin" style={{ color: "#6366f1" }} />
            <p className="text-white font-medium">Procesando PDF...</p>
            <p className="text-gray-500 text-sm mt-1">{uploadMessage || "Subiendo archivo y extrayendo texto"}</p>
          </div>
        )}

        {/* Quick questions */}
        {paperLoaded && messages.length <= 1 && (
          <div>
            <p className="text-gray-600 text-xs mb-2">Preguntas sugeridas:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {QUICK_QUESTIONS.map(q => (
                <button key={q} onClick={() => send(q)}
                  className="text-left px-4 py-2.5 rounded-xl border text-gray-400 text-xs transition-all"
                  style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.07)" }}
                  onMouseEnter={e => {
                    ;(e.currentTarget as HTMLElement).style.background   = "rgba(99,102,241,0.08)"
                    ;(e.currentTarget as HTMLElement).style.borderColor  = "rgba(99,102,241,0.25)"
                    ;(e.currentTarget as HTMLElement).style.color        = "#e2e8f0"
                  }}
                  onMouseLeave={e => {
                    ;(e.currentTarget as HTMLElement).style.background   = "rgba(255,255,255,0.02)"
                    ;(e.currentTarget as HTMLElement).style.borderColor  = "rgba(255,255,255,0.07)"
                    ;(e.currentTarget as HTMLElement).style.color        = "#9ca3af"
                  }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mensajes */}
        <div className="flex flex-col gap-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm mr-2 mt-1 flex-shrink-0"
                     style={{ background: "linear-gradient(135deg, #4338ca, #6366f1)" }}>
                  📄
                </div>
              )}
              <div
                className="max-w-[88%] rounded-2xl px-4 py-3"
                style={msg.role === "user"
                  ? { background: "#4338ca" }
                  : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }
                }
              >
                {msg.role === "assistant" ? (
                  <>
                    <MathRenderer content={msg.content} />
                    {msg.provider && (
                      <p className="text-gray-600 text-xs mt-2 pt-2 border-t border-white/[0.06]">
                        via {msg.provider}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm whitespace-pre-wrap text-white">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {/* Loading dots */}
          {loading && (
            <div className="flex gap-3 items-center">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
                   style={{ background: "linear-gradient(135deg, #4338ca, #6366f1)" }}>
                📄
              </div>
              <div className="rounded-2xl px-4 py-3 flex items-center gap-2"
                   style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex gap-1">
                  {[0, 150, 300].map(delay => (
                    <div key={delay} className="w-1.5 h-1.5 rounded-full animate-bounce"
                         style={{ background: "#6366f1", animationDelay: `${delay}ms` }} />
                  ))}
                </div>
                <span className="text-gray-500 text-xs">Analizando paper...</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Input sticky ────────────────────────────────────────────────────── */}
      {paperLoaded && (
        <div className="sticky bottom-0 border-t border-white/[0.06] bg-gray-950/90 backdrop-blur-xl px-4 py-3">
          <div className="max-w-3xl mx-auto flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input) } }}
              placeholder="Pregunta sobre el paper, cuestiona argumentos, pide explicaciones..."
              className="flex-1 rounded-2xl px-4 py-3 text-gray-200 placeholder-gray-600 text-sm focus:outline-none transition-all"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
              onFocus={e => (e.target as HTMLElement).style.borderColor = "rgba(99,102,241,0.45)"}
              onBlur={e  => (e.target as HTMLElement).style.borderColor = "rgba(255,255,255,0.09)"}
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || loading}
              className="px-4 py-3 rounded-2xl text-white transition-all disabled:opacity-40"
              style={{ background: "#4338ca" }}
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
