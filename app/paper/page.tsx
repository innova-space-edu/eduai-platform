"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
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

export default function PaperPage() {
  const [messages, setMessages]       = useState<Message[]>([])
  const [input, setInput]             = useState("")
  const [loading, setLoading]         = useState(false)
  const [paperContent, setPaperContent] = useState("")
  const [paperTitle, setPaperTitle]   = useState("")
  const [uploading, setUploading]     = useState(false)
  const [paperLoaded, setPaperLoaded] = useState(false)
  const [dragOver, setDragOver]       = useState(false)
  const fileRef   = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const router    = useRouter()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  const processPDF = useCallback(async (file: File) => {
    if (!file || file.type !== "application/pdf") {
      alert("Solo se aceptan archivos PDF")
      return
    }
    setUploading(true)
    try {
      // Leer PDF como base64
      const arrayBuffer = await file.arrayBuffer()
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      )

      // Extraer texto del PDF via API
      const res = await fetch("/api/agents/paper/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, filename: file.name }),
      })

      if (!res.ok) throw new Error("Error extrayendo texto")
      const data = await res.json()

      setPaperContent(data.text)
      setPaperTitle(data.title || file.name.replace(".pdf", ""))
      setPaperLoaded(true)

      // Mensaje inicial automático
      setMessages([{
        role: "assistant",
        content: `📄 **Paper cargado: "${data.title || file.name}"**\n\n**Resumen rápido:**\n${data.summary}\n\n---\n¿Qué quieres saber sobre este paper? Puedo explicar la metodología, los resultados, las conclusiones, o debatir sus argumentos.`,
      }])
    } catch (e) {
      alert("Error al procesar el PDF. Intenta de nuevo.")
    } finally {
      setUploading(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processPDF(file)
  }, [processPDF])

  async function send(text: string) {
    if (!text.trim() || loading || !paperLoaded) return
    setInput("")
    setMessages(prev => [...prev, { role: "user", content: text }])
    setLoading(true)
    try {
      const res = await fetch("/api/agents/paper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-10),
          paperContent,
          paperTitle,
        }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.text,
        provider: data.provider,
      }])
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Error al conectar." }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/80 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-all text-sm">
              ←
            </button>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-700 flex items-center justify-center text-lg">📄</div>
            <div>
              <h1 className="text-white font-semibold text-sm">Chat con tu Paper</h1>
              <p className="text-gray-500 text-xs">
                {paperLoaded ? `📎 ${paperTitle}` : "Sube un PDF para comenzar"}
              </p>
            </div>
          </div>
          {paperLoaded && (
            <button
              onClick={() => { setPaperLoaded(false); setPaperContent(""); setPaperTitle(""); setMessages([]) }}
              className="text-xs text-gray-600 hover:text-gray-300 bg-gray-800 px-3 py-1.5 rounded-lg transition-colors"
            >
              Cambiar paper
            </button>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto w-full flex-1 px-4 py-6 flex flex-col gap-4">

        {/* Upload zone */}
        {!paperLoaded && !uploading && (
          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
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
            <p className="text-gray-500 text-sm mb-4">Arrastra un PDF aquí o haz click para seleccionar</p>
            <div className="flex flex-wrap justify-center gap-2">
              {["Papers científicos", "Tesis", "Informes", "Artículos", "Libros"].map(t => (
                <span key={t} className="bg-gray-800 text-gray-400 text-xs px-3 py-1 rounded-full">{t}</span>
              ))}
            </div>
            <input ref={fileRef} type="file" accept=".pdf" className="hidden"
              onChange={e => e.target.files?.[0] && processPDF(e.target.files[0])} />
          </div>
        )}

        {/* Loading PDF */}
        {uploading && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
            <div className="w-12 h-12 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white font-medium">Procesando PDF...</p>
            <p className="text-gray-500 text-sm mt-1">Extrayendo texto y generando resumen inicial</p>
          </div>
        )}

        {/* Quick questions */}
        {paperLoaded && messages.length <= 1 && (
          <div>
            <p className="text-gray-600 text-xs mb-2">Preguntas sugeridas:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {QUICK_QUESTIONS.map(q => (
                <button key={q} onClick={() => send(q)}
                  className="bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-indigo-500/30 rounded-xl px-4 py-2.5 text-left text-gray-400 hover:text-white text-xs transition-all">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex flex-col gap-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-700 flex items-center justify-center text-sm mr-2 mt-1 flex-shrink-0">📄</div>
              )}
              <div className={`max-w-[88%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-900 border border-gray-800"
              }`}>
                {msg.role === "assistant" ? (
                  <>
                    <MathRenderer content={msg.content} />
                    {msg.provider && (
                      <p className="text-gray-700 text-xs mt-2 pt-2 border-t border-gray-800">via {msg.provider}</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-2 items-center">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-700 flex items-center justify-center text-sm">📄</div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 flex items-center gap-2">
                <div className="flex gap-1">
                  {[0,150,300].map(d => (
                    <div key={d} className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay:`${d}ms` }} />
                  ))}
                </div>
                <span className="text-gray-600 text-xs">Analizando paper...</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      {paperLoaded && (
        <div className="sticky bottom-0 bg-gray-950/90 backdrop-blur-sm border-t border-gray-800 px-4 py-3">
          <div className="max-w-3xl mx-auto flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send(input))}
              placeholder="Pregunta sobre el paper, cuestiona argumentos, pide explicaciones..."
              className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-gray-200 placeholder-gray-600 text-sm focus:outline-none focus:border-indigo-500/50"
            />
            <button onClick={() => send(input)} disabled={!input.trim() || loading}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-4 py-3 rounded-xl transition-colors">
              →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
