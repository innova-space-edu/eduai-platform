"use client"

import { useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, Bot, BookOpen, FileQuestion, ImageIcon, Loader2, MapPinned, PenLine, Search, Send, Sparkles } from "lucide-react"

type Role = "user" | "assistant"
type Message = { role: Role; content: string }
type Suggestion = { label: string; href: string; emoji: string }

type Props = {
  displayName?: string
  isAdmin?: boolean
}

const QUICK_ACTIONS = [
  {
    label: "Estudiar tema",
    icon: BookOpen,
    prompt: "Quiero iniciar una sesión de estudio autónoma sobre ",
    hint: "Explica, practica y evalúa",
  },
  {
    label: "Crear prueba",
    icon: FileQuestion,
    prompt: "Ayúdame a crear una evaluación con preguntas variadas sobre ",
    hint: "Alternativas, desarrollo y rúbrica",
  },
  {
    label: "Generar imagen",
    icon: ImageIcon,
    prompt: "Genera una imagen educativa estilo Canva con colores suaves sobre ",
    hint: "Visual para explicar una idea",
  },
  {
    label: "Planificar clase",
    icon: PenLine,
    prompt: "Planifica una clase para enseñanza media sobre ",
    hint: "Inicio, desarrollo y cierre",
  },
]

const EDUAI_SHORTCUTS = [
  { label: "Creator Hub", href: "/creator-hub", emoji: "🚀" },
  { label: "Crear examen", href: "/examen/crear", emoji: "📝" },
  { label: "QR Studio", href: "/qr-studio", emoji: "▦" },
  { label: "Image Studio", href: "/image-studio", emoji: "🎨" },
  { label: "Chat Paper", href: "/paper", emoji: "📄" },
  { label: "Audio Lab", href: "/audio-lab", emoji: "🎙️" },
]

function extractStudyTopic(text: string) {
  const cleaned = text
    .replace(/^(quiero|necesito|ayúdame a|ayudame a|puedes)?\s*(estudiar|aprender|repasar|ver)\s*/i, "")
    .replace(/^(sobre|de|el|la|los|las)\s*/i, "")
    .trim()
  return cleaned || text.trim()
}

function renderContent(text: string) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g)
  return parts.map((part, index) => {
    const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (!match) return <span key={index}>{part}</span>
    return (
      <Link key={index} href={match[2]} className="inline-flex items-center gap-1 rounded-lg bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700 hover:bg-violet-200">
        {match[1]} <ArrowRight size={11} />
      </Link>
    )
  })
}

export default function ClawStudyConsole({ displayName = "Estudiante", isAdmin = false }: Props) {
  const router = useRouter()
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Hola ${displayName}. Soy Claw, tu superagente de EduAI. Puedo iniciar sesiones de estudio, crear pruebas, generar imágenes, buscar herramientas de la plataforma o llevarte a la página correcta.`,
    },
  ])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const contextualPrompt = useMemo(() => {
    if (isAdmin) return "Modo admin disponible: puedo ayudarte con creación de exámenes, resultados, QR, materiales y herramientas internas."
    return "Modo estudiante: puedo ayudarte a estudiar, practicar y crear explicaciones visuales."
  }, [isAdmin])

  const send = async (override?: string) => {
    const text = String(override ?? input).trim()
    if (!text || loading) return

    const maybeStudy = /^\s*(estudiar|aprender|repasar)\b/i.test(text)
    if (maybeStudy && text.length < 90) {
      const topic = extractStudyTopic(text)
      router.push(`/study/${encodeURIComponent(topic)}`)
      return
    }

    setInput("")
    setSuggestions([])
    const nextMessages: Message[] = [...messages, { role: "user", content: text }]
    setMessages(nextMessages)
    setLoading(true)

    try {
      const response = await fetch("/api/agents/claw-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: nextMessages.slice(-10),
          pageContext: {
            pathname: "/dashboard",
            pageTitle: "Panel de estudio EduAI",
            mode: isAdmin ? "admin" : "student",
            availableActions: ["start_study_session", "generate_exam_questions", "generate_image", "plan_curriculum", "navigate_to_page"],
          },
          userName: displayName,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || "No se pudo responder")

      setMessages((prev) => [...prev, { role: "assistant", content: data.reply || "Listo." }])
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : [])
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: error instanceof Error ? `No pude completar la acción: ${error.message}` : "No pude completar la acción." },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleQuickAction = (prompt: string) => {
    setInput(prompt)
    setTimeout(() => inputRef.current?.focus(), 60)
  }

  return (
    <section className="rounded-[2rem] border border-soft bg-card-theme p-5 shadow-sm animate-fade-in">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-500/20">
            <Bot size={19} />
          </div>
          <div>
            <h2 className="text-main text-lg font-black">Claw — Superagente EduAI</h2>
            <p className="text-muted2 text-xs leading-relaxed">Escribe cualquier cosa: estudiar, crear material, generar imagen, abrir una herramienta o pedir ayuda dentro de EduAI.</p>
          </div>
        </div>
        <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700 sm:inline-flex">
          activo
        </span>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon
          return (
            <button
              key={action.label}
              type="button"
              onClick={() => handleQuickAction(action.prompt)}
              className="group rounded-2xl border border-soft bg-card-soft-theme p-3 text-left transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/70"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                  <Icon size={15} />
                </div>
                <div>
                  <p className="text-main text-sm font-bold group-hover:text-blue-700">{action.label}</p>
                  <p className="text-muted2 text-[11px]">{action.hint}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="mb-4 max-h-72 space-y-3 overflow-y-auto rounded-3xl border border-soft bg-app p-3">
        <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-3 text-xs text-violet-800">
          <Sparkles size={13} className="mr-1 inline" /> {contextualPrompt}
        </div>
        {messages.slice(-6).map((message, index) => (
          <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${message.role === "user" ? "bg-blue-600 text-white" : "bg-card-soft-theme text-main"}`}>
              {message.role === "assistant" ? renderContent(message.content) : message.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted2">
            <Loader2 size={14} className="animate-spin" /> Claw está pensando y revisando herramientas...
          </div>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <Link
              key={suggestion.href}
              href={suggestion.href}
              className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-[11px] font-bold text-violet-700 hover:bg-violet-100"
            >
              {suggestion.emoji} {suggestion.label}
            </Link>
          ))}
        </div>
      )}

      <div className="rounded-3xl border border-soft bg-card-soft-theme p-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              send()
            }
          }}
          rows={2}
          placeholder="Ej: enséñame química orgánica paso a paso, crea una prueba de fracciones, abre QR Studio..."
          className="min-h-[68px] w-full resize-none bg-transparent px-3 py-2 text-sm text-main outline-none placeholder:text-muted2"
          disabled={loading}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-soft px-2 pt-2">
          <div className="flex flex-wrap gap-1.5">
            {EDUAI_SHORTCUTS.map((shortcut) => (
              <Link key={shortcut.href} href={shortcut.href} className="rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-semibold text-muted2 hover:text-blue-700">
                {shortcut.emoji} {shortcut.label}
              </Link>
            ))}
          </div>
          <button
            type="button"
            onClick={() => send()}
            disabled={loading || !input.trim()}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-xs font-black text-white transition hover:bg-blue-700 disabled:opacity-40"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Enviar
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-[11px] text-muted2">
        <Search size={12} /> Claw puede sugerir rutas, iniciar estudio y activar herramientas internas según el pedido.
      </div>
    </section>
  )
}
