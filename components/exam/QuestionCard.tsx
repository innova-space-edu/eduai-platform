"use client";

import ExamMathText from "@/components/ui/ExamMathText";

interface RubricItem {
  criteria: string;
  points: number;
}

interface Question {
  id?: string;
  type: "multiple_choice" | "true_false" | "development" | "mixed_choice_development";
  question?: string;
  statement?: string;
  options?: string[];
  correctAnswer?: number;
  explanation?: string;
  maxPoints?: number;
  selectionPoints?: number;
  justificationMaxPoints?: number;
  developmentMaxPoints?: number;
  showRubricToStudent?: boolean;
  rubric?: RubricItem[];
  imageUrl?: string;
}

interface QuestionCardProps {
  question: Question;
  index: number;
  total: number;
  mcAnswer?: number;
  tfAnswer?: number;
  tfJustification?: string;
  devAnswer?: string;
  onMcChange: (index: number) => void;
  onTfChange: (index: number) => void;
  onTfJustificationChange: (value: string) => void;
  onDevChange: (value: string) => void;
  maxPoints: number;
  useNotebookForDevelopment?: boolean;
}

function getQuestionText(q: Question) {
  return q.question || q.statement || "";
}

function typeLabel(type: Question["type"]) {
  if (type === "multiple_choice") return "Alternativas";
  if (type === "mixed_choice_development") return "Alternativa + desarrollo";
  if (type === "true_false") return "Verdadero / Falso";
  return "Desarrollo";
}

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
  useNotebookForDevelopment = false,
}: QuestionCardProps) {
  const isChoiceLike = q.type === "multiple_choice" || q.type === "mixed_choice_development";
  const isNotebookType = q.type === "development" || q.type === "mixed_choice_development";
  const shouldShowRubric = q.type === "development" && q.showRubricToStudent === true;

  return (
    <div className="exam-question">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="exam-badge inline-flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-black">
            {index + 1}
          </span>
          <div>
            <p className="exam-question-meta text-xs font-black uppercase tracking-[0.18em]">
              Pregunta {index + 1} de {total}
            </p>
            <p className="exam-question-meta text-xs font-semibold">
              {typeLabel(q.type)} · {maxPoints} pts
            </p>
          </div>
        </div>
        <span className="exam-badge rounded-full px-3 py-1 text-xs font-bold">
          Lee con calma
        </span>
      </div>

      {q.imageUrl && q.imageUrl.trim() !== "" && (
        <div className="exam-question-image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={q.imageUrl}
            alt={`Imagen de la pregunta ${index + 1}`}
            className="max-h-72 w-full object-contain"
            onError={(e) => {
              const parent = (e.target as HTMLImageElement).parentElement;
              if (parent) parent.style.display = "none";
            }}
          />
        </div>
      )}

      <div className="exam-question-title mb-4 text-lg font-bold leading-relaxed md:text-xl">
        <ExamMathText text={getQuestionText(q)} />
      </div>

      {isChoiceLike && (
        <div className="grid gap-2 sm:grid-cols-2">
          {(q.options || []).map((option, i) => {
            const active = mcAnswer === i;
            return (
              <button
                key={i}
                onClick={() => onMcChange(i)}
                className={`exam-option flex w-full items-start gap-3 px-4 py-3 text-left transition ${active ? "selected" : ""}`}
              >
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-black ${active ? "border-[var(--exam-accent)] bg-[var(--exam-accent)] text-white" : "border-[var(--exam-border)] bg-[var(--exam-soft-bg)] text-[var(--exam-text-sub)]"}`}>
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="min-w-0 flex-1 pt-0.5">
                  <ExamMathText text={option} />
                </span>
              </button>
            );
          })}
        </div>
      )}

      {q.type === "true_false" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {["Verdadero", "Falso"].map((label, i) => {
              const active = tfAnswer === i;
              return (
                <button
                  key={label}
                  onClick={() => onTfChange(i)}
                  className={`exam-option flex items-center justify-center gap-3 px-4 py-4 font-bold transition ${active ? "selected" : ""}`}
                >
                  <span className="text-xl">{i === 0 ? "✓" : "×"}</span>
                  {label}
                </button>
              );
            })}
          </div>

          <div>
            <label className="exam-question-meta mb-2 block text-xs font-bold uppercase tracking-[0.12em]">
              Justificación {q.justificationMaxPoints ? `(${q.justificationMaxPoints} pts)` : ""}
            </label>
            <textarea
              value={tfJustification || ""}
              onChange={(e) => onTfJustificationChange(e.target.value)}
              className="exam-input min-h-[130px] w-full px-4 py-3 text-base outline-none focus:ring-2 focus:ring-[var(--exam-accent-soft)]"
              placeholder="Escribe tu justificación con tus palabras..."
            />
          </div>
        </div>
      )}

      {isNotebookType && (
        <div className="mt-4 space-y-4">
          {shouldShowRubric && Array.isArray(q.rubric) && q.rubric.length > 0 && (
            <div className="rounded-[calc(var(--exam-radius)-6px)] border border-[var(--exam-border)] bg-[var(--exam-soft-bg)] p-4">
              <p className="exam-question-meta mb-3 text-xs font-black uppercase tracking-[0.16em]">
                Criterios de evaluación
              </p>
              <div className="grid gap-2">
                {q.rubric.map((r, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 rounded-2xl bg-[var(--exam-surface)] px-3 py-2 text-sm">
                    <span className="text-[var(--exam-text)]">{r.criteria}</span>
                    <span className="shrink-0 font-bold text-[var(--exam-text-sub)]">{r.points} pts</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {useNotebookForDevelopment ? (
            <div className="rounded-[calc(var(--exam-radius)-6px)] border border-blue-200 bg-blue-50/70 px-4 py-3">
              <p className="text-sm font-black text-blue-800">
                ✍️ {q.type === "mixed_choice_development" ? "Marca una alternativa y desarrolla en el cuaderno" : "Responde en el cuaderno digital"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-blue-700">
                El desarrollo se guardará como imagen, trazos JSON y LaTeX reconocido. La rúbrica queda para revisión del docente.
              </p>
            </div>
          ) : q.type === "development" ? (
            <div>
              <label className="exam-question-meta mb-2 block text-xs font-bold uppercase tracking-[0.12em]">
                Respuesta de desarrollo
              </label>
              <textarea
                value={devAnswer || ""}
                onChange={(e) => onDevChange(e.target.value)}
                className="exam-input min-h-[180px] w-full px-4 py-3 text-base outline-none focus:ring-2 focus:ring-[var(--exam-accent-soft)]"
                placeholder="Escribe tu respuesta. Puedes ordenar tus ideas en pasos."
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
