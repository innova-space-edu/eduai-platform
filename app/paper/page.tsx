"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import {
  ArrowLeft,
  FileText,
  Upload,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  Search,
  FileSearch,
  Brain,
} from "lucide-react"

type PaperMessage = {
  role: "user" | "assistant"
  content: string
  citations?: Array<{
    chunkIndex: number
    sectionTitle: string | null
    pageStart: number
    pageEnd: number
  }>
}

type ExtractResponse = {
  title: string
  text: string
  summary: string
  pageCount: number
  truncated: boolean
  extractionMethod: string
  parserUsed: string
  ocrUsed: boolean
  fromCache: boolean
  bucket: string
  filePath: string
  documentId: string | null
  chunkCount: number
  error?: boolean
}

type ChatResponse = {
  text: string
  provider?: string
  model?: string
  citations?: Array<{
    chunkIndex: number
    sectionTitle: string | null
    pageStart: number
    pageEnd: number
  }>
  extractionMethod?: string
  parserUsed?: string
  ocrUsed?: boolean
  fromCache?: boolean
  error?: string
}

const STORAGE_BUCKET = "papers"

const SUGGESTED_QUESTIONS = [
  "Resume las ideas principales del documento",
  "¿Cuál es la metodología usada?",
  "¿Qué resultados importantes aparecen?",
  "¿Cuáles son las conclusiones del autor?",
  "¿Qué limitaciones o debilidades tiene el estudio?",
  "Explícame este documento en lenguaje simple",
]

function formatCitation(citation: {
  chunkIndex: number
  sectionTitle: string | null
  pageStart: number
  pageEnd: number
}) {
  const pages =
    citation.pageStart === citation.pageEnd
      ? `p. ${citation.pageStart}`
      : `pp. ${citation.pageStart}-${citation.pageEnd}`

  return `Fragmento ${citation.chunkIndex + 1} · ${pages}${
    citation.sectionTitle ? ` · ${citation.sectionTitle}` : ""
  }`
}

async function readErrorResponse(res: Response) {
  const contentType = res.headers.get("content-type") || ""

  if (contentType.includes("application/json")) {
    try {
      const data = await res.json()
      return data?.error || data?.message || JSON.stringify(data)
    } catch {
      return `Error ${res.status}`
    }
  }

  try {
    return (await res.text()) || `Error ${res.status}`
  } catch {
    return `Error ${res.status}`
  }
}

export default function PaperPage() {
  const supabase = createClient()

  const [userReady, setUserReady] = useState(false)

  const [uploading, setUploading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [chatting, setChatting] = useState(false)

  const [paperTitle, setPaperTitle] = useState("Documento")
  const [paperText, setPaperText] = useState("")
  const [paperSummary, setPaperSummary] = useState("")
  const [paperPageCount, setPaperPageCount] = useState(0)

  const [storagePath, setStoragePath] = useState("")
  const [storageBucket, setStorageBucket] = useState(STORAGE_BUCKET)
  const [documentId, setDocumentId] = useState<string | null>(null)

  const [extractionMethod, setExtractionMethod] = useState("")
  const [parserUsed, setParserUsed] = useState("")
  const [ocrUsed, setOcrUsed] = useState(false)
  const [fromCache, setFromCache] = useState(false)
  const [chunkCount, setChunkCount] = useState(0)

  const [question, setQuestion] = useState("")
  const [messages, setMessages] = useState<PaperMessage[]>([])

  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserReady(true)
      else window.location.href = "/login"
    })
  }, [supabase])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const hasDocument = useMemo(() => !!storagePath && !!paperText.trim(), [storagePath, paperText])

  async function handleUploadFile(file: File) {
    setError("")
    setSuccess("")
    setUploading(true)
    setExtracting(false)
    setMessages([])
    setPaperText("")
    setPaperSummary("")
    setPaperPageCount(0)
    setStoragePath("")
    setDocumentId(null)
    setChunkCount(0)
    setExtractionMethod("")
    setParserUsed("")
    setOcrUsed(false)
    setFromCache(false)

    try {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) throw new Error("Sesión no válida.")

      const ext = file.name.split(".").pop()?.toLowerCase()
      if (ext !== "pdf") {
        throw new Error("Por ahora solo se permiten archivos PDF.")
      }

      const path = `${user.id}/${Date.now()}-${file.name}`

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || "application/pdf",
        })

      if (uploadError) throw uploadError

      setStoragePath(path)
      setStorageBucket(STORAGE_BUCKET)
      setPaperTitle(file.name.replace(/\.pdf$/i, ""))
      setSuccess("Documento subido correctamente. Procesando...")

      await runExtraction({
        bucket: STORAGE_BUCKET,
        filePath: path,
        filename: file.name,
        forceRefresh: false,
      })
    } catch (e: any) {
      console.error("[Paper][upload]", e)
      setError(e?.message || "No se pudo subir el documento.")
    } finally {
      setUploading(false)
    }
  }

  async function runExtraction(params: {
    bucket: string
    filePath: string
    filename?: string
    forceRefresh?: boolean
  }) {
    setExtracting(true)
    setError("")
    setSuccess("")

    try {
      const res = await fetch("/api/agents/paper/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      })

      if (!res.ok) {
        const msg = await readErrorResponse(res)
        throw new Error(msg)
      }

      const data: ExtractResponse = await res.json()

      setPaperTitle(data.title || params.filename || "Documento")
      setPaperText(data.text || "")
      setPaperSummary(data.summary || "")
      setPaperPageCount(data.pageCount || 0)
      setStoragePath(data.filePath)
      setStorageBucket(data.bucket)
      setDocumentId(data.documentId)
      setExtractionMethod(data.extractionMethod || "")
      setParserUsed(data.parserUsed || "")
      setOcrUsed(!!data.ocrUsed)
      setFromCache(!!data.fromCache)
      setChunkCount(data.chunkCount || 0)

      setSuccess(
        data.error
          ? "El documento se procesó con problemas."
          : "Documento procesado correctamente."
      )

      if (!data.error) {
        setMessages([
          {
            role: "assistant",
            content:
              `Listo. Ya procesé **${data.title}**.\n\n` +
              `**Resumen:** ${data.summary || "Sin resumen disponible."}\n\n` +
              `Ahora puedes preguntarme por metodología, resultados, conclusiones, limitaciones o cualquier sección.`,
          },
        ])
      }
    } catch (e: any) {
      console.error("[Paper][extract]", e)
      setError(e?.message || "No se pudo procesar el documento.")
    } finally {
      setExtracting(false)
    }
  }

  async function handleAsk(customQuestion?: string) {
    const q = (customQuestion ?? question).trim()
    if (!q || !storagePath || chatting) return

    setChatting(true)
    setError("")
    setSuccess("")

    const nextMessages: PaperMessage[] = [...messages, { role: "user", content: q }]
    setMessages(nextMessages)
    setQuestion("")

    try {
      const res = await fetch("/api/agents/paper", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: q,
          history: nextMessages.slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          paperTitle,
          storagePath,
          storageBucket,
          documentId,
        }),
      })

      if (!res.ok) {
        const msg = await readErrorResponse(res)
        throw new Error(msg)
      }

      const data: ChatResponse = await res.json()

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.text || "No pude responder con suficiente información.",
          citations: data.citations || [],
        },
      ])

      if (data.extractionMethod) setExtractionMethod(data.extractionMethod)
      if (data.parserUsed) setParserUsed(data.parserUsed)
      if (typeof data.ocrUsed === "boolean") setOcrUsed(data.ocrUsed)
      if (typeof data.fromCache === "boolean") setFromCache(data.fromCache)
    } catch (e: any) {
      console.error("[Paper][chat]", e)
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Ocurrió un error al analizar el documento: ${e?.message || "Error desconocido."}`,
        },
      ])
    } finally {
      setChatting(false)
    }
  }

  if (!userReady) {
    return (
      <div className="min-h-screen bg-app text-main flex items-center justify-center">
        <div className="flex items-center gap-3 text-sub">
          <Loader2 className="animate-spin" size={18} />
          Cargando...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-app text-main">
      <header className="sticky top-0 z-20 border-b border-soft bg-app backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="w-9 h-9 rounded-xl flex items-center justify-center border border-soft bg-card-soft-theme text-sub hover:text-main hover:bg-card-soft-theme transition"
          >
            <ArrowLeft size={16} />
          </Link>

          <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-gradient-to-br from-pink-600 to-violet-600 shadow-lg">
            <FileSearch size={18} className="text-main" />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-sm sm:text-base">Chat Paper v2</h1>
            <p className="text-xs text-muted2">
              Sube un PDF, extráelo y conversa con su contenido
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-5 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5">
        {/* Sidebar */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-soft bg-card-soft-theme p-4">
            <div className="flex items-center gap-2 mb-3">
              <Upload size={16} className="text-pink-400" />
              <h2 className="font-semibold text-sm">Subir documento</h2>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleUploadFile(file)
              }}
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || extracting}
              className="w-full rounded-2xl px-4 py-3 bg-gradient-to-r from-pink-600 to-fuchsia-600 text-main font-semibold text-sm disabled:opacity-50"
            >
              {uploading ? "Subiendo..." : "Elegir PDF"}
            </button>

            <div className="mt-3 text-xs text-muted2 leading-relaxed">
              El sistema procesa el documento, crea fragmentos y luego te permite hacer preguntas.
            </div>
          </div>

          <div className="rounded-2xl border border-soft bg-card-soft-theme p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText size={16} className="text-violet-400" />
              <h2 className="font-semibold text-sm">Estado del documento</h2>
            </div>

            <div className="space-y-2 text-sm">
              <div>
                <div className="text-muted2 text-xs">Título</div>
                <div className="text-main break-words">{paperTitle || "Sin documento"}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-muted2 text-xs">Páginas</div>
                  <div className="text-main">{paperPageCount || 0}</div>
                </div>
                <div>
                  <div className="text-muted2 text-xs">Chunks</div>
                  <div className="text-main">{chunkCount || 0}</div>
                </div>
              </div>

              <div>
                <div className="text-muted2 text-xs">Extracción</div>
                <div className="text-main">{extractionMethod || "-"}</div>
              </div>

              <div>
                <div className="text-muted2 text-xs">Parser</div>
                <div className="text-main">{parserUsed || "-"}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-muted2 text-xs">OCR</div>
                  <div className="text-main">{ocrUsed ? "Sí" : "No"}</div>
                </div>
                <div>
                  <div className="text-muted2 text-xs">Cache</div>
                  <div className="text-main">{fromCache ? "Sí" : "No"}</div>
                </div>
              </div>
            </div>

            {!!storagePath && (
              <button
                onClick={() =>
                  runExtraction({
                    bucket: storageBucket,
                    filePath: storagePath,
                    filename: paperTitle,
                    forceRefresh: true,
                  })
                }
                disabled={extracting}
                className="mt-4 w-full rounded-2xl px-4 py-2.5 border border-soft bg-card-soft-theme hover:bg-card-soft-theme text-sm font-medium text-main disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {extracting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Reprocesando...
                  </>
                ) : (
                  <>
                    <RefreshCw size={15} />
                    Reprocesar documento
                  </>
                )}
              </button>
            )}
          </div>

          <div className="rounded-2xl border border-soft bg-card-soft-theme p-4">
            <div className="flex items-center gap-2 mb-3">
              <Brain size={16} className="text-cyan-400" />
              <h2 className="font-semibold text-sm">Resumen</h2>
            </div>

            <div className="text-sm text-sub leading-relaxed whitespace-pre-wrap">
              {paperSummary || "Todavía no hay resumen disponible."}
            </div>
          </div>

          <div className="rounded-2xl border border-soft bg-card-soft-theme p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-yellow-400" />
              <h2 className="font-semibold text-sm">Preguntas sugeridas</h2>
            </div>

            <div className="flex flex-col gap-2">
              {SUGGESTED_QUESTIONS.map((item) => (
                <button
                  key={item}
                  disabled={!hasDocument || chatting}
                  onClick={() => handleAsk(item)}
                  className="text-left rounded-2xl border border-soft bg-card-soft-theme hover:bg-card-soft-theme px-3 py-2.5 text-sm text-main disabled:opacity-40"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-700 whitespace-pre-wrap">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-700 whitespace-pre-wrap">
              {success}
            </div>
          )}
        </aside>

        {/* Main chat */}
        <main className="rounded-2xl border border-soft bg-card-soft-theme min-h-[75vh] flex flex-col overflow-hidden">
          <div className="border-b border-soft px-4 py-3 flex items-center gap-2">
            <Search size={16} className="text-pink-400" />
            <div>
              <div className="font-semibold text-sm">Conversación con el documento</div>
              <div className="text-xs text-muted2">
                Haz preguntas sobre el contenido extraído del PDF
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {!messages.length && (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted2 px-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-600/20 to-violet-600/20 border border-soft flex items-center justify-center mb-4">
                  <FileSearch size={24} className="text-pink-400" />
                </div>
                <h3 className="text-sub font-semibold mb-1">Sube un paper para comenzar</h3>
                <p className="text-sm max-w-xl">
                  Una vez procesado, podrás preguntarle por metodología, resultados, conclusiones,
                  limitaciones, tablas o explicaciones en lenguaje simple.
                </p>
              </div>
            )}

            {messages.map((msg, index) => (
              <div
                key={index}
                className={`max-w-[88%] rounded-2xl px-4 py-3 whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "ml-auto bg-gradient-to-r from-pink-600 to-fuchsia-600 text-main"
                    : "mr-auto bg-card-soft-theme text-main"
                }`}
              >
                <div className="text-sm leading-relaxed">{msg.content}</div>

                {msg.role === "assistant" && !!msg.citations?.length && (
                  <div className="mt-3 pt-3 border-t border-soft">
                    <div className="text-[11px] uppercase tracking-wide text-sub mb-2">
                      Citas usadas
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {msg.citations.map((citation, i) => (
                        <span
                          key={i}
                          className="rounded-xl px-2.5 py-1 bg-card-soft-theme text-xs text-sub"
                        >
                          {formatCitation(citation)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {(extracting || chatting) && (
              <div className="mr-auto max-w-[88%] rounded-2xl px-4 py-3 bg-card-soft-theme text-sub">
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 size={15} className="animate-spin" />
                  {extracting ? "Procesando el documento..." : "Analizando tu pregunta..."}
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          <div className="border-t border-soft p-4">
            <div className="flex gap-3">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={
                  hasDocument
                    ? "Haz una pregunta sobre el documento..."
                    : "Primero sube y procesa un PDF"
                }
                disabled={!hasDocument || chatting || extracting}
                rows={3}
                className="flex-1 resize-none rounded-2xl bg-card-soft-theme px-4 py-3 text-sm text-main placeholder:text-muted2 focus:outline-none focus:border-pink-500/40 disabled:opacity-50"
              />
              <button
                onClick={() => handleAsk()}
                disabled={!hasDocument || !question.trim() || chatting || extracting}
                className="self-end rounded-2xl px-4 py-3 bg-gradient-to-r from-pink-600 to-fuchsia-600 text-main font-semibold disabled:opacity-50 flex items-center gap-2"
              >
                <Send size={15} />
                Enviar
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
