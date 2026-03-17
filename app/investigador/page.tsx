"use client"
import { useState, useRef, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import AgentHeader from "@/components/ui/AgentHeader"
import AgentChatLayout, { UserBubble, AgentBubble, QuickPrompts, ChatInput } from "@/components/ui/AgentChatLayout"

const ACCENT = "#3b82f6"
const QUICK = [
  { icon: "🔍", label: "Buscar tema",      prompt: "Busca información actualizada sobre " },
  { icon: "📄", label: "Resumir paper",    prompt: "Resume y explica este paper o artículo: " },
  { icon: "📊", label: "Estado del arte",  prompt: "¿Cuál es el estado del arte en " },
  { icon: "🆚", label: "Comparar fuentes", prompt: "Compara diferentes perspectivas sobre " },
  { icon: "📚", label: "Bibliografía",     prompt: "Sugiere bibliografía académica sobre " },
  { icon: "🧪", label: "Metodología",      prompt: "¿Qué metodologías de investigación se usan para " },
]
interface Message { role: "user" | "assistant"; content: string; provider?: string }

export default function InvestigadorPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input,    setInput]    = useState("")
  const [loading,  setLoading]  = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages, loading])

  async function send(text: string) {
    if (!text.trim() || loading) return
    setInput("")
    setMessages(prev => [...prev, { role: "user", content: text }])
    setLoading(true)
    try {
      const res  = await fetch("/api/agents/investigador", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, history: messages.slice(-8) }) })
      const data = await res.json()
      setMessages(prev => [...prev, { role: "assistant", content: data.text, provider: data.provider }])
    } catch { setMessages(prev => [...prev, { role: "assistant", content: "Error al conectar." }]) }
    finally   { setLoading(false) }
  }

  return (
    <AgentChatLayout
      accentColor={ACCENT}
      header={<AgentHeader icon="🔬" name="Investigador" desc="Busca y sintetiza fuentes académicas en tiempo real" gradient="from-blue-500 to-indigo-600" />}
      welcome={messages.length === 0 ? (
        <div className="flex flex-col gap-4 animate-fade-in">
          <div className="rounded-2xl p-6 text-center border" style={{ background: `${ACCENT}0c`, borderColor: `${ACCENT}25` }}>
            <div className="text-4xl mb-2">🔬</div>
            <h2 className="text-white font-bold text-lg">Agente Investigador</h2>
            <p className="text-gray-400 text-sm mt-1">Busco fuentes académicas actualizadas, analizo papers y genero estados del arte</p>
          </div>
          <QuickPrompts prompts={QUICK} onSelect={p => setInput(p)} accentColor={ACCENT} />
        </div>
      ) : undefined}
      messages={
        <div className="flex flex-col gap-4">
          {messages.map((msg, i) =>
            msg.role === "user"
              ? <UserBubble key={i} content={msg.content} />
              : <AgentBubble key={i} icon="🔬" accentColor={ACCENT}>
                  <div className="prose prose-invert prose-sm max-w-none [&_h2]:text-blue-300 [&_strong]:text-white [&_a]:text-blue-400">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                  {msg.provider && <p className="text-[10px] text-gray-600 mt-2">via {msg.provider}</p>}
                </AgentBubble>
          )}
          <div ref={bottomRef} />
        </div>
      }
      loading={loading}
      input={<ChatInput value={input} onChange={setInput} onSend={() => send(input)} loading={loading} placeholder="Busca un tema, pide análisis de paper..." accentColor={ACCENT} />}
    />
  )
}
