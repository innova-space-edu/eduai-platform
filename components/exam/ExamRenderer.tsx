"use client";

import { useMemo } from "react";
import ExamThemeProvider from "./ExamThemeProvider";
import QuestionCard from "./QuestionCard";
import { resolveExamStyle } from "@/lib/exam/theme-utils";
import type { ExamStyleSettings } from "@/lib/exam/theme-utils";

interface RubricItem { criteria: string; points: number }
interface Question {
  id?: string;
  type: "multiple_choice" | "true_false" | "development";
  question?: string;
  statement?: string;
  options?: string[];
  correctAnswer?: number;
  explanation?: string;
  modelAnswer?: string;
  rubric?: RubricItem[];
  maxPoints?: number;
  selectionPoints?: number;
  justificationMaxPoints?: number;
  imageUrl?: string;
}

interface ExamRendererProps {
  title?: string;
  questions: Question[];
  settings?: ExamStyleSettings & { subject?: string };
  currentIndex: number;
  mcAnswers: Record<number, number>;
  tfJustifications: Record<number, string>;
  devAnswers: Record<number, string>;
  onMcChange: (questionIndex: number, optionIndex: number) => void;
  onTfChange: (questionIndex: number, optionIndex: number) => void;
  onTfJustificationChange: (questionIndex: number, value: string) => void;
  onDevChange: (questionIndex: number, value: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onSubmit?: () => void;
  canSubmit?: boolean;
  timeLeft?: number;
  mode?: "student" | "preview";
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getMaxPoints(q: Question): number {
  if (typeof q.maxPoints === "number") return q.maxPoints;
  if (q.type === "multiple_choice") return 1;
  if (q.type === "true_false") return (q.selectionPoints ?? 1) + (q.justificationMaxPoints ?? 2);
  if (q.type === "development") return (q.rubric ?? []).reduce((sum, r) => sum + (r.points ?? 0), 0) || 5;
  return 1;
}

function totalPoints(questions: Question[]): number {
  return questions.reduce((sum, q) => sum + getMaxPoints(q), 0);
}

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
  const q = questions[currentIndex];
  const total = questions.length;
  const resolved = useMemo(() => resolveExamStyle(settings), [settings]);

  const answeredCount = useMemo(() => {
    return questions.reduce((count, question, i) => {
      const answered =
        mcAnswers[i] !== undefined ||
        (question.type === "true_false" && (tfJustifications[i]?.trim().length ?? 0) > 0) ||
        (devAnswers[i]?.trim().length ?? 0) > 0;
      return count + (answered ? 1 : 0);
    }, 0);
  }, [questions, mcAnswers, tfJustifications, devAnswers]);

  const pct = total > 0 ? Math.round((answeredCount / total) * 100) : 0;
  if (!q) return null;

  return (
    <ExamThemeProvider settings={settings}>
      <div className={`exam-root min-h-screen ${resolved.bodyClass}`}>
        <div className="exam-content px-4 py-5 md:py-8" style={{ maxWidth: resolved.maxWidth }}>
          <div className="exam-shell-card mb-5 p-4 md:p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="exam-question-meta text-xs font-black uppercase tracking-[0.2em]">Evaluación EduAI</p>
                {title && <h1 className="mt-1 truncate text-2xl font-black tracking-tight text-[var(--exam-text)]">{title}</h1>}
                <p className="mt-1 text-sm text-[var(--exam-text-sub)]">{totalPoints(questions)} pts · {answeredCount}/{total} respondidas</p>
              </div>
              <div className="flex items-center gap-3">
                {mode === "preview" && <span className="exam-badge rounded-full px-3 py-1 text-xs font-bold">Vista previa</span>}
                {typeof timeLeft === "number" && (
                  <div className="rounded-2xl border border-[var(--exam-border)] bg-[var(--exam-soft-bg)] px-4 py-2 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--exam-text-sub)]">Tiempo</p>
                    <p className={`font-mono text-xl font-black ${timeLeft < 60 ? "text-red-600" : timeLeft < 300 ? "text-amber-700" : "text-[var(--exam-text)]"}`}>⏱ {formatTime(timeLeft)}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-xs font-bold text-[var(--exam-text-sub)]">
                <span>Progreso</span><span>{pct}%</span>
              </div>
              <div className="exam-progress-track h-3 overflow-hidden rounded-full">
                <div className="exam-progress-fill h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {Array.from({ length: total }, (_, i) => {
                const answered = mcAnswers[i] !== undefined || (devAnswers[i]?.trim().length ?? 0) > 0 || (tfJustifications[i]?.trim().length ?? 0) > 0;
                return (
                  <button
                    key={i}
                    onClick={() => {
                      const diff = i - currentIndex;
                      if (diff > 0) for (let n = 0; n < diff; n++) onNext();
                      else if (diff < 0) for (let n = 0; n < -diff; n++) onPrev();
                    }}
                    className={`h-9 w-9 rounded-xl text-xs font-black transition ${i === currentIndex ? "bg-[var(--exam-accent)] text-white" : answered ? "bg-[var(--exam-accent-soft)] text-[var(--exam-accent)]" : "border border-[var(--exam-border)] bg-[var(--exam-surface)] text-[var(--exam-text-sub)]"}`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </div>

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

          <div className="mt-5 flex items-center justify-between gap-3 rounded-[24px] border border-[var(--exam-border)] bg-[var(--exam-surface)] p-3 shadow-sm">
            <button onClick={onPrev} disabled={currentIndex === 0} className="rounded-2xl border border-[var(--exam-border)] bg-[var(--exam-soft-bg)] px-5 py-2.5 text-sm font-bold text-[var(--exam-text)] transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-35">
              ← Anterior
            </button>
            <span className="text-xs font-bold text-[var(--exam-text-sub)]">{currentIndex + 1} / {total}</span>
            {currentIndex < total - 1 ? (
              <button onClick={onNext} className="rounded-2xl bg-[var(--exam-accent)] px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90">Siguiente →</button>
            ) : onSubmit ? (
              <button onClick={onSubmit} disabled={!canSubmit} className="rounded-2xl bg-emerald-600 px-6 py-2.5 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40">Entregar examen ✓</button>
            ) : null}
          </div>
        </div>
      </div>
    </ExamThemeProvider>
  );
}
