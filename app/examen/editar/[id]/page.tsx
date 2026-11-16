"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import ExamMathText from "@/components/ui/ExamMathText"
import ExamVisualEditor from "@/components/exam/ExamVisualEditor"
import ExamCorrectionPanel from "@/components/exam/ExamCorrectionPanel"
import {useExamPythonVerification,type PythonResult,type CorrectionReview} from "@/lib/exam/use-exam-python-verification"
import {correctionSignature,needsCorrectionConfirmation} from "@/lib/exam/correction-review.mjs"
import {examAnswerConsistencyIssues} from "@/lib/exam/answer-consistency.mjs"
import CourseAssignmentPicker from "@/components/exam/CourseAssignmentPicker"
import { assignedCourses } from "@/lib/exam/course-assignment.mjs"
import { ArrowLeft, Save, RefreshCw, Loader2, Copy, Check, Trash2, Plus } from "lucide-react"
import { enrichQuestionAnswerKey, normalizeAnswerIndex } from "@/lib/exam/question-quality"
import { getQuestionMaxPoints } from "@/lib/exam/grading"

// ── Tipos (mismos que crear/page.tsx) ────────────────────────────────────────
type ScoreMode = "auto" | "manual"
type Ability   = "recuerdo" | "comprension" | "aplicacion" | "analisis" | "argumentacion"

type ExamQuestion = {
  id?: string
  type: "multiple_choice" | "true_false" | "development" | "mixed_choice_development"
  correctionReview?: CorrectionReview
  responseMode?: string
  stimulusTitle?: string
  stimulusText?: string
  showStimulusToStudent?: boolean
  imageUrl?: string
  developmentMaxPoints?: number
  showRubricToStudent?: boolean
  question: string
  options?: string[]
  correctAnswer?: number
  answerText?: string
  explanation?: string
  solutionSteps?: string[]
  distractorRationales?: string[]
  qualityStatus?: "ready" | "review"
  qualityWarnings?: string[]
  difficulty?: 1 | 2 | 3
  ability?: Ability
  modelAnswer?: string
  expectedLatex?: string
  rubric?: { criteria: string; points: number }[]
  maxPoints?: number
  selectionPoints?: number
  justificationMaxPoints?: number
}

const abilityOptions: { id: Ability; label: string }[] = [
  { id: "recuerdo",       label: "Recuerdo"       },
  { id: "comprension",    label: "Comprensión"    },
  { id: "aplicacion",     label: "Aplicación"     },
  { id: "analisis",       label: "Análisis"       },
  { id: "argumentacion",  label: "Argumentación"  },
]

// Keep the live editor text unchanged while typing. Derive quality and answer keys
// from normalized copies, so trailing spaces/newlines do not reset the caret.
function enrichEditable(q:ExamQuestion):ExamQuestion{
  const enriched=enrichQuestionAnswerKey(q)
  return {...enriched,question:q.question,options:q.options??enriched.options,modelAnswer:q.modelAnswer??enriched.modelAnswer,expectedLatex:q.expectedLatex??enriched.expectedLatex,explanation:q.explanation??enriched.explanation,solutionSteps:q.solutionSteps??enriched.solutionSteps,rubric:q.rubric??enriched.rubric}
}

function clampPositive(n: number, fallback = 1) {
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.round(n * 10) / 10)
}

function questionTypeLabel(type: ExamQuestion["type"]) {
  if (type === "multiple_choice") return "Alternativas"
  if (type === "mixed_choice_development") return "Alternativa + desarrollo"
  if (type === "true_false")      return "V/F"
  return "Desarrollo"
}

function difficultyLabel(d?: number) {
  if (d === 3) return "Difícil"
  if (d === 2) return "Medio"
  return "Fácil"
}

function difficultyColor(d?: number) {
  if (d === 3) return "text-red-400"
  if (d === 2) return "text-yellow-400"
  return "text-green-400"
}


const CALM_GREEN_COLORS = {
  background: "#ffffff",
  surface: "#ffffff",
  card: "#ffffff",
  soft: "#eafaf4",
  border: "#bfe7da",
  text: "#102a2a",
  textSub: "#2f5957",
  muted: "#6b7d7c",
  accent: "#2f7f7b",
  accentSoft: "#d9f3ec",
  progress: "#5fb3a8",
  progressTrack: "#dfeeea",
  success: "#2f9e74",
  warning: "#c58a24",
}

const EDIT_COLOR_FIELDS = [
  { key: "background", label: "Fondo general", desc: "Base blanca del examen" },
  { key: "surface", label: "Paneles", desc: "Tarjetas superiores y laterales" },
  { key: "card", label: "Pregunta", desc: "Cuadro principal de pregunta" },
  { key: "soft", label: "Fondo suave", desc: "Franjas y avisos internos" },
  { key: "border", label: "Bordes", desc: "Contornos suaves" },
  { key: "accent", label: "Color principal", desc: "Selección y botones tranquilos" },
  { key: "accentSoft", label: "Selección suave", desc: "Fondo de alternativa marcada" },
  { key: "progress", label: "Barra de progreso", desc: "Color del avance superior" },
  { key: "progressTrack", label: "Fondo progreso", desc: "Base detrás de la barra" },
] as const

// ─────────────────────────────────────────────────────────────────────────────
export default function EditarExamenPage() {
  const params    = useParams()
  const examId    = params.id as string
  const router    = useRouter()
  const supabase  = createClient()

  const [user,         setUser]         = useState<any>(null)
  const [loadingInit,  setLoadingInit]  = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [busyQuestion, setBusy]         = useState<number | null>(null)
  const [error,        setError]        = useState("")
  const [copied,       setCopied]       = useState(false)

  const [title,        setTitle]        = useState("")
  const [topic,        setTopic]        = useState("")
  const [instructions, setInstructions] = useState("")
  const [questions,    setQuestions]    = useState<ExamQuestion[]>([])
  const [settings,     setSettings]     = useState<any>(null)
  const [examCode,     setExamCode]     = useState("")
  const [status,       setStatus]       = useState("")
  const [openQuestion,setOpenQuestion]=useState<number|null>(0)
  const {verify:verifyPython,busy:pythonBusy}=useExamPythonVerification()
  const [pythonResults,setPythonResults]=useState<Record<string,{signature:string;data:PythonResult}>>({})
  const [pythonError,setPythonError]=useState("")
  const questionsRef=useRef(questions);questionsRef.current=questions
  const attempted=useRef<Record<string,string>>({})
  const inFlight=useRef(false)
  const mathExam=/matem[aá]tica|f[ií]sica|qu[ií]mica|ciencias|tales/i.test(String(settings?.curriculum?.subject||settings?.curriculum?.asignatura||settings?.subject||topic))
  const needsPython=(q:ExamQuestion)=>mathExam||["math","text_math","math_steps"].includes(q.responseMode||"")||Boolean(q.correctionReview?.required)||examAnswerConsistencyIssues(q).length>0
  const verifyQuestions=async(items:ExamQuestion[])=>{
    if(inFlight.current)return null
    inFlight.current=true;setPythonError("")
    for(const q of items)attempted.current[q.id!]=correctionSignature(q)
    try{
      const results:PythonResult[]=[]
      for(let i=0;i<items.length;i+=100)results.push(...await verifyPython(items.slice(i,i+100)))
      if(results.some((result,i)=>result.id!==items[i].id))throw Error("Python devolvió una respuesta que no corresponde a la pregunta.")
      const records=Object.fromEntries(results.map((data,i)=>[items[i].id!,{signature:correctionSignature(items[i]),data}]))
      setPythonResults(old=>({...old,...records}))
      setQuestions(old=>old.map(q=>records[q.id!]?.signature===correctionSignature(q)&&records[q.id!].data.status==="incorrect"&&!needsCorrectionConfirmation(q)?{...q,correctionReview:{required:true as const}}:q))
      return results
    }catch(e){setPythonError(e instanceof Error?e.message:"No se pudo comprobar con Python.");return null}
    finally{inFlight.current=false}
  }
  useEffect(()=>{
    if(loadingInit||saving||pythonBusy||inFlight.current)return
    const timer=window.setTimeout(()=>{
      const pending=questionsRef.current.filter(q=>needsPython(q)&&q.question.trim()&&attempted.current[q.id!]!==correctionSignature(q))
      if(pending.length)void verifyQuestions(pending)
    },850)
    return ()=>window.clearTimeout(timer)
  },[questions,loadingInit,saving,pythonBusy,mathExam])
  function applyProposal(q:ExamQuestion,fields:NonNullable<PythonResult["proposal"]>["fields"]){
    if(pythonResults[q.id!]?.signature!==correctionSignature(q)||!window.confirm("¿Aplicar la propuesta de Python? Se conservará la rúbrica y el enunciado."))return
    setQuestions(old=>old.map(item=>item.id===q.id&&correctionSignature(item)===correctionSignature(q)?enrichQuestionAnswerKey({...item,...fields,correctionReview:{required:true}}):item))
  }
  function confirmCorrection(q:ExamQuestion){
    const record=pythonResults[q.id!],signature=correctionSignature(q)
    if(!record||record.signature!==signature||record.data.status==="incorrect"||examAnswerConsistencyIssues(q).length||q.qualityStatus==="review")return
    setQuestions(old=>old.map(item=>item.id===q.id&&correctionSignature(item)===signature?{...item,correctionReview:{required:true,confirmedSignature:signature}}:item))
  }

  // ── Cargar examen ──────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/login"); return }
      setUser(user)
      loadExam()
    })
  }, [])

  async function loadExam() {
    try {
      const res  = await fetch(`/api/agents/examen-docente?examId=${examId}`)
      const data = await res.json()
      if (!data.exam) throw new Error("Examen no encontrado")
      const exam = data.exam
      setTitle(exam.title || "")
      setTopic(exam.topic || "")
      setInstructions(exam.instructions || "")
      setQuestions(Array.isArray(exam.questions) ? exam.questions.map((q: any,i:number) => enrichQuestionAnswerKey({...q,id:typeof q.id==="string"&&q.id?q.id:`edit-${i+1}`}) as ExamQuestion) : [])
      setSettings(exam.settings || {})
      setExamCode(exam.code || "")
      setStatus(exam.status || "active")
    } catch (e: any) {
      setError(e.message || "Error cargando el examen")
    } finally {
      setLoadingInit(false)
    }
  }

  function updateSetting(key: string, value: unknown) {
    setSettings((prev: any) => ({ ...(prev || {}), [key]: value }))
  }


  const activeColors = useMemo(() => {
    return { ...CALM_GREEN_COLORS, ...(settings?.customColors || {}) }
  }, [settings?.customColors])

  function applyCalmGreenPalette() {
    setSettings((prev: any) => ({
      ...(prev || {}),
      theme: "green_calm",
      customColorsEnabled: true,
      customColors: { ...CALM_GREEN_COLORS },
    }))
  }

  function updateExamColor(key: keyof typeof CALM_GREEN_COLORS, value: string) {
    setSettings((prev: any) => ({
      ...(prev || {}),
      theme: prev?.theme || "green_calm",
      customColorsEnabled: true,
      customColors: {
        ...CALM_GREEN_COLORS,
        ...(prev?.customColors || {}),
        [key]: value,
      },
    }))
  }

  function disableCustomPalette() {
    setSettings((prev: any) => ({
      ...(prev || {}),
      customColorsEnabled: false,
    }))
  }

  // ── Guardar cambios ───────────────────────────────────────────────────────
  async function saveCourseAssignments(){
    if(!user||!assignedCourses(settings).length)return
    setSaving(true);setError("");setSaved(false)
    try{
      const res=await fetch("/api/agents/examen-docente",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"update",examId,teacherId:user.id,settings})})
      const data=await res.json()
      if(!res.ok||!data.success)throw Error(data.error||"No se pudieron guardar los cursos.")
      setSaved(true)
    }catch(e){setError(e instanceof Error?e.message:"No se pudieron guardar los cursos.")}
    finally{setSaving(false)}
  }
  async function saveChanges() {
    if (!user || inFlight.current || pythonBusy) return
    setSaving(true); setError(""); setSaved(false)
    try {
      const snapshot=questionsRef.current
      const pending=snapshot.findIndex(q=>needsCorrectionConfirmation(q,examAnswerConsistencyIssues(q)))
      if(pending>=0){setOpenQuestion(pending);throw Error("Pregunta "+(pending+1)+": revisa la corrección y presiona Corregido antes de guardar.")}
      const candidates=snapshot.filter(needsPython)
      if(candidates.length){
        const checked=await verifyQuestions(candidates)
        if(!checked)throw Error("No se pudo ejecutar Python. Reintenta la verificación antes de guardar.")
        const wrong=checked.find(result=>result.status==="incorrect")
        if(wrong){setOpenQuestion(snapshot.findIndex(q=>q.id===wrong.id));throw Error("Python detectó errores. Revisa las preguntas marcadas antes de guardar.")}
        if(JSON.stringify(snapshot.map(correctionSignature))!==JSON.stringify(questionsRef.current.map(correctionSignature)))throw Error("Las preguntas cambiaron durante la revisión. Guarda nuevamente.")
      }
      const res  = await fetch("/api/agents/examen-docente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          examId,
          teacherId: user.id,
          title,
          instructions,
          questions:snapshot.map(q=>{const payload=enrichQuestionAnswerKey(q);return q.correctionReview?.required?{...payload,correctionReview:{required:true,confirmedSignature:q.correctionReview.confirmedSignature===correctionSignature(q)?correctionSignature(payload):undefined}}:payload}),
          settings: { ...settings, questionCount: snapshot.length, totalPoints },
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || "No se pudo guardar")
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) {
      setError(e.message)
      window.requestAnimationFrame(()=>document.getElementById("edit-global-error")?.scrollIntoView({block:"center",behavior:"smooth"}))
    } finally {
      setSaving(false)
    }
  }

  // ── Editar pregunta ───────────────────────────────────────────────────────
  function updateQuestion(idx: number, patch: Partial<ExamQuestion>) {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== idx) return q
      const merged = { ...q, ...patch }
      if(q.correctionReview?.required||examAnswerConsistencyIssues(q).length||examAnswerConsistencyIssues(merged).length){merged.correctionReview={required:true,confirmedSignature:correctionSignature(q)===correctionSignature(merged)?q.correctionReview?.confirmedSignature:undefined}}

      if (merged.type === "true_false") {
        const sel = clampPositive(Number(merged.selectionPoints), 1) || 1
        const max = clampPositive(Number(merged.maxPoints), sel)
        return enrichEditable({ ...merged, selectionPoints: sel, maxPoints: max, justificationMaxPoints: Math.max(0, max - sel) })
      }
      if (merged.type === "development" || merged.type === "mixed_choice_development") {
        const rubric = Array.isArray(merged.rubric) ? merged.rubric : []
        if (rubric.length > 0) {
          const sum = rubric.reduce((acc, r) => acc + clampPositive(Number(r.points), 0), 0)
          return enrichEditable({ ...merged, rubric, ...(merged.type==="mixed_choice_development"?{developmentMaxPoints:sum,maxPoints:sum+(merged.selectionPoints||1)}:{maxPoints:sum||clampPositive(Number(merged.maxPoints),1)}) })
        }
      }
      return enrichEditable({ ...merged, maxPoints: clampPositive(Number(merged.maxPoints), 1) })
    }))
  }

  function removeQuestion(idx: number) {
    if(!window.confirm("¿Eliminar esta pregunta? Los cambios se aplicarán al guardar."))return
    setQuestions(prev => prev.filter((_, i) => i !== idx))
    setOpenQuestion(null)
  }

  // ── Regenerar con IA ──────────────────────────────────────────────────────
  async function regenerateQuestion(idx: number, overrides?: { difficulty?: 1|2|3; ability?: Ability }) {
    const current = questions[idx]
    if (!current) return
    setBusy(idx); setError("")

    const nextDiff    = overrides?.difficulty || current.difficulty || 2
    const nextAbility = overrides?.ability    || current.ability    || "comprension"
    const scoreMode: ScoreMode = settings?.scoreMode || "auto"

    const prompt = `Regenera SOLO una pregunta de examen junto con su pauta completa en JSON válido.

Tema: ${topic}
Contexto: ${settings?.teachingContext || "No especificado"}
Tipo requerido: ${current.type}
Dificultad: ${difficultyLabel(nextDiff)}
Habilidad: ${abilityOptions.find(a => a.id === nextAbility)?.label}
Pregunta anterior (NO repetir): ${current.question}

Reglas:
- Devuelve SOLO JSON con {"question": {...}}.
- Genera pregunta y respuesta dentro del mismo objeto para conservar coherencia.
- Si es multiple_choice: 4 options diferentes y plausibles, correctAnswer como índice 0-3, answerText idéntico a options[correctAnswer], explanation, solutionSteps y distractorRationales con 4 elementos.
- Si es true_false: options ["Verdadero","Falso"], correctAnswer 0 o 1, answerText, explanation, solutionSteps, selectionPoints=1 y justificationMaxPoints.
- Si es development: modelAnswer completo, expectedLatex si corresponde, explanation, solutionSteps, rubric con criteria y points, maxPoints.
- LaTeX solo entre $...$ (inline) o $$...$$ (bloque). Sin \( \) ni \[ \].
- Revisa antes de responder que la alternativa correcta tenga sentido con el ejercicio.`

    try {
      const res  = await fetch("/api/agents/exam-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, mode: "single" }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || "No se pudo regenerar")

      const raw = data.question ?? data.output?.data
      const rawQ =
        (raw?.question && typeof raw.question === "object") ? raw.question
        : Array.isArray(raw?.questions) ? raw.questions[0]
        : typeof raw === "object" && raw?.type ? raw
        : raw

      if (!rawQ) throw new Error("La IA no devolvió una pregunta válida")

      // Normalizar manteniendo el maxPoints original
      const normalizedQ: ExamQuestion = {
        ...current,
        type:        current.type,
        question:    rawQ.question    || current.question,
        answerText:   rawQ.answerText || rawQ.correctAnswerText || "",
        explanation: rawQ.explanation || "",
        solutionSteps: Array.isArray(rawQ.solutionSteps) ? rawQ.solutionSteps : [],
        distractorRationales: Array.isArray(rawQ.distractorRationales) ? rawQ.distractorRationales : [],
        difficulty:  rawQ.difficulty  || nextDiff,
        ability:     rawQ.ability     || nextAbility,
        maxPoints:   current.maxPoints,
      }

      if (normalizedQ.type !== "development") {
        const options =
          Array.isArray(rawQ.options) && rawQ.options.length > 0
            ? rawQ.options.map((o: any) => String(o))
            : normalizedQ.type === "true_false"
              ? ["Verdadero", "Falso"]
              : ["Opción A", "Opción B", "Opción C", "Opción D"]
        
        normalizedQ.options = options
        
        const ca  = rawQ.correctAnswer
        
        normalizedQ.correctAnswer = normalizeAnswerIndex(ca, options)
      }

      if (normalizedQ.type === "true_false") {
        normalizedQ.selectionPoints        = rawQ.selectionPoints        || 1
        normalizedQ.justificationMaxPoints = rawQ.justificationMaxPoints || 2
      }

      if (normalizedQ.type === "development" || normalizedQ.type === "mixed_choice_development") {
        normalizedQ.modelAnswer = rawQ.modelAnswer || ""
        normalizedQ.expectedLatex = rawQ.expectedLatex || rawQ.expected_latex || ""
        normalizedQ.rubric      = Array.isArray(rawQ.rubric) ? rawQ.rubric : []
      }

      updateQuestion(idx, enrichQuestionAnswerKey(normalizedQ) as ExamQuestion)
    } catch (e: any) {
      setError(e.message || "Error al regenerar la pregunta")
    } finally {
      setBusy(null)
    }
  }

  // ── Copiar link ───────────────────────────────────────────────────────────
  function copyLink() {
    const url = `${window.location.origin}/examen/p/${examCode}`
    navigator.clipboard?.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const totalPoints = useMemo(
    () => questions.reduce((acc, q) => acc + getQuestionMaxPoints(q), 0),
    [questions]
  )

  // ── Loading / Error ───────────────────────────────────────────────────────
  if (loadingInit) return (
    <div className="min-h-screen bg-app flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-soft border-t-blue-400 animate-spin" />
    </div>
  )

  if (!questions.length && !loadingInit && error) return (
    <div className="min-h-screen bg-app flex flex-col items-center justify-center gap-4">
      <p className="text-red-400 text-sm">{error}</p>
      <Link href="/examen/docente" className="text-muted2 hover:text-main text-sm">← Volver al panel</Link>
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-app text-main">

      {/* Header sticky */}
      <header className="sticky top-0 z-20 border-b border-soft bg-header-theme backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
          <Link href="/examen/docente"
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-card-soft-theme text-sub hover:text-main transition-all flex-shrink-0">
            <ArrowLeft size={15} />
          </Link>

          <div className="flex-1 min-w-0">
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-transparent text-main font-bold text-sm focus:outline-none truncate"
              placeholder="Título del examen..."
            />
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-muted2 text-[11px]">{topic}</span>
              <span className="text-muted2">·</span>
              <span className="text-muted2 text-[11px]">{questions.length} preguntas</span>
              <span className="text-muted2">·</span>
              <span className="text-muted2 text-[11px]">{totalPoints} pts</span>
              <span className="text-muted2">·</span>
              <span className={`text-[11px] ${status === "active" ? "text-green-400" : "text-muted2"}`}>
                {status === "active" ? "Activo" : "Cerrado"}
              </span>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={copyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all"
              style={{ background: "rgba(59,130,246,0.08)", borderColor: "rgba(59,130,246,0.25)", color: copied ? "#4ade80" : "#93c5fd" }}>
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "¡Copiado!" : "Copiar link"}
            </button>
            <button onClick={saveChanges} disabled={saving||pythonBusy}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: saved ? "#16a34a" : "#2563eb", boxShadow: "0 2px 8px rgba(37,99,235,0.3)" }}>
              {saving
                ? <><Loader2 size={12} className="animate-spin" /> Guardando...</>
                : saved
                  ? <><Check size={12} /> Guardado</>
                  : <><Save size={12} /> Guardar cambios</>}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4 pb-12">

        {/* Instrucciones */}
        <div className="rounded-2xl p-4 border" style={{ background: "var(--bg-card-soft)", borderColor: "var(--bg-card-soft)" }}>
          <label className="text-muted2 text-[10px] font-semibold uppercase tracking-widest block mb-2">
            Instrucciones para los estudiantes
          </label>
          <ExamVisualEditor
            value={instructions}
            onChange={e => setInstructions(e.target.value)}
            placeholder="Ej: Justifica tus respuestas y muestra procedimiento..."
            className="w-full min-h-24 bg-card-soft-theme border border-soft rounded-xl px-4 py-3 text-base" disabled={saving}
          />
        </div>

        <section id="cursos-asignados" className="rounded-2xl border border-soft bg-card-soft-theme p-4 space-y-3">
          <CourseAssignmentPicker value={assignedCourses(settings)} disabled={saving} onChange={courses=>setSettings((prev:any)=>({...prev,rosterCourses:courses,rosterCourse:courses[0]||""}))}/>
          <button type="button" disabled={saving||!assignedCourses(settings).length} onClick={()=>void saveCourseAssignments()} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Guardar cursos sin modificar preguntas</button>
          <p className="text-xs text-muted2">Se conserva el mismo enlace, preguntas y entregas existentes.</p>
        </section>
        <details className="rounded-2xl border border-soft bg-card-soft-theme p-4"><summary className="cursor-pointer font-semibold text-sm">Configuración adicional · recursos y diseño</summary><div className="mt-3 space-y-3">
        {/* Configuración del examen */}
        <div className="rounded-2xl p-4 border" style={{ background: "var(--bg-card-soft)", borderColor: "var(--bg-card-soft)" }}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-main text-sm font-bold">🧮 Calculadora científica de la página</p>
              <p className="text-muted2 text-xs mt-1 leading-relaxed">
                Actívala solo cuando el docente autorice que los estudiantes usen la calculadora interna del examen.
                Si queda apagada, el botón de calculadora no aparecerá durante la prueba.
              </p>
            </div>
            <label className="flex items-center gap-3 rounded-2xl border border-soft bg-card-soft-theme px-4 py-3 text-sm font-semibold text-sub cursor-pointer">
              <input
                type="checkbox"
                checked={settings?.allowCalculator === true}
                onChange={(e) => updateSetting("allowCalculator", e.target.checked)}
              />
              {settings?.allowCalculator === true ? "Calculadora autorizada" : "Calculadora no autorizada"}
            </label>
          </div>
        </div>


        {/* Colores solo para esta prueba */}
        <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-bold text-emerald-950">🎨 Diseño y colores de esta prueba</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Estos colores se guardan dentro de este examen. No cambian las demás pruebas creadas.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={applyCalmGreenPalette}
                className="rounded-xl bg-emerald-100 px-3 py-2 text-xs font-black text-emerald-800 hover:bg-emerald-200"
              >
                Aplicar calma verde
              </button>
              <button
                type="button"
                onClick={disableCustomPalette}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Desactivar personalizados
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {EDIT_COLOR_FIELDS.map((field) => {
              const value = activeColors[field.key]
              return (
                <label key={field.key} className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800">{field.label}</span>
                    <span className="h-7 w-7 rounded-full border border-white shadow-inner" style={{ backgroundColor: value }} />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={value}
                      onChange={(event) => updateExamColor(field.key, event.target.value)}
                      className="h-10 w-12 cursor-pointer rounded-lg border border-emerald-100 bg-white p-1"
                    />
                    <input
                      value={value}
                      onChange={(event) => updateExamColor(field.key, event.target.value)}
                      className="min-w-0 flex-1 rounded-xl border border-emerald-100 bg-white px-3 py-2 font-mono text-xs text-slate-700 outline-none focus:border-emerald-400"
                    />
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-slate-500">{field.desc}</p>
                </label>
              )
            })}
          </div>

          <div
            className="mt-4 rounded-2xl border p-4"
            style={{
              background: `linear-gradient(135deg, ${activeColors.background}, ${activeColors.soft})`,
              borderColor: activeColors.border,
              color: activeColors.text,
            }}
          >
            <div className="rounded-2xl border bg-white p-4" style={{ borderColor: activeColors.border }}>
              <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: activeColors.accent }}>
                Vista previa tranquila
              </p>
              <p className="mt-2 text-sm font-bold">Pregunta con fondo blanco y tonos verdes suaves</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ backgroundColor: activeColors.progressTrack }}>
                <div className="h-full w-2/5 rounded-full" style={{ backgroundColor: activeColors.progress }} />
              </div>
              <div className="mt-3 rounded-xl border px-3 py-2 text-xs font-bold" style={{ backgroundColor: activeColors.accentSoft, borderColor: activeColors.accent, color: activeColors.accent }}>
                Alternativa seleccionada sin color crema
              </div>
            </div>
          </div>
        </div>

        </div></details>
        {/* Error global */}
        {error && (
          <div id="edit-global-error" role="alert" className="flex items-center gap-2 px-4 py-3 rounded-xl border border-red-500/25" style={{ background: "rgba(239,68,68,0.08)" }}>
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">Preguntas y pauta</h2><button type="button" disabled={pythonBusy||saving} onClick={()=>void verifyQuestions(questionsRef.current)} className="rounded-xl border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 disabled:opacity-40">{pythonBusy?"Verificando…":"Verificar todas con Python"}</button></div>
        {pythonError&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{pythonError}</p>}
        {questions.map((q,i)=>{
          const editing=openQuestion===i
          const constructed=q.type==="development"||q.type==="mixed_choice_development"
          const issues=examAnswerConsistencyIssues(q)
          const required=needsCorrectionConfirmation(q,issues)
          const field="w-full min-h-20 rounded-xl border border-soft bg-card-soft-theme px-4 py-3 text-base text-main"
          const label="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted2"
          return <article key={q.id} className="space-y-4 rounded-2xl border border-soft bg-card-theme p-4 sm:p-6" id={"edit-question-"+i}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold">Pregunta {i+1}</span><span className="text-xs text-muted2">{questionTypeLabel(q.type)} · {getQuestionMaxPoints(q)} pts</span>
              {required&&<span className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900">Revisión pendiente</span>}
              <div className="ml-auto flex gap-2"><button type="button" onClick={()=>setOpenQuestion(editing?null:i)} aria-expanded={editing} className="rounded-xl border border-soft px-3 py-2 text-xs font-semibold">{editing?"Plegar ↑":"Editar ↓"}</button><button type="button" disabled={saving||busyQuestion!==null} onClick={()=>removeQuestion(i)} title="Eliminar pregunta" className="rounded-xl border border-red-200 px-3 py-2 text-red-600"><Trash2 size={15}/></button></div>
            </div>
            {!editing?<div className="rounded-xl bg-card-soft-theme p-3 text-sm"><ExamMathText text={q.question}/></div>:<div className="space-y-4">
              <ExamCorrectionPanel q={q} issues={issues} required={required} result={pythonResults[q.id!]} busy={pythonBusy||saving} qualityReady={q.qualityStatus!=="review"} onVerify={()=>void verifyQuestions([q])} onApply={fields=>applyProposal(q,fields)} onConfirm={()=>confirmCorrection(q)}/>
              <div><label className={label}>Enunciado</label><ExamVisualEditor value={q.question} onChange={e=>updateQuestion(i,{question:e.target.value})} placeholder="Enunciado de la pregunta" className={field+" !min-h-36"}/></div>
              {q.type!=="development"&&<div className="space-y-2"><label className={label}>Alternativas · marca la correcta</label>{(q.options||[]).map((opt,j)=><div key={j} className="grid grid-cols-[40px_minmax(0,1fr)] items-start gap-2"><button type="button" onClick={()=>updateQuestion(i,{correctAnswer:j})} className={"mt-6 rounded-lg border p-2 text-sm font-bold "+(j===q.correctAnswer?"border-emerald-400 bg-emerald-50 text-emerald-700":"border-soft")} aria-label={"Marcar alternativa "+(j+1)+" como correcta"}>{j===q.correctAnswer?"✓":String.fromCharCode(65+j)}</button><ExamVisualEditor value={opt} disabled={q.type==="true_false"} onChange={e=>{const options=[...(q.options||[])];options[j]=e.target.value;updateQuestion(i,{options})}} className={field} placeholder={"Alternativa "+(j+1)}/></div>)}</div>}
              {constructed&&<><div><label className={label}>Respuesta esperada</label><ExamVisualEditor value={q.modelAnswer||""} onChange={e=>updateQuestion(i,{modelAnswer:e.target.value})} placeholder="Desarrolla la solución esperada" className={field+" !min-h-44"}/></div><div><label className={label}>Resultado final (opcional)</label><ExamVisualEditor value={q.expectedLatex||""} onChange={e=>updateQuestion(i,{expectedLatex:e.target.value})} placeholder="Resultado final de la pregunta" className={field+" !min-h-24"}/></div></>}
              <details className="rounded-xl border border-soft p-3"><summary className="cursor-pointer text-sm font-semibold">Pauta ampliada · editar explicación y procedimiento</summary><div className="mt-3 space-y-3"><div><label className={label}>Explicación de la pauta</label><ExamVisualEditor value={q.explanation||""} onChange={e=>updateQuestion(i,{explanation:e.target.value})} placeholder="Explica el fundamento de la solución" className={field+" !min-h-32"}/></div><div><label className={label}>Pasos esperados</label><ExamVisualEditor value={(q.solutionSteps||[]).join("\n")} onChange={e=>updateQuestion(i,{solutionSteps:e.target.value.split("\n")})} placeholder="Un paso por línea" className={field+" !min-h-40"}/></div></div></details>
              {constructed&&<div className="space-y-3 rounded-xl border border-soft p-3"><label className={label}>Rúbrica</label>{(q.rubric||[]).map((item,j)=><div key={j} className="grid grid-cols-[minmax(0,1fr)_64px_auto] items-start gap-2"><ExamVisualEditor value={item.criteria} onChange={e=>updateQuestion(i,{rubric:(q.rubric||[]).map((r,k)=>k===j?{...r,criteria:e.target.value}:r)})} placeholder="Criterio de evaluación" className={field}/><label className="text-xs text-muted2">Pts<input type="number" min={0} step={0.5} value={item.points} onChange={e=>updateQuestion(i,{rubric:(q.rubric||[]).map((r,k)=>k===j?{...r,points:clampPositive(Number(e.target.value),0)}:r)})} className="mt-1 w-full rounded-xl border border-soft bg-card-soft-theme p-2 text-sm"/></label><button type="button" className="mt-5 rounded-lg border border-red-200 px-2 py-2 text-xs text-red-600" onClick={()=>updateQuestion(i,{rubric:(q.rubric||[]).filter((_,k)=>k!==j)})}>Quitar</button></div>)}<button type="button" onClick={()=>updateQuestion(i,{rubric:[...(q.rubric||[]),{criteria:"Nuevo criterio",points:1}]})} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white">+ Agregar criterio</button><p className="text-xs text-muted2">Puntaje total: {getQuestionMaxPoints(q)}</p></div>}
              <details className="rounded-xl border border-soft p-3"><summary className="cursor-pointer text-sm font-semibold">Opciones adicionales · material y configuración</summary><div className="mt-3 space-y-3">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={q.showStimulusToStudent===true} onChange={e=>updateQuestion(i,{showStimulusToStudent:e.target.checked})}/> Mostrar material de apoyo al estudiante</label>
                <ExamVisualEditor value={q.stimulusTitle||""} onChange={e=>updateQuestion(i,{stimulusTitle:e.target.value})} placeholder="Título del material de apoyo" className={field}/>
                <ExamVisualEditor value={q.stimulusText||""} onChange={e=>updateQuestion(i,{stimulusText:e.target.value})} placeholder="Texto o datos de apoyo" className={field+" !min-h-28"}/>
                <label className="block text-xs font-semibold">Imagen (URL)<input value={q.imageUrl||""} onChange={e=>updateQuestion(i,{imageUrl:e.target.value})} className="mt-1 w-full rounded-xl border border-soft bg-card-soft-theme p-3 text-sm" placeholder="https://..."/></label>
                {constructed&&<label className="block text-xs font-semibold">Forma de respuesta<select value={q.responseMode||"long_text"} onChange={e=>updateQuestion(i,{responseMode:e.target.value})} className="mt-1 w-full rounded-xl border border-soft bg-card-soft-theme p-3 text-sm">{[["short_text","Respuesta breve"],["long_text","Respuesta abierta"],["math","Matemática"],["text_math","Texto + matemática"],["math_steps","Procedimiento"]].map(([value,name])=><option key={value} value={value}>{name}</option>)}</select></label>}
                <div className="grid gap-3 sm:grid-cols-3"><label className="text-xs font-semibold">Dificultad<select value={q.difficulty||2} onChange={e=>updateQuestion(i,{difficulty:Number(e.target.value) as 1|2|3})} className="mt-1 w-full rounded-xl border border-soft bg-card-soft-theme p-3 text-sm"><option value={1}>Fácil</option><option value={2}>Medio</option><option value={3}>Difícil</option></select></label><label className="text-xs font-semibold">Habilidad<select value={q.ability||"aplicacion"} onChange={e=>updateQuestion(i,{ability:e.target.value as Ability})} className="mt-1 w-full rounded-xl border border-soft bg-card-soft-theme p-3 text-sm">{abilityOptions.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}</select></label><label className="text-xs font-semibold">Puntaje<input type="number" min={0} step={0.5} value={getQuestionMaxPoints(q)} disabled={constructed&&Boolean(q.rubric?.length)} onChange={e=>updateQuestion(i,{maxPoints:clampPositive(Number(e.target.value),0)})} className="mt-1 w-full rounded-xl border border-soft bg-card-soft-theme p-3 text-sm"/></label></div>
                {q.type==="true_false"&&<label className="block text-xs font-semibold">Puntaje de selección<input type="number" min={0} step={0.5} value={q.selectionPoints||1} onChange={e=>updateQuestion(i,{selectionPoints:clampPositive(Number(e.target.value),1)})} className="mt-1 w-full rounded-xl border border-soft bg-card-soft-theme p-3 text-sm"/></label>}
                <button type="button" disabled={busyQuestion!==null||saving} onClick={()=>{if(window.confirm("¿Regenerar esta pregunta con IA? Se reemplazará su contenido."))void regenerateQuestion(i)}} className="rounded-xl border border-soft px-3 py-2 text-xs font-semibold disabled:opacity-50">{busyQuestion===i?"Generando…":"Regenerar con IA (opcional)"}</button>
              </div></details>
            </div>}
          </article>
        })}

        {/* Guardar al final, sin tapar campos */}
        <div className="flex justify-end pt-2">
          <button onClick={saveChanges} disabled={saving||pythonBusy}
            className="flex items-center gap-2 px-8 py-3 rounded-2xl text-sm font-bold text-white shadow-xl transition-all disabled:opacity-50"
            style={{ background: saved ? "#16a34a" : "#2563eb", boxShadow: "0 4px 20px rgba(37,99,235,0.4)" }}>
            {saving
              ? <><Loader2 size={15} className="animate-spin" /> Guardando...</>
              : saved
                ? <><Check size={15} /> ¡Cambios guardados!</>
                : <><Save size={15} /> Guardar todos los cambios</>}
          </button>
        </div>
      </div>
    </div>
  )
}
