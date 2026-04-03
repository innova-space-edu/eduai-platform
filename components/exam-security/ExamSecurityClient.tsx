// components/exam-security/ExamSecurityClient.tsx

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

const BLOCKED_SHORTCUTS = new Set(["c", "v", "x", "a", "p", "s", "u", "r"])
const BLOCKED_FUNCTION_KEYS = new Set(["F12", "F11", "F5"])

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
      typeof getCurrentTimeLeft === "function" ? getCurrentTimeLeft() : null

    return {
      questionIndex,
      clientTimeLeft,
      payload: {
        visibilityState:
          typeof document !== "undefined" ? document.visibilityState : undefined,
        fullscreen:
          typeof document !== "undefined" ? !!document.fullscreenElement : false,
        windowWidth:
          typeof window !== "undefined" ? window.innerWidth : undefined,
        windowHeight:
          typeof window !== "undefined" ? window.innerHeight : undefined,
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      },
    }
  }, [getCurrentQuestionIndex, getCurrentTimeLeft])

  const enterFullscreen = useCallback(async () => {
    if (typeof document === "undefined") return
    if (!policy.requireFullscreen) return

    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
      }
    } catch (error) {
      console.warn("[ExamSecurityClient] No se pudo activar fullscreen", error)
    }
  }, [policy.requireFullscreen])

  const clearFreezeTimer = useCallback(() => {
    if (freezeIntervalRef.current) {
      window.clearInterval(freezeIntervalRef.current)
      freezeIntervalRef.current = null
    }
  }, [])

  const hideOverlay = useCallback(() => {
    clearFreezeTimer()
    setOverlay({
      visible: false,
      actionType: "none",
      title: undefined,
      message: undefined,
      countdown: undefined,
    })
  }, [clearFreezeTimer])

  const startFreezeCountdown = useCallback(
    (seconds: number, message?: string) => {
      clearFreezeTimer()

      setOverlay({
        visible: true,
        actionType: "freeze",
        title: "Examen bloqueado temporalmente",
        message:
          message ||
          "Se detectó una conducta no permitida. Podrás continuar cuando finalice el bloqueo.",
        countdown: seconds,
      })

      let remaining = seconds

      freezeIntervalRef.current = window.setInterval(() => {
        remaining -= 1

        setOverlay((prev) => ({
          ...prev,
          countdown: Math.max(0, remaining),
        }))

        if (remaining <= 0) {
          clearFreezeTimer()
          hideOverlay()
        }
      }, 1000)
    },
    [clearFreezeTimer, hideOverlay]
  )

  const applyAction = useCallback(
    (action?: SecurityActionPayload) => {
      if (!action?.type || action.type === "none") return

      onActionApplied?.({
        sessionId,
        action,
      })

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
            "Tu sesión fue bloqueada temporalmente por reiteración de incidentes.",
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
            "Tu intento quedó marcado para revisión obligatoria por el docente.",
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

        onTerminated?.({
          sessionId,
          action,
        })
      }
    },
    [onActionApplied, onTerminated, sessionId, startFreezeCountdown]
  )

  const sendSecurityEvent = useCallback(
    async (eventType: SecurityEventType, extraPayload?: Record<string, unknown>) => {
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
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        })

        const json = await res.json().catch(() => null)

        if (json?.data?.action) {
          applyAction(json.data.action)
        }
      } catch (error) {
        console.error("[ExamSecurityClient] Error enviando evento", error)
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

  const sendHeartbeat = useCallback(async () => {
    if (!sessionId || !enabled) return
    if (overlay.actionType === "terminate_attempt") return

    try {
      await fetch("/api/exam-security/session/heartbeat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          examId,
          submissionId,
          payload: getClientMetadata(),
        }),
      })
    } catch (error) {
      console.warn("[ExamSecurityClient] Heartbeat falló", error)
    }
  }, [
    sessionId,
    enabled,
    overlay.actionType,
    examId,
    submissionId,
    getClientMetadata,
  ])

  useEffect(() => {
    if (!enabled || !examId || mountedRef.current) return
    mountedRef.current = true

    ;(async () => {
      try {
        const res = await fetch("/api/exam-security/session/start", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
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

        if (!json?.success) {
          console.warn("[ExamSecurityClient] No se pudo iniciar sesión", json)
          return
        }

        setSessionId(json.sessionId)
        setPolicy(json.policy ?? DEFAULT_POLICY)
        setSession(json.session ?? null)

        onSessionReady?.({
          sessionId: json.sessionId,
          policy: json.policy ?? DEFAULT_POLICY,
          session: json.session ?? null,
        })

        if (json.policy?.requireFullscreen) {
          setTimeout(() => {
            enterFullscreen()
          }, 400)
        }
      } catch (error) {
        console.error("[ExamSecurityClient] Error iniciando seguridad", error)
      }
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

  useEffect(() => {
    if (!sessionId || !enabled) return

    heartbeatRef.current = window.setInterval(() => {
      sendHeartbeat()
    }, (policy.heartbeatIntervalSec || 10) * 1000)

    return () => {
      if (heartbeatRef.current) {
        window.clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }
    }
  }, [sessionId, enabled, policy.heartbeatIntervalSec, sendHeartbeat])

  useEffect(() => {
    if (!enabled || !sessionId) return

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        sendSecurityEvent("tab_hidden")
      } else {
        sendSecurityEvent("visibility_return")
      }
    }

    const onBlur = () => {
      sendSecurityEvent("window_blur")
    }

    const onFocus = () => {
      sendSecurityEvent("window_focus_return")
    }

    const onFullscreenChange = () => {
      if (document.fullscreenElement) {
        sendSecurityEvent("fullscreen_reenter")
      } else {
        sendSecurityEvent("fullscreen_exit")
      }
    }

    const onCopy = (e: ClipboardEvent) => {
      if (!policy.blockCopyPaste) return
      e.preventDefault()
      sendSecurityEvent("copy_attempt")
    }

    const onPaste = (e: ClipboardEvent) => {
      if (!policy.blockCopyPaste) return
      e.preventDefault()
      sendSecurityEvent("paste_attempt")
    }

    const onCut = (e: ClipboardEvent) => {
      if (!policy.blockCopyPaste) return
      e.preventDefault()
      sendSecurityEvent("cut_attempt")
    }

    const onContextMenu = (e: MouseEvent) => {
      if (!policy.blockContextMenu) return
      e.preventDefault()
      sendSecurityEvent("contextmenu_attempt")
    }

    const onDragStart = (e: DragEvent) => {
      e.preventDefault()
      sendSecurityEvent("drag_attempt")
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (!policy.blockShortcuts) return

      const key = e.key.toLowerCase()

      const blockedCombo =
        (e.ctrlKey || e.metaKey) && BLOCKED_SHORTCUTS.has(key)

      const blockedDevTools =
        (e.ctrlKey && e.shiftKey && ["i", "j", "c"].includes(key)) ||
        BLOCKED_FUNCTION_KEYS.has(e.key)

      if (blockedCombo || blockedDevTools) {
        e.preventDefault()
        e.stopPropagation()

        if ((e.ctrlKey || e.metaKey) && key === "p") {
          sendSecurityEvent("print_attempt", {
            key: e.key,
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey,
            altKey: e.altKey,
            metaKey: e.metaKey,
          })
          return
        }

        if ((e.ctrlKey || e.metaKey) && key === "r") {
          sendSecurityEvent("reload_attempt", {
            key: e.key,
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey,
            altKey: e.altKey,
            metaKey: e.metaKey,
          })
          return
        }

        if (e.key === "F5") {
          sendSecurityEvent("reload_attempt", {
            key: e.key,
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey,
            altKey: e.altKey,
            metaKey: e.metaKey,
          })
          return
        }

        sendSecurityEvent("blocked_shortcut", {
          key: e.key,
          ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
          metaKey: e.metaKey,
        })
      }
    }

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      sendSecurityEvent("reload_attempt")
      e.preventDefault()
      e.returnValue = ""
    }

    const onOffline = () => {
      sendSecurityEvent("network_offline", { online: false })
    }

    const onOnline = () => {
      sendSecurityEvent("network_online", { online: true })
    }

    document.addEventListener("visibilitychange", onVisibilityChange)
    window.addEventListener("blur", onBlur)
    window.addEventListener("focus", onFocus)
    document.addEventListener("fullscreenchange", onFullscreenChange)

    document.addEventListener("copy", onCopy)
    document.addEventListener("paste", onPaste)
    document.addEventListener("cut", onCut)
    document.addEventListener("contextmenu", onContextMenu)
    document.addEventListener("dragstart", onDragStart)
    document.addEventListener("keydown", onKeyDown)
    window.addEventListener("beforeunload", onBeforeUnload)
    window.addEventListener("offline", onOffline)
    window.addEventListener("online", onOnline)

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("blur", onBlur)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("fullscreenchange", onFullscreenChange)

      document.removeEventListener("copy", onCopy)
      document.removeEventListener("paste", onPaste)
      document.removeEventListener("cut", onCut)
      document.removeEventListener("contextmenu", onContextMenu)
      document.removeEventListener("dragstart", onDragStart)
      document.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("beforeunload", onBeforeUnload)
      window.removeEventListener("offline", onOffline)
      window.removeEventListener("online", onOnline)
    }
  }, [enabled, sessionId, policy, sendSecurityEvent])

  useEffect(() => {
    if (!enabled || !policy.preventTextSelection) return

    const style = document.createElement("style")
    style.setAttribute("data-exam-security-style", "true")
    style.innerHTML = `
      .exam-question, .exam-content, .exam-root {
        user-select: none !important;
        -webkit-user-select: none !important;
        -ms-user-select: none !important;
      }
    `
    document.head.appendChild(style)

    return () => {
      style.remove()
    }
  }, [enabled, policy.preventTextSelection])

  useEffect(() => {
    return () => {
      clearFreezeTimer()
      if (heartbeatRef.current) {
        window.clearInterval(heartbeatRef.current)
      }
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
// components/exam-security/ExamSecurityClient.tsx
// VERSIÓN MEJORADA — máxima seguridad para exámenes
//
// Mejoras:
//  • Bloqueo de impresión (@media print + beforeprint event)
//  • Detección de DevTools por window resize
//  • Bloqueo de PrintScreen / Meta+Shift (captura de pantalla)
//  • Lista expandida: Alt+F4, Alt+Tab, Ctrl+W, Ctrl+T, F1-F5, F11, F12, Escape, Meta
//  • Re-entrada automática a fullscreen tras salida accidental
//  • userSelect:none global; .exam-dev-input como excepción para desarrollo

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
  "c","v","x","a","p","s","u","r","w","t","n","l",
  "C","V","X","A","P","S","U","R","W","T","N","L",
])
const BLOCKED_CTRL_SHIFT_KEYS = new Set(["i","j","c","n","k","I","J","C","N","K"])
const BLOCKED_FUNCTION_KEYS   = new Set(["F1","F5","F11","F12"])
const DEVTOOLS_WIDTH_THRESHOLD  = 160
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
  const [policy, setPolicy]       = useState<SecurityPolicy>(DEFAULT_POLICY)
  const [session, setSession]     = useState<SecuritySessionRecord | null>(null)
  const [overlay, setOverlay]     = useState<OverlayState>({ visible: false, actionType: "none" })

  const heartbeatRef      = useRef<number | null>(null)
  const freezeIntervalRef = useRef<number | null>(null)
  const isSendingRef      = useRef(false)
  const mountedRef        = useRef(false)
  const devtoolsOpenRef   = useRef(false)
  const prevInnerSize     = useRef({ w: 0, h: 0 })

  const isBlockingOverlayVisible = useMemo(() =>
    overlay.visible &&
    (overlay.actionType === "freeze" ||
     overlay.actionType === "block" ||
     overlay.actionType === "terminate_attempt"),
  [overlay])

  const getClientMetadata = useCallback(() => {
    if (typeof window === "undefined") return {}
    return {
      userAgent:    navigator.userAgent,
      language:     navigator.language,
      timezone:     Intl.DateTimeFormat().resolvedOptions().timeZone,
      platform:     navigator.platform,
      windowWidth:  window.innerWidth,
      windowHeight: window.innerHeight,
      screenWidth:  window.screen.width,
      screenHeight: window.screen.height,
    }
  }, [])

  const getPayloadBase = useCallback(() => {
    const questionIndex  = typeof getCurrentQuestionIndex === "function" ? getCurrentQuestionIndex() : null
    const clientTimeLeft = typeof getCurrentTimeLeft === "function" ? getCurrentTimeLeft() : null
    return {
      questionIndex,
      clientTimeLeft,
      payload: {
        visibilityState: typeof document !== "undefined" ? document.visibilityState : undefined,
        fullscreen:      typeof document !== "undefined" ? !!document.fullscreenElement : false,
        windowWidth:     typeof window !== "undefined" ? window.innerWidth  : undefined,
        windowHeight:    typeof window !== "undefined" ? window.innerHeight : undefined,
        userAgent:       typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      },
    }
  }, [getCurrentQuestionIndex, getCurrentTimeLeft])

  const enterFullscreen = useCallback(async () => {
    if (typeof document === "undefined" || !policy.requireFullscreen) return
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen({ navigationUI: "hide" } as any)
      }
    } catch {}
  }, [policy.requireFullscreen])

  const clearFreezeTimer = useCallback(() => {
    if (freezeIntervalRef.current) {
      window.clearInterval(freezeIntervalRef.current)
      freezeIntervalRef.current = null
    }
  }, [])

  const hideOverlay = useCallback(() => {
    clearFreezeTimer()
    setOverlay({ visible: false, actionType: "none" })
  }, [clearFreezeTimer])

  const startFreezeCountdown = useCallback(
    (seconds: number, message?: string) => {
      clearFreezeTimer()
      setOverlay({
        visible: true,
        actionType: "freeze",
        title: "Examen bloqueado temporalmente",
        message: message || "Se detectó una conducta no permitida. Podrás continuar cuando finalice el bloqueo.",
        countdown: seconds,
      })
      let remaining = seconds
      freezeIntervalRef.current = window.setInterval(() => {
        remaining -= 1
        setOverlay(prev => ({ ...prev, countdown: Math.max(0, remaining) }))
        if (remaining <= 0) { clearFreezeTimer(); hideOverlay() }
      }, 1000)
    },
    [clearFreezeTimer, hideOverlay]
  )

  const applyAction = useCallback(
    (action?: SecurityActionPayload) => {
      if (!action?.type || action.type === "none") return
      onActionApplied?.({ sessionId, action })
      if (action.type === "warn") {
        setOverlay({ visible: true, actionType: "warn", title: "Advertencia de seguridad", message: action.message || "Se detectó una acción no permitida y fue registrada." })
        window.setTimeout(() => setOverlay(prev => prev.actionType === "warn" ? { visible: false, actionType: "none" } : prev), 2600)
        return
      }
      if (action.type === "freeze")  { startFreezeCountdown(action.durationSeconds ?? 10, action.message); return }
      if (action.type === "block")   { setOverlay({ visible: true, actionType: "block", title: "Sesión bloqueada", message: action.message || "Tu sesión fue bloqueada por reiteración de incidentes." }); return }
      if (action.type === "flag_review") {
        setOverlay({ visible: true, actionType: "flag_review", title: "Sesión marcada para revisión", message: action.message || "Tu intento quedó marcado para revisión obligatoria." })
        window.setTimeout(() => setOverlay(prev => prev.actionType === "flag_review" ? { visible: false, actionType: "none" } : prev), 3200)
        return
      }
      if (action.type === "terminate_attempt") {
        setOverlay({ visible: true, actionType: "terminate_attempt", title: "Intento finalizado", message: action.message || "Tu intento fue finalizado por política de seguridad." })
        onTerminated?.({ sessionId, action })
      }
    },
    [onActionApplied, onTerminated, sessionId, startFreezeCountdown]
  )

  const sendSecurityEvent = useCallback(
    async (eventType: SecurityEventType, extraPayload?: Record<string, unknown>) => {
      if (!enabled || !sessionId || isSendingRef.current) return
      if (overlay.actionType === "terminate_attempt") return
      try {
        isSendingRef.current = true
        const base = getPayloadBase()
        const body: SecurityEventInput = {
          sessionId, examId, submissionId, eventType,
          questionIndex: base.questionIndex,
          clientTimeLeft: base.clientTimeLeft,
          payload: { ...base.payload, ...(extraPayload ?? {}) },
        }
        const res  = await fetch("/api/exam-security/event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        const json = await res.json().catch(() => null)
        if (json?.data?.action) applyAction(json.data.action)
      } catch {}
      finally { isSendingRef.current = false }
    },
    [enabled, sessionId, overlay.actionType, getPayloadBase, examId, submissionId, applyAction]
  )

  const sendHeartbeat = useCallback(async () => {
    if (!sessionId || !enabled || overlay.actionType === "terminate_attempt") return
    try {
      await fetch("/api/exam-security/session/heartbeat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, examId, submissionId, payload: getClientMetadata() }),
      })
    } catch {}
  }, [sessionId, enabled, overlay.actionType, examId, submissionId, getClientMetadata])

  // ── Session start ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !examId || mountedRef.current) return
    mountedRef.current = true
    prevInnerSize.current = { w: window.innerWidth, h: window.innerHeight }
    ;(async () => {
      try {
        const res  = await fetch("/api/exam-security/session/start", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ examId, submissionId, studentName, studentCourse, studentRut, clientMetadata: getClientMetadata() }),
        })
        const json = await res.json()
        if (!json?.success) return
        setSessionId(json.sessionId)
        setPolicy(json.policy ?? DEFAULT_POLICY)
        setSession(json.session ?? null)
        onSessionReady?.({ sessionId: json.sessionId, policy: json.policy ?? DEFAULT_POLICY, session: json.session ?? null })
        if (json.policy?.requireFullscreen) setTimeout(() => enterFullscreen(), 400)
      } catch {}
    })()
  }, [enabled, examId, submissionId, studentName, studentCourse, studentRut, getClientMetadata, enterFullscreen, onSessionReady])

  // ── Heartbeat ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId || !enabled) return
    heartbeatRef.current = window.setInterval(() => sendHeartbeat(), (policy.heartbeatIntervalSec || 10) * 1000)
    return () => { if (heartbeatRef.current) window.clearInterval(heartbeatRef.current) }
  }, [sessionId, enabled, policy.heartbeatIntervalSec, sendHeartbeat])

  // ── DOM event listeners ────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !sessionId) return

    const onVisibilityChange = () =>
      document.visibilityState === "hidden"
        ? sendSecurityEvent("tab_hidden")
        : sendSecurityEvent("visibility_return")

    const onBlur  = () => sendSecurityEvent("window_blur")
    const onFocus = () => sendSecurityEvent("window_focus_return")

    const onFullscreenChange = () => {
      if (document.fullscreenElement) {
        sendSecurityEvent("fullscreen_reenter")
      } else {
        sendSecurityEvent("fullscreen_exit")
        setTimeout(() => enterFullscreen(), 600)   // re-enter automático
      }
    }

    const onCopy        = (e: ClipboardEvent) => { if (!policy.blockCopyPaste)     return; e.preventDefault(); e.stopImmediatePropagation(); sendSecurityEvent("copy_attempt") }
    const onPaste       = (e: ClipboardEvent) => { if (!policy.blockCopyPaste)     return; e.preventDefault(); e.stopImmediatePropagation(); sendSecurityEvent("paste_attempt") }
    const onCut         = (e: ClipboardEvent) => { if (!policy.blockCopyPaste)     return; e.preventDefault(); e.stopImmediatePropagation(); sendSecurityEvent("cut_attempt") }
    const onContextMenu = (e: MouseEvent)     => { if (!policy.blockContextMenu)   return; e.preventDefault(); e.stopImmediatePropagation(); sendSecurityEvent("contextmenu_attempt") }
    const onDragStart   = (e: DragEvent)      => { e.preventDefault(); sendSecurityEvent("drag_attempt") }
    const onBeforePrint = ()                  => sendSecurityEvent("print_attempt", { method: "browser_menu" })
    const onOffline     = ()                  => sendSecurityEvent("network_offline", { online: false })
    const onOnline      = ()                  => sendSecurityEvent("network_online",  { online: true })
    const onBeforeUnload = (e: BeforeUnloadEvent) => { sendSecurityEvent("reload_attempt"); e.preventDefault(); e.returnValue = "" }

    const onKeyDown = (e: KeyboardEvent) => {
      if (!policy.blockShortcuts) return
      const key = e.key; const keyLo = key.toLowerCase()
      const ctrl = e.ctrlKey || e.metaKey; const shift = e.shiftKey; const alt = e.altKey

      const block = () => { e.preventDefault(); e.stopImmediatePropagation() }

      // Función
      if (BLOCKED_FUNCTION_KEYS.has(key))                                       { block(); sendSecurityEvent("blocked_shortcut", { key }); return }
      // Escape
      if (key === "Escape")                                                       { block(); sendSecurityEvent("blocked_shortcut", { key }); return }
      // PrintScreen
      if (key === "PrintScreen" || key === "Snapshot")                           { block(); sendSecurityEvent("print_attempt",    { key, method: "printscreen" }); return }
      // Alt+F4 / Alt+Tab
      if (alt && (key === "F4" || key === "Tab"))                                { block(); sendSecurityEvent("blocked_shortcut", { key, altKey: true }); return }
      // Meta / Win key
      if (key === "Meta" || key === "OS")                                        { block(); sendSecurityEvent("blocked_shortcut", { key: "Meta" }); return }

      if (ctrl) {
        if (keyLo === "p")                                                        { block(); sendSecurityEvent("print_attempt",    { key, ctrlKey: ctrl }); return }
        if (keyLo === "r")                                                        { block(); sendSecurityEvent("reload_attempt",   { key, ctrlKey: ctrl }); return }
        if (key === "Tab")                                                        { block(); sendSecurityEvent("blocked_shortcut", { key: "Ctrl+Tab" }); return }
        if (shift && BLOCKED_CTRL_SHIFT_KEYS.has(keyLo))                        { block(); sendSecurityEvent("blocked_shortcut", { key, ctrlKey: ctrl, shiftKey: true }); return }
        if (BLOCKED_CTRL_KEYS.has(keyLo))                                        { block(); sendSecurityEvent("blocked_shortcut", { key, ctrlKey: ctrl, shiftKey: shift, altKey: alt }); return }
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "F11" || e.key === "Meta" || e.key === "PrintScreen" || BLOCKED_FUNCTION_KEYS.has(e.key)) {
        e.preventDefault(); e.stopImmediatePropagation()
      }
    }

    document.addEventListener("visibilitychange",  onVisibilityChange)
    window.addEventListener("blur",                onBlur)
    window.addEventListener("focus",               onFocus)
    document.addEventListener("fullscreenchange",  onFullscreenChange)
    document.addEventListener("copy",              onCopy,        { capture: true })
    document.addEventListener("paste",             onPaste,       { capture: true })
    document.addEventListener("cut",               onCut,         { capture: true })
    document.addEventListener("contextmenu",       onContextMenu, { capture: true })
    document.addEventListener("dragstart",         onDragStart,   { capture: true })
    document.addEventListener("keydown",           onKeyDown,     { capture: true })
    document.addEventListener("keyup",             onKeyUp,       { capture: true })
    window.addEventListener("beforeunload",        onBeforeUnload)
    window.addEventListener("offline",             onOffline)
    window.addEventListener("online",              onOnline)
    window.addEventListener("beforeprint",         onBeforePrint)

    return () => {
      document.removeEventListener("visibilitychange",  onVisibilityChange)
      window.removeEventListener("blur",                onBlur)
      window.removeEventListener("focus",               onFocus)
      document.removeEventListener("fullscreenchange",  onFullscreenChange)
      document.removeEventListener("copy",              onCopy,        true)
      document.removeEventListener("paste",             onPaste,       true)
      document.removeEventListener("cut",               onCut,         true)
      document.removeEventListener("contextmenu",       onContextMenu, true)
      document.removeEventListener("dragstart",         onDragStart,   true)
      document.removeEventListener("keydown",           onKeyDown,     true)
      document.removeEventListener("keyup",             onKeyUp,       true)
      window.removeEventListener("beforeunload",        onBeforeUnload)
      window.removeEventListener("offline",             onOffline)
      window.removeEventListener("online",              onOnline)
      window.removeEventListener("beforeprint",         onBeforePrint)
    }
  }, [enabled, sessionId, policy, sendSecurityEvent, enterFullscreen])

  // ── Detección de DevTools (resize heurístico) ─────────────────────────────
  useEffect(() => {
    if (!enabled || !sessionId) return
    const onResize = () => {
      const w = window.innerWidth; const h = window.innerHeight
      const prev = prevInnerSize.current
      if (prev.w > 0) {
        const dw = prev.w - w; const dh = prev.h - h
        if ((dw >= DEVTOOLS_WIDTH_THRESHOLD && dh < 50) || (dh >= DEVTOOLS_HEIGHT_THRESHOLD && dw < 50)) {
          if (!devtoolsOpenRef.current) {
            devtoolsOpenRef.current = true
            sendSecurityEvent("blocked_shortcut", { detail: "devtools_resize", dw, dh })
          }
        } else {
          devtoolsOpenRef.current = false
        }
      }
      prevInnerSize.current = { w, h }
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [enabled, sessionId, sendSecurityEvent])

  // ── CSS de seguridad global ────────────────────────────────────────────────
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
      .exam-dev-input {
        user-select: text !important;
        -webkit-user-select: text !important;
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
