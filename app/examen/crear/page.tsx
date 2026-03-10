"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import ExamMathText from "@/components/ui/ExamMathText"

type Diff = "easy" | "medium" | "hard" | "mixed"
type ScoreMode = "auto" | "manual"
type Ability = "recuerdo" | "comprension" | "aplicacion" | "analisis" | "argumentacion"

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
  { id: "recuerdo", label: "Recuerdo" },
  { id: "comprension", label: "Comprensión" },
  { id: "aplicacion", label: "Aplicación" },
  { id: "analisis", label: "Análisis" },
  { id: "argumentacion", label: "Argumentación" },
]

const diffOptions: {
  id: Diff
  label: string
  active: { backgroundColor: string; borderColor: string; color: string }
}[] = [
  {
    id: "easy",
    label: "Fácil",
    active: {
      backgroundColor: "rgba(34,197,94,0.1)",
      borderColor: "rgba(34,197,94,0.3)",
      color: "#4ade80",
    },
  },
  {
    id: "medium",
    label: "Medio",
    active: {
      backgroundColor: "rgba(234,179,8,0.1)",
      borderColor: "rgba(234,179,8,0.3)",
      color: "#facc15",
    },
  },
  {
    id: "hard",
    label: "Difícil",
    active: {
      backgroundColor: "rgba(239,68,68,0.1)",
      borderColor: "rgba(239,68,68,0.3)",
      color: "#f87171",
    },
  },
  {
    id: "mixed",
    label: "Mixto",
    active: {
      backgroundColor: "rgba(59,130,246,0.1)",
      borderColor: "rgba(59,130,246,0.3)",
      color: "#60a5fa",
    },
  },
]

function difficultyTextFromMode(difficulty: Diff) {
  if (difficulty === "easy") return "nivel fácil, con foco en reconocimiento y comprensión básica"
  if (difficulty === "medium") return "nivel intermedio, con mezcla de comprensión y aplicación"
  if (difficulty === "hard") return "nivel difícil, con foco en análisis, resolución y argumentación"
  return "mezcla equilibrada de fácil, medio y difícil"
}

function normalizeDifficulty(value: any): 1 | 2 | 3 {
  if (value === 3 || value === "3" || value === "hard") return 3
  if (value === 2 || value === "2" || value === "medium") return 2
  return 1
}

function defaultAbilityByDifficulty(diff: 1 | 2 | 3): Ability {
  if (diff === 3) return "analisis"
  if (diff === 2) return "aplicacion"
  return "comprension"
}

function clampPositive(n: number, fallback = 1) {
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.round(n * 10) / 10)
}

function basePointsForQuestion(q: Partial<ExamQuestion>) {
  const diff = normalizeDifficulty(q.difficulty)
  if (q.type === "multiple_choice") return diff === 3 ? 3 : diff === 2 ? 2 : 1
  if (q.type === "true_false") return diff === 3 ? 4 : diff === 2 ? 3 : 2
  return diff === 3 ? 7 : diff === 2 ? 5 : 3
}

function normalizeCorrectAnswer(
  rawCorrectAnswer: any,
  options: string[],
  type: "multiple_choice" | "true_false" | "development"
): number {
  const maxIndex = Math.max(0, options.length - 1)

  if (typeof rawCorrectAnswer === "number" && Number.isFinite(rawCorrectAnswer)) {
    return Math.max(0, Math.min(maxIndex, Math.round(rawCorrectAnswer)))
  }

  if (typeof rawCorrectAnswer === "boolean" && type === "true_false") {
    return rawCorrectAnswer ? 0 : 1
  }

  if (typeof rawCorrectAnswer === "string") {
    const value = rawCorrectAnswer.trim().toLowerCase()

    const numericValue = Number(value)
    if (Number.isFinite(numericValue)) {
      return Math.max(0, Math.min(maxIndex, Math.round(numericValue)))
    }

    const letters = ["a", "b", "c", "d", "e", "f"]
    const letterIndex = letters.indexOf(value)
    if (letterIndex >= 0 && letterIndex <= maxIndex) {
      return letterIndex
    }

    if (type === "true_false") {
      if (["verdadero", "v", "true"].includes(value)) {
        const trueIndex = options.findIndex(opt => opt.trim().toLowerCase() === "verdadero")
        return trueIndex >= 0 ? trueIndex : 0
      }
      if (["falso", "f", "false"].includes(value)) {
        const falseIndex = options.findIndex(opt => opt.trim().toLowerCase() === "falso")
        return falseIndex >= 0 ? falseIndex : Math.min(1, maxIndex)
      }
    }

    const optionIndex = options.findIndex(opt => opt.trim().toLowerCase() === value)
    if (optionIndex >= 0) return optionIndex
  }

  return 0
}

function normalizeQuestion(raw: any, scoreMode: ScoreMode): ExamQuestion {
  const type =
    raw?.type === "true_false" || raw?.type === "development"
      ? raw.type
      : "multiple_choice"

  const difficulty = normalizeDifficulty(raw?.difficulty)

  const ability: Ability = abilityOptions.some(a => a.id === raw?.ability)
    ? raw.ability
    : defaultAbilityByDifficulty(difficulty)

  const question: ExamQuestion = {
    type,
    question: raw?.question || "Pregunta generada por IA",
    explanation: raw?.explanation || "",
    difficulty,
    ability,
  }

  if (type !== "development") {
    const options =
      Array.isArray(raw?.options) && raw.options.length > 0
        ? raw.options.map((opt: any) => String(opt))
        : type === "true_false"
          ? ["Verdadero", "Falso"]
          : ["Opción A", "Opción B", "Opción C", "Opción D"]

    question.options = options
    question.correctAnswer = normalizeCorrectAnswer(raw?.correctAnswer, options, type)
  }

  if (type === "development") {
    question.modelAnswer = raw?.modelAnswer || ""
    question.rubric = Array.isArray(raw?.rubric)
      ? raw.rubric.map((r: any) => ({
          criteria: r?.criteria || "Criterio",
          points: clampPositive(Number(r?.points), 1),
        }))
      : []
  }

  const suggested = basePointsForQuestion(question)
  const requested = clampPositive(Number(raw?.maxPoints), suggested)
  question.maxPoints = scoreMode === "manual" ? requested : requested || suggested

  if (type === "true_false") {
    const selectionPoints = clampPositive(Number(raw?.selectionPoints), 1) || 1
    const providedJustification = clampPositive(
      Number(raw?.justificationMaxPoints),
      Math.max(0, (question.maxPoints || suggested) - selectionPoints)
    )
    const computedMax = selectionPoints + providedJustification

    question.selectionPoints = selectionPoints
    question.justificationMaxPoints = providedJustification
    question.maxPoints =
      scoreMode === "manual"
        ? Math.max(selectionPoints, requested)
        : computedMax > 0
          ? computedMax
          : suggested

    if ((question.maxPoints || 0) < selectionPoints) {
      question.maxPoints = selectionPoints
    }

    question.justificationMaxPoints = Math.max(
      0,
      (question.maxPoints || selectionPoints) - selectionPoints
    )
  }

  if (type === "development" && question.rubric && question.rubric.length > 0) {
    const rubricSum = question.rubric.reduce(
      (acc, item) => acc + clampPositive(Number(item.points), 0),
      0
    )
    question.maxPoints =
      scoreMode === "manual"
        ? (requested || rubricSum || suggested)
        : (rubricSum || requested || suggested)
  }

  return question
}

function questionTypeLabel(type: ExamQuestion["type"]) {
  if (type === "multiple_choice") return "Alternativas"
  if (type === "true_false") return "V/F"
  return "Desarrollo"
}

function difficultyLabel(difficulty?: number) {
  if (difficulty === 3) return "Difícil"
  if (difficulty === 2) return "Medio"
  return "Fácil"
}

function difficultyPillClass(difficulty?: number) {
  if (difficulty === 3) return "text-red-400"
  if (difficulty === 2) return "text-yellow-400"
  return "text-green-400"
}

export default function CrearExamenPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<"config" | "generating" | "preview" | "published">("config")

  const [topic, setTopic] = useState("")
  const [title, setTitle] = useState("")
  const [instructions, setInstructions] = useState("")
  const [teachingContext, setTeachingContext] = useState("")
  const [timeLimit, setTimeLimit] = useState(30)
  const [exigencia, setExigencia] = useState(60)
  const [showResult, setShowResult] = useState(true)
  const [difficulty, setDifficulty] = useState<Diff>("mixed")
  const [scoreMode, setScoreMode] = useState<ScoreMode>("auto")
  const [manualRubricGuide, setManualRubricGuide] = useState("")

  const [mcCount, setMcCount] = useState(5)
  const [tfCount, setTfCount] = useState(3)
  const [devCount, setDevCount] = useState(2)

  const [questions, setQuestions] = useState<ExamQuestion[]>([])
  const [examData, setExamData] = useState<any>(null)
  const [error, setError] = useState("")
  const [busyQuestion, setBusyQuestion] = useState<number | null>(null)
  const [agentSummary, setAgentSummary] = useState<any>(null)

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/login")
      else setUser(user)
      setLoading(false)
    })
  }, [router, supabase.auth])

  const totalQuestions = mcCount + tfCount + devCount
  const totalPoints = useMemo(
    () => questions.reduce((acc, q) => acc + (q.maxPoints || 0), 0),
    [questions]
  )

  const generateExam = async () => {
    if (!topic.trim() || totalQuestions < 1) return

    setStep("generating")
    setError("")
    setAgentSummary(null)

    const prompt = `Eres un diseñador experto de evaluaciones escolares en español.

CONTEXTO PEDAGÓGICO DEL DOCENTE:
- Tema principal: ${topic}
- Lo que está enseñando / materia explicada: ${teachingContext || "No especificado"}
- Instrucciones para estudiantes: ${instructions || "No especificadas"}
- Modo de puntaje: ${scoreMode === "auto" ? "Automático por IA" : "Manual con rúbrica editable"}
- Guía de rúbrica del docente: ${manualRubricGuide || "No especificada"}
- Dificultad global solicitada: ${difficultyTextFromMode(difficulty)}

DISTRIBUCIÓN DE PREGUNTAS:
- ${mcCount} preguntas de ALTERNATIVAS (multiple_choice): 4 opciones A-D, solo 1 correcta
- ${tfCount} preguntas de VERDADERO O FALSO (true_false): opciones ["Verdadero", "Falso"] y con una breve explicación correcta
- ${devCount} preguntas de DESARROLLO (development): respuesta abierta, incluye modelAnswer y rubric

REQUISITOS CLAVE:
- Analiza el texto del docente y extrae subtemas relevantes.
- Genera preguntas alineadas con lo que realmente pidió el docente, no solo con el título del tema.
- Balancea dificultad y variedad.
- Usa categorías pedagógicas en el campo ability: recuerdo, comprension, aplicacion, analisis o argumentacion.
- Para preguntas de desarrollo, entrega una rúbrica clara y coherente.
- Para contenido matemático usa SOLO LaTeX entre $...$ para expresiones inline y $$...$$ para bloques.
- No uses \\( \\) ni \\[ \\].
- No escapes innecesariamente las barras invertidas.
- En correctAnswer puedes responder con índice numérico (0,1,2,3) o con el texto/etiqueta de la respuesta correcta.
- Devuelve SOLO JSON válido.

Formato exacto:
{
  "title": "Título del examen",
  "summary": {
    "detectedTopic": "tema detectado",
    "subtopics": ["subtema 1", "subtema 2"],
    "recommendedFocus": "foco sugerido",
    "suggestedDifficulty": "easy|medium|hard|mixed"
  },
  "questions": [
    {
      "type": "multiple_choice",
      "question": "Pregunta",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 0,
      "explanation": "Explicación breve",
      "difficulty": 1,
      "ability": "comprension",
      "maxPoints": 2
    },
    {
      "type": "true_false",
      "question": "Enunciado",
      "options": ["Verdadero", "Falso"],
      "correctAnswer": 0,
      "explanation": "Explicación breve",
      "difficulty": 2,
      "ability": "aplicacion",
      "selectionPoints": 1,
      "justificationMaxPoints": 2,
      "maxPoints": 3
    },
    {
      "type": "development",
      "question": "Pregunta de desarrollo",
      "modelAnswer": "Respuesta modelo",
      "rubric": [
        {"criteria": "Criterio 1", "points": 2},
        {"criteria": "Criterio 2", "points": 3}
      ],
      "difficulty": 3,
      "ability": "argumentacion",
      "maxPoints": 5
    }
  ]
}

Total de preguntas: ${totalQuestions}. Todo en español.`

    try {
      const res = await fetch("/api/process-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "text",
          content: prompt,
          outputFormat: "quiz",
        }),
      })

      const data = await res.json()
      if (!data.success) throw new Error(data.error || "No se pudo generar el examen")

      const qsRaw = data.output?.data?.questions || []
      const normalized = qsRaw.map((q: any) => normalizeQuestion(q, scoreMode))

      setQuestions(normalized)
      setTitle(data.output?.data?.title || `Examen: ${topic}`)
      setAgentSummary(data.output?.data?.summary || null)
      setStep("preview")
    } catch (err: any) {
      setError(err.message || "Error al generar examen")
      setStep("config")
    }
  }

  const publishExam = async () => {
    if (!user || questions.length === 0) return

    setError("")

    try {
      const res = await fetch("/api/agents/examen-docente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          teacherId: user.id,
          title,
          topic,
          instructions,
          questions,
          settings: {
            timeLimit,
            questionCount: questions.length,
            showResultToStudent: showResult,
            examPercentage: exigencia,
            difficulty,
            scoreMode,
            totalPoints,
            teachingContext,
            manualRubricGuide,
            distribution: { mc: mcCount, tf: tfCount, dev: devCount },
          },
        }),
      })

      const data = await res.json()
      if (!data.success) throw new Error(data.error)

      setExamData(data)
      setStep("published")
    } catch (err: any) {
      setError(err.message || "No se pudo publicar el examen")
    }
  }

  const removeQuestion = (idx: number) => {
    setQuestions(questions.filter((_, i) => i !== idx))
  }

  const updateQuestion = (idx: number, patch: Partial<ExamQuestion>) => {
    setQuestions(prev =>
      prev.map((q, i) => {
        if (i !== idx) return q

        const merged = { ...q, ...patch }

        if (merged.type === "true_false") {
          const selectionPoints = clampPositive(Number(merged.selectionPoints), 1) || 1
          const maxPoints = clampPositive(Number(merged.maxPoints), selectionPoints)

          return {
            ...merged,
            selectionPoints,
            maxPoints,
            justificationMaxPoints: Math.max(0, maxPoints - selectionPoints),
          }
        }

        if (merged.type === "development") {
          const rubric = Array.isArray(merged.rubric) ? merged.rubric : []
          if (scoreMode === "auto" && rubric.length > 0) {
            const rubricSum = rubric.reduce(
              (acc, item) => acc + clampPositive(Number(item.points), 0),
              0
            )
            return {
              ...merged,
              rubric,
              maxPoints: rubricSum || clampPositive(Number(merged.maxPoints), 1),
            }
          }
        }

        return {
          ...merged,
          maxPoints: clampPositive(Number(merged.maxPoints), 1),
        }
      })
    )
  }

  const regenerateQuestion = async (
    idx: number,
    overrides?: { difficulty?: 1 | 2 | 3; ability?: Ability; type?: ExamQuestion["type"] }
  ) => {
    const current = questions[idx]
    if (!current) return

    setBusyQuestion(idx)
    setError("")

    const nextDifficulty = overrides?.difficulty || current.difficulty || 2
    const nextAbility =
      overrides?.ability || current.ability || defaultAbilityByDifficulty(nextDifficulty)
    const nextType = overrides?.type || current.type

    const prompt = `Genera SOLO una pregunta de examen en JSON válido.

Tema: ${topic}
Contexto del docente: ${teachingContext || "No especificado"}
Instrucciones del examen: ${instructions || "No especificadas"}
Tipo de pregunta requerido: ${nextType}
Nivel de dificultad requerido: ${difficultyLabel(nextDifficulty)}
Habilidad requerida: ${abilityOptions.find(a => a.id === nextAbility)?.label}
Pregunta anterior a reemplazar: ${current.question}

Reglas:
- Mantén el contenido alineado al tema y al contexto del docente.
- No repitas la pregunta anterior.
- Si es multiple_choice, entrega 4 opciones y una correcta.
- Si es true_false, entrega Verdadero/Falso, explicación, selectionPoints=1, justificationMaxPoints y maxPoints.
- Si es development, entrega modelAnswer, rubric y maxPoints.
- Para contenido matemático usa SOLO LaTeX entre $...$ para expresiones inline y $$...$$ para bloques.
- No uses \\( \\) ni \\[ \\].
- correctAnswer puede venir como índice, letra o texto correcto; el sistema lo normaliza.
- Devuelve SOLO JSON.

Formato exacto:
{
  "question": {
    "type": "${nextType}",
    "question": "Texto",
    "options": ["A", "B", "C", "D"],
    "correctAnswer": 0,
    "explanation": "Explicación",
    "difficulty": ${nextDifficulty},
    "ability": "${nextAbility}",
    "selectionPoints": 1,
    "justificationMaxPoints": 2,
    "maxPoints": ${current.maxPoints || basePointsForQuestion(current)},
    "modelAnswer": "",
    "rubric": []
  }
}`

    try {
      const res = await fetch("/api/process-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "text",
          content: prompt,
          outputFormat: "quiz",
        }),
      })

      const data = await res.json()
      if (!data.success) throw new Error(data.error || "No se pudo regenerar la pregunta")

      const newQuestion = normalizeQuestion(
        data.output?.data?.question || data.output?.data || {},
        scoreMode
      )

      updateQuestion(idx, { ...newQuestion, maxPoints: current.maxPoints })
    } catch (err: any) {
      setError(err.message || "No se pudo regenerar la pregunta")
    } finally {
      setBusyQuestion(null)
    }
  }

  const examUrl = examData ? `${window.location.origin}/examen/p/${examData.code}` : ""

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-blue-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/examen/docente"
            className="text-gray-500 hover:text-white transition-colors"
          >
            ←
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">📝 Crear Examen para Estudiantes</h1>
            <p className="text-gray-500 text-sm">
              La IA genera las preguntas, tú compartes el link
            </p>
          </div>
        </div>

        {step === "config" && (
          <div className="space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-gray-400 text-xs font-semibold block mb-1.5">
                  TEMA DEL EXAMEN *
                </label>
                <input
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  placeholder="Ej: Productos notables, fotosíntesis, Segunda Guerra Mundial..."
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/30"
                />
              </div>

              <div>
                <label className="text-gray-400 text-xs font-semibold block mb-1.5">
                  INSTRUCCIONES (opcional)
                </label>
                <input
                  value={instructions}
                  onChange={e => setInstructions(e.target.value)}
                  placeholder="Ej: Justifica tus respuestas y muestra procedimiento."
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/30"
                />
              </div>
            </div>

            <div>
              <label className="text-gray-400 text-xs font-semibold block mb-1.5">
                CONTEXTO PEDAGÓGICO / MATERIA QUE ESTÁS PASANDO
              </label>
              <textarea
                value={teachingContext}
                onChange={e => setTeachingContext(e.target.value)}
                placeholder="Describe con detalle qué contenido viste, qué subtemas ya trabajaste, en qué se equivocan más tus estudiantes, qué habilidad quieres evaluar y qué tipo de ejercicios quieres que aparezcan."
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/30 min-h-[130px] resize-vertical"
              />
              <p className="text-[11px] text-gray-600 mt-1.5">
                Mientras más específico seas aquí, mejor podrá analizar el agente y generar
                preguntas alineadas con tu clase.
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
                <label className="text-gray-400 text-xs font-semibold block mb-2">
                  DISTRIBUCIÓN DE PREGUNTAS
                </label>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Alternativas", icon: "📋", value: mcCount, set: setMcCount, max: 20 },
                    { label: "Verdadero/Falso", icon: "✓✗", value: tfCount, set: setTfCount, max: 20 },
                    { label: "Desarrollo", icon: "✍️", value: devCount, set: setDevCount, max: 10 },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-3 text-center"
                    >
                      <p className="text-lg font-bold mb-1">{item.icon}</p>
                      <p className="text-gray-400 text-[10px] font-semibold mb-2">
                        {item.label}
                      </p>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => item.set(Math.max(0, item.value - 1))}
                          className="w-7 h-7 rounded-lg bg-white/[0.06] text-gray-400 text-sm"
                        >
                          -
                        </button>
                        <span className="text-white font-bold text-lg w-6 text-center">
                          {item.value}
                        </span>
                        <button
                          onClick={() => item.set(Math.min(item.max, item.value + 1))}
                          className="w-7 h-7 rounded-lg bg-white/[0.06] text-gray-400 text-sm"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-center text-gray-500 text-xs mt-2">
                  Total: {totalQuestions} preguntas
                </p>
              </div>

              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-3">
                <label className="text-gray-400 text-xs font-semibold block">
                  MODO DE PUNTAJE
                </label>

                <div className="grid grid-cols-2 gap-2">
                  {([
                    {
                      id: "auto",
                      label: "Automático por IA",
                      desc: "La IA sugiere puntajes según tipo y dificultad.",
                    },
                    {
                      id: "manual",
                      label: "Manual con rúbrica",
                      desc: "Editas puntajes y criterios en la vista previa.",
                    },
                  ] as const).map(mode => (
                    <button
                      key={mode.id}
                      onClick={() => setScoreMode(mode.id)}
                      className={`text-left rounded-xl border px-3 py-3 transition-all ${
                        scoreMode === mode.id
                          ? "bg-blue-500/10 border-blue-500/30 text-blue-300"
                          : "border-white/[0.06] text-gray-400 hover:bg-white/[0.04]"
                      }`}
                    >
                      <p className="text-xs font-semibold">{mode.label}</p>
                      <p className="text-[11px] text-gray-500 mt-1">{mode.desc}</p>
                    </button>
                  ))}
                </div>

                {scoreMode === "manual" && (
                  <div>
                    <label className="text-gray-500 text-[11px] font-semibold block mb-1.5">
                      GUÍA DE RÚBRICA DEL DOCENTE
                    </label>
                    <textarea
                      value={manualRubricGuide}
                      onChange={e => setManualRubricGuide(e.target.value)}
                      placeholder="Ej: En desarrollo quiero evaluar procedimiento, uso correcto de conceptos y justificación."
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500/30 min-h-[84px] resize-vertical"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-4">
              <div className="lg:col-span-1">
                <label className="text-gray-400 text-xs font-semibold block mb-2">
                  DIFICULTAD GLOBAL
                </label>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  {diffOptions.map(d => (
                    <button
                      key={d.id}
                      onClick={() => setDifficulty(d.id)}
                      className={`py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                        difficulty === d.id
                          ? "text-white"
                          : "border-white/[0.06] text-gray-500 hover:bg-white/[0.04]"
                      }`}
                      style={difficulty === d.id ? d.active : {}}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-gray-400 text-xs font-semibold block mb-1.5">
                  TIEMPO LÍMITE
                </label>
                <select
                  value={timeLimit}
                  onChange={e => setTimeLimit(Number(e.target.value))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 text-sm focus:outline-none"
                >
                  {[15, 20, 30, 45, 60, 90, 120].map(n => (
                    <option key={n} value={n} className="bg-gray-900">
                      {n} minutos
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-gray-400 text-xs font-semibold block mb-1.5">
                  EXIGENCIA (4.0)
                </label>
                <select
                  value={exigencia}
                  onChange={e => setExigencia(Number(e.target.value))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 text-sm focus:outline-none"
                >
                  {[50, 55, 60, 65, 70].map(p => (
                    <option key={p} value={p} className="bg-gray-900">
                      {p}%
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-4">
              <div className="flex items-center justify-between bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06]">
                <div>
                  <p className="text-sm font-semibold text-gray-300">
                    Mostrar nota y retroalimentación
                  </p>
                  <p className="text-xs text-gray-600">
                    El estudiante verá su nota, errores y explicaciones al terminar
                  </p>
                </div>

                <button
                  onClick={() => setShowResult(!showResult)}
                  className={`w-12 h-7 rounded-full transition-all relative ${
                    showResult ? "bg-blue-500" : "bg-gray-700"
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-all ${
                      showResult ? "left-6" : "left-1"
                    }`}
                  />
                </button>
              </div>

              <div className="bg-blue-500/[0.05] border border-blue-500/20 rounded-2xl p-4">
                <p className="text-blue-300 text-xs font-semibold mb-1">RECOMENDACIÓN</p>
                <p className="text-gray-400 text-sm">
                  Primero genera el examen, luego en la vista previa podrás cambiar
                  dificultad, habilidad, puntaje y regenerar preguntas individuales sin
                  romper el link final.
                </p>
              </div>
            </div>

            <button
              onClick={generateExam}
              disabled={!topic.trim() || totalQuestions < 1}
              className="w-full py-3.5 rounded-2xl bg-blue-600/90 hover:bg-blue-500 text-white font-bold text-sm disabled:opacity-30 transition-all"
            >
              🤖 Generar examen con IA ({totalQuestions} preguntas)
            </button>

            {error && (
              <p className="text-red-400 text-xs bg-red-500/10 rounded-xl p-3">
                ❌ {error}
              </p>
            )}
          </div>
        )}

        {step === "generating" && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full border-2 border-white/10 border-t-blue-400 animate-spin mx-auto mb-4" />
            <h3 className="text-white font-bold mb-1">Generando examen...</h3>
            <p className="text-gray-600 text-sm">
              Creando {totalQuestions} preguntas sobre "{topic}"
            </p>
            <p className="text-gray-700 text-xs mt-2">
              {mcCount} alternativas + {tfCount} V/F + {devCount} desarrollo
            </p>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">{title}</h2>
                <p className="text-gray-500 text-sm mt-1">
                  {questions.length} preguntas • {timeLimit} min • {exigencia}% exigencia •
                  Puntaje total: {totalPoints} pts
                </p>
              </div>

              <button
                onClick={() => setStep("config")}
                className="text-gray-500 text-xs hover:text-white"
              >
                ← Volver a configurar
              </button>
            </div>

            {agentSummary && (
              <div className="grid md:grid-cols-3 gap-3">
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-3">
                  <p className="text-gray-500 text-[11px] font-semibold mb-1">
                    TEMA DETECTADO
                  </p>
                  <p className="text-sm text-gray-200">
                    {agentSummary.detectedTopic || topic}
                  </p>
                </div>

                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-3 md:col-span-2">
                  <p className="text-gray-500 text-[11px] font-semibold mb-1">
                    SUBTEMAS / FOCO
                  </p>
                  <p className="text-sm text-gray-300">
                    {Array.isArray(agentSummary.subtopics)
                      ? agentSummary.subtopics.join(" • ")
                      : "Sin subtemas detectados"}
                  </p>
                  {agentSummary.recommendedFocus && (
                    <p className="text-xs text-blue-300 mt-2">
                      Foco sugerido: {agentSummary.recommendedFocus}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              {questions.map((q, i) => (
                <div
                  key={i}
                  className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 relative group space-y-4"
                >
                  <button
                    onClick={() => removeQuestion(i)}
                    className="absolute top-2 right-2 text-gray-700 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ✕
                  </button>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        q.type === "multiple_choice"
                          ? "bg-blue-500/10 text-blue-400"
                          : q.type === "true_false"
                            ? "bg-green-500/10 text-green-400"
                            : "bg-orange-500/10 text-orange-400"
                      }`}
                    >
                      {questionTypeLabel(q.type)}
                    </span>

                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${difficultyPillClass(q.difficulty)}`}
                    >
                      {difficultyLabel(q.difficulty)}
                    </span>

                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300">
                      {abilityOptions.find(a => a.id === q.ability)?.label || "Aplicación"}
                    </span>

                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 ml-auto">
                      {q.maxPoints || 0} pts
                    </span>
                  </div>

                  <div>
                    <div className="text-sm text-gray-200 mb-2">
                      <span className="mr-1">{i + 1}.</span>
                      <ExamMathText text={q.question} className="inline" />
                    </div>

                    {q.type === "development" && q.modelAnswer && (
                      <div className="bg-orange-500/[0.05] rounded-lg p-2 border border-orange-500/10 mt-2">
                        <p className="text-orange-400 text-[10px] font-semibold">
                          Respuesta modelo:
                        </p>
                        <div className="text-gray-400 text-xs">
                          <ExamMathText text={q.modelAnswer || ""} className="inline" />
                        </div>
                      </div>
                    )}

                    {q.type !== "development" && (
                      <div className="space-y-1 mt-2">
                        {(q.options || []).map((opt, j) => (
                          <div
                            key={j}
                            className={`text-xs px-3 py-1.5 rounded-lg ${
                              j === q.correctAnswer
                                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                : "text-gray-500"
                            }`}
                          >
                            {q.type === "true_false" ? "" : `${String.fromCharCode(65 + j)}) `}
                            <ExamMathText text={opt} className="inline" />{" "}
                            {j === q.correctAnswer && "✓"}
                          </div>
                        ))}
                      </div>
                    )}

                    {q.type === "development" && q.rubric && q.rubric.length > 0 && (
                      <div className="mt-2 bg-white/[0.03] rounded-xl border border-white/[0.06] p-3">
                        <p className="text-gray-500 text-[11px] font-semibold mb-2">RÚBRICA</p>

                        <div className="space-y-2">
                          {q.rubric.map((item, rIdx) => (
                            <div key={rIdx} className="grid grid-cols-[1fr_88px] gap-2">
                              <input
                                value={item.criteria}
                                onChange={e => {
                                  const rubric = [...(q.rubric || [])]
                                  rubric[rIdx] = {
                                    ...rubric[rIdx],
                                    criteria: e.target.value,
                                  }
                                  updateQuestion(i, { rubric })
                                }}
                                className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500/30"
                              />
                              <input
                                type="number"
                                min={0}
                                step={0.5}
                                value={item.points}
                                onChange={e => {
                                  const rubric = [...(q.rubric || [])]
                                  rubric[rIdx] = {
                                    ...rubric[rIdx],
                                    points: clampPositive(Number(e.target.value), 0),
                                  }
                                  updateQuestion(i, { rubric })
                                }}
                                className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500/30"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid lg:grid-cols-4 gap-3">
                    <div>
                      <label className="text-gray-500 text-[11px] font-semibold block mb-1">
                        Dificultad
                      </label>
                      <select
                        value={q.difficulty || 2}
                        onChange={e =>
                          updateQuestion(i, {
                            difficulty: Number(e.target.value) as 1 | 2 | 3,
                          })
                        }
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-xs focus:outline-none"
                      >
                        <option value={1} className="bg-gray-900">
                          Fácil
                        </option>
                        <option value={2} className="bg-gray-900">
                          Media
                        </option>
                        <option value={3} className="bg-gray-900">
                          Difícil
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="text-gray-500 text-[11px] font-semibold block mb-1">
                        Habilidad
                      </label>
                      <select
                        value={q.ability || "aplicacion"}
                        onChange={e =>
                          updateQuestion(i, {
                            ability: e.target.value as Ability,
                          })
                        }
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-xs focus:outline-none"
                      >
                        {abilityOptions.map(a => (
                          <option key={a.id} value={a.id} className="bg-gray-900">
                            {a.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-gray-500 text-[11px] font-semibold block mb-1">
                        Puntaje
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={q.maxPoints || 0}
                        onChange={e =>
                          updateQuestion(i, {
                            maxPoints: clampPositive(Number(e.target.value), 0),
                          })
                        }
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-blue-500/30"
                      />
                    </div>

                    <div>
                      <label className="text-gray-500 text-[11px] font-semibold block mb-1">
                        Regenerar
                      </label>
                      <button
                        onClick={() => regenerateQuestion(i)}
                        disabled={busyQuestion === i}
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-xs hover:bg-white/[0.07] disabled:opacity-50"
                      >
                        {busyQuestion === i ? "Generando..." : "🔄 Similar mejorada"}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => regenerateQuestion(i, { difficulty: 1 })}
                      disabled={busyQuestion === i}
                      className="px-3 py-2 rounded-xl bg-green-500/10 border border-green-500/20 text-green-300 text-xs disabled:opacity-50"
                    >
                      Más fácil
                    </button>

                    <button
                      onClick={() => regenerateQuestion(i, { difficulty: 2 })}
                      disabled={busyQuestion === i}
                      className="px-3 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-xs disabled:opacity-50"
                    >
                      Nivel medio
                    </button>

                    <button
                      onClick={() => regenerateQuestion(i, { difficulty: 3 })}
                      disabled={busyQuestion === i}
                      className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs disabled:opacity-50"
                    >
                      Más difícil
                    </button>

                    <button
                      onClick={() => regenerateQuestion(i, { ability: "aplicacion" })}
                      disabled={busyQuestion === i}
                      className="px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs disabled:opacity-50"
                    >
                      Cambiar a aplicación
                    </button>

                    <button
                      onClick={() => regenerateQuestion(i, { ability: "analisis" })}
                      disabled={busyQuestion === i}
                      className="px-3 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs disabled:opacity-50"
                    >
                      Cambiar a análisis
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06]">
                <p className="text-gray-500 text-xs mb-1">Modo de puntaje</p>
                <p className="text-white font-semibold">
                  {scoreMode === "auto" ? "Automático por IA" : "Manual con rúbrica"}
                </p>
              </div>

              <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06]">
                <p className="text-gray-500 text-xs mb-1">Preguntas</p>
                <p className="text-white font-semibold">{questions.length}</p>
              </div>

              <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06]">
                <p className="text-gray-500 text-xs mb-1">Puntaje total</p>
                <p className="text-white font-semibold">{totalPoints} pts</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={generateExam}
                className="flex-1 py-3 rounded-2xl border border-white/10 text-gray-400 font-semibold text-sm hover:bg-white/[0.04]"
              >
                🔄 Regenerar todo
              </button>

              <button
                onClick={publishExam}
                className="flex-1 py-3 rounded-2xl bg-green-600/90 hover:bg-green-500 text-white font-bold text-sm"
              >
                ✅ Publicar examen
              </button>
            </div>

            {error && (
              <p className="text-red-400 text-xs bg-red-500/10 rounded-xl p-3">
                ❌ {error}
              </p>
            )}
          </div>
        )}

        {step === "published" && examData && (
          <div className="text-center space-y-6">
            <div className="text-5xl mb-2">🎉</div>
            <h2 className="text-xl font-bold text-white">¡Examen publicado!</h2>
            <p className="text-gray-500 text-sm">
              Comparte este link con tus estudiantes
            </p>

            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
              <p className="text-blue-400 text-sm font-mono break-all mb-3">{examUrl}</p>

              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => navigator.clipboard?.writeText(examUrl)}
                  className="px-4 py-2 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 text-xs font-semibold"
                >
                  📋 Copiar link
                </button>

                <button
                  onClick={() => navigator.share?.({ title, url: examUrl })}
                  className="px-4 py-2 rounded-xl bg-green-600/20 border border-green-500/30 text-green-400 text-xs font-semibold"
                >
                  📤 Compartir
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06]">
                <p className="text-gray-500 text-xs mb-1">CÓDIGO</p>
                <p className="text-3xl font-mono font-bold text-white tracking-widest">
                  {examData.code}
                </p>
              </div>

              <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06]">
                <p className="text-gray-500 text-xs mb-1">PUNTAJE TOTAL</p>
                <p className="text-3xl font-bold text-white">{totalPoints} pts</p>
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <Link
                href="/examen/docente"
                className="px-5 py-3 rounded-2xl border border-white/10 text-gray-300 text-sm font-semibold hover:bg-white/[0.04]"
              >
                Volver al panel
              </Link>

              <button
                onClick={() => router.push(`/examen/p/${examData.code}`)}
                className="px-5 py-3 rounded-2xl bg-blue-600/90 hover:bg-blue-500 text-white text-sm font-bold"
              >
                Ver enlace público
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
