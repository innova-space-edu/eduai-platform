"use client"

import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import ExamMathText from "@/components/ui/ExamMathText"
import ExamSecurityExamBridge from "@/components/exam-security/ExamSecurityExamBridge"

// ── Supabase del PANEL DE CONTROL ────────────────────────────────────────────
const PANEL_URL = process.env.NEXT_PUBLIC_PANEL_SUPABASE_URL || ""
const PANEL_KEY = process.env.NEXT_PUBLIC_PANEL_SUPABASE_ANON_KEY || ""

function getPanelClient() {
  if (!PANEL_URL || !PANEL_KEY) return null
  return createClient(PANEL_URL, PANEL_KEY)
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function calcGrade(scorePercent: number, exigencia = 60) {
  const p = Math.max(0, Math.min(100, scorePercent))
  return Math.round(
    (p >= exigencia
      ? 4 + ((p - exigencia) * 3) / (100 - exigencia)
      : 1 + (p * 3) / exigencia) * 10
  ) / 10
}

function fmt(seconds: number) {
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`
}

function getQuestionMaxPoints(q: any) {
  if (!q) return 1
  if (typeof q.maxPoints === "number" && q.maxPoints > 0) return q.maxPoints

  if (q.type === "true_false") {
    return (
      (typeof q.selectionPoints === "number" ? q.selectionPoints : 1) +
      (typeof q.justificationMaxPoints === "number" ? q.justificationMaxPoints : 2)
    )
  }

  if (q.type === "development") {
    if (Array.isArray(q.rubric) && q.rubric.length > 0) {
      return q.rubric.reduce((acc: number, item: any) => acc + (Number(item?.points) || 0), 0)
    }
    return 5
  }

  return 1
}

type Phase =
  | "loading"
  | "kiosk_entry"
  | "register"
  | "exam"
  | "submitting"
  | "review"
  | "error"
  | "kiosk_closed"

function KioskWarningOverlay({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center">
      <div className="text-center max-w-sm px-6">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-white text-xl font-bold mb-3">Examen en progreso</h2>
        <p className="text-gray-400 text-sm mb-6">
          No puedes salir del examen. La pantalla completa es obligatoria durante la evaluación.
          Solo el docente o el tiempo pueden cerrar este examen.
        </p>
        <button
          onClick={onDismiss}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl w-full"
        >
          Volver al examen
        </button>
      </div>
    </div>
  )
}

export default function ExamenPublicoPage() {
  const { code } = useParams() as { code: string }

  const [phase, setPhase] = useState<Phase>("loading")
  const [exam, setExam] = useState<any>(null)
  const [errorMsg, setErrorMsg] = useState("")

  const [name, setName] = useState("")
  const [course, setCourse] = useState("")
  const [rut, setRut] = useState("")

  const [curQ, setCurQ] = useState(0)
  const [mcAnswers, setMcAnswers] = useState<Record<number, number>>({})
  const [devAnswers, setDevAnswers] = useState<Record<number, string>>({})
  const [tfJustifications, setTfJustifications] = useState<Record<number, string>>({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [submission, setSubmission] = useState<any>(null)

  // kiosk
  const [isKiosk, setIsKiosk] = useState(false)
  const [kioskSala, setKioskSala] = useState("")
  const [kioskExamId, setKioskExamId] = useState<string | null>(null)
  const [showWarning, setShowWarning] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // seguridad
  const [securityBlocked, setSecurityBlocked] = useState(false)
  const [securitySessionId, setSecuritySessionId] = useState<string | null>(null)
  const [securityTerminateReason, setSecurityTerminateReason] = useState("")
  const [submittedForSecurity, setSubmittedForSecurity] = useState(false)

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startRef = useRef(0)
  const panelPollRef = useRef<NodeJS.Timeout | null>(null)
  const realtimeRef = useRef<any>(null)
  const fullscreenGuard = useRef(false)

  const qs = exam?.questions || []
  const q = qs[curQ]
  const totalQ = qs.length

  const examTotalPoints = useMemo(
    () => qs.reduce((acc: number, item: any) => acc + getQuestionMaxPoints(item), 0),
    [qs]
  )

  const answeredCount = useMemo(() => {
    return qs.filter((item: any, i: number) => {
      if (item.type === "development") {
        return Boolean(devAnswers[i] && devAnswers[i].trim().length > 0)
      }

      if (item.type === "true_false") {
        return (
          mcAnswers[i] !== undefined ||
          Boolean(tfJustifications[i] && tfJustifications[i].trim().length > 0)
        )
      }

      return mcAnswers[i] !== undefined
    }).length
  }, [qs, mcAnswers, devAnswers, tfJustifications])

  const showRes = exam?.settings?.showResultToStudent !== false

  // ── Detectar kiosk ─────────────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("kiosk") === "1") {
      setIsKiosk(true)
      setKioskSala(params.get("sala") || "")
      setPhase("kiosk_entry")
    }
  }, [])

  // ── Cargar examen ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function loadExam() {
      try {
        setPhase((prev) => (prev === "kiosk_entry" ? prev : "loading"))

        const res = await fetch("/api/agents/examen-docente", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "public_exam_by_code",
            code,
          }),
        })

        const data = await res.json()
        if (!data?.success) {
          throw new Error(data?.error || "No se pudo cargar el examen.")
        }

        if (cancelled) return

        setExam(data.exam)
        setTimeLeft((data.exam?.settings?.timeLimit || 30) * 60)

        if (!isKiosk) {
          setPhase("register")
        }
      } catch (e: any) {
        if (cancelled) return
        setErrorMsg(e?.message || "Error al cargar el examen.")
        setPhase("error")
      }
    }

    void loadExam()

    return () => {
      cancelled = true
    }
  }, [code, isKiosk])

  // ── Fullscreen helpers ─────────────────────────────────────────────────────
  const requestFullscreen = useCallback(() => {
    if (!isKiosk) return
    if (document.fullscreenElement) return

    const el = document.documentElement
    ;(el.requestFullscreen({ navigationUI: "hide" } as any) as Promise<void>)
      .catch(() => el.requestFullscreen().catch(() => {}))
  }, [isKiosk])

  const enterFullscreenAndRegister = useCallback(() => {
    const el = document.documentElement
    el.requestFullscreen({ navigationUI: "hide" } as any)
      .catch((err) => {
        console.warn("[KIOSK] Fullscreen failed:", err)
      })
      .finally(() => {
        setPhase("register")
      })
  }, [])

  // ── Estado fullscreen ──────────────────────────────────────────────────────
  useEffect(() => {
    const onFs = () => {
      const current = !!document.fullscreenElement
      setIsFullscreen(current)

      if (
        isKiosk &&
        phase === "exam" &&
        !current &&
        !fullscreenGuard.current
      ) {
        fullscreenGuard.current = true
        setShowWarning(true)

        setTimeout(() => {
          fullscreenGuard.current = false
        }, 900)
      }
    }

    document.addEventListener("fullscreenchange", onFs)
    return () => document.removeEventListener("fullscreenchange", onFs)
  }, [isKiosk, phase])

  // ── Timer examen ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "exam") return

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [phase])

  // ── Inicio examen ──────────────────────────────────────────────────────────
  const startExam = useCallback(() => {
    if (!name.trim() || !course.trim()) return

    startRef.current = Date.now()
    setSubmittedForSecurity(false)
    setSecurityBlocked(false)
    setSecurityTerminateReason("")

    const doStart = () => {
      setPhase("exam")
      if (isKiosk) setTimeout(requestFullscreen, 300)
    }

    document.documentElement
      .requestFullscreen({ navigationUI: "hide" } as any)
      .catch(() => {})
      .finally(doStart)
  }, [name, course, isKiosk, requestFullscreen])

  // ── Submit examen ──────────────────────────────────────────────────────────
  const doSubmit = useCallback(
    async (_reason: "manual" | "forced" | "time_up" = "manual") => {
      if (!exam) return
      if (phase === "submitting" || phase === "review") return

      if (timerRef.current) clearInterval(timerRef.current)

      setSubmittedForSecurity(true)
      setPhase("submitting")

      const ansArr = (exam.questions || []).map((question: any, i: number) => {
        if (question.type === "development") {
          return {
            devText: devAnswers[i] || "",
            selectedAnswer: -1,
          }
        }

        if (question.type === "true_false") {
          return {
            selectedAnswer: mcAnswers[i] ?? -1,
            justification: tfJustifications[i] || "",
          }
        }

        return {
          selectedAnswer: mcAnswers[i] ?? -1,
        }
      })

      try {
        const res = await fetch("/api/agents/examen-docente", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "submit",
            examId: exam.id,
            studentName: name,
            studentCourse: course,
            studentRut: rut || null,
            answers: ansArr,
            questions: exam.questions || [],
            timeSpent: Math.round((Date.now() - startRef.current) / 1000),
            examPercentage: exam.settings?.examPercentage || 60,
          }),
        })

        const data = await res.json()
        if (!data?.success) {
          throw new Error(data?.error || "No se pudo enviar el examen.")
        }

        setSubmission(data.submission)
        setPhase("review")

        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {})
        }
      } catch (e: any) {
        setErrorMsg(e?.message || "Error al enviar el examen.")
        setPhase("error")
      }
    },
    [exam, phase, devAnswers, mcAnswers, tfJustifications, name, course, rut]
  )

  // ── Auto submit por tiempo ────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "exam") return
    if (timeLeft > 0) return
    if (!exam) return

    void doSubmit("time_up")
  }, [phase, timeLeft, exam, doSubmit])

  // ── Controles kiosk mínimos ────────────────────────────────────────────────
  useEffect(() => {
    if (!isKiosk) return
    if (phase !== "exam") return

    const onContextMenu = (e: MouseEvent) => e.preventDefault()
    const onCopy = (e: ClipboardEvent) => e.preventDefault()
    const onPaste = (e: ClipboardEvent) => e.preventDefault()
    const onCut = (e: ClipboardEvent) => e.preventDefault()

    document.addEventListener("contextmenu", onContextMenu)
    document.addEventListener("copy", onCopy)
    document.addEventListener("paste", onPaste)
    document.addEventListener("cut", onCut)

    return () => {
      document.removeEventListener("contextmenu", onContextMenu)
      document.removeEventListener("copy", onCopy)
      document.removeEventListener("paste", onPaste)
      document.removeEventListener("cut", onCut)
    }
  }, [isKiosk, phase])

  // ── Poll opcional kiosk/panel ──────────────────────────────────────────────
  useEffect(() => {
    if (!isKiosk || !kioskSala || !exam?.id) return

    const panel = getPanelClient()
    if (!panel) return

    setKioskExamId(exam.id)

    panelPollRef.current = setInterval(async () => {
      try {
        const { data } = await panel
          .from("examenes_kiosk")
          .select("*")
          .eq("exam_id", exam.id)
          .eq("sala", kioskSala)
          .maybeSingle()

        if (data?.estado === "cerrado") {
          setPhase("kiosk_closed")
        }
      } catch {}
    }, 10000)

    return () => {
      if (panelPollRef.current) clearInterval(panelPollRef.current)
    }
  }, [isKiosk, kioskSala, exam?.id])

  // ── cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (panelPollRef.current) clearInterval(panelPollRef.current)
      if (realtimeRef.current?.unsubscribe) {
        realtimeRef.current.unsubscribe()
      }
    }
  }, [])

  // ── UI states ──────────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-4xl mb-3">🧠</div>
          <p className="text-gray-400">Cargando examen...</p>
        </div>
      </div>
    )
  }

  if (phase === "error") {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6">
        <div className="max-w-md w-full bg-white/[0.04] border border-white/[0.08] rounded-3xl p-6 text-center">
          <div className="text-5xl mb-3">⚠️</div>
          <h2 className="text-2xl font-bold mb-2">Error</h2>
          <p className="text-gray-400 text-sm">{errorMsg || "Ha ocurrido un problema."}</p>
        </div>
      </div>
    )
  }

  if (phase === "kiosk_closed") {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6">
        <div className="max-w-md w-full bg-white/[0.04] border border-white/[0.08] rounded-3xl p-6 text-center">
          <div className="text-5xl mb-3">🔒</div>
          <h2 className="text-2xl font-bold mb-2">Examen cerrado</h2>
          <p className="text-gray-400 text-sm">
            La sesión de kiosco fue cerrada por el panel de control.
          </p>
        </div>
      </div>
    )
  }

  if (phase === "kiosk_entry") {
    const totalPts = (exam?.questions || []).reduce(
      (acc: number, item: any) => acc + getQuestionMaxPoints(item),
      0
    )

    return (
      <div className="min-h-screen bg-gray-950 px-4 py-8 text-white">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <div className="text-6xl mb-4">🧪</div>
            <h1 className="text-4xl font-extrabold tracking-tight">
              {exam?.title || "Examen"}
            </h1>
            <p className="text-gray-400 mt-3">{exam?.topic || "Evaluación"}</p>
            {kioskSala ? (
              <p className="text-blue-400 text-sm mt-2">Sala kiosk: {kioskSala}</p>
            ) : null}
          </div>

          <div
            className="flex justify-center gap-0 mb-10 rounded-2xl overflow-hidden"
            style={{
              border: "1px solid rgba(255,255,255,0.05)",
              background: "rgba(255,255,255,0.02)",
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
                    i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                }}
              >
                <p className="text-white font-bold text-3xl">{stat.value}</p>
                <p className="text-gray-600 text-xs mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation()
              enterFullscreenAndRegister()
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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
              Comenzar examen
            </span>
          </button>

          <p className="text-gray-700 text-xs mt-5 leading-relaxed text-center">
            Haz clic para comenzar. La pantalla se pondrá en modo completo automáticamente.
          </p>
        </div>
      </div>
    )
  }

  if (phase === "register") {
    return (
      <div className="min-h-screen bg-gray-950 px-4 py-8 text-white flex items-center justify-center">
        <div className="w-full max-w-xl bg-white/[0.04] border border-white/[0.08] rounded-3xl p-6 md:p-8">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">📝</div>
            <h1 className="text-2xl md:text-3xl font-extrabold">
              {exam?.title || "Examen"}
            </h1>
            <p className="text-gray-400 text-sm mt-2">
              {exam?.topic || "Completa tus datos para comenzar."}
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-gray-400 text-xs font-semibold block mb-1">
                NOMBRE *
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre completo"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 text-gray-200 text-sm focus:outline-none focus:border-blue-500/30"
              />
            </div>

            <div>
              <label className="text-gray-400 text-xs font-semibold block mb-1">
                CURSO *
              </label>
              <input
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                placeholder="8°A, 1° Medio B"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 text-gray-200 text-sm focus:outline-none focus:border-blue-500/30"
              />
            </div>

            <div>
              <label className="text-gray-400 text-xs font-semibold block mb-1">
                RUT (opcional)
              </label>
              <input
                value={rut}
                onChange={(e) => setRut(e.target.value)}
                placeholder="12.345.678-9"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 text-gray-200 text-sm focus:outline-none focus:border-blue-500/30"
              />
            </div>
          </div>

          <button
            onClick={startExam}
            disabled={!name.trim() || !course.trim()}
            className="w-full mt-6 py-3.5 rounded-2xl bg-blue-600/90 hover:bg-blue-500 text-white font-bold text-sm disabled:opacity-30"
          >
            Iniciar examen
          </button>
        </div>
      </div>
    )
  }

  if ((phase === "review" || phase === "submitting") && submission) {
    const nota =
      submission.grade ??
      calcGrade(Number(submission.score || 0), exam?.settings?.examPercentage || 60)

    const pct = Number(submission.score || 0)
    const graded = submission.answers || []

    return (
      <div className="min-h-screen bg-gray-950 px-4 py-6">
        {exam?.id && (
          <ExamSecurityExamBridge
            examId={exam.id}
            submissionId={submission?.id ?? null}
            studentName={name}
            studentCourse={course}
            studentRut={rut || null}
            currentQuestionIndex={curQ}
            timeLeft={timeLeft}
            enabled={!securityBlocked}
            isSubmitted={submittedForSecurity}
            onForceSubmit={() => doSubmit("forced")}
            onSecurityTerminate={(reason) => {
              setSecurityTerminateReason(reason || "Intento terminado por seguridad.")
              setSecurityBlocked(true)
            }}
            onSessionReady={({ sessionId }) => {
              setSecuritySessionId(sessionId)
            }}
          />
        )}

        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-6">
            <div className="text-5xl mb-2">
              {nota >= 5.5 ? "🎉" : nota >= 4.0 ? "📚" : "💪"}
            </div>

            {showRes ? (
              <>
                <h2 className="text-3xl font-extrabold text-white">Nota: {nota}</h2>
                <p className="text-gray-500 text-sm mt-1">
                  {nota >= 5.5
                    ? "¡Excelente trabajo!"
                    : nota >= 4.0
                      ? "Aprobado. Sigue practicando."
                      : "Repasa el material."}
                </p>

                <div className="flex justify-center gap-6 mt-3">
                  <div>
                    <p className="text-gray-600 text-xs">Puntaje</p>
                    <p className="text-blue-400 font-bold text-lg">
                      {submission.correct_count}/{examTotalPoints > 0 ? examTotalPoints : 0} pts
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-600 text-xs">Porcentaje</p>
                    <p className="text-blue-400 font-bold text-lg">{Math.round(pct)}%</p>
                  </div>

                  <div>
                    <p className="text-gray-600 text-xs">Tiempo</p>
                    <p className="text-gray-300 font-bold text-lg">
                      {submission.time_spent ? `${Math.round(submission.time_spent / 60)}m` : "—"}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-white">Examen enviado</h2>
                <p className="text-gray-500 text-sm mt-1">
                  Tu docente revisará tus respuestas
                </p>
              </>
            )}
          </div>

          {securityBlocked && (
            <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-red-300 font-semibold">Sesión de seguridad bloqueada</p>
              <p className="text-red-200/80 text-sm mt-1">
                {securityTerminateReason || "El intento fue marcado por el sistema de seguridad."}
              </p>
              {securitySessionId ? (
                <p className="text-red-200/60 text-xs mt-2">Session ID: {securitySessionId}</p>
              ) : null}
            </div>
          )}

          {showRes && (
            <div className="space-y-3">
              <h3 className="text-gray-400 text-xs font-semibold tracking-widest">
                REVISIÓN DETALLADA
              </h3>

              {qs.map((item: any, i: number) => {
                const g = graded[i] || {}
                const isDev = item.type === "development"
                const isTF = item.type === "true_false"
                const baseCorrect = g.isCorrect === true

                const tfSelectionPoints = Number(g.selectionPoints ?? item.selectionPoints ?? 1) || 1
                const tfJustificationScore = Math.max(0, Number(g.justificationScore) || 0)
                const tfJustificationMax = Math.max(
                  0,
                  Number(g.justificationMaxPoints ?? item.justificationMaxPoints ?? 0) || 0
                )
                const tfEarned = (baseCorrect ? tfSelectionPoints : 0) + tfJustificationScore
                const tfTotal = tfSelectionPoints + tfJustificationMax
                const tfFull = isTF && tfTotal > 0 && tfEarned >= tfTotal
                const tfPartial = isTF && tfEarned > 0 && tfEarned < tfTotal

                const reviewState = isDev
                  ? "dev"
                  : isTF
                    ? tfFull
                      ? "full"
                      : tfPartial
                        ? "partial"
                        : "wrong"
                    : baseCorrect
                      ? "full"
                      : "wrong"

                return (
                  <div
                    key={i}
                    className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Pregunta {i + 1}</p>
                        <div className="text-white text-sm leading-relaxed">
                          <ExamMathText text={item.question || item.statement || ""} />
                        </div>
                      </div>

                      <span
                        className={`text-[11px] px-2 py-1 rounded-full font-semibold ${
                          reviewState === "full"
                            ? "bg-green-500/15 text-green-300"
                            : reviewState === "partial"
                              ? "bg-yellow-500/15 text-yellow-300"
                              : reviewState === "dev"
                                ? "bg-blue-500/15 text-blue-300"
                                : "bg-red-500/15 text-red-300"
                        }`}
                      >
                        {reviewState === "full"
                          ? "Correcta"
                          : reviewState === "partial"
                            ? "Parcial"
                            : reviewState === "dev"
                              ? "Desarrollo"
                              : "Incorrecta"}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (!exam) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Cargando examen...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {phase === "exam" && exam?.id ? (
        <ExamSecurityExamBridge
          examId={exam.id}
          submissionId={submission?.id ?? null}
          studentName={name}
          studentCourse={course}
          studentRut={rut || null}
          currentQuestionIndex={curQ}
          timeLeft={timeLeft}
          enabled={!securityBlocked}
          isSubmitted={submittedForSecurity}
          onForceSubmit={() => doSubmit("forced")}
          onSecurityTerminate={(reason) => {
            setSecurityTerminateReason(reason || "Intento terminado por seguridad.")
            setSecurityBlocked(true)
          }}
          onSessionReady={({ sessionId }) => {
            setSecuritySessionId(sessionId)
          }}
        />
      ) : null}

      {showWarning && isKiosk ? (
        <KioskWarningOverlay
          onDismiss={() => {
            setShowWarning(false)
            requestFullscreen()
          }}
        />
      ) : null}

      <div className="max-w-5xl mx-auto px-4 py-6 exam-root exam-content">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold">{exam.title}</h1>
            <p className="text-gray-400 text-sm mt-1">{exam.topic || "Evaluación"}</p>
            {securitySessionId ? (
              <p className="text-gray-600 text-xs mt-2">
                Seguridad activa · sesión {securitySessionId}
              </p>
            ) : null}
            {kioskExamId ? (
              <p className="text-gray-600 text-xs mt-1">
                Kiosk exam id: {kioskExamId}
              </p>
            ) : null}
          </div>

          <div className="text-right">
            <p className="text-gray-500 text-xs">Tiempo restante</p>
            <p className="text-2xl font-bold text-blue-400">{fmt(timeLeft)}</p>
            <p className="text-gray-500 text-xs mt-1">
              {answeredCount}/{totalQ} respondidas
            </p>
            {isKiosk ? (
              <p className="text-gray-600 text-[11px] mt-1">
                Fullscreen: {isFullscreen ? "activo" : "inactivo"}
              </p>
            ) : null}
          </div>
        </div>

        {securityBlocked ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 mb-6">
            <p className="text-red-300 font-semibold">El examen fue detenido por seguridad.</p>
            <p className="text-red-200/80 text-sm mt-1">
              {securityTerminateReason || "Se detectó una política de riesgo alta."}
            </p>
          </div>
        ) : null}

        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5 md:p-6 exam-question">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs tracking-widest text-gray-500 font-semibold">
                PREGUNTA {curQ + 1} DE {totalQ}
              </p>
              <p className="text-xs text-gray-500">
                Puntaje: {getQuestionMaxPoints(q)} pts
              </p>
            </div>

            <div className="text-white text-base leading-relaxed mb-6">
              <ExamMathText text={q?.question || q?.statement || ""} />
            </div>

            {q?.type === "multiple_choice" && (
              <div className="space-y-3">
                {(q.options || []).map((option: string, i: number) => {
                  const active = mcAnswers[curQ] === i
                  return (
                    <button
                      key={i}
                      onClick={() =>
                        setMcAnswers((prev) => ({
                          ...prev,
                          [curQ]: i,
                        }))
                      }
                      className={`w-full text-left rounded-2xl px-4 py-3 border transition ${
                        active
                          ? "border-blue-500 bg-blue-500/10 text-white"
                          : "border-white/[0.08] bg-white/[0.03] text-gray-200 hover:border-blue-500/30"
                      }`}
                    >
                      {option}
                    </button>
                  )
                })}
              </div>
            )}

            {q?.type === "true_false" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {["Verdadero", "Falso"].map((label, i) => {
                    const active = mcAnswers[curQ] === i
                    return (
                      <button
                        key={label}
                        onClick={() =>
                          setMcAnswers((prev) => ({
                            ...prev,
                            [curQ]: i,
                          }))
                        }
                        className={`rounded-2xl px-4 py-3 border font-semibold transition ${
                          active
                            ? "border-blue-500 bg-blue-500/10 text-white"
                            : "border-white/[0.08] bg-white/[0.03] text-gray-200 hover:border-blue-500/30"
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>

                <div>
                  <label className="text-gray-400 text-xs font-semibold block mb-2">
                    Justificación
                  </label>
                  <textarea
                    value={tfJustifications[curQ] || ""}
                    onChange={(e) =>
                      setTfJustifications((prev) => ({
                        ...prev,
                        [curQ]: e.target.value,
                      }))
                    }
                    className="w-full min-h-[120px] rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-gray-200 text-sm focus:outline-none focus:border-blue-500/30"
                    placeholder="Escribe tu justificación..."
                  />
                </div>
              </div>
            )}

            {q?.type === "development" && (
              <div>
                <label className="text-gray-400 text-xs font-semibold block mb-2">
                  Respuesta de desarrollo
                </label>
                <textarea
                  value={devAnswers[curQ] || ""}
                  onChange={(e) =>
                    setDevAnswers((prev) => ({
                      ...prev,
                      [curQ]: e.target.value,
                    }))
                  }
                  className="w-full min-h-[220px] rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-gray-200 text-sm focus:outline-none focus:border-blue-500/30"
                  placeholder="Escribe tu respuesta..."
                />
              </div>
            )}
          </div>

          <aside className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5">
            <h3 className="text-sm font-bold text-white mb-4">Navegación</h3>

            <div className="grid grid-cols-5 gap-2 mb-6">
              {qs.map((_: any, i: number) => {
                const answered =
                  qs[i]?.type === "development"
                    ? Boolean(devAnswers[i]?.trim())
                    : qs[i]?.type === "true_false"
                      ? mcAnswers[i] !== undefined || Boolean(tfJustifications[i]?.trim())
                      : mcAnswers[i] !== undefined

                return (
                  <button
                    key={i}
                    onClick={() => setCurQ(i)}
                    className={`h-10 rounded-xl text-sm font-bold border transition ${
                      curQ === i
                        ? "border-blue-500 bg-blue-500/15 text-blue-300"
                        : answered
                          ? "border-green-500/30 bg-green-500/10 text-green-300"
                          : "border-white/[0.08] bg-white/[0.03] text-gray-300"
                    }`}
                  >
                    {i + 1}
                  </button>
                )
              })}
            </div>

            <div className="space-y-3">
              <button
                onClick={() => setCurQ((prev) => Math.max(0, prev - 1))}
                disabled={curQ === 0}
                className="w-full py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-white disabled:opacity-30"
              >
                Anterior
              </button>

              <button
                onClick={() => setCurQ((prev) => Math.min(totalQ - 1, prev + 1))}
                disabled={curQ === totalQ - 1}
                className="w-full py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-white disabled:opacity-30"
              >
                Siguiente
              </button>

              <button
                onClick={() => void doSubmit("manual")}
                className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
              >
                Enviar examen
              </button>
            </div>

            <div className="mt-6 text-xs text-gray-500">
              <p>
                Alumno: <span className="text-gray-300">{name || "—"}</span>
              </p>
              <p className="mt-1">
                Curso: <span className="text-gray-300">{course || "—"}</span>
              </p>
              <p className="mt-1">
                RUT: <span className="text-gray-300">{rut || "—"}</span>
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
