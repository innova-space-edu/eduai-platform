"use client"

import { useState, useRef, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useRouter } from "next/navigation"

const NIVELES = [
  { id: "parvularia", label: "🌸 Parvularia", sub: "Sala Cuna · Nivel Medio · NT1/NT2" },
  { id: "basica",     label: "📚 Básica",     sub: "1° a 6° Básico" },
  { id: "media",      label: "🎓 Media",       sub: "7° Básico a 4° Medio" },
]

const CURSOS: Record<string, string[]> = {
  parvularia: ["Sala Cuna Menor (0-1 año)", "Sala Cuna Mayor (1-2 años)", "Nivel Medio Menor (2-3 años)", "Nivel Medio Mayor (3-4 años)", "NT1 - Pre Kinder (4-5 años)", "NT2 - Kinder (5-6 años)"],
  basica:     ["1° Básico", "2° Básico", "3° Básico", "4° Básico", "5° Básico", "6° Básico"],
  media:      ["7° Básico", "8° Básico", "1° Medio", "2° Medio", "3° Medio", "4° Medio"],
}

const ASIGNATURAS: Record<string, string[]> = {
  parvularia: ["Identidad y Autonomía", "Convivencia y Ciudadanía", "Corporalidad y Movimiento", "Lenguaje Verbal", "Lenguajes Artísticos", "Exploración del Entorno Natural", "Pensamiento Matemático", "Comprensión del Entorno Sociocultural"],
  basica:     ["Lenguaje y Comunicación", "Matemática", "Ciencias Naturales", "Historia, Geografía y Cs. Sociales", "Inglés", "Educación Física", "Artes Visuales", "Música", "Tecnología", "Orientación"],
  media:      ["Lengua y Literatura", "Matemática", "Biología", "Química", "Física", "Historia, Geografía y Cs. Sociales", "Inglés", "Educación Física", "Artes", "Filosofía", "Orientación"],
}

const QUICK_PROMPTS = [
  { icon: "📋", label: "Planificación completa", prompt: "Crea una planificación de clases completa para esta semana" },
  { icon: "🎯", label: "Actividad lúdica", prompt: "Sugiere una actividad lúdica y motivadora para el curso" },
  { icon: "🌸", label: "Según la temporada", prompt: "¿Qué actividades son ideales para esta época del año?" },
  { icon: "📊", label: "Rúbrica evaluación", prompt: "Crea una rúbrica de evaluación para esta unidad" },
  { icon: "🧩", label: "Proyecto interdisciplinario", prompt: "Propone un proyecto que integre varias asignaturas" },
  { icon: "♿", label: "Adaptación NEE", prompt: "¿Cómo adaptar esta actividad para estudiantes con NEE?" },
  { icon: "🏠", label: "Tarea para el hogar", prompt: "Sugiere tareas o actividades para trabajar en casa con la familia" },
  { icon: "🎪", label: "Acto o evento escolar",       prompt: "Ayúdame a planificar un acto escolar para las Fiestas Patrias que integre el currículum" },
  { icon: "🔍", label: "Todos los OA del curso",         prompt: "Lista todos los Objetivos de Aprendizaje de esta asignatura y curso con su descripción completa" },
  { icon: "💡", label: "Estrategias diferenciadas",      prompt: "¿Qué estrategias de enseñanza diferenciada puedo usar para que todos los estudiantes logren el OA?" },
  { icon: "📅", label: "Unidad didáctica",               prompt: "Diseña una unidad didáctica de 3 semanas con OA, actividades secuenciadas y evaluación" },
]

// N° de OA disponibles por asignatura para mostrar botones de acceso rápido
const OA_COUNTS: Record<string, Record<string, number>> = {
  basica: {
    "Lenguaje y Comunicación": 13,
    "Matemática": 13,
    "Ciencias Naturales": 8,
    "Historia, Geografía y Cs. Sociales": 5,
  },
  media: {
    "Lengua y Literatura": 5,
    "Matemática": 6,
    "Historia, Geografía y Cs. Sociales": 4,
    "Biología": 5,
  },
  parvularia: {
    "Identidad y Autonomía": 8,
    "Lenguaje Verbal": 8,
    "Pensamiento Matemático": 8,
    "Exploración del Entorno Natural": 5,
  },
}

interface Message {
  role: "user" | "assistant"
  content: string
  provider?: string
}

interface Config {
  nivel: string
  curso: string
  asignatura: string
  contexto: string
  mes: string
}

export default function EducadorPage() {
  const [config, setConfig] = useState<Config>({
    nivel: "basica",
    curso: "3° Básico",
    asignatura: "Lenguaje y Comunicación",
    contexto: "",
    mes: new Date().toLocaleString("es-CL", { month: "long" }).toLowerCase(),
  })
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [configOpen, setConfigOpen] = useState(true)
  const router = useRouter()
  const [showWelcome, setShowWelcome] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return
    setInput("")
    setShowWelcome(false)
    setConfigOpen(false)

    const userMsg: Message = { role: "user", content: text }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const res = await fetch("/api/agents/educador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-10),
          config,
        }),
      })

      if (!res.ok) throw new Error("Error")
      const data = await res.json()

      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.text,
        provider: data.provider,
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Hubo un error. Por favor intenta de nuevo.",
      }])
    } finally {
      setLoading(false)
    }
  }

  const currentMes = new Date().toLocaleString("es-CL", { month: "long", year: "numeric" })

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-all text-sm">←</button>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-lg">🏫</div>
            <div>
              <h1 className="text-white font-semibold text-sm">APl — Agente Planificador</h1>
              <p className="text-gray-500 text-xs">Experto en currículo MINEDUC · {currentMes}</p>
            </div>
          </div>
          <button
            onClick={() => setConfigOpen(!configOpen)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
              configOpen
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
            }`}
          >
            ⚙️ {NIVELES.find(n => n.id === config.nivel)?.label} · {config.curso}
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col px-4 py-4 gap-4">

        {/* Config Panel */}
        {configOpen && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h2 className="text-white font-medium text-sm mb-4">📐 Configurar contexto pedagógico</h2>

            {/* Nivel */}
            <div className="mb-4">
              <label className="text-gray-500 text-xs mb-2 block">Nivel educativo</label>
              <div className="grid grid-cols-3 gap-2">
                {NIVELES.map(n => (
                  <button
                    key={n.id}
                    onClick={() => setConfig(prev => ({
                      ...prev,
                      nivel: n.id,
                      curso: CURSOS[n.id][0],
                      asignatura: ASIGNATURAS[n.id][0],
                    }))}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      config.nivel === n.id
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                        : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
                    }`}
                  >
                    <div className="text-sm font-medium">{n.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{n.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Curso y Asignatura */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-gray-500 text-xs mb-1.5 block">Curso</label>
                <select
                  value={config.curso}
                  onChange={e => setConfig(prev => ({ ...prev, curso: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-gray-300 text-sm focus:outline-none focus:border-emerald-500/50"
                >
                  {CURSOS[config.nivel]?.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-gray-500 text-xs mb-1.5 block">
                  {config.nivel === "parvularia" ? "Núcleo de aprendizaje" : "Asignatura"}
                </label>
                <select
                  value={config.asignatura}
                  onChange={e => setConfig(prev => ({ ...prev, asignatura: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-gray-300 text-sm focus:outline-none focus:border-emerald-500/50"
                >
                  {ASIGNATURAS[config.nivel]?.map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
            </div>

            {/* Contexto adicional */}
            <div>
              <label className="text-gray-500 text-xs mb-1.5 block">Contexto adicional (opcional)</label>
              <input
                type="text"
                value={config.contexto}
                onChange={e => setConfig(prev => ({ ...prev, contexto: e.target.value }))}
                placeholder="Ej: curso con 30 estudiantes, incluye 3 con NEE, contexto rural..."
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-gray-300 text-sm focus:outline-none focus:border-emerald-500/50 placeholder-gray-600"
              />
            </div>

            {/* Acceso rápido a OA */}
            {OA_COUNTS[config.nivel]?.[config.asignatura] && (
              <div>
                <p className="text-gray-500 text-xs font-semibold mb-2">🎯 ACCESO RÁPIDO A OA — {config.asignatura} {config.curso}</p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => { setInput(`Lista todos los OA de ${config.asignatura} para ${config.curso} con su descripción completa`); setConfigOpen(false) }}
                    className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                    style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", color: "#6ee7b7" }}
                  >
                    Ver todos los OA
                  </button>
                  {Array.from({ length: OA_COUNTS[config.nivel][config.asignatura] }, (_, i) => i + 1).map(n => (
                    <button
                      key={n}
                      onClick={() => { setInput(`Crea una planificación de clase trabajando el OA${n} de ${config.asignatura} para ${config.curso}`); setConfigOpen(false) }}
                      className="w-8 h-8 rounded-lg text-xs font-bold transition-all hover:scale-105"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}
                      title={`Planificar con OA${n}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Welcome */}
        {showWelcome && !configOpen && (
          <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 rounded-2xl p-6 text-center">
            <div className="text-4xl mb-3">🏫</div>
            <h2 className="text-white font-semibold text-lg mb-1">APl — Agente Planificador Educativo</h2>
            <p className="text-gray-400 text-sm mb-1">Especialista en Bases Curriculares MINEDUC Chile</p>
            <p className="text-emerald-400 text-xs">
              {NIVELES.find(n => n.id === config.nivel)?.label} · {config.curso} · {config.asignatura}
            </p>
          </div>
        )}

        {/* Quick prompts */}
        {showWelcome && (
          <div>
            <p className="text-gray-600 text-xs mb-2">¿Qué necesitas hoy?</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {QUICK_PROMPTS.map(qp => (
                <button
                  key={qp.label}
                  onClick={() => sendMessage(qp.prompt)}
                  className="bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-emerald-500/30 rounded-xl p-3 text-left transition-all group"
                >
                  <div className="text-lg mb-1">{qp.icon}</div>
                  <div className="text-gray-300 text-xs group-hover:text-white">{qp.label}</div>
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
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-sm mr-2 mt-1 flex-shrink-0">🏫</div>
              )}
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-900 border border-gray-800 text-gray-200"
              }`}>
                {msg.role === "assistant" ? (
                  <>
                    <div className="prose prose-invert prose-sm max-w-none
                      [&_h1]:text-emerald-300 [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-2
                      [&_h2]:text-emerald-300 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1
                      [&_h3]:text-teal-300 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:mt-2
                      [&_strong]:text-white [&_ul]:text-gray-300 [&_ol]:text-gray-300
                      [&_li]:mb-1 [&_p]:leading-relaxed [&_p]:text-gray-300
                      [&_table]:w-full [&_table]:border-collapse [&_table]:mt-2
                      [&_th]:bg-emerald-900/40 [&_th]:text-emerald-300 [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-xs [&_th]:border [&_th]:border-gray-700
                      [&_td]:px-3 [&_td]:py-1.5 [&_td]:text-gray-300 [&_td]:text-xs [&_td]:border [&_td]:border-gray-800
                      [&_blockquote]:border-l-2 [&_blockquote]:border-emerald-500 [&_blockquote]:pl-3 [&_blockquote]:text-gray-400 [&_blockquote]:italic
                    ">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                    {msg.provider && (
                      <p className="text-gray-700 text-xs mt-2 pt-2 border-t border-gray-800">
                        via {msg.provider}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-sm mr-2 mt-1 flex-shrink-0">🏫</div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span className="text-gray-600 text-xs">APl preparando planificación...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-gray-950/90 backdrop-blur-sm border-t border-gray-800 px-4 py-3">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage(input))}
              placeholder={`Pide una planificación para ${config.curso} · ${config.asignatura}...`}
              className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-gray-200 placeholder-gray-600 text-sm focus:outline-none focus:border-emerald-500/50"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white px-4 py-3 rounded-xl transition-colors"
            >
              →
            </button>
          </div>
          <p className="text-gray-700 text-xs mt-1.5 text-center">
            APl · Bases Curriculares MINEDUC · Parvularia, Básica y Media
          </p>
        </div>
      </div>
    </div>
  )
}
