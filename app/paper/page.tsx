"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import MathRenderer from "@/components/ui/MathRenderer"

interface Message {
  role: "user" | "assistant"
  content: string
  provider?: string
}

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

const STORAGE_BUCKET = "papers"
const MAX_PDF_SIZE_MB = 50
const MAX_PDF_SIZE_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024

async function safeJson(res: Response) {
  try {
    return await res.json()
  } catch {
    return null
  }
}

function sanitizeFilename(name: string) {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")

  return cleaned || "documento.pdf"
}

export default function PaperPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [paperContent, setPaperContent] = useState("")
  const [paperTitle, setPaperTitle] = useState("")
  const [uploading, setUploading] = useState(false)
  const [paperLoaded, setPaperLoaded] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [uploadMessage, setUploadMessage] = useState("")
  const [uploadError, setUploadError] = useState("")
  const [storagePath, setStoragePath] = useState("")

  const fileRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const supabase = useMemo(() => {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  const resetPaperState = useCallback(() => {
    setPaperLoaded(false)
    setPaperContent("")
    setPaperTitle("")
    setMessages([])
    setInput("")
    setUploadMessage("")
    setUploadError("")
    setStoragePath("")
    if (fileRef.current) fileRef.current.value = ""
  }, [])

  const processPDF = useCallback(
    async (file: File) => {
      const isPdf =
        file?.type === "application/pdf" ||
        file?.name?.toLowerCase().endsWith(".pdf")

      if (!file || !isPdf) {
        alert("Solo se aceptan archivos PDF")
        return
      }

      if (file.size > MAX_PDF_SIZE_BYTES) {
        const sizeMb = (file.size / 1024 / 1024).toFixed(2)
        const message =
          `El PDF pesa ${sizeMb} MB.\n\n` +
          `El límite actual configurado es ${MAX_PDF_SIZE_MB} MB.`
        setUploadError(message)
        alert(message)
        return
      }

      setUploading(true)
      setUploadError("")
      setUploadMessage("Validando sesión y preparando subida...")

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          throw new Error("Debes iniciar sesión para subir y analizar PDFs.")
        }

        const safeName = sanitizeFilename(file.name)
        const uniquePath = `${user.id}/${Date.now()}-${crypto.randomUUID()}-${safeName}`

        setUploadMessage("Subiendo PDF a Supabase Storage...")

        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(uniquePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: "application/pdf",
          })

        if (uploadError) {
          throw new Error(uploadError.message || "No se pudo subir el archivo a Storage.")
        }

        setStoragePath(uniquePath)
        setUploadMessage("PDF subido. Extrayendo texto desde Storage...")

        const res = await fetch("/api/agents/paper/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bucket: STORAGE_BUCKET,
            filePath: uniquePath,
            filename: file.name,
          }),
        })

        const data = await safeJson(res)

        if (!res.ok) {
          const errorMessage =
            data?.error ||
            "Error al extraer el texto del PDF almacenado en Supabase."
          throw new Error(errorMessage)
        }

        const extractedText = data?.text || ""
        const detectedTitle = data?.title || file.name.replace(/\.pdf$/i, "")
        const summary =
          data?.summary?.trim() ||
          "No se pudo generar un resumen inicial automáticamente."

        setPaperContent(extractedText)
        setPaperTitle(detectedTitle)
        setPaperLoaded(true)

        setMessages([
          {
            role: "assistant",
            content:
              `📄 **Paper cargado: "${detectedTitle}"**\n\n` +
              `**Resumen rápido:**\n${summary}\n\n` +
              `---\n¿Qué quieres saber sobre este paper? ` +
              `Puedo explicar la metodología, los resultados, las conclusiones, o debatir sus argumentos.`,
          },
        ])

        setUploadMessage("PDF procesado correctamente.")
        if (fileRef.current) fileRef.current.value = ""
      } catch (error: any) {
        const message =
          error?.message || "Error al procesar el PDF. Intenta de nuevo."
        setUploadError(message)
        alert(message)
      } finally {
        setUploading(false)
      }
    },
    [supabase]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files?.[0]
      if (file) processPDF(file)
    },
    [processPDF]
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) processPDF(file)
    },
    [processPDF]
  )

  async function send(text: string) {
    const cleanText = text.trim()
    if (!cleanText || loading || !paperLoaded) return

    setInput("")
    setMessages(prev => [...prev, { role: "user", content: cleanText }])
    setLoading(true)

    try {
      const res = await fetch("/api/agents/paper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: cleanText,
          history: messages.slice(-10),
          paperContent,
          paperTitle,
          storagePath,
          storageBucket: STORAGE_BUCKET,
        }),
      })

      const data = await safeJson(res)

      if (!res.ok) {
        throw new Error(data?.error || "Error al analizar el paper.")
      }

      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: data?.text || "No se recibió una respuesta válida.",
          provider: data?.provider,
        },
      ])
    } catch (error: any) {
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: error?.message || "Error al conectar.",
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="border-b border-gray-800 bg-gray-900/80 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.back()}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-all text-sm flex-shrink-0"
            >
              ←
            </button>

            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-700 flex items-center justify-center text-lg flex-shrink-0">
              📄
            </div>

            <div className="min-w-0">
              <h1 className="text-white font-semibold text-sm">Chat con tu Paper</h1>
              <p className="text-gray-500 text-xs truncate">
                {paperLoaded ? `📎 ${paperTitle}` : "Sube un PDF para comenzar"}
              </p>
            </div>
          </div>

          {paperLoaded && (
            <button
              onClick={resetPaperState}
              className="text-xs text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
            >
              Cambiar paper
            </button>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto w-full flex-1 px-4 py-6 flex flex-col gap-4">
        {!paperLoaded && !uploading && (
          <div
            onDrop={handleDrop}
            onDragOver={e => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
              dragOver
                ? "border-indigo-500 bg-indigo-500/10"
                : "border-gray-700 hover:border-indigo-500/50 hover:bg-gray-900/50"
            }`}
          >
            <div className="text-5xl mb-4">📄</div>
            <h2 className="text-white font-semibold text-lg mb-2">Sube tu paper o documento</h2>
            <p className="text-gray-500 text-sm mb-2">
              Arrastra un PDF aquí o haz click para seleccionar
            </p>
            <p className="text-gray-600 text-xs mb-4">
              Límite configurado actual: {MAX_PDF_SIZE_MB} MB
            </p>

            <div className="flex flex-wrap justify-center gap-2">
              {["Papers científicos", "Tesis", "Informes", "Artículos", "Libros"].map(t => (
                <span
                  key={t}
                  className="bg-gray-800 text-gray-400 text-xs px-3 py-1 rounded-full"
                >
                  {t}
                </span>
              ))}
            </div>

            {uploadError && (
              <div className="mt-5 max-w-xl mx-auto rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-left">
                <p className="text-red-300 text-sm font-medium">No se pudo cargar el PDF</p>
                <p className="text-red-200/80 text-xs mt-1 whitespace-pre-line">
                  {uploadError}
                </p>
              </div>
            )}

            <input
              ref={fileRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        )}

        {uploading && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
            <div className="w-12 h-12 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white font-medium">Procesando PDF...</p>
            <p className="text-gray-500 text-sm mt-1">
              {uploadMessage || "Subiendo archivo y extrayendo texto"}
            </p>
          </div>
        )}

        {paperLoaded && messages.length <= 1 && (
          <div>
            <p className="text-gray-600 text-xs mb-2">Preguntas sugeridas:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {QUICK_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-indigo-500/30 rounded-xl px-4 py-2.5 text-left text-gray-400 hover:text-white text-xs transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-700 flex items-center justify-center text-sm mr-2 mt-1 flex-shrink-0">
                  📄
                </div>
              )}

              <div
                className={`max-w-[88%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-900 border border-gray-800"
                }`}
              >
                {msg.role === "assistant" ? (
                  <>
                    <MathRenderer content={msg.content} />
                    {msg.provider && (
                      <p className="text-gray-700 text-xs mt-2 pt-2 border-t border-gray-800">
                        via {msg.provider}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-2 items-center">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-700 flex items-center justify-center text-sm">
                📄
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 flex items-center gap-2">
                <div className="flex gap-1">
                  {[0, 150, 300].map(delay => (
                    <div
                      key={delay}
                      className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </div>
                <span className="text-gray-600 text-xs">Analizando paper...</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {paperLoaded && (
        <div className="sticky bottom-0 bg-gray-950/90 backdrop-blur-sm border-t border-gray-800 px-4 py-3">
          <div className="max-w-3xl mx-auto flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  send(input)
                }
              }}
              placeholder="Pregunta sobre el paper, cuestiona argumentos, pide explicaciones..."
              className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-gray-200 placeholder-gray-600 text-sm focus:outline-none focus:border-indigo-500/50"
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || loading}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl transition-colors"
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
