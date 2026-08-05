"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { exportPlanningPdf } from "@/lib/planning-pdf"
import {
  buildPlanningHorizonText,
  getPlannerOAOptions,
  getPlannerUnits,
  type TiempoPlanificacion,
} from "@/lib/planificador-curriculum"
import type { PlanningProfileId } from "@/lib/school-planning-profiles"
import {
  getAvailableAsignaturas,
  getCurriculumVerification,
  getParvulariaAmbitoForCurso,
  getParvulariaOATForCurso,
  hasLocalCurriculumForAsignatura,
  type NivelKey,
} from "@/lib/mineduc-oa"

const LEVELS = [
  { id: "parvularia", icon: "🌸", label: "Parvularia", detail: "Sala cuna, nivel medio y transición" },
  { id: "basica", icon: "📚", label: "Educación Básica", detail: "1° a 8° Básico" },
  { id: "media", icon: "🎓", label: "Educación Media", detail: "1° a 4° Medio" },
] as const

const COURSES: Record<NivelKey, string[]> = {
  parvularia: ["Sala Cuna Menor (0 a 1 año)", "Sala Cuna Mayor (1 a 2 años)", "Medio Menor (2 a 3 años)", "Medio Mayor (3 a 4 años)", "NT1 - Pre Kinder (4-5 años)", "NT2 - Kinder (5-6 años)"],
  basica: ["1° Básico", "2° Básico", "3° Básico", "4° Básico", "5° Básico", "6° Básico", "7° Básico", "8° Básico"],
  media: ["1° Medio", "2° Medio", "3° Medio", "4° Medio"],
}

type PlanModeId = "clase" | "secuencia" | "unidad" | "proyecto" | "feria" | "especial"
type PlanMode = {
  id: PlanModeId
  icon: string
  label: string
  detail: string
  profile: PlanningProfileId
  horizon: TiempoPlanificacion
  sessions: number
}

const PLAN_MODES: PlanMode[] = [
  { id: "clase", icon: "📘", label: "Clase", detail: "Inicio, desarrollo, cierre y evaluación.", profile: "clase", horizon: "diaria", sessions: 1 },
  { id: "secuencia", icon: "🧭", label: "Secuencia de clases", detail: "Sesiones conectadas con progresión didáctica.", profile: "clase", horizon: "semanal", sessions: 3 },
  { id: "unidad", icon: "🗂️", label: "Unidad didáctica", detail: "Planificación de mediano plazo por sesiones.", profile: "clase", horizon: "mensual", sessions: 8 },
  { id: "proyecto", icon: "🧩", label: "Proyecto ABP / STEAM", detail: "Desafío, producto, etapas y evidencias.", profile: "proyecto_abp", horizon: "mensual", sessions: 8 },
  { id: "feria", icon: "🔬", label: "Feria científica", detail: "Investigación, stands, seguridad y presentación.", profile: "feria_cientifica", horizon: "mensual", sessions: 8 },
  { id: "especial", icon: "🎪", label: "Actividad especial", detail: "Evento, taller o experiencia vinculada a OA.", profile: "evento_escolar", horizon: "semanal", sessions: 2 },
]

const STEPS = ["Tipo y nivel", "Currículum y OA", "Diseño pedagógico", "Revisar y generar"]
const inputClass = "w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100"
const choiceClass = (selected: boolean, accent: "emerald" | "indigo" = "emerald") => {
  if (accent === "indigo") return selected
    ? "border-indigo-700 bg-indigo-50 shadow-sm"
    : "border-slate-300 bg-white hover:border-indigo-500"
  return selected
    ? "border-emerald-700 bg-emerald-50 shadow-sm"
    : "border-slate-300 bg-white hover:border-emerald-500"
}

interface Message { role: "user" | "assistant"; content: string; provider?: string }
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
  parvulariaHeterogenea: boolean
  parvulariaSegundoCurso: string
  parvulariaMotivoFusion: string
  planningProfile: PlanningProfileId
}
interface SavedPlanningInsert {
  user_id: string; title: string; course: string; subject: string; unit: string
  planning_text: string; planning_json: Record<string, unknown>; nivel: string
  curso: string; asignatura: string; contexto: string; mes: string; unidad_id: string
  selected_oa_ids: string[]; selected_oat_ids: string[]; tiempo_planificacion: string
  sesiones: number; duracion_minutos: number; content: string
}

function initialSubject(level: NivelKey, course: string) {
  return getAvailableAsignaturas(level, course)[0] || ""
}
function Label({ children, required }: { children: ReactNode; required?: boolean }) {
  return <label className="mb-2 block text-sm font-extrabold text-slate-800">{children}{required && <span className="ml-1 text-red-600">*</span>}</label>
}
function Check({ selected, color = "emerald" }: { selected: boolean; color?: "emerald" | "indigo" | "teal" }) {
  const active = color === "indigo" ? "border-indigo-700 bg-indigo-700" : color === "teal" ? "border-teal-700 bg-teal-700" : "border-emerald-700 bg-emerald-700"
  return <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-black ${selected ? `${active} text-white` : "border-slate-300 text-transparent"}`}>✓</span>
}

export default function PlannerPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const month = new Date().toLocaleString("es-CL", { month: "long" }).toLowerCase()
  const [step, setStep] = useState(1)
  const [planMode, setPlanMode] = useState<PlanModeId>("clase")
  const [config, setConfig] = useState<Config>({
    nivel: "parvularia", curso: COURSES.parvularia[0], asignatura: initialSubject("parvularia", COURSES.parvularia[0]),
    contexto: "", mes: month, unidadId: "", selectedOAIds: [], selectedOATIds: [], tiempoPlanificacion: "diaria",
    sesiones: 1, duracionMinutos: 30, parvulariaHeterogenea: false, parvulariaSegundoCurso: COURSES.parvularia[1],
    parvulariaMotivoFusion: "", planningProfile: "experiencia_parvularia",
  })
  const [messages, setMessages] = useState<Message[]>([])
  const [refinement, setRefinement] = useState("")
  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [userId, setUserId] = useState("")
  const [openOA, setOpenOA] = useState(true)
  const [openOAT, setOpenOAT] = useState(false)

  const recoverSession = useCallback(async () => {
    try { await supabase.auth.signOut({ scope: "local" }) } catch {}
    router.replace("/login?next=/educador")
  }, [router, supabase])

  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(async ({ data, error }) => {
      if (cancelled) return
      if (error || !data.user) return recoverSession()
      setUserId(data.user.id)
    })
    const { data } = supabase.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") router.replace("/login?next=/educador") })
    return () => { cancelled = true; data.subscription.unsubscribe() }
  }, [recoverSession, router, supabase])

  const mode = useMemo(() => PLAN_MODES.find((item) => item.id === planMode) || PLAN_MODES[0], [planMode])
  const subjects = useMemo(() => getAvailableAsignaturas(config.nivel, config.curso), [config.nivel, config.curso])
  const curricularState = useMemo(() => ({ nivel: config.nivel, curso: config.curso, asignatura: config.asignatura }), [config.nivel, config.curso, config.asignatura])
  const units = useMemo(() => getPlannerUnits(curricularState), [curricularState])
  const oaOptions = useMemo(() => getPlannerOAOptions(curricularState, config.unidadId || undefined), [curricularState, config.unidadId])
  const oatOptions = useMemo(() => config.nivel === "parvularia" ? getParvulariaOATForCurso(config.curso, config.asignatura) : [], [config.nivel, config.curso, config.asignatura])
  const ambito = useMemo(() => config.nivel === "parvularia" ? getParvulariaAmbitoForCurso(config.curso, config.asignatura) : "", [config.nivel, config.curso, config.asignatura])
  const verification = useMemo(() => getCurriculumVerification(config.nivel, config.curso, config.asignatura), [config.nivel, config.curso, config.asignatura])
  const hasCurriculum = useMemo(() => hasLocalCurriculumForAsignatura(config.nivel, config.curso, config.asignatura), [config.nivel, config.curso, config.asignatura])
  const selectedUnit = units.find((item) => item.id === config.unidadId)
  const selectedOA = oaOptions.filter((item) => config.selectedOAIds.includes(item.id))
  const latest = [...messages].reverse().find((item) => item.role === "assistant")
  const resultReady = Boolean(latest?.content)

  useEffect(() => {
    setConfig((previous) => {
      const nextUnits = getPlannerUnits({ nivel: previous.nivel, curso: previous.curso, asignatura: previous.asignatura })
      const unitId = nextUnits.find((item) => item.id === previous.unidadId)?.id || nextUnits[0]?.id || ""
      const nextOA = getPlannerOAOptions({ nivel: previous.nivel, curso: previous.curso, asignatura: previous.asignatura }, unitId || undefined)
      const allowedOA = new Set(nextOA.map((item) => item.id))
      const nextOAT = previous.nivel === "parvularia" ? getParvulariaOATForCurso(previous.curso, previous.asignatura) : []
      const allowedOAT = new Set(nextOAT.map((item) => item.id))
      return { ...previous, unidadId: unitId, selectedOAIds: previous.selectedOAIds.filter((id) => allowedOA.has(id)), selectedOATIds: previous.selectedOATIds.filter((id) => allowedOAT.has(id)) }
    })
  }, [config.nivel, config.curso, config.asignatura])

  function selectMode(next: PlanMode) {
    setPlanMode(next.id)
    setConfig((previous) => ({
      ...previous,
      planningProfile: previous.nivel === "parvularia" && ["clase", "secuencia", "unidad"].includes(next.id) ? "experiencia_parvularia" : next.profile,
      tiempoPlanificacion: next.horizon, sesiones: next.sessions,
    }))
  }
  function selectLevel(level: NivelKey) {
    const course = COURSES[level][0]
    setConfig((previous) => ({
      ...previous, nivel: level, curso: course, asignatura: initialSubject(level, course), unidadId: "", selectedOAIds: [], selectedOATIds: [],
      duracionMinutos: level === "parvularia" ? 30 : 45,
      planningProfile: level === "parvularia" && ["clase", "secuencia", "unidad"].includes(planMode) ? "experiencia_parvularia" : mode.profile,
    }))
  }
  function updateCourse(course: string) {
    setConfig((previous) => ({ ...previous, curso: course, asignatura: initialSubject(previous.nivel, course), unidadId: "", selectedOAIds: [], selectedOATIds: [] }))
  }
  function toggleOA(id: string) {
    setConfig((previous) => {
      if (previous.selectedOAIds.includes(id)) return { ...previous, selectedOAIds: previous.selectedOAIds.filter((item) => item !== id) }
      if (previous.selectedOAIds.length >= (previous.nivel === "parvularia" ? 3 : 10)) return previous
      return { ...previous, selectedOAIds: [...previous.selectedOAIds, id] }
    })
  }
  function toggleOAT(id: string) {
    setConfig((previous) => {
      if (previous.selectedOATIds.includes(id)) return { ...previous, selectedOATIds: previous.selectedOATIds.filter((item) => item !== id) }
      if (previous.selectedOATIds.length >= 2) return previous
      return { ...previous, selectedOATIds: [...previous.selectedOATIds, id] }
    })
  }
  function goTo(target: number) {
    setStatus("")
    if (target >= 2 && (!config.curso || !config.asignatura)) return setStatus("Completa el nivel, curso y asignatura.")
    if (target >= 3 && config.selectedOAIds.length === 0) return setStatus("Selecciona al menos un Objetivo de Aprendizaje.")
    setStep(target)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
  function generationPrompt() {
    return [
      `Genera una planificación de tipo “${mode.label}” para ${config.curso}, ${config.asignatura}.`,
      `Debe usar los OA seleccionados y organizar ${config.sesiones} sesión(es) de ${config.duracionMinutos} minutos.`,
      config.contexto.trim() ? `Contexto del docente: ${config.contexto.trim()}` : "Propón un contexto pertinente y aplicable al aula chilena.",
      config.parvulariaHeterogenea ? `Sala heterogénea: ${config.curso} con ${config.parvulariaSegundoCurso}. Motivo: ${config.parvulariaMotivoFusion || "organización pedagógica"}.` : "",
      "Incluye propósito u objetivo, inicio, desarrollo, cierre, evaluación, evidencias, recursos, mediación y adecuaciones.",
    ].filter(Boolean).join("\n")
  }
  async function send(text: string, refinementMode = false) {
    if (!text.trim() || loading) return
    setLoading(true); setStatus("")
    const userMessage: Message = { role: "user", content: text }
    setMessages(refinementMode ? [...messages, userMessage] : [userMessage])
    try {
      const response = await fetch("/api/agents/educador", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, history: messages.slice(-8), config }) })
      if (response.status === 401) { await recoverSession(); throw new Error("Tu sesión expiró.") }
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "No fue posible generar la planificación.")
      setMessages((previous) => [...previous, { role: "assistant", content: data.text, provider: data.provider }])
      setStep(4); setRefinement("")
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Ocurrió un error inesperado.")
    } finally { setLoading(false) }
  }
  function title() { return `${mode.label} · ${config.curso} · ${config.asignatura} · ${new Date().toLocaleDateString("es-CL")}` }
  function payload(content: string): SavedPlanningInsert | null {
    if (!userId || !content.trim()) return null
    return {
      user_id: userId, title: title(), course: config.curso, subject: config.asignatura, unit: config.unidadId || "", planning_text: content,
      planning_json: { ...config, plan_mode: planMode, title: title(), content, created_at: new Date().toISOString() },
      nivel: config.nivel, curso: config.curso, asignatura: config.asignatura, contexto: config.contexto, mes: config.mes,
      unidad_id: config.unidadId, selected_oa_ids: config.selectedOAIds, selected_oat_ids: config.selectedOATIds,
      tiempo_planificacion: config.tiempoPlanificacion, sesiones: config.sesiones, duracion_minutos: config.duracionMinutos, content,
    }
  }
  async function save() {
    if (!latest?.content) return
    const data = payload(latest.content)
    if (!data) return setStatus("No se pudo preparar la planificación para guardarla.")
    setSaving(true); setStatus("")
    const { error } = await supabase.from("saved_plannings").insert(data)
    setSaving(false); setStatus(error ? `No se pudo guardar: ${error.message}` : "Planificación guardada correctamente.")
  }
  async function exportPdf() {
    if (!latest?.content) return
    setExporting(true)
    await exportPlanningPdf({ title: title(), subtitle: "Planificación generada por EduAI", curso: config.curso, asignatura: config.asignatura, nivel: config.nivel, mes: config.mes, horizonte: config.tiempoPlanificacion, sesiones: config.sesiones, duracionMinutos: config.duracionMinutos, fechaCreacion: new Date().toLocaleString("es-CL"), contexto: config.contexto, designTemplateId: config.nivel === "parvularia" ? "eduai-canva-classroom" : "presenton-pro-slides" }, latest.content)
    setExporting(false)
  }
  function copy() {
    if (!latest?.content) return
    navigator.clipboard.writeText(latest.content).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) })
  }
  function editPlanning() { setMessages([]); setRefinement(""); setStatus("Puedes modificar los datos y generar una nueva versión."); setStep(1); window.scrollTo({ top: 0, behavior: "smooth" }) }

  const stepOne = (
    <div className="space-y-7">
      <div><p className="text-xs font-black uppercase tracking-[.18em] text-emerald-700">Paso 1</p><h2 className="mt-1 text-2xl font-black">¿Qué deseas planificar?</h2><p className="mt-2 text-sm text-slate-600">Esta pantalla queda dedicada exclusivamente a planificaciones. Las rúbricas y actividades aisladas irán en agentes separados.</p></div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {PLAN_MODES.map((item) => <button key={item.id} onClick={() => selectMode(item)} className={`rounded-2xl border-2 p-4 text-left transition ${choiceClass(planMode === item.id)}`}><div className="flex justify-between"><span className="text-2xl">{item.icon}</span><Check selected={planMode === item.id} /></div><p className="mt-3 font-black">{item.label}</p><p className="mt-1 text-sm text-slate-600">{item.detail}</p></button>)}
      </div>
      <div><Label required>Nivel educativo</Label><div className="grid gap-3 md:grid-cols-3">{LEVELS.map((item) => <button key={item.id} onClick={() => selectLevel(item.id)} className={`rounded-2xl border-2 p-4 text-left transition ${choiceClass(config.nivel === item.id, "indigo")}`}><div className="flex justify-between"><span className="text-2xl">{item.icon}</span><Check selected={config.nivel === item.id} color="indigo" /></div><p className="mt-2 font-black">{item.label}</p><p className="mt-1 text-sm text-slate-600">{item.detail}</p></button>)}</div></div>
      <div className="grid gap-4 md:grid-cols-2">
        <div><Label required>Curso o subnivel</Label><select value={config.curso} onChange={(e) => updateCourse(e.target.value)} className={inputClass}>{COURSES[config.nivel].map((item) => <option key={item}>{item}</option>)}</select></div>
        <div><Label required>{config.nivel === "parvularia" ? "Núcleo de aprendizaje" : "Asignatura"}</Label><select value={config.asignatura} onChange={(e) => setConfig((p) => ({ ...p, asignatura: e.target.value, unidadId: "", selectedOAIds: [], selectedOATIds: [] }))} className={inputClass}>{subjects.map((item) => <option key={item}>{item}</option>)}</select></div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div><Label>Horizonte</Label><select value={config.tiempoPlanificacion} onChange={(e) => setConfig((p) => ({ ...p, tiempoPlanificacion: e.target.value as TiempoPlanificacion }))} className={inputClass}><option value="diaria">Diaria</option><option value="semanal">Semanal</option><option value="mensual">Mensual</option></select></div>
        <div><Label>Sesiones</Label><input type="number" min={1} max={30} value={config.sesiones} onChange={(e) => setConfig((p) => ({ ...p, sesiones: Math.max(1, Number(e.target.value || 1)) }))} className={inputClass} /></div>
        <div><Label>Minutos por sesión</Label><input type="number" min={15} max={240} step={5} value={config.duracionMinutos} onChange={(e) => setConfig((p) => ({ ...p, duracionMinutos: Math.max(15, Number(e.target.value || 45)) }))} className={inputClass} /></div>
      </div>
    </div>
  )

  const stepTwo = (
    <div className="space-y-6">
      <div><p className="text-xs font-black uppercase tracking-[.18em] text-emerald-700">Paso 2</p><h2 className="mt-1 text-2xl font-black">Currículum y Objetivos de Aprendizaje</h2><p className="mt-2 text-sm text-slate-600">Selecciona el bloque o unidad y al menos un OA.</p></div>
      <div className={`rounded-2xl border-2 p-4 ${hasCurriculum ? "border-emerald-600 bg-emerald-50" : "border-amber-500 bg-amber-50"}`}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-black">{hasCurriculum ? "✓ Currículum MINEDUC disponible" : "⚠ Cobertura curricular parcial"}</p><p className="mt-1 text-xs text-slate-700">{config.curso} · {config.asignatura}</p></div>{verification?.sourceUrl && <a href={verification.sourceUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-white px-3 py-2 text-xs font-black text-emerald-800 ring-1 ring-emerald-300">Fuente oficial ↗</a>}</div></div>
      {config.nivel === "parvularia" && <div className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-4"><p className="text-xs font-black uppercase text-rose-800">Ámbito y núcleo</p><p className="mt-1 font-black">{ambito || "Ámbito no identificado"}</p><p className="mt-1 text-sm text-slate-700">{config.asignatura}</p></div>}
      {units.length > 0 && <div><Label>{config.nivel === "parvularia" ? "Bloque curricular" : "Unidad o módulo"}</Label><div className="grid gap-3">{units.map((item) => <button key={item.id} onClick={() => setConfig((p) => ({ ...p, unidadId: item.id, selectedOAIds: [] }))} className={`rounded-2xl border-2 p-4 text-left ${choiceClass(config.unidadId === item.id, "indigo")}`}><div className="flex justify-between gap-3"><div><p className="font-black">{item.label}</p><p className="mt-1 text-xs text-slate-600">{item.oaIds.length} OA asociados</p></div><Check selected={config.unidadId === item.id} color="indigo" /></div></button>)}</div></div>}
      <div><button onClick={() => setOpenOA(!openOA)} className="flex w-full items-center justify-between rounded-2xl border-2 border-slate-300 bg-slate-50 p-4 text-left"><div><p className="font-black">Objetivos de Aprendizaje</p><p className="mt-1 text-xs text-slate-600">{config.selectedOAIds.length} seleccionado(s)</p></div><span className="text-xl font-black">{openOA ? "−" : "+"}</span></button>{openOA && <div className="mt-3 grid max-h-[520px] gap-3 overflow-y-auto md:grid-cols-2">{oaOptions.length ? oaOptions.map((item) => { const selected = config.selectedOAIds.includes(item.id); return <button key={item.id} onClick={() => toggleOA(item.id)} className={`rounded-2xl border-2 p-4 text-left ${choiceClass(selected)}`}><div className="flex justify-between gap-3"><div><p className="font-black">{item.codigoOficial || item.id}</p><p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{item.texto}</p>{item.ambito && item.nucleo && <p className="mt-3 text-xs font-black text-emerald-800">{item.ambito} · {item.nucleo}</p>}</div><Check selected={selected} /></div></button> }) : <div className="md:col-span-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-sm font-bold text-slate-600">No hay OA locales disponibles.</div>}</div>}</div>
      {config.nivel === "parvularia" && <div><button onClick={() => setOpenOAT(!openOAT)} className="flex w-full items-center justify-between rounded-2xl border-2 border-slate-300 bg-slate-50 p-4 text-left"><div><p className="font-black">OAT / foco transversal</p><p className="mt-1 text-xs text-slate-600">Opcional · {config.selectedOATIds.length} seleccionado(s)</p></div><span className="text-xl font-black">{openOAT ? "−" : "+"}</span></button>{openOAT && <div className="mt-3 grid gap-3">{oatOptions.map((item) => { const selected = config.selectedOATIds.includes(item.id); return <button key={item.id} onClick={() => toggleOAT(item.id)} className={`rounded-2xl border-2 p-4 text-left ${selected ? "border-teal-700 bg-teal-50" : "border-slate-300 bg-white hover:border-teal-500"}`}><div className="flex justify-between gap-3"><div><p className="font-black">{item.description || item.id}</p><p className="mt-1 text-sm text-slate-700">{item.label}</p></div><Check selected={selected} color="teal" /></div></button> })}</div>}</div>}
    </div>
  )

  const stepThree = (
    <div className="space-y-6">
      <div><p className="text-xs font-black uppercase tracking-[.18em] text-emerald-700">Paso 3</p><h2 className="mt-1 text-2xl font-black">Diseño pedagógico</h2><p className="mt-2 text-sm text-slate-600">Escribe el contenido, propósito, situación o recursos disponibles. No necesitas redactar la planificación.</p></div>
      <div><Label>Contexto, tema o idea central</Label><textarea value={config.contexto} onChange={(e) => setConfig((p) => ({ ...p, contexto: e.target.value }))} placeholder="Ejemplo: Trabajar los cambios de estación mediante exploración del patio. Hay lupas, cartulinas y elementos naturales." className={`${inputClass} min-h-[190px] font-normal leading-relaxed`} /></div>
      {config.nivel === "parvularia" && <div className="rounded-2xl border-2 border-cyan-500 bg-cyan-50 p-5"><div className="flex flex-col gap-4 md:flex-row md:justify-between"><div><p className="font-black text-cyan-950">Sala heterogénea o niveles unidos</p><p className="mt-1 text-sm text-cyan-900">Genera una experiencia común con adecuaciones diferenciadas por edad.</p></div><button onClick={() => setConfig((p) => ({ ...p, parvulariaHeterogenea: !p.parvulariaHeterogenea }))} className={`rounded-xl px-5 py-2.5 text-sm font-black ${config.parvulariaHeterogenea ? "bg-cyan-800 text-white" : "bg-white text-cyan-900 ring-2 ring-cyan-400"}`}>{config.parvulariaHeterogenea ? "Activada" : "Activar"}</button></div>{config.parvulariaHeterogenea && <div className="mt-5 grid gap-4 md:grid-cols-2"><div><Label>Segundo subnivel</Label><select value={config.parvulariaSegundoCurso} onChange={(e) => setConfig((p) => ({ ...p, parvulariaSegundoCurso: e.target.value }))} className={inputClass}>{COURSES.parvularia.filter((item) => item !== config.curso).map((item) => <option key={item}>{item}</option>)}</select></div><div><Label>Motivo o contexto</Label><input value={config.parvulariaMotivoFusion} onChange={(e) => setConfig((p) => ({ ...p, parvulariaMotivoFusion: e.target.value }))} placeholder="Ej.: jornada especial o baja asistencia" className={inputClass} /></div></div>}</div>}
    </div>
  )

  const result = latest && <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-emerald-700 bg-emerald-50 p-4"><div><p className="text-xs font-black uppercase text-emerald-800">Planificación generada</p><p className="mt-1 font-black">{mode.label} · {config.curso}</p></div><div className="flex flex-wrap gap-2"><button onClick={editPlanning} className="rounded-xl border-2 border-slate-700 bg-white px-3 py-2 text-xs font-black">✏️ Editar datos</button><button onClick={copy} className="rounded-xl border-2 border-blue-700 bg-white px-3 py-2 text-xs font-black text-blue-800">{copied ? "✓ Copiado" : "📋 Copiar"}</button><button onClick={save} disabled={saving} className="rounded-xl border-2 border-emerald-700 bg-white px-3 py-2 text-xs font-black text-emerald-800">{saving ? "Guardando…" : "💾 Guardar"}</button><button onClick={exportPdf} disabled={exporting} className="rounded-xl border-2 border-amber-700 bg-white px-3 py-2 text-xs font-black text-amber-800">{exporting ? "Exportando…" : "📄 Exportar PDF"}</button></div></div><article className="rounded-3xl border-2 border-slate-300 bg-white p-5 md:p-8"><div className="prose prose-slate max-w-none text-sm prose-h2:text-emerald-800 prose-h3:text-indigo-800 prose-table:text-xs prose-th:bg-slate-100 prose-th:p-3 prose-td:border prose-td:border-slate-200 prose-td:p-3"><ReactMarkdown remarkPlugins={[remarkGfm]}>{latest.content}</ReactMarkdown></div>{latest.provider && <p className="mt-6 border-t pt-3 text-xs text-slate-500">Generado mediante {latest.provider}</p>}</article><div className="rounded-2xl border-2 border-indigo-300 bg-indigo-50 p-5"><p className="font-black text-indigo-950">Ajustar planificación</p><div className="mt-3 flex flex-col gap-3 md:flex-row"><textarea value={refinement} onChange={(e) => setRefinement(e.target.value)} placeholder="Ej.: reduce la clase a 45 minutos y agrega una actividad experimental." className={`${inputClass} min-h-[90px] flex-1 font-normal`} /><button onClick={() => send(refinement, true)} disabled={!refinement.trim() || loading} className="rounded-xl bg-indigo-700 px-5 py-3 font-black text-white disabled:bg-slate-400 md:self-end">Aplicar ajuste</button></div></div></div>

  const stepFour = <div className="space-y-6"><div><p className="text-xs font-black uppercase tracking-[.18em] text-emerald-700">Paso 4</p><h2 className="mt-1 text-2xl font-black">Revisar y generar</h2></div>{!resultReady && <><div className="grid gap-4 rounded-3xl border-2 border-slate-300 bg-slate-50 p-6 md:grid-cols-2"><div><p className="text-xs font-black uppercase text-slate-500">Planificación</p><p className="mt-1 text-lg font-black">{mode.icon} {mode.label}</p><p className="mt-2 text-sm text-slate-700">{buildPlanningHorizonText(config.tiempoPlanificacion, config.sesiones, config.duracionMinutos)}</p></div><div><p className="text-xs font-black uppercase text-slate-500">Curso y asignatura</p><p className="mt-1 font-black">{config.curso}</p><p className="mt-1 text-sm text-slate-700">{config.asignatura}</p></div><div><p className="text-xs font-black uppercase text-slate-500">Currículum</p><p className="mt-1 text-sm font-bold">{selectedUnit?.label || "Sin unidad específica"}</p><p className="mt-2 text-sm text-slate-700">OA: {selectedOA.map((item) => item.codigoOficial || item.id).join(", ")}</p></div><div><p className="text-xs font-black uppercase text-slate-500">Idea central</p><p className="mt-1 text-sm text-slate-700">{config.contexto.trim() || "La IA propondrá un contexto pertinente."}</p></div></div><button onClick={() => send(generationPrompt())} disabled={loading || config.selectedOAIds.length === 0} className="w-full rounded-2xl bg-emerald-700 px-6 py-4 font-black text-white shadow-lg hover:bg-emerald-800 disabled:bg-slate-400">{loading ? "Generando planificación…" : "✨ Generar planificación"}</button></>}{loading && <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-5 text-center font-black text-emerald-950">EduAI está organizando OA, actividades, tiempos y evaluación…</div>}{resultReady && result}</div>

  const content = step === 1 ? stepOne : step === 2 ? stepTwo : step === 3 ? stepThree : stepFour

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-300 bg-white/95 shadow-sm backdrop-blur"><div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 md:px-6"><div className="flex min-w-0 items-center gap-3"><button onClick={() => router.push("/agentes")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-slate-300 font-black">←</button><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-xl text-white">🏫</div><div className="min-w-0"><h1 className="truncate font-black">APl — Agente Planificador</h1><p className="truncate text-xs font-medium text-slate-600">Planificaciones con OA MINEDUC · Parvularia, Básica y Media</p></div></div><Link href="/educador/planificaciones" className="shrink-0 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white">🗂️ Ver guardadas</Link></div></header>
      <main className="mx-auto max-w-[1500px] px-4 py-6 md:px-6">
        <nav className="mb-6 overflow-x-auto rounded-2xl border-2 border-slate-300 bg-white p-3"><div className="flex min-w-[680px] gap-2">{STEPS.map((label, index) => { const id = index + 1; const active = step === id; const done = step > id; return <button key={label} onClick={() => goTo(id)} className={`flex flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-left ${active ? "bg-emerald-700 text-white" : done ? "bg-emerald-100 text-emerald-950" : "bg-slate-100 text-slate-600"}`}><span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${active ? "bg-white text-emerald-800" : done ? "bg-emerald-700 text-white" : "bg-white"}`}>{done ? "✓" : id}</span><span className="text-sm font-black">{label}</span></button> })}</div></nav>
        {status && <div className={`mb-5 rounded-2xl border-2 px-4 py-3 text-sm font-bold ${status.includes("correctamente") ? "border-emerald-500 bg-emerald-50 text-emerald-950" : "border-amber-500 bg-amber-50 text-amber-950"}`}>{status}</div>}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-3xl border-2 border-slate-300 bg-white p-5 shadow-sm md:p-7">{content}{!resultReady && <div className="mt-8 flex justify-between border-t pt-5"><button onClick={() => goTo(Math.max(1, step - 1))} disabled={step === 1} className="rounded-xl border-2 border-slate-300 px-5 py-3 text-sm font-black disabled:opacity-30">← Atrás</button>{step < 4 && <button onClick={() => goTo(step + 1)} className="rounded-xl bg-emerald-700 px-6 py-3 text-sm font-black text-white">Continuar →</button>}</div>}</section>
          <aside className="xl:sticky xl:top-24 xl:self-start"><div className="rounded-3xl border-2 border-slate-800 bg-slate-950 p-5 text-white shadow-lg"><p className="text-xs font-black uppercase tracking-[.18em] text-emerald-300">Resumen</p><h2 className="mt-2 text-lg font-black">{mode.icon} {mode.label}</h2><div className="mt-5 space-y-4 text-sm"><div className="rounded-2xl bg-white/10 p-4"><p className="text-xs font-black uppercase text-slate-300">Nivel y curso</p><p className="mt-1 font-black">{config.curso}</p><p className="mt-1 text-slate-300">{config.asignatura}</p></div><div className="rounded-2xl bg-white/10 p-4"><p className="text-xs font-black uppercase text-slate-300">Duración</p><p className="mt-1 font-black">{config.sesiones} sesión(es) · {config.duracionMinutos} min</p><p className="mt-1 capitalize text-slate-300">{config.tiempoPlanificacion}</p></div><div className="rounded-2xl bg-white/10 p-4"><p className="text-xs font-black uppercase text-slate-300">Currículum</p><p className="mt-1 font-black">{selectedUnit?.label || "Unidad por definir"}</p><p className="mt-2 text-slate-300">{config.selectedOAIds.length} OA seleccionado(s)</p></div><div className={`rounded-2xl border p-4 ${hasCurriculum ? "border-emerald-500 bg-emerald-500/15" : "border-amber-400 bg-amber-400/15"}`}><p className="font-black">{hasCurriculum ? "✓ Currículum disponible" : "⚠ Cobertura parcial"}</p><p className="mt-1 text-xs text-slate-300">Solo se muestran opciones relacionadas con la planificación.</p></div></div></div></aside>
        </div>
      </main>
    </div>
  )
}
