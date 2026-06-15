"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import ExamMathText from "@/components/ui/ExamMathText";
import ExamSecurityExamBridge from "@/components/exam-security/ExamSecurityExamBridge";
import ExamThemeProvider from "@/components/exam/ExamThemeProvider";
import QuestionCard from "@/components/exam/QuestionCard";
import ExamAudioButton from "@/components/exam/ExamAudioButton";
import ExamScientificCalculator from "@/components/exam/ExamScientificCalculator";
import ExamDigitalClock from "@/components/exam/ExamDigitalClock";
import {
  calculateGradeFromPercentage,
  calculateScoreSummary,
  formatPoints,
  getQuestionMaxPoints,
} from "@/lib/exam/grading";
import ExamQuestionNotebook, {
  type ExamNotebookArtifact,
  type ExamQuestionNotebookHandle,
} from "@/components/exam/ExamQuestionNotebook";

// ── Supabase del PANEL DE CONTROL ────────────────────────────────────────────
const PANEL_URL = process.env.NEXT_PUBLIC_PANEL_SUPABASE_URL || "";
const PANEL_KEY = process.env.NEXT_PUBLIC_PANEL_SUPABASE_ANON_KEY || "";

function getPanelClient() {
  if (!PANEL_URL || !PANEL_KEY) return null;
  return createClient(PANEL_URL, PANEL_KEY);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(seconds: number) {
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function createAttemptId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeRutInput(value: string) {
  return value.toUpperCase().replace(/[^0-9K]/g, "").slice(0, 9);
}

function formatRut(value: string) {
  const clean = normalizeRutInput(value);
  if (clean.length < 2) return clean;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  const bodyWithDots = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${bodyWithDots}-${dv}`;
}

function isValidRut(value: string) {
  const clean = normalizeRutInput(value);
  if (!/^[0-9]{6,8}[0-9K]$/.test(clean)) return false;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  let multiplier = 2;
  let sum = 0;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const rest = 11 - (sum % 11);
  const expected = rest === 11 ? "0" : rest === 10 ? "K" : String(rest);
  return expected === dv;
}

function normalizeNumberRecord(value: any): Record<number, number> {
  if (!value || typeof value !== "object") return {};
  const normalized: Record<number, number> = {};
  Object.entries(value).forEach(([key, answer]) => {
    const numericKey = Number(key);
    const numericAnswer = Number(answer);
    if (Number.isInteger(numericKey) && Number.isFinite(numericAnswer)) {
      normalized[numericKey] = numericAnswer;
    }
  });
  return normalized;
}

function normalizeTextRecord(value: any): Record<number, string> {
  if (!value || typeof value !== "object") return {};
  const normalized: Record<number, string> = {};
  Object.entries(value).forEach(([key, answer]) => {
    const numericKey = Number(key);
    if (Number.isInteger(numericKey)) {
      normalized[numericKey] = String(answer || "");
    }
  });
  return normalized;
}

function serializeDevelopmentArtifacts(
  artifacts: Record<number, ExamNotebookArtifact>,
) {
  return Object.fromEntries(
    Object.entries(artifacts).map(([index, artifact]) => [
      index,
      {
        artifactId: artifact.artifactId,
        questionIndex: artifact.questionIndex,
        questionId: artifact.questionId,
        latex: artifact.latex || "",
        ocrText: artifact.ocrText || "",
        ocrConfidence: artifact.ocrConfidence ?? null,
        updatedAt: artifact.updatedAt,
      },
    ]),
  );
}

function isNotebookQuestion(question: any) {
  return (
    question?.type === "development" ||
    question?.type === "mixed_choice_development"
  );
}

function isSelectableQuestion(question: any) {
  return (
    question?.type === "multiple_choice" ||
    question?.type === "mixed_choice_development"
  );
}

// ── Cursos indexados ─────────────────────────────────────────────────────────
const CURSOS_BASICA = [
  "1° Básico A",
  "1° Básico B",
  "2° Básico A",
  "2° Básico B",
  "3° Básico A",
  "3° Básico B",
  "4° Básico A",
  "4° Básico B",
  "5° Básico A",
  "5° Básico B",
  "6° Básico A",
  "6° Básico B",
  "7° Básico A",
  "7° Básico B",
  "8° Básico A",
  "8° Básico B",
];
const CURSOS_MEDIA = [
  "1° Medio A",
  "1° Medio B",
  "2° Medio A",
  "2° Medio B",
  "3° Medio A",
  "3° Medio B",
  "4° Medio A",
  "4° Medio B",
];
const TODOS_LOS_CURSOS = [...CURSOS_BASICA, ...CURSOS_MEDIA];

type Phase =
  | "loading"
  | "kiosk_entry"
  | "register"
  | "exam"
  | "submitting"
  | "review"
  | "error"
  | "kiosk_closed";

function KioskWarningOverlay({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center">
      <div className="text-center max-w-sm px-6">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-main text-xl font-bold mb-3">Examen en progreso</h2>
        <p className="text-sub text-sm mb-6">
          No puedes salir del examen. La pantalla completa es obligatoria
          durante la evaluación. Solo el docente o el tiempo pueden cerrar este
          examen.
        </p>
        <button
          onClick={onDismiss}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-main text-sm font-bold rounded-xl w-full"
        >
          Volver al examen
        </button>
      </div>
    </div>
  );
}

// ── Freeze countdown display ──────────────────────────────────────────────────
function FreezeCountdown({ until }: { until: number }) {
  const [secs, setSecs] = useState(
    Math.max(0, Math.ceil((until - Date.now()) / 1000)),
  );
  useEffect(() => {
    const t = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setSecs(remaining);
      if (remaining <= 0) clearInterval(t);
    }, 500);
    return () => clearInterval(t);
  }, [until]);
  return <p className="text-5xl font-black tabular-nums">{secs}s</p>;
}

export default function ExamenPublicoPage() {
  const { code } = useParams() as { code: string };

  const [phase, setPhase] = useState<Phase>("loading");
  const [exam, setExam] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const [name, setName] = useState("");
  const [course, setCourse] = useState("");
  const [rut, setRut] = useState("");

  const [curQ, setCurQ] = useState(0);
  const [mcAnswers, setMcAnswers] = useState<Record<number, number>>({});
  const [devAnswers, setDevAnswers] = useState<Record<number, string>>({});
  const [tfJustifications, setTfJustifications] = useState<
    Record<number, string>
  >({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [submission, setSubmission] = useState<any>(null);
  const [feedback, setFeedback] = useState<Record<number, string>>({});
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const attemptIdRef = useRef(createAttemptId());
  const notebookRef = useRef<ExamQuestionNotebookHandle>(null);
  const [developmentArtifacts, setDevelopmentArtifacts] = useState<
    Record<number, ExamNotebookArtifact>
  >({});
  const [developmentSaveStatus, setDevelopmentSaveStatus] = useState("");
  const [developmentSaving, setDevelopmentSaving] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [autosaveMessage, setAutosaveMessage] = useState("");
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // kiosk
  const [isKiosk, setIsKiosk] = useState(false);
  const [kioskSala, setKioskSala] = useState("");
  const [kioskExamId, setKioskExamId] = useState<string | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [frozenUntil, setFrozenUntil] = useState<number>(0);
  const [frozenMsg, setFrozenMsg] = useState("");
  const frozenRef = useRef(false);

  // seguridad
  const [securityBlocked, setSecurityBlocked] = useState(false);
  const [securitySessionId, setSecuritySessionId] = useState<string | null>(
    null,
  );
  const [securityTerminateReason, setSecurityTerminateReason] = useState("");
  const [submittedForSecurity, setSubmittedForSecurity] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startRef = useRef(0);
  const panelPollRef = useRef<NodeJS.Timeout | null>(null);
  const realtimeRef = useRef<any>(null);
  const fullscreenGuard = useRef(false);
  const latestExamStateRef = useRef({
    phase: "loading" as Phase,
    exam: null as any,
    name: "",
    course: "",
    rut: "",
    curQ: 0,
    timeLeft: 0,
    mcAnswers: {} as Record<number, number>,
    devAnswers: {} as Record<number, string>,
    tfJustifications: {} as Record<number, string>,
    developmentArtifacts: {} as Record<number, ExamNotebookArtifact>,
  });

  const qs = exam?.questions || [];
  const q = qs[curQ];
  const totalQ = qs.length;

  const examTotalPoints = useMemo(
    () =>
      qs.reduce(
        (acc: number, item: any) => acc + getQuestionMaxPoints(item),
        0,
      ),
    [qs],
  );

  const answeredCount = useMemo(() => {
    return qs.filter((item: any, i: number) => {
      if (isNotebookQuestion(item)) {
        return Boolean(
          mcAnswers[i] !== undefined ||
          (devAnswers[i] && devAnswers[i].trim().length > 0) ||
          developmentArtifacts[i]?.latex?.trim(),
        );
      }

      if (item.type === "true_false") {
        return (
          mcAnswers[i] !== undefined ||
          Boolean(tfJustifications[i] && tfJustifications[i].trim().length > 0)
        );
      }

      return mcAnswers[i] !== undefined;
    }).length;
  }, [qs, mcAnswers, devAnswers, tfJustifications, developmentArtifacts]);

  const showRes = exam?.settings?.showResultToStudent !== false;
  const allowCalculator = exam?.settings?.allowCalculator === true;
  const developmentNotebookConfig = exam?.settings?.developmentNotebook;
  const currentNotebookEnabled =
    developmentNotebookConfig?.enabled === true &&
    (developmentNotebookConfig?.mode === "all_questions" ||
      isNotebookQuestion(q));

  useEffect(() => {
    latestExamStateRef.current = {
      phase,
      exam,
      name,
      course,
      rut,
      curQ,
      timeLeft,
      mcAnswers,
      devAnswers,
      tfJustifications,
      developmentArtifacts,
    };
  }, [
    phase,
    exam,
    name,
    course,
    rut,
    curQ,
    timeLeft,
    mcAnswers,
    devAnswers,
    tfJustifications,
    developmentArtifacts,
  ]);

  // ── Detectar kiosk ─────────────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("kiosk") === "1") {
      setIsKiosk(true);
      setKioskSala(params.get("sala") || "");
      setPhase("kiosk_entry");
    }
  }, []);

  // ── Cargar examen ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadExam() {
      try {
        setPhase((prev) => (prev === "kiosk_entry" ? prev : "loading"));

        const res = await fetch("/api/agents/examen-docente", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "public_exam_by_code",
            code,
          }),
        });

        const data = await res.json();
        if (!data?.success) {
          throw new Error(data?.error || "No se pudo cargar el examen.");
        }

        if (cancelled) return;

        setExam(data.exam);
        setTimeLeft((data.exam?.settings?.timeLimit || 30) * 60);

        if (!isKiosk) {
          setPhase("register");
        }
      } catch (e: any) {
        if (cancelled) return;
        setErrorMsg(e?.message || "Error al cargar el examen.");
        setPhase("error");
      }
    }

    void loadExam();

    return () => {
      cancelled = true;
    };
  }, [code, isKiosk]);

  // ── Fullscreen helpers ─────────────────────────────────────────────────────
  const requestFullscreen = useCallback(() => {
    if (document.fullscreenElement) return;
    const el = document.documentElement;
    (
      el.requestFullscreen({ navigationUI: "hide" } as any) as Promise<void>
    ).catch(() => el.requestFullscreen().catch(() => {}));
  }, []);

  const enterFullscreenAndRegister = useCallback(() => {
    const el = document.documentElement;
    el.requestFullscreen({ navigationUI: "hide" } as any)
      .catch((err) => {
        console.warn("[KIOSK] Fullscreen failed:", err);
      })
      .finally(() => {
        setPhase("register");
      });
  }, []);

  // ── Estado fullscreen + bloqueo por incidentes ────────────────────────────
  useEffect(() => {
    const triggerFreeze = (seconds: number, msg: string) => {
      if (frozenRef.current) return;
      frozenRef.current = true;
      const until = Date.now() + seconds * 1000;
      setFrozenUntil(until);
      setFrozenMsg(msg);
      // Re-enter fullscreen during freeze
      requestFullscreen();
      setTimeout(() => {
        if (!document.fullscreenElement) requestFullscreen();
      }, 200);
      // Unfreeze when timer ends
      setTimeout(() => {
        frozenRef.current = false;
        setFrozenUntil(0);
        setFrozenMsg("");
        requestFullscreen();
      }, seconds * 1000);
    };

    const onFs = () => {
      const current = !!document.fullscreenElement;
      setIsFullscreen(current);

      if (phase === "exam" && !current) {
        // Immediate re-entry attempts
        requestFullscreen();
        setTimeout(() => {
          if (!document.fullscreenElement) requestFullscreen();
        }, 100);
        setTimeout(() => {
          if (!document.fullscreenElement) requestFullscreen();
        }, 400);
        setTimeout(() => {
          if (!document.fullscreenElement) requestFullscreen();
        }, 1000);
        // Freeze for incident
        if (!fullscreenGuard.current) {
          fullscreenGuard.current = true;
          triggerFreeze(
            15,
            "Saliste de pantalla completa. El examen está bloqueado 15 segundos.",
          );
          setTimeout(() => {
            fullscreenGuard.current = false;
          }, 16000);
        }
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (phase !== "exam") return;
      // Hard block ESC, F11 and all function keys during exam
      const blocked =
        e.key === "Escape" ||
        e.key === "F11" ||
        (e.key.startsWith("F") && !isNaN(Number(e.key.slice(1)))) ||
        (e.ctrlKey && ["w", "t", "n", "r"].includes(e.key.toLowerCase())) ||
        (e.altKey && ["F4", "Tab"].includes(e.key)) ||
        e.key === "PrintScreen";

      if (blocked) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!document.fullscreenElement) requestFullscreen();
        if (e.key === "Escape" && !document.fullscreenElement) {
          triggerFreeze(
            10,
            "Intento de salir del examen bloqueado. Espera 10 segundos.",
          );
        }
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (phase !== "exam") return;
      if (e.clientY < 5) {
        document.documentElement.style.cursor = "none";
        if (!document.fullscreenElement) requestFullscreen();
      } else if (e.clientY > 20) {
        document.documentElement.style.cursor = "";
      }
    };

    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("keydown", onKeyDown, { capture: true });
    document.addEventListener("mousemove", onMouseMove, { capture: true });
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("mousemove", onMouseMove, true);
      document.documentElement.style.cursor = "";
    };
  }, [phase, requestFullscreen]);

  // ── Timer examen ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "exam") return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  // ── Guardado automático del intento ───────────────────────────────────────
  const autosaveAttempt = useCallback(
    async (
      overrides: {
        mcAnswers?: Record<number, number>;
        devAnswers?: Record<number, string>;
        tfJustifications?: Record<number, string>;
        developmentArtifacts?: Record<number, ExamNotebookArtifact>;
        currentQuestionIndex?: number;
        timeLeft?: number;
      } = {},
      options: { silent?: boolean } = {},
    ): Promise<boolean> => {
      const snapshot = latestExamStateRef.current;
      if (!snapshot.exam?.id || !attemptIdRef.current) return false;
      if (!snapshot.name.trim() || !snapshot.course.trim() || !isValidRut(snapshot.rut)) return false;

      const nextMcAnswers = overrides.mcAnswers ?? snapshot.mcAnswers;
      const nextDevAnswers = overrides.devAnswers ?? snapshot.devAnswers;
      const nextTfJustifications =
        overrides.tfJustifications ?? snapshot.tfJustifications;
      const nextDevelopmentArtifacts =
        overrides.developmentArtifacts ?? snapshot.developmentArtifacts;
      const nextQuestionIndex =
        overrides.currentQuestionIndex ?? snapshot.curQ;
      const nextTimeLeft = overrides.timeLeft ?? snapshot.timeLeft;

      if (!options.silent) {
        setAutosaveStatus("saving");
        setAutosaveMessage("Guardando avance...");
      }

      try {
        const res = await fetch("/api/agents/examen-docente", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "autosave_attempt",
            examId: snapshot.exam.id,
            studentName: snapshot.name,
            studentCourse: snapshot.course,
            studentRut: snapshot.rut,
            clientAttemptId: attemptIdRef.current,
            answers: {
              mcAnswers: nextMcAnswers,
              devAnswers: nextDevAnswers,
              tfJustifications: nextTfJustifications,
              developmentArtifacts: serializeDevelopmentArtifacts(
                nextDevelopmentArtifacts,
              ),
            },
            currentQuestionIndex: nextQuestionIndex,
            timeLeft: nextTimeLeft,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) {
          throw new Error(data?.error || "No se pudo guardar el avance.");
        }

        setAutosaveStatus("saved");
        setAutosaveMessage("Avance guardado automáticamente");
        return true;
      } catch (error: any) {
        if (!options.silent) {
          setAutosaveStatus("error");
          setAutosaveMessage(
            error?.message || "No se pudo guardar el avance.",
          );
        }
        return false;
      }
    },
    [],
  );

  const scheduleAutosave = useCallback(
    (
      overrides: {
        mcAnswers?: Record<number, number>;
        devAnswers?: Record<number, string>;
        tfJustifications?: Record<number, string>;
        developmentArtifacts?: Record<number, ExamNotebookArtifact>;
        currentQuestionIndex?: number;
        timeLeft?: number;
      } = {},
    ) => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      setAutosaveStatus("saving");
      setAutosaveMessage("Guardando avance...");
      autosaveTimerRef.current = setTimeout(() => {
        void autosaveAttempt(overrides);
      }, 350);
    },
    [autosaveAttempt],
  );

  useEffect(() => {
    if (phase !== "exam") return;

    const interval = setInterval(() => {
      void autosaveAttempt({}, { silent: true });
    }, 15000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        void autosaveAttempt({}, { silent: true });
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [autosaveAttempt, phase]);

  // ── Inicio examen ──────────────────────────────────────────────────────────
  const startExam = useCallback(async () => {
    const cleanRut = normalizeRutInput(rut);
    if (!name.trim() || !course.trim() || !isValidRut(cleanRut) || !exam?.id) {
      setAutosaveStatus("error");
      setAutosaveMessage(
        "Completa nombre, curso y un RUT válido sin puntos ni guion.",
      );
      return;
    }

    setSubmittedForSecurity(false);
    setSecurityBlocked(false);
    setSecurityTerminateReason("");
    setAutosaveStatus("saving");
    setAutosaveMessage("Preparando intento...");

    const fullscreenPromise = document.documentElement
      .requestFullscreen({ navigationUI: "hide" } as any)
      .catch(() => {});

    try {
      const res = await fetch("/api/agents/examen-docente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start_or_resume_attempt",
          examId: exam.id,
          studentName: name,
          studentCourse: course,
          studentRut: cleanRut,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "No se pudo iniciar el examen.");
      }

      const attempt = data.attempt || {};
      const savedAnswers = attempt.answers || {};
      const nextAttemptId = String(attempt.clientAttemptId || createAttemptId());
      attemptIdRef.current = nextAttemptId;

      setRut(cleanRut);
      setMcAnswers(normalizeNumberRecord(savedAnswers.mcAnswers));
      setDevAnswers(normalizeTextRecord(savedAnswers.devAnswers));
      setTfJustifications(normalizeTextRecord(savedAnswers.tfJustifications));
      setDevelopmentArtifacts(
        (savedAnswers.developmentArtifacts || {}) as Record<
          number,
          ExamNotebookArtifact
        >,
      );

      const totalSeconds = Math.max(
        60,
        Number(exam?.settings?.timeLimit || 30) * 60,
      );
      const restoredTimeLeft = Number(attempt.timeLeft);
      const safeTimeLeft =
        Number.isFinite(restoredTimeLeft) && restoredTimeLeft > 0
          ? Math.min(totalSeconds, Math.round(restoredTimeLeft))
          : totalSeconds;
      const restoredIndex = Math.max(
        0,
        Math.min(totalQ > 0 ? totalQ - 1 : 0, Number(attempt.currentQuestionIndex) || 0),
      );

      startRef.current = Date.now() - Math.max(0, totalSeconds - safeTimeLeft) * 1000;
      setTimeLeft(safeTimeLeft);
      setCurQ(restoredIndex);
      setAutosaveStatus(data.resumed ? "saved" : "idle");
      setAutosaveMessage(
        data.resumed
          ? "Avance anterior recuperado"
          : "Intento iniciado. Tus respuestas se guardarán automáticamente.",
      );

      await fullscreenPromise;
      setPhase("exam");
      setTimeout(() => requestFullscreen(), isKiosk ? 300 : 200);
    } catch (error: any) {
      setAutosaveStatus("error");
      setAutosaveMessage(error?.message || "No se pudo iniciar el examen.");
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }, [course, exam, isKiosk, name, requestFullscreen, rut, totalQ]);

  // ── Submit examen ──────────────────────────────────────────────────────────
  // ── Generate AI feedback per question ────────────────────────────────────
  const generateFeedback = useCallback(async (sub: any, ex: any) => {
    if (!ex?.questions?.length) return;
    setFeedbackLoading(true);
    setFeedbackDone(false);
    const feedbackMap: Record<number, string> = {};

    try {
      // La API carga la pauta oficial desde la base de datos. No recibe la
      // clave de respuestas desde el navegador.
      const res = await fetch("/api/agents/exam-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: sub.id }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.feedback)) {
          data.feedback.forEach((f: { index: number; text: string }) => {
            feedbackMap[f.index] = f.text;
          });
        }
      }
    } catch {}

    setFeedback(feedbackMap);
    setFeedbackLoading(false);
    setFeedbackDone(true);
  }, []);

  const saveCurrentDevelopment = useCallback(
    async (finalized = true): Promise<ExamNotebookArtifact | null> => {
      if (!exam || !currentNotebookEnabled || !notebookRef.current) return null;

      setDevelopmentSaving(true);
      setDevelopmentSaveStatus("Guardando desarrollo...");
      try {
        const artifact = finalized
          ? await notebookRef.current.finalizeArtifact()
          : notebookRef.current.getArtifact();
        const question = exam.questions?.[curQ] || {};
        const response = await fetch("/api/examen/developments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            examId: exam.id,
            clientAttemptId: attemptIdRef.current,
            questionIndex: curQ,
            questionId: question.id || `question-${curQ + 1}`,
            artifactVersion: 1,
            pages: artifact.pages,
            latex: artifact.latex,
            ocrText: artifact.ocrText,
            ocrConfidence: artifact.ocrConfidence,
            previewPngDataUrl: artifact.previewPngDataUrl,
            finalized,
            questionText: question.question || question.statement || "",
            expectedLatex:
              question.modelAnswer || question.expectedAnswer || "",
            rubric: question.rubric || [],
            maxPoints: getQuestionMaxPoints(question),
          }),
        });
        const data = await response.json();
        if (!response.ok || !data?.success) {
          throw new Error(
            data?.error || "No fue posible guardar el desarrollo.",
          );
        }
        setDevelopmentArtifacts((current) => ({
          ...current,
          [curQ]: artifact,
        }));
        setDevelopmentSaveStatus("✅ Desarrollo guardado");
        return artifact;
      } catch (error) {
        setDevelopmentSaveStatus(
          error instanceof Error
            ? `⚠️ ${error.message}`
            : "⚠️ No fue posible guardar el desarrollo.",
        );
        return null;
      } finally {
        setDevelopmentSaving(false);
      }
    },
    [curQ, currentNotebookEnabled, exam],
  );

  const goToQuestion = useCallback(
    async (nextIndex: number) => {
      if (nextIndex < 0 || nextIndex >= totalQ || nextIndex === curQ) return;
      const saved = await saveCurrentDevelopment(true);
      if (currentNotebookEnabled && !saved) return;

      const nextDevelopmentArtifacts = saved
        ? { ...latestExamStateRef.current.developmentArtifacts, [curQ]: saved }
        : latestExamStateRef.current.developmentArtifacts;
      const autosaved = await autosaveAttempt({
        developmentArtifacts: nextDevelopmentArtifacts,
        currentQuestionIndex: nextIndex,
      });
      if (!autosaved) return;

      setCurQ(nextIndex);
    },
    [autosaveAttempt, curQ, currentNotebookEnabled, saveCurrentDevelopment, totalQ],
  );

  const doSubmit = useCallback(
    async (_reason: "manual" | "forced" | "time_up" = "manual") => {
      if (!exam) return;
      if (phase === "submitting" || phase === "review") return;

      const latestArtifact = await saveCurrentDevelopment(true);
      if (currentNotebookEnabled && !latestArtifact) return;
      const latestDevelopmentArtifacts = latestArtifact
        ? { ...developmentArtifacts, [curQ]: latestArtifact }
        : developmentArtifacts;

      await autosaveAttempt(
        {
          developmentArtifacts: latestDevelopmentArtifacts,
          currentQuestionIndex: curQ,
          timeLeft: latestExamStateRef.current.timeLeft,
        },
        { silent: true },
      );

      if (timerRef.current) clearInterval(timerRef.current);

      setSubmittedForSecurity(true);
      setPhase("submitting");

      const ansArr = (exam.questions || []).map((question: any, i: number) => {
        if (question.type === "development") {
          return {
            devText:
              devAnswers[i] || latestDevelopmentArtifacts[i]?.ocrText || "",
            developmentLatex: latestDevelopmentArtifacts[i]?.latex || "",
            selectedAnswer: -1,
          };
        }

        if (question.type === "mixed_choice_development") {
          return {
            selectedAnswer: mcAnswers[i] ?? -1,
            devText:
              devAnswers[i] || latestDevelopmentArtifacts[i]?.ocrText || "",
            developmentLatex: latestDevelopmentArtifacts[i]?.latex || "",
          };
        }

        if (question.type === "true_false") {
          return {
            selectedAnswer: mcAnswers[i] ?? -1,
            justification: tfJustifications[i] || "",
          };
        }

        return {
          selectedAnswer: mcAnswers[i] ?? -1,
        };
      });

      try {
        const res = await fetch("/api/agents/examen-docente", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "submit",
            examId: exam.id,
            studentName: name,
            studentCourse: course,
            studentRut: normalizeRutInput(rut),
            answers: ansArr,
            questions: exam.questions || [],
            timeSpent: Math.round((Date.now() - startRef.current) / 1000),
            examPercentage: exam.settings?.examPercentage || 60,
            clientAttemptId: attemptIdRef.current,
          }),
        });

        const data = await res.json();
        if (!data?.success) {
          throw new Error(data?.error || "No se pudo enviar el examen.");
        }

        setSubmission({
          ...data.submission,
          review_questions: Array.isArray(data.reviewQuestions)
            ? data.reviewQuestions
            : [],
        });
        setPhase("review");

        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }

        // Generate AI feedback for each question
        generateFeedback(data.submission, exam);
      } catch (e: any) {
        setErrorMsg(e?.message || "Error al enviar el examen.");
        setPhase("error");
      }
    },
    [
      exam,
      phase,
      curQ,
      currentNotebookEnabled,
      devAnswers,
      developmentArtifacts,
      mcAnswers,
      tfJustifications,
      name,
      course,
      rut,
      autosaveAttempt,
      saveCurrentDevelopment,
    ],
  );

  // ── Auto submit por tiempo ────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "exam") return;
    if (timeLeft > 0) return;
    if (!exam) return;

    void doSubmit("time_up");
  }, [phase, timeLeft, exam, doSubmit]);

  // ── Controles kiosk — bloqueo completo de teclado/clipboard ─────────────
  // Restaurado del sistema antiguo: bloquea Escape, F11, F12, Ctrl+W, Alt+F4,
  // copiar/pegar/cortar, menú contextual, beforeunload y más teclas peligrosas.
  useEffect(() => {
    if (!isKiosk) return;

    function killKey(e: KeyboardEvent) {
      const key = e.key;
      const ctrl = e.ctrlKey;
      const alt = e.altKey;
      const shift = e.shiftKey;
      const meta = e.metaKey;

      const blocked =
        key === "Escape" ||
        key === "F11" ||
        key === "F12" ||
        key === "Meta" ||
        meta ||
        key === "PrintScreen" ||
        key === "F5" ||
        key === "F6" ||
        (alt && key === "F4") ||
        (ctrl && (key === "w" || key === "W")) ||
        (ctrl && key === "F4") ||
        (ctrl && (key === "Tab" || key === "t" || key === "T")) ||
        (ctrl && alt && key === "Tab") ||
        (ctrl && (key === "n" || key === "N")) ||
        (ctrl && shift && (key === "n" || key === "N")) ||
        (ctrl && shift && (key === "j" || key === "J")) ||
        (ctrl && shift && (key === "i" || key === "I")) ||
        (ctrl && shift && (key === "c" || key === "C")) ||
        (ctrl && (key === "l" || key === "L")) ||
        (ctrl && (key === "r" || key === "R")) ||
        (ctrl && (key === "c" || key === "C")) ||
        (ctrl && (key === "v" || key === "V")) ||
        (ctrl && (key === "x" || key === "X")) ||
        (ctrl && (key === "a" || key === "A"));

      if (blocked) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }

    function killKeyUp(e: KeyboardEvent) {
      if (
        e.key === "Escape" ||
        e.key === "F11" ||
        e.key === "Meta" ||
        e.key === "PrintScreen"
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }

    function killClipboard(e: ClipboardEvent) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }

    function onContextMenu(e: MouseEvent) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }

    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "El examen está en progreso.";
    }

    // Usar capture:true para interceptar antes que el navegador
    document.addEventListener("keydown", killKey, true);
    document.addEventListener("keyup", killKeyUp, true);
    document.addEventListener("copy", killClipboard, true);
    document.addEventListener("cut", killClipboard, true);
    document.addEventListener("paste", killClipboard, true);
    document.addEventListener("contextmenu", onContextMenu, true);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      document.removeEventListener("keydown", killKey, true);
      document.removeEventListener("keyup", killKeyUp, true);
      document.removeEventListener("copy", killClipboard, true);
      document.removeEventListener("cut", killClipboard, true);
      document.removeEventListener("paste", killClipboard, true);
      document.removeEventListener("contextmenu", onContextMenu, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [isKiosk]);

  // ── Cierre remoto kiosk — Realtime + polling de respaldo ────────────────
  // Restaurado del sistema antiguo: Supabase Realtime para cierre instantáneo
  // via cerrar_ahora/estado, con polling cada 6s como fallback.
  useEffect(() => {
    if (!isKiosk || !kioskSala || !code) return;

    const panelClient = getPanelClient();
    if (!panelClient) {
      console.warn(
        "[KIOSK] Sin credenciales del panel Supabase — el cierre remoto no funcionará",
      );
      return;
    }

    async function obtenerExamId() {
      const { data } = await panelClient!
        .from("examenes_kiosk")
        .select("id, cerrar_ahora, estado")
        .eq("sala", kioskSala)
        .eq("exam_code", code)
        .eq("estado", "activo")
        .limit(1);

      if (data && data.length > 0) {
        setKioskExamId(data[0].id);
        // Cierre ya marcado antes de conectar
        if (data[0].cerrar_ahora === true || data[0].estado === "cerrado") {
          handleKioskClose();
          return null;
        }
        return data[0].id;
      }
      return null;
    }

    obtenerExamId().then((id) => {
      if (!id) return;

      // Suscripción Realtime — cierre instantáneo
      const canal = panelClient!
        .channel(`exam_kiosk_${id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "examenes_kiosk",
            filter: `id=eq.${id}`,
          },
          (payload: any) => {
            const row = payload.new;
            if (row.cerrar_ahora === true || row.estado === "cerrado") {
              console.log("[KIOSK] Cierre recibido vía Realtime");
              handleKioskClose();
            }
          },
        )
        .subscribe();

      realtimeRef.current = canal;

      // Polling de respaldo cada 6 s (si Realtime falla)
      panelPollRef.current = setInterval(async () => {
        try {
          const { data: rows } = await panelClient!
            .from("examenes_kiosk")
            .select("cerrar_ahora, estado")
            .eq("id", id)
            .limit(1);

          if (
            !rows ||
            rows.length === 0 ||
            rows[0].cerrar_ahora === true ||
            rows[0].estado === "cerrado"
          ) {
            handleKioskClose();
          }
        } catch {}
      }, 6000);
    });

    return () => {
      if (panelPollRef.current) clearInterval(panelPollRef.current);
      if (realtimeRef.current) panelClient.removeChannel(realtimeRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isKiosk, kioskSala, code]);

  function handleKioskClose() {
    if (panelPollRef.current) clearInterval(panelPollRef.current);
    if (realtimeRef.current) {
      const panelClient = getPanelClient();
      if (panelClient) panelClient.removeChannel(realtimeRef.current);
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    setPhase("kiosk_closed");
  }

  // ── cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      if (panelPollRef.current) clearInterval(panelPollRef.current);
      if (realtimeRef.current?.unsubscribe) {
        realtimeRef.current.unsubscribe();
      }
    };
  }, []);

  // ── UI states ──────────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-app text-main flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-4xl mb-3">🧠</div>
          <p className="text-sub">Cargando examen...</p>
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="min-h-screen bg-app text-main flex items-center justify-center px-6">
        <div className="max-w-md w-full bg-card-soft-theme border border-soft rounded-2xl p-6 text-center">
          <div className="text-5xl mb-3">⚠️</div>
          <h2 className="text-2xl font-bold mb-2">Error</h2>
          <p className="text-sub text-sm">
            {errorMsg || "Ha ocurrido un problema."}
          </p>
        </div>
      </div>
    );
  }

  if (phase === "kiosk_closed") {
    return (
      <div className="min-h-screen bg-app text-main flex items-center justify-center px-6">
        <div className="max-w-md w-full bg-card-soft-theme border border-soft rounded-2xl p-6 text-center">
          <div className="text-5xl mb-3">🔒</div>
          <h2 className="text-2xl font-bold mb-2">Examen cerrado</h2>
          <p className="text-sub text-sm">
            La sesión de kiosco fue cerrada por el panel de control.
          </p>
        </div>
      </div>
    );
  }

  if (phase === "kiosk_entry") {
    const totalPts = (exam?.questions || []).reduce(
      (acc: number, item: any) => acc + getQuestionMaxPoints(item),
      0,
    );

    return (
      <div className="min-h-screen bg-app px-4 py-8 text-main">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <div className="text-6xl mb-4">🧪</div>
            <h1 className="text-4xl font-extrabold tracking-tight">
              {exam?.title || "Examen"}
            </h1>
            <p className="text-sub mt-3">{exam?.topic || "Evaluación"}</p>
            {kioskSala ? (
              <p className="text-blue-400 text-sm mt-2">
                Sala kiosk: {kioskSala}
              </p>
            ) : null}
          </div>

          <div
            className="flex justify-center gap-0 mb-10 rounded-2xl overflow-hidden"
            style={{
              border: "1px solid var(--exam-border)",
              background: "var(--exam-soft-bg)",
            }}
          >
            {[
              { value: exam?.questions?.length ?? 0, label: "preguntas" },
              { value: exam?.settings?.timeLimit ?? 30, label: "minutos" },
              { value: totalPts, label: "puntos" },
            ].map((stat, i, arr) => (
              <div
                key={i}
                className="flex-1 py-5"
                style={{
                  borderRight:
                    i < arr.length - 1
                      ? "1px solid var(--exam-border)"
                      : "none",
                }}
              >
                <p className="text-main font-bold text-3xl">{stat.value}</p>
                <p className="text-muted2 text-xs mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              enterFullscreenAndRegister();
            }}
            className="group relative w-full py-5 rounded-2xl text-white font-bold text-lg overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, #1e40af 0%, #2563eb 50%, #3b82f6 100%)",
              boxShadow:
                "0 0 0 1px rgba(59,130,246,0.3), 0 8px 32px rgba(59,130,246,0.25), 0 2px 8px rgba(0,0,0,0.5)",
            }}
          >
            <span className="relative z-10 flex items-center justify-center gap-3">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
              Comenzar examen
            </span>
          </button>

          <p className="text-muted2 text-xs mt-5 leading-relaxed text-center">
            Haz clic para comenzar. La pantalla se pondrá en modo completo
            automáticamente.
          </p>
        </div>
      </div>
    );
  }

  if (phase === "register") {
    return (
      <div className="min-h-screen bg-app px-4 py-8 text-main flex items-center justify-center">
        <div className="w-full max-w-xl bg-card-soft-theme border border-soft rounded-2xl p-6 md:p-8">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">📝</div>
            <h1 className="text-2xl md:text-3xl font-extrabold">
              {exam?.title || "Examen"}
            </h1>
            <p className="text-sub text-sm mt-2">
              {exam?.topic || "Completa tus datos para comenzar."}
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sub text-xs font-semibold block mb-1">
                NOMBRE *
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre completo"
                className="w-full bg-card-soft-theme border border-soft rounded-2xl px-4 py-3 text-main text-sm focus:outline-none focus:border-blue-500/30"
              />
            </div>

            <div>
              <label className="text-sub text-xs font-semibold block mb-1">
                CURSO *
              </label>
              <select
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                className="w-full bg-card-soft-theme border border-soft rounded-2xl px-4 py-3 text-main text-sm focus:outline-none focus:border-blue-500/30 cursor-pointer"
              >
                <option value="">— Selecciona tu curso —</option>
                <optgroup label="Enseñanza Básica">
                  {CURSOS_BASICA.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Enseñanza Media">
                  {CURSOS_MEDIA.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div>
              <label className="text-sub text-xs font-semibold block mb-1">
                RUT * <span className="text-muted2">(sin puntos ni guion)</span>
              </label>
              <input
                value={rut}
                onChange={(e) => setRut(normalizeRutInput(e.target.value))}
                placeholder="Ej: 123456789 o 12345678K"
                autoComplete="off"
                inputMode="text"
                maxLength={9}
                className="w-full bg-card-soft-theme border border-soft rounded-2xl px-4 py-3 text-main text-sm focus:outline-none focus:border-blue-500/30"
              />
              <div className="mt-1 flex flex-col gap-1 text-xs">
                {rut ? (
                  <p className="text-muted2">
                    Se guardará como: <span className="font-semibold text-sub">{formatRut(rut)}</span>
                  </p>
                ) : (
                  <p className="text-muted2">Acepta números y K como dígito verificador.</p>
                )}
                {rut && !isValidRut(rut) ? (
                  <p className="font-semibold text-red-600">
                    RUT inválido. Revisa el dígito verificador.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {/* ⚠️ Advertencia monitoreo IA */}
          <div className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-50 px-4 py-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">🔒</span>
              <p className="text-sm font-bold text-amber-800">
                Advertencia de monitoreo académico
              </p>
            </div>
            <ul className="text-xs text-amber-700 space-y-1 pl-6 list-disc leading-relaxed">
              <li>
                Este examen está bajo{" "}
                <strong>monitoreo de integridad académica</strong>.
              </li>
              <li>
                Queda <strong>estrictamente prohibido</strong> el uso de
                inteligencia artificial, buscadores, traductores o cualquier
                herramienta de apoyo externo.
              </li>
              <li>
                Cualquier intento de copiar, salir de la pantalla o usar otras
                aplicaciones{" "}
                <strong>será registrado y notificado al docente</strong>.
              </li>
              <li>
                Al iniciar confirmas que realizarás esta evaluación{" "}
                <strong>de forma honesta e individual</strong>.
              </li>
            </ul>
            <p className="text-[11px] text-amber-600 pt-1 border-t border-amber-200">
              Sistema de supervisión: EduAI Exam Security · Colegio Providencia
            </p>
          </div>

          <button
            onClick={startExam}
            disabled={!name.trim() || !course.trim() || !isValidRut(rut)}
            className="w-full mt-4 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm disabled:opacity-30 transition-all"
          >
            Entiendo y acepto — Iniciar examen →
          </button>
          {autosaveMessage ? (
            <p
              className={`mt-3 rounded-xl px-3 py-2 text-xs font-semibold ${autosaveStatus === "error" ? "bg-red-50 text-red-700" : autosaveStatus === "saving" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}`}
            >
              {autosaveStatus === "saving" ? "💾 " : autosaveStatus === "saved" ? "✅ " : autosaveStatus === "error" ? "⚠️ " : ""}
              {autosaveMessage}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  if ((phase === "review" || phase === "submitting") && submission) {
    const nota =
      submission.grade ??
      calculateGradeFromPercentage(
        Number(submission.score || 0),
        exam?.settings?.examPercentage || 60,
      );
    const pct = Number(submission.score || 0);
    const graded = submission.answers || [];
    const reviewQs =
      Array.isArray(submission.review_questions) &&
      submission.review_questions.length > 0
        ? submission.review_questions
        : qs;
    const fallbackSummary = calculateScoreSummary(reviewQs, graded);
    const earnedPoints = Number(
      submission.earned_points ?? fallbackSummary.earnedPoints,
    );
    const totalPoints = Number(
      submission.total_points ??
        fallbackSummary.totalPoints ??
        examTotalPoints ??
        0,
    );

    return (
      <div className="min-h-screen bg-app px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* ── Score card ── */}
          <div className="rounded-2xl border border-soft bg-card-theme p-6 text-center">
            <div className="text-5xl mb-3">
              {nota >= 5.5 ? "🎉" : nota >= 4.0 ? "📚" : "💪"}
            </div>
            {showRes ? (
              <>
                <h2 className="text-3xl font-extrabold text-main">
                  Nota: {nota}
                </h2>
                <p className="text-sub text-sm mt-1">
                  {nota >= 5.5
                    ? "¡Excelente trabajo!"
                    : nota >= 4.0
                      ? "Aprobado. ¡Bien hecho!"
                      : "Sigue practicando, puedes mejorar."}
                </p>
                <div className="flex justify-center gap-8 mt-4">
                  <div>
                    <p className="text-muted2 text-xs">Puntaje</p>
                    <p className="text-blue-600 font-bold text-xl">
                      {formatPoints(earnedPoints)}/
                      {totalPoints > 0 ? formatPoints(totalPoints) : "?"} pts
                    </p>
                  </div>
                  <div>
                    <p className="text-muted2 text-xs">Logro</p>
                    <p className="text-blue-600 font-bold text-xl">
                      {Math.round(pct)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-muted2 text-xs">Tiempo</p>
                    <p className="text-sub font-bold text-xl">
                      {submission.time_spent
                        ? `${Math.round(submission.time_spent / 60)}m`
                        : "—"}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-main">
                  Examen enviado ✓
                </h2>
                <p className="text-sub text-sm mt-1">
                  Tu docente revisará tus respuestas
                </p>
              </>
            )}
          </div>

          {/* ── Feedback loading indicator ── */}
          {feedbackLoading && (
            <div className="rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4 flex items-center gap-3">
              <div className="w-5 h-5 rounded-full border-2 border-violet-400 border-t-transparent animate-spin flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-violet-800">
                  Preparando la retroalimentación desde la pauta...
                </p>
                <p className="text-xs text-violet-600 mt-0.5">
                  Cargando las explicaciones registradas al crear el examen
                </p>
              </div>
            </div>
          )}

          {/* ── Revisión detallada basada en la pauta oficial ── */}
          {showRes && reviewQs.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-semibold text-muted2 uppercase tracking-widest px-1">
                Retroalimentación por pregunta
              </h3>

              {reviewQs.map((item: any, i: number) => {
                const g = graded[i] || {};
                const isDev = item.type === "development";
                const isTF = item.type === "true_false";
                const baseCorrect = g.isCorrect === true;
                const tfSelPts =
                  Number(g.selectionPoints ?? item.selectionPoints ?? 1) || 1;
                const tfJustScore = Math.max(
                  0,
                  Number(g.justificationScore) || 0,
                );
                const tfJustMax = Math.max(
                  0,
                  Number(
                    g.justificationMaxPoints ??
                      item.justificationMaxPoints ??
                      0,
                  ) || 0,
                );
                const tfEarned = (baseCorrect ? tfSelPts : 0) + tfJustScore;
                const tfTotal = tfSelPts + tfJustMax;
                const tfFull = isTF && tfTotal > 0 && tfEarned >= tfTotal;
                const tfPartial = isTF && tfEarned > 0 && tfEarned < tfTotal;
                const state = isDev
                  ? "dev"
                  : isTF
                    ? tfFull
                      ? "full"
                      : tfPartial
                        ? "partial"
                        : "wrong"
                    : baseCorrect
                      ? "full"
                      : "wrong";
                const stateColor = {
                  full: "border-green-200 bg-green-50",
                  partial: "border-yellow-200 bg-yellow-50",
                  dev: "border-blue-200 bg-blue-50",
                  wrong: "border-red-200 bg-red-50",
                }[state];
                const stateLabel = {
                  full: "✓ Correcta",
                  partial: "◐ Parcial",
                  dev: "📝 Desarrollo",
                  wrong: "✗ Incorrecta",
                }[state];
                const stateBadge = {
                  full: "bg-green-100 text-green-700",
                  partial: "bg-yellow-100 text-yellow-700",
                  dev: "bg-blue-100 text-blue-700",
                  wrong: "bg-red-100 text-red-700",
                }[state];

                const studentAnswer = isDev
                  ? g.devText || "—"
                  : isTF
                    ? item.options?.[g.selectedAnswer] || "—"
                    : item.options?.[g.selectedAnswer] || "—";
                const correctAnswer = isDev
                  ? item.modelAnswer ||
                    item.expectedLatex ||
                    item.expectedAnswer ||
                    "Ver rúbrica"
                  : item.answerText ||
                    item.correctAnswerText ||
                    item.options?.[item.correctAnswer] ||
                    "—";
                const aiFeedback = feedback[i];

                return (
                  <div
                    key={i}
                    className={`rounded-2xl border p-4 space-y-3 ${stateColor}`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-[11px] text-muted2 mb-1">
                          Pregunta {i + 1} ·{" "}
                          {formatPoints(getQuestionMaxPoints(item))} pts
                        </p>
                        <div className="text-main text-sm font-medium leading-relaxed">
                          <ExamMathText
                            text={item.question || item.statement || ""}
                          />
                        </div>
                      </div>
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0 ${stateBadge}`}
                      >
                        {stateLabel}
                      </span>
                    </div>

                    {/* Student answer vs correct */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-white/80 border border-soft px-3 py-2">
                        <p className="text-muted2 mb-0.5">Tu respuesta</p>
                        <p
                          className={`font-medium ${state === "full" ? "text-green-700" : state === "wrong" ? "text-red-700" : "text-amber-700"}`}
                        >
                          <ExamMathText text={studentAnswer} />
                        </p>
                      </div>
                      <div className="rounded-xl bg-white/80 border border-soft px-3 py-2">
                        <p className="text-muted2 mb-0.5">
                          {isDev
                            ? "Respuesta modelo registrada"
                            : "Respuesta correcta registrada"}
                        </p>
                        <p className="font-medium text-green-700">
                          <ExamMathText text={correctAnswer} />
                        </p>
                      </div>
                    </div>

                    {/* Retroalimentación basada en la explicación registrada */}
                    {aiFeedback ? (
                      <div className="rounded-xl bg-white/90 border border-violet-200 px-3 py-2.5">
                        <p className="text-[10px] font-semibold text-violet-600 uppercase tracking-wide mb-1">
                          ✦ Retroalimentación basada en la pauta
                        </p>
                        <div className="text-xs text-main leading-relaxed">
                          <ExamMathText text={aiFeedback} />
                        </div>
                      </div>
                    ) : feedbackLoading ? (
                      <div className="rounded-xl bg-white/60 border border-violet-100 px-3 py-2 flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full border border-violet-300 border-t-transparent animate-spin flex-shrink-0" />
                        <p className="text-xs text-violet-400">Analizando...</p>
                      </div>
                    ) : item.explanation ? (
                      <div className="rounded-xl bg-white/90 border border-blue-100 px-3 py-2.5">
                        <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide mb-1">
                          💡 Explicación
                        </p>
                        <div className="text-xs text-main leading-relaxed">
                          <ExamMathText text={item.explanation} />
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Close button — only after feedback is done ── */}
          {feedbackDone && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center space-y-3">
              <p className="text-2xl">✅</p>
              <p className="text-sm font-semibold text-emerald-800">
                Retroalimentación completa
              </p>
              <p className="text-xs text-emerald-600">
                Has revisado todas tus preguntas. Puedes cerrar esta página.
              </p>
              <button
                onClick={() => {
                  if (document.fullscreenElement) {
                    document
                      .exitFullscreen()
                      .catch(() => {})
                      .finally(() => {
                        if (window.opener) window.close();
                        else window.location.href = "/dashboard";
                      });
                  } else {
                    if (window.opener) window.close();
                    else window.location.href = "/dashboard";
                  }
                }}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-all"
              >
                ✓ He terminado — Salir del examen
              </button>
            </div>
          )}

          {/* If feedback not enabled (showRes false), still show a minimal close */}
          {!showRes && !feedbackLoading && (
            <button
              onClick={() => {
                if (window.opener) window.close();
                else window.location.href = "/dashboard";
              }}
              className="w-full py-3 rounded-2xl border border-soft bg-card-soft-theme text-sub text-sm font-medium transition hover:bg-card-theme"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen bg-app text-main flex items-center justify-center">
        <p className="text-sub">Cargando examen...</p>
      </div>
    );
  }

  return (
    <ExamThemeProvider settings={exam?.settings}>
      <div className="exam-root min-h-screen text-main">
        {phase === "exam" && exam?.id ? (
          <ExamSecurityExamBridge
            examId={exam.id}
            submissionId={submission?.id ?? null}
            studentName={name}
            studentCourse={course}
            studentRut={rut ? formatRut(rut) : null}
            currentQuestionIndex={curQ}
            timeLeft={timeLeft}
            enabled={!securityBlocked}
            isSubmitted={submittedForSecurity}
            onForceSubmit={() => doSubmit("forced")}
            onSecurityTerminate={(reason) => {
              setSecurityTerminateReason(
                reason || "Intento terminado por seguridad.",
              );
              setSecurityBlocked(true);
            }}
            onSessionReady={({ sessionId }) => {
              setSecuritySessionId(sessionId);
            }}
          />
        ) : null}

        {showWarning && isKiosk ? (
          <KioskWarningOverlay
            onDismiss={() => {
              setShowWarning(false);
              requestFullscreen();
            }}
          />
        ) : null}

        {phase === "exam" && allowCalculator ? <ExamScientificCalculator /> : null}

        <div className="mx-auto w-full max-w-[1760px] px-4 py-5 sm:px-5 lg:px-6 xl:pl-8 xl:pr-6">
          <div className="exam-themed-card mb-6 mx-auto w-full max-w-[900px] overflow-hidden rounded-[28px] border shadow-sm">
            <div
              className="flex flex-col items-center gap-3 px-5 py-5 text-center"
              style={{
                background:
                  "linear-gradient(135deg, color-mix(in srgb, var(--exam-accent) 12%, transparent), color-mix(in srgb, var(--exam-accent-soft) 48%, transparent), transparent)",
              }}
            >
              <div>
                <p
                  className="text-xs font-black uppercase tracking-[0.24em]"
                  style={{ color: "var(--exam-accent)" }}
                >
                  Evaluación en curso
                </p>
                <h1 className="mt-1 text-2xl md:text-3xl font-extrabold">
                  {exam.title}
                </h1>
                <p className="text-sub text-sm mt-1">
                  {exam.topic || "Evaluación"}
                </p>
                {securitySessionId ? (
                  <p className="text-muted2 text-xs mt-2">
                    Seguridad activa · sesión {securitySessionId}
                  </p>
                ) : null}
                {kioskExamId ? (
                  <p className="text-muted2 text-xs mt-1">
                    Kiosk exam id: {kioskExamId}
                  </p>
                ) : null}
              </div>
            </div>
            <div
              className="border-t px-5 py-3"
              style={{
                borderColor: "var(--exam-border)",
                backgroundColor: "var(--exam-soft-bg)",
              }}
            >
              <div
                className="flex items-center justify-between text-xs font-bold"
                style={{ color: "var(--exam-text-sub)" }}
              >
                <span>Progreso</span>
                <span>
                  {Math.round((answeredCount / Math.max(1, totalQ)) * 100)}%
                </span>
              </div>
              <div
                className="mt-2 h-2 overflow-hidden rounded-full"
                style={{
                  backgroundColor: "var(--exam-progress-track)",
                }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(answeredCount / Math.max(1, totalQ)) * 100}%`,
                    background:
                      "linear-gradient(90deg, var(--exam-progress), color-mix(in srgb, var(--exam-progress) 72%, white))",
                  }}
                />
              </div>
            </div>
          </div>

          {securityBlocked ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 mb-6">
              <p className="text-red-700 font-semibold">
                El examen fue detenido por seguridad.
              </p>
              <p className="text-red-700/80 text-sm mt-1">
                {securityTerminateReason ||
                  "Se detectó una política de riesgo alta."}
              </p>
            </div>
          ) : null}

          <div className="mx-auto grid w-full grid-cols-1 gap-6 2xl:ml-[320px] 2xl:w-[calc(100%-320px)] 2xl:grid-cols-[minmax(0,1040px)_320px] xl:items-start">
            <main className="w-full min-w-0">
              <div className="mx-auto flex w-full max-w-[1040px] flex-col items-stretch space-y-4">
                {/* Botón narrar pregunta — PIE/accesibilidad */}
                {exam?.settings?.accessibility?.pieMode && (
                  <div className="flex w-full justify-end">
                    <ExamAudioButton
                      questionText={q?.question || q?.statement || ""}
                      questionNumber={curQ + 1}
                      questionType={q?.type || "multiple_choice"}
                      options={q?.options}
                      pieMode={
                        exam?.settings?.accessibility?.dyslexiaMode ||
                        exam?.settings?.accessibility?.adhdMode ||
                        false
                      }
                    />
                  </div>
                )}

                <div className="mx-auto w-full max-w-[1040px] [&>div]:!w-full [&>div]:!max-w-none [&_.exam-question]:!w-full [&_.exam-question]:!max-w-none">
                  <QuestionCard
                    question={q}
                    index={curQ}
                    total={totalQ}
                    maxPoints={getQuestionMaxPoints(q)}
                    mcAnswer={mcAnswers[curQ]}
                    tfAnswer={mcAnswers[curQ]}
                    tfJustification={tfJustifications[curQ]}
                    devAnswer={devAnswers[curQ]}
                    onMcChange={(i) => {
                      const next = { ...latestExamStateRef.current.mcAnswers, [curQ]: i };
                      setMcAnswers(next);
                      void autosaveAttempt({ mcAnswers: next });
                    }}
                    onTfChange={(i) => {
                      const next = { ...latestExamStateRef.current.mcAnswers, [curQ]: i };
                      setMcAnswers(next);
                      void autosaveAttempt({ mcAnswers: next });
                    }}
                    onTfJustificationChange={(v) => {
                      const next = {
                        ...latestExamStateRef.current.tfJustifications,
                        [curQ]: v,
                      };
                      setTfJustifications(next);
                      scheduleAutosave({ tfJustifications: next });
                    }}
                    onDevChange={(v) => {
                      const next = { ...latestExamStateRef.current.devAnswers, [curQ]: v };
                      setDevAnswers(next);
                      scheduleAutosave({ devAnswers: next });
                    }}
                    useNotebookForDevelopment={currentNotebookEnabled}
                  />
                </div>

                {currentNotebookEnabled ? (
                  <div className="mx-auto w-full max-w-[1040px] min-w-0 [&>section]:!w-full [&>section]:!max-w-none">
                    <ExamQuestionNotebook
                      key={`${exam.id}-${curQ}`}
                      ref={notebookRef}
                      examId={exam.id}
                      attemptId={attemptIdRef.current}
                      questionIndex={curQ}
                      questionId={q?.id || `question-${curQ + 1}`}
                      onArtifactChange={(artifact) => {
                        const next = {
                          ...latestExamStateRef.current.developmentArtifacts,
                          [curQ]: artifact,
                        };
                        setDevelopmentArtifacts(next);
                        scheduleAutosave({ developmentArtifacts: next });
                      }}
                    />
                  </div>
                ) : null}
              </div>
            </main>

            <aside className="mt-5 space-y-4 2xl:sticky 2xl:top-24 2xl:z-40 2xl:mt-0 2xl:max-h-[calc(100vh-7rem)] 2xl:w-[320px] 2xl:overflow-y-auto">
              <div
                className="rounded-[24px] border p-3 shadow-sm backdrop-blur"
                style={{
                  borderColor:
                    "color-mix(in srgb, var(--exam-accent) 18%, white)",
                  backgroundColor:
                    "color-mix(in srgb, var(--exam-surface) 92%, transparent)",
                }}
              >
                <div className="grid grid-cols-2 gap-3">
                  <div
                    className="min-w-0 rounded-2xl border px-3 py-3 text-center shadow-sm"
                    style={{
                      borderColor:
                        "color-mix(in srgb, var(--exam-accent) 18%, white)",
                      background:
                        "linear-gradient(135deg, color-mix(in srgb, var(--exam-accent) 7%, white), color-mix(in srgb, var(--exam-accent-soft) 35%, white))",
                    }}
                  >
                    <p
                      className="mb-2 inline-flex rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em]"
                      style={{
                        backgroundColor:
                          "color-mix(in srgb, var(--exam-accent) 12%, white)",
                        color: "var(--exam-accent)",
                      }}
                    >
                      Tiempo
                    </p>
                    <p
                      className="font-mono text-2xl font-black tabular-nums leading-none"
                      style={{ color: "var(--exam-accent)" }}
                    >
                      {fmt(timeLeft)}
                    </p>
                    <p className="mt-2 truncate text-[10px] font-bold uppercase tracking-[0.08em] text-muted2">
                      Restante
                    </p>
                  </div>

                  <ExamDigitalClock />
                </div>

                <div
                  className="mt-3 rounded-2xl border px-3 py-2 text-center"
                  style={{
                    borderColor:
                      "color-mix(in srgb, var(--exam-accent) 15%, white)",
                    backgroundColor:
                      "color-mix(in srgb, var(--exam-accent-soft) 26%, white)",
                  }}
                >
                  <p className="text-xs font-black text-muted2">
                    {answeredCount}/{totalQ} respondidas
                  </p>
                  {autosaveMessage ? (
                    <p
                      className={`mt-1 text-[11px] font-semibold ${autosaveStatus === "error" ? "text-red-600" : autosaveStatus === "saving" ? "text-blue-600" : "text-emerald-600"}`}
                    >
                      {autosaveStatus === "saving"
                        ? "💾 Guardando..."
                        : autosaveStatus === "saved"
                          ? "✅ Guardado"
                          : autosaveStatus === "error"
                            ? `⚠️ ${autosaveMessage}`
                            : autosaveMessage}
                    </p>
                  ) : null}
                  {isKiosk ? (
                    <p className="text-muted2 text-[11px] mt-1">
                      Fullscreen: {isFullscreen ? "activo" : "inactivo"}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="exam-themed-soft rounded-[28px] border p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-main">Navegación</h3>
                    <p className="text-xs text-muted2">
                      Avanza a tu ritmo y revisa antes de entregar.
                    </p>
                  </div>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-black"
                    style={{
                      backgroundColor: "var(--exam-accent-soft)",
                      color: "var(--exam-accent)",
                    }}
                  >
                    {curQ + 1}/{totalQ}
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-2 mb-6">
                  {qs.map((_: any, i: number) => {
                    const answered = isNotebookQuestion(qs[i])
                      ? Boolean(
                          mcAnswers[i] !== undefined ||
                          devAnswers[i]?.trim() ||
                          developmentArtifacts[i]?.latex?.trim(),
                        )
                      : qs[i]?.type === "true_false"
                        ? mcAnswers[i] !== undefined ||
                          Boolean(tfJustifications[i]?.trim())
                        : mcAnswers[i] !== undefined;

                    return (
                      <button
                        key={i}
                        onClick={() => void goToQuestion(i)}
                        className={`h-10 rounded-xl text-sm font-bold border transition ${
                          curQ === i
                            ? "border-[var(--exam-accent)] bg-[var(--exam-accent-soft)] text-[var(--exam-accent)]"
                            : answered
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                              : "border-[var(--exam-border)] bg-[var(--exam-surface)] text-[var(--exam-text-sub)]"
                        }`}
                      >
                        {i + 1}
                      </button>
                    );
                  })}
                </div>

                {developmentSaveStatus && (
                  <p
                    className={`mb-3 rounded-xl px-3 py-2 text-xs font-semibold ${developmentSaveStatus.startsWith("⚠️") ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}
                  >
                    {developmentSaving ? "💾 " : ""}
                    {developmentSaveStatus}
                  </p>
                )}

                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => void goToQuestion(Math.max(0, curQ - 1))}
                      disabled={curQ === 0}
                      className="flex-1 py-2.5 rounded-2xl bg-card-soft-theme border border-soft text-main text-sm disabled:opacity-30 transition-all"
                    >
                      ← Anterior
                    </button>
                    <button
                      onClick={() =>
                        void goToQuestion(Math.min(totalQ - 1, curQ + 1))
                      }
                      disabled={curQ === totalQ - 1}
                      className="flex-1 py-2.5 rounded-2xl text-white font-bold text-sm transition-all disabled:opacity-30"
                      style={{
                        background:
                          curQ === totalQ - 1
                            ? undefined
                            : "linear-gradient(135deg,var(--exam-accent),color-mix(in srgb, var(--exam-accent) 72%, white))",
                        boxShadow:
                          curQ === totalQ - 1
                            ? undefined
                            : "0 2px 12px color-mix(in srgb, var(--exam-accent) 28%, transparent)",
                      }}
                    >
                      Siguiente →
                    </button>
                  </div>

                  {/* Confirm submit overlay */}
                  {confirmSubmit ? (
                    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 space-y-2">
                      <p className="text-xs font-bold text-amber-800 text-center">
                        ¿Seguro que quieres entregar?
                      </p>
                      <p className="text-[11px] text-amber-700 text-center">
                        {answeredCount < totalQ
                          ? `⚠️ Te faltan ${totalQ - answeredCount} preguntas sin responder.`
                          : "✓ Todas las preguntas respondidas."}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmSubmit(false)}
                          className="flex-1 py-2 rounded-xl border border-amber-300 text-amber-800 text-xs font-semibold transition-all hover:bg-amber-100"
                        >
                          Seguir revisando
                        </button>
                        <button
                          onClick={() => {
                            setConfirmSubmit(false);
                            void doSubmit("manual");
                          }}
                          className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all"
                        >
                          Sí, entregar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmSubmit(true)}
                      disabled={curQ < totalQ - 1}
                      className="w-full py-3 rounded-2xl font-bold text-sm transition-all"
                      style={{
                        background:
                          curQ < totalQ - 1
                            ? "var(--exam-soft-bg)"
                            : "linear-gradient(135deg,#dc2626,#ef4444)",
                        border:
                          curQ < totalQ - 1
                            ? "1px solid var(--exam-border)"
                            : "none",
                        color:
                          curQ < totalQ - 1 ? "var(--exam-muted)" : "white",
                        boxShadow:
                          curQ < totalQ - 1
                            ? "none"
                            : "0 4px 16px rgba(220,38,38,0.4)",
                        cursor: curQ < totalQ - 1 ? "not-allowed" : "pointer",
                      }}
                      title={
                        curQ < totalQ - 1
                          ? "Llega a la última pregunta para poder entregar"
                          : ""
                      }
                    >
                      {curQ < totalQ - 1
                        ? `📋 Llega a la pregunta ${totalQ} para entregar`
                        : "🔴 Entregar examen"}
                    </button>
                  )}
                </div>

                <div className="mt-6 text-xs text-muted2">
                  <p>
                    Alumno: <span className="text-sub">{name || "—"}</span>
                  </p>
                  <p className="mt-1">
                    Curso: <span className="text-sub">{course || "—"}</span>
                  </p>
                  <p className="mt-1">
                    RUT: <span className="text-sub">{rut ? formatRut(rut) : "—"}</span>
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </ExamThemeProvider>
  );
}
