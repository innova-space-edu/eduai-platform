// app/examen/crear/page.tsx
// VERSIÓN FUSIONADA: Agente IA (Gemini→Groq) + Sistema de Seguridad Nuevo
"use client"

import { useMemo, useState, useRef } from "react"
import { useRouter } from "next/navigation"

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Difficulty    = "facil" | "medio" | "dificil" | "mixto"
type QuestionType  = "multiple_choice" | "true_false" | "development"
type AIStatus      = "idle" | "generating" | "done" | "error"

type MultipleChoiceQuestion = {
  id: string; type: "multiple_choice"
  question: string; options: string[]; correctAnswer: number
  explanation?: string; maxPoints?: number
}

type TrueFalseQuestion = {
  id: string; type: "true_false"
  question: string; correctAnswer: number
  explanation?: string; selectionPoints?: number
  justificationMaxPoints?: number; maxPoints?: number
}

type DevelopmentRubricItem = { criterion: string; points: number }

type DevelopmentQuestion = {
  id: string; type: "development"
  question: string; expectedAnswer?: string
  rubric: DevelopmentRubricItem[]; maxPoints?: number
}

type Question = MultipleChoiceQuestion | TrueFalseQuestion | DevelopmentQuestion

// ─── Helpers ──────────────────────────────────────────────────────────────────
function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function defaultQuestion(type: QuestionType): Question {
  if (type === "multiple_choice") {
    return { id: uid(), type: "multiple_choice", question: "", options: ["", "", "", ""], correctAnswer: 0, explanation: "", maxPoints: 1 }
  }
  if (type === "true_false") {
    return { id: uid(), type: "true_false", question: "", correctAnswer: 0, explanation: "", selectionPoints: 1, justificationMaxPoints: 2, maxPoints: 3 }
  }
  return {
    id: uid(), type: "development", question: "", expectedAnswer: "",
    rubric: [
      { criterion: "Comprensión del contenido", points: 2 },
      { criterion: "Desarrollo y fundamentación", points: 2 },
      { criterion: "Claridad de la respuesta",   points: 1 },
    ],
    maxPoints: 5,
  }
}

function getQuestionPoints(q: Question): number {
  if (q.type === "multiple_choice") return Math.max(1, Number(q.maxPoints || 1))
  if (q.type === "true_false") {
    return Math.max(0, Number(q.selectionPoints || 1)) + Math.max(0, Number(q.justificationMaxPoints || 2))
  }
  if (Array.isArray(q.rubric) && q.rubric.length > 0)
    return q.rubric.reduce((acc, r) => acc + (Number(r.points) || 0), 0)
  return Math.max(1, Number(q.maxPoints || 5))
}

// Normalizar preguntas crudas de la IA al formato interno
function normalizeAIQuestion(raw: any): Question {
  const base = { id: uid(), question: (raw.question ?? raw.enunciado ?? "").trim() }

  if (raw.type === "true_false" || raw.type === "verdadero_falso") {
    const correctRaw = raw.correctAnswer ?? raw.respuestaCorrecta ?? 0
    const correct    = typeof correctRaw === "boolean" ? (correctRaw ? 0 : 1) : Number(correctRaw)
    return {
      ...base, type: "true_false",
      correctAnswer: correct,
      explanation:              raw.explanation  ?? raw.explicacion ?? "",
      selectionPoints:          Number(raw.selectionPoints          ?? raw.puntosSeleccion    ?? 1),
      justificationMaxPoints:   Number(raw.justificationMaxPoints   ?? raw.puntosJustificacion ?? 2),
      maxPoints: (Number(raw.selectionPoints ?? 1)) + (Number(raw.justificationMaxPoints ?? 2)),
    }
  }

  if (raw.type === "development" || raw.type === "desarrollo") {
    const rubric: DevelopmentRubricItem[] = Array.isArray(raw.rubric)
      ? raw.rubric.map((r: any) => ({ criterion: r.criterion ?? r.criterio ?? "", points: Number(r.points ?? r.puntos ?? 1) }))
      : [{ criterion: "Comprensión", points: 2 }, { criterion: "Desarrollo", points: 2 }, { criterion: "Claridad", points: 1 }]
    const maxPoints = rubric.reduce((a, r) => a + r.points, 0)
    return {
      ...base, type: "development",
      expectedAnswer: raw.expectedAnswer ?? raw.modelAnswer ?? raw.respuestaModelo ?? "",
      rubric, maxPoints,
    }
  }

  // multiple_choice (default)
  const options: string[] = Array.isArray(raw.options)
    ? raw.options.map((o: any) => (typeof o === "string" ? o : String(o.text ?? o.opcion ?? o)).replace(/^[A-Da-d][).]\s*/u, "").trim())
    : ["", "", "", ""]
  const correctRaw = raw.correctAnswer ?? raw.respuestaCorrecta ?? 0
  const correct    = typeof correctRaw === "string"
    ? Math.max(0, correctRaw.charCodeAt(0) - 65)
    : Number(correctRaw)
  return {
    ...base, type: "multiple_choice",
    options,
    correctAnswer: Math.max(0, Math.min(correct, options.length - 1)),
    explanation:   raw.explanation ?? raw.explicacion ?? "",
    maxPoints:     Number(raw.maxPoints ?? raw.puntos ?? 1),
  }
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function CrearExamenPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)

  // ── Obtener usuario autenticado ───────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/login"); return }
      setUserId(user.id)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Metadatos del examen ──────────────────────────────────────────────────
  const [title,       setTitle]       = useState("")
  const [topic,       setTopic]       = useState("")
  const [instructions, setInstructions] = useState("")
  const [difficulty,  setDifficulty]  = useState<Difficulty>("mixto")
  const [timeLimit,   setTimeLimit]   = useState(60)
  const [examPercentage, setExamPercentage] = useState(60)
  const [showResultToStudent, setShowResultToStudent] = useState(true)
  const [allowReview, setAllowReview] = useState(true)
  const [isPublic,    setIsPublic]    = useState(true)

  // ── Seguridad (nuevo sistema) ─────────────────────────────────────────────
  const [securityMode, setSecurityMode] = useState(false)

  // ── Preguntas manuales ────────────────────────────────────────────────────
  const [questions, setQuestions] = useState<Question[]>([defaultQuestion("multiple_choice")])

  // ── Guardar examen ────────────────────────────────────────────────────────
  const [saving,      setSaving]      = useState(false)
  const [errorMsg,    setErrorMsg]    = useState("")
  const [successMsg,  setSuccessMsg]  = useState("")

  // ── Panel IA ──────────────────────────────────────────────────────────────
  const [aiOpen,        setAiOpen]        = useState(false)
  const [aiPrompt,      setAiPrompt]      = useState("")
  const [aiMC,          setAiMC]          = useState(5)
  const [aiTF,          setAiTF]          = useState(2)
  const [aiDev,         setAiDev]         = useState(2)
  const [aiDiff,        setAiDiff]        = useState<Difficulty>("mixto")
  const [aiStatus,      setAiStatus]      = useState<AIStatus>("idle")
  const [aiError,       setAiError]       = useState("")
  const [aiProvider,    setAiProvider]    = useState<"gemini" | "groq" | "">("")
  const [aiPreview,     setAiPreview]     = useState<Question[]>([])
  const [aiImportMode,  setAiImportMode]  = useState<"replace" | "append">("append")
  const [aiRegenIdx,    setAiRegenIdx]    = useState<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const totalPoints = useMemo(() => questions.reduce((acc, q) => acc + getQuestionPoints(q), 0), [questions])

  // ── CRUD preguntas ────────────────────────────────────────────────────────
  const addQuestion    = (type: QuestionType) => setQuestions(p => [...p, defaultQuestion(type)])
  const removeQuestion = (id: string)         => setQuestions(p => p.filter(q => q.id !== id))
  const updateQuestion = (id: string, updater: (q: Question) => Question) =>
    setQuestions(p => p.map(q => q.id === id ? updater(q) : q))

  // ── Validación ────────────────────────────────────────────────────────────
  const validateExam = (): string => {
    if (!title.trim()) return "Debes ingresar un título."
    if (!topic.trim()) return "Debes ingresar un tema."
    if (questions.length === 0) return "Debes agregar al menos una pregunta."
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      if (!q.question.trim()) return `La pregunta ${i + 1} no tiene enunciado.`
      if (q.type === "multiple_choice") {
        if (q.options.some(o => !o.trim())) return `La pregunta ${i + 1} tiene alternativas vacías.`
        if (q.correctAnswer < 0 || q.correctAnswer >= q.options.length)
          return `La pregunta ${i + 1} tiene una alternativa correcta inválida.`
      }
      if (q.type === "development") {
        if (!q.rubric.length) return `La pregunta ${i + 1} de desarrollo debe tener rúbrica.`
        if (q.rubric.some(r => !r.criterion.trim() || Number(r.points) <= 0))
          return `La rúbrica de la pregunta ${i + 1} tiene elementos inválidos.`
      }
    }
    return ""
  }

  // ── Guardar examen ────────────────────────────────────────────────────────
  const handleCreate = async () => {
    setErrorMsg(""); setSuccessMsg("")
    if (!userId) { setErrorMsg("No autenticado. Recarga la página."); return }
    const ve = validateExam()
    if (ve) { setErrorMsg(ve); return }
    setSaving(true)
    try {
      const payloadQuestions = questions.map(q => {
        if (q.type === "multiple_choice") return {
          type: q.type, question: q.question, options: q.options,
          correctAnswer: q.correctAnswer, explanation: q.explanation || "",
          maxPoints: Number(q.maxPoints || 1),
        }
        if (q.type === "true_false") return {
          type: q.type, question: q.question, correctAnswer: q.correctAnswer,
          explanation: q.explanation || "",
          selectionPoints:        Number(q.selectionPoints || 1),
          justificationMaxPoints: Number(q.justificationMaxPoints || 2),
          maxPoints: getQuestionPoints(q),
        }
        return {
          type: q.type, question: q.question,
          expectedAnswer: (q as DevelopmentQuestion).expectedAnswer || "",
          rubric: (q as DevelopmentQuestion).rubric.map(r => ({ criterion: r.criterion, points: Number(r.points || 0) })),
          maxPoints: getQuestionPoints(q),
        }
      })

      const res = await fetch("/api/agents/examen-docente", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create", title, topic, instructions, difficulty,
          teacherId: userId,
          questions: payloadQuestions,
          settings: {
            timeLimit:           Number(timeLimit || 60),
            examPercentage:      Number(examPercentage || 60),
            showResultToStudent, allowReview, isPublic,
            securityMode,        // ← nuevo sistema de seguridad
          },
        }),
      })
      const data = await res.json()
      if (!data?.success) throw new Error(data?.error || "No se pudo crear el examen.")
      setSuccessMsg("Examen creado correctamente.")
      setTimeout(() => router.push("/examen/docente"), 900)
    } catch (e: any) {
      setErrorMsg(e?.message || "Error al crear el examen.")
    } finally {
      setSaving(false)
    }
  }

  // ── Generar examen con IA ─────────────────────────────────────────────────
  const buildAIPrompt = (): string => {
    const totalQ  = aiMC + aiTF + aiDev
    const diffMap = { facil: "fácil", medio: "media", dificil: "difícil", mixto: "mixta" }
    const diffTxt = diffMap[aiDiff]
    return `Genera un examen escolar en español sobre el siguiente tema:
"${aiPrompt.trim() || topic.trim() || "tema del docente"}"

Total de preguntas: ${totalQ}
- ${aiMC} preguntas de ALTERNATIVAS (tipo multiple_choice, 4 opciones, una correcta)
- ${aiTF} preguntas de VERDADERO O FALSO (tipo true_false, con selectionPoints:1, justificationMaxPoints:2)
- ${aiDev} preguntas de DESARROLLO (tipo development, con rúbrica de criterios, maxPoints ~5)

Dificultad: ${diffTxt}
${title ? `Título sugerido: "${title}"` : ""}

REGLAS ESTRICTAS:
1. Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin backticks.
2. Estructura: { "title": "...", "questions": [...] }
3. Cada pregunta: { "type", "question", ...campos propios }
4. multiple_choice: options:[4 strings], correctAnswer:0-3, explanation, maxPoints:1
5. true_false: correctAnswer:0(V) o 1(F), explanation, selectionPoints:1, justificationMaxPoints:2
6. development: expectedAnswer, rubric:[{criterion,points}], maxPoints:suma
7. LaTeX inline con $...$ y bloque con $$...$$. Usa backslash real (\\).`
  }

  const generateAI = async () => {
    if (aiMC + aiTF + aiDev === 0) { setAiError("Define al menos 1 pregunta a generar."); return }
    if (!aiPrompt.trim() && !topic.trim()) { setAiError("Escribe un tema en el campo de descripción o en la información general."); return }

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setAiStatus("generating"); setAiError(""); setAiProvider(""); setAiPreview([])

    try {
      const res = await fetch("/api/agents/exam-generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          prompt: buildAIPrompt(), mode: "full",
          mc: aiMC, tf: aiTF, dev: aiDev,
        }),
      })
      const data = await res.json()
      if (!data?.success) throw new Error(data?.error || "Error generando preguntas.")

      const normalized: Question[] = (data.questions ?? []).map((raw: any) => normalizeAIQuestion(raw))
      if (normalized.length === 0) throw new Error("La IA no generó preguntas. Intenta con un tema más específico.")

      // Auto-rellenar título si está vacío
      if (!title.trim() && data.title) setTitle(data.title)

      setAiPreview(normalized)
      setAiProvider(data.provider ?? "gemini")
      setAiStatus("done")
    } catch (e: any) {
      if (e.name === "AbortError") return
      setAiError(e.message)
      setAiStatus("error")
    }
  }

  const importAIQuestions = () => {
    if (aiPreview.length === 0) return
    if (aiImportMode === "replace") setQuestions(aiPreview)
    else setQuestions(prev => [...prev, ...aiPreview])
    setAiPreview([]); setAiStatus("idle")
  }

  // Regenerar una sola pregunta de la preview
  const regenerateSingleQuestion = async (idx: number) => {
    const q = aiPreview[idx]
    if (!q) return
    setAiRegenIdx(idx)
    try {
      const singlePrompt = `Regenera UNA pregunta de tipo "${q.type}" sobre: "${aiPrompt.trim() || topic.trim()}". 
Dificultad: ${aiDiff}. 
Responde ÚNICAMENTE con JSON: { "question": {...} }
Usa el mismo esquema que antes (type, question, options si aplica, correctAnswer, explanation/rubric, etc.).`

      const res  = await fetch("/api/agents/exam-generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: singlePrompt, mode: "single" }),
      })
      const data = await res.json()
      if (!data?.success) throw new Error(data?.error)
      const fresh = normalizeAIQuestion(data.question ?? data.questions?.[0] ?? {})
      setAiPreview(prev => prev.map((p, i) => i === idx ? fresh : p))
    } catch (e: any) {
      // Silencioso en preview — el usuario puede reintentar
    } finally {
      setAiRegenIdx(null)
    }
  }

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <p className="text-blue-400 text-xs tracking-[0.25em] font-semibold mb-2">EXAMEN DOCENTE</p>
          <h1 className="text-3xl md:text-4xl font-extrabold">Crear nuevo examen</h1>
          <p className="text-gray-400 mt-2 text-sm md:text-base">
            Diseña tu evaluación manualmente o usa la IA para generar preguntas automáticamente.
          </p>
        </div>

        <div className="grid xl:grid-cols-[1fr_330px] gap-6">
          <div className="space-y-6">

            {/* ════════════════════════════════════════════════════════════
                PANEL IA — Generador de preguntas con Gemini / Groq
            ════════════════════════════════════════════════════════════ */}
            <section className="rounded-3xl border border-violet-500/25 bg-violet-500/[0.04] p-5 md:p-6">
              {/* Toggle header */}
              <button
                onClick={() => setAiOpen(o => !o)}
                className="w-full flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-lg">✨</div>
                  <div className="text-left">
                    <p className="font-bold text-sm text-white">Generador de preguntas con IA</p>
                    <p className="text-xs text-violet-400">Gemini 2.5 Flash → Groq fallback automático</p>
                  </div>
                </div>
                <span className={`text-gray-400 text-sm transition-transform ${aiOpen ? "rotate-180" : ""}`}>▾</span>
              </button>

              {aiOpen && (
                <div className="mt-5 space-y-4">
                  {/* Descripción / tema para la IA */}
                  <div>
                    <label className="text-xs text-gray-400 font-semibold block mb-2">
                      DESCRIPCIÓN PARA LA IA
                      <span className="text-gray-600 font-normal ml-1">(si está vacío usa el Tema de arriba)</span>
                    </label>
                    <textarea
                      value={aiPrompt}
                      onChange={e => setAiPrompt(e.target.value)}
                      placeholder="Ej: Funciones cuadráticas para 2° medio, enfocado en discriminante y vértice. Incluye problemas contextualizados."
                      className="w-full min-h-[90px] rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500/40 resize-none"
                    />
                  </div>

                  {/* Cantidad de preguntas por tipo */}
                  <div>
                    <label className="text-xs text-gray-400 font-semibold block mb-3">CANTIDAD DE PREGUNTAS</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Alternativas", color: "blue",   val: aiMC,  set: setAiMC },
                        { label: "Verdadero/Falso", color: "indigo", val: aiTF, set: setAiTF },
                        { label: "Desarrollo",   color: "emerald", val: aiDev, set: setAiDev },
                      ].map(({ label, color, val, set }) => (
                        <div key={label} className={`rounded-2xl bg-${color}-500/[0.06] border border-${color}-500/20 p-3 text-center`}>
                          <p className={`text-xs text-${color}-400 font-semibold mb-2`}>{label}</p>
                          <input
                            type="number" min={0} max={20} value={val}
                            onChange={e => set(Math.max(0, Number(e.target.value || 0)))}
                            className="w-full bg-transparent text-center text-white font-bold text-xl focus:outline-none"
                          />
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-600 mt-2 text-right">
                      Total: <span className="text-white font-semibold">{aiMC + aiTF + aiDev}</span> preguntas
                    </p>
                  </div>

                  {/* Dificultad IA */}
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 font-semibold block mb-2">DIFICULTAD</label>
                      <select
                        value={aiDiff} onChange={e => setAiDiff(e.target.value as Difficulty)}
                        className="w-full rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white focus:outline-none"
                      >
                        <option value="facil">Fácil</option>
                        <option value="medio">Medio</option>
                        <option value="dificil">Difícil</option>
                        <option value="mixto">Mixto</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 font-semibold block mb-2">AL IMPORTAR</label>
                      <select
                        value={aiImportMode} onChange={e => setAiImportMode(e.target.value as "replace" | "append")}
                        className="w-full rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white focus:outline-none"
                      >
                        <option value="append">Agregar al final</option>
                        <option value="replace">Reemplazar todas</option>
                      </select>
                    </div>
                  </div>

                  {/* Botón generar */}
                  <button
                    onClick={generateAI}
                    disabled={aiStatus === "generating"}
                    className="w-full py-3.5 rounded-2xl font-bold text-sm transition-all disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)", boxShadow: "0 0 24px rgba(124,58,237,0.25)" }}
                  >
                    {aiStatus === "generating" ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                        Generando con IA...
                      </span>
                    ) : "✨ Generar preguntas con IA"}
                  </button>

                  {/* Error IA */}
                  {aiStatus === "error" && (
                    <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300">
                      ❌ {aiError}
                    </div>
                  )}

                  {/* Preview de preguntas generadas */}
                  {aiStatus === "done" && aiPreview.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-gray-400 tracking-widest">
                          VISTA PREVIA — {aiPreview.length} pregunta{aiPreview.length !== 1 ? "s" : ""}
                          {aiProvider && (
                            <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              aiProvider === "gemini" ? "bg-blue-500/15 text-blue-400" : "bg-orange-500/15 text-orange-400"
                            }`}>
                              {aiProvider === "gemini" ? "Gemini 2.5" : "Groq (fallback)"}
                            </span>
                          )}
                        </p>
                        <button
                          onClick={importAIQuestions}
                          className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold"
                        >
                          {aiImportMode === "replace" ? "↩ Reemplazar" : "＋ Importar al examen"}
                        </button>
                      </div>

                      <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                        {aiPreview.map((q, idx) => (
                          <div key={q.id} className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-3">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                  q.type === "multiple_choice" ? "bg-blue-500/10 text-blue-400"
                                  : q.type === "true_false"    ? "bg-indigo-500/10 text-indigo-400"
                                  :                              "bg-emerald-500/10 text-emerald-400"
                                }`}>
                                  {q.type === "multiple_choice" ? "Alt" : q.type === "true_false" ? "V/F" : "Des"}
                                </span>
                                <span className="text-gray-600 text-[10px]">P{idx + 1} · {getQuestionPoints(q)} pts</span>
                              </div>
                              <button
                                onClick={() => regenerateSingleQuestion(idx)}
                                disabled={aiRegenIdx !== null}
                                className="text-[10px] px-2 py-1 rounded-lg bg-white/[0.04] text-gray-400 hover:text-white hover:bg-white/[0.08] disabled:opacity-40 transition-all"
                              >
                                {aiRegenIdx === idx ? "⟳" : "↺ regen"}
                              </button>
                            </div>
                            <p className="text-white text-xs leading-relaxed line-clamp-3">{q.question}</p>
                            {q.type === "multiple_choice" && (
                              <div className="mt-2 grid grid-cols-2 gap-1">
                                {q.options.map((o, j) => (
                                  <p key={j} className={`text-[11px] px-2 py-1 rounded-lg ${
                                    j === q.correctAnswer ? "bg-green-500/10 text-green-400" : "text-gray-600"
                                  }`}>
                                    {String.fromCharCode(65 + j)}. {o}
                                  </p>
                                ))}
                              </div>
                            )}
                            {q.type === "true_false" && (
                              <p className="text-xs text-gray-500 mt-1">
                                Correcta: <span className="text-white font-semibold">{q.correctAnswer === 0 ? "Verdadero" : "Falso"}</span>
                                {" · "}{q.selectionPoints}+{q.justificationMaxPoints} pts
                              </p>
                            )}
                            {q.type === "development" && (
                              <p className="text-xs text-gray-500 mt-1">
                                Rúbrica: {q.rubric.map(r => `${r.criterion} (${r.points}p)`).join(" · ")}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={importAIQuestions}
                        className="w-full py-3 rounded-2xl font-bold text-sm bg-violet-600 hover:bg-violet-500 text-white"
                      >
                        {aiImportMode === "replace"
                          ? `↩ Reemplazar ${questions.length} pregunta${questions.length !== 1 ? "s" : ""} con las ${aiPreview.length} generadas`
                          : `＋ Agregar ${aiPreview.length} pregunta${aiPreview.length !== 1 ? "s" : ""} al examen`}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ════════════════════════════════════════════════════════════
                INFORMACIÓN GENERAL
            ════════════════════════════════════════════════════════════ */}
            <section className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5 md:p-6">
              <h2 className="text-lg font-bold mb-4">Información general</h2>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400 font-semibold block mb-2">TÍTULO</label>
                  <input value={title} onChange={e => setTitle(e.target.value)}
                    placeholder="Ej: Prueba de porcentajes e interés"
                    className="w-full rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/40" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-semibold block mb-2">TEMA</label>
                  <input value={topic} onChange={e => setTopic(e.target.value)}
                    placeholder="Ej: Matemática financiera"
                    className="w-full rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/40" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-semibold block mb-2">DIFICULTAD</label>
                  <select value={difficulty} onChange={e => setDifficulty(e.target.value as Difficulty)}
                    className="w-full rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/40">
                    <option value="facil">Fácil</option>
                    <option value="medio">Medio</option>
                    <option value="dificil">Difícil</option>
                    <option value="mixto">Mixto</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-semibold block mb-2">TIEMPO (MINUTOS)</label>
                  <input type="number" min={5} value={timeLimit}
                    onChange={e => setTimeLimit(Number(e.target.value || 60))}
                    className="w-full rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/40" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-semibold block mb-2">EXIGENCIA (%)</label>
                  <input type="number" min={1} max={100} value={examPercentage}
                    onChange={e => setExamPercentage(Number(e.target.value || 60))}
                    className="w-full rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/40" />
                </div>
                <div className="flex flex-col justify-end">
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    {[
                      { label: "Mostrar resultado al estudiante", val: showResultToStudent, set: setShowResultToStudent },
                      { label: "Permitir revisión",               val: allowReview,         set: setAllowReview },
                      { label: "Hacer examen público",            val: isPublic,            set: setIsPublic },
                    ].map(({ label, val, set }) => (
                      <label key={label} className="flex items-center gap-2 text-gray-300 cursor-pointer">
                        <input type="checkbox" checked={val} onChange={e => set(e.target.checked)} />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Modo Seguro (nuevo sistema) ────────────────────────────── */}
              <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl mt-0.5">🔒</span>
                    <div>
                      <p className="text-sm font-bold text-white">Modo Seguro</p>
                      <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                        Activa el sistema de seguridad avanzado: fullscreen forzado, bloqueo de teclado/clipboard,
                        detección de cambio de pestaña, sesiones con heartbeat y panel de incidentes para el docente.
                      </p>
                      {securityMode && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {["Fullscreen obligatorio","Teclado bloqueado","Sin copiar/pegar","Detección de pestaña","Registro de incidentes","Panel admin"].map(f => (
                            <span key={f} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">{f}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setSecurityMode(s => !s)}
                    className={`relative flex-shrink-0 w-12 h-6 rounded-full transition-colors ${securityMode ? "bg-amber-500" : "bg-gray-700"}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${securityMode ? "translate-x-6" : "translate-x-0.5"}`} />
                  </button>
                </div>
              </div>

              {/* Instrucciones */}
              <div className="mt-4">
                <label className="text-xs text-gray-400 font-semibold block mb-2">INSTRUCCIONES</label>
                <textarea value={instructions} onChange={e => setInstructions(e.target.value)}
                  placeholder="Escribe instrucciones para tus estudiantes..."
                  className="w-full min-h-[120px] rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/40" />
              </div>
            </section>

            {/* ════════════════════════════════════════════════════════════
                PREGUNTAS DEL EXAMEN
            ════════════════════════════════════════════════════════════ */}
            <section className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5 md:p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
                <h2 className="text-lg font-bold">Preguntas del examen</h2>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => addQuestion("multiple_choice")}
                    className="px-4 py-2 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold">
                    + Alternativas
                  </button>
                  <button onClick={() => addQuestion("true_false")}
                    className="px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold">
                    + V/F
                  </button>
                  <button onClick={() => addQuestion("development")}
                    className="px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold">
                    + Desarrollo
                  </button>
                </div>
              </div>

              <div className="space-y-5">
                {questions.map((q, index) => (
                  <div key={q.id} className="rounded-3xl border border-white/[0.08] bg-black/20 p-4 md:p-5">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <p className="text-xs tracking-widest text-gray-500 font-semibold">PREGUNTA {index + 1}</p>
                        <p className="text-sm text-gray-300 mt-1">
                          Tipo:{" "}
                          <span className="font-semibold text-white">
                            {q.type === "multiple_choice" ? "Alternativas" : q.type === "true_false" ? "Verdadero/Falso" : "Desarrollo"}
                          </span>
                          <span className="ml-2 text-xs text-gray-600">· {getQuestionPoints(q)} pts</span>
                        </p>
                      </div>
                      <button onClick={() => removeQuestion(q.id)} disabled={questions.length === 1}
                        className="px-3 py-2 rounded-xl bg-red-500/15 text-red-300 hover:bg-red-500/25 disabled:opacity-40 text-sm">
                        Eliminar
                      </button>
                    </div>

                    {/* Enunciado */}
                    <div className="mb-4">
                      <label className="text-xs text-gray-400 font-semibold block mb-2">ENUNCIADO</label>
                      <textarea value={q.question}
                        onChange={e => updateQuestion(q.id, prev => ({ ...prev, question: e.target.value }))}
                        className="w-full min-h-[110px] rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/40"
                        placeholder="Escribe la pregunta..." />
                    </div>

                    {/* ── Alternativas ──────────────────────────────── */}
                    {q.type === "multiple_choice" && (
                      <div className="space-y-3">
                        {q.options.map((option, optIndex) => (
                          <div key={optIndex} className="grid grid-cols-[1fr_auto] gap-3 items-center">
                            <input value={option}
                              onChange={e => updateQuestion(q.id, prev => {
                                if (prev.type !== "multiple_choice") return prev
                                const next = [...prev.options]; next[optIndex] = e.target.value
                                return { ...prev, options: next }
                              })}
                              className="w-full rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/40"
                              placeholder={`Alternativa ${optIndex + 1}`} />
                            <label className="flex items-center gap-2 text-sm text-gray-300 whitespace-nowrap">
                              <input type="radio" name={`correct-${q.id}`} checked={q.correctAnswer === optIndex}
                                onChange={() => updateQuestion(q.id, prev => prev.type === "multiple_choice" ? { ...prev, correctAnswer: optIndex } : prev)} />
                              Correcta
                            </label>
                          </div>
                        ))}
                        <div className="grid md:grid-cols-2 gap-4 mt-3">
                          <div>
                            <label className="text-xs text-gray-400 font-semibold block mb-2">EXPLICACIÓN</label>
                            <textarea value={q.explanation || ""}
                              onChange={e => updateQuestion(q.id, prev => prev.type === "multiple_choice" ? { ...prev, explanation: e.target.value } : prev)}
                              className="w-full min-h-[90px] rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/40" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-400 font-semibold block mb-2">PUNTAJE</label>
                            <input type="number" min={1} value={q.maxPoints || 1}
                              onChange={e => updateQuestion(q.id, prev => prev.type === "multiple_choice" ? { ...prev, maxPoints: Number(e.target.value || 1) } : prev)}
                              className="w-full rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/40" />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── Verdadero / Falso ─────────────────────────── */}
                    {q.type === "true_false" && (
                      <div className="space-y-4">
                        <div className="flex gap-4">
                          {["Verdadero", "Falso"].map((label, j) => (
                            <label key={j} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                              <input type="radio" name={`tf-${q.id}`} checked={q.correctAnswer === j}
                                onChange={() => updateQuestion(q.id, prev => prev.type === "true_false" ? { ...prev, correctAnswer: j } : prev)} />
                              {label}
                            </label>
                          ))}
                        </div>
                        <div className="grid md:grid-cols-3 gap-4">
                          <div>
                            <label className="text-xs text-gray-400 font-semibold block mb-2">PTS SELECCIÓN</label>
                            <input type="number" min={0} value={q.selectionPoints || 1}
                              onChange={e => updateQuestion(q.id, prev => prev.type === "true_false" ? { ...prev, selectionPoints: Number(e.target.value || 0) } : prev)}
                              className="w-full rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-400 font-semibold block mb-2">PTS JUSTIFICACIÓN</label>
                            <input type="number" min={0} value={q.justificationMaxPoints || 2}
                              onChange={e => updateQuestion(q.id, prev => prev.type === "true_false" ? { ...prev, justificationMaxPoints: Number(e.target.value || 0) } : prev)}
                              className="w-full rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-400 font-semibold block mb-2">TOTAL</label>
                            <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white">
                              {getQuestionPoints(q)}
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 font-semibold block mb-2">EXPLICACIÓN</label>
                          <textarea value={q.explanation || ""}
                            onChange={e => updateQuestion(q.id, prev => prev.type === "true_false" ? { ...prev, explanation: e.target.value } : prev)}
                            className="w-full min-h-[90px] rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white" />
                        </div>
                      </div>
                    )}

                    {/* ── Desarrollo ────────────────────────────────── */}
                    {q.type === "development" && (
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs text-gray-400 font-semibold block mb-2">RESPUESTA ESPERADA</label>
                          <textarea value={(q as DevelopmentQuestion).expectedAnswer || ""}
                            onChange={e => updateQuestion(q.id, prev => prev.type === "development" ? { ...prev, expectedAnswer: e.target.value } : prev)}
                            className="w-full min-h-[90px] rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 font-semibold block mb-2">RÚBRICA</label>
                          <div className="space-y-3">
                            {(q as DevelopmentQuestion).rubric.map((item, rubricIndex) => (
                              <div key={rubricIndex} className="grid grid-cols-[1fr_120px_auto] gap-3 items-center">
                                <input value={item.criterion}
                                  onChange={e => updateQuestion(q.id, prev => {
                                    if (prev.type !== "development") return prev
                                    const next = [...prev.rubric]; next[rubricIndex] = { ...next[rubricIndex], criterion: e.target.value }
                                    return { ...prev, rubric: next }
                                  })}
                                  className="w-full rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white" placeholder="Criterio" />
                                <input type="number" min={1} value={item.points}
                                  onChange={e => updateQuestion(q.id, prev => {
                                    if (prev.type !== "development") return prev
                                    const next = [...prev.rubric]; next[rubricIndex] = { ...next[rubricIndex], points: Number(e.target.value || 0) }
                                    return { ...prev, rubric: next }
                                  })}
                                  className="w-full rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white" />
                                <button
                                  onClick={() => updateQuestion(q.id, prev => {
                                    if (prev.type !== "development") return prev
                                    return { ...prev, rubric: prev.rubric.filter((_, idx) => idx !== rubricIndex) }
                                  })}
                                  disabled={(q as DevelopmentQuestion).rubric.length === 1}
                                  className="px-3 py-2 rounded-xl bg-red-500/15 text-red-300 hover:bg-red-500/25 disabled:opacity-40 text-sm">
                                  Quitar
                                </button>
                              </div>
                            ))}
                          </div>
                          <button
                            onClick={() => updateQuestion(q.id, prev => {
                              if (prev.type !== "development") return prev
                              return { ...prev, rubric: [...prev.rubric, { criterion: "", points: 1 }] }
                            })}
                            className="mt-3 px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold">
                            + Agregar criterio
                          </button>
                          <p className="text-sm text-gray-400 mt-3">
                            Puntaje total: <span className="text-white font-semibold">{getQuestionPoints(q)}</span>
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* ════════════════════════════════════════════════════════════
              SIDEBAR — Resumen + Guardar
          ════════════════════════════════════════════════════════════ */}
          <aside className="space-y-6">
            <section className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5 sticky top-6">
              <h2 className="text-lg font-bold mb-4">Resumen</h2>

              <div className="space-y-3 text-sm">
                {[
                  { label: "Preguntas",     value: questions.length },
                  { label: "Puntaje total", value: totalPoints },
                  { label: "Tiempo",        value: `${timeLimit} min` },
                  { label: "Exigencia",     value: `${examPercentage}%` },
                  { label: "Dificultad",    value: difficulty },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between gap-3">
                    <span className="text-gray-400">{label}</span>
                    <span className="font-semibold text-white capitalize">{value}</span>
                  </div>
                ))}

                {/* Indicador de seguridad en resumen */}
                <div className="flex justify-between gap-3 pt-1">
                  <span className="text-gray-400">Modo Seguro</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${securityMode ? "bg-amber-500/15 text-amber-400" : "bg-gray-800 text-gray-600"}`}>
                    {securityMode ? "ACTIVO" : "Inactivo"}
                  </span>
                </div>

                {/* Desglose de tipos */}
                <div className="pt-1 border-t border-white/[0.05] space-y-1">
                  {(["multiple_choice","true_false","development"] as QuestionType[]).map(type => {
                    const count = questions.filter(q => q.type === type).length
                    if (count === 0) return null
                    const label = type === "multiple_choice" ? "Alternativas" : type === "true_false" ? "V/F" : "Desarrollo"
                    const color = type === "multiple_choice" ? "text-blue-400" : type === "true_false" ? "text-indigo-400" : "text-emerald-400"
                    return (
                      <div key={type} className="flex justify-between gap-3">
                        <span className={`text-xs ${color}`}>{label}</span>
                        <span className="text-xs text-gray-400">{count} pregunta{count !== 1 ? "s" : ""}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {errorMsg && (
                <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                  {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                  {successMsg}
                </div>
              )}

              <div className="mt-6 space-y-3">
                <button onClick={handleCreate} disabled={saving}
                  className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold">
                  {saving ? "Creando examen..." : "Crear examen"}
                </button>
                <button onClick={() => router.push("/examen/docente")}
                  className="w-full py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-white">
                  Volver
                </button>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}
