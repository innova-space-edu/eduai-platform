"use client"
import { useState, useRef, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import Link from "next/link"

const QUICK = [
  { icon: "🔍", label: "Buscar tema", prompt: "Busca información actualizada sobre " },
  { icon: "📄", label: "Resumir paper", prompt: "Resume y explica este paper o artículo: " },
  { icon: "📊", label: "Estado del arte", prompt: "¿Cuál es el estado del arte en " },
  { icon: "🆚", label: "Comparar fuentes", prompt: "Compara diferentes perspectivas sobre " },
  { icon: "📚", label: "Bibliografía", prompt: "Sugiere bibliografía académica sobre " },
  { icon: "🧪", label: "Metodología", prompt: "¿Qué metodologías de investigación se usan para " },
]

interface Message { role: "user" | "assistant"; content: string; provider?: string }

export default function InvestigadorPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages, loading])

  async function send(text: string) {
    if (!text.trim() || loading) return
    setInput("")
    const userMsg: Message = { role: "user", content: text }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)
    try {
      const res = await fetch("/api/agents/investigador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: messages.slice(-8) }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: "assistant", content: data.text, provider: data.provider }])
    } catch { setMessages(prev => [...prev, { role: "assistant", content: "Error al conectar." }]) }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="border-b border-gray-800 bg-gray-900/80 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-600 hover:text-gray-300 text-sm">←</Link>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-lg">🔬</div>
          <div>
            <h1 className="text-white font-semibold text-sm">Investigador — Web Search</h1>
            <p className="text-gray-500 text-xs">Busca, resume y analiza fuentes académicas</p>
          </div>
        </div>
      </div>
      <div className="max-w-3xl mx-auto w-full flex-1 px-4 py-6 flex flex-col gap-4">
        {messages.length === 0 && (
          <>
            <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border border-blue-500/20 rounded-2xl p-6 text-center">
              <div className="text-4xl mb-2">🔬</div>
              <h2 className="text-white font-semibold">Agente Investigador</h2>
              <p className="text-gray-400 text-sm mt-1">Busco información actualizada en la web y analizo fuentes académicas</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {QUICK.map(q => (
                <button key={q.label} onClick={() => setInput(q.prompt)}
                  className="bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-blue-500/30 rounded-xl p-3 text-left transition-all">
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
              {msg.role === "assistant" && <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm mr-2 mt-1 flex-shrink-0">🔬</div>}
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${msg.role === "user" ? "bg-blue-600 text-white" : "bg-gray-900 border border-gray-800 text-gray-200"}`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-invert prose-sm max-w-none [&_h2]:text-blue-300 [&_h3]:text-blue-300 [&_strong]:text-white [&_a]:text-blue-400 [&_table]:w-full [&_th]:bg-blue-900/30 [&_th]:text-blue-300 [&_th]:px-3 [&_th]:py-1 [&_th]:border [&_th]:border-gray-700 [&_td]:px-3 [&_td]:py-1 [&_td]:border [&_td]:border-gray-800">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    {msg.provider && <p className="text-gray-700 text-xs mt-2 pt-2 border-t border-gray-800">via {msg.provider}</p>}
                  </div>
                ) : <p className="text-sm">{msg.content}</p>}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-2 items-center">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm">🔬</div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 flex gap-1">
                {[0,150,300].map(d => <div key={d} className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{animationDelay:`${d}ms`}} />)}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
      <div className="sticky bottom-0 bg-gray-950/90 backdrop-blur-sm border-t border-gray-800 px-4 py-3">
        <div className="max-w-3xl mx-auto flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send(input)}
            placeholder="¿Qué quieres investigar?" className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-gray-200 placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500/50" />
          <button onClick={() => send(input)} disabled={!input.trim() || loading} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-4 py-3 rounded-xl">→</button>
        </div>
      </div>
    </div>
  )
}
