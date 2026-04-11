"use client"
import { useState, useRef, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useRouter } from "next/navigation"
import AgentHeader from "@/components/ui/AgentHeader"
import AgentChatLayout, { UserBubble, AgentBubble, QuickPrompts, ChatInput } from "@/components/ui/AgentChatLayout"

const ACCENT = "#8b5cf6"
const QUICK = [
  { icon: "📝", label: "Ensayo",        prompt: "Escribe un ensayo académico sobre: " },
  { icon: "📋", label: "Informe",       prompt: "Crea un informe formal sobre: " },
  { icon: "✉️", label: "Carta formal",  prompt: "Redacta una carta formal para: " },
  { icon: "📖", label: "Resumen",       prompt: "Haz un resumen ejecutivo de: " },
  { icon: "🎯", label: "Introducción",  prompt: "Escribe una introducción para un trabajo sobre: " },
  { icon: "📌", label: "Conclusión",    prompt: "Escribe una conclusión para un trabajo sobre: " },
]
interface Message { role: "user" | "assistant"; content: string }

export default function RedactorPage() {
  const router = useRouter()
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
      const res  = await fetch("/api/agents/redactor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, history: messages.slice(-8) }) })
      const data = await res.json()
      setMessages(prev => [...prev, { role: "assistant", content: data.text }])
    } catch { setMessages(prev => [...prev, { role: "assistant", content: "Error." }]) }
    finally   { setLoading(false) }
  }

  return (
    <AgentChatLayout
      accentColor={ACCENT}
      header={<AgentHeader icon="✍️" name="Redactor" desc="Ensayos, informes, cartas y redacción académica" gradient="from-violet-500 to-purple-600" />}
      welcome={messages.length === 0 ? (
        <div className="flex flex-col gap-4 animate-fade-in">
          <div className="rounded-2xl p-6 text-center border" style={{ background: `${ACCENT}0c`, borderColor: `${ACCENT}25` }}>
            <div className="text-4xl mb-2">✍️</div>
            <h2 className="text-main font-bold text-lg">Agente Redactor</h2>
            <p className="text-sub text-sm mt-1">Redacto ensayos, informes, cartas y documentos académicos o profesionales</p>
          </div>
          <QuickPrompts prompts={QUICK} onSelect={p => setInput(p)} accentColor={ACCENT} />
        </div>
      ) : undefined}
      messages={
        <div className="flex flex-col gap-4">
          {messages.map((msg, i) =>
            msg.role === "user"
              ? <UserBubble key={i} content={msg.content} />
              : <AgentBubble key={i} icon="✍️" accentColor={ACCENT}>
                  <div className="prose prose-sm max-w-none [&_h2]:text-purple-700 [&_strong]:text-main">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                </AgentBubble>
          )}
          <div ref={bottomRef} />
        </div>
      }
      loading={loading}
      input={<ChatInput value={input} onChange={setInput} onSend={() => send(input)} loading={loading} placeholder="Describe qué necesitas redactar..." accentColor={ACCENT} />}
    />
  )
}
