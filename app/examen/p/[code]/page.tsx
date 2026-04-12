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


// ── Cursos indexados ─────────────────────────────────────────────────────────
const CURSOS_BASICA = [
  "1° Básico A","1° Básico B","2° Básico A","2° Básico B",
  "3° Básico A","3° Básico B","4° Básico A","4° Básico B",
  "5° Básico A","5° Básico B","6° Básico A","6° Básico B",
  "7° Básico A","7° Básico B","8° Básico A","8° Básico B",
]
const CURSOS_MEDIA = [
  "1° Medio A","1° Medio B","2° Medio A","2° Medio B",
  "3° Medio A","3° Medio B","4° Medio A","4° Medio B",
]
const TODOS_LOS_CURSOS = [...CURSOS_BASICA, ...CURSOS_MEDIA]

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
        <h2 className="text-main text-xl font-bold mb-3">Examen en progreso</h2>
        <p className="text-sub text-sm mb-6">
          No puedes salir del examen. La pantalla completa es obligatoria durante la evaluación.
          Solo el docente o el tiempo pueden cerrar este examen.
        </p>
        <button
          onClick={onDismiss}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-main text-sm font-bold rounded-xl w-full"
        >
          Volver al examen
        </button>
      </div>
    </div>
  )
}


// ── Freeze countdown display ──────────────────────────────────────────────────
function FreezeCountdown({ until }: { until: number }) {
  const [secs, setSecs] = useState(Math.max(0, Math.ceil((until - Date.now()) / 1000)))
  useEffect(() => {
    const t = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((until - Date.now()) / 1000))
      setSecs(remaining)
      if (remaining <= 0) clearInterval(t)
    }, 500)
    return () => clearInterval(t)
  }, [until])
  return <p className="text-5xl font-black tabular-nums">{secs}s</p>
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
  const [frozenUntil, setFrozenUntil] = useState<number>(0)
  const [frozenMsg, setFrozenMsg] = useState("")
  const frozenRef = useRef(false)

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
    if (document.fullscreenElement) return
    const el = document.documentElement
    ;(el.requestFullscreen({ navigationUI: "hide" } as any) as Promise<void>)
      .catch(() => el.requestFullscreen().catch(() => {}))
  }, [])

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

  // ── Estado fullscreen + bloqueo por incidentes ────────────────────────────
  useEffect(() => {
    const triggerFreeze = (seconds: number, msg: string) => {
      if (frozenRef.current) return
      frozenRef.current = true
      const until = Date.now() + seconds * 1000
      setFrozenUntil(until)
      setFrozenMsg(msg)
      // Re-enter fullscreen during freeze
      requestFullscreen()
      setTimeout(() => { if (!document.fullscreenElement) requestFullscreen() }, 200)
      // Unfreeze when timer ends
      setTimeout(() => {
        frozenRef.current = false
        setFrozenUntil(0)
        setFrozenMsg("")
        requestFullscreen()
      }, seconds * 1000)
    }

    const onFs = () => {
      const current = !!document.fullscreenElement
      setIsFullscreen(current)

      if (phase === "exam" && !current) {
        // Immediate re-entry attempts
        requestFullscreen()
        setTimeout(() => { if (!document.fullscreenElement) requestFullscreen() }, 100)
        setTimeout(() => { if (!document.fullscreenElement) requestFullscreen() }, 400)
        setTimeout(() => { if (!document.fullscreenElement) requestFullscreen() }, 1000)
        // Freeze for incident
        if (!fullscreenGuard.current) {
          fullscreenGuard.current = true
          triggerFreeze(15, "Saliste de pantalla completa. El examen está bloqueado 15 segundos.")
          setTimeout(() => { fullscreenGuard.current = false }, 16000)
        }
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (phase !== "exam") return
      // Hard block ESC, F11 and all function keys during exam
      const blocked = e.key === "Escape" || e.key === "F11" ||
        (e.key.startsWith("F") && !isNaN(Number(e.key.slice(1)))) ||
        (e.ctrlKey && ["w","t","n","r"].includes(e.key.toLowerCase())) ||
        (e.altKey && ["F4","Tab"].includes(e.key)) ||
        e.key === "PrintScreen"

      if (blocked) {
        e.preventDefault()
        e.stopImmediatePropagation()
        if (!document.fullscreenElement) requestFullscreen()
        if (e.key === "Escape" && !document.fullscreenElement) {
          triggerFreeze(10, "Intento de salir del examen bloqueado. Espera 10 segundos.")
        }
      }
    }

    const onMouseMove = (e: MouseEvent) => {
      if (phase !== "exam") return
      if (e.clientY < 5) {
        document.documentElement.style.cursor = "none"
        if (!document.fullscreenElement) requestFullscreen()
      } else if (e.clientY > 20) {
        document.documentElement.style.cursor = ""
      }
    }

    document.addEventListener("fullscreenchange", onFs)
    document.addEventListener("keydown", onKeyDown, { capture: true })
    document.addEventListener("mousemove", onMouseMove, { capture: true })
    return () => {
      document.removeEventListener("fullscreenchange", onFs)
      document.removeEventListener("keydown", onKeyDown, true)
      document.removeEventListener("mousemove", onMouseMove, true)
      document.documentElement.style.cursor = ""
    }
  }, [phase, requestFullscreen])

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
    // Always request fullscreen when exam starts
    setTimeout(() => requestFullscreen(), 200)

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

  // ── Controles kiosk — bloqueo completo de teclado/clipboard ─────────────
  // Restaurado del sistema antiguo: bloquea Escape, F11, F12, Ctrl+W, Alt+F4,
  // copiar/pegar/cortar, menú contextual, beforeunload y más teclas peligrosas.
  useEffect(() => {
    if (!isKiosk) return

    function killKey(e: KeyboardEvent) {
      const key   = e.key
      const ctrl  = e.ctrlKey
      const alt   = e.altKey
      const shift = e.shiftKey
      const meta  = e.metaKey

      const blocked =
        key === "Escape"   || key === "F11"   || key === "F12"  ||
        key === "Meta"     || meta             ||
        key === "PrintScreen" || key === "F5" || key === "F6"   ||
        (alt   && key === "F4")  ||
        (ctrl  && (key === "w" || key === "W"))   ||
        (ctrl  && key === "F4")  ||
        (ctrl  && (key === "Tab" || key === "t" || key === "T")) ||
        (ctrl  && alt  && key === "Tab")          ||
        (ctrl  && (key === "n" || key === "N"))   ||
        (ctrl  && shift && (key === "n" || key === "N")) ||
        (ctrl  && shift && (key === "j" || key === "J")) ||
        (ctrl  && shift && (key === "i" || key === "I")) ||
        (ctrl  && shift && (key === "c" || key === "C")) ||
        (ctrl  && (key === "l" || key === "L"))   ||
        (ctrl  && (key === "r" || key === "R"))   ||
        (ctrl  && (key === "c" || key === "C"))   ||
        (ctrl  && (key === "v" || key === "V"))   ||
        (ctrl  && (key === "x" || key === "X"))   ||
        (ctrl  && (key === "a" || key === "A"))

      if (blocked) {
        e.preventDefault()
        e.stopImmediatePropagation()
      }
    }

    function killKeyUp(e: KeyboardEvent) {
      if (
        e.key === "Escape" || e.key === "F11" ||
        e.key === "Meta"   || e.key === "PrintScreen"
      ) {
        e.preventDefault()
        e.stopImmediatePropagation()
      }
    }

    function killClipboard(e: ClipboardEvent) {
      e.preventDefault()
      e.stopImmediatePropagation()
    }

    function onContextMenu(e: MouseEvent) {
      e.preventDefault()
      e.stopImmediatePropagation()
    }

    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = "El examen está en progreso."
    }

    // Usar capture:true para interceptar antes que el navegador
    document.addEventListener("keydown",     killKey,       true)
    document.addEventListener("keyup",       killKeyUp,     true)
    document.addEventListener("copy",        killClipboard, true)
    document.addEventListener("cut",         killClipboard, true)
    document.addEventListener("paste",       killClipboard, true)
    document.addEventListener("contextmenu", onContextMenu, true)
    window.addEventListener("beforeunload",  onBeforeUnload)

    return () => {
      document.removeEventListener("keydown",     killKey,       true)
      document.removeEventListener("keyup",       killKeyUp,     true)
      document.removeEventListener("copy",        killClipboard, true)
      document.removeEventListener("cut",         killClipboard, true)
      document.removeEventListener("paste",       killClipboard, true)
      document.removeEventListener("contextmenu", onContextMenu, true)
      window.removeEventListener("beforeunload",  onBeforeUnload)
    }
  }, [isKiosk])

  // ── Cierre remoto kiosk — Realtime + polling de respaldo ────────────────
  // Restaurado del sistema antiguo: Supabase Realtime para cierre instantáneo
  // via cerrar_ahora/estado, con polling cada 6s como fallback.
  useEffect(() => {
    if (!isKiosk || !kioskSala || !code) return

    const panelClient = getPanelClient()
    if (!panelClient) {
      console.warn("[KIOSK] Sin credenciales del panel Supabase — el cierre remoto no funcionará")
      return
    }

    async function obtenerExamId() {
      const { data } = await panelClient!
        .from("examenes_kiosk")
        .select("id, cerrar_ahora, estado")
        .eq("sala", kioskSala)
        .eq("exam_code", code)
        .eq("estado", "activo")
        .limit(1)

      if (data && data.length > 0) {
        setKioskExamId(data[0].id)
        // Cierre ya marcado antes de conectar
        if (data[0].cerrar_ahora === true || data[0].estado === "cerrado") {
          handleKioskClose()
          return null
        }
        return data[0].id
      }
      return null
    }

    obtenerExamId().then((id) => {
      if (!id) return

      // Suscripción Realtime — cierre instantáneo
      const canal = panelClient!
        .channel(`exam_kiosk_${id}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "examenes_kiosk", filter: `id=eq.${id}` },
          (payload: any) => {
            const row = payload.new
            if (row.cerrar_ahora === true || row.estado === "cerrado") {
              console.log("[KIOSK] Cierre recibido vía Realtime")
              handleKioskClose()
            }
          }
        )
        .subscribe()

      realtimeRef.current = canal

      // Polling de respaldo cada 6 s (si Realtime falla)
      panelPollRef.current = setInterval(async () => {
        try {
          const { data: rows } = await panelClient!
            .from("examenes_kiosk")
            .select("cerrar_ahora, estado")
            .eq("id", id)
            .limit(1)

          if (!rows || rows.length === 0 || rows[0].cerrar_ahora === true || rows[0].estado === "cerrado") {
            handleKioskClose()
          }
        } catch {}
      }, 6000)
    })

    return () => {
      if (panelPollRef.current) clearInterval(panelPollRef.current)
      if (realtimeRef.current) panelClient.removeChannel(realtimeRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isKiosk, kioskSala, code])

  function handleKioskClose() {
    if (panelPollRef.current) clearInterval(panelPollRef.current)
    if (realtimeRef.current) {
      const panelClient = getPanelClient()
      if (panelClient) panelClient.removeChannel(realtimeRef.current)
    }
    if (timerRef.current) clearInterval(timerRef.current)
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }
    setPhase("kiosk_closed")
  }

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
      <div className="min-h-screen bg-app text-main flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-4xl mb-3">🧠</div>
          <p className="text-sub">Cargando examen...</p>
        </div>
      </div>
    )
  }

  if (phase === "error") {
    return (
      <div className="min-h-screen bg-app text-main flex items-center justify-center px-6">
        <div className="max-w-md w-full bg-card-soft-theme border border-soft rounded-2xl p-6 text-center">
          <div className="text-5xl mb-3">⚠️</div>
          <h2 className="text-2xl font-bold mb-2">Error</h2>
          <p className="text-sub text-sm">{errorMsg || "Ha ocurrido un problema."}</p>
        </div>
      </div>
    )
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
    )
  }

  if (phase === "kiosk_entry") {
    const totalPts = (exam?.questions || []).reduce(
      (acc: number, item: any) => acc + getQuestionMaxPoints(item),
      0
    )

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
              <p className="text-blue-400 text-sm mt-2">Sala kiosk: {kioskSala}</p>
            ) : null}
          </div>

          <div
            className="flex justify-center gap-0 mb-10 rounded-2xl overflow-hidden"
            style={{
              border: "1px solid var(--border-soft)",
              background: "var(--bg-card-soft)",
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
                    i < arr.length - 1 ? "1px solid var(--border-soft)" : "none",
                }}
              >
                <p className="text-main font-bold text-3xl">{stat.value}</p>
                <p className="text-muted2 text-xs mt-1">{stat.label}</p>
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

          <p className="text-muted2 text-xs mt-5 leading-relaxed text-center">
            Haz clic para comenzar. La pantalla se pondrá en modo completo automáticamente.
          </p>
        </div>
      </div>
    )
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
                  {CURSOS_BASICA.map(c => <option key={c} value={c}>{c}</option>)}
                </optgroup>
                <optgroup label="Enseñanza Media">
                  {CURSOS_MEDIA.map(c => <option key={c} value={c}>{c}</option>)}
                </optgroup>
              </select>
            </div>

            <div>
              <label className="text-sub text-xs font-semibold block mb-1">
                RUT (opcional)
              </label>
              <input
                value={rut}
                onChange={(e) => setRut(e.target.value)}
                placeholder="12.345.678-9"
                className="w-full bg-card-soft-theme border border-soft rounded-2xl px-4 py-3 text-main text-sm focus:outline-none focus:border-blue-500/30"
              />
            </div>
          </div>

          {/* ⚠️ Advertencia monitoreo IA */}
          <div className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-50 px-4 py-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">🔒</span>
              <p className="text-sm font-bold text-amber-800">Advertencia de monitoreo académico</p>
            </div>
            <ul className="text-xs text-amber-700 space-y-1 pl-6 list-disc leading-relaxed">
              <li>Este examen está bajo <strong>monitoreo de integridad académica</strong>.</li>
              <li>Queda <strong>estrictamente prohibido</strong> el uso de inteligencia artificial, buscadores, traductores o cualquier herramienta de apoyo externo.</li>
              <li>Cualquier intento de copiar, salir de la pantalla o usar otras aplicaciones <strong>será registrado y notificado al docente</strong>.</li>
              <li>Al iniciar confirmas que realizarás esta evaluación <strong>de forma honesta e individual</strong>.</li>
            </ul>
            <p className="text-[11px] text-amber-600 pt-1 border-t border-amber-200">
              Sistema de supervisión: EduAI Exam Security · Colegio Providencia
            </p>
          </div>

          <button
            onClick={startExam}
            disabled={!name.trim() || !course.trim()}
            className="w-full mt-4 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm disabled:opacity-30 transition-all"
          >
            Entiendo y acepto — Iniciar examen →
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
      <div className="min-h-screen bg-app px-4 py-6">
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
                <h2 className="text-3xl font-extrabold text-main">Nota: {nota}</h2>
                <p className="text-muted2 text-sm mt-1">
                  {nota >= 5.5
                    ? "¡Excelente trabajo!"
                    : nota >= 4.0
                      ? "Aprobado. Sigue practicando."
                      : "Repasa el material."}
                </p>

                <div className="flex justify-center gap-6 mt-3">
                  <div>
                    <p className="text-muted2 text-xs">Puntaje</p>
                    <p className="text-blue-400 font-bold text-lg">
                      {submission.correct_count}/{examTotalPoints > 0 ? examTotalPoints : 0} pts
                    </p>
                  </div>

                  <div>
                    <p className="text-muted2 text-xs">Porcentaje</p>
                    <p className="text-blue-400 font-bold text-lg">{Math.round(pct)}%</p>
                  </div>

                  <div>
                    <p className="text-muted2 text-xs">Tiempo</p>
                    <p className="text-sub font-bold text-lg">
                      {submission.time_spent ? `${Math.round(submission.time_spent / 60)}m` : "—"}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-main">Examen enviado</h2>
                <p className="text-muted2 text-sm mt-1">
                  Tu docente revisará tus respuestas
                </p>
              </>
            )}
          </div>

          {securityBlocked && (
            <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-red-700 font-semibold">Sesión de seguridad bloqueada</p>
              <p className="text-red-700/80 text-sm mt-1">
                {securityTerminateReason || "El intento fue marcado por el sistema de seguridad."}
              </p>
              {securitySessionId ? (
                <p className="text-red-700/60 text-xs mt-2">Session ID: {securitySessionId}</p>
              ) : null}
            </div>
          )}

          {showRes && (
            <div className="space-y-3">
              <h3 className="text-sub text-xs font-semibold tracking-widest">
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
                    className="rounded-2xl border border-medium bg-card-soft-theme p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-muted2 mb-1">Pregunta {i + 1}</p>
                        <div className="text-main text-sm leading-relaxed">
                          <ExamMathText text={item.question || item.statement || ""} />
                        </div>
                      </div>

                      <span
                        className={`text-[11px] px-2 py-1 rounded-full font-semibold ${
                          reviewState === "full"
                            ? "bg-green-500/15 text-green-700"
                            : reviewState === "partial"
                              ? "bg-yellow-500/15 text-yellow-700"
                              : reviewState === "dev"
                                ? "bg-blue-500/15 text-blue-700"
                                : "bg-red-500/15 text-red-700"
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
      <div className="min-h-screen bg-app text-main flex items-center justify-center">
        <p className="text-sub">Cargando examen...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-app text-main">
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
            <p className="text-sub text-sm mt-1">{exam.topic || "Evaluación"}</p>
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

          <div className="text-right">
            <p className="text-muted2 text-xs">Tiempo restante</p>
            <p className="text-2xl font-bold text-blue-400">{fmt(timeLeft)}</p>
            <p className="text-muted2 text-xs mt-1">
              {answeredCount}/{totalQ} respondidas
            </p>
            {isKiosk ? (
              <p className="text-muted2 text-[11px] mt-1">
                Fullscreen: {isFullscreen ? "activo" : "inactivo"}
              </p>
            ) : null}
          </div>
        </div>

        {securityBlocked ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 mb-6">
            <p className="text-red-700 font-semibold">El examen fue detenido por seguridad.</p>
            <p className="text-red-700/80 text-sm mt-1">
              {securityTerminateReason || "Se detectó una política de riesgo alta."}
            </p>
          </div>
        ) : null}

        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          <div className="rounded-2xl border border-medium bg-card-soft-theme p-5 md:p-6 exam-question">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs tracking-widest text-muted2 font-semibold">
                PREGUNTA {curQ + 1} DE {totalQ}
              </p>
              <p className="text-xs text-muted2">
                Puntaje: {getQuestionMaxPoints(q)} pts
              </p>
            </div>

            <div className="text-main text-base leading-relaxed mb-6">
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
                          ? "border-blue-500 bg-blue-500/10 text-main"
                          : "border-medium bg-card-soft-theme text-main hover:border-blue-500/30"
                      }`}
                    >
                      <ExamMathText text={option} className="inline" />
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
                            ? "border-blue-500 bg-blue-500/10 text-main"
                            : "border-medium bg-card-soft-theme text-main hover:border-blue-500/30"
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>

                <div>
                  <label className="text-sub text-xs font-semibold block mb-2">
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
                    className="w-full min-h-[120px] rounded-2xl border border-medium bg-card-soft-theme px-4 py-3 text-main text-sm focus:outline-none focus:border-blue-500/30"
                    placeholder="Escribe tu justificación..."
                  />
                </div>
              </div>
            )}

            {q?.type === "development" && (
              <div>
                <label className="text-sub text-xs font-semibold block mb-2">
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
                  className="w-full min-h-[220px] rounded-2xl border border-medium bg-card-soft-theme px-4 py-3 text-main text-sm focus:outline-none focus:border-blue-500/30"
                  placeholder="Escribe tu respuesta..."
                />
              </div>
            )}
          </div>

          <aside className="rounded-2xl border border-medium bg-card-soft-theme p-5">
            <h3 className="text-sm font-bold text-main mb-4">Navegación</h3>

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
                        ? "border-blue-500 bg-blue-500/15 text-blue-700"
                        : answered
                          ? "border-green-500/30 bg-green-500/10 text-green-700"
                          : "border-medium bg-card-soft-theme text-sub"
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
                className="w-full py-3 rounded-2xl bg-card-soft-theme border border-soft text-main disabled:opacity-30"
              >
                Anterior
              </button>

              <button
                onClick={() => setCurQ((prev) => Math.min(totalQ - 1, prev + 1))}
                disabled={curQ === totalQ - 1}
                className="w-full py-3 rounded-2xl bg-card-soft-theme border border-soft text-main disabled:opacity-30"
              >
                Siguiente
              </button>

              <button
                onClick={() => void doSubmit("manual")}
                className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-main font-bold"
              >
                Enviar examen
              </button>
            </div>

            <div className="mt-6 text-xs text-muted2">
              <p>
                Alumno: <span className="text-sub">{name || "—"}</span>
              </p>
              <p className="mt-1">
                Curso: <span className="text-sub">{course || "—"}</span>
              </p>
              <p className="mt-1">
                RUT: <span className="text-sub">{rut || "—"}</span>
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
