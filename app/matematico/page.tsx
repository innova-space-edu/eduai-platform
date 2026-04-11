"use client"
import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import MathRenderer from "@/components/ui/MathRenderer"

const QUICK = [
  { icon: "➕", label: "Álgebra",      prompt: "Resuelve paso a paso: " },
  { icon: "📐", label: "Geometría",    prompt: "Resuelve este problema de geometría: " },
  { icon: "∫",  label: "Cálculo",      prompt: "Calcula paso a paso: " },
  { icon: "📊", label: "Estadística",  prompt: "Calcula y explica la estadística de: " },
  { icon: "🔢", label: "Aritmética",   prompt: "Resuelve con explicación: " },
  { icon: "📉", label: "Funciones",    prompt: "Analiza la función: " },
  { icon: "🧩", label: "Ecuaciones",   prompt: "Resuelve el sistema de ecuaciones: " },
  { icon: "🔷", label: "Trigonometría",prompt: "Resuelve el problema de trigonometría: " },
]

interface Message {
  role: "user" | "assistant"
  content: string
  provider?: string
}

export default function MatematicoPage() {
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
      const res = await fetch("/api/agents/matematico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: messages.slice(-8) }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: "assistant", content: data.text, provider: data.provider }])
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Error al conectar." }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-app flex flex-col">
      <div className="border-b border-soft bg-header-theme sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-card-soft-theme hover:bg-card-soft-theme text-sub hover:text-main transition-all text-sm"
          >←</button>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-lg">🧮</div>
          <div>
            <h1 className="text-main font-semibold text-sm">Matemático — Paso a paso</h1>
            <p className="text-muted2 text-xs">Resolución con notación LaTeX profesional</p>
          </div>
        </div>
      </div>
      <div className="max-w-3xl mx-auto w-full flex-1 px-4 py-6 flex flex-col gap-4">
        {messages.length === 0 && (
          <>
            <div className="bg-gradient-to-br from-orange-500/10 to-amber-500/5 border border-orange-500/20 rounded-2xl p-6 text-center">
              <div className="text-4xl mb-2">🧮</div>
              <h2 className="text-main font-semibold">Agente Matemático</h2>
              <p className="text-sub text-sm mt-1">
                Resuelvo problemas con notación matemática profesional — igual que en un libro de texto
              </p>
              <div className="mt-4 bg-header-theme border border-orange-500/10 rounded-2xl p-5 text-left">
                <p className="text-muted2 text-xs mb-3 font-medium uppercase tracking-wider">Vista previa de LaTeX</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-card-soft-theme rounded-xl p-3">
                    <p className="text-muted2 text-[10px] mb-2">Fórmula cuadrática</p>
                    <MathRenderer content={"$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$"} />
                  </div>
                  <div className="bg-card-soft-theme rounded-xl p-3">
                    <p className="text-muted2 text-[10px] mb-2">Integral definida</p>
                    <MathRenderer content={"$$\\int_a^b f(x)\\,dx = F(b) - F(a)$$"} />
                  </div>
                  <div className="bg-card-soft-theme rounded-xl p-3">
                    <p className="text-muted2 text-[10px] mb-2">Serie de Taylor</p>
                    <MathRenderer content={"$$e^x = \\sum_{n=0}^{\\infty} \\frac{x^n}{n!}$$"} />
                  </div>
                  <div className="bg-card-soft-theme rounded-xl p-3">
                    <p className="text-muted2 text-[10px] mb-2">Identidad de Euler</p>
                    <MathRenderer content={"$$e^{i\\pi} + 1 = 0$$"} />
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {QUICK.map(q => (
                <button key={q.label} onClick={() => setInput(q.prompt)}
                  className="bg-card-theme hover:bg-card-soft-theme hover:border-orange-500/30 rounded-xl p-3 text-left transition-all">
                  <span className="text-xl">{q.icon}</span>
                  <p className="text-sub text-xs mt-1">{q.label}</p>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="flex flex-col gap-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center mr-2 mt-1 flex-shrink-0 text-sm">🧮</div>
              )}
              <div className={`max-w-[88%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-orange-600 text-main"
                  : "bg-card-theme border border-soft"
              }`}>
                {msg.role === "assistant" ? (
                  <>
                    <MathRenderer content={msg.content} />
                    {msg.provider && (
                      <p className="text-muted2 text-xs mt-2 pt-2 border-t border-soft">via {msg.provider}</p>
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
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-sm">🧮</div>
              <div className="bg-card-theme border border-soft rounded-2xl px-4 py-3 flex items-center gap-2">
                <div className="flex gap-1">
                  {[0,150,300].map(d => (
                    <div key={d} className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay:`${d}ms` }} />
                  ))}
                </div>
                <span className="text-muted2 text-xs">Calculando...</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-app backdrop-blur-sm border-t border-soft px-4 py-3">
        <div className="max-w-3xl mx-auto flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send(input))}
            placeholder="Escribe un problema: ecuación, integral, geometría..."
            className="flex-1 bg-card-theme border border-medium rounded-xl px-4 py-3 text-main placeholder-gray-400 text-sm focus:outline-none focus:border-orange-500/50"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            className="bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white px-4 py-3 rounded-xl transition-colors"
          >→</button>
        </div>
      </div>
    </div>
  )
}
