// components/exam-security/ExamSecurityClient.tsx
// VERSIÓN LIMPIA Y CORREGIDA — seguridad de exámenes

"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import SecurityOverlay from "./SecurityOverlay"
import type {
  SecurityActionType,
  SecurityEventInput,
  SecurityEventType,
  SecurityPolicy,
  SecuritySessionRecord,
} from "@/lib/exam-security/types"

type SecurityActionPayload = {
  type?: SecurityActionType
  message?: string
  durationSeconds?: number
}

type Props = {
  examId: string
  submissionId?: string | null
  studentName?: string | null
  studentCourse?: string | null
  studentRut?: string | null
  getCurrentQuestionIndex?: () => number | null
  getCurrentTimeLeft?: () => number | null
  enabled?: boolean
  onSessionReady?: (payload: {
    sessionId: string
    policy: SecurityPolicy
    session: SecuritySessionRecord | null
  }) => void
  onActionApplied?: (payload: {
    sessionId: string | null
    action: SecurityActionPayload
  }) => void
  onTerminated?: (payload: {
    sessionId: string | null
    action: SecurityActionPayload
  }) => void
}

type OverlayState = {
  visible: boolean
  actionType: SecurityActionType | "none"
  title?: string
  message?: string
  countdown?: number
}

const DEFAULT_POLICY: SecurityPolicy = {
  enabled: true,
  requireFullscreen: true,
  blockCopyPaste: true,
  blockContextMenu: true,
  blockShortcuts: true,
  preventTextSelection: true,
  heartbeatIntervalSec: 10,
  offlineToleranceSec: 25,
  maxWarnings: 2,
  maxFreezes: 2,
  freezeSecondsFirst: 10,
  freezeSecondsRepeat: 20,
  terminateOnHighRisk: false,
  highRiskThreshold: 70,
  strictMode: false,
}

const BLOCKED_CTRL_KEYS = new Set([
  "c", "v", "x", "a", "p", "s", "u", "r", "w", "t", "n", "l",
  "C", "V", "X", "A", "P", "S", "U", "R", "W", "T", "N", "L",
])

const BLOCKED_CTRL_SHIFT_KEYS = new Set([
  "i", "j", "c", "n", "k",
  "I", "J", "C", "N", "K",
])

const BLOCKED_FUNCTION_KEYS = new Set(["F1", "F5", "F11", "F12"])

const DEVTOOLS_WIDTH_THRESHOLD = 160
const DEVTOOLS_HEIGHT_THRESHOLD = 200

export default function ExamSecurityClient({
  examId,
  submissionId = null,
  studentName = null,
  studentCourse = null,
  studentRut = null,
  getCurrentQuestionIndex,
  getCurrentTimeLeft,
  enabled = true,
  onSessionReady,
  onActionApplied,
  onTerminated,
}: Props) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [policy, setPolicy] = useState<SecurityPolicy>(DEFAULT_POLICY)
  const [session, setSession] = useState<SecuritySessionRecord | null>(null)
  const [overlay, setOverlay] = useState<OverlayState>({
    visible: false,
    actionType: "none",
  })

  const heartbeatRef = useRef<number | null>(null)
  const freezeIntervalRef = useRef<number | null>(null)
  const isSendingRef = useRef(false)
  const mountedRef = useRef(false)
  const devtoolsOpenRef = useRef(false)
  const prevInnerSize = useRef({ w: 0, h: 0 })

  const isBlockingOverlayVisible = useMemo(() => {
    return (
      overlay.visible &&
      (overlay.actionType === "freeze" ||
        overlay.actionType === "block" ||
        overlay.actionType === "terminate_attempt")
    )
  }, [overlay])

  const getClientMetadata = useCallback(() => {
    if (typeof window === "undefined") return {}
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      platform: navigator.platform,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
    }
  }, [])

  const getPayloadBase = useCallback(() => {
    const questionIndex =
      typeof getCurrentQuestionIndex === "function"
        ? getCurrentQuestionIndex()
        : null

    const clientTimeLeft =
      typeof getCurrentTimeLeft === "function"
        ? getCurrentTimeLeft()
        : null

    return {
      questionIndex,
      clientTimeLeft,
      payload: {
        ...getClientMetadata(),
        visibilityState:
          typeof document !== "undefined" ? document.visibilityState : "visible",
        fullscreen:
          typeof document !== "undefined" ? !!document.fullscreenElement : false,
      },
    }
  }, [getCurrentQuestionIndex, getCurrentTimeLeft, getClientMetadata])

  const enterFullscreen = useCallback(async () => {
    if (typeof document === "undefined") return
    if (document.fullscreenElement) return

    try {
      await document.documentElement.requestFullscreen({
        navigationUI: "hide",
      } as any)
    } catch {
      try {
        await document.documentElement.requestFullscreen()
      } catch {}
    }
  }, [])

  const clearFreezeTimer = useCallback(() => {
    if (freezeIntervalRef.current) {
      window.clearInterval(freezeIntervalRef.current)
      freezeIntervalRef.current = null
    }
  }, [])

  const startFreezeCountdown = useCallback(
    (seconds: number, message?: string) => {
      clearFreezeTimer()

      let remaining = Math.max(1, seconds || 10)

      setOverlay({
        visible: true,
        actionType: "freeze",
        title: "Examen temporalmente congelado",
        message:
          message ||
          "Se detectó una acción no permitida. Espera para continuar.",
        countdown: remaining,
      })

      freezeIntervalRef.current = window.setInterval(() => {
        remaining -= 1

        if (remaining <= 0) {
          clearFreezeTimer()
          setOverlay({ visible: false, actionType: "none" })
          return
        }

        setOverlay((prev) => ({
          ...prev,
          visible: true,
          actionType: "freeze",
          countdown: remaining,
        }))
      }, 1000)
    },
    [clearFreezeTimer]
  )

  const applyAction = useCallback(
    (action: SecurityActionPayload) => {
      onActionApplied?.({ sessionId, action })

      if (action.type === "warn") {
        setOverlay({
          visible: true,
          actionType: "warn",
          title: "Advertencia de seguridad",
          message:
            action.message ||
            "Se detectó una acción no permitida y fue registrada.",
        })

        window.setTimeout(() => {
          setOverlay((prev) =>
            prev.actionType === "warn"
              ? { visible: false, actionType: "none" }
              : prev
          )
        }, 2600)
        return
      }

      if (action.type === "freeze") {
        startFreezeCountdown(action.durationSeconds ?? 10, action.message)
        return
      }

      if (action.type === "block") {
        setOverlay({
          visible: true,
          actionType: "block",
          title: "Sesión bloqueada",
          message:
            action.message ||
            "Tu sesión fue bloqueada por reiteración de incidentes.",
        })
        return
      }

      if (action.type === "flag_review") {
        setOverlay({
          visible: true,
          actionType: "flag_review",
          title: "Sesión marcada para revisión",
          message:
            action.message ||
            "Tu intento quedó marcado para revisión obligatoria.",
        })

        window.setTimeout(() => {
          setOverlay((prev) =>
            prev.actionType === "flag_review"
              ? { visible: false, actionType: "none" }
              : prev
          )
        }, 3200)
        return
      }

      if (action.type === "terminate_attempt") {
        setOverlay({
          visible: true,
          actionType: "terminate_attempt",
          title: "Intento finalizado",
          message:
            action.message ||
            "Tu intento fue finalizado por política de seguridad.",
        })

        onTerminated?.({ sessionId, action })
      }
    },
    [onActionApplied, onTerminated, sessionId, startFreezeCountdown]
  )

  const sendSecurityEvent = useCallback(
    async (
      eventType: SecurityEventType,
      extraPayload?: Record<string, unknown>
    ) => {
      if (!enabled || !sessionId || isSendingRef.current) return
      if (overlay.actionType === "terminate_attempt") return

      try {
        isSendingRef.current = true

        const base = getPayloadBase()

        const body: SecurityEventInput = {
          sessionId,
          examId,
          submissionId,
          eventType,
          questionIndex: base.questionIndex,
          clientTimeLeft: base.clientTimeLeft,
          payload: {
            ...base.payload,
            ...(extraPayload ?? {}),
          },
        }

        const res = await fetch("/api/exam-security/event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })

        const json = await res.json().catch(() => null)

        if (json?.data?.action) {
          applyAction(json.data.action)
        }
      } catch {
      } finally {
        isSendingRef.current = false
      }
    },
    [
      enabled,
      sessionId,
      overlay.actionType,
      getPayloadBase,
      examId,
      submissionId,
      applyAction,
    ]
  )

  /**
   * Wrapper local para no romper compilación mientras el union
   * SecurityEventType todavía no esté 100% alineado con todos
   * los nombres usados por el cliente.
   */
  const emitSecurityEvent = useCallback(
    async (eventType: string, extraPayload?: Record<string, unknown>) => {
      await sendSecurityEvent(eventType as SecurityEventType, extraPayload)
    },
    [sendSecurityEvent]
  )

  const sendHeartbeat = useCallback(async () => {
    if (!sessionId || !enabled || overlay.actionType === "terminate_attempt") {
      return
    }

    try {
      await fetch("/api/exam-security/session/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          examId,
          submissionId,
          payload: getClientMetadata(),
        }),
      })
    } catch {}
  }, [
    sessionId,
    enabled,
    overlay.actionType,
    examId,
    submissionId,
    getClientMetadata,
  ])

  // ── Session start ──────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !examId || mountedRef.current) return

    mountedRef.current = true
    prevInnerSize.current = { w: window.innerWidth, h: window.innerHeight }

    ;(async () => {
      try {
        const res = await fetch("/api/exam-security/session/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            examId,
            submissionId,
            studentName,
            studentCourse,
            studentRut,
            clientMetadata: getClientMetadata(),
          }),
        })

        const json = await res.json()

        if (!json?.success) return

        setSessionId(json.sessionId)
        setPolicy(json.policy ?? DEFAULT_POLICY)
        setSession(json.session ?? null)

        onSessionReady?.({
          sessionId: json.sessionId,
          policy: json.policy ?? DEFAULT_POLICY,
          session: json.session ?? null,
        })

        if (json.policy?.requireFullscreen) {
          window.setTimeout(() => {
            void enterFullscreen()
          }, 400)
        }
      } catch {}
    })()
  }, [
    enabled,
    examId,
    submissionId,
    studentName,
    studentCourse,
    studentRut,
    getClientMetadata,
    enterFullscreen,
    onSessionReady,
  ])

  // Reset de arranque si el componente se deshabilita y vuelve a habilitarse
  useEffect(() => {
    if (enabled) return
    mountedRef.current = false
  }, [enabled])

  // ── Heartbeat ──────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId || !enabled) return

    heartbeatRef.current = window.setInterval(() => {
      void sendHeartbeat()
    }, (policy.heartbeatIntervalSec || 10) * 1000)

    return () => {
      if (heartbeatRef.current) window.clearInterval(heartbeatRef.current)
    }
  }, [sessionId, enabled, policy.heartbeatIntervalSec, sendHeartbeat])

  // ── DOM event listeners ────────────────────────────────────
  useEffect(() => {
    if (!enabled || !sessionId) return

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        void emitSecurityEvent("visibility_hidden")
      }
    }

    const onBlur = () => {
      void emitSecurityEvent("window_blur")
    }

    const onFocus = () => {
      void emitSecurityEvent("window_focus")
    }

    const onFullscreenChange = () => {
      const inFullscreen = !!document.fullscreenElement

      if (!inFullscreen && policy.requireFullscreen) {
        void emitSecurityEvent("fullscreen_exit")

        window.setTimeout(() => {
          if (!document.fullscreenElement) {
            void enterFullscreen()
          }
        }, 450)
      }
    }

    const onCopy = (e: ClipboardEvent) => {
      if (!policy.blockCopyPaste) return
      e.preventDefault()
      e.stopPropagation()
      void emitSecurityEvent("copy_attempt")
    }

    const onPaste = (e: ClipboardEvent) => {
      if (!policy.blockCopyPaste) return
      e.preventDefault()
      e.stopPropagation()
      void emitSecurityEvent("paste_attempt")
    }

    const onCut = (e: ClipboardEvent) => {
      if (!policy.blockCopyPaste) return
      e.preventDefault()
      e.stopPropagation()
      void emitSecurityEvent("cut_attempt")
    }

    const onContextMenu = (e: MouseEvent) => {
      if (!policy.blockContextMenu) return
      e.preventDefault()
      e.stopPropagation()
      void emitSecurityEvent("context_menu")
    }

    const onDragStart = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      void emitSecurityEvent("drag_attempt")
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key

      if (policy.blockShortcuts) {
        const ctrlBlocked = e.ctrlKey && BLOCKED_CTRL_KEYS.has(key)
        const ctrlShiftBlocked =
          e.ctrlKey && e.shiftKey && BLOCKED_CTRL_SHIFT_KEYS.has(key)
        const fnBlocked = BLOCKED_FUNCTION_KEYS.has(key)
        const altBlocked = e.altKey && ["Tab", "F4"].includes(key)
        const printScreenBlocked = key === "PrintScreen"
        const escapeBlocked = key === "Escape"
        const metaBlocked = e.metaKey

        if (
          ctrlBlocked ||
          ctrlShiftBlocked ||
          fnBlocked ||
          altBlocked ||
          printScreenBlocked ||
          escapeBlocked ||
          metaBlocked
        ) {
          e.preventDefault()
          e.stopPropagation()

          void emitSecurityEvent("blocked_shortcut", {
            key,
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey,
            altKey: e.altKey,
            metaKey: e.metaKey,
          })
        }
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") {
        void emitSecurityEvent("blocked_shortcut", {
          key: "PrintScreen",
          phase: "keyup",
        })
      }
    }

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      void emitSecurityEvent("before_unload")
      e.preventDefault()
      e.returnValue = ""
    }

    const onOffline = () => {
      void emitSecurityEvent("offline")
    }

    const onOnline = () => {
      void emitSecurityEvent("online")
    }

    const onBeforePrint = (e: Event) => {
      e.preventDefault?.()
      void emitSecurityEvent("print_attempt")
    }

    document.addEventListener("visibilitychange", onVisibilityChange)
    window.addEventListener("blur", onBlur)
    window.addEventListener("focus", onFocus)
    document.addEventListener("fullscreenchange", onFullscreenChange)
    document.addEventListener("copy", onCopy, { capture: true })
    document.addEventListener("paste", onPaste, { capture: true })
    document.addEventListener("cut", onCut, { capture: true })
    document.addEventListener("contextmenu", onContextMenu, { capture: true })
    document.addEventListener("dragstart", onDragStart, { capture: true })
    document.addEventListener("keydown", onKeyDown, { capture: true })
    document.addEventListener("keyup", onKeyUp, { capture: true })
    window.addEventListener("beforeunload", onBeforeUnload)
    window.addEventListener("offline", onOffline)
    window.addEventListener("online", onOnline)
    window.addEventListener("beforeprint", onBeforePrint)

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("blur", onBlur)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("fullscreenchange", onFullscreenChange)
      document.removeEventListener("copy", onCopy, true)
      document.removeEventListener("paste", onPaste, true)
      document.removeEventListener("cut", onCut, true)
      document.removeEventListener("contextmenu", onContextMenu, true)
      document.removeEventListener("dragstart", onDragStart, true)
      document.removeEventListener("keydown", onKeyDown, true)
      document.removeEventListener("keyup", onKeyUp, true)
      window.removeEventListener("beforeunload", onBeforeUnload)
      window.removeEventListener("offline", onOffline)
      window.removeEventListener("online", onOnline)
      window.removeEventListener("beforeprint", onBeforePrint)
    }
  }, [enabled, sessionId, policy, emitSecurityEvent, enterFullscreen])

  // ── Detección de DevTools (resize heurístico) ─────────────
  useEffect(() => {
    if (!enabled || !sessionId) return

    const onResize = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      const prev = prevInnerSize.current

      if (prev.w > 0) {
        const dw = prev.w - w
        const dh = prev.h - h

        if (
          (dw >= DEVTOOLS_WIDTH_THRESHOLD && dh < 50) ||
          (dh >= DEVTOOLS_HEIGHT_THRESHOLD && dw < 50)
        ) {
          if (!devtoolsOpenRef.current) {
            devtoolsOpenRef.current = true
            void emitSecurityEvent("blocked_shortcut", {
              detail: "devtools_resize",
              dw,
              dh,
            })
          }
        } else {
          devtoolsOpenRef.current = false
        }
      }

      prevInnerSize.current = { w, h }
    }

    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [enabled, sessionId, emitSecurityEvent])

  // ── CSS de seguridad global ────────────────────────────────
  useEffect(() => {
    if (!enabled) return

    const style = document.createElement("style")
    style.setAttribute("data-exam-security-style", "true")
    style.innerHTML = `
      body, .exam-root, .exam-content, .exam-question {
        user-select: none !important;
        -webkit-user-select: none !important;
        -ms-user-select: none !important;
      }

      .exam-dev-input,
      textarea,
      input {
        user-select: text !important;
        -webkit-user-select: text !important;
        -ms-user-select: text !important;
      }

      @media print {
        body * { display: none !important; }
        body::after {
          content: "Este contenido no puede imprimirse.";
          display: block !important;
          font-size: 24px;
          text-align: center;
          padding: 40px;
          color: #000;
        }
      }
    `

    document.head.appendChild(style)
    return () => style.remove()
  }, [enabled])

  useEffect(() => {
    return () => {
      clearFreezeTimer()
      if (heartbeatRef.current) window.clearInterval(heartbeatRef.current)
    }
  }, [clearFreezeTimer])

  return (
    <>
      <SecurityOverlay
        visible={overlay.visible}
        actionType={overlay.actionType}
        title={overlay.title}
        message={overlay.message}
        countdown={overlay.countdown}
      />

      <div
        data-exam-security="active"
        data-session-id={sessionId ?? ""}
        data-risk-level={session?.risk_level ?? "clean"}
        data-blocking={isBlockingOverlayVisible ? "true" : "false"}
        className="hidden"
      />
    </>
  )
}
