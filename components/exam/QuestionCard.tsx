"use client";

import ExamMathText from "@/components/ui/ExamMathText";

type ResponseMode =
  | "short_text"
  | "long_text"
  | "math"
  | "text_math"
  | "math_steps";

type StimulusKind = "text" | "source" | "case" | "data" | "experiment";

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
  responseMode?: ResponseMode;
  stimulusKind?: StimulusKind;
  stimulusTitle?: string;
  stimulusText?: string;
  showStimulusToStudent?: boolean;
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
  if (type === "true_false") return "Verdadero / Falso";
  if (type === "mixed_choice_development") return "Alternativa + respuesta construida";
  return "Respuesta construida";
}

function responseModeLabel(mode: ResponseMode) {
  if (mode === "short_text") return "Respuesta corta";
  if (mode === "math") return "Respuesta matemática";
  if (mode === "text_math") return "Texto + matemática";
  if (mode === "math_steps") return "Procedimiento paso a paso";
  return "Respuesta abierta";
}

function stimulusLabel(kind?: StimulusKind) {
  if (kind === "source") return "Fuente";
  if (kind === "case") return "Caso";
  if (kind === "data") return "Datos / tabla";
  if (kind === "experiment") return "Experimento";
  return "Texto base";
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
  const isMixed = q.type === "mixed_choice_development";
  const showOptions = q.type === "multiple_choice" || isMixed;
  const showDevelopment = q.type === "development" || isMixed;
  const responseMode: ResponseMode = q.responseMode || "long_text";
  const hasExplicitResponseMode = Boolean(q.responseMode);
  const responseUsesMath = ["math", "text_math", "math_steps"].includes(responseMode);
  const shouldUseNotebook =
    useNotebookForDevelopment && (!hasExplicitResponseMode || responseUsesMath);
  const showStimulus =
    q.showStimulusToStudent === true && Boolean(q.stimulusText?.trim());

  const responsePlaceholder =
    responseMode === "short_text"
      ? "Escribe una palabra, concepto, valor o frase breve..."
      : responseMode === "math"
        ? "Escribe tu expresión, ecuación o resultado. Puedes usar notación matemática o LaTeX entre $...$ si lo necesitas."
        : responseMode === "text_math"
          ? "Explica con tus palabras y agrega las ecuaciones, fórmulas o expresiones necesarias."
          : responseMode === "math_steps"
            ? "Desarrolla el procedimiento paso a paso e incluye el resultado final."
            : "Escribe tu respuesta con tus palabras. Fundamenta cuando corresponda.";

  return (
    <div className="exam-question">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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

      {showStimulus && (
        <div className="mb-6 rounded-[calc(var(--exam-radius)-6px)] border border-[var(--exam-border)] bg-[var(--exam-soft-bg)] p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="exam-badge rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em]">
              {stimulusLabel(q.stimulusKind)}
            </span>
            {q.stimulusTitle?.trim() && (
              <h3 className="text-sm font-black text-[var(--exam-text)] sm:text-base">
                {q.stimulusTitle}
              </h3>
            )}
          </div>
          <div className="whitespace-pre-wrap text-sm leading-7 text-[var(--exam-text)] sm:text-base">
            <ExamMathText text={q.stimulusText || ""} />
          </div>
        </div>
      )}

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

      <div className="exam-question-title mb-6 text-lg font-bold leading-relaxed md:text-xl">
        <ExamMathText text={getQuestionText(q)} />
      </div>

      {showOptions && (
        <div className="space-y-3">
          {isMixed ? (
            <p className="exam-question-meta text-xs font-black uppercase tracking-[0.16em]">
              Selecciona una alternativa {q.selectionPoints ? `(${q.selectionPoints} pts)` : ""}
            </p>
          ) : null}
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

      {showDevelopment && (
        <div className={isMixed ? "mt-6 space-y-5" : "space-y-5"}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {isMixed ? (
              <p className="exam-question-meta text-xs font-black uppercase tracking-[0.16em]">
                Respuesta construida {q.developmentMaxPoints ? `(${q.developmentMaxPoints} pts)` : ""}
              </p>
            ) : (
              <p className="exam-question-meta text-xs font-black uppercase tracking-[0.16em]">
                Respuesta
              </p>
            )}
            <span className="exam-badge rounded-full px-3 py-1 text-[11px] font-bold">
              {responseModeLabel(responseMode)}
            </span>
          </div>

          {Array.isArray(q.rubric) && q.rubric.length > 0 && (q.type === "development" || q.showRubricToStudent === true) && (
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

          {shouldUseNotebook ? (
            <div className="rounded-[calc(var(--exam-radius)-6px)] border border-blue-200 bg-blue-50/70 px-4 py-3">
              <p className="text-sm font-black text-blue-800">
                ✍️ Responde en el cuaderno digital
              </p>
              <p className="mt-1 text-xs leading-relaxed text-blue-700">
                El cuaderno está visible abajo. Puedes escribir procedimientos, ecuaciones, fórmulas químicas o desarrollos; el sistema guardará el lienzo y el LaTeX reconocido al avanzar o entregar.
              </p>
            </div>
          ) : responseMode === "short_text" ? (
            <div>
              <label className="exam-question-meta mb-2 block text-xs font-bold uppercase tracking-[0.12em]">
                Respuesta breve
              </label>
              <input
                value={devAnswer || ""}
                onChange={(e) => onDevChange(e.target.value)}
                className="exam-input w-full px-4 py-3 text-base outline-none focus:ring-2 focus:ring-[var(--exam-accent-soft)]"
                placeholder={responsePlaceholder}
                autoComplete="off"
              />
            </div>
          ) : (
            <div>
              <label className="exam-question-meta mb-2 block text-xs font-bold uppercase tracking-[0.12em]">
                {responseModeLabel(responseMode)}
              </label>
              <textarea
                value={devAnswer || ""}
                onChange={(e) => onDevChange(e.target.value)}
                className={`exam-input w-full px-4 py-3 text-base outline-none focus:ring-2 focus:ring-[var(--exam-accent-soft)] ${responseMode === "math" ? "min-h-[150px]" : "min-h-[230px]"}`}
                placeholder={responsePlaceholder}
              />
              {responseUsesMath && (
                <p className="exam-question-meta mt-2 text-xs leading-relaxed">
                  Puedes combinar texto con notación matemática. Si el docente habilitó el cuaderno digital, úsalo para procedimientos, ecuaciones y fórmulas complejas.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
