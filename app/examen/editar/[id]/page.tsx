"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import ExamMathText from "@/components/ui/ExamMathText"
import { ArrowLeft, Save, RefreshCw, Loader2, Copy, Check, Trash2, Plus } from "lucide-react"

// ── Tipos (mismos que crear/page.tsx) ────────────────────────────────────────
type ScoreMode = "auto" | "manual"
type Ability   = "recuerdo" | "comprension" | "aplicacion" | "analisis" | "argumentacion"

type ExamQuestion = {
  type: "multiple_choice" | "true_false" | "development"
  question: string
  options?: string[]
  correctAnswer?: number
  explanation?: string
  difficulty?: 1 | 2 | 3
  ability?: Ability
  modelAnswer?: string
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

function clampPositive(n: number, fallback = 1) {
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.round(n * 10) / 10)
}

function questionTypeLabel(type: ExamQuestion["type"]) {
  if (type === "multiple_choice") return "Alternativas"
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
      setQuestions(Array.isArray(exam.questions) ? exam.questions : [])
      setSettings(exam.settings || {})
      setExamCode(exam.code || "")
      setStatus(exam.status || "active")
    } catch (e: any) {
      setError(e.message || "Error cargando el examen")
    } finally {
      setLoadingInit(false)
    }
  }

  // ── Guardar cambios ───────────────────────────────────────────────────────
  async function saveChanges() {
    if (!user) return
    setSaving(true); setError(""); setSaved(false)
    try {
      const res  = await fetch("/api/agents/examen-docente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          examId,
          teacherId: user.id,
          title,
          instructions,
          questions,
          settings: { ...settings, questionCount: questions.length, totalPoints },
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || "No se pudo guardar")
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Editar pregunta ───────────────────────────────────────────────────────
  function updateQuestion(idx: number, patch: Partial<ExamQuestion>) {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== idx) return q
      const merged = { ...q, ...patch }

      if (merged.type === "true_false") {
        const sel = clampPositive(Number(merged.selectionPoints), 1) || 1
        const max = clampPositive(Number(merged.maxPoints), sel)
        return { ...merged, selectionPoints: sel, maxPoints: max, justificationMaxPoints: Math.max(0, max - sel) }
      }
      if (merged.type === "development") {
        const rubric = Array.isArray(merged.rubric) ? merged.rubric : []
        if (rubric.length > 0) {
          const sum = rubric.reduce((acc, r) => acc + clampPositive(Number(r.points), 0), 0)
          return { ...merged, rubric, maxPoints: sum || clampPositive(Number(merged.maxPoints), 1) }
        }
      }
      return { ...merged, maxPoints: clampPositive(Number(merged.maxPoints), 1) }
    }))
  }

  function removeQuestion(idx: number) {
    setQuestions(prev => prev.filter((_, i) => i !== idx))
  }

  // ── Regenerar con IA ──────────────────────────────────────────────────────
  async function regenerateQuestion(idx: number, overrides?: { difficulty?: 1|2|3; ability?: Ability }) {
    const current = questions[idx]
    if (!current) return
    setBusy(idx); setError("")

    const nextDiff    = overrides?.difficulty || current.difficulty || 2
    const nextAbility = overrides?.ability    || current.ability    || "comprension"
    const scoreMode: ScoreMode = settings?.scoreMode || "auto"

    const prompt = `Genera SOLO una pregunta de examen en JSON válido.

Tema: ${topic}
Contexto: ${settings?.teachingContext || "No especificado"}
Tipo requerido: ${current.type}
Dificultad: ${difficultyLabel(nextDiff)}
Habilidad: ${abilityOptions.find(a => a.id === nextAbility)?.label}
Pregunta anterior (NO repetir): ${current.question}

Reglas:
- Si es multiple_choice: 4 opciones A-D, una correcta, correctAnswer como índice 0-3.
- Si es true_false: opciones ["Verdadero","Falso"], selectionPoints=1, justificationMaxPoints, maxPoints.
- Si es development: modelAnswer, rubric con criteria y points, maxPoints.
- LaTeX solo entre $...$ (inline) o $$...$$ (bloque). Sin \\( \\) ni \\[ \\].
- Devuelve SOLO JSON, sin texto adicional.

Formato exacto:
{
  "question": {
    "type": "${current.type}",
    "question": "texto de la pregunta",
    "options": ["A","B","C","D"],
    "correctAnswer": 0,
    "explanation": "explicación",
    "difficulty": ${nextDiff},
    "ability": "${nextAbility}",
    "maxPoints": ${current.maxPoints || 1},
    "selectionPoints": 1,
    "justificationMaxPoints": 2,
    "modelAnswer": "",
    "rubric": []
  }
}`

    try {
      const res  = await fetch("/api/process-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType: "text", content: prompt, outputFormat: "quiz" }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || "No se pudo regenerar")

      const raw = data.output?.data
      const rawQ =
        (raw?.question && typeof raw.question === "object") ? raw.question
        : Array.isArray(raw?.questions) ? raw.questions[0]
        : typeof raw === "object" && raw?.type ? raw
        : null

      if (!rawQ) throw new Error("La IA no devolvió una pregunta válida")

      // Normalizar manteniendo el maxPoints original
      const normalizedQ: ExamQuestion = {
        type:        rawQ.type        || current.type,
        question:    rawQ.question    || current.question,
        explanation: rawQ.explanation || "",
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
        
        const max = Math.max(0, options.length - 1)
        const ca  = rawQ.correctAnswer
        
        normalizedQ.correctAnswer =
          typeof ca === "number" && Number.isFinite(ca)
            ? Math.max(0, Math.min(max, Math.round(ca)))
            : 0
      }

      if (normalizedQ.type === "true_false") {
        normalizedQ.selectionPoints        = rawQ.selectionPoints        || 1
        normalizedQ.justificationMaxPoints = rawQ.justificationMaxPoints || 2
      }

      if (normalizedQ.type === "development") {
        normalizedQ.modelAnswer = rawQ.modelAnswer || ""
        normalizedQ.rubric      = Array.isArray(rawQ.rubric) ? rawQ.rubric : []
      }

      updateQuestion(idx, normalizedQ)
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
    () => questions.reduce((acc, q) => acc + (q.maxPoints || 0), 0),
    [questions]
  )

  // ── Loading / Error ───────────────────────────────────────────────────────
  if (loadingInit) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-blue-400 animate-spin" />
    </div>
  )

  if (!questions.length && !loadingInit && error) return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
      <p className="text-red-400 text-sm">{error}</p>
      <Link href="/examen/docente" className="text-gray-500 hover:text-white text-sm">← Volver al panel</Link>
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">

      {/* Header sticky */}
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-gray-950/90 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/examen/docente"
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.06] text-gray-400 hover:text-white transition-all flex-shrink-0">
            <ArrowLeft size={15} />
          </Link>

          <div className="flex-1 min-w-0">
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-transparent text-white font-bold text-sm focus:outline-none truncate"
              placeholder="Título del examen..."
            />
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-gray-600 text-[11px]">{topic}</span>
              <span className="text-gray-700">·</span>
              <span className="text-gray-600 text-[11px]">{questions.length} preguntas</span>
              <span className="text-gray-700">·</span>
              <span className="text-gray-600 text-[11px]">{totalPoints} pts</span>
              <span className="text-gray-700">·</span>
              <span className={`text-[11px] ${status === "active" ? "text-green-400" : "text-gray-500"}`}>
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
            <button onClick={saveChanges} disabled={saving}
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

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">

        {/* Instrucciones */}
        <div className="rounded-2xl p-4 border" style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.07)" }}>
          <label className="text-gray-500 text-[10px] font-semibold uppercase tracking-widest block mb-2">
            Instrucciones para los estudiantes
          </label>
          <input
            value={instructions}
            onChange={e => setInstructions(e.target.value)}
            placeholder="Ej: Justifica tus respuestas y muestra procedimiento..."
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500/30"
          />
        </div>

        {/* Error global */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-red-500/25" style={{ background: "rgba(239,68,68,0.08)" }}>
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        )}

        {/* Lista de preguntas */}
        {questions.map((q, i) => (
          <div key={i}
            className="rounded-2xl border p-4 space-y-3"
            style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.07)" }}>

            {/* Badges + acciones */}
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                q.type === "multiple_choice" ? "bg-blue-500/10 text-blue-400"
                : q.type === "true_false"    ? "bg-green-500/10 text-green-400"
                : "bg-orange-500/10 text-orange-400"}`}>
                {questionTypeLabel(q.type)}
              </span>
              <span className={`text-[10px] ${difficultyColor(q.difficulty)}`}>
                {difficultyLabel(q.difficulty)}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300">
                {abilityOptions.find(a => a.id === q.ability)?.label || "Aplicación"}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 ml-auto">
                {q.maxPoints || 0} pts
              </span>
              <button onClick={() => removeQuestion(i)}
                className="text-gray-700 hover:text-red-400 transition-colors" title="Eliminar pregunta">
                <Trash2 size={13} />
              </button>
            </div>

            {/* Texto pregunta */}
            <div>
              <label className="text-gray-500 text-[10px] font-semibold uppercase tracking-widest block mb-1">
                {i + 1}. Pregunta
              </label>
              <textarea
                value={q.question}
                onChange={e => updateQuestion(i, { question: e.target.value })}
                rows={2}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500/30 resize-vertical"
              />
              {q.question && (q.question.includes("$") || q.question.includes("\\")) && (
                <div className="mt-1 px-3 py-1.5 rounded-lg bg-blue-500/5 border border-blue-500/10">
                  <p className="text-[10px] text-blue-400 mb-0.5">Vista previa LaTeX:</p>
                  <ExamMathText text={q.question} className="text-sm text-gray-300" />
                </div>
              )}
            </div>

            {/* Alternativas editables */}
            {q.type !== "development" && (
              <div>
                <label className="text-gray-500 text-[10px] font-semibold uppercase tracking-widest block mb-2">
                  {q.type === "true_false" ? "Opciones" : "Alternativas"}
                  <span className="text-gray-700 font-normal ml-2">— clic en la letra para marcar correcta</span>
                </label>
                <div className="space-y-1.5">
                  {(q.options || []).map((opt, j) => (
                    <div key={j} className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuestion(i, { correctAnswer: j })}
                        className={`w-7 h-7 rounded-lg flex-shrink-0 text-xs font-bold transition-all ${
                          j === q.correctAnswer
                            ? "bg-green-500/20 border border-green-500/40 text-green-400"
                            : "bg-white/[0.04] border border-white/[0.08] text-gray-600 hover:text-gray-300"}`}
                        title={j === q.correctAnswer ? "Correcta" : "Marcar como correcta"}>
                        {j === q.correctAnswer ? "✓" : q.type === "true_false" ? (j === 0 ? "V" : "F") : String.fromCharCode(65 + j)}
                      </button>
                      <input
                        value={opt}
                        disabled={q.type === "true_false"}
                        onChange={e => {
                          const options = [...(q.options || [])]
                          options[j] = e.target.value
                          updateQuestion(i, { options })
                        }}
                        className={`flex-1 bg-white/[0.04] border rounded-xl px-3 py-2 text-xs focus:outline-none transition-all ${
                          j === q.correctAnswer
                            ? "border-green-500/30 text-green-300 focus:border-green-500/50"
                            : "border-white/[0.08] text-gray-300 focus:border-blue-500/30"
                        } ${q.type === "true_false" ? "opacity-60 cursor-not-allowed" : ""}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Explicación */}
            {q.type !== "development" && (
              <div>
                <label className="text-gray-500 text-[10px] font-semibold uppercase tracking-widest block mb-1">Explicación (opcional)</label>
                <input
                  value={q.explanation || ""}
                  onChange={e => updateQuestion(i, { explanation: e.target.value })}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500/30"
                  placeholder="Explica por qué esta respuesta es correcta..."
                />
              </div>
            )}

            {/* Desarrollo: respuesta modelo */}
            {q.type === "development" && (
              <div>
                <label className="text-gray-500 text-[10px] font-semibold uppercase tracking-widest block mb-1">Respuesta modelo</label>
                <textarea
                  value={q.modelAnswer || ""}
                  onChange={e => updateQuestion(i, { modelAnswer: e.target.value })}
                  rows={3}
                  className="w-full bg-orange-500/[0.04] border border-orange-500/20 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-orange-500/40 resize-vertical"
                  placeholder="Respuesta modelo para que la IA evalúe..."
                />
              </div>
            )}

            {/* Rúbrica desarrollo */}
            {q.type === "development" && q.rubric && q.rubric.length > 0 && (
              <div className="bg-white/[0.02] rounded-xl border border-white/[0.06] p-3">
                <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-widest mb-2">Rúbrica</p>
                <div className="space-y-2">
                  {q.rubric.map((item, rIdx) => (
                    <div key={rIdx} className="grid grid-cols-[1fr_80px] gap-2">
                      <input
                        value={item.criteria}
                        onChange={e => {
                          const rubric = [...(q.rubric || [])]
                          rubric[rIdx] = { ...rubric[rIdx], criteria: e.target.value }
                          updateQuestion(i, { rubric })
                        }}
                        className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500/30"
                      />
                      <input
                        type="number" min={0} step={0.5}
                        value={item.points}
                        onChange={e => {
                          const rubric = [...(q.rubric || [])]
                          rubric[rIdx] = { ...rubric[rIdx], points: clampPositive(Number(e.target.value), 0) }
                          updateQuestion(i, { rubric })
                        }}
                        className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500/30"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Controles: dificultad, habilidad, puntaje */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="text-gray-600 text-[10px] font-semibold block mb-1">Dificultad</label>
                <select value={q.difficulty || 2}
                  onChange={e => updateQuestion(i, { difficulty: Number(e.target.value) as 1|2|3 })}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-2 py-2 text-xs focus:outline-none">
                  <option value={1}>Fácil</option>
                  <option value={2}>Medio</option>
                  <option value={3}>Difícil</option>
                </select>
              </div>
              <div>
                <label className="text-gray-600 text-[10px] font-semibold block mb-1">Habilidad</label>
                <select value={q.ability || "aplicacion"}
                  onChange={e => updateQuestion(i, { ability: e.target.value as Ability })}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-2 py-2 text-xs focus:outline-none">
                  {abilityOptions.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-gray-600 text-[10px] font-semibold block mb-1">Puntaje</label>
                <input type="number" min={0} step={0.5}
                  value={q.maxPoints || 0}
                  onChange={e => updateQuestion(i, { maxPoints: clampPositive(Number(e.target.value), 0) })}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-2 py-2 text-xs focus:outline-none focus:border-blue-500/30"
                />
              </div>
              <div>
                <label className="text-gray-600 text-[10px] font-semibold block mb-1">IA</label>
                <button
                  onClick={() => regenerateQuestion(i)}
                  disabled={busyQuestion === i}
                  className="w-full bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] rounded-xl px-2 py-2 text-xs disabled:opacity-50 flex items-center justify-center gap-1.5 transition-all">
                  {busyQuestion === i
                    ? <><Loader2 size={11} className="animate-spin" /> Generando...</>
                    : <><RefreshCw size={11} /> Regenerar</>}
                </button>
              </div>
            </div>

            {/* Botones rápidos de regeneración */}
            {busyQuestion !== i && (
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "Más fácil",   diff: 1, cls: "bg-green-500/10 border-green-500/20 text-green-300"  },
                  { label: "Nivel medio", diff: 2, cls: "bg-yellow-500/10 border-yellow-500/20 text-yellow-300"},
                  { label: "Más difícil", diff: 3, cls: "bg-red-500/10 border-red-500/20 text-red-300"        },
                ].map(btn => (
                  <button key={btn.label}
                    onClick={() => regenerateQuestion(i, { difficulty: btn.diff as 1|2|3 })}
                    disabled={busyQuestion !== null}
                    className={`px-2.5 py-1.5 rounded-xl border text-[10px] font-medium disabled:opacity-40 transition-all ${btn.cls}`}>
                    {btn.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Botón guardar flotante al fondo */}
        <div className="sticky bottom-4 flex justify-center pt-2">
          <button onClick={saveChanges} disabled={saving}
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
