// components/exam/ExamRenderer.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Renderer visual completo para exámenes EduAI.
// Aplica tema, fuente, PIE y renderiza cada pregunta con QuestionCard.
// Usado desde app/examen/p/[code]/page.tsx y previews del docente.
// ─────────────────────────────────────────────────────────────────────────────

"use client"

import { useMemo } from "react"
import ExamThemeProvider from "./ExamThemeProvider"
import QuestionCard from "./QuestionCard"
import { resolveExamStyle } from "@/lib/exam/theme-utils"
import type { ExamStyleSettings } from "@/lib/exam/theme-utils"

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface RubricItem {
  criteria: string
  points:   number
}

interface Question {
  id?:                     string
  type:                    "multiple_choice" | "true_false" | "development"
  question?:               string
  statement?:              string
  options?:                string[]
  correctAnswer?:          number
  explanation?:            string
  modelAnswer?:            string
  rubric?:                 RubricItem[]
  maxPoints?:              number
  selectionPoints?:        number
  justificationMaxPoints?: number
  imageUrl?:               string
}

interface ExamRendererProps {
  // Datos del examen
  title?:       string
  questions:    Question[]
  settings?:    ExamStyleSettings & { subject?: string }

  // Estado de respuestas
  currentIndex: number
  mcAnswers:    Record<number, number>
  tfJustifications: Record<number, string>
  devAnswers:   Record<number, string>

  // Callbacks
  onMcChange:   (questionIndex: number, optionIndex: number) => void
  onTfChange:   (questionIndex: number, optionIndex: number) => void
  onTfJustificationChange: (questionIndex: number, value: string) => void
  onDevChange:  (questionIndex: number, value: string) => void

  // Navegación
  onPrev:       () => void
  onNext:       () => void
  onSubmit?:    () => void
  canSubmit?:   boolean

  // Timer (opcional, en segundos)
  timeLeft?:    number

  // Modo: "student" = examen real, "preview" = vista previa del docente
  mode?:        "student" | "preview"
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

function timerColor(secs: number): string {
  if (secs < 60)  return "text-red-600 font-bold"
  if (secs < 300) return "text-orange-600 font-semibold"
  return "text-main"
}

function getMaxPoints(q: Question): number {
  if (typeof q.maxPoints === "number") return q.maxPoints
  if (q.type === "multiple_choice")   return 1
  if (q.type === "true_false") {
    return (q.selectionPoints ?? 1) + (q.justificationMaxPoints ?? 2)
  }
  if (q.type === "development") {
    return (q.rubric ?? []).reduce((sum, r) => sum + (r.points ?? 0), 0) || 5
  }
  return 1
}

function totalPoints(questions: Question[]): number {
  return questions.reduce((sum, q) => sum + getMaxPoints(q), 0)
}

// ── Barra de progreso ─────────────────────────────────────────────────────────

function ProgressBar({
  current,
  total,
  answered,
}: {
  current: number
  total:   number
  answered: number
}) {
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-sub">
        <span>{answered}/{total} respondidas</span>
        <span>{pct}% completado</span>
      </div>
      <div className="h-2 rounded-full bg-card-soft-theme border border-soft overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ── Indicadores de pregunta (bullets) ────────────────────────────────────────

function QuestionDots({
  total,
  current,
  mcAnswers,
  tfAnswers,
  devAnswers,
  onJump,
}: {
  total:      number
  current:    number
  mcAnswers:  Record<number, number>
  tfAnswers:  Record<number, number>
  devAnswers: Record<number, string>
  onJump:     (i: number) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: total }, (_, i) => {
        const answered =
          mcAnswers[i] !== undefined ||
          tfAnswers[i] !== undefined ||
          (devAnswers[i]?.trim().length ?? 0) > 0

        return (
          <button
            key={i}
            onClick={() => onJump(i)}
            className={[
              "w-7 h-7 rounded-lg text-xs font-semibold transition-all",
              i === current
                ? "bg-blue-600 text-white"
                : answered
                ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-700"
                : "bg-card-soft-theme border border-soft text-sub hover:border-blue-400/30",
            ].join(" ")}
          >
            {i + 1}
          </button>
        )
      })}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ExamRenderer({
  title,
  questions,
  settings,
  currentIndex,
  mcAnswers,
  tfJustifications,
  devAnswers,
  onMcChange,
  onTfChange,
  onTfJustificationChange,
  onDevChange,
  onPrev,
  onNext,
  onSubmit,
  canSubmit = false,
  timeLeft,
  mode = "student",
}: ExamRendererProps) {
  const q     = questions[currentIndex]
  const total = questions.length

  const resolved = useMemo(() => resolveExamStyle(settings), [settings])

  // Contar respondidas
  const answeredCount = useMemo(() => {
    return questions.reduce((count, _, i) => {
      const answered =
        mcAnswers[i] !== undefined ||
        (devAnswers[i]?.trim().length ?? 0) > 0
      return count + (answered ? 1 : 0)
    }, 0)
  }, [questions, mcAnswers, devAnswers])

  if (!q) return null

  return (
    <ExamThemeProvider settings={settings}>
      <div
        className="exam-root min-h-screen"
        style={{ backgroundColor: "var(--exam-bg, inherit)" }}
      >
        <div
          className="exam-content mx-auto px-4 py-6"
          style={{ maxWidth: resolved.maxWidth }}
        >

          {/* ── Header ── */}
          <div className="mb-6 space-y-3">
            {title && (
              <h1 className="text-xl font-bold text-main truncate">{title}</h1>
            )}

            {/* Timer + puntaje total */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3 text-sm text-sub">
                <span>Total: <strong className="text-main">{totalPoints(questions)} pts</strong></span>
                {mode === "preview" && (
                  <span className="rounded-full border border-yellow-400/30 bg-yellow-400/10 px-2.5 py-1 text-xs text-yellow-700 font-medium">
                    Vista previa
                  </span>
                )}
              </div>

              {typeof timeLeft === "number" && (
                <div className={`text-lg font-mono ${timerColor(timeLeft)}`}>
                  ⏱ {formatTime(timeLeft)}
                </div>
              )}
            </div>

            {/* Progreso */}
            <ProgressBar
              current={currentIndex}
              total={total}
              answered={answeredCount}
            />

            {/* Bullets de navegación */}
            <QuestionDots
              total={total}
              current={currentIndex}
              mcAnswers={mcAnswers}
              tfAnswers={mcAnswers}
              devAnswers={devAnswers}
              onJump={(i) => {
                // Navegar al índice — el padre maneja esto con onPrev/onNext
                // Para salto directo se necesita un callback extra; usamos prev/next
                const diff = i - currentIndex
                if (diff > 0) { for (let n = 0; n < diff; n++) onNext() }
                else if (diff < 0) { for (let n = 0; n < -diff; n++) onPrev() }
              }}
            />
          </div>

          {/* ── Pregunta actual ── */}
          <QuestionCard
            question={q}
            index={currentIndex}
            total={total}
            maxPoints={getMaxPoints(q)}
            mcAnswer={mcAnswers[currentIndex]}
            tfAnswer={mcAnswers[currentIndex]}
            tfJustification={tfJustifications[currentIndex]}
            devAnswer={devAnswers[currentIndex]}
            onMcChange={(i) => onMcChange(currentIndex, i)}
            onTfChange={(i) => onTfChange(currentIndex, i)}
            onTfJustificationChange={(v) => onTfJustificationChange(currentIndex, v)}
            onDevChange={(v) => onDevChange(currentIndex, v)}
          />

          {/* ── Navegación ── */}
          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              onClick={onPrev}
              disabled={currentIndex === 0}
              className="rounded-2xl border border-soft bg-card-soft-theme px-5 py-2.5 text-sm font-medium text-main hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
            >
              ← Anterior
            </button>

            <span className="text-xs text-muted2">
              {currentIndex + 1} / {total}
            </span>

            {currentIndex < total - 1 ? (
              <button
                onClick={onNext}
                className="rounded-2xl border border-blue-500/30 bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
              >
                Siguiente →
              </button>
            ) : onSubmit ? (
              <button
                onClick={onSubmit}
                disabled={!canSubmit}
                className="rounded-2xl border border-emerald-500/30 bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Entregar examen ✓
              </button>
            ) : null}
          </div>

          {/* ── Instrucción de teclado (solo student) ── */}
          {mode === "student" && (
            <p className="mt-4 text-center text-xs text-muted2">
              Usa ← → para navegar entre preguntas
            </p>
          )}
        </div>
      </div>
    </ExamThemeProvider>
  )
}
