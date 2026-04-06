"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { exportPlanningPdf } from "@/lib/planning-pdf"
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

interface SavedPlanningInsert {
  user_id: string
  title: string
  // formato antiguo
  course: string
  subject: string
  unit: string
  planning_text: string
  planning_json: Record<string, unknown>
  // formato nuevo
  nivel: string
  curso: string
  asignatura: string
  contexto: string
  mes: string
  unidad_id: string
  selected_oa_ids: string[]
  selected_oat_ids: string[]
  tiempo_planificacion: string
  sesiones: number
  duracion_minutos: number
  content: string
}

function getInitialAsignatura(nivel: NivelKey, curso: string) {
  const available = getAvailableAsignaturas(nivel, curso)
  return available[0] || ""
}

export default function EducadorPage() {
  const router = useRouter()
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = useMemo(() => createClient(), [])

  async function forceRecoverSession() {
    try {
      await supabase.auth.signOut({ scope: "local" })
    } catch {}
    router.replace("/login?next=/educador")
  }

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
  const [currentUserId, setCurrentUserId] = useState("")
  const [saveStatus, setSaveStatus] = useState("")
  const [savingPlanning, setSavingPlanning] = useState(false)
  const [exportingPlanning, setExportingPlanning] = useState(false)

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

  const latestAssistantMessage = [...messages].reverse().find((msg) => msg.role === "assistant")

  // Forzar scroll arriba al cargar la página
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function ensureAuth() {
      const { data, error } = await supabase.auth.getUser()

      if (cancelled) return

      if (error || !data.user) {
        await forceRecoverSession()
        return
      }

      setCurrentUserId(data.user.id)
    }

    ensureAuth()

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.replace("/login?next=/educador")
      }
    })

    return () => {
      cancelled = true
      authListener.subscription.unsubscribe()
    }
  }, [router, supabase])

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

      if (res.status === 401) {
        await forceRecoverSession()
        throw new Error("Sesion expirada")
      }

      if (!res.ok) {
        const errorPayload = await res.json().catch(() => null)
        throw new Error(
          typeof errorPayload?.error === "string"
            ? errorPayload.error
            : "Error al llamar al agente educador"
        )
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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Hubo un error al generar la planificación."
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            message === "Sesion expirada"
              ? "Tu sesión expiró. Te redirigí al login para volver a entrar."
              : `Hubo un error al generar la planificación. ${message}` ,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  function buildPlanningTitle() {
    const now = new Date().toLocaleDateString("es-CL")
    return `Planificación ${config.curso} · ${config.asignatura} · ${now}`
  }

  function buildPlanningPayload(content: string): SavedPlanningInsert | null {
    if (!currentUserId || !content.trim()) return null
    return {
      user_id: currentUserId,
      title: buildPlanningTitle(),
      // compatibilidad antigua
      course: config.curso,
      subject: config.asignatura,
      unit: config.unidadId || "",
      planning_text: content,
      planning_json: {
        nivel: config.nivel,
        curso: config.curso,
        asignatura: config.asignatura,
        contexto: config.contexto,
        mes: config.mes,
        unidad_id: config.unidadId,
        selected_oa_ids: config.selectedOAIds,
        selected_oat_ids: config.selectedOATIds,
        tiempo_planificacion: config.tiempoPlanificacion,
        sesiones: config.sesiones,
        duracion_minutos: config.duracionMinutos,
        title: buildPlanningTitle(),
        content,
        created_at: new Date().toISOString(),
      },
      // formato nuevo
      nivel: config.nivel,
      curso: config.curso,
      asignatura: config.asignatura,
      contexto: config.contexto,
      mes: config.mes,
      unidad_id: config.unidadId,
      selected_oa_ids: config.selectedOAIds,
      selected_oat_ids: config.selectedOATIds,
      tiempo_planificacion: config.tiempoPlanificacion,
      sesiones: config.sesiones,
      duracion_minutos: config.duracionMinutos,
      content,
    }
  }

  async function handleSavePlanning() {
    if (!latestAssistantMessage?.content?.trim()) {
      setSaveStatus("Primero genera una planificación para guardarla.")
      return
    }
    const payload = buildPlanningPayload(latestAssistantMessage.content)
    if (!payload) {
      setSaveStatus("No se pudo preparar la planificación para guardarla.")
      return
    }
    setSavingPlanning(true)
    setSaveStatus("")
    const { data, error } = await supabase
      .from("saved_plannings")
      .insert(payload)
      .select("id, title, created_at")
      .single()
    setSavingPlanning(false)
    if (error) {
      console.error("Error al guardar planificación:", error)
      setSaveStatus(`No se pudo guardar: ${error.message}`)
      return
    }
    console.log("Planificación guardada:", data)
    setSaveStatus("Planificación guardada correctamente.")
  }

  async function handleExportPlanning() {
    if (!latestAssistantMessage?.content?.trim()) {
      setSaveStatus("Primero genera una planificación para exportarla.")
      return
    }

    setExportingPlanning(true)
    await exportPlanningPdf(
      {
        title: buildPlanningTitle(),
        subtitle: "Planificación generada desde el Agente Planificador",
        curso: config.curso,
        asignatura: config.asignatura,
        nivel: config.nivel,
        mes: config.mes,
        horizonte: config.tiempoPlanificacion,
        sesiones: config.sesiones,
        duracionMinutos: config.duracionMinutos,
        fechaCreacion: new Date().toLocaleString("es-CL"),
        contexto: config.contexto,
      },
      latestAssistantMessage.content
    )
    setExportingPlanning(false)
  }



  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/agentes")}
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

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              href="/educador/planificaciones"
              className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-200 transition-all hover:bg-cyan-500/20"
            >
              🗂️ Ver guardadas
            </Link>
            <button
              onClick={handleSavePlanning}
              disabled={!latestAssistantMessage || savingPlanning}
              className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200 transition-all hover:bg-emerald-500/20 disabled:opacity-40"
            >
              {savingPlanning ? "Guardando..." : "💾 Guardar"}
            </button>
            <button
              onClick={handleExportPlanning}
              disabled={!latestAssistantMessage || exportingPlanning}
              className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200 transition-all hover:bg-amber-500/20 disabled:opacity-40"
            >
              {exportingPlanning ? "Exportando..." : "📄 Exportar PDF"}
            </button>
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
      </div>

      <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col px-4 py-4 gap-4">
        {saveStatus && (
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
            {saveStatus}
          </div>
        )}
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
                    <div className={[
                      "prose prose-invert prose-sm max-w-none",
                      // Headings
                      "[&_h1]:text-emerald-300 [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-3 [&_h1]:mt-5 [&_h1]:pb-2 [&_h1]:border-b [&_h1]:border-emerald-500/20",
                      "[&_h2]:text-emerald-200 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:flex [&_h2]:items-center [&_h2]:gap-1",
                      "[&_h3]:text-teal-300 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mb-1.5 [&_h3]:mt-4 [&_h3]:uppercase [&_h3]:tracking-wide",
                      "[&_h4]:text-gray-300 [&_h4]:text-xs [&_h4]:font-semibold [&_h4]:mb-1 [&_h4]:mt-3",
                      // Body text
                      "[&_p]:leading-relaxed [&_p]:text-gray-300 [&_p]:text-sm [&_p]:mb-2 text-justify",
                      "[&_strong]:text-white [&_strong]:font-semibold",
                      "[&_em]:text-gray-400 [&_em]:italic",
                      // Lists
                      "[&_ul]:text-gray-300 [&_ul]:space-y-1 [&_ul]:my-2 [&_ul]:pl-4",
                      "[&_ol]:text-gray-300 [&_ol]:space-y-1 [&_ol]:my-2 [&_ol]:pl-4",
                      "[&_li]:text-sm [&_li]:leading-relaxed [&_li]:text-gray-300",
                      "[&_li_strong]:text-emerald-200",
                      // Tables
                      "[&_table]:w-full [&_table]:text-xs [&_table]:rounded-xl [&_table]:overflow-hidden [&_table]:my-3 [&_table]:border-collapse",
                      "[&_thead]:bg-emerald-900/50",
                      "[&_th]:text-emerald-300 [&_th]:font-semibold [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:border [&_th]:border-emerald-800/40",
                      "[&_td]:px-3 [&_td]:py-2 [&_td]:text-gray-300 [&_td]:border [&_td]:border-gray-800 [&_td]:align-top",
                      "[&_tr:nth-child(even)_td]:bg-gray-800/30",
                      // Blockquotes (used for notes/tips)
                      "[&_blockquote]:border-l-2 [&_blockquote]:border-teal-500/50 [&_blockquote]:pl-3 [&_blockquote]:py-1 [&_blockquote]:my-2 [&_blockquote]:bg-teal-500/5 [&_blockquote]:rounded-r-lg",
                      "[&_blockquote_p]:text-teal-200 [&_blockquote_p]:text-xs [&_blockquote_p]:italic [&_blockquote_p]:mb-0",
                      // Horizontal rules (section dividers)
                      "[&_hr]:border-gray-800 [&_hr]:my-4",
                      // Code
                      "[&_code]:bg-gray-800 [&_code]:text-emerald-300 [&_code]:px-1 [&_code]:rounded [&_code]:text-xs",
                    ].join(" ")}>
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

          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={handleSavePlanning}
              disabled={!latestAssistantMessage || savingPlanning}
              className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-40"
            >
              {savingPlanning ? "Guardando..." : "Guardar planificación"}
            </button>
            <button
              onClick={handleExportPlanning}
              disabled={!latestAssistantMessage || exportingPlanning}
              className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-500/20 disabled:opacity-40"
            >
              {exportingPlanning ? "Exportando PDF..." : "Exportar PDF bonito"}
            </button>
            <Link
              href="/educador/planificaciones"
              className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-500/20"
            >
              Ver, editar o eliminar guardadas
            </Link>
          </div>

          <p className="text-gray-700 text-xs mt-2 text-center">
            APl · Parvularia completa · OA múltiples · OAT · ámbitos y núcleos · horizonte temporal
          </p>
        </div>
      </div>
    </div>
  )
}
