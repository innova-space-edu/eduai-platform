"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useRouter } from "next/navigation"
import {
  getParvulariaAmbito,
  getParvulariaOAT,
  getPlannerOAOptions,
  getPlannerUnits,
  type TiempoPlanificacion,
} from "@/lib/planificador-curriculum"
import type { NivelKey } from "@/lib/mineduc-oa"

const NIVELES = [
  { id: "parvularia", label: "🌸 Parvularia", sub: "Sala Cuna · Nivel Medio · NT1/NT2" },
  { id: "basica", label: "📚 Básica", sub: "1° a 6° Básico" },
  { id: "media", label: "🎓 Media", sub: "7° Básico a 4° Medio" },
]

const CURSOS: Record<NivelKey, string[]> = {
  parvularia: ["Sala Cuna Menor (0-1 año)", "Sala Cuna Mayor (1-2 años)", "Nivel Medio Menor (2-3 años)", "Nivel Medio Mayor (3-4 años)", "NT1 - Pre Kinder (4-5 años)", "NT2 - Kinder (5-6 años)"],
  basica: ["1° Básico", "2° Básico", "3° Básico", "4° Básico", "5° Básico", "6° Básico"],
  media: ["7° Básico", "8° Básico", "1° Medio", "2° Medio", "3° Medio", "4° Medio"],
}

const ASIGNATURAS: Record<NivelKey, string[]> = {
  parvularia: ["Identidad y Autonomía", "Convivencia y Ciudadanía", "Corporalidad y Movimiento", "Lenguaje Verbal", "Lenguajes Artísticos", "Exploración del Entorno Natural", "Pensamiento Matemático", "Comprensión del Entorno Sociocultural"],
  basica: ["Lenguaje y Comunicación", "Matemática", "Ciencias Naturales", "Historia, Geografía y Cs. Sociales", "Inglés", "Educación Física", "Artes Visuales", "Música", "Tecnología", "Orientación"],
  media: ["Lengua y Literatura", "Matemática", "Biología", "Química", "Física", "Historia, Geografía y Cs. Sociales", "Inglés", "Educación Física", "Artes", "Filosofía", "Orientación"],
}

const QUICK_PROMPTS = [
  { icon: "📋", label: "Planificación completa", prompt: "Crea una planificación completa alineada a los OA seleccionados" },
  { icon: "🧠", label: "Secuencia por tiempo", prompt: "Distribuye actividades según el tiempo de planificación elegido" },
  { icon: "📊", label: "Evaluación", prompt: "Crea instrumentos de evaluación para los OA seleccionados" },
  { icon: "♿", label: "Adaptación NEE", prompt: "Adapta la planificación para diversidad y NEE" },
  { icon: "🌸", label: "Parvularia", prompt: "Diseña una experiencia de aprendizaje lúdica y contextualizada" },
  { icon: "🧩", label: "Interdisciplinario", prompt: "Integra habilidades transversales y trabajo interdisciplinario" },
]

interface Message {
  role: "user" | "assistant"
  content: string
  provider?: string
}

interface Config {
  nivel: NivelKey
  curso: string
  asignatura: string
  contexto: string
  mes: string
  unidadId: string
  selectedOAIds: string[]
  selectedOATIds: string[]
  tiempoPlanificacion: TiempoPlanificacion
  sesiones: number
  duracionMinutos: number
}

export default function EducadorPage() {
  const [config, setConfig] = useState<Config>({
    nivel: "media",
    curso: "1° Medio",
    asignatura: "Matemática",
    contexto: "",
    mes: new Date().toLocaleString("es-CL", { month: "long" }).toLowerCase(),
    unidadId: "u1",
    selectedOAIds: [],
    selectedOATIds: [],
    tiempoPlanificacion: "diaria",
    sesiones: 1,
    duracionMinutos: 90,
  })
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [configOpen, setConfigOpen] = useState(true)
  const [showWelcome, setShowWelcome] = useState(true)
  const router = useRouter()
  const bottomRef = useRef<HTMLDivElement>(null)

  const curriculumState = useMemo(() => ({
    nivel: config.nivel,
    curso: config.curso,
    asignatura: config.asignatura,
  }), [config.nivel, config.curso, config.asignatura])

  const units = useMemo(() => getPlannerUnits(curriculumState), [curriculumState])
  const oaOptions = useMemo(() => getPlannerOAOptions(curriculumState, config.unidadId || undefined), [curriculumState, config.unidadId])
  const parvulariaOAT = useMemo(() => getParvulariaOAT(config.asignatura), [config.asignatura])
  const ambito = config.nivel === "parvularia" ? getParvulariaAmbito(config.asignatura) : ""

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  useEffect(() => {
    setConfig(prev => {
      const nextCourse = CURSOS[prev.nivel][0]
      const nextSubject = ASIGNATURAS[prev.nivel][0]
      if (CURSOS[prev.nivel].includes(prev.curso) && ASIGNATURAS[prev.nivel].includes(prev.asignatura)) return prev
      return {
        ...prev,
        curso: CURSOS[prev.nivel].includes(prev.curso) ? prev.curso : nextCourse,
        asignatura: ASIGNATURAS[prev.nivel].includes(prev.asignatura) ? prev.asignatura : nextSubject,
      }
    })
  }, [config.nivel])

  useEffect(() => {
    setConfig(prev => {
      const nextUnits = getPlannerUnits({ nivel: prev.nivel, curso: prev.curso, asignatura: prev.asignatura })
      const nextUnitId = nextUnits.find(u => u.id === prev.unidadId)?.id || nextUnits[0]?.id || ""
      const nextOAOptions = getPlannerOAOptions({ nivel: prev.nivel, curso: prev.curso, asignatura: prev.asignatura }, nextUnitId || undefined)
      const allowedOAIds = new Set(nextOAOptions.map(oa => oa.id))
      const selectedOAIds = prev.selectedOAIds.filter(id => allowedOAIds.has(id))
      const nextOAT = getParvulariaOAT(prev.asignatura)
      const allowedOATIds = new Set(nextOAT.map(item => item.id))
      return {
        ...prev,
        unidadId: nextUnitId,
        selectedOAIds,
        selectedOATIds: prev.selectedOATIds.filter(id => allowedOATIds.has(id)),
      }
    })
  }, [config.nivel, config.curso, config.asignatura])

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

  function toggleOA(id: string) {
    setConfig(prev => ({
      ...prev,
      selectedOAIds: prev.selectedOAIds.includes(id)
        ? prev.selectedOAIds.filter(x => x !== id)
        : [...prev.selectedOAIds, id],
    }))
  }

  function toggleOAT(id: string) {
    setConfig(prev => ({
      ...prev,
      selectedOATIds: prev.selectedOATIds.includes(id)
        ? prev.selectedOATIds.filter(x => x !== id)
        : [...prev.selectedOATIds, id],
    }))
  }

  const planningBadge = `${config.tiempoPlanificacion} · ${config.sesiones} ses. · ${config.duracionMinutos} min`

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-all text-sm">←</button>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-lg shadow-lg shadow-emerald-950/40">🏫</div>
            <div>
              <h1 className="text-white font-semibold text-sm">APl — Agente Planificador</h1>
              <p className="text-gray-500 text-xs">MINEDUC · OA por unidad · planificación robusta · {currentMes}</p>
            </div>
          </div>
          <button
            onClick={() => setConfigOpen(!configOpen)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${configOpen ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"}`}
          >
            ⚙️ {config.curso} · {config.asignatura}
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col px-4 py-4 gap-4">
        {configOpen && (
          <div className="grid xl:grid-cols-[1.15fr_0.85fr] gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-3xl p-5">
              <h2 className="text-white font-medium text-sm mb-4">📐 Configurar contexto pedagógico</h2>

              <div className="mb-4">
                <label className="text-gray-500 text-xs mb-2 block">Nivel educativo</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {NIVELES.map(n => (
                    <button
                      key={n.id}
                      onClick={() => setConfig(prev => ({
                        ...prev,
                        nivel: n.id as NivelKey,
                        curso: CURSOS[n.id as NivelKey][0],
                        asignatura: ASIGNATURAS[n.id as NivelKey][0],
                        unidadId: "",
                        selectedOAIds: [],
                        selectedOATIds: [],
                      }))}
                      className={`p-3 rounded-2xl border text-left transition-all ${config.nivel === n.id ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300" : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"}`}
                    >
                      <div className="text-sm font-medium">{n.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{n.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-gray-500 text-xs mb-1.5 block">Curso</label>
                  <select
                    value={config.curso}
                    onChange={e => setConfig(prev => ({ ...prev, curso: e.target.value, selectedOAIds: [] }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-2xl px-3 py-2.5 text-gray-300 text-sm focus:outline-none focus:border-emerald-500/50"
                  >
                    {CURSOS[config.nivel].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-gray-500 text-xs mb-1.5 block">{config.nivel === "parvularia" ? "Núcleo de aprendizaje" : "Asignatura"}</label>
                  <select
                    value={config.asignatura}
                    onChange={e => setConfig(prev => ({ ...prev, asignatura: e.target.value, selectedOAIds: [], selectedOATIds: [] }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-2xl px-3 py-2.5 text-gray-300 text-sm focus:outline-none focus:border-emerald-500/50"
                  >
                    {ASIGNATURAS[config.nivel].map(a => <option key={a}>{a}</option>)}
                  </select>
                </div>
              </div>

              {config.nivel === "parvularia" && (
                <div className="mb-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <p className="text-[11px] uppercase tracking-wide text-emerald-300 mb-1">Ámbito y núcleo</p>
                  <p className="text-white text-sm font-medium">{ambito}</p>
                  <p className="text-gray-400 text-xs mt-1">Núcleo activo: {config.asignatura}</p>
                </div>
              )}

              <div className="grid md:grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="text-gray-500 text-xs mb-1.5 block">Horizonte</label>
                  <select
                    value={config.tiempoPlanificacion}
                    onChange={e => setConfig(prev => ({ ...prev, tiempoPlanificacion: e.target.value as TiempoPlanificacion }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-2xl px-3 py-2.5 text-gray-300 text-sm focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value="diaria">Diaria</option>
                    <option value="semanal">Semanal</option>
                    <option value="mensual">Mensual</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-500 text-xs mb-1.5 block">Sesiones</label>
                  <input type="number" min={1} max={20} value={config.sesiones} onChange={e => setConfig(prev => ({ ...prev, sesiones: Number(e.target.value || 1) }))} className="w-full bg-gray-800 border border-gray-700 rounded-2xl px-3 py-2.5 text-gray-300 text-sm focus:outline-none focus:border-emerald-500/50" />
                </div>
                <div>
                  <label className="text-gray-500 text-xs mb-1.5 block">Minutos por sesión</label>
                  <input type="number" min={15} max={240} step={5} value={config.duracionMinutos} onChange={e => setConfig(prev => ({ ...prev, duracionMinutos: Number(e.target.value || 45) }))} className="w-full bg-gray-800 border border-gray-700 rounded-2xl px-3 py-2.5 text-gray-300 text-sm focus:outline-none focus:border-emerald-500/50" />
                </div>
              </div>

              {!!units.length && (
                <div className="mb-4">
                  <label className="text-gray-500 text-xs mb-2 block">Unidad según bases curriculares</label>
                  <div className="space-y-2">
                    {units.map(unit => (
                      <button
                        key={unit.id}
                        onClick={() => setConfig(prev => ({ ...prev, unidadId: unit.id, selectedOAIds: [] }))}
                        className={`w-full text-left rounded-2xl border p-3 transition-all ${config.unidadId === unit.id ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200" : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600"}`}
                      >
                        <div className="text-sm font-medium">{unit.label}</div>
                        <div className="text-xs text-gray-500 mt-1">OA asociados: {unit.oaIds.join(", ")}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-gray-500 text-xs block">OA seleccionables</label>
                  <span className="text-[11px] text-emerald-300">Se pueden elegir varios OA</span>
                </div>
                <div className="grid md:grid-cols-2 gap-2 max-h-[340px] overflow-y-auto pr-1">
                  {oaOptions.length ? oaOptions.map(oa => (
                    <button
                      key={oa.id}
                      onClick={() => toggleOA(oa.id)}
                      className={`text-left rounded-2xl border p-3 transition-all ${config.selectedOAIds.includes(oa.id) ? "bg-emerald-500/10 border-emerald-500/40" : "bg-gray-800 border-gray-700 hover:border-gray-600"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-white">{oa.id}</div>
                          <p className="text-xs text-gray-300 leading-relaxed mt-1">{oa.texto}</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] ${config.selectedOAIds.includes(oa.id) ? "border-emerald-400 text-emerald-300" : "border-gray-600 text-gray-500"}`}>{config.selectedOAIds.includes(oa.id) ? "✓" : ""}</div>
                      </div>
                      {!!oa.ejes?.length && <p className="text-[11px] text-gray-500 mt-2">Eje: {oa.ejes.join(", ")}</p>}
                    </button>
                  )) : (
                    <div className="md:col-span-2 rounded-2xl border border-dashed border-gray-700 p-4 text-sm text-gray-500">No hay OA locales cargados para esta combinación todavía. El agente puede seguir orientando, pero conviene ampliar la base curricular.</div>
                  )}
                </div>
              </div>

              {config.nivel === "parvularia" && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-gray-500 text-xs block">OA transversales / foco transversal</label>
                    <span className="text-[11px] text-emerald-300">Se integran junto al núcleo</span>
                  </div>
                  <div className="space-y-2">
                    {parvulariaOAT.map(item => (
                      <button key={item.id} onClick={() => toggleOAT(item.id)} className={`w-full text-left rounded-2xl border p-3 transition-all ${config.selectedOATIds.includes(item.id) ? "bg-teal-500/10 border-teal-500/40" : "bg-gray-800 border-gray-700 hover:border-gray-600"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-white">{item.id}</div>
                            <p className="text-xs text-gray-300 leading-relaxed mt-1">{item.label}</p>
                          </div>
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] ${config.selectedOATIds.includes(item.id) ? "border-teal-300 text-teal-300" : "border-gray-600 text-gray-500"}`}>{config.selectedOATIds.includes(item.id) ? "✓" : ""}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-gray-500 text-xs mb-1.5 block">Contexto adicional</label>
                <textarea
                  value={config.contexto}
                  onChange={e => setConfig(prev => ({ ...prev, contexto: e.target.value }))}
                  placeholder="Ej: curso con 36 estudiantes, 3 con NEE, énfasis PAES, trabajo cooperativo, contexto rural o urbano..."
                  className="w-full min-h-[96px] bg-gray-800 border border-gray-700 rounded-2xl px-3 py-2.5 text-gray-300 text-sm focus:outline-none focus:border-emerald-500/50 placeholder-gray-600"
                />
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-3xl p-5">
              <h2 className="text-white font-medium text-sm mb-4">🧭 Resumen de planificación</h2>
              <div className="space-y-3 text-sm">
                <div className="rounded-2xl bg-gray-800/80 border border-gray-700 p-4">
                  <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Contexto activo</p>
                  <p className="text-white leading-relaxed text-justify">{config.curso} · {config.asignatura} · {planningBadge}</p>
                  {config.nivel === "parvularia" && <p className="text-emerald-300 text-xs mt-2 text-justify">Ámbito: {ambito} · Núcleo: {config.asignatura}</p>}
                </div>
                <div className="rounded-2xl bg-gray-800/80 border border-gray-700 p-4">
                  <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Selección curricular</p>
                  <div className="space-y-2 text-justify">
                    <p className="text-gray-300 text-sm">Unidad: <span className="text-white">{units.find(u => u.id === config.unidadId)?.label || "Sin unidad local"}</span></p>
                    <p className="text-gray-300 text-sm">OA elegidos: <span className="text-white">{config.selectedOAIds.length ? config.selectedOAIds.join(", ") : "Aún no seleccionados"}</span></p>
                    {config.nivel === "parvularia" && <p className="text-gray-300 text-sm">Foco transversal: <span className="text-white">{config.selectedOATIds.length ? config.selectedOATIds.join(", ") : "Sin foco transversal seleccionado"}</span></p>}
                  </div>
                </div>
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-justify">
                  <p className="text-emerald-300 text-xs uppercase tracking-wide mb-2">Sugerencia de uso</p>
                  <p className="text-gray-300 text-sm">Primero selecciona una unidad, luego marca varios OA. Después pide una planificación diaria, semanal o mensual. El agente organizará actividades, evaluación, adaptaciones y secuencia didáctica con mayor precisión.</p>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {QUICK_PROMPTS.map(qp => (
                    <button key={qp.label} onClick={() => sendMessage(qp.prompt)} className="bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-emerald-500/30 rounded-2xl p-3 text-left transition-all group">
                      <div className="text-lg mb-1">{qp.icon}</div>
                      <div className="text-gray-300 text-xs group-hover:text-white">{qp.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {showWelcome && !configOpen && (
          <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 rounded-3xl p-6 text-center">
            <div className="text-4xl mb-3">🏫</div>
            <h2 className="text-white font-semibold text-lg mb-1">APl — Planificador curricular inteligente</h2>
            <p className="text-gray-400 text-sm mb-2">OA por unidad, selección múltiple, horizonte diario/semanal/mensual y mejor soporte para parvularia.</p>
            <p className="text-emerald-300 text-xs">{config.curso} · {config.asignatura} · {planningBadge}</p>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-sm mr-2 mt-1 flex-shrink-0">🏫</div>}
              <div className={`max-w-[90%] rounded-3xl px-4 py-3 ${msg.role === "user" ? "bg-emerald-600 text-white" : "bg-gray-900 border border-gray-800 text-gray-200"}`}>
                {msg.role === "assistant" ? (
                  <>
                    <div className="prose prose-invert prose-sm max-w-none text-justify [&_h1]:text-emerald-300 [&_h1]:text-base [&_h2]:text-emerald-300 [&_h2]:text-sm [&_h3]:text-teal-300 [&_strong]:text-white [&_p]:leading-relaxed [&_p]:text-gray-300 [&_ul]:text-gray-300 [&_ol]:text-gray-300 [&_li]:mb-1 [&_table]:w-full [&_th]:bg-emerald-900/40 [&_th]:text-emerald-300 [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-xs [&_th]:border [&_th]:border-gray-700 [&_td]:px-3 [&_td]:py-1.5 [&_td]:text-gray-300 [&_td]:text-xs [&_td]:border [&_td]:border-gray-800 [&_blockquote]:border-l-2 [&_blockquote]:border-emerald-500 [&_blockquote]:pl-3 [&_blockquote]:text-gray-400 [&_blockquote]:italic">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                    {msg.provider && <p className="text-gray-700 text-xs mt-2 pt-2 border-t border-gray-800">via {msg.provider}</p>}
                  </>
                ) : (
                  <p className="text-sm text-justify">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-sm mr-2 mt-1 flex-shrink-0">🏫</div>
              <div className="bg-gray-900 border border-gray-800 rounded-3xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span className="text-gray-600 text-xs">APl organizando OA, tiempos y secuencia didáctica...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="sticky bottom-0 bg-gray-950/90 backdrop-blur-sm border-t border-gray-800 px-4 py-3">
        <div className="max-w-6xl mx-auto">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage(input))}
              placeholder={`Pide una planificación ${config.tiempoPlanificacion} para ${config.curso} · ${config.asignatura}...`}
              className="flex-1 min-h-[60px] max-h-40 bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3 text-gray-200 placeholder-gray-600 text-sm focus:outline-none focus:border-emerald-500/50"
            />
            <button onClick={() => sendMessage(input)} disabled={!input.trim() || loading} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white px-5 py-3 rounded-2xl transition-colors self-end">→</button>
          </div>
          <p className="text-gray-700 text-xs mt-1.5 text-center">APl · Bases Curriculares MINEDUC · UI con OA múltiples, unidad y horizonte temporal</p>
        </div>
      </div>
    </div>
  )
}
