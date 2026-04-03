// hooks/useExamSecurityIntegration.ts

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { endSecuritySession } from "@/lib/exam-security/client-end"
import type {
  SecurityActionType,
  SecurityPolicy,
  SecuritySessionRecord,
} from "@/lib/exam-security/types"

type SecurityActionPayload = {
  type?: SecurityActionType
  message?: string
  durationSeconds?: number
}

type UseExamSecurityIntegrationParams = {
  examId: string
  submissionId?: string | null
  enabled?: boolean
  onForceSubmit?: (reason: string) => Promise<void> | void
  onSecurityTerminate?: (payload: {
    sessionId: string | null
    action: SecurityActionPayload
  }) => void
}

export function useExamSecurityIntegration({
  examId,
  submissionId = null,
  enabled = true,
  onForceSubmit,
  onSecurityTerminate,
}: UseExamSecurityIntegrationParams) {
  const [securitySessionId, setSecuritySessionId] = useState<string | null>(null)
  const [securityPolicy, setSecurityPolicy] = useState<SecurityPolicy | null>(null)
  const [securitySession, setSecuritySession] =
    useState<SecuritySessionRecord | null>(null)
  const [lastSecurityAction, setLastSecurityAction] =
    useState<SecurityActionPayload | null>(null)
  const [wasSecurityTerminated, setWasSecurityTerminated] = useState(false)

  const hasClosedSessionRef = useRef(false)
  const forceSubmitTriggeredRef = useRef(false)

  const handleSessionReady = useCallback(
    (payload: {
      sessionId: string
      policy: SecurityPolicy
      session: SecuritySessionRecord | null
    }) => {
      setSecuritySessionId(payload.sessionId)
      setSecurityPolicy(payload.policy)
      setSecuritySession(payload.session)
    },
    []
  )

  const handleActionApplied = useCallback(
    (payload: {
      sessionId: string | null
      action: SecurityActionPayload
    }) => {
      setLastSecurityAction(payload.action)
    },
    []
  )

  const handleTerminated = useCallback(
    async (payload: {
      sessionId: string | null
      action: SecurityActionPayload
    }) => {
      setLastSecurityAction(payload.action)
      setWasSecurityTerminated(true)

      onSecurityTerminate?.(payload)

      if (!forceSubmitTriggeredRef.current) {
        forceSubmitTriggeredRef.current = true

        try {
          await onForceSubmit?.(
            payload.action.message || "Intento finalizado por política de seguridad."
          )
        } catch (error) {
          console.error(
            "[useExamSecurityIntegration] Error en onForceSubmit tras terminate",
            error
          )
        }
      }
    },
    [onForceSubmit, onSecurityTerminate]
  )

  const closeSecurityAsFinished = useCallback(
    async (reason = "Entrega normal del examen") => {
      if (!enabled) return
      if (!securitySessionId || !examId) return
      if (hasClosedSessionRef.current) return

      hasClosedSessionRef.current = true

      return endSecuritySession({
        sessionId: securitySessionId,
        examId,
        submissionId,
        status: "finished",
        reason,
      })
    },
    [enabled, securitySessionId, examId, submissionId]
  )

  const closeSecurityAsTerminated = useCallback(
    async (reason = "Intento terminado por seguridad") => {
      if (!enabled) return
      if (!securitySessionId || !examId) return
      if (hasClosedSessionRef.current) return

      hasClosedSessionRef.current = true

      return endSecuritySession({
        sessionId: securitySessionId,
        examId,
        submissionId,
        status: "terminated",
        reason,
      })
    },
    [enabled, securitySessionId, examId, submissionId]
  )

  const resetSecurityCloseGuard = useCallback(() => {
    hasClosedSessionRef.current = false
  }, [])

  useEffect(() => {
    if (!enabled) return
    if (!wasSecurityTerminated) return

    void closeSecurityAsTerminated(
      "La sesión fue terminada automáticamente por el motor de seguridad."
    )
  }, [enabled, wasSecurityTerminated, closeSecurityAsTerminated])

  return {
    securitySessionId,
    securityPolicy,
    securitySession,
    lastSecurityAction,
    wasSecurityTerminated,

    handleSessionReady,
    handleActionApplied,
    handleTerminated,

    closeSecurityAsFinished,
    closeSecurityAsTerminated,
    resetSecurityCloseGuard,
  }
}
