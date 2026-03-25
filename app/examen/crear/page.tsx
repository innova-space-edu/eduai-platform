// app/examen/p/[code]/page.tsx
// VERSIÓN CON MODO KIOSK + SISTEMA DE SEGURIDAD INTEGRADO
"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import dynamic from "next/dynamic"
import { ExamGuard, type GuardState } from "@/lib/exam-guard"

// Import dinámico — KaTeX (~400KB) solo se carga cuando el usuario
// llega al paso de vista previa, no al abrir la página
const ExamMathText = dynamic(() => import("@/components/ui/ExamMathText"), {
  ssr: false,
  loading: () => <span className="text-gray-400 text-sm">...</span>,
})

// ── Supabase del PANEL DE CONTROL (para leer examenes_kiosk) ─────────────────
// Estas vars deben estar en el .env.local de EduAI Platform:
//   NEXT_PUBLIC_PANEL_SUPABASE_URL=https://iiuglkpkkfrjazewuknt.supabase.co
//   NEXT_PUBLIC_PANEL_SUPABASE_ANON_KEY=tu_anon_key_del_panel
const PANEL_URL = process.env.NEXT_PUBLIC_PANEL_SUPABASE_URL || ""
const PANEL_KEY = process.env.NEXT_PUBLIC_PANEL_SUPABASE_ANON_KEY || ""

function getPanelClient() {
  if (!PANEL_URL || !PANEL_KEY) return null
  return createClient(PANEL_URL, PANEL_KEY)
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function calcGrade(s: number, e = 60) {
  const p = Math.max(0, Math.min(100, s))
  return Math.round((p >= e ? 4 + ((p - e) * 3) / (100 - e) : 1 + (p * 3) / e) * 10) / 10
}

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`
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

type Phase = "loading" | "kiosk_entry" | "register" | "exam" | "submitting" | "review" | "error" | "kiosk_closed"

// ── OVERLAY DE SEGURIDAD — con temporizador de bloqueo ───────────────────────
function SecurityOverlay({
  incidentCount, sanctionLevel, blockSecsLeft, lastEventType, isFlagged, onDismiss,
}: {
  incidentCount:  number
  sanctionLevel:  "warning" | "block_15" | "block_30" | "block_60" | null
  blockSecsLeft:  number
  lastEventType:  string | null
  isFlagged:      boolean
  onDismiss:      () => void
}) {
  const isBlocked = blockSecsLeft > 0

  const EVENT_LABELS: Record<string, string> = {
    fullscreen_exit:      "Salida de pantalla completa",
    window_blur:          "Pérdida de foco de ventana",
    tab_hidden:           "Cambio de pestaña",
    copy_attempt:         "Intento de copiar",
    paste_attempt:        "Intento de pegar",
    cut_attempt:          "Intento de cortar",
    contextmenu_attempt:  "Menú contextual",
    blocked_shortcut:     "Tecla bloqueada",
    print_attempt:        "Intento de imprimir",
    reload_attempt:       "Intento de recargar",
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black/97 flex items-center justify-center backdrop-blur-sm">
      <div className="text-center max-w-sm px-6 py-8 rounded-2xl border"
           style={{ background: isBlocked ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)",
                    borderColor: isBlocked ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)" }}>

        <div className="text-5xl mb-4">{isBlocked ? "🚫" : "⚠️"}</div>

        <h2 className="text-white text-lg font-bold mb-2">
          {isBlocked ? "Examen bloqueado temporalmente" : "Advertencia"}
        </h2>

        {lastEventType && (
          <p className="text-xs font-semibold mb-3 px-3 py-1.5 rounded-full inline-block"
             style={{ background: isBlocked ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
                      color: isBlocked ? "#f87171" : "#fbbf24" }}>
            {EVENT_LABELS[lastEventType] || lastEventType}
          </p>
        )}

        <p className="text-gray-300 text-sm mb-2 leading-relaxed">
          {isBlocked
            ? "Se detectó una conducta no permitida. El incidente fue registrado y reportado al docente."
            : "Se detectó una salida del examen o uso de herramientas externas. Este incidente fue registrado."}
        </p>

        <p className="text-gray-500 text-xs mb-5">
          Incidente #{incidentCount} de esta sesión.
          {isFlagged && <span className="text-red-400 font-semibold"> ⚑ Examen marcado para revisión.</span>}
        </p>

        {isBlocked ? (
          <div>
            <div className="w-16 h-16 rounded-full border-4 flex items-center justify-center mx-auto mb-4"
                 style={{ borderColor: "rgba(239,68,68,0.4)" }}>
              <span className="text-red-400 text-xl font-bold tabular-nums">{blockSecsLeft}</span>
            </div>
            <p className="text-gray-500 text-xs">Podrás continuar en {blockSecsLeft} {blockSecsLeft === 1 ? "segundo" : "segundos"}.</p>
          </div>
        ) : (
          <button onClick={onDismiss}
            className="px-6 py-3 rounded-xl text-white text-sm font-bold w-full transition-all"
            style={{ background: "rgba(245,158,11,0.2)", border: "1px solid rgba(245,158,11,0.4)" }}>
            Entendido — Volver al examen
          </button>
        )}
      </div>
    </div>
  )
}

// ── PANTALLA DE ENTRADA AL MODO SEGURO (sin kiosk app) ───────────────────────
// ── OVERLAY DE ADVERTENCIA KIOSK (mantener para compatibilidad) ──────────────
function KioskWarningOverlay({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center">
      <div className="text-center max-w-sm px-6">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-white text-xl font-bold mb-3">Examen en progreso</h2>
        <p className="text-gray-400 text-sm mb-6">
          No puedes salir del examen. La pantalla completa es obligatoria
          durante la evaluación. Solo el docente o el tiempo pueden cerrar este examen.
        </p>
        <button onClick={onDismiss}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl w-full">
          Volver al examen
        </button>
      </div>
    </div>
  )
}

// ── COMPONENTE PRINCIPAL ───────────────────────────────────────────────────────
export default function ExamenPublicoPage() {
  const { code } = useParams() as { code: string }

  const [phase, setPhase]     = useState<Phase>("loading")
  const [exam, setExam]       = useState<any>(null)
  const [errorMsg, setErrorMsg] = useState("")

  const [name, setName]     = useState("")
  const [course, setCourse] = useState("")
  const [rut, setRut]       = useState("")

  const [curQ, setCurQ]         = useState(0)
  const [mcAnswers, setMcAnswers] = useState<Record<number, number>>({})
  const [devAnswers, setDevAnswers] = useState<Record<number, string>>({})
  const [tfJustifications, setTfJustifications] = useState<Record<number, string>>({})
  const [timeLeft, setTimeLeft]   = useState(0)
  const [submission, setSubmission] = useState<any>(null)

  // ── Estado kiosk ─────────────────────────────────────────────────────────────
  const [isKiosk, setIsKiosk]       = useState(false)
  const [kioskSala, setKioskSala]   = useState("")
  const [kioskExamId, setKioskExamId] = useState<string | null>(null)
  const [showWarning, setShowWarning] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // ── Estado de seguridad (ExamGuard) ──────────────────────────────────────────
  const [guardState,      setGuardState]      = useState<GuardState | null>(null)
  const [blockSecsLeft,   setBlockSecsLeft]   = useState(0)
  const [securityMode,    setSecurityMode]    = useState(false)  // activado por exam.settings
  const [attemptId]                           = useState(() =>   // ID único del intento
    `${Date.now()}-${Math.random().toString(36).slice(2,8)}`)
  const guardRef      = useRef<ExamGuard | null>(null)
  const blockTimerRef = useRef<NodeJS.Timeout | null>(null)

  const timerRef        = useRef<NodeJS.Timeout | null>(null)
  const startRef        = useRef(0)
  const panelPollRef    = useRef<NodeJS.Timeout | null>(null)
  const realtimeRef     = useRef<any>(null)
  const fullscreenGuard = useRef(false) // evitar bucle de re-requests

  // ── Detectar parámetros kiosk en el cliente ────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("kiosk") === "1") {
      setIsKiosk(true)
      setKioskSala(params.get("sala") || "")
    }
  }, [])

  // ── Solicitar fullscreen (solo en kiosk) ──────────────────────────────────
  // ── requestFullscreen: intenta con y sin navigationUI ──────────────────────
  const requestFullscreen = useCallback(() => {
    if (!isKiosk) return
    if (document.fullscreenElement) return
    const el = document.documentElement
    ;(el.requestFullscreen({ navigationUI: "hide" } as any) as Promise<void>)
      .catch(() => el.requestFullscreen().catch(() => {}))
  }, [isKiosk])

  // ── Re-pedir fullscreen si la fase activa lo requiere ────────────────────
  useEffect(() => {
    if (!isKiosk) return
    if (phase === "exam" || phase === "register") {
      requestFullscreen()
    }
  }, [phase, isKiosk, requestFullscreen])

  // ── Bloquear salida de fullscreen — re-entrada agresiva ───────────────────
  useEffect(() => {
    if (!isKiosk) return

    function onFullscreenChange() {
      const inFS = !!document.fullscreenElement
      setIsFullscreen(inFS)

      if (!inFS && (phase === "exam" || phase === "register") && !fullscreenGuard.current) {
        fullscreenGuard.current = true
        setShowWarning(true)
        // Intento 1: inmediato (puede fallar sin gesto de usuario)
        requestFullscreen()
        // Intento 2: 800 ms después por si el primero falló
        setTimeout(() => { requestFullscreen() }, 800)
        // Intento 3: 2 s — cuando el alumno hace clic en "Volver al examen"
        setTimeout(() => { fullscreenGuard.current = false }, 2000)
      }
    }

    document.addEventListener("fullscreenchange", onFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange)
  }, [isKiosk, phase, requestFullscreen])

  // ── Bloquear teclas peligrosas en modo kiosk ──────────────────────────────
  useEffect(() => {
    if (!isKiosk) return

    function killKey(e: KeyboardEvent) {
      const key  = e.key
      const ctrl = e.ctrlKey
      const alt  = e.altKey
      const shift = e.shiftKey
      const meta = e.metaKey

      const blocked =
        // Salir de fullscreen / cerrar
        key === "Escape" ||
        key === "F11" ||
        (alt  && key === "F4") ||
        // Cerrar pestaña / ventana
        (ctrl && (key === "w" || key === "W")) ||
        (ctrl && (key === "F4")) ||
        // Cambiar pestaña
        (ctrl && (key === "Tab" || key === "t" || key === "T")) ||
        (ctrl && alt && (key === "Tab")) ||
        // Nueva ventana / incognito
        (ctrl && (key === "n" || key === "N")) ||
        (ctrl && shift && (key === "n" || key === "N")) ||
        // DevTools
        key === "F12" ||
        (ctrl && shift && (key === "j" || key === "J")) ||
        (ctrl && shift && (key === "i" || key === "I")) ||
        (ctrl && shift && (key === "c" || key === "C")) ||
        // Barra de direcciones
        (ctrl && (key === "l" || key === "L")) ||
        key === "F6" ||
        // Recargar
        key === "F5" ||
        (ctrl && (key === "r" || key === "R")) ||
        // Tecla Windows / Meta
        key === "Meta" ||
        meta ||
        // Copiar / Pegar / Cortar / Seleccionar todo
        (ctrl && (key === "c" || key === "C")) ||
        (ctrl && (key === "v" || key === "V")) ||
        (ctrl && (key === "x" || key === "X")) ||
        (ctrl && (key === "a" || key === "A")) ||
        // Captura de pantalla
        key === "PrintScreen"

      if (blocked) {
        e.preventDefault()
        e.stopImmediatePropagation()
      }
    }

    function killKeyUp(e: KeyboardEvent) {
      if (e.key === "Escape" || e.key === "F11" || e.key === "Meta" || e.key === "PrintScreen") {
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
      e.returnValue = "El examen esta en progreso."
    }

    // Captura en fase de captura (true) para interceptar antes que el browser
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

  // ── Detectar cambio de pestaña / pérdida de foco ──────────────────────────
  useEffect(() => {
    if (!isKiosk) return

    function onVisibilityChange() {
      if (!document.hidden) {
        // Volvió al tab → re-pedir fullscreen
        requestFullscreen()
      }
    }

    function onWindowBlur() {
      // Perdió foco (alt-tab, click en taskbar, etc.) → mostrar advertencia
      if (phase === "exam" || phase === "register") {
        setShowWarning(true)
        // Intentar volver al foco
        setTimeout(() => window.focus(), 200)
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange)
    window.addEventListener("blur", onWindowBlur)

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("blur", onWindowBlur)
    }
  }, [isKiosk, phase, requestFullscreen])

  // ── Polling al panel Supabase para detectar cierre del examen ─────────────
  useEffect(() => {
    if (!isKiosk || !kioskSala || !code) return

    const panelClient = getPanelClient()
    if (!panelClient) {
      console.warn("[KIOSK] Sin credenciales del panel Supabase — el cierre remoto no funcionará")
      return
    }

    // Primero: obtener el exam_id del examen activo para esta sala y código
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
        return data[0].id
      }
      return null
    }

    let examId: string | null = null

    obtenerExamId().then(id => {
      examId = id
      if (!id) return

      // Suscripción realtime para recibir cierre inmediato
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
            const row = payload.new
            if (row.cerrar_ahora === true || row.estado === "cerrado") {
              console.log("[KIOSK] Cierre recibido vía realtime")
              handleKioskClose()
            }
          }
        )
        .subscribe()

      realtimeRef.current = canal

      // Polling de respaldo cada 6 s (por si realtime falla)
      panelPollRef.current = setInterval(async () => {
        if (!examId) return
        const { data: rows } = await panelClient!
          .from("examenes_kiosk")
          .select("cerrar_ahora, estado")
          .eq("id", examId)
          .limit(1)

        if (!rows || rows.length === 0) {
          handleKioskClose()
          return
        }
        if (rows[0].cerrar_ahora === true || rows[0].estado === "cerrado") {
          handleKioskClose()
        }
      }, 6000)
    })

    return () => {
      if (panelPollRef.current) clearInterval(panelPollRef.current)
      if (realtimeRef.current) panelClient.removeChannel(realtimeRef.current)
    }
  }, [isKiosk, kioskSala, code])

  function handleKioskClose() {
    // Limpiar polling
    if (panelPollRef.current) clearInterval(panelPollRef.current)
    if (realtimeRef.current) {
      const panelClient = getPanelClient()
      if (panelClient) panelClient.removeChannel(realtimeRef.current)
    }

    // Limpiar timer del examen
    if (timerRef.current) clearInterval(timerRef.current)

    // Salir de fullscreen
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }

    setPhase("kiosk_closed")
  }

  // ── Cargar examen ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!code) return

    fetch(`/api/agents/examen-docente?code=${code}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) {
          setErrorMsg(d.error)
          setPhase("error")
          return
        }
        setExam(d.exam)
        setTimeLeft((d.exam.settings?.timeLimit || 30) * 60)

        // Detectar si el examen tiene modo seguro activado
        const secMode = !!d.exam.settings?.securityMode
        setSecurityMode(secMode)

        const urlParams = new URLSearchParams(window.location.search)
        if (urlParams.get("kiosk") === "1") {
          setPhase("kiosk_entry")
        } else {
          // En modo seguro o normal → siempre ir directo a register
          // El fullscreen se activa silenciosamente al hacer clic en "Iniciar examen"
          setPhase("register")
        }
      })
      .catch(() => {
        setErrorMsg("Error cargando examen")
        setPhase("error")
      })
  }, [code])

  // ── Timer del examen ──────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "exam") return

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          doSubmit()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [phase])

  const enterFullscreenAndRegister = () => {
    const el = document.documentElement
    el.requestFullscreen({ navigationUI: "hide" } as any).catch(err => {
      console.warn("[KIOSK] Fullscreen failed:", err)
    }).finally(() => {
      setPhase("register")
    })
  }

  // ── Entrada al modo seguro (sin kiosk app) ────────────────────────────────
  // ── Iniciar ExamGuard cuando empieza el examen ────────────────────────────
  const initGuard = (examId: string) => {
    if (!securityMode && !isKiosk) return

    const guard = new ExamGuard({
      examId,
      attemptId,
      submissionId:  null,
      studentName:   name,
      studentCourse: course,
      studentRut:    rut,
      getTimeLeft:   () => timeLeft,
      getCurrentQ:   () => curQ,
      securityMode:  true,
      onSanction: (state: GuardState) => {
        setGuardState({ ...state })
        const secs = Math.round((state.blockUntil - Date.now()) / 1000)
        if (secs > 0) {
          setBlockSecsLeft(secs)
          if (blockTimerRef.current) clearInterval(blockTimerRef.current)
          blockTimerRef.current = setInterval(() => {
            setBlockSecsLeft(prev => {
              if (prev <= 1) {
                clearInterval(blockTimerRef.current!)
                return 0
              }
              return prev - 1
            })
          }, 1000)
        }
      },
    })
    guard.start()
    guardRef.current = guard
  }

  const startExam = () => {
    if (!name.trim() || !course.trim()) return
    startRef.current = Date.now()

    const doStart = () => {
      setPhase("exam")
      if (isKiosk) setTimeout(requestFullscreen, 300)
      if (exam?.id) initGuard(exam.id)
    }

    // En modo seguro: activar fullscreen silenciosamente (el clic es el gesto válido)
    if (securityMode && !isKiosk) {
      document.documentElement
        .requestFullscreen({ navigationUI: "hide" } as any)
        .catch(() => {}) // Si el usuario rechaza fullscreen, continuar igual
        .finally(doStart)
    } else {
      doStart()
    }
  }

  const doSubmit = async () => {
    if (timerRef.current) clearInterval(timerRef.current)

    setPhase("submitting")

    const qs = exam.questions || []
    const ansArr = qs.map((q: any, i: number) => {
      if (q.type === "development") {
        return {
          devText: devAnswers[i] || "",
          selectedAnswer: -1,
        }
      }

      if (q.type === "true_false") {
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
          questions: qs,
          timeSpent: Math.round((Date.now() - startRef.current) / 1000),
          examPercentage: exam.settings?.examPercentage || 60,
        }),
      })

      const d = await res.json()
      if (!d.success) throw new Error(d.error)

      setSubmission(d.submission)

      // Vincular submissionId al guard para correlacionar incidentes pendientes
      if (guardRef.current && d.submission?.id) {
        guardRef.current.setSubmissionId(d.submission.id)
      }
      // Detener la guardia al terminar
      guardRef.current?.stop()

      setPhase("review")

      // En modo kiosk: salir de fullscreen al terminar el examen correctamente
      if ((isKiosk || securityMode) && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
    } catch (e: any) {
      setErrorMsg(e.message)
      setPhase("error")
    }
  }

  const qs = exam?.questions || []
  const q  = qs[curQ]
  const totalQ = qs.length

  const examTotalPoints = qs.reduce(
    (acc: number, item: any) => acc + getQuestionMaxPoints(item),
    0
  )

  const answeredCount = qs.filter((item: any, i: number) => {
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

  const showRes = exam?.settings?.showResultToStudent !== false

  // ── PANTALLAS ─────────────────────────────────────────────────────────────

  if (phase === "kiosk_entry" && exam) {
    const totalPts = (exam.questions || []).reduce(
      (acc: number, item: any) => acc + getQuestionMaxPoints(item), 0
    )
    return (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center cursor-pointer select-none"
        style={{ background: "radial-gradient(ellipse at 50% 40%, #0d1f3c 0%, #020408 65%)" }}
        onClick={enterFullscreenAndRegister}
      >
        {/* Decorative grid */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: "linear-gradient(#3b82f6 1px, transparent 1px), linear-gradient(90deg, #3b82f6 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />

        {/* Outer glow rings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <div className="w-[700px] h-[700px] rounded-full"
            style={{ border: "1px solid rgba(59,130,246,0.07)", animation: "kiosk-ping 4s ease-in-out infinite" }} />
          <div className="absolute w-[480px] h-[480px] rounded-full"
            style={{ border: "1px solid rgba(59,130,246,0.10)", animation: "kiosk-ping 4s ease-in-out infinite 1.3s" }} />
          <div className="absolute w-[300px] h-[300px] rounded-full"
            style={{ border: "1px solid rgba(59,130,246,0.13)", animation: "kiosk-ping 4s ease-in-out infinite 2.6s" }} />
        </div>

        <div className="relative z-10 text-center max-w-md px-8">
          {/* Icon */}
          <div
            className="w-28 h-28 rounded-[28px] flex items-center justify-center mx-auto mb-8"
            style={{
              background: "linear-gradient(135deg, rgba(29,78,216,0.25) 0%, rgba(59,130,246,0.10) 100%)",
              border: "1px solid rgba(59,130,246,0.25)",
              boxShadow: "0 0 80px rgba(59,130,246,0.18), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
          >
            <span style={{ fontSize: "52px", lineHeight: 1 }}>&#x1F4DD;</span>
          </div>

          {/* Sala badge */}
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-6"
            style={{
              background: "rgba(59,130,246,0.08)",
              border: "1px solid rgba(59,130,246,0.18)",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" style={{ animation: "pulse 2s ease-in-out infinite" }} />
            <span className="text-blue-400 text-xs font-bold tracking-[0.2em] uppercase">
              Sala: {kioskSala}
            </span>
          </div>

          {/* Title */}
          <h1 className="font-bold text-white mb-2 leading-tight" style={{ fontSize: "clamp(20px,3vw,32px)" }}>
            {exam.title}
          </h1>
          <p className="text-gray-500 text-sm mb-10">{exam.topic}</p>

          {/* Stats row */}
          <div
            className="flex justify-center gap-0 mb-10 rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.02)" }}
          >
            {[
              { value: exam.questions?.length ?? 0, label: "preguntas" },
              { value: exam.settings?.timeLimit ?? 30, label: "minutos" },
              { value: totalPts, label: "puntos" },
            ].map((stat, i, arr) => (
              <div
                key={i}
                className="flex-1 py-5"
                style={{ borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
              >
                <p className="text-white font-bold text-3xl">{stat.value}</p>
                <p className="text-gray-600 text-xs mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* CTA Button */}
          <button
            onClick={e => { e.stopPropagation(); enterFullscreenAndRegister() }}
            className="group relative w-full py-5 rounded-2xl text-white font-bold text-lg overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #1e40af 0%, #2563eb 50%, #3b82f6 100%)",
              boxShadow: "0 0 0 1px rgba(59,130,246,0.3), 0 8px 32px rgba(59,130,246,0.25), 0 2px 8px rgba(0,0,0,0.5)",
            }}
          >
            <span className="relative z-10 flex items-center justify-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
              </svg>
              Comenzar examen
            </span>
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.05), transparent)" }} />
          </button>

          <p className="text-gray-700 text-xs mt-5 leading-relaxed">
            Haz clic para comenzar. La pantalla se pondrá en modo completo automáticamente.
          </p>
        </div>

        <style>{`
          @keyframes kiosk-ping {
            0%   { transform: scale(1);    opacity: 1; }
            80%  { transform: scale(1.15); opacity: 0; }
            100% { transform: scale(1.15); opacity: 0; }
          }
        `}</style>
      </div>
    )
  }

  if (phase === "kiosk_closed") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto mb-5">
            <span className="text-4xl">⏹</span>
          </div>
          <h2 className="text-white text-xl font-bold mb-2">Examen finalizado</h2>
          <p className="text-gray-500 text-sm">
            El docente o administrador ha cerrado esta sesión de examen.
          </p>
          {!isKiosk && (
            <p className="text-gray-700 text-xs mt-3">Puedes cerrar esta ventana.</p>
          )}
        </div>
      </div>
    )
  }

  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-blue-400 animate-spin" />
      </div>
    )
  }

  if (phase === "error") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-4xl mb-3">❌</div>
          <h2 className="text-white font-bold text-lg mb-2">Examen no disponible</h2>
          <p className="text-gray-500 text-sm">{errorMsg}</p>
        </div>
      </div>
    )
  }

  if (phase === "submitting") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-white/10 border-t-green-400 animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Evaluando respuestas con IA...</p>
          <p className="text-gray-600 text-xs mt-1">Esto puede tomar unos segundos</p>
        </div>
      </div>
    )
  }

  if (phase === "register") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        {showWarning && (
          <KioskWarningOverlay onDismiss={() => { setShowWarning(false); requestFullscreen() }} />
        )}

        {/* Banner kiosk */}
        {isKiosk && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-blue-900/80 border-b border-blue-700/40 px-4 py-2 text-center">
            <p className="text-blue-300 text-xs font-semibold">
              🔒 MODO EXAMEN — Pantalla controlada · Sala: {kioskSala}
            </p>
          </div>
        )}

        <div className={`max-w-md w-full space-y-6 ${isKiosk ? "mt-10" : ""}`}>
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mx-auto mb-3">
              <span className="text-3xl">📝</span>
            </div>
            <h1 className="text-xl font-bold text-white">{exam?.title}</h1>
            <p className="text-gray-500 text-sm mt-1">{exam?.topic}</p>

            <div className="flex justify-center gap-4 mt-3 text-xs text-gray-500">
              <span>📋 {totalQ} preguntas</span>
              <span>⏱ {exam?.settings?.timeLimit || 30} min</span>
              <span>📊 {examTotalPoints} pts</span>
            </div>
          </div>

          {isKiosk && (
            <div className="bg-orange-500/[0.06] border border-orange-500/20 rounded-2xl p-4">
              <p className="text-orange-400 text-xs font-semibold mb-1">⚠ IMPORTANTE:</p>
              <p className="text-gray-400 text-xs">
                Este examen está en modo controlado. La pantalla completa es obligatoria y
                no puedes cambiar de ventana ni cerrar el navegador. Solo el docente puede
                finalizar la sesión anticipadamente.
              </p>
            </div>
          )}

          {exam?.instructions && (
            <div className="bg-blue-500/[0.06] border border-blue-500/20 rounded-2xl p-4">
              <p className="text-blue-400 text-xs font-semibold mb-1">INSTRUCCIONES:</p>
              <div className="text-gray-400 text-sm">
                <ExamMathText text={exam.instructions} className="inline" />
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-gray-400 text-xs font-semibold block mb-1">
                NOMBRE COMPLETO *
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Juan Pérez López"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 text-gray-200 text-sm focus:outline-none focus:border-blue-500/30"
              />
            </div>

            <div>
              <label className="text-gray-400 text-xs font-semibold block mb-1">
                CURSO *
              </label>
              <input
                value={course}
                onChange={e => setCourse(e.target.value)}
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
                onChange={e => setRut(e.target.value)}
                placeholder="12.345.678-9"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 text-gray-200 text-sm focus:outline-none focus:border-blue-500/30"
              />
            </div>
          </div>

          <button
            onClick={startExam}
            disabled={!name.trim() || !course.trim()}
            className="w-full py-3.5 rounded-2xl bg-blue-600/90 hover:bg-blue-500 text-white font-bold text-sm disabled:opacity-30"
          >
            Iniciar examen
          </button>
        </div>
      </div>
    )
  }

  if (phase === "review" && submission) {
    const nota = submission.grade
    const pct = submission.score
    const graded = submission.answers || []

    return (
      <div className="min-h-screen bg-gray-950 px-4 py-6">
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

                <div className="w-full bg-gray-800 rounded-full h-3 mt-4">
                  <div
                    className={`h-full rounded-full ${nota >= 4.0 ? "bg-green-500" : "bg-red-500"}`}
                    style={{ width: `${pct}%` }}
                  />
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

          {showRes && (
            <div className="space-y-3">
              <h3 className="text-gray-400 text-xs font-semibold tracking-widest">
                REVISIÓN DETALLADA
              </h3>

              {qs.map((q: any, i: number) => {
                const g = graded[i] || {}
                const isDev = q.type === "development"
                const isTF = q.type === "true_false"
                const baseCorrect = g.isCorrect === true

                const tfSelectionPoints =
                  Number(g.selectionPoints ?? q.selectionPoints ?? 1) || 1
                const tfJustificationScore = Math.max(0, Number(g.justificationScore) || 0)
                const tfJustificationMax = Math.max(
                  0,
                  Number(g.justificationMaxPoints ?? q.justificationMaxPoints ?? 0) || 0
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
                    className={`rounded-2xl p-4 border ${
                      reviewState === "dev"
                        ? "bg-orange-500/[0.03] border-orange-500/10"
                        : reviewState === "full"
                          ? "bg-green-500/[0.03] border-green-500/10"
                          : reviewState === "partial"
                            ? "bg-yellow-500/[0.03] border-yellow-500/10"
                            : "bg-red-500/[0.03] border-red-500/10"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`text-sm ${
                          reviewState === "dev"
                            ? "text-orange-400"
                            : reviewState === "full"
                              ? "text-green-400"
                              : reviewState === "partial"
                                ? "text-yellow-400"
                                : "text-red-400"
                        }`}
                      >
                        {reviewState === "dev"
                          ? "✍️"
                          : reviewState === "full"
                            ? "✅"
                            : reviewState === "partial"
                              ? "◑"
                              : "❌"}
                      </span>

                      <span className="text-gray-400 text-xs font-semibold">P{i + 1}</span>

                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          q.type === "multiple_choice"
                            ? "bg-blue-500/10 text-blue-400"
                            : isTF
                              ? "bg-green-500/10 text-green-400"
                              : "bg-orange-500/10 text-orange-400"
                        }`}
                      >
                        {q.type === "multiple_choice"
                          ? "Alternativas"
                          : isTF
                            ? "V/F"
                            : "Desarrollo"}
                      </span>

                      {g.aiScore !== undefined && (
                        <span className="text-[10px] text-blue-400 ml-auto">
                          {g.aiScore}/{g.aiMaxScore} pts (IA)
                        </span>
                      )}

                      {isTF && (
                        <span className="text-[10px] text-blue-400 ml-auto">
                          {tfEarned}/{tfTotal} pts
                        </span>
                      )}
                    </div>

                    <div className="text-gray-200 text-sm mb-3">
                      <ExamMathText text={q.question} className="inline" />
                    </div>

                    {q.type === "multiple_choice" && (
                      <div className="space-y-1 mb-3">
                        {(q.options || []).map((opt: string, j: number) => {
                          const isStudent = g.selectedAnswer === j
                          const isRight = j === q.correctAnswer

                          return (
                            <div
                              key={j}
                              className={`text-xs px-3 py-1.5 rounded-lg ${
                                isRight
                                  ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                  : isStudent
                                    ? "bg-red-500/10 text-red-400 border border-red-500/20 line-through"
                                    : "text-gray-600"
                              }`}
                            >
                              {String.fromCharCode(65 + j)}{" "}
                              <ExamMathText text={opt.replace(/^[A-Da-d][).]\s*/u, "")} className="inline" />{" "}
                              {isRight && "✓"} {isStudent && !isRight && "← tu respuesta"}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {isTF && (
                      <div className="space-y-2 mb-3">
                        <div className="flex gap-2">
                          {(q.options || ["Verdadero", "Falso"]).map((opt: string, j: number) => (
                            <div
                              key={j}
                              className={`text-xs px-3 py-1.5 rounded-lg flex-1 text-center ${
                                j === q.correctAnswer
                                  ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                  : g.selectedAnswer === j
                                    ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                    : "text-gray-600"
                              }`}
                            >
                              <ExamMathText text={opt} className="inline" />{" "}
                              {j === q.correctAnswer && "✓"}{" "}
                              {g.selectedAnswer === j && j !== q.correctAnswer && "✗"}
                            </div>
                          ))}
                        </div>

                        {g.justification && (
                          <div className="bg-white/[0.03] rounded-lg p-2.5 border border-white/[0.06]">
                            <p className="text-gray-600 text-[10px] font-semibold">
                              TU JUSTIFICACIÓN:
                            </p>
                            <p className="text-gray-300 text-xs whitespace-pre-wrap">
                              {g.justification}
                            </p>
                          </div>
                        )}

                        {g.justificationFeedback && (
                          <div className="bg-blue-500/[0.05] rounded-lg p-2.5 border-l-2 border-blue-500/30">
                            <p className="text-blue-400 text-[10px] font-semibold">
                              EVALUACIÓN IA ({g.justificationScore}/
                              {g.justificationMaxPoints ?? q.justificationMaxPoints ?? 2} pts):
                            </p>
                            <p className="text-gray-400 text-xs whitespace-pre-wrap">
                              {g.justificationFeedback}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {isDev && (
                      <div className="space-y-2 mb-3">
                        <div className="bg-white/[0.03] rounded-lg p-2.5 border border-white/[0.06]">
                          <p className="text-gray-600 text-[10px] font-semibold">
                            TU RESPUESTA:
                          </p>
                          <p className="text-gray-300 text-xs whitespace-pre-wrap">
                            {g.devText || "Sin respuesta"}
                          </p>
                        </div>

                        <div className="bg-green-500/[0.05] rounded-lg p-2.5 border border-green-500/10">
                          <p className="text-green-400 text-[10px] font-semibold">
                            RESPUESTA MODELO:
                          </p>
                          <div className="text-gray-300 text-xs">
                            <ExamMathText text={q.modelAnswer || ""} className="inline" />
                          </div>
                        </div>

                        {g.aiFeedback && (
                          <div className="bg-blue-500/[0.05] rounded-lg p-2.5 border-l-2 border-blue-500/30">
                            <p className="text-blue-400 text-[10px] font-semibold">
                              EVALUACIÓN IA ({g.aiScore}/{g.aiMaxScore} pts):
                            </p>
                            <p className="text-gray-400 text-xs whitespace-pre-wrap">
                              {g.aiFeedback}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {q.explanation && !isDev && (
                      <div className="bg-blue-500/[0.05] rounded-lg p-2.5 border-l-2 border-blue-500/30">
                        <p className="text-blue-400 text-[10px] font-semibold">
                          EXPLICACIÓN:
                        </p>
                        <div className="text-gray-400 text-xs">
                          <ExamMathText text={q.explanation} className="inline" />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div className="text-center mt-6">
            <p className="text-gray-600 text-xs">
              {exam?.title} — {name} ({course})
            </p>
            {!isKiosk && (
              <p className="text-gray-700 text-xs mt-1">Puedes cerrar esta ventana</p>
            )}
            {isKiosk && (
              <p className="text-gray-700 text-xs mt-1">
                Espera las instrucciones del docente antes de cerrar.
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── PANTALLA DEL EXAMEN (preguntas) ─────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950"
         style={{ userSelect: (securityMode || isKiosk) ? "none" : "auto" }}>

      {/* Overlay kiosk (modo kiosk app) */}
      {showWarning && isKiosk && (
        <KioskWarningOverlay onDismiss={() => { setShowWarning(false); requestFullscreen() }} />
      )}

      {/* Overlay de seguridad con temporizador (modo seguro / kiosk) */}
      {guardState && (guardState.sanctionLevel || blockSecsLeft > 0) && (
        <SecurityOverlay
          incidentCount={guardState.incidentCount}
          sanctionLevel={guardState.sanctionLevel}
          blockSecsLeft={blockSecsLeft}
          lastEventType={guardState.lastEventType}
          isFlagged={guardState.isFlagged}
          onDismiss={() => {
            // Solo se puede cerrar si no hay bloqueo activo
            if (blockSecsLeft === 0) {
              setGuardState(prev => prev ? { ...prev, sanctionLevel: null } : null)
            }
          }}
        />
      )}

      {/* Banner modo seguro */}
      {securityMode && !isKiosk && (
        <div className="fixed top-0 left-0 right-0 z-50 border-b border-amber-900/40 px-4 py-1.5 text-center"
             style={{ background: "rgba(120,53,15,0.7)" }}>
          <p className="text-amber-400 text-xs font-semibold">
            🔒 MODO SEGURO — Examen supervisado · Las infracciones quedan registradas
            {guardState && guardState.incidentCount > 0 && (
              <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                guardState.isFlagged ? "bg-red-500/20 text-red-400" :
                guardState.incidentCount >= 3 ? "bg-orange-500/20 text-orange-400" :
                "bg-amber-500/20 text-amber-400"
              }`}>
                {guardState.incidentCount} incidente{guardState.incidentCount !== 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
      )}

      {/* Banner kiosk */}
      {isKiosk && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-950/80 border-b border-red-900/40 px-4 py-1.5 text-center">
          <p className="text-red-400 text-xs font-semibold">
            🔒 EXAMEN EN PROGRESO — Pantalla controlada · {kioskSala} · No puedes salir
          </p>
        </div>
      )}

      <div className={`sticky z-10 bg-gray-950/90 backdrop-blur-xl border-b border-white/5 ${isKiosk ? "top-[32px]" : "top-0"}`}>
        <div className="max-w-2xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-xs">{name}</span>
            <span className="text-gray-700">|</span>
            <span className="text-gray-500 text-xs">
              {answeredCount}/{totalQ} preguntas
            </span>
            <span className="text-gray-700">|</span>
            <span className="text-blue-400 text-xs font-semibold">
              {examTotalPoints} pts total
            </span>
          </div>

          <div
            className={`font-mono font-bold text-sm ${
              timeLeft < 60
                ? "text-red-400 animate-pulse"
                : timeLeft < 300
                  ? "text-yellow-400"
                  : "text-gray-400"
            }`}
          >
            ⏱ {fmt(timeLeft)}
          </div>
        </div>

        <div className="h-1 bg-gray-800">
          <div
            className="h-full bg-blue-500 transition-all"
            style={{ width: `${(answeredCount / totalQ) * 100}%` }}
          />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {q && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-blue-400 text-xs font-semibold">
                  Pregunta {curQ + 1} de {totalQ}
                </span>

                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ${
                    q.type === "multiple_choice"
                      ? "bg-blue-500/10 text-blue-400"
                      : q.type === "true_false"
                        ? "bg-green-500/10 text-green-400"
                        : "bg-orange-500/10 text-orange-400"
                  }`}
                >
                  {q.type === "multiple_choice"
                    ? "Alternativas"
                    : q.type === "true_false"
                      ? "V/F + Justificación"
                      : "Desarrollo"}
                </span>

                {q.difficulty && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full ${
                      q.difficulty === 3
                        ? "bg-red-500/10 text-red-400"
                        : q.difficulty === 2
                          ? "bg-yellow-500/10 text-yellow-400"
                          : "bg-green-500/10 text-green-400"
                    }`}
                  >
                    {q.difficulty === 3
                      ? "Difícil"
                      : q.difficulty === 2
                        ? "Media"
                        : "Fácil"}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-300 font-bold border border-blue-500/20">
                  {getQuestionMaxPoints(q)} pts
                </span>
                {q.type === "true_false" && (
                  <span className="text-[10px] text-gray-500">
                    ({q.selectionPoints ?? 1} selección + {q.justificationMaxPoints ?? 2} justif.)
                  </span>
                )}
                {q.type === "development" && q.maxPoints && (
                  <span className="text-[10px] text-gray-500">evaluado por IA</span>
                )}
              </div>
            </div>

            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
              <div className="text-white font-semibold text-sm leading-relaxed">
                <ExamMathText text={q.question} className="inline" />
              </div>
            </div>

            {q.type === "multiple_choice" && (
              <div className="space-y-2">
                {(q.options || []).map((opt: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => setMcAnswers({ ...mcAnswers, [curQ]: i })}
                    className={`w-full text-left p-3.5 rounded-xl border text-sm transition-all ${
                      mcAnswers[curQ] === i
                        ? "bg-blue-500/10 border-blue-500/30 text-blue-300"
                        : "bg-white/[0.03] border-white/[0.06] text-gray-400 hover:bg-white/[0.06]"
                    }`}
                  >
                    <span className="font-bold mr-2">{String.fromCharCode(65 + i)}.</span>
                    <ExamMathText text={opt.replace(/^[A-Da-d][).]\s*/u, "")} className="inline" />
                  </button>
                ))}
              </div>
            )}

            {q.type === "true_false" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {(q.options || ["Verdadero", "Falso"]).map((opt: string, i: number) => (
                    <button
                      key={i}
                      onClick={() => setMcAnswers({ ...mcAnswers, [curQ]: i })}
                      className={`p-3.5 rounded-xl border text-sm font-semibold text-center transition-all ${
                        mcAnswers[curQ] === i
                          ? "bg-blue-500/10 border-blue-500/30 text-blue-300"
                          : "bg-white/[0.03] border-white/[0.06] text-gray-400 hover:bg-white/[0.06]"
                      }`}
                    >
                      <ExamMathText text={opt} className="inline" />
                    </button>
                  ))}
                </div>

                <div>
                  <label className="text-gray-500 text-xs font-semibold block mb-1">
                    JUSTIFICA TU RESPUESTA *
                  </label>
                  <textarea
                    value={tfJustifications[curQ] || ""}
                    onChange={e =>
                      setTfJustifications({
                        ...tfJustifications,
                        [curQ]: e.target.value,
                      })
                    }
                    placeholder="Explica por qué elegiste esa opción..."
                    className="w-full min-h-[80px] bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 text-gray-200 text-sm focus:outline-none focus:border-blue-500/30 resize-vertical"
                  />
                  <p className="text-gray-600 text-[10px] mt-1">
                    La justificación vale {q.justificationMaxPoints ?? 2} punto
                    {(q.justificationMaxPoints ?? 2) === 1 ? "" : "s"} adicional
                    {(q.justificationMaxPoints ?? 2) === 1 ? "" : "es"} evaluado
                    {(q.justificationMaxPoints ?? 2) === 1 ? "" : "s"} por IA
                  </p>
                </div>
              </div>
            )}

            {q.type === "development" && (
              <div>
                <textarea
                  value={devAnswers[curQ] || ""}
                  onChange={e =>
                    setDevAnswers({
                      ...devAnswers,
                      [curQ]: e.target.value,
                    })
                  }
                  placeholder="Escribe tu respuesta aquí. Sé detallado y preciso..."
                  className="w-full min-h-[160px] bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 text-gray-200 text-sm focus:outline-none focus:border-blue-500/30 resize-vertical"
                />
                <p className="text-gray-600 text-[10px] mt-1">
                  Puntaje máximo: {q.maxPoints || 5} puntos • Evaluado por IA
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              {curQ > 0 && (
                <button
                  onClick={() => blockSecsLeft === 0 && setCurQ(curQ - 1)}
                  disabled={blockSecsLeft > 0}
                  className="px-4 py-2.5 rounded-xl border border-white/10 text-gray-500 text-sm disabled:opacity-30"
                >
                  ← Anterior
                </button>
              )}

              <div className="flex-1" />

              {curQ < totalQ - 1 ? (
                <button
                  onClick={() => blockSecsLeft === 0 && setCurQ(curQ + 1)}
                  disabled={blockSecsLeft > 0}
                  className="px-4 py-2.5 rounded-xl bg-blue-600/80 text-white text-sm font-semibold disabled:opacity-30"
                >
                  Siguiente →
                </button>
              ) : (
                <button
                  onClick={doSubmit}
                  disabled={blockSecsLeft > 0}
                  className="px-6 py-2.5 rounded-xl bg-green-600/90 text-white text-sm font-bold disabled:opacity-30"
                >
                  ✅ Enviar examen
                </button>
              )}
            </div>

            {/* Navegador de preguntas */}
            <div className="pt-2 border-t border-white/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-[10px] font-semibold tracking-widest">NAVEGADOR DE PREGUNTAS</span>
                <span className="text-gray-600 text-[10px]">
                  Puntaje total: <span className="text-blue-400 font-bold">{examTotalPoints} pts</span>
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {qs.map((item: any, i: number) => {
                  const answered =
                    item.type === "development"
                      ? Boolean(devAnswers[i] && devAnswers[i].trim().length > 0)
                      : item.type === "true_false"
                        ? mcAnswers[i] !== undefined ||
                          Boolean(tfJustifications[i] && tfJustifications[i].trim().length > 0)
                        : mcAnswers[i] !== undefined
                  const pts = getQuestionMaxPoints(item)

                  return (
                    <button
                      key={i}
                      onClick={() => setCurQ(i)}
                      title={`Pregunta ${i + 1} — ${pts} pt${pts !== 1 ? "s" : ""}`}
                      className={`w-10 h-10 rounded-lg text-xs font-bold transition-all flex flex-col items-center justify-center gap-0 ${
                        i === curQ
                          ? "bg-blue-500 text-white"
                          : answered
                            ? "bg-green-500/20 text-green-400 border border-green-500/30"
                            : "bg-white/[0.04] text-gray-600 border border-white/[0.06]"
                      }`}
                    >
                      <span className="text-xs leading-none">{i + 1}</span>
                      <span className={`text-[9px] leading-none font-normal mt-0.5 ${i === curQ ? "text-blue-200" : answered ? "text-green-500/70" : "text-gray-700"}`}>
                        {pts}pt
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
