"use client"
import { useState, useRef, useEffect } from "react"
import ReactMarkdown from "react-markdown"
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
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="border-b border-gray-800 bg-gray-900/80 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-300 text-sm">←</Link>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-sky-600 flex items-center justify-center text-lg">🌐</div>
            <div>
              <h1 className="text-white font-semibold text-sm">Traductor Multiidioma</h1>
              <p className="text-gray-500 text-xs">Traduce y explica expresiones en múltiples idiomas</p>
            </div>
          </div>
          <select value={idiomaTarget} onChange={e => setIdiomaTarget(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-1.5 text-gray-300 text-xs focus:outline-none focus:border-cyan-500/50">
            {IDIOMAS.map(i => <option key={i}>{i}</option>)}
          </select>
        </div>
      </div>
      <div className="max-w-3xl mx-auto w-full flex-1 px-4 py-6 flex flex-col gap-4">
        {messages.length === 0 && (
          <>
            <div className="bg-gradient-to-br from-cyan-500/10 to-sky-500/5 border border-cyan-500/20 rounded-2xl p-6 text-center">
              <div className="text-4xl mb-2">🌐</div>
              <h2 className="text-white font-semibold">Agente Traductor</h2>
              <p className="text-gray-400 text-sm mt-1">Traduzco textos, explico gramática y expresiones en {idiomaTarget} y más idiomas</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {QUICK.map(q => (
                <button key={q.label} onClick={() => setInput(q.prompt)}
                  className="bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-cyan-500/30 rounded-xl p-3 text-left">
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
              {msg.role === "assistant" && <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-sky-600 flex items-center justify-center mr-2 mt-1 flex-shrink-0">🌐</div>}
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${msg.role === "user" ? "bg-cyan-600 text-white" : "bg-gray-900 border border-gray-800 text-gray-200"}`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-invert prose-sm max-w-none [&_h2]:text-cyan-300 [&_strong]:text-white [&_em]:text-cyan-300">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : <p className="text-sm">{msg.content}</p>}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-2 items-center">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-sky-600 flex items-center justify-center">🌐</div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 flex gap-1">
                {[0,150,300].map(d => <div key={d} className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{animationDelay:`${d}ms`}} />)}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
      <div className="sticky bottom-0 bg-gray-950/90 backdrop-blur-sm border-t border-gray-800 px-4 py-3">
        <div className="max-w-3xl mx-auto flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send(input)}
            placeholder={`Escribe lo que quieres traducir al ${idiomaTarget}...`}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-gray-200 placeholder-gray-600 text-sm focus:outline-none focus:border-cyan-500/50" />
          <button onClick={() => send(input)} disabled={!input.trim() || loading} className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white px-4 py-3 rounded-xl">→</button>
        </div>
      </div>
    </div>
  )
}
