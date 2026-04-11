"use client"
import { useState, useRef, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import { useRouter } from "next/navigation"
import Link from "next/link"

const IDIOMAS = ["Inglés", "Francés", "Portugués", "Alemán", "Italiano", "Chino", "Japonés", "Árabe"]
const QUICK = [
  { icon: "📝", label: "Traducir texto", prompt: "Traduce al inglés: " },
  { icon: "🎓", label: "Texto académico", prompt: "Traduce este texto académico manteniendo el tono formal: " },
  { icon: "💬", label: "Expresión natural", prompt: "¿Cómo se dice de forma natural en inglés: " },
  { icon: "📖", label: "Explicar idioma", prompt: "Explica la gramática de esta frase en inglés: " },
]

interface Message { role: "user" | "assistant"; content: string }

export default function TraductorPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [idiomaTarget, setIdiomaTarget] = useState("Inglés")
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages, loading])

  async function send(text: string) {
    if (!text.trim() || loading) return
    setInput("")
    setMessages(prev => [...prev, { role: "user", content: text }])
    setLoading(true)
    try {
      const res = await fetch("/api/agents/traductor", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: messages.slice(-8), idiomaTarget }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: "assistant", content: data.text }])
    } catch { setMessages(prev => [...prev, { role: "assistant", content: "Error." }]) }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-app flex flex-col">
      <div className="border-b border-soft bg-header-theme sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center rounded-lg bg-card-soft-theme hover:bg-card-soft-theme text-sub hover:text-main transition-all text-sm">←</button>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-sky-600 flex items-center justify-center text-lg">🌐</div>
            <div>
              <h1 className="text-main font-semibold text-sm">Traductor Multiidioma</h1>
              <p className="text-muted2 text-xs">Traduce y explica expresiones en múltiples idiomas</p>
            </div>
          </div>
          <select value={idiomaTarget} onChange={e => setIdiomaTarget(e.target.value)}
            className="bg-card-soft-theme border border-soft rounded-xl px-3 py-1.5 text-sub text-xs focus:outline-none focus:border-cyan-500/50">
            {IDIOMAS.map(i => <option key={i}>{i}</option>)}
          </select>
        </div>
      </div>
      <div className="max-w-3xl mx-auto w-full flex-1 px-4 py-6 flex flex-col gap-4">
        {messages.length === 0 && (
          <>
            <div className="bg-gradient-to-br from-cyan-500/10 to-sky-500/5 border border-cyan-500/20 rounded-2xl p-6 text-center">
              <div className="text-4xl mb-2">🌐</div>
              <h2 className="text-main font-semibold">Agente Traductor</h2>
              <p className="text-sub text-sm mt-1">Traduzco textos, explico gramática y expresiones en {idiomaTarget} y más idiomas</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {QUICK.map(q => (
                <button key={q.label} onClick={() => setInput(q.prompt)}
                  className="bg-card-theme hover:bg-card-soft-theme hover:border-cyan-500/30 rounded-xl p-3 text-left">
                  <span className="text-lg">{q.icon}</span>
                  <p className="text-sub text-xs mt-1">{q.label}</p>
                </button>
              ))}
            </div>
          </>
        )}
        <div className="flex flex-col gap-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-sky-600 flex items-center justify-center mr-2 mt-1 flex-shrink-0">🌐</div>}
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${msg.role === "user" ? "bg-cyan-600 text-main" : "bg-card-theme border border-soft text-main"}`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none [&_h2]:text-cyan-700 [&_strong]:text-main [&_em]:text-cyan-700">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : <p className="text-sm">{msg.content}</p>}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-2 items-center">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-sky-600 flex items-center justify-center">🌐</div>
              <div className="bg-card-theme border border-soft rounded-2xl px-4 py-3 flex gap-1">
                {[0,150,300].map(d => <div key={d} className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{animationDelay:`${d}ms`}} />)}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
      <div className="sticky bottom-0 bg-app backdrop-blur-sm border-t border-soft px-4 py-3">
        <div className="max-w-3xl mx-auto flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send(input)}
            placeholder={`Escribe lo que quieres traducir al ${idiomaTarget}...`}
            className="flex-1 bg-card-theme border border-medium rounded-xl px-4 py-3 text-main placeholder-gray-400 text-sm focus:outline-none focus:border-cyan-500/50" />
          <button onClick={() => send(input)} disabled={!input.trim() || loading} className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white px-4 py-3 rounded-xl">→</button>
        </div>
      </div>
    </div>
  )
}
