"use client"
import { useState, useRef, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useRouter } from "next/navigation"
import Link from "next/link"

const QUICK = [
  { icon: "📝", label: "Ensayo", prompt: "Escribe un ensayo académico sobre: " },
  { icon: "📋", label: "Informe", prompt: "Crea un informe formal sobre: " },
  { icon: "✉️", label: "Carta formal", prompt: "Redacta una carta formal para: " },
  { icon: "📖", label: "Resumen", prompt: "Haz un resumen ejecutivo de: " },
  { icon: "🎯", label: "Introducción", prompt: "Escribe una introducción para un trabajo sobre: " },
  { icon: "📌", label: "Conclusión", prompt: "Escribe una conclusión para un trabajo sobre: " },
]

interface Message { role: "user" | "assistant"; content: string }

export default function RedactorPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages, loading])

  async function send(text: string) {
    if (!text.trim() || loading) return
    setInput("")
    setMessages(prev => [...prev, { role: "user", content: text }])
    setLoading(true)
    try {
      const res = await fetch("/api/agents/redactor", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: messages.slice(-8) }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: "assistant", content: data.text }])
    } catch { setMessages(prev => [...prev, { role: "assistant", content: "Error." }]) }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="border-b border-gray-800 bg-gray-900/80 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-all text-sm">←</button>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-lg">✍️</div>
          <div>
            <h1 className="text-white font-semibold text-sm">Redactor — Documentos</h1>
            <p className="text-gray-500 text-xs">Ensayos, informes, cartas y redacción académica</p>
          </div>
        </div>
      </div>
      <div className="max-w-3xl mx-auto w-full flex-1 px-4 py-6 flex flex-col gap-4">
        {messages.length === 0 && (
          <>
            <div className="bg-gradient-to-br from-violet-500/10 to-purple-500/5 border border-violet-500/20 rounded-2xl p-6 text-center">
              <div className="text-4xl mb-2">✍️</div>
              <h2 className="text-white font-semibold">Agente Redactor</h2>
              <p className="text-gray-400 text-sm mt-1">Redacto ensayos, informes, cartas y cualquier tipo de documento académico o profesional</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {QUICK.map(q => (
                <button key={q.label} onClick={() => setInput(q.prompt)}
                  className="bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-violet-500/30 rounded-xl p-3 text-left transition-all">
                  <span className="text-lg">{q.icon}</span>
                  <p className="text-gray-300 text-xs mt-1">{q.label}</p>
                </button>
              ))}
            </div>
          </>
        )}
        <div className="flex flex-col gap-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-sm mr-2 mt-1 flex-shrink-0">✍️</div>}
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${msg.role === "user" ? "bg-violet-600 text-white" : "bg-gray-900 border border-gray-800 text-gray-200"}`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-invert prose-sm max-w-none [&_h2]:text-violet-300 [&_strong]:text-white [&_blockquote]:border-l-violet-500 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-gray-400">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                ) : <p className="text-sm">{msg.content}</p>}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-2 items-center">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">✍️</div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 flex gap-1">
                {[0,150,300].map(d => <div key={d} className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce" style={{animationDelay:`${d}ms`}} />)}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
      <div className="sticky bottom-0 bg-gray-950/90 backdrop-blur-sm border-t border-gray-800 px-4 py-3">
        <div className="max-w-3xl mx-auto flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send(input)}
            placeholder="¿Qué necesitas redactar?" className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-gray-200 placeholder-gray-600 text-sm focus:outline-none focus:border-violet-500/50" />
          <button onClick={() => send(input)} disabled={!input.trim() || loading} className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white px-4 py-3 rounded-xl">→</button>
        </div>
      </div>
    </div>
  )
}
