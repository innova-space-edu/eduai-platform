"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

type Difficulty = "facil" | "medio" | "dificil" | "mixto"
type QuestionType = "multiple_choice" | "true_false" | "development"

type MultipleChoiceQuestion = {
  id: string
  type: "multiple_choice"
  question: string
  options: string[]
  correctAnswer: number
  explanation?: string
  maxPoints?: number
}

type TrueFalseQuestion = {
  id: string
  type: "true_false"
  question: string
  correctAnswer: number
  explanation?: string
  selectionPoints?: number
  justificationMaxPoints?: number
  maxPoints?: number
}

type DevelopmentRubricItem = {
  criterion: string
  points: number
}

type DevelopmentQuestion = {
  id: string
  type: "development"
  question: string
  expectedAnswer?: string
  rubric: DevelopmentRubricItem[]
  maxPoints?: number
}

type Question =
  | MultipleChoiceQuestion
  | TrueFalseQuestion
  | DevelopmentQuestion

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function defaultQuestion(type: QuestionType): Question {
  if (type === "multiple_choice") {
    return {
      id: uid(),
      type: "multiple_choice",
      question: "",
      options: ["", "", "", ""],
      correctAnswer: 0,
      explanation: "",
      maxPoints: 1,
    }
  }

  if (type === "true_false") {
    return {
      id: uid(),
      type: "true_false",
      question: "",
      correctAnswer: 0,
      explanation: "",
      selectionPoints: 1,
      justificationMaxPoints: 2,
      maxPoints: 3,
    }
  }

  return {
    id: uid(),
    type: "development",
    question: "",
    expectedAnswer: "",
    rubric: [
      { criterion: "Comprensión del contenido", points: 2 },
      { criterion: "Desarrollo y fundamentación", points: 2 },
      { criterion: "Claridad de la respuesta", points: 1 },
    ],
    maxPoints: 5,
  }
}

function getQuestionPoints(q: Question) {
  if (q.type === "multiple_choice") {
    return Math.max(1, Number(q.maxPoints || 1))
  }

  if (q.type === "true_false") {
    const selection = Math.max(0, Number(q.selectionPoints || 1))
    const justification = Math.max(0, Number(q.justificationMaxPoints || 2))
    return selection + justification
  }

  if (Array.isArray(q.rubric) && q.rubric.length > 0) {
    return q.rubric.reduce((acc, item) => acc + (Number(item.points) || 0), 0)
  }

  return Math.max(1, Number(q.maxPoints || 5))
}

export default function CrearExamenPage() {
  const router = useRouter()

  const [title, setTitle] = useState("")
  const [topic, setTopic] = useState("")
  const [instructions, setInstructions] = useState("")
  const [difficulty, setDifficulty] = useState<Difficulty>("mixto")
  const [timeLimit, setTimeLimit] = useState(60)
  const [examPercentage, setExamPercentage] = useState(60)
  const [showResultToStudent, setShowResultToStudent] = useState(true)
  const [allowReview, setAllowReview] = useState(true)
  const [isPublic, setIsPublic] = useState(true)

  const [questions, setQuestions] = useState<Question[]>([
    defaultQuestion("multiple_choice"),
  ])

  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [successMsg, setSuccessMsg] = useState("")

  const totalPoints = useMemo(
    () => questions.reduce((acc, q) => acc + getQuestionPoints(q), 0),
    [questions]
  )

  const addQuestion = (type: QuestionType) => {
    setQuestions((prev) => [...prev, defaultQuestion(type)])
  }

  const removeQuestion = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id))
  }

  const updateQuestion = (id: string, updater: (q: Question) => Question) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? updater(q) : q)))
  }

  const validateExam = () => {
    if (!title.trim()) return "Debes ingresar un título."
    if (!topic.trim()) return "Debes ingresar un tema."
    if (questions.length === 0) return "Debes agregar al menos una pregunta."

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]

      if (!q.question.trim()) {
        return `La pregunta ${i + 1} no tiene enunciado.`
      }

      if (q.type === "multiple_choice") {
        if (q.options.some((opt) => !opt.trim())) {
          return `La pregunta ${i + 1} tiene alternativas vacías.`
        }

        if (
          q.correctAnswer < 0 ||
          q.correctAnswer >= q.options.length
        ) {
          return `La pregunta ${i + 1} tiene una alternativa correcta inválida.`
        }
      }

      if (q.type === "development") {
        if (!q.rubric.length) {
          return `La pregunta ${i + 1} de desarrollo debe tener rúbrica.`
        }

        if (q.rubric.some((r) => !r.criterion.trim() || Number(r.points) <= 0)) {
          return `La rúbrica de la pregunta ${i + 1} tiene elementos inválidos.`
        }
      }
    }

    return ""
  }

  const handleCreate = async () => {
    setErrorMsg("")
    setSuccessMsg("")

    const validationError = validateExam()
    if (validationError) {
      setErrorMsg(validationError)
      return
    }

    setSaving(true)

    try {
      const payloadQuestions = questions.map((q) => {
        if (q.type === "multiple_choice") {
          return {
            type: q.type,
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation || "",
            maxPoints: Number(q.maxPoints || 1),
          }
        }

        if (q.type === "true_false") {
          return {
            type: q.type,
            question: q.question,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation || "",
            selectionPoints: Number(q.selectionPoints || 1),
            justificationMaxPoints: Number(q.justificationMaxPoints || 2),
            maxPoints: getQuestionPoints(q),
          }
        }

        return {
          type: q.type,
          question: q.question,
          expectedAnswer: q.expectedAnswer || "",
          rubric: q.rubric.map((r) => ({
            criterion: r.criterion,
            points: Number(r.points || 0),
          })),
          maxPoints: getQuestionPoints(q),
        }
      })

      const res = await fetch("/api/agents/examen-docente", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "create",
          title,
          topic,
          instructions,
          difficulty,
          questions: payloadQuestions,
          settings: {
            timeLimit: Number(timeLimit || 60),
            examPercentage: Number(examPercentage || 60),
            showResultToStudent,
            allowReview,
            isPublic,
          },
        }),
      })

      const data = await res.json()

      if (!data?.success) {
        throw new Error(data?.error || "No se pudo crear el examen.")
      }

      setSuccessMsg("Examen creado correctamente.")

      setTimeout(() => {
        router.push("/examen/docente")
      }, 900)
    } catch (error: any) {
      setErrorMsg(error?.message || "Error al crear el examen.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <p className="text-blue-400 text-xs tracking-[0.25em] font-semibold mb-2">
            EXAMEN DOCENTE
          </p>
          <h1 className="text-3xl md:text-4xl font-extrabold">
            Crear nuevo examen
          </h1>
          <p className="text-gray-400 mt-2 text-sm md:text-base">
            Diseña tu evaluación, configura el tiempo, el porcentaje de exigencia
            y agrega preguntas de alternativas, verdadero/falso o desarrollo.
          </p>
        </div>

        <div className="grid xl:grid-cols-[1fr_330px] gap-6">
          <div className="space-y-6">
            <section className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5 md:p-6">
              <h2 className="text-lg font-bold mb-4">Información general</h2>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400 font-semibold block mb-2">
                    TÍTULO
                  </label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ej: Prueba de porcentajes e interés"
                    className="w-full rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/40"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 font-semibold block mb-2">
                    TEMA
                  </label>
                  <input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Ej: Matemática financiera"
                    className="w-full rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/40"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 font-semibold block mb-2">
                    DIFICULTAD
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                    className="w-full rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/40"
                  >
                    <option value="facil">Fácil</option>
                    <option value="medio">Medio</option>
                    <option value="dificil">Difícil</option>
                    <option value="mixto">Mixto</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-400 font-semibold block mb-2">
                    TIEMPO (MINUTOS)
                  </label>
                  <input
                    type="number"
                    min={5}
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(Number(e.target.value || 60))}
                    className="w-full rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/40"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 font-semibold block mb-2">
                    EXIGENCIA (%)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={examPercentage}
                    onChange={(e) =>
                      setExamPercentage(Number(e.target.value || 60))
                    }
                    className="w-full rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/40"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    <label className="flex items-center gap-2 text-gray-300">
                      <input
                        type="checkbox"
                        checked={showResultToStudent}
                        onChange={(e) => setShowResultToStudent(e.target.checked)}
                      />
                      Mostrar resultado al estudiante
                    </label>
                    <label className="flex items-center gap-2 text-gray-300">
                      <input
                        type="checkbox"
                        checked={allowReview}
                        onChange={(e) => setAllowReview(e.target.checked)}
                      />
                      Permitir revisión
                    </label>
                    <label className="flex items-center gap-2 text-gray-300">
                      <input
                        type="checkbox"
                        checked={isPublic}
                        onChange={(e) => setIsPublic(e.target.checked)}
                      />
                      Hacer examen público
                    </label>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <label className="text-xs text-gray-400 font-semibold block mb-2">
                  INSTRUCCIONES
                </label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Escribe instrucciones para tus estudiantes..."
                  className="w-full min-h-[120px] rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/40"
                />
              </div>
            </section>

            <section className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5 md:p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
                <h2 className="text-lg font-bold">Preguntas del examen</h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => addQuestion("multiple_choice")}
                    className="px-4 py-2 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold"
                  >
                    + Alternativas
                  </button>
                  <button
                    onClick={() => addQuestion("true_false")}
                    className="px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold"
                  >
                    + V/F
                  </button>
                  <button
                    onClick={() => addQuestion("development")}
                    className="px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold"
                  >
                    + Desarrollo
                  </button>
                </div>
              </div>

              <div className="space-y-5">
                {questions.map((q, index) => (
                  <div
                    key={q.id}
                    className="rounded-3xl border border-white/[0.08] bg-black/20 p-4 md:p-5"
                  >
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <p className="text-xs tracking-widest text-gray-500 font-semibold">
                          PREGUNTA {index + 1}
                        </p>
                        <p className="text-sm text-gray-300 mt-1">
                          Tipo:{" "}
                          <span className="font-semibold text-white">
                            {q.type === "multiple_choice"
                              ? "Alternativas"
                              : q.type === "true_false"
                                ? "Verdadero/Falso"
                                : "Desarrollo"}
                          </span>
                        </p>
                      </div>

                      <button
                        onClick={() => removeQuestion(q.id)}
                        disabled={questions.length === 1}
                        className="px-3 py-2 rounded-xl bg-red-500/15 text-red-300 hover:bg-red-500/25 disabled:opacity-40 text-sm"
                      >
                        Eliminar
                      </button>
                    </div>

                    <div className="mb-4">
                      <label className="text-xs text-gray-400 font-semibold block mb-2">
                        ENUNCIADO
                      </label>
                      <textarea
                        value={q.question}
                        onChange={(e) =>
                          updateQuestion(q.id, (prev) => ({
                            ...prev,
                            question: e.target.value,
                          }))
                        }
                        className="w-full min-h-[110px] rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/40"
                        placeholder="Escribe la pregunta..."
                      />
                    </div>

                    {q.type === "multiple_choice" && (
                      <div className="space-y-3">
                        {q.options.map((option, optIndex) => (
                          <div key={optIndex} className="grid grid-cols-[1fr_auto] gap-3 items-center">
                            <input
                              value={option}
                              onChange={(e) =>
                                updateQuestion(q.id, (prev) => {
                                  if (prev.type !== "multiple_choice") return prev
                                  const next = [...prev.options]
                                  next[optIndex] = e.target.value
                                  return { ...prev, options: next }
                                })
                              }
                              className="w-full rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/40"
                              placeholder={`Alternativa ${optIndex + 1}`}
                            />

                            <label className="flex items-center gap-2 text-sm text-gray-300 whitespace-nowrap">
                              <input
                                type="radio"
                                name={`correct-${q.id}`}
                                checked={q.correctAnswer === optIndex}
                                onChange={() =>
                                  updateQuestion(q.id, (prev) =>
                                    prev.type === "multiple_choice"
                                      ? { ...prev, correctAnswer: optIndex }
                                      : prev
                                  )
                                }
                              />
                              Correcta
                            </label>
                          </div>
                        ))}

                        <div className="grid md:grid-cols-2 gap-4 mt-3">
                          <div>
                            <label className="text-xs text-gray-400 font-semibold block mb-2">
                              EXPLICACIÓN
                            </label>
                            <textarea
                              value={q.explanation || ""}
                              onChange={(e) =>
                                updateQuestion(q.id, (prev) =>
                                  prev.type === "multiple_choice"
                                    ? { ...prev, explanation: e.target.value }
                                    : prev
                                )
                              }
                              className="w-full min-h-[90px] rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/40"
                            />
                          </div>

                          <div>
                            <label className="text-xs text-gray-400 font-semibold block mb-2">
                              PUNTAJE
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={q.maxPoints || 1}
                              onChange={(e) =>
                                updateQuestion(q.id, (prev) =>
                                  prev.type === "multiple_choice"
                                    ? { ...prev, maxPoints: Number(e.target.value || 1) }
                                    : prev
                                )
                              }
                              className="w-full rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/40"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {q.type === "true_false" && (
                      <div className="space-y-4">
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 text-sm text-gray-300">
                            <input
                              type="radio"
                              name={`tf-${q.id}`}
                              checked={q.correctAnswer === 0}
                              onChange={() =>
                                updateQuestion(q.id, (prev) =>
                                  prev.type === "true_false"
                                    ? { ...prev, correctAnswer: 0 }
                                    : prev
                                )
                              }
                            />
                            Verdadero
                          </label>

                          <label className="flex items-center gap-2 text-sm text-gray-300">
                            <input
                              type="radio"
                              name={`tf-${q.id}`}
                              checked={q.correctAnswer === 1}
                              onChange={() =>
                                updateQuestion(q.id, (prev) =>
                                  prev.type === "true_false"
                                    ? { ...prev, correctAnswer: 1 }
                                    : prev
                                )
                              }
                            />
                            Falso
                          </label>
                        </div>

                        <div className="grid md:grid-cols-3 gap-4">
                          <div>
                            <label className="text-xs text-gray-400 font-semibold block mb-2">
                              PUNTOS SELECCIÓN
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={q.selectionPoints || 1}
                              onChange={(e) =>
                                updateQuestion(q.id, (prev) =>
                                  prev.type === "true_false"
                                    ? {
                                        ...prev,
                                        selectionPoints: Number(e.target.value || 0),
                                      }
                                    : prev
                                )
                              }
                              className="w-full rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white"
                            />
                          </div>

                          <div>
                            <label className="text-xs text-gray-400 font-semibold block mb-2">
                              PUNTOS JUSTIFICACIÓN
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={q.justificationMaxPoints || 2}
                              onChange={(e) =>
                                updateQuestion(q.id, (prev) =>
                                  prev.type === "true_false"
                                    ? {
                                        ...prev,
                                        justificationMaxPoints: Number(
                                          e.target.value || 0
                                        ),
                                      }
                                    : prev
                                )
                              }
                              className="w-full rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white"
                            />
                          </div>

                          <div>
                            <label className="text-xs text-gray-400 font-semibold block mb-2">
                              PUNTAJE TOTAL
                            </label>
                            <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white">
                              {getQuestionPoints(q)}
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs text-gray-400 font-semibold block mb-2">
                            EXPLICACIÓN
                          </label>
                          <textarea
                            value={q.explanation || ""}
                            onChange={(e) =>
                              updateQuestion(q.id, (prev) =>
                                prev.type === "true_false"
                                  ? { ...prev, explanation: e.target.value }
                                  : prev
                              )
                            }
                            className="w-full min-h-[90px] rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white"
                          />
                        </div>
                      </div>
                    )}

                    {q.type === "development" && (
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs text-gray-400 font-semibold block mb-2">
                            RESPUESTA ESPERADA
                          </label>
                          <textarea
                            value={q.expectedAnswer || ""}
                            onChange={(e) =>
                              updateQuestion(q.id, (prev) =>
                                prev.type === "development"
                                  ? { ...prev, expectedAnswer: e.target.value }
                                  : prev
                              )
                            }
                            className="w-full min-h-[90px] rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white"
                          />
                        </div>

                        <div>
                          <label className="text-xs text-gray-400 font-semibold block mb-2">
                            RÚBRICA
                          </label>

                          <div className="space-y-3">
                            {q.rubric.map((item, rubricIndex) => (
                              <div
                                key={rubricIndex}
                                className="grid grid-cols-[1fr_120px_auto] gap-3 items-center"
                              >
                                <input
                                  value={item.criterion}
                                  onChange={(e) =>
                                    updateQuestion(q.id, (prev) => {
                                      if (prev.type !== "development") return prev
                                      const next = [...prev.rubric]
                                      next[rubricIndex] = {
                                        ...next[rubricIndex],
                                        criterion: e.target.value,
                                      }
                                      return { ...prev, rubric: next }
                                    })
                                  }
                                  className="w-full rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white"
                                  placeholder="Criterio"
                                />

                                <input
                                  type="number"
                                  min={1}
                                  value={item.points}
                                  onChange={(e) =>
                                    updateQuestion(q.id, (prev) => {
                                      if (prev.type !== "development") return prev
                                      const next = [...prev.rubric]
                                      next[rubricIndex] = {
                                        ...next[rubricIndex],
                                        points: Number(e.target.value || 0),
                                      }
                                      return { ...prev, rubric: next }
                                    })
                                  }
                                  className="w-full rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white"
                                />

                                <button
                                  onClick={() =>
                                    updateQuestion(q.id, (prev) => {
                                      if (prev.type !== "development") return prev
                                      return {
                                        ...prev,
                                        rubric: prev.rubric.filter(
                                          (_, idx) => idx !== rubricIndex
                                        ),
                                      }
                                    })
                                  }
                                  disabled={q.rubric.length === 1}
                                  className="px-3 py-2 rounded-xl bg-red-500/15 text-red-300 hover:bg-red-500/25 disabled:opacity-40 text-sm"
                                >
                                  Quitar
                                </button>
                              </div>
                            ))}
                          </div>

                          <button
                            onClick={() =>
                              updateQuestion(q.id, (prev) => {
                                if (prev.type !== "development") return prev
                                return {
                                  ...prev,
                                  rubric: [
                                    ...prev.rubric,
                                    { criterion: "", points: 1 },
                                  ],
                                }
                              })
                            }
                            className="mt-3 px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold"
                          >
                            + Agregar criterio
                          </button>

                          <p className="text-sm text-gray-400 mt-3">
                            Puntaje total de desarrollo:{" "}
                            <span className="text-white font-semibold">
                              {getQuestionPoints(q)}
                            </span>
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5 sticky top-6">
              <h2 className="text-lg font-bold mb-4">Resumen</h2>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-gray-400">Preguntas</span>
                  <span className="font-semibold text-white">{questions.length}</span>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="text-gray-400">Puntaje total</span>
                  <span className="font-semibold text-white">{totalPoints}</span>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="text-gray-400">Tiempo</span>
                  <span className="font-semibold text-white">{timeLimit} min</span>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="text-gray-400">Exigencia</span>
                  <span className="font-semibold text-white">{examPercentage}%</span>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="text-gray-400">Dificultad</span>
                  <span className="font-semibold text-white capitalize">
                    {difficulty}
                  </span>
                </div>
              </div>

              {errorMsg ? (
                <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                  {errorMsg}
                </div>
              ) : null}

              {successMsg ? (
                <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                  {successMsg}
                </div>
              ) : null}

              <div className="mt-6 space-y-3">
                <button
                  onClick={handleCreate}
                  disabled={saving}
                  className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold"
                >
                  {saving ? "Creando examen..." : "Crear examen"}
                </button>

                <button
                  onClick={() => router.push("/examen/docente")}
                  className="w-full py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-white"
                >
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
