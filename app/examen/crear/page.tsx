// app/examen/crear/page.tsx
// VERSIÓN FUSIONADA: Agente IA (OpenRouter/Groq) + Sistema de Seguridad Nuevo
"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import {
  recommendDesign,
  getSubjectSuggestions,
} from "@/lib/agents/design-agent";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { analyzeAccessibility } from "@/lib/agents/accessibility-agent";
import ExamMathText from "@/components/ui/ExamMathText";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  getOAs,
  type NivelKey,
  type OA,
} from "@/lib/mineduc-oa";
import type { ExamTheme, ExamFont } from "@/lib/exam/theme-utils";

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Difficulty = "facil" | "medio" | "dificil" | "mixto";
type QuestionType = "multiple_choice" | "true_false" | "development";
type AIStatus = "idle" | "generating" | "done" | "error";

const AI_TOTAL_LIMIT = 36;


const EXAM_CREATOR_STEPS = [
  { id: "datos", label: "1. Datos", icon: "📝" },
  { id: "objetivos", label: "2. OA", icon: "🎯" },
  { id: "diseno", label: "3. Diseño", icon: "🎨" },
  { id: "ia", label: "4. IA", icon: "✨" },
  { id: "preguntas", label: "5. Preguntas", icon: "📋" },
  { id: "publicar", label: "6. Publicar", icon: "🚀" },
] as const;

const COURSE_OPTIONS: Record<NivelKey, string[]> = {
  parvularia: ["Sala cuna menor", "Sala cuna mayor", "Medio menor", "Medio mayor", "NT1", "NT2"],
  basica: ["1° básico", "2° básico", "3° básico", "4° básico", "5° básico", "6° básico", "7° básico", "8° básico"],
  media: ["1° medio", "2° medio", "3° medio", "4° medio"],
};

function getExamCreatorStepIndex(): number {
  if (typeof window === "undefined") return 0;
  let active = 0;
  const offset = 170;
  EXAM_CREATOR_STEPS.forEach((step, index) => {
    const el = document.getElementById(`exam-section-${step.id}`);
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    if (top <= offset) active = index;
  });
  return active;
}

function normalizeTextForSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

type MultipleChoiceQuestion = {
  id: string;
  type: "multiple_choice";
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  maxPoints?: number;
  imageUrl?: string;
};

type TrueFalseQuestion = {
  id: string;
  type: "true_false";
  question: string;
  correctAnswer: number;
  explanation?: string;
  selectionPoints?: number;
  justificationMaxPoints?: number;
  maxPoints?: number;
  imageUrl?: string;
};

type DevelopmentRubricItem = { criteria: string; points: number };

type DevelopmentQuestion = {
  id: string;
  type: "development";
  question: string;
  modelAnswer?: string;
  rubric: DevelopmentRubricItem[];
  maxPoints?: number;
  imageUrl?: string;
};

type Question =
  | MultipleChoiceQuestion
  | TrueFalseQuestion
  | DevelopmentQuestion;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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
      imageUrl: "",
    };
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
      imageUrl: "",
    };
  }
  return {
    id: uid(),
    type: "development",
    question: "",
    modelAnswer: "",
    rubric: [
      { criteria: "Comprensión del contenido", points: 2 },
      { criteria: "Desarrollo y fundamentación", points: 2 },
      { criteria: "Claridad de la respuesta", points: 1 },
    ],
    maxPoints: 5,
    imageUrl: "",
  };
}

function getQuestionPoints(q: Question): number {
  if (q.type === "multiple_choice")
    return Math.max(1, Number(q.maxPoints || 1));
  if (q.type === "true_false") {
    return (
      Math.max(0, Number(q.selectionPoints || 1)) +
      Math.max(0, Number(q.justificationMaxPoints || 2))
    );
  }
  if (Array.isArray(q.rubric) && q.rubric.length > 0)
    return q.rubric.reduce((acc, r) => acc + (Number(r.points) || 0), 0);
  return Math.max(1, Number(q.maxPoints || 5));
}

// Normalizar preguntas crudas de la IA al formato interno
function normalizeAIQuestion(raw: any): Question {
  const base = {
    id: uid(),
    question: (raw.question ?? raw.enunciado ?? "").trim(),
  };

  if (raw.type === "true_false" || raw.type === "verdadero_falso") {
    const correctRaw = raw.correctAnswer ?? raw.respuestaCorrecta ?? 0;
    let correct = 0;
    if (typeof correctRaw === "boolean") {
      correct = correctRaw ? 0 : 1;
    } else if (typeof correctRaw === "number" && Number.isFinite(correctRaw)) {
      correct = Math.round(correctRaw);
    } else if (typeof correctRaw === "string") {
      const value = correctRaw.trim().toLowerCase();
      if (["verdadero", "v", "true", "1"].includes(value)) correct = 0;
      else if (["falso", "f", "false", "0"].includes(value)) correct = 1;
      else {
        const numeric = Number(value);
        correct = Number.isFinite(numeric) ? Math.round(numeric) : 0;
      }
    }
    return {
      ...base,
      type: "true_false",
      correctAnswer: Math.max(0, Math.min(correct, 1)),
      explanation: raw.explanation ?? raw.explicacion ?? "",
      selectionPoints: Number(raw.selectionPoints ?? raw.puntosSeleccion ?? 1),
      justificationMaxPoints: Number(
        raw.justificationMaxPoints ?? raw.puntosJustificacion ?? 2,
      ),
      maxPoints:
        Number(raw.selectionPoints ?? 1) +
        Number(raw.justificationMaxPoints ?? 2),
    };
  }

  if (raw.type === "development" || raw.type === "desarrollo") {
    const rubric: DevelopmentRubricItem[] = Array.isArray(raw.rubric)
      ? raw.rubric.map((r: any) => ({
          criteria: r.criteria ?? r.criterion ?? r.criterio ?? "",
          points: Number(r.points ?? r.puntos ?? 1),
        }))
      : [
          { criteria: "Comprensión", points: 2 },
          { criteria: "Desarrollo", points: 2 },
          { criteria: "Claridad", points: 1 },
        ];
    const maxPoints = rubric.reduce((a, r) => a + r.points, 0);
    return {
      ...base,
      type: "development",
      modelAnswer:
        raw.modelAnswer ?? raw.expectedAnswer ?? raw.respuestaModelo ?? "",
      rubric,
      maxPoints,
    };
  }

  // multiple_choice (default)
  const options: string[] = Array.isArray(raw.options)
    ? raw.options.map((o: any) =>
        (typeof o === "string" ? o : String(o.text ?? o.opcion ?? o))
          .replace(/^[A-Da-d][).]\s*/u, "")
          .trim(),
      )
    : ["", "", "", ""];
  const correctRaw = raw.correctAnswer ?? raw.respuestaCorrecta ?? 0;
  let correct = 0;
  if (typeof correctRaw === "number" && Number.isFinite(correctRaw)) {
    correct = Math.round(correctRaw);
  } else if (typeof correctRaw === "string") {
    const value = correctRaw.trim().toLowerCase();
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      correct = Math.round(numeric);
    } else {
      const letters = ["a", "b", "c", "d", "e", "f"];
      const letterIndex = letters.indexOf(value);
      if (letterIndex >= 0) {
        correct = letterIndex;
      } else {
        const matchedOption = options.findIndex(
          (opt) => opt.trim().toLowerCase() === value,
        );
        correct = matchedOption >= 0 ? matchedOption : 0;
      }
    }
  }
  return {
    ...base,
    type: "multiple_choice",
    options,
    correctAnswer: Math.max(0, Math.min(correct, options.length - 1)),
    explanation: raw.explanation ?? raw.explicacion ?? "",
    maxPoints: Number(raw.maxPoints ?? raw.puntos ?? 1),
  };
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function CrearExamenPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);

  // ── Obtener usuario autenticado ───────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/login");
        return;
      }
      setUserId(user.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Metadatos del examen ──────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [instructions, setInstructions] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("mixto");
  const [timeLimit, setTimeLimit] = useState(60);
  const [examPercentage, setExamPercentage] = useState(60);
  const [showResultToStudent, setShowResultToStudent] = useState(true);
  const [allowReview, setAllowReview] = useState(true);
  const [isPublic, setIsPublic] = useState(true);

  // ── Seguridad (nuevo sistema) ─────────────────────────────────────────────
  const [securityMode, setSecurityMode] = useState(false);

  // ── Asignatura y personalización visual ───────────────────────────────────
  const [subject, setSubject] = useState("Matemática");
  const [examTheme, setExamTheme] = useState<ExamTheme>("classic");
  const [examFont, setExamFont] = useState<ExamFont>("inter");
  const [pieMode, setPieMode] = useState(false);
  const [dyslexiaMode, setDyslexiaMode] = useState(false);
  const [adhdMode, setAdhdMode] = useState(false);
  const [lowVisionMode, setLowVisionMode] = useState(false);
  const [visualOpen, setVisualOpen] = useState(true);
  const [questionAddType, setQuestionAddType] =
    useState<QuestionType>("multiple_choice");
  const [activeStep, setActiveStep] = useState(0);
  const [curriculumNivel, setCurriculumNivel] = useState<NivelKey>("media");
  const [curriculumCurso, setCurriculumCurso] = useState("1° medio");
  const [oaQuery, setOaQuery] = useState("");
  const [selectedOAIds, setSelectedOAIds] = useState<string[]>([]);

  // ── Auto-recomendación de diseño (DesignAgent) ────────────────────────────
  const designRec = useMemo(
    () =>
      recommendDesign({
        subject: subject,
        pieMode: pieMode,
        dyslexia: dyslexiaMode,
        adhd: adhdMode,
        lowVision: lowVisionMode,
        // Compatibilidad estricta: si recommendDesign tiene un tipo ExamTheme más antiguo
        // en otra rama/archivo, el cast evita que Vercel corte el build por la unión de temas.
        manualTheme: examTheme !== "classic"
          ? (examTheme as Parameters<typeof recommendDesign>[0]["manualTheme"])
          : undefined,
        manualFont: examFont !== "inter"
          ? (examFont as Parameters<typeof recommendDesign>[0]["manualFont"])
          : undefined,
      }),
    [
      subject,
      pieMode,
      dyslexiaMode,
      adhdMode,
      lowVisionMode,
      examTheme,
      examFont,
    ],
  );

  const subjectTips = useMemo(() => getSubjectSuggestions(subject), [subject]);

  const availableOAs = useMemo<OA[]>(() => {
    try {
      return getOAs(curriculumNivel, curriculumCurso, subject);
    } catch (error) {
      return [];
    }
  }, [curriculumNivel, curriculumCurso, subject]);

  const filteredOAs = useMemo(() => {
    const query = normalizeTextForSearch(oaQuery.trim());
    if (!query) return availableOAs.slice(0, 24);
    return availableOAs
      .filter((oa) =>
        normalizeTextForSearch(
          `${oa.codigoOficial || oa.id} ${oa.texto} ${oa.unidadNombre || ""} ${oa.ejes?.join(" ") || ""}`,
        ).includes(query),
      )
      .slice(0, 30);
  }, [availableOAs, oaQuery]);

  const selectedOAs = useMemo(
    () => availableOAs.filter((oa) => selectedOAIds.includes(oa.id)),
    [availableOAs, selectedOAIds],
  );

  useEffect(() => {
    setSelectedOAIds((prev) =>
      prev.filter((id) => availableOAs.some((oa) => oa.id === id)),
    );
  }, [availableOAs]);

  useEffect(() => {
    const onScroll = () => setActiveStep(getExamCreatorStepIndex());
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const toggleOA = (oaId: string) => {
    setSelectedOAIds((prev) =>
      prev.includes(oaId) ? prev.filter((id) => id !== oaId) : [...prev, oaId],
    );
  };

  const jumpToSection = (sectionId: string) => {
    document
      .getElementById(`exam-section-${sectionId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Auto-aplicar tema/fuente cuando cambia asignatura (solo si el docente no eligió manualmente)
  useEffect(() => {
    if (examTheme === "classic") setExamTheme(designRec.theme);
    if (examFont === "inter") setExamFont(designRec.font);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, pieMode]);

  useEffect(() => {
    const options = COURSE_OPTIONS[curriculumNivel];
    if (!options.includes(curriculumCurso)) {
      setCurriculumCurso(options[0]);
    }
  }, [curriculumNivel, curriculumCurso]);

  // ── Preguntas manuales ────────────────────────────────────────────────────
  const [questions, setQuestions] = useState<Question[]>([
    defaultQuestion("multiple_choice"),
  ]);

  // ── Guardar examen ────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [createdExam, setCreatedExam] = useState<{
    code: string;
    id: string;
    title: string;
  } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // ── Panel IA ──────────────────────────────────────────────────────────────
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiMC, setAiMC] = useState(5);
  const [aiTF, setAiTF] = useState(2);
  const [aiDev, setAiDev] = useState(2);
  const [aiDiff, setAiDiff] = useState<Difficulty>("mixto");
  const [aiStatus, setAiStatus] = useState<AIStatus>("idle");
  const [aiError, setAiError] = useState("");
  const [aiProvider, setAiProvider] = useState<"groq" | "openrouter" | "">("");
  const [aiPreview, setAiPreview] = useState<Question[]>([]);
  const [aiImportMode, setAiImportMode] = useState<"replace" | "append">(
    "append",
  );
  const [aiRegenIdx, setAiRegenIdx] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const totalPoints = useMemo(
    () => questions.reduce((acc, q) => acc + getQuestionPoints(q), 0),
    [questions],
  );

  // ── CRUD preguntas ────────────────────────────────────────────────────────
  const addQuestion = (type: QuestionType) =>
    setQuestions((p) => [...p, defaultQuestion(type)]);
  const removeQuestion = (id: string) =>
    setQuestions((p) => p.filter((q) => q.id !== id));
  const updateQuestion = (id: string, updater: (q: Question) => Question) =>
    setQuestions((p) => p.map((q) => (q.id === id ? updater(q) : q)));

  // ── Validación ────────────────────────────────────────────────────────────
  const validateExam = (): string => {
    if (!title.trim()) return "Debes ingresar un título.";
    if (!topic.trim()) return "Debes ingresar un tema.";
    if (questions.length === 0) return "Debes agregar al menos una pregunta.";
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question.trim()) return `La pregunta ${i + 1} no tiene enunciado.`;
      if (q.type === "multiple_choice") {
        if (q.options.some((o) => !o.trim()))
          return `La pregunta ${i + 1} tiene alternativas vacías.`;
        if (q.correctAnswer < 0 || q.correctAnswer >= q.options.length)
          return `La pregunta ${i + 1} tiene una alternativa correcta inválida.`;
      }
      if (q.type === "development") {
        if (!q.rubric.length)
          return `La pregunta ${i + 1} de desarrollo debe tener rúbrica.`;
        if (q.rubric.some((r) => !r.criteria.trim() || Number(r.points) <= 0))
          return `La rúbrica de la pregunta ${i + 1} tiene elementos inválidos.`;
      }
    }
    return "";
  };

  // ── Guardar examen ────────────────────────────────────────────────────────
  const handleCreate = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    if (!userId) {
      setErrorMsg("No autenticado. Recarga la página.");
      return;
    }
    const ve = validateExam();
    if (ve) {
      setErrorMsg(ve);
      return;
    }
    setSaving(true);
    try {
      const payloadQuestions = questions.map((q) => {
        if (q.type === "multiple_choice")
          return {
            type: q.type,
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation || "",
            maxPoints: Number(q.maxPoints || 1),
          };
        if (q.type === "true_false")
          return {
            type: q.type,
            question: q.question,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation || "",
            selectionPoints: Number(q.selectionPoints || 1),
            justificationMaxPoints: Number(q.justificationMaxPoints || 2),
            maxPoints: getQuestionPoints(q),
          };
        return {
          type: q.type,
          question: q.question,
          modelAnswer: (q as DevelopmentQuestion).modelAnswer || "",
          rubric: (q as DevelopmentQuestion).rubric.map((r) => ({
            criteria: r.criteria,
            points: Number(r.points || 0),
          })),
          maxPoints: getQuestionPoints(q),
        };
      });

      const res = await fetch("/api/agents/examen-docente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          title,
          topic,
          instructions,
          difficulty,
          teacherId: userId,
          subject,
          questions: payloadQuestions,
          settings: {
            timeLimit: Number(timeLimit || 60),
            examPercentage: Number(examPercentage || 60),
            showResultToStudent,
            allowReview,
            isPublic,
            securityMode,
            theme: examTheme,
            font: examFont,
            subject,
            curriculum: {
              nivel: curriculumNivel,
              curso: curriculumCurso,
              selectedOAIds,
              selectedOAs: selectedOAs.map((oa) => ({
                id: oa.id,
                codigoOficial: oa.codigoOficial,
                texto: oa.texto,
                unidadNombre: oa.unidadNombre,
              })),
            },
            accessibility: {
              pieMode,
              dyslexiaMode,
              adhdMode,
              lowVisionMode,
            },
          },
        }),
      });
      const data = await res.json();
      if (!data?.success)
        throw new Error(data?.error || "No se pudo crear el examen.");
      setCreatedExam({
        code: data.code,
        id: data.exam?.id,
        title: title.trim() || "Examen",
      });
    } catch (e: any) {
      setErrorMsg(e?.message || "Error al crear el examen.");
    } finally {
      setSaving(false);
    }
  };

  // ── Generar examen con IA ─────────────────────────────────────────────────
  const buildAIPrompt = (): string => {
    const totalQ = aiMC + aiTF + aiDev;
    const diffMap = {
      facil: "fácil",
      medio: "media",
      dificil: "difícil",
      mixto: "mixta",
    };
    const diffTxt = diffMap[aiDiff];
    const subjectCtx = subject ? `\nAsignatura: ${subject}` : "";
    const selectedOAContext = selectedOAs.length
      ? `\nOBJETIVOS DE APRENDIZAJE MINEDUC A EVALUAR:\n${selectedOAs
          .map(
            (oa, index) =>
              `${index + 1}. ${oa.codigoOficial || oa.id}: ${oa.texto}`,
          )
          .join("\n")}`
      : "";
    const pieCtx = pieMode
      ? `\nIMPORTANTE — Este examen es para estudiantes con NEE/PIE:${dyslexiaMode ? " dislexia," : ""}${adhdMode ? " TDAH," : ""}${lowVisionMode ? " baja visión," : ""} usa lenguaje claro, frases cortas, instrucciones simples y evita exceso de texto.`
      : "";
    return `Genera un examen escolar en español sobre el siguiente tema:
"${aiPrompt.trim() || topic.trim() || "tema del docente"}"${subjectCtx}${selectedOAContext}${pieCtx}

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
4. PROCESO PARA ALTERNATIVAS (OBLIGATORIO):
   a) CALCULA tú mismo la respuesta correcta
   b) Crea la opción correcta con ESE valor exacto
   c) Crea 3 distractores (errores comunes, NO inventados)
   d) Mezcla las 4 en orden aleatorio
   e) correctAnswer = ÍNDICE donde quedó la respuesta correcta
   f) explanation menciona el MISMO resultado que options[correctAnswer]
5. true_false: correctAnswer:0(Verdadero) o 1(Falso), explanation, selectionPoints:1, justificationMaxPoints:2
6. development: modelAnswer, rubric:[{criteria,points}], maxPoints:suma
7. LaTeX inline con $...$ y bloque con $$...$$. Usa backslash real (\\).
8. Si ${aiTF}===0 y ${aiDev}===0 → genera SOLO multiple_choice.
9. NUNCA correctAnswer=0 por defecto. Verifica que options[correctAnswer] sea correcto.`;
  };

  const generateAI = async () => {
    const totalAIQuestions = aiMC + aiTF + aiDev;
    if (totalAIQuestions === 0) {
      setAiError("Define al menos 1 pregunta a generar.");
      return;
    }
    if (totalAIQuestions > AI_TOTAL_LIMIT) {
      setAiError(
        `Para evitar errores de cuota o timeout, genera máximo ${AI_TOTAL_LIMIT} preguntas por tanda. Puedes importarlas y luego generar otra tanda con "Agregar al final".`,
      );
      return;
    }
    if (!aiPrompt.trim() && !topic.trim()) {
      setAiError(
        "Escribe un tema en el campo de descripción o en la información general.",
      );
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setAiStatus("generating");
    setAiError("");
    setAiProvider("");
    setAiPreview([]);

    try {
      const res = await fetch("/api/agents/exam-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          prompt: buildAIPrompt(),
          mode: "full",
          mc: aiMC,
          tf: aiTF,
          dev: aiDev,
        }),
      });
      const data = await res.json();
      if (!data?.success) {
        const detail = data?.details
          ? `

Detalle técnico: ${data.details}`
          : "";
        throw new Error(
          `${data?.error || "Error generando preguntas."}${detail}`,
        );
      }

      const normalized: Question[] = (data.questions ?? []).map((raw: any) =>
        normalizeAIQuestion(raw),
      );
      if (normalized.length === 0)
        throw new Error(
          "La IA no generó preguntas. Intenta con un tema más específico.",
        );

      // Auto-rellenar título si está vacío
      if (!title.trim() && data.title) setTitle(data.title);

      setAiPreview(normalized);
      setAiProvider(data.provider ?? "openrouter");
      setAiStatus("done");
    } catch (e: any) {
      if (e.name === "AbortError") return;
      setAiError(e.message);
      setAiStatus("error");
    }
  };

  const importAIQuestions = () => {
    if (aiPreview.length === 0) return;
    if (aiImportMode === "replace") setQuestions(aiPreview);
    else setQuestions((prev) => [...prev, ...aiPreview]);
    setAiPreview([]);
    setAiStatus("idle");
  };

  // Regenerar una sola pregunta de la preview
  const regenerateSingleQuestion = async (idx: number) => {
    const q = aiPreview[idx];
    if (!q) return;
    setAiRegenIdx(idx);
    try {
      const singlePrompt = `Regenera UNA pregunta de tipo "${q.type}" sobre: "${aiPrompt.trim() || topic.trim()}". 
Dificultad: ${aiDiff}. 
Responde ÚNICAMENTE con JSON: { "question": {...} }
Usa el mismo esquema que antes (type, question, options si aplica, correctAnswer, explanation/rubric, etc.).`;

      const res = await fetch("/api/agents/exam-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: singlePrompt, mode: "single" }),
      });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.error);
      const fresh = normalizeAIQuestion(
        data.question ?? data.questions?.[0] ?? {},
      );
      setAiPreview((prev) => prev.map((p, i) => (i === idx ? fresh : p)));
    } catch (e: any) {
      // Silencioso en preview — el usuario puede reintentar
    } finally {
      setAiRegenIdx(null);
    }
  };

  // ── RENDER ────────────────────────────────────────────────────────────────
  // ── Share panel after creation ────────────────────────────────────────────
  if (createdExam) {
    const examUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/examen/p/${createdExam.code}`
        : `/examen/p/${createdExam.code}`;

    const copyLink = () => {
      navigator.clipboard.writeText(examUrl).then(() => {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2500);
      });
    };

    return (
      <div className="min-h-screen bg-app flex items-center justify-center px-4">
        <div className="w-full max-w-lg space-y-5">
          {/* Success header */}
          <div className="text-center">
            <div className="text-5xl mb-3">✅</div>
            <h1 className="text-2xl font-extrabold text-main">
              ¡Examen creado!
            </h1>
            <p className="text-sub text-sm mt-1">{createdExam.title}</p>
          </div>

          {/* Link panel */}
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 space-y-4">
            <div>
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">
                🔗 Link para estudiantes
              </p>
              <div className="flex items-center gap-2 bg-white rounded-xl border border-blue-200 px-3 py-2.5">
                <span className="flex-1 text-sm text-blue-800 font-mono truncate">
                  {examUrl}
                </span>
                <button
                  onClick={copyLink}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    linkCopied
                      ? "bg-green-100 text-green-700 border border-green-300"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {linkCopied ? "✓ Copiado" : "Copiar"}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-white rounded-xl border border-blue-100 px-3 py-2.5">
              <span className="text-xs text-blue-700">Código de acceso:</span>
              <span className="font-mono font-bold text-blue-900 text-sm tracking-widest">
                {createdExam.code}
              </span>
            </div>

            <p className="text-xs text-blue-600">
              Comparte este link o código con tus estudiantes. El examen está{" "}
              <strong>activo</strong> y listo para recibir respuestas.
            </p>
          </div>

          {/* Warning reminder */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700 space-y-1">
            <p className="font-semibold">⚠️ Recuerda a tus estudiantes:</p>
            <p>
              Al ingresar deberán aceptar las condiciones de monitoreo académico
              (prohibido uso de IA y herramientas externas).
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <button
              onClick={copyLink}
              className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-all"
            >
              {linkCopied
                ? "✓ Link copiado"
                : "📋 Copiar link para estudiantes"}
            </button>
            <button
              onClick={() => router.push(`/examen/editar/${createdExam.id}`)}
              className="w-full py-3 rounded-2xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-sm transition-all"
            >
              ✏️ Revisar y editar preguntas antes de publicar
            </button>
            <button
              onClick={() => router.push("/examen/docente")}
              className="w-full py-2.5 rounded-2xl border border-soft bg-card-soft-theme hover:bg-card-theme text-sub text-sm transition-all"
            >
              Ver mis exámenes →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#dbeafe_0,#f8fafc_28%,#fff7ed_68%,#f8fafc_100%)] text-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <p className="text-blue-600 text-xs tracking-[0.25em] font-black mb-2">
            EXAMEN DOCENTE · CANVA + LATEX + PIE/NEE
          </p>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight">
            Crear nuevo examen
          </h1>
          <p className="text-slate-600 mt-2 text-sm md:text-base max-w-3xl">
            Diseña una evaluación clara y visual: datos, diseño accesible, generación IA, preguntas con LaTeX y publicación segura.
          </p>
          <div className="sticky top-0 z-40 mt-5 rounded-[30px] border border-slate-200 bg-white/90 p-2 text-xs font-bold text-slate-600 shadow-lg shadow-slate-200/60 backdrop-blur-xl">
            <div className="grid gap-2 md:grid-cols-6">
              {EXAM_CREATOR_STEPS.map((step, index) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => jumpToSection(step.id)}
                  className={`rounded-2xl px-3 py-2.5 text-center transition-all ${
                    activeStep === index
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm"
                      : "bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                  }`}
                >
                  <span className="mr-1">{step.icon}</span>
                  {step.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid xl:grid-cols-[1fr_330px] gap-6">
          <div className="space-y-6">
            {/* ════════════════════════════════════════════════════════════
                INFORMACIÓN GENERAL
            ════════════════════════════════════════════════════════════ */}
            <section id="exam-section-datos" className="scroll-mt-32 rounded-[28px] border border-sky-200 bg-white/95 p-5 md:p-6 shadow-sm ring-1 ring-white/80">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-500">Paso 1</p>
                  <h2 className="text-lg font-black">Información general</h2>
                </div>
                <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-600">Obligatorio</span>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-sub font-semibold block mb-2">
                    ASIGNATURA
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full rounded-2xl bg-card-soft-theme border border-soft px-4 py-3 text-sm text-main focus:outline-none focus:border-blue-500/40"
                  >
                    {[
                      "Matemática",
                      "Lenguaje",
                      "Ciencias Naturales",
                      "Física",
                      "Química",
                      "Biología",
                      "Historia",
                      "Educación Física",
                      "Artes",
                      "Inglés",
                      "Tecnología",
                      "Otra",
                    ].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-sub font-semibold block mb-2">
                    TÍTULO
                  </label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ej: Prueba de porcentajes e interés"
                    className="w-full rounded-2xl bg-card-soft-theme border border-soft px-4 py-3 text-sm text-main focus:outline-none focus:border-blue-500/40"
                  />
                </div>
                <div>
                  <label className="text-xs text-sub font-semibold block mb-2">
                    TEMA
                  </label>
                  <input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Ej: Matemática financiera"
                    className="w-full rounded-2xl bg-card-soft-theme border border-soft px-4 py-3 text-sm text-main focus:outline-none focus:border-blue-500/40"
                  />
                </div>
                <div>
                  <label className="text-xs text-sub font-semibold block mb-2">
                    DIFICULTAD
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) =>
                      setDifficulty(e.target.value as Difficulty)
                    }
                    className="w-full rounded-2xl bg-card-soft-theme border border-soft px-4 py-3 text-sm text-main focus:outline-none focus:border-blue-500/40"
                  >
                    <option value="facil">Fácil</option>
                    <option value="medio">Medio</option>
                    <option value="dificil">Difícil</option>
                    <option value="mixto">Mixto</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-sub font-semibold block mb-2">
                    TIEMPO (MINUTOS)
                  </label>
                  <input
                    type="number"
                    min={5}
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(Number(e.target.value || 60))}
                    className="w-full rounded-2xl bg-card-soft-theme border border-soft px-4 py-3 text-sm text-main focus:outline-none focus:border-blue-500/40"
                  />
                </div>
                <div>
                  <label className="text-xs text-sub font-semibold block mb-2">
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
                    className="w-full rounded-2xl bg-card-soft-theme border border-soft px-4 py-3 text-sm text-main focus:outline-none focus:border-blue-500/40"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    {[
                      {
                        label: "Mostrar resultado al estudiante",
                        val: showResultToStudent,
                        set: setShowResultToStudent,
                      },
                      {
                        label: "Permitir revisión",
                        val: allowReview,
                        set: setAllowReview,
                      },
                      {
                        label: "Hacer examen público",
                        val: isPublic,
                        set: setIsPublic,
                      },
                    ].map(({ label, val, set }) => (
                      <label
                        key={label}
                        className="flex items-center gap-2 text-sub cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={val}
                          onChange={(e) => set(e.target.checked)}
                        />
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
                      <p className="text-sm font-bold text-main">Modo Seguro</p>
                      <p className="text-xs text-sub mt-0.5 leading-relaxed">
                        Activa el sistema de seguridad avanzado: fullscreen
                        forzado, bloqueo de teclado/clipboard, detección de
                        cambio de pestaña, sesiones con heartbeat y panel de
                        incidentes para el docente.
                      </p>
                      {securityMode && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {[
                            "Fullscreen obligatorio",
                            "Teclado bloqueado",
                            "Sin copiar/pegar",
                            "Detección de pestaña",
                            "Registro de incidentes",
                            "Panel admin",
                          ].map((f) => (
                            <span
                              key={f}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setSecurityMode((s) => !s)}
                    className={`relative flex-shrink-0 w-12 h-6 rounded-full transition-colors ${securityMode ? "bg-amber-500" : "bg-card-soft-theme"}`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${securityMode ? "translate-x-6" : "translate-x-0.5"}`}
                    />
                  </button>
                </div>
              </div>

              {/* Instrucciones */}
              <div className="mt-4">
                <label className="text-xs text-sub font-semibold block mb-2">
                  INSTRUCCIONES
                </label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Escribe instrucciones para tus estudiantes..."
                  className="w-full min-h-[120px] rounded-2xl bg-card-soft-theme border border-soft px-4 py-3 text-sm text-main focus:outline-none focus:border-blue-500/40"
                />
              </div>
            </section>

            {/* ════════════════════════════════════════════════════════════
                OBJETIVOS DE APRENDIZAJE MINEDUC
            ════════════════════════════════════════════════════════════ */}
            <section id="exam-section-objetivos" className="scroll-mt-32 rounded-[30px] border border-emerald-200 bg-gradient-to-br from-emerald-50 via-teal-50 to-white p-5 md:p-6 shadow-sm ring-1 ring-white/80">
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">Paso 2 · OA MINEDUC</p>
                  <h2 className="text-xl font-black text-slate-950">Objetivos de aprendizaje a evaluar</h2>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
                    Selecciona los OA oficiales que el examen debe medir. La IA los usará como contexto para generar preguntas más alineadas al currículum chileno.
                  </p>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                  {selectedOAs.length} OA seleccionado{selectedOAs.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-[180px_180px_1fr]">
                <div>
                  <label className="mb-2 block text-xs font-bold text-slate-600">NIVEL</label>
                  <select
                    value={curriculumNivel}
                    onChange={(e) => {
                      const nextNivel = e.target.value as NivelKey;
                      setCurriculumNivel(nextNivel);
                      setCurriculumCurso(COURSE_OPTIONS[nextNivel][0]);
                      setSelectedOAIds([]);
                    }}
                    className="w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  >
                    <option value="parvularia">Parvularia</option>
                    <option value="basica">Básica</option>
                    <option value="media">Media</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold text-slate-600">CURSO</label>
                  <select
                    value={curriculumCurso}
                    onChange={(e) => {
                      setCurriculumCurso(e.target.value);
                      setSelectedOAIds([]);
                    }}
                    className="w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  >
                    {COURSE_OPTIONS[curriculumNivel].map((curso) => (
                      <option key={curso} value={curso}>{curso}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold text-slate-600">BUSCAR OA</label>
                  <input
                    value={oaQuery}
                    onChange={(e) => setOaQuery(e.target.value)}
                    placeholder="Ej: fracciones, probabilidad, funciones, lectura..."
                    className="w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </div>
              </div>

              {availableOAs.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  No encontré OA locales para <strong>{subject}</strong> en <strong>{curriculumCurso}</strong>. Puedes seguir usando el tema manual o cambiar asignatura/curso.
                </div>
              ) : (
                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  {filteredOAs.map((oa) => {
                    const selected = selectedOAIds.includes(oa.id);
                    return (
                      <button
                        key={oa.id}
                        type="button"
                        onClick={() => toggleOA(oa.id)}
                        className={[
                          "group min-h-[118px] rounded-2xl border p-4 text-left transition-all",
                          selected
                            ? "border-emerald-400 bg-emerald-100/80 shadow-sm ring-2 ring-emerald-200"
                            : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/60",
                        ].join(" ")}
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className={[
                            "rounded-full px-2.5 py-1 text-[11px] font-black",
                            selected ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700",
                          ].join(" ")}>
                            {oa.codigoOficial || oa.id}
                          </span>
                          <span className={selected ? "text-emerald-700" : "text-slate-300 group-hover:text-emerald-500"}>
                            {selected ? "✓ seleccionado" : "+ agregar"}
                          </span>
                        </div>
                        <p className="line-clamp-3 text-sm font-semibold leading-relaxed text-slate-900">{oa.texto}</p>
                        {(oa.unidadNombre || oa.ejes?.length) && (
                          <p className="mt-2 line-clamp-1 text-xs text-slate-500">
                            {oa.unidadNombre || oa.ejes?.join(" · ")}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedOAs.length > 0 && (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-white px-4 py-3">
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-600">OA que se enviarán a la IA</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedOAs.map((oa) => (
                      <button
                        key={oa.id}
                        type="button"
                        onClick={() => toggleOA(oa.id)}
                        className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-200"
                      >
                        {oa.codigoOficial || oa.id} ×
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* ════════════════════════════════════════════════════════════
                PERSONALIZACIÓN VISUAL — Tema, fuente y accesibilidad PIE
            ════════════════════════════════════════════════════════════ */}
            <section id="exam-section-diseno" className="scroll-mt-32 rounded-[30px] border border-violet-200 bg-white/95 p-5 md:p-6 space-y-5 shadow-sm ring-1 ring-white/80">
              <button
                type="button"
                onClick={() => setVisualOpen((v) => !v)}
                className="w-full flex items-center justify-between gap-3 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-lg">
                    🎨
                  </div>
                  <div>
                    <p className="font-bold text-sm text-main">
                      Personalización visual estilo Canva
                    </p>
                    <p className="text-xs text-slate-500">
                      Tema {examTheme.replace("_", " ")} · fuente {examFont}{" "}
                      {pieMode ? "· accesibilidad activa" : ""}
                    </p>
                  </div>
                </div>
                <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                  {visualOpen ? "Ocultar" : "Configurar"}{" "}
                  {visualOpen ? "↑" : "↓"}
                </span>
              </button>

              {!visualOpen && (
                <div className="grid md:grid-cols-3 gap-3 text-xs">
                  <div className="rounded-2xl border border-soft bg-card-soft-theme px-4 py-3">
                    <p className="text-muted2 font-semibold">Tema</p>
                    <p className="text-main font-bold capitalize mt-0.5">
                      {examTheme.replace("_", " ")}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-soft bg-card-soft-theme px-4 py-3">
                    <p className="text-muted2 font-semibold">Fuente</p>
                    <p className="text-main font-bold capitalize mt-0.5">
                      {examFont}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-soft bg-card-soft-theme px-4 py-3">
                    <p className="text-muted2 font-semibold">Accesibilidad</p>
                    <p className="text-main font-bold mt-0.5">
                      {pieMode ? "PIE/NEE activo" : "Estándar"}
                    </p>
                  </div>
                </div>
              )}

              {visualOpen && (
                <>
                  {/* Selector de tema */}
                  <div>
                    <label className="text-xs text-sub font-semibold block mb-3">
                      TEMA VISUAL
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {(
                        [
                          { value: "classic", label: "Classic", icon: "📄", desc: "Limpio y formal", tone: "from-slate-50 to-white border-slate-200" },
                          { value: "modern", label: "Modern", icon: "✦", desc: "Azul institucional", tone: "from-blue-50 to-white border-blue-200" },
                          { value: "canva", label: "Canva", icon: "🃏", desc: "Visual y colorido", tone: "from-indigo-50 to-pink-50 border-indigo-200" },
                          { value: "pie_calm", label: "PIE Calm", icon: "🌿", desc: "Crema y verde suave", tone: "from-emerald-50 to-amber-50 border-emerald-200" },
                          { value: "adhd_focus", label: "TDAH Focus", icon: "🎯", desc: "Azul/verde foco", tone: "from-sky-50 to-emerald-50 border-sky-200" },
                          { value: "high_contrast", label: "Alto contraste", icon: "👁", desc: "Baja visión", tone: "from-yellow-50 to-white border-slate-800" },
                          { value: "stem", label: "STEM", icon: "⚗️", desc: "Ciencia exacta", tone: "from-cyan-50 to-blue-50 border-cyan-200" },
                          { value: "kids", label: "Kids", icon: "🐣", desc: "Básica / PIE", tone: "from-orange-50 to-rose-50 border-orange-200" },
                          { value: "blue_focus", label: "Blue Focus", icon: "🧠", desc: "Concentración tranquila", tone: "from-blue-100 to-cyan-50 border-blue-300" },
                          { value: "green_calm", label: "Green Calm", icon: "🍃", desc: "Baja ansiedad", tone: "from-green-100 to-emerald-50 border-green-300" },
                          { value: "lavender_reading", label: "Lavender Reading", icon: "📚", desc: "Lectura amable", tone: "from-purple-100 to-violet-50 border-purple-300" },
                          { value: "warm_attention", label: "Warm Attention", icon: "☀️", desc: "Energía sin saturar", tone: "from-amber-100 to-orange-50 border-amber-300" },
                        ] as {
                          value: ExamTheme;
                          label: string;
                          icon: string;
                          desc: string;
                          tone: string;
                        }[]
                      ).map(({ value, label, icon, desc, tone }) => (
                        <button
                          key={value}
                          onClick={() => setExamTheme(value)}
                          className={[
                            "rounded-2xl border bg-gradient-to-br p-3 text-left transition-all",
                            tone,
                            examTheme === value
                              ? "ring-2 ring-teal-400 shadow-sm scale-[1.01]"
                              : "hover:ring-2 hover:ring-teal-100",
                          ].join(" ")}
                        >
                          <span className="text-xl block mb-1">{icon}</span>
                          <p className="text-xs font-bold text-main">{label}</p>
                          <p className="text-[10px] text-sub mt-0.5">{desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-cyan-200 bg-gradient-to-br from-cyan-50 via-emerald-50 to-amber-50 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">Guía rápida de color para concentración</p>
                    <div className="mt-3 grid gap-2 md:grid-cols-4">
                      {[
                        { label: "Azul suave", desc: "foco y calma", cls: "bg-blue-100 text-blue-900 border-blue-200" },
                        { label: "Verde suave", desc: "regulación y seguridad", cls: "bg-emerald-100 text-emerald-900 border-emerald-200" },
                        { label: "Crema", desc: "menos brillo que blanco", cls: "bg-amber-50 text-amber-900 border-amber-200" },
                        { label: "Lavanda", desc: "lectura amable", cls: "bg-violet-100 text-violet-900 border-violet-200" },
                      ].map((item) => (
                        <div key={item.label} className={`rounded-2xl border px-3 py-2 ${item.cls}`}>
                          <p className="text-xs font-black">{item.label}</p>
                          <p className="text-[11px] opacity-80">{item.desc}</p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-slate-600">
                      Para NEE se priorizan fondos claros no blancos puros, contraste suficiente, acentos suaves y baja saturación. El rojo/amarillo intenso se reserva solo para alertas puntuales.
                    </p>
                  </div>

                  {/* Selector de fuente */}
                  <div>
                    <label className="text-xs text-sub font-semibold block mb-2">
                      TIPOGRAFÍA
                      <span className="ml-2 text-muted2 font-normal normal-case">
                        (Lexend y Atkinson son las más recomendadas para
                        accesibilidad)
                      </span>
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {(
                        [
                          {
                            value: "inter",
                            label: "Inter",
                            sub: "Moderna, estándar",
                          },
                          {
                            value: "lexend",
                            label: "Lexend",
                            sub: "TDAH / lectura ★",
                          },
                          {
                            value: "atkinson",
                            label: "Atkinson Hyperlegible",
                            sub: "Baja visión ★",
                          },
                          {
                            value: "poppins",
                            label: "Poppins",
                            sub: "Amigable, básica",
                          },
                        ] as { value: ExamFont; label: string; sub: string }[]
                      ).map(({ value, label, sub }) => (
                        <button
                          key={value}
                          onClick={() => setExamFont(value)}
                          className={[
                            "rounded-2xl border p-3 text-left transition-all",
                            examFont === value
                              ? "border-teal-500/60 bg-teal-500/10"
                              : "border-soft bg-card-soft-theme hover:border-teal-500/30",
                          ].join(" ")}
                        >
                          <p className="text-sm font-bold text-main">{label}</p>
                          <p className="text-[10px] text-sub mt-0.5">{sub}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Modo PIE/NEE */}
                  <div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.04] p-4 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">♿</span>
                        <div>
                          <p className="text-sm font-bold text-main">
                            Modo PIE / NEE
                          </p>
                          <p className="text-xs text-sub">
                            Activa ajustes para estudiantes con necesidades
                            educativas especiales
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setPieMode((s) => !s)}
                        className={`relative flex-shrink-0 w-12 h-6 rounded-full transition-colors ${pieMode ? "bg-purple-500" : "bg-card-soft-theme"}`}
                      >
                        <span
                          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${pieMode ? "translate-x-6" : "translate-x-0.5"}`}
                        />
                      </button>
                    </div>

                    {pieMode && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {[
                          {
                            label: "Dislexia",
                            desc: "Fuente Lexend + espaciado amplio",
                            val: dyslexiaMode,
                            set: setDyslexiaMode,
                            icon: "📖",
                          },
                          {
                            label: "TDAH",
                            desc: "Bloques cortos, foco secuencial",
                            val: adhdMode,
                            set: setAdhdMode,
                            icon: "🎯",
                          },
                          {
                            label: "Baja visión",
                            desc: "Alto contraste, texto grande",
                            val: lowVisionMode,
                            set: setLowVisionMode,
                            icon: "👁",
                          },
                        ].map(({ label, desc, val, set, icon }) => (
                          <button
                            key={label}
                            onClick={() => set((v) => !v)}
                            className={[
                              "rounded-2xl border p-3 text-left transition-all",
                              val
                                ? "border-purple-500/50 bg-purple-500/10"
                                : "border-soft bg-card-soft-theme hover:border-purple-500/20",
                            ].join(" ")}
                          >
                            <span className="text-lg block mb-1">{icon}</span>
                            <p className="text-xs font-bold text-main">
                              {label}
                            </p>
                            <p className="text-[10px] text-sub mt-0.5">
                              {desc}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>

            {/* Recomendación del DesignAgent */}
            {(designRec.suggestions.length > 0 || designRec.reason) && (
              <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.04] px-5 py-4 text-sm space-y-2">
                <p className="font-semibold text-sky-700">
                  💡 Sugerencia de diseño
                </p>
                {designRec.reason && (
                  <p className="text-sub">{designRec.reason}</p>
                )}
                {designRec.suggestions.map((s, i) => (
                  <p key={i} className="text-sub">
                    • {s}
                  </p>
                ))}
                {subjectTips.tips.map((t, i) => (
                  <p key={`tip-${i}`} className="text-sub">
                    • {t}
                  </p>
                ))}
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════
                PANEL IA — Generador de preguntas con OpenRouter / Groq
            ════════════════════════════════════════════════════════════ */}
            <section id="exam-section-ia" className="scroll-mt-32 rounded-[30px] border border-violet-200 bg-gradient-to-br from-violet-50 via-fuchsia-50 to-white p-5 md:p-6 shadow-sm">
              {/* Toggle header */}
              <button
                onClick={() => setAiOpen((o) => !o)}
                className="w-full flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-lg">
                    ✨
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-sm text-main">
                      Generador de preguntas con IA
                    </p>
                    <p className="text-xs text-violet-400">
                      OpenRouter → Groq fallback automático
                    </p>
                  </div>
                </div>
                <span
                  className={`text-sub text-sm transition-transform ${aiOpen ? "rotate-180" : ""}`}
                >
                  ▾
                </span>
              </button>

              {aiOpen && (
                <div className="mt-5 space-y-4">
                  {/* Descripción / tema para la IA */}
                  <div>
                    <label className="text-xs text-sub font-semibold block mb-2">
                      DESCRIPCIÓN PARA LA IA
                      <span className="text-muted2 font-normal ml-1">
                        (si está vacío usa el Tema de arriba)
                      </span>
                    </label>
                    <textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="Ej: Funciones cuadráticas para 2° medio, enfocado en discriminante y vértice. Incluye problemas contextualizados."
                      className="w-full min-h-[90px] rounded-2xl bg-card-soft-theme border border-soft px-4 py-3 text-sm text-main focus:outline-none focus:border-violet-500/40 resize-none"
                    />
                  </div>

                  {/* Cantidad de preguntas por tipo */}
                  <div>
                    <label className="text-xs text-sub font-semibold block mb-3">
                      CANTIDAD DE PREGUNTAS
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        {
                          label: "Alternativas",
                          tone: "bg-blue-50 border-blue-100",
                          labelClass: "text-blue-700",
                          val: aiMC,
                          set: setAiMC,
                        },
                        {
                          label: "Verdadero/Falso",
                          tone: "bg-indigo-50 border-indigo-100",
                          labelClass: "text-indigo-700",
                          val: aiTF,
                          set: setAiTF,
                        },
                        {
                          label: "Desarrollo",
                          tone: "bg-emerald-50 border-emerald-100",
                          labelClass: "text-emerald-700",
                          val: aiDev,
                          set: setAiDev,
                        },
                      ].map(({ label, tone, labelClass, val, set }) => (
                        <div
                          key={label}
                          className={`rounded-2xl border p-3 text-center shadow-sm ${tone}`}
                        >
                          <p className={`text-xs font-semibold mb-2 ${labelClass}`}>
                            {label}
                          </p>
                          <input
                            type="number"
                            min={0}
                            max={AI_TOTAL_LIMIT}
                            value={val}
                            onChange={(e) =>
                              set(
                                Math.max(
                                  0,
                                  Math.min(
                                    AI_TOTAL_LIMIT,
                                    Number(e.target.value || 0),
                                  ),
                                ),
                              )
                            }
                            className="w-full bg-transparent text-center text-main font-bold text-xl focus:outline-none"
                          />
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted2 mt-2 text-right">
                      Total:{" "}
                      <span className="text-main font-semibold">
                        {aiMC + aiTF + aiDev}
                      </span>{" "}
                      preguntas · Máx. {AI_TOTAL_LIMIT} por tanda
                    </p>
                  </div>

                  {/* Dificultad IA */}
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-sub font-semibold block mb-2">
                        DIFICULTAD
                      </label>
                      <select
                        value={aiDiff}
                        onChange={(e) =>
                          setAiDiff(e.target.value as Difficulty)
                        }
                        className="w-full rounded-2xl bg-card-soft-theme border border-soft px-4 py-3 text-sm text-main focus:outline-none"
                      >
                        <option value="facil">Fácil</option>
                        <option value="medio">Medio</option>
                        <option value="dificil">Difícil</option>
                        <option value="mixto">Mixto</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-sub font-semibold block mb-2">
                        AL IMPORTAR
                      </label>
                      <select
                        value={aiImportMode}
                        onChange={(e) =>
                          setAiImportMode(
                            e.target.value as "replace" | "append",
                          )
                        }
                        className="w-full rounded-2xl bg-card-soft-theme border border-soft px-4 py-3 text-sm text-main focus:outline-none"
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
                    style={{
                      background: "linear-gradient(135deg,#7c3aed,#6d28d9)",
                      boxShadow: "0 0 24px rgba(124,58,237,0.25)",
                    }}
                  >
                    {aiStatus === "generating" ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-soft border-t-white rounded-full animate-spin inline-block" />
                        Generando con IA...
                      </span>
                    ) : (
                      "✨ Generar preguntas con IA"
                    )}
                  </button>

                  {/* Error IA */}
                  {aiStatus === "error" && (
                    <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-700">
                      ❌ {aiError}
                    </div>
                  )}

                  {/* Preview de preguntas generadas */}
                  {aiStatus === "done" && aiPreview.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-sub tracking-widest">
                          VISTA PREVIA — {aiPreview.length} pregunta
                          {aiPreview.length !== 1 ? "s" : ""}
                          {aiProvider && (
                            <span
                              className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                aiProvider === "openrouter"
                                  ? "bg-violet-500/15 text-violet-400"
                                  : "bg-orange-500/15 text-orange-400"
                              }`}
                            >
                              {aiProvider === "openrouter"
                                ? "OpenRouter"
                                : "Groq"}
                            </span>
                          )}
                        </p>
                        <button
                          onClick={importAIQuestions}
                          className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-main text-xs font-bold"
                        >
                          {aiImportMode === "replace"
                            ? "↩ Reemplazar"
                            : "＋ Importar al examen"}
                        </button>
                      </div>

                      <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                        {aiPreview.map((q, idx) => (
                          <div
                            key={q.id}
                            className="rounded-2xl bg-card-soft-theme p-3"
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                    q.type === "multiple_choice"
                                      ? "bg-blue-500/10 text-blue-400"
                                      : q.type === "true_false"
                                        ? "bg-indigo-500/10 text-indigo-400"
                                        : "bg-emerald-500/10 text-emerald-400"
                                  }`}
                                >
                                  {q.type === "multiple_choice"
                                    ? "Alt"
                                    : q.type === "true_false"
                                      ? "V/F"
                                      : "Des"}
                                </span>
                                <span className="text-muted2 text-[10px]">
                                  P{idx + 1} · {getQuestionPoints(q)} pts
                                </span>
                              </div>
                              <button
                                onClick={() => regenerateSingleQuestion(idx)}
                                disabled={aiRegenIdx !== null}
                                className="text-[10px] px-2 py-1 rounded-lg bg-card-soft-theme text-sub hover:text-main hover:bg-input-theme disabled:opacity-40 transition-all"
                              >
                                {aiRegenIdx === idx ? "⟳" : "↺ regen"}
                              </button>
                            </div>
                            <ExamMathText
                              text={q.question}
                              className="text-main text-xs leading-relaxed line-clamp-3"
                            />
                            {q.type === "multiple_choice" && (
                              <div className="mt-2 grid grid-cols-2 gap-1">
                                {q.options.map((o, j) => (
                                  <div
                                    key={j}
                                    className={`text-[11px] px-2 py-1 rounded-lg ${
                                      j === q.correctAnswer
                                        ? "bg-green-500/10 text-green-400"
                                        : "text-muted2"
                                    }`}
                                  >
                                    {String.fromCharCode(65 + j)}.{" "}
                                    <ExamMathText text={o} className="inline" />
                                  </div>
                                ))}
                              </div>
                            )}
                            {q.type === "true_false" && (
                              <p className="text-xs text-muted2 mt-1">
                                Correcta:{" "}
                                <span className="text-main font-semibold">
                                  {q.correctAnswer === 0
                                    ? "Verdadero"
                                    : "Falso"}
                                </span>
                                {" · "}
                                {q.selectionPoints}+{q.justificationMaxPoints}{" "}
                                pts
                              </p>
                            )}
                            {q.type === "development" && (
                              <p className="text-xs text-muted2 mt-1">
                                Rúbrica:{" "}
                                {q.rubric
                                  .map((r) => `${r.criteria} (${r.points}p)`)
                                  .join(" · ")}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={importAIQuestions}
                        className="w-full py-3 rounded-2xl font-bold text-sm bg-violet-600 hover:bg-violet-500 text-main"
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
                PREGUNTAS DEL EXAMEN
            ════════════════════════════════════════════════════════════ */}
            <section id="exam-section-preguntas" className="scroll-mt-32 rounded-[30px] border border-emerald-200 bg-white/95 p-5 md:p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
                <h2 className="text-lg font-bold">Preguntas del examen</h2>
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <select
                    value={questionAddType}
                    onChange={(e) =>
                      setQuestionAddType(e.target.value as QuestionType)
                    }
                    className="rounded-2xl bg-card-soft-theme border border-soft px-4 py-2 text-sm text-main focus:outline-none focus:border-blue-500/40"
                  >
                    <option value="multiple_choice">Alternativas</option>
                    <option value="true_false">Verdadero/Falso</option>
                    <option value="development">Desarrollo</option>
                  </select>
                  <button
                    onClick={() => addQuestion(questionAddType)}
                    className="px-4 py-2 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-sm"
                  >
                    + Agregar pregunta
                  </button>
                </div>
              </div>

              <div className="space-y-5">
                {questions.map((q, index) => (
                  <div
                    key={q.id}
                    className="rounded-2xl border border-medium bg-card-soft-theme p-4 md:p-5"
                  >
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <p className="text-xs tracking-widest text-muted2 font-semibold">
                          PREGUNTA {index + 1}
                        </p>
                        <p className="text-sm text-sub mt-1">
                          Tipo:{" "}
                          <span className="font-semibold text-main">
                            {q.type === "multiple_choice"
                              ? "Alternativas"
                              : q.type === "true_false"
                                ? "Verdadero/Falso"
                                : "Desarrollo"}
                          </span>
                          <span className="ml-2 text-xs text-muted2">
                            · {getQuestionPoints(q)} pts
                          </span>
                        </p>
                      </div>
                      <button
                        onClick={() => removeQuestion(q.id)}
                        disabled={questions.length === 1}
                        className="px-3 py-2 rounded-xl bg-red-500/15 text-red-700 hover:bg-red-500/25 disabled:opacity-40 text-sm"
                      >
                        Eliminar
                      </button>
                    </div>

                    {/* Enunciado */}
                    <div className="mb-4">
                      <label className="text-xs text-sub font-semibold block mb-2">
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
                        className="w-full min-h-[110px] rounded-2xl bg-card-soft-theme border border-soft px-4 py-3 text-sm text-main focus:outline-none focus:border-blue-500/40"
                        placeholder="Escribe la pregunta..."
                      />
                    </div>

                    {/* Imagen opcional */}
                    <div className="mb-4">
                      <label className="text-xs text-sub font-semibold block mb-2">
                        IMAGEN (URL opcional)
                      </label>
                      <input
                        type="url"
                        value={(q as any).imageUrl || ""}
                        onChange={(e) =>
                          updateQuestion(
                            q.id,
                            (prev) =>
                              ({ ...prev, imageUrl: e.target.value }) as any,
                          )
                        }
                        placeholder="https://... (imagen para ilustrar la pregunta)"
                        className="w-full rounded-2xl bg-card-soft-theme border border-soft px-4 py-2.5 text-sm text-main focus:outline-none focus:border-blue-500/40"
                      />
                      {(q as any).imageUrl && (
                        <div className="mt-2 rounded-xl overflow-hidden border border-soft max-h-40">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={(q as any).imageUrl}
                            alt="Vista previa"
                            className="w-full h-40 object-contain bg-card-soft-theme"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                "none";
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* ── Alternativas ──────────────────────────────── */}
                    {q.type === "multiple_choice" && (
                      <div className="space-y-3">
                        {q.options.map((option, optIndex) => (
                          <div
                            key={optIndex}
                            className="grid grid-cols-[1fr_auto] gap-3 items-center"
                          >
                            <input
                              value={option}
                              onChange={(e) =>
                                updateQuestion(q.id, (prev) => {
                                  if (prev.type !== "multiple_choice")
                                    return prev;
                                  const next = [...prev.options];
                                  next[optIndex] = e.target.value;
                                  return { ...prev, options: next };
                                })
                              }
                              className="w-full rounded-2xl bg-card-soft-theme border border-soft px-4 py-3 text-sm text-main focus:outline-none focus:border-blue-500/40"
                              placeholder={`Alternativa ${optIndex + 1}`}
                            />
                            <label className="flex items-center gap-2 text-sm text-sub whitespace-nowrap">
                              <input
                                type="radio"
                                name={`correct-${q.id}`}
                                checked={q.correctAnswer === optIndex}
                                onChange={() =>
                                  updateQuestion(q.id, (prev) =>
                                    prev.type === "multiple_choice"
                                      ? { ...prev, correctAnswer: optIndex }
                                      : prev,
                                  )
                                }
                              />
                              Correcta
                            </label>
                          </div>
                        ))}
                        <div className="grid md:grid-cols-2 gap-4 mt-3">
                          <div>
                            <label className="text-xs text-sub font-semibold block mb-2">
                              EXPLICACIÓN
                            </label>
                            <textarea
                              value={q.explanation || ""}
                              onChange={(e) =>
                                updateQuestion(q.id, (prev) =>
                                  prev.type === "multiple_choice"
                                    ? { ...prev, explanation: e.target.value }
                                    : prev,
                                )
                              }
                              className="w-full min-h-[90px] rounded-2xl bg-card-soft-theme border border-soft px-4 py-3 text-sm text-main focus:outline-none focus:border-blue-500/40"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-sub font-semibold block mb-2">
                              PUNTAJE
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={q.maxPoints || 1}
                              onChange={(e) =>
                                updateQuestion(q.id, (prev) =>
                                  prev.type === "multiple_choice"
                                    ? {
                                        ...prev,
                                        maxPoints: Number(e.target.value || 1),
                                      }
                                    : prev,
                                )
                              }
                              className="w-full rounded-2xl bg-card-soft-theme border border-soft px-4 py-3 text-sm text-main focus:outline-none focus:border-blue-500/40"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── Verdadero / Falso ─────────────────────────── */}
                    {q.type === "true_false" && (
                      <div className="space-y-4">
                        <div className="flex gap-4">
                          {["Verdadero", "Falso"].map((label, j) => (
                            <label
                              key={j}
                              className="flex items-center gap-2 text-sm text-sub cursor-pointer"
                            >
                              <input
                                type="radio"
                                name={`tf-${q.id}`}
                                checked={q.correctAnswer === j}
                                onChange={() =>
                                  updateQuestion(q.id, (prev) =>
                                    prev.type === "true_false"
                                      ? { ...prev, correctAnswer: j }
                                      : prev,
                                  )
                                }
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                        <div className="grid md:grid-cols-3 gap-4">
                          <div>
                            <label className="text-xs text-sub font-semibold block mb-2">
                              PTS SELECCIÓN
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
                                        selectionPoints: Number(
                                          e.target.value || 0,
                                        ),
                                      }
                                    : prev,
                                )
                              }
                              className="w-full rounded-2xl bg-card-soft-theme border border-soft px-4 py-3 text-sm text-main"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-sub font-semibold block mb-2">
                              PTS JUSTIFICACIÓN
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
                                          e.target.value || 0,
                                        ),
                                      }
                                    : prev,
                                )
                              }
                              className="w-full rounded-2xl bg-card-soft-theme border border-soft px-4 py-3 text-sm text-main"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-sub font-semibold block mb-2">
                              TOTAL
                            </label>
                            <div className="rounded-2xl bg-card-soft-theme border border-soft px-4 py-3 text-sm text-main">
                              {getQuestionPoints(q)}
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-sub font-semibold block mb-2">
                            EXPLICACIÓN
                          </label>
                          <textarea
                            value={q.explanation || ""}
                            onChange={(e) =>
                              updateQuestion(q.id, (prev) =>
                                prev.type === "true_false"
                                  ? { ...prev, explanation: e.target.value }
                                  : prev,
                              )
                            }
                            className="w-full min-h-[90px] rounded-2xl bg-card-soft-theme border border-soft px-4 py-3 text-sm text-main"
                          />
                        </div>
                      </div>
                    )}

                    {/* ── Desarrollo ────────────────────────────────── */}
                    {q.type === "development" && (
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs text-sub font-semibold block mb-2">
                            RESPUESTA ESPERADA
                          </label>
                          <textarea
                            value={(q as DevelopmentQuestion).modelAnswer || ""}
                            onChange={(e) =>
                              updateQuestion(q.id, (prev) =>
                                prev.type === "development"
                                  ? { ...prev, modelAnswer: e.target.value }
                                  : prev,
                              )
                            }
                            className="w-full min-h-[90px] rounded-2xl bg-card-soft-theme border border-soft px-4 py-3 text-sm text-main"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-sub font-semibold block mb-2">
                            RÚBRICA
                          </label>
                          <div className="space-y-3">
                            {(q as DevelopmentQuestion).rubric.map(
                              (item, rubricIndex) => (
                                <div
                                  key={rubricIndex}
                                  className="grid grid-cols-[1fr_120px_auto] gap-3 items-center"
                                >
                                  <input
                                    value={item.criteria}
                                    onChange={(e) =>
                                      updateQuestion(q.id, (prev) => {
                                        if (prev.type !== "development")
                                          return prev;
                                        const next = [...prev.rubric];
                                        next[rubricIndex] = {
                                          ...next[rubricIndex],
                                          criteria: e.target.value,
                                        };
                                        return { ...prev, rubric: next };
                                      })
                                    }
                                    className="w-full rounded-2xl bg-card-soft-theme border border-soft px-4 py-3 text-sm text-main"
                                    placeholder="Criterio"
                                  />
                                  <input
                                    type="number"
                                    min={1}
                                    value={item.points}
                                    onChange={(e) =>
                                      updateQuestion(q.id, (prev) => {
                                        if (prev.type !== "development")
                                          return prev;
                                        const next = [...prev.rubric];
                                        next[rubricIndex] = {
                                          ...next[rubricIndex],
                                          points: Number(e.target.value || 0),
                                        };
                                        return { ...prev, rubric: next };
                                      })
                                    }
                                    className="w-full rounded-2xl bg-card-soft-theme border border-soft px-4 py-3 text-sm text-main"
                                  />
                                  <button
                                    onClick={() =>
                                      updateQuestion(q.id, (prev) => {
                                        if (prev.type !== "development")
                                          return prev;
                                        return {
                                          ...prev,
                                          rubric: prev.rubric.filter(
                                            (_, idx) => idx !== rubricIndex,
                                          ),
                                        };
                                      })
                                    }
                                    disabled={
                                      (q as DevelopmentQuestion).rubric
                                        .length === 1
                                    }
                                    className="px-3 py-2 rounded-xl bg-red-500/15 text-red-700 hover:bg-red-500/25 disabled:opacity-40 text-sm"
                                  >
                                    Quitar
                                  </button>
                                </div>
                              ),
                            )}
                          </div>
                          <button
                            onClick={() =>
                              updateQuestion(q.id, (prev) => {
                                if (prev.type !== "development") return prev;
                                return {
                                  ...prev,
                                  rubric: [
                                    ...prev.rubric,
                                    { criteria: "", points: 1 },
                                  ],
                                };
                              })
                            }
                            className="mt-3 px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-main text-sm font-semibold"
                          >
                            + Agregar criterio
                          </button>
                          <p className="text-sm text-sub mt-3">
                            Puntaje total:{" "}
                            <span className="text-main font-semibold">
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

          {/* ════════════════════════════════════════════════════════════
              SIDEBAR — Resumen + Guardar
          ════════════════════════════════════════════════════════════ */}
          <aside className="space-y-6">
            <section id="exam-section-publicar" className="rounded-[28px] border border-blue-200 bg-white/95 p-5 sticky top-28 shadow-sm ring-1 ring-white/80">
              <h2 className="text-lg font-bold mb-4">Resumen</h2>

              <div className="space-y-3 text-sm">
                {[
                  { label: "Preguntas", value: questions.length },
                  { label: "Puntaje total", value: totalPoints },
                  { label: "Tiempo", value: `${timeLimit} min` },
                  { label: "Exigencia", value: `${examPercentage}%` },
                  { label: "Dificultad", value: difficulty },
                  { label: "OA evaluados", value: selectedOAs.length },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between gap-3">
                    <span className="text-sub">{label}</span>
                    <span className="font-semibold text-main capitalize">
                      {value}
                    </span>
                  </div>
                ))}

                {/* Indicador de seguridad en resumen */}
                <div className="flex justify-between gap-3 pt-1">
                  <span className="text-sub">Modo Seguro</span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${securityMode ? "bg-amber-500/15 text-amber-400" : "bg-card-soft-theme text-muted2"}`}
                  >
                    {securityMode ? "ACTIVO" : "Inactivo"}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-sub">Tema</span>
                  <span className="text-xs font-semibold text-teal-400 capitalize">
                    {examTheme.replace("_", " ")}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-sub">Tipografía</span>
                  <span className="text-xs font-semibold text-main capitalize">
                    {examFont}
                  </span>
                </div>
                {pieMode && (
                  <div className="flex justify-between gap-3">
                    <span className="text-sub">Modo PIE</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400">
                      ACTIVO
                    </span>
                  </div>
                )}

                {/* Desglose de tipos */}
                <div className="pt-1 border-t border-soft space-y-1">
                  {(
                    [
                      "multiple_choice",
                      "true_false",
                      "development",
                    ] as QuestionType[]
                  ).map((type) => {
                    const count = questions.filter(
                      (q) => q.type === type,
                    ).length;
                    if (count === 0) return null;
                    const label =
                      type === "multiple_choice"
                        ? "Alternativas"
                        : type === "true_false"
                          ? "V/F"
                          : "Desarrollo";
                    const color =
                      type === "multiple_choice"
                        ? "text-blue-400"
                        : type === "true_false"
                          ? "text-indigo-400"
                          : "text-emerald-400";
                    return (
                      <div key={type} className="flex justify-between gap-3">
                        <span className={`text-xs ${color}`}>{label}</span>
                        <span className="text-xs text-sub">
                          {count} pregunta{count !== 1 ? "s" : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {errorMsg && (
                <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700">
                  {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700">
                  {successMsg}
                </div>
              )}

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
                  className="w-full py-3 rounded-2xl bg-card-soft-theme border border-soft text-main"
                >
                  Volver
                </button>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
