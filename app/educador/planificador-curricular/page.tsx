"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  getAvailableAsignaturas,
  hasLocalCurriculumForAsignatura,
  type NivelKey,
} from "@/lib/mineduc-oa"
import {
  buildPlanningHorizonText,
  getPlannerOAOptions,
  getPlannerSummary,
  getPlannerUnits,
  getPlanningHorizonConfig,
  getPlanningPeriodOptions,
  PLANNING_HORIZONS,
  type TiempoPlanificacion,
} from "@/lib/planificador-curriculum"

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

const NIVEL_LABELS: Record<NivelKey, string> = {
  parvularia: "Parvularia",
  basica: "Educación básica",
  media: "Educación media",
}

interface Config {
  nivel: NivelKey
  curso: string
  asignatura: string
  unidadId: string
  selectedOAIds: string[]
  tiempoPlanificacion: TiempoPlanificacion
  periodoId: string
  periodoLabel: string
  sesiones: number
  duracionMinutos: number
  actividadGeneral: string
  unidadesDeclaradas: string
  evaluacion: string
  incluirPIE: boolean
  formatoInstitucional: boolean
  generarAgenteDia: boolean
}

interface Message {
  role: "user" | "assistant"
  content: string
  provider?: string
}

function getInitialAsignatura(nivel: NivelKey, curso: string) {
  return getAvailableAsignaturas(nivel, curso)[0] || ""
}

function getInitialConfig(): Config {
  const nivel: NivelKey = "media"
  const curso = "1° Medio"
  const asignatura = getInitialAsignatura(nivel, curso)
  const horizon = getPlanningHorizonConfig("semestral")
  const period = horizon.periodOptions[0]

  return {
    nivel,
    curso,
    asignatura,
    unidadId: "",
    selectedOAIds: [],
    tiempoPlanificacion: "semestral",
    periodoId: period?.id || "primer-semestre",
    periodoLabel: period?.label || "Primer semestre · marzo a junio",
    sesiones: horizon.defaultSesiones,
    duracionMinutos: horizon.defaultDuracionMinutos,
    actividadGeneral: "",
    unidadesDeclaradas: "",
    evaluacion: "Formativa y sumativa, con evidencias de proceso y producto final.",
    incluirPIE: true,
    formatoInstitucional: true,
    generarAgenteDia: true,
  }
}

function clampSessionByHorizon(tiempo: TiempoPlanificacion, sesiones: number) {
  const horizon = getPlanningHorizonConfig(tiempo)
  return Math.max(horizon.minSesiones, Math.min(horizon.maxSesiones, sesiones || horizon.defaultSesiones))
}

export default function PlanificadorCurricularPage() {
  const [config, setConfig] = useState<Config>(() => getInitialConfig())
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState("")

  const curriculumState = useMemo(
    () => ({ nivel: config.nivel, curso: config.curso, asignatura: config.asignatura }),
    [config.nivel, config.curso, config.asignatura]
  )

  const availableAsignaturas = useMemo(
    () => getAvailableAsignaturas(config.nivel, config.curso),
    [config.nivel, config.curso]
  )

  const currentAsignaturaHasLocal = useMemo(
    () => hasLocalCurriculumForAsignatura(config.nivel, config.curso, config.asignatura),
    [config.nivel, config.curso, config.asignatura]
  )

  const horizon = useMemo(
    () => getPlanningHorizonConfig(config.tiempoPlanificacion),
    [config.tiempoPlanificacion]
  )

  const periodOptions = useMemo(
    () => getPlanningPeriodOptions(config.tiempoPlanificacion),
    [config.tiempoPlanificacion]
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

  const selectedUnit = units.find((unit) => unit.id === config.unidadId)
  const selectedOAObjects = oaOptions.filter((oa) => config.selectedOAIds.includes(oa.id))
  const horizonText = buildPlanningHorizonText(
    config.tiempoPlanificacion,
    config.sesiones,
    config.duracionMinutos,
    config.periodoLabel
  )
  const latestAssistant = [...messages].reverse().find((msg) => msg.role === "assistant")

  useEffect(() => {
    setConfig((prev) => {
      const cursos = CURSOS[prev.nivel]
      const nextCurso = cursos.includes(prev.curso) ? prev.curso : cursos[0]
      const asignaturas = getAvailableAsignaturas(prev.nivel, nextCurso)
      const nextAsignatura = asignaturas.includes(prev.asignatura)
        ? prev.asignatura
        : asignaturas[0] || ""

      return {
        ...prev,
        curso: nextCurso,
        asignatura: nextAsignatura,
      }
    })
  }, [config.nivel])

  useEffect(() => {
    setConfig((prev) => {
      const nextUnits = getPlannerUnits({ nivel: prev.nivel, curso: prev.curso, asignatura: prev.asignatura })
      const nextUnitId = nextUnits.find((unit) => unit.id === prev.unidadId)?.id || nextUnits[0]?.id || ""
      const allowedOA = new Set(getPlannerOAOptions({ nivel: prev.nivel, curso: prev.curso, asignatura: prev.asignatura }, nextUnitId || undefined).map((oa) => oa.id))

      return {
        ...prev,
        unidadId: nextUnitId,
        selectedOAIds: prev.selectedOAIds.filter((id) => allowedOA.has(id)),
      }
    })
  }, [config.nivel, config.curso, config.asignatura])

  function updateHorizon(tiempo: TiempoPlanificacion) {
    const next = getPlanningHorizonConfig(tiempo)
    const period = next.periodOptions[0]

    setConfig((prev) => ({
      ...prev,
      tiempoPlanificacion: tiempo,
      sesiones: next.defaultSesiones,
      duracionMinutos: next.defaultDuracionMinutos,
      periodoId: period?.id || "",
      periodoLabel: period?.label || next.label,
    }))
  }

  function updatePeriod(periodId: string) {
    const period = periodOptions.find((item) => item.id === periodId)
    setConfig((prev) => ({
      ...prev,
      periodoId: periodId,
      periodoLabel: period?.label || periodId,
    }))
  }

  function toggleOA(id: string) {
    setConfig((prev) => {
      const exists = prev.selectedOAIds.includes(id)
      if (exists) {
        return { ...prev, selectedOAIds: prev.selectedOAIds.filter((item) => item !== id) }
      }
      if (prev.selectedOAIds.length >= 12) return prev
      return { ...prev, selectedOAIds: [...prev.selectedOAIds, id] }
    })
  }

  function selectAllVisibleOA() {
    const ids = oaOptions.slice(0, 12).map((oa) => oa.id)
    setConfig((prev) => ({ ...prev, selectedOAIds: ids }))
  }

  function clearOA() {
    setConfig((prev) => ({ ...prev, selectedOAIds: [] }))
  }

  function fillSemesterExample() {
    setConfig((prev) => ({
      ...prev,
      actividadGeneral: "Los estudiantes desarrollarán una secuencia de actividades y proyecto aplicado relacionado con la unidad seleccionada, incorporando investigación, trabajo colaborativo, producto final y presentación de evidencias.",
      unidadesDeclaradas: selectedUnit?.label || "Unidad seleccionada desde la base curricular local.",
      evaluacion: "Evaluación formativa durante el proceso, rúbrica de producto final, autoevaluación y ticket de salida por tramo.",
      generarAgenteDia: true,
      formatoInstitucional: true,
      incluirPIE: true,
    }))
  }

  async function generatePlanning(customMessage?: string) {
    const message = customMessage || `Genera una planificación ${config.tiempoPlanificacion} para ${config.curso}, ${config.asignatura}, periodo ${config.periodoLabel}.`
    setLoading(true)
    setError("")
    setMessages((prev) => [...prev, { role: "user", content: message }])

    try {
      const res = await fetch("/api/agents/planificador-curricular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history: messages.slice(-6),
          config,
        }),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "No fue posible generar la planificación")
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.text || "No se recibió respuesta del agente.",
          provider: data.provider,
        },
      ])
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido"
      setError(message)
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Hubo un error al generar la planificación: ${message}`,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  function copyLatest() {
    if (!latestAssistant?.content) return
    navigator.clipboard.writeText(latestAssistant.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_30%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_26%),#f8fafc] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/educador" className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 hover:bg-slate-100">
              ←
            </Link>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-xl shadow-lg shadow-emerald-200">
              🧭
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-950 sm:text-base">Planificador Curricular EduAI</h1>
              <p className="text-xs text-slate-500">OA reales · diaria · semanal · mensual · semestral · anual · puente con agente día</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={copyLatest}
              disabled={!latestAssistant}
              className="rounded-xl border border-blue-700 bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-40"
            >
              {copied ? "✓ Copiado" : "📋 Copiar resultado"}
            </button>
            <button
              onClick={() => generatePlanning()}
              disabled={loading}
              className="rounded-xl border border-emerald-800 bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50"
            >
              {loading ? "Generando..." : "✨ Generar planificación"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-5 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">1. Horizonte de planificación</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">Selecciona si quieres plan diario, semanal, mensual, semestral o anual. El agente cambia su estructura según el horizonte.</p>
              </div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
                {horizon.shortLabel}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-1 2xl:grid-cols-5">
              {PLANNING_HORIZONS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => updateHorizon(item.id)}
                  className={`rounded-2xl border p-3 text-left transition-all ${
                    config.tiempoPlanificacion === item.id
                      ? "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-300"
                  }`}
                >
                  <div className="text-xs font-bold">{item.shortLabel}</div>
                  <div className="mt-1 text-[11px] leading-relaxed text-slate-500">{item.description}</div>
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Periodo</label>
                <select
                  value={config.periodoId}
                  onChange={(e) => updatePeriod(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                >
                  {periodOptions.map((period) => (
                    <option key={period.id} value={period.id}>{period.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Sesiones estimadas</label>
                <input
                  type="number"
                  min={horizon.minSesiones}
                  max={horizon.maxSesiones}
                  value={config.sesiones}
                  onChange={(e) => setConfig((prev) => ({ ...prev, sesiones: clampSessionByHorizon(prev.tiempoPlanificacion, Number(e.target.value || horizon.defaultSesiones)) }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Minutos por sesión</label>
                <input
                  type="number"
                  min={15}
                  max={300}
                  step={5}
                  value={config.duracionMinutos}
                  onChange={(e) => setConfig((prev) => ({ ...prev, duracionMinutos: Number(e.target.value || horizon.defaultDuracionMinutos) }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">2. Curso, asignatura y OA reales</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">La planificación se conecta con la base curricular local del repositorio. Los OA se seleccionan desde datos reales; el agente no debe inventarlos.</p>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Nivel</label>
                <select
                  value={config.nivel}
                  onChange={(e) => {
                    const nivel = e.target.value as NivelKey
                    const curso = CURSOS[nivel][0]
                    const asignatura = getInitialAsignatura(nivel, curso)
                    setConfig((prev) => ({ ...prev, nivel, curso, asignatura, unidadId: "", selectedOAIds: [] }))
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                >
                  {(Object.keys(NIVEL_LABELS) as NivelKey[]).map((nivel) => (
                    <option key={nivel} value={nivel}>{NIVEL_LABELS[nivel]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Curso / subnivel</label>
                <select
                  value={config.curso}
                  onChange={(e) => {
                    const curso = e.target.value
                    const asignatura = getInitialAsignatura(config.nivel, curso)
                    setConfig((prev) => ({ ...prev, curso, asignatura, unidadId: "", selectedOAIds: [] }))
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                >
                  {CURSOS[config.nivel].map((curso) => <option key={curso}>{curso}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Asignatura / núcleo</label>
                <select
                  value={config.asignatura}
                  onChange={(e) => setConfig((prev) => ({ ...prev, asignatura: e.target.value, unidadId: "", selectedOAIds: [] }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                >
                  {availableAsignaturas.map((asignatura) => (
                    <option key={asignatura} value={asignatura}>
                      {hasLocalCurriculumForAsignatura(config.nivel, config.curso, asignatura) ? "✅" : "🟡"} {asignatura}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-full border px-3 py-1 font-bold ${currentAsignaturaHasLocal ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                  {currentAsignaturaHasLocal ? "✅ Base curricular local cargada" : "🟡 Base curricular parcial"}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-600">{summary.units} unidades/módulos</span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-600">{summary.oas} OA cargados</span>
              </div>
            </div>

            {!!units.length && (
              <div className="mt-4">
                <label className="mb-2 block text-xs font-semibold text-slate-600">Unidad / módulo</label>
                <div className="grid gap-2">
                  {units.map((unit) => (
                    <button
                      key={unit.id}
                      onClick={() => setConfig((prev) => ({ ...prev, unidadId: unit.id, selectedOAIds: [] }))}
                      className={`rounded-2xl border p-3 text-left transition-all ${
                        config.unidadId === unit.id
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-300"
                      }`}
                    >
                      <div className="text-sm font-bold">{unit.label}</div>
                      <div className="mt-1 text-[11px] text-slate-500">OA asociados: {unit.oaIds.join(", ") || "sin detalle"}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">OA seleccionables</h3>
                <p className="text-xs text-slate-500">Puedes elegir varios OA reales. Máximo 12 para evitar respuestas demasiado extensas.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={selectAllVisibleOA} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100">Seleccionar visibles</button>
                <button onClick={clearOA} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">Limpiar</button>
              </div>
            </div>

            <div className="mt-3 grid max-h-[420px] gap-2 overflow-y-auto pr-1 md:grid-cols-2">
              {oaOptions.length ? oaOptions.map((oa) => {
                const selected = config.selectedOAIds.includes(oa.id)
                return (
                  <button
                    key={oa.id}
                    onClick={() => toggleOA(oa.id)}
                    className={`rounded-2xl border p-3 text-left transition-all ${
                      selected ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:border-emerald-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-slate-900">{oa.codigoOficial || oa.id}</div>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600">{oa.texto}</p>
                      </div>
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${selected ? "border-emerald-500 text-emerald-700" : "border-slate-300 text-slate-300"}`}>
                        {selected ? "✓" : ""}
                      </span>
                    </div>
                    {!!oa.unidadNombre && <p className="mt-2 text-[11px] text-slate-400">{oa.unidadNombre}</p>}
                  </button>
                )
              }) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500 md:col-span-2">
                  No hay OA locales cargados para esta combinación.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">3. Idea general, unidades y evaluación</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">Aquí puedes escribir poco: actividad general, unidades o intención. El agente completa la estructura según los OA y horizonte.</p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Actividad o idea general</label>
                <textarea
                  value={config.actividadGeneral}
                  onChange={(e) => setConfig((prev) => ({ ...prev, actividadGeneral: e.target.value }))}
                  placeholder="Ej: trabajar una intervención ambiental escolar, una unidad de sistemas de ecuaciones, un proyecto STEAM o una secuencia de probabilidades."
                  className="min-h-[92px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Unidades que se impartirán</label>
                <textarea
                  value={config.unidadesDeclaradas}
                  onChange={(e) => setConfig((prev) => ({ ...prev, unidadesDeclaradas: e.target.value }))}
                  placeholder="Ej: Unidad 1 durante marzo-abril, Unidad 2 durante mayo-junio. O deja que se use la unidad seleccionada desde la base."
                  className="min-h-[76px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Evaluación esperada</label>
                <input
                  value={config.evaluacion}
                  onChange={(e) => setConfig((prev) => ({ ...prev, evaluacion: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <button
                onClick={() => setConfig((prev) => ({ ...prev, incluirPIE: !prev.incluirPIE }))}
                className={`rounded-2xl border px-3 py-2 text-left text-xs font-bold ${config.incluirPIE ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}
              >
                ♿ PIE/diversidad {config.incluirPIE ? "activado" : "opcional"}
              </button>
              <button
                onClick={() => setConfig((prev) => ({ ...prev, formatoInstitucional: !prev.formatoInstitucional }))}
                className={`rounded-2xl border px-3 py-2 text-left text-xs font-bold ${config.formatoInstitucional ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}
              >
                🏫 Formato UTP {config.formatoInstitucional ? "sí" : "simple"}
              </button>
              <button
                onClick={() => setConfig((prev) => ({ ...prev, generarAgenteDia: !prev.generarAgenteDia }))}
                className={`rounded-2xl border px-3 py-2 text-left text-xs font-bold ${config.generarAgenteDia ? "border-violet-500 bg-violet-50 text-violet-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}
              >
                🤖 Puente agente día {config.generarAgenteDia ? "sí" : "no"}
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={fillSemesterExample} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100">Completar ejemplo base</button>
              <button
                onClick={() => generatePlanning("Genera una planificación semestral institucional, ordenada por meses y semanas, usando los OA seleccionados y dejando puente para el agente día.")}
                disabled={loading}
                className="rounded-xl border border-emerald-700 bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Semestral institucional
              </button>
              <button
                onClick={() => generatePlanning("Convierte esta planificación en una bajada semanal y deja instrucciones para que el agente día genere clases diarias, guías, rúbricas y tickets de salida.")}
                disabled={loading}
                className="rounded-xl border border-violet-700 bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                Bajar a agente día
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Resumen activo</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">Antes de generar, revisa que estén correctos curso, horizonte, OA y periodo.</p>
              </div>
              <button
                onClick={() => generatePlanning()}
                disabled={loading}
                className="rounded-2xl border border-emerald-800 bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50"
              >
                {loading ? "Generando..." : "✨ Generar ahora"}
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Contexto</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{config.curso} · {config.asignatura}</p>
                <p className="mt-1 text-xs text-slate-500">{config.periodoLabel}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Horizonte</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{horizon.label}</p>
                <p className="mt-1 text-xs text-slate-500">{config.sesiones} sesiones · {config.duracionMinutos} min</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">OA seleccionados</p>
                <p className="mt-2 text-sm text-slate-700">
                  {selectedOAObjects.length
                    ? selectedOAObjects.map((oa) => oa.codigoOficial || oa.id).join(", ")
                    : "Sin OA seleccionados manualmente; el agente usará los OA visibles de la unidad si están disponibles."}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">Unidad/módulo: {selectedUnit?.label || "sin unidad local"}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 md:col-span-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Estructura esperada</p>
                <p className="mt-2 text-xs leading-relaxed text-emerald-900">{horizonText}</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Resultado del agente</h2>
                <p className="mt-1 text-xs text-slate-500">La respuesta queda en Markdown para copiar, guardar o exportar luego.</p>
              </div>
              {latestAssistant?.provider && (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-500">{latestAssistant.provider}</span>
              )}
            </div>

            {!messages.length && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                Configura el horizonte, selecciona OA reales y presiona “Generar planificación”.
              </div>
            )}

            <div className="space-y-4">
              {messages.map((msg, index) => (
                <div key={`${msg.role}-${index}`} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[96%] rounded-2xl px-4 py-3 ${msg.role === "user" ? "bg-emerald-700 text-white" : "border border-slate-200 bg-white text-slate-900"}`}>
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none prose-headings:text-emerald-800 prose-table:text-xs prose-th:bg-slate-100 prose-td:align-top">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
                  APl está generando la planificación con OA reales y estructura {config.tiempoPlanificacion}...
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
