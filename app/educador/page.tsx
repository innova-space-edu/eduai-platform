"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useRouter } from "next/navigation"
import {
  buildPlanningHorizonText,
  getPlannerOAOptions,
  getPlannerSummary,
  getPlannerUnits,
  type TiempoPlanificacion,
} from "@/lib/planificador-curriculum"
import {
  getAvailableAsignaturas,
  getParvulariaAmbitoForCurso,
  getParvulariaOATForCurso,
  hasLocalCurriculumForAsignatura,
  type NivelKey,
} from "@/lib/mineduc-oa"

const NIVELES = [
  {
    id: "parvularia",
    label: "🌸 Parvularia",
    sub: "Sala cuna · nivel medio · transición",
  },
  {
    id: "basica",
    label: "📚 Básica",
    sub: "1° a 8° Básico · OA por unidad",
  },
  {
    id: "media",
    label: "🎓 Media",
    sub: "1° a 4° Medio · OA por unidad o módulo",
  },
] as const

const CURSOS: Record<NivelKey, string[]> = {
  parvularia: [
    "Sala Cuna Menor (0 a 1 año)",
    "Sala Cuna Mayor (1 a 2 años)",
    "Medio Menor (2 a 3 años)",
    "Medio Mayor (3 a 4 años)",
    "NT1 - Pre Kinder (4-5 años)",
    "NT2 - Kinder (5-6 años)",
  ],
  basica: [
    "1° Básico",
    "2° Básico",
    "3° Básico",
    "4° Básico",
    "5° Básico",
    "6° Básico",
    "7° Básico",
    "8° Básico",
  ],
  media: ["1° Medio", "2° Medio", "3° Medio", "4° Medio"],
}

const QUICK_PROMPTS = [
  {
    icon: "📋",
    label: "Planificación completa",
    prompt: "Crea una planificación completa alineada a los OA seleccionados.",
  },
  {
    icon: "🧠",
    label: "Secuencia por tiempo",
    prompt: "Distribuye actividades según el tiempo de planificación elegido.",
  },
  {
    icon: "📊",
    label: "Evaluación",
    prompt: "Crea instrumentos de evaluación para los OA seleccionados.",
  },
  {
    icon: "♿",
    label: "Adaptación NEE",
    prompt: "Adapta la planificación para diversidad y NEE.",
  },
  {
    icon: "🌸",
    label: "Parvularia",
    prompt: "Diseña una experiencia de aprendizaje lúdica y contextualizada para educación parvularia.",
  },
  {
    icon: "🧩",
    label: "Interdisciplinario",
    prompt: "Integra habilidades transversales y trabajo interdisciplinario.",
  },
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

interface AsignaturaOption {
  name: string
  hasLocal: boolean
}

function getInitialAsignatura(nivel: NivelKey, curso: string) {
  const available = getAvailableAsignaturas(nivel, curso)
  return available[0] || ""
}

export default function EducadorPage() {
  const router = useRouter()
  const bottomRef = useRef<HTMLDivElement>(null)

  const [config, setConfig] = useState<Config>({
    nivel: "parvularia",
    curso: "Sala Cuna Menor (0 a 1 año)",
    asignatura: getInitialAsignatura("parvularia", "Sala Cuna Menor (0 a 1 año)"),
    contexto: "",
    mes: new Date().toLocaleString("es-CL", { month: "long" }).toLowerCase(),
    unidadId: "",
    selectedOAIds: [],
    selectedOATIds: [],
    tiempoPlanificacion: "diaria",
    sesiones: 1,
    duracionMinutos: 30,
  })

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [configOpen, setConfigOpen] = useState(true)
  const [showWelcome, setShowWelcome] = useState(true)
  const [openOAT, setOpenOAT] = useState(false)
  const [openOA, setOpenOA] = useState(false)

  const curriculumState = useMemo(
    () => ({
      nivel: config.nivel,
      curso: config.curso,
      asignatura: config.asignatura,
    }),
    [config.nivel, config.curso, config.asignatura]
  )

  const availableAsignaturas = useMemo<AsignaturaOption[]>(() => {
    return getAvailableAsignaturas(config.nivel, config.curso).map((name) => ({
      name,
      hasLocal: hasLocalCurriculumForAsignatura(config.nivel, config.curso, name),
    }))
  }, [config.nivel, config.curso])

  const currentAsignaturaHasLocal = useMemo(
    () =>
      hasLocalCurriculumForAsignatura(
        config.nivel,
        config.curso,
        config.asignatura
      ),
    [config.nivel, config.curso, config.asignatura]
  )

  const units = useMemo(
    () => getPlannerUnits(curriculumState),
    [curriculumState]
  )

  const oaOptions = useMemo(
    () => getPlannerOAOptions(curriculumState, config.unidadId || undefined),
    [curriculumState, config.unidadId]
  )

  const summary = useMemo(
    () => getPlannerSummary(curriculumState),
    [curriculumState]
  )

  const parvulariaOAT = useMemo(
    () =>
      config.nivel === "parvularia"
        ? getParvulariaOATForCurso(config.curso, config.asignatura)
        : [],
    [config.nivel, config.curso, config.asignatura]
  )

  const ambito = useMemo(
    () =>
      config.nivel === "parvularia"
        ? getParvulariaAmbitoForCurso(config.curso, config.asignatura)
        : "",
    [config.nivel, config.curso, config.asignatura]
  )

  const currentMes = new Date().toLocaleString("es-CL", {
    month: "long",
    year: "numeric",
  })

  const planningBadge = `${config.tiempoPlanificacion} · ${config.sesiones} ses. · ${config.duracionMinutos} min`
  const selectedUnit = units.find((u) => u.id === config.unidadId)
  const selectedOAObjects = oaOptions.filter((oa) => config.selectedOAIds.includes(oa.id))
  const horizonText = buildPlanningHorizonText(
    config.tiempoPlanificacion,
    config.sesiones,
    config.duracionMinutos
  )

  // Forzar scroll arriba al cargar la página
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // Scroll al fondo solo cuando hay mensajes activos en el chat
  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, loading])

  useEffect(() => {
    setConfig((prev) => {
      const cursos = CURSOS[prev.nivel]
      const nextCurso = cursos.includes(prev.curso) ? prev.curso : cursos[0]
      const nextAsignaturas = getAvailableAsignaturas(prev.nivel, nextCurso)
      const nextAsignatura = nextAsignaturas.includes(prev.asignatura)
        ? prev.asignatura
        : nextAsignaturas[0] || ""

      return {
        ...prev,
        curso: nextCurso,
        asignatura: nextAsignatura,
      }
    })
  }, [config.nivel])

  useEffect(() => {
    setConfig((prev) => {
      const nextAsignaturas = getAvailableAsignaturas(prev.nivel, prev.curso)
      const nextAsignatura = nextAsignaturas.includes(prev.asignatura)
        ? prev.asignatura
        : nextAsignaturas[0] || ""

      if (nextAsignatura === prev.asignatura) return prev

      return {
        ...prev,
        asignatura: nextAsignatura,
        unidadId: "",
        selectedOAIds: [],
        selectedOATIds: [],
      }
    })
  }, [config.nivel, config.curso])

  useEffect(() => {
    setConfig((prev) => {
      const nextUnits = getPlannerUnits({
        nivel: prev.nivel,
        curso: prev.curso,
        asignatura: prev.asignatura,
      })

      const nextUnitId =
        nextUnits.find((u) => u.id === prev.unidadId)?.id ||
        nextUnits[0]?.id ||
        ""

      const nextOAOptions = getPlannerOAOptions(
        {
          nivel: prev.nivel,
          curso: prev.curso,
          asignatura: prev.asignatura,
        },
        nextUnitId || undefined
      )

      const allowedOAIds = new Set(nextOAOptions.map((oa) => oa.id))
      const selectedOAIds = prev.selectedOAIds.filter((id) => allowedOAIds.has(id))

      const nextOAT =
        prev.nivel === "parvularia"
          ? getParvulariaOATForCurso(prev.curso, prev.asignatura)
          : []

      const allowedOATIds = new Set(nextOAT.map((item) => item.id))
      const selectedOATIds = prev.selectedOATIds.filter((id) => allowedOATIds.has(id))

      return {
        ...prev,
        unidadId: nextUnitId,
        selectedOAIds,
        selectedOATIds,
      }
    })
  }, [config.nivel, config.curso, config.asignatura])

  function toggleOA(id: string) {
    setConfig((prev) => {
      const exists = prev.selectedOAIds.includes(id)
      if (exists) {
        return {
          ...prev,
          selectedOAIds: prev.selectedOAIds.filter((x) => x !== id),
        }
      }

      const maxOA = prev.nivel === "parvularia" ? 3 : 10
      if (prev.selectedOAIds.length >= maxOA) return prev

      return {
        ...prev,
        selectedOAIds: [...prev.selectedOAIds, id],
      }
    })
  }

  function toggleOAT(id: string) {
    setConfig((prev) => {
      const exists = prev.selectedOATIds.includes(id)
      if (exists) {
        return {
          ...prev,
          selectedOATIds: prev.selectedOATIds.filter((x) => x !== id),
        }
      }

      const maxOAT = prev.nivel === "parvularia" ? 2 : 10
      if (prev.selectedOATIds.length >= maxOAT) return prev

      return {
        ...prev,
        selectedOATIds: [...prev.selectedOATIds, id],
      }
    })
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return

    setInput("")
    setShowWelcome(false)
    setConfigOpen(false)

    const userMsg: Message = { role: "user", content: text }
    setMessages((prev) => [...prev, userMsg])
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

      if (!res.ok) {
        throw new Error("Error al llamar al agente educador")
      }

      const data = await res.json()

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.text,
          provider: data.provider,
        },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Hubo un error al generar la planificación. Revisa la configuración curricular y vuelve a intentarlo.",
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-all text-sm"
            >
              ←
            </button>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-lg shadow-lg shadow-emerald-950/40">
              🏫
            </div>
            <div>
              <h1 className="text-white font-semibold text-sm">
                APl — Agente Planificador
              </h1>
              <p className="text-gray-500 text-xs">
                MINEDUC · OA reales · parvularia completa · {currentMes}
              </p>
            </div>
          </div>

          <button
            onClick={() => setConfigOpen((prev) => !prev)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
              configOpen
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
            }`}
          >
            ⚙️ {config.curso} · {config.asignatura}
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col px-4 py-4 gap-4">
        {configOpen && (
          <div className="grid xl:grid-cols-[1.2fr_0.8fr] gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-3xl p-5">
              <h2 className="text-white font-medium text-sm mb-4">
                📐 Configurar contexto pedagógico
              </h2>

              <div className="mb-4">
                <label className="text-gray-500 text-xs mb-2 block">
                  Nivel educativo
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {NIVELES.map((n) => (
                    <button
                      key={n.id}
                      onClick={() =>
                        setConfig((prev) => {
                          const nextNivel = n.id as NivelKey
                          const nextCurso = CURSOS[nextNivel][0]
                          const nextAsignatura = getInitialAsignatura(nextNivel, nextCurso)

                          return {
                            ...prev,
                            nivel: nextNivel,
                            curso: nextCurso,
                            asignatura: nextAsignatura,
                            unidadId: "",
                            selectedOAIds: [],
                            selectedOATIds: [],
                          }
                        })
                      }
                      className={`p-3 rounded-2xl border text-left transition-all ${
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

              <div className="grid md:grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-gray-500 text-xs mb-1.5 block">Curso / subnivel</label>
                  <select
                    value={config.curso}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        curso: e.target.value,
                        selectedOAIds: [],
                        selectedOATIds: [],
                        unidadId: "",
                      }))
                    }
                    className="w-full bg-gray-800 border border-gray-700 rounded-2xl px-3 py-2.5 text-gray-300 text-sm focus:outline-none focus:border-emerald-500/50"
                  >
                    {CURSOS[config.nivel].map((curso) => (
                      <option key={curso}>{curso}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-gray-500 text-xs mb-1.5 block">
                    {config.nivel === "parvularia" ? "Núcleo de aprendizaje" : "Asignatura"}
                  </label>
                  <select
                    value={config.asignatura}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        asignatura: e.target.value,
                        selectedOAIds: [],
                        selectedOATIds: [],
                        unidadId: "",
                      }))
                    }
                    className="w-full bg-gray-800 border border-gray-700 rounded-2xl px-3 py-2.5 text-gray-300 text-sm focus:outline-none focus:border-emerald-500/50"
                  >
                    {availableAsignaturas.map((asignatura) => (
                      <option key={asignatura.name} value={asignatura.name}>
                        {asignatura.hasLocal ? "✅" : "🟡"} {asignatura.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-4 rounded-2xl border border-gray-800 bg-gray-800/40 p-4">
                <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">
                  Estado curricular de la selección
                </p>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span
                    className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${
                      currentAsignaturaHasLocal
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                    }`}
                  >
                    <span>{currentAsignaturaHasLocal ? "✅" : "🟡"}</span>
                    {currentAsignaturaHasLocal
                      ? "Base curricular local cargada"
                      : "Solo catálogo/meta por ahora"}
                  </span>
                  {config.nivel === "parvularia" && (
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-teal-500/30 bg-teal-500/10 text-teal-300">
                      👶 {config.curso}
                    </span>
                  )}
                </div>
              </div>

              {config.nivel === "parvularia" && (
                <div className="mb-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <p className="text-[11px] uppercase tracking-wide text-emerald-300 mb-1">
                    Ámbito y núcleo
                  </p>
                  <p className="text-white text-sm font-medium">
                    {ambito || "Ámbito no detectado todavía"}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    Núcleo activo: {config.asignatura}
                  </p>
                </div>
              )}

              <div className="grid md:grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="text-gray-500 text-xs mb-1.5 block">Horizonte</label>
                  <select
                    value={config.tiempoPlanificacion}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        tiempoPlanificacion: e.target.value as TiempoPlanificacion,
                      }))
                    }
                    className="w-full bg-gray-800 border border-gray-700 rounded-2xl px-3 py-2.5 text-gray-300 text-sm focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value="diaria">Diaria</option>
                    <option value="semanal">Semanal</option>
                    <option value="mensual">Mensual</option>
                  </select>
                </div>

                <div>
                  <label className="text-gray-500 text-xs mb-1.5 block">Sesiones</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={config.sesiones}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        sesiones: Number(e.target.value || 1),
                      }))
                    }
                    className="w-full bg-gray-800 border border-gray-700 rounded-2xl px-3 py-2.5 text-gray-300 text-sm focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                <div>
                  <label className="text-gray-500 text-xs mb-1.5 block">
                    Minutos por sesión
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={240}
                    step={5}
                    value={config.duracionMinutos}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        duracionMinutos: Number(e.target.value || 45),
                      }))
                    }
                    className="w-full bg-gray-800 border border-gray-700 rounded-2xl px-3 py-2.5 text-gray-300 text-sm focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>

              {!!units.length && (
                <div className="mb-4">
                  <label className="text-gray-500 text-xs mb-2 block">
                    {config.asignatura === "Ciencias para la Ciudadanía"
                      ? "Módulo según base curricular"
                      : config.nivel === "parvularia"
                        ? "Bloque curricular detectado"
                        : "Unidad según bases curriculares"}
                  </label>

                  <div className="space-y-2">
                    {units.map((unit) => (
                      <button
                        key={unit.id}
                        onClick={() =>
                          setConfig((prev) => ({
                            ...prev,
                            unidadId: unit.id,
                            selectedOAIds: [],
                          }))
                        }
                        className={`w-full text-left rounded-2xl border p-3 transition-all ${
                          config.unidadId === unit.id
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                            : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600"
                        }`}
                      >
                        <div className="text-sm font-medium">{unit.label}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          OA asociados: {unit.oaIds.join(", ")}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-4">
                <button
                  onClick={() => setOpenOA((prev) => !prev)}
                  className="w-full flex items-center justify-between rounded-2xl border border-gray-700 bg-gray-800 hover:border-emerald-500/40 px-4 py-3 transition-all group"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-300 text-sm font-medium">OA seleccionables</span>
                    {config.selectedOAIds.length > 0 && (
                      <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-300 font-medium">
                        {config.selectedOAIds.length} seleccionado{config.selectedOAIds.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <span className={`text-gray-500 text-sm transition-transform duration-200 ${openOA ? "rotate-180" : ""}`}>
                    ▾
                  </span>
                </button>

                {openOA && (
                  <div className="mt-2">
                    <p className="text-[11px] text-emerald-300 px-1 mb-2">
                      {config.nivel === "parvularia"
                        ? "Hasta 3 OA integrados de distintos núcleos o ámbitos"
                        : "Se pueden elegir varios OA"}
                    </p>
                    <div className="grid md:grid-cols-2 gap-2 max-h-[360px] overflow-y-auto pr-1">
                      {oaOptions.length ? (
                        oaOptions.map((oa) => {
                          const isSelected = config.selectedOAIds.includes(oa.id)

                          return (
                            <button
                              key={oa.id}
                              onClick={() => toggleOA(oa.id)}
                              className={`text-left rounded-2xl border p-3 transition-all ${
                                isSelected
                                  ? "bg-emerald-500/10 border-emerald-500/40"
                                  : "bg-gray-800 border-gray-700 hover:border-gray-600"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold text-white">
                                    {oa.codigoOficial || oa.id}
                                  </div>
                                  <p className="text-xs text-gray-300 leading-relaxed mt-1 text-justify">
                                    {oa.texto}
                                  </p>
                                </div>

                                <div
                                  className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] ${
                                    isSelected
                                      ? "border-emerald-400 text-emerald-300"
                                      : "border-gray-600 text-gray-500"
                                  }`}
                                >
                                  {isSelected ? "✓" : ""}
                                </div>
                              </div>

                              {!!oa.unidadNombre && (
                                <p className="text-[11px] text-gray-500 mt-2">
                                  Unidad/Módulo: {oa.unidadNombre}
                                </p>
                              )}

                              {!!oa.ambito && !!oa.nucleo && (
                                <div className="mt-2">
                                  <span className="rounded-full border border-green-500/30 bg-green-500/15 px-3 py-1 text-[11px] font-medium text-green-300">
                                    {oa.ambito} · {oa.nucleo}
                                  </span>
                                </div>
                              )}
                            </button>
                          )
                        })
                      ) : (
                        <div className="md:col-span-2 rounded-2xl border border-dashed border-gray-700 p-4 text-sm text-gray-500">
                          No hay OA locales cargados para esta combinación todavía.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {config.nivel === "parvularia" && (
                <div className="mb-4">
                  <button
                    onClick={() => setOpenOAT((prev) => !prev)}
                    className="w-full flex items-center justify-between rounded-2xl border border-gray-700 bg-gray-800 hover:border-teal-500/40 px-4 py-3 transition-all group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-teal-300 text-sm font-medium">OAT / foco transversal</span>
                      {config.selectedOATIds.length > 0 && (
                        <span className="rounded-full bg-teal-500/20 border border-teal-500/30 px-2 py-0.5 text-[10px] text-teal-300 font-medium">
                          {config.selectedOATIds.length} seleccionado{config.selectedOATIds.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <span className={`text-gray-500 text-sm transition-transform duration-200 ${openOAT ? "rotate-180" : ""}`}>
                      ▾
                    </span>
                  </button>

                  {openOAT && (
                    <div className="mt-2 space-y-2">
                      <p className="text-[11px] text-emerald-300 px-1">
                        Se pueden combinar con otros núcleos y ámbitos (máx. 2)
                      </p>
                      {parvulariaOAT.length ? (
                        parvulariaOAT.map((item) => {
                          const isSelected = config.selectedOATIds.includes(item.id)

                          return (
                            <button
                              key={item.id}
                              onClick={() => toggleOAT(item.id)}
                              className={`w-full text-left rounded-2xl border p-3 transition-all ${
                                isSelected
                                  ? "bg-teal-500/10 border-teal-500/40"
                                  : "bg-gray-800 border-gray-700 hover:border-gray-600"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold text-white">
                                    {item.description || item.id}
                                  </div>
                                  <p className="text-xs text-gray-300 leading-relaxed mt-1 text-justify">
                                    {item.label}
                                  </p>
                                </div>

                                <div
                                  className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] ${
                                    isSelected
                                      ? "border-teal-300 text-teal-300"
                                      : "border-gray-600 text-gray-500"
                                  }`}
                                >
                                  {isSelected ? "✓" : ""}
                                </div>
                              </div>

                              {!!item.ambito && !!item.nucleo && (
                                <div className="mt-2">
                                  <span className="rounded-full border border-green-500/30 bg-green-500/15 px-3 py-1 text-[11px] font-medium text-green-300">
                                    {item.ambito} · {item.nucleo}
                                  </span>
                                </div>
                              )}
                            </button>
                          )
                        })
                      ) : (
                        <div className="rounded-2xl border border-dashed border-gray-700 p-4 text-sm text-gray-500">
                          No hay OAT cargados para este núcleo o subnivel todavía.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-gray-500 text-xs mb-1.5 block">
                  Contexto adicional
                </label>
                <textarea
                  value={config.contexto}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      contexto: e.target.value,
                    }))
                  }
                  placeholder="Ej: grupo pequeño, lactantes, nivel heterogéneo, rutinas de apego, juego heurístico, deambuladores, control de esfínter, transición al jardín, etc."
                  className="w-full min-h-[96px] bg-gray-800 border border-gray-700 rounded-2xl px-3 py-2.5 text-gray-300 text-sm focus:outline-none focus:border-emerald-500/50 placeholder-gray-600"
                />
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-3xl p-5">
              <h2 className="text-white font-medium text-sm mb-4">
                🧭 Resumen de planificación
              </h2>

              <div className="space-y-3 text-sm">
                <div className="rounded-2xl bg-gray-800/80 border border-gray-700 p-4">
                  <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">
                    Contexto activo
                  </p>
                  <p className="text-white leading-relaxed text-justify">
                    {config.curso} · {config.asignatura} · {planningBadge}
                  </p>

                  {config.nivel === "parvularia" && (
                    <p className="text-emerald-300 text-xs mt-2 text-justify">
                      Ámbito: {ambito || "No detectado"} · Núcleo: {config.asignatura}
                    </p>
                  )}
                </div>

                <div className="rounded-2xl bg-gray-800/80 border border-gray-700 p-4">
                  <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">
                    Cobertura curricular local
                  </p>

                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    <div className="rounded-xl bg-gray-900/70 border border-gray-700 p-3">
                      <div className="text-white text-base font-semibold">{summary.units}</div>
                      <div className="text-[11px] text-gray-500">
                        {config.asignatura === "Ciencias para la Ciudadanía"
                          ? "Módulos"
                          : config.nivel === "parvularia"
                            ? "Bloques"
                            : "Unidades"}
                      </div>
                    </div>
                    <div className="rounded-xl bg-gray-900/70 border border-gray-700 p-3">
                      <div className="text-white text-base font-semibold">{summary.oas}</div>
                      <div className="text-[11px] text-gray-500">OA cargados</div>
                    </div>
                    <div className="rounded-xl bg-gray-900/70 border border-gray-700 p-3">
                      <div
                        className={`text-base font-semibold ${
                          summary.hasCurriculum ? "text-emerald-300" : "text-amber-300"
                        }`}
                      >
                        {summary.hasCurriculum ? "Sí" : "Parcial"}
                      </div>
                      <div className="text-[11px] text-gray-500">Base local</div>
                    </div>
                  </div>

                  <p className="text-gray-300 text-sm text-justify">
                    {horizonText}
                  </p>
                </div>

                <div className="rounded-2xl bg-gray-800/80 border border-gray-700 p-4">
                  <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">
                    Selección curricular
                  </p>

                  <div className="space-y-2 text-justify">
                    <p className="text-gray-300 text-sm">
                      Estado de selección:{" "}
                      <span
                        className={
                          currentAsignaturaHasLocal ? "text-emerald-300" : "text-amber-300"
                        }
                      >
                        {currentAsignaturaHasLocal
                          ? "Base curricular local disponible"
                          : "Solo catálogo/meta"}
                      </span>
                    </p>

                    <p className="text-gray-300 text-sm">
                      {config.asignatura === "Ciencias para la Ciudadanía"
                        ? "Módulo"
                        : config.nivel === "parvularia"
                          ? "Bloque"
                          : "Unidad"}:{" "}
                      <span className="text-white">
                        {selectedUnit?.label || "Sin bloque/unidad local"}
                      </span>
                    </p>

                    <p className="text-gray-300 text-sm">
                      OA elegidos:{" "}
                      <span className="text-white">
                        {selectedOAObjects.length
                          ? selectedOAObjects.map((oa) => oa.codigoOficial || oa.id).join(", ")
                          : "Aún no seleccionados"}
                      </span>
                    </p>

                    {selectedOAObjects.some((oa) => oa.ambito && oa.nucleo) && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {[...new Set(selectedOAObjects.filter((oa) => oa.ambito && oa.nucleo).map((oa) => `${oa.ambito} · ${oa.nucleo}`))].map((label) => (
                          <span key={label} className="rounded-full border border-green-500/30 bg-green-500/15 px-3 py-1 text-[11px] font-medium text-green-300">
                            {label}
                          </span>
                        ))}
                      </div>
                    )}

                    {config.nivel === "parvularia" && (
                      <p className="text-gray-300 text-sm">
                        OAT elegidos:{" "}
                        <span className="text-white">
                          {config.selectedOATIds.length
                            ? config.selectedOATIds.join(", ")
                            : "Sin OAT seleccionado"}
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-justify">
                  <p className="text-emerald-300 text-xs uppercase tracking-wide mb-2">
                    Sugerencia de uso
                  </p>
                  <p className="text-gray-300 text-sm">
                    En Parvularia, selecciona primero el subnivel. Luego puedes combinar hasta 3 OA
                    de distintos núcleos o ámbitos y sumar hasta 2 OAT transversales. Así la planificación
                    queda integrada y mucho más realista para educación parvularia.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  {QUICK_PROMPTS.map((qp) => (
                    <button
                      key={qp.label}
                      onClick={() => sendMessage(qp.prompt)}
                      className="bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-emerald-500/30 rounded-2xl p-3 text-left transition-all group"
                    >
                      <div className="text-lg mb-1">{qp.icon}</div>
                      <div className="text-gray-300 text-xs group-hover:text-white">
                        {qp.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {showWelcome && !configOpen && (
          <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 rounded-3xl p-6 text-center">
            <div className="text-4xl mb-3">🌸</div>
            <h2 className="text-white font-semibold text-lg mb-1">
              APl — Planificador curricular inteligente
            </h2>
            <p className="text-gray-400 text-sm mb-2">
              Parvularia completa: sala cuna, nivel medio y transición, con ámbitos, núcleos, OA y OAT.
            </p>
            <p className="text-emerald-300 text-xs">
              {config.curso} · {config.asignatura} · {planningBadge}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {messages.map((msg, i) => (
            <div
              key={`${msg.role}-${i}`}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-sm mr-2 mt-1 flex-shrink-0">
                  🌸
                </div>
              )}

              <div
                className={`max-w-[90%] rounded-3xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-900 border border-gray-800 text-gray-200"
                }`}
              >
                {msg.role === "assistant" ? (
                  <>
                    <div className="prose prose-invert prose-sm max-w-none text-justify [&_h1]:text-emerald-300 [&_h1]:text-base [&_h2]:text-emerald-300 [&_h2]:text-sm [&_h3]:text-teal-300 [&_strong]:text-white [&_p]:leading-relaxed [&_p]:text-gray-300 [&_ul]:text-gray-300 [&_ol]:text-gray-300 [&_li]:mb-1 [&_table]:w-full [&_th]:bg-emerald-900/40 [&_th]:text-emerald-300 [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-xs [&_th]:border [&_th]:border-gray-700 [&_td]:px-3 [&_td]:py-1.5 [&_td]:text-gray-300 [&_td]:text-xs [&_td]:border [&_td]:border-gray-800 [&_blockquote]:border-l-2 [&_blockquote]:border-emerald-500 [&_blockquote]:pl-3 [&_blockquote]:text-gray-400 [&_blockquote]:italic">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>

                    {msg.provider && (
                      <p className="text-gray-700 text-xs mt-2 pt-2 border-t border-gray-800">
                        via {msg.provider}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-justify">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-sm mr-2 mt-1 flex-shrink-0">
                🌸
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-3xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>

                  <span className="text-gray-600 text-xs">
                    APl organizando OA, OAT, tiempos y experiencias pedagógicas...
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="sticky bottom-0 bg-gray-950/90 backdrop-blur-sm border-t border-gray-800 px-4 py-3">
        <div className="max-w-7xl mx-auto">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage(input)
                }
              }}
              placeholder={`Pide una planificación ${config.tiempoPlanificacion} para ${config.curso} · ${config.asignatura}...`}
              className="flex-1 min-h-[60px] max-h-40 bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3 text-gray-200 placeholder-gray-600 text-sm focus:outline-none focus:border-emerald-500/50"
            />

            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white px-5 py-3 rounded-2xl transition-colors self-end"
            >
              →
            </button>
          </div>

          <p className="text-gray-700 text-xs mt-1.5 text-center">
            APl · Parvularia completa · OA múltiples · OAT · ámbitos y núcleos · horizonte temporal
          </p>
        </div>
      </div>
    </div>
  )
}
