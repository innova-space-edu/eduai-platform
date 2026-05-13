// components/exam/QuestionCard.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Renderiza una pregunta del examen con:
//  - Imagen opcional (imageUrl)
//  - Los 3 tipos: multiple_choice, true_false, development
//  - Clases exam-option / exam-question-image del sistema de temas
//  - Compatible con ExamMathText para LaTeX
// ─────────────────────────────────────────────────────────────────────────────

"use client"

import ExamMathText from "@/components/ui/ExamMathText"

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface RubricItem {
  criteria: string
  points: number
}

interface Question {
  id?: string
  type: "multiple_choice" | "true_false" | "development"
  question?: string
  statement?: string
  options?: string[]
  correctAnswer?: number
  explanation?: string
  maxPoints?: number
  selectionPoints?: number
  justificationMaxPoints?: number
  rubric?: RubricItem[]
  imageUrl?: string
}

interface QuestionCardProps {
  question: Question
  index: number    // 0-based
  total: number

  // Respuestas actuales
  mcAnswer?:     number
  tfAnswer?:     number
  tfJustification?: string
  devAnswer?:    string

  // Callbacks
  onMcChange:   (index: number) => void
  onTfChange:   (index: number) => void
  onTfJustificationChange: (value: string) => void
  onDevChange:  (value: string) => void

  // Puntos por pregunta
  maxPoints: number
}

// ── Helper ────────────────────────────────────────────────────────────────────

function getQuestionText(q: Question) {
  return q.question || q.statement || ""
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function QuestionCard({
  question: q,
  index,
  total,
  mcAnswer,
  tfAnswer,
  tfJustification,
  devAnswer,
  onMcChange,
  onTfChange,
  onTfJustificationChange,
  onDevChange,
  maxPoints,
}: QuestionCardProps) {
  return (
    <div className="rounded-2xl border border-medium bg-card-soft-theme p-5 md:p-6 exam-question">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs tracking-widest text-muted2 font-semibold">
          PREGUNTA {index + 1} DE {total}
        </p>
        <p className="text-xs text-muted2">
          Puntaje: {maxPoints} pts
        </p>
      </div>

      {/* ── Imagen opcional ── */}
      {q.imageUrl && q.imageUrl.trim() !== "" && (
        <div className="exam-question-image mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={q.imageUrl}
            alt={`Imagen de la pregunta ${index + 1}`}
            className="w-full object-contain max-h-72"
            onError={(e) => {
              // Si la imagen falla, ocultar el contenedor
              const parent = (e.target as HTMLImageElement).parentElement
              if (parent) parent.style.display = "none"
            }}
          />
        </div>
      )}

      {/* ── Enunciado ── */}
      <div className="text-main text-base leading-relaxed mb-6">
        <ExamMathText text={getQuestionText(q)} />
      </div>

      {/* ── Alternativas (multiple_choice) ── */}
      {q.type === "multiple_choice" && (
        <div className="space-y-3">
          {(q.options || []).map((option, i) => {
            const active = mcAnswer === i
            return (
              <button
                key={i}
                onClick={() => onMcChange(i)}
                className={[
                  "w-full text-left rounded-2xl px-4 py-3 border transition exam-option",
                  active ? "selected border-blue-500 bg-blue-500/10 text-main"
                         : "border-medium bg-card-soft-theme text-main hover:border-blue-500/30",
                ].join(" ")}
              >
                <span className="inline-flex items-center gap-3">
                  {/* Letra indicadora */}
                  <span className={[
                    "flex-shrink-0 w-6 h-6 rounded-full border text-xs font-bold flex items-center justify-center",
                    active ? "border-blue-500 bg-blue-500 text-white"
                           : "border-medium text-sub",
                  ].join(" ")}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <ExamMathText text={option} className="inline" />
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* ── Verdadero / Falso ── */}
      {q.type === "true_false" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {["Verdadero", "Falso"].map((label, i) => {
              const active = tfAnswer === i
              return (
                <button
                  key={label}
                  onClick={() => onTfChange(i)}
                  className={[
                    "rounded-2xl px-4 py-3 border font-semibold transition exam-option",
                    active ? "selected border-blue-500 bg-blue-500/10 text-main"
                           : "border-medium bg-card-soft-theme text-main hover:border-blue-500/30",
                  ].join(" ")}
                >
                  <span className="flex items-center justify-center gap-2">
                    <span>{i === 0 ? "✓" : "✗"}</span>
                    {label}
                  </span>
                </button>
              )
            })}
          </div>

          <div>
            <label className="text-sub text-xs font-semibold block mb-2">
              Justificación
              {q.justificationMaxPoints ? (
                <span className="ml-2 text-muted2 font-normal">
                  ({q.justificationMaxPoints} pts)
                </span>
              ) : null}
            </label>
            <textarea
              value={tfJustification || ""}
              onChange={(e) => onTfJustificationChange(e.target.value)}
              className="w-full min-h-[120px] rounded-2xl border border-medium bg-card-soft-theme px-4 py-3 text-main text-sm focus:outline-none focus:border-blue-500/30"
              placeholder="Escribe tu justificación..."
            />
          </div>
        </div>
      )}

      {/* ── Desarrollo ── */}
      {q.type === "development" && (
        <div>
          {/* Mostrar rúbrica como guía al alumno */}
          {Array.isArray(q.rubric) && q.rubric.length > 0 && (
            <div className="mb-4 rounded-2xl border border-soft bg-card-soft-theme/50 p-4">
              <p className="text-xs font-semibold text-sub uppercase tracking-wide mb-2">
                Criterios de evaluación
              </p>
              <div className="space-y-1">
                {q.rubric.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-main">{r.criteria}</span>
                    <span className="text-muted2 ml-3 shrink-0">{r.points} pts</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <label className="text-sub text-xs font-semibold block mb-2">
            Respuesta de desarrollo
          </label>
          <textarea
            value={devAnswer || ""}
            onChange={(e) => onDevChange(e.target.value)}
            className="w-full min-h-[220px] rounded-2xl border border-medium bg-card-soft-theme px-4 py-3 text-main text-sm focus:outline-none focus:border-blue-500/30 exam-option"
            placeholder="Escribe tu respuesta..."
          />
        </div>
      )}
    </div>
  )
}
