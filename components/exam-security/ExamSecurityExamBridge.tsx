// components/exam-security/ExamSecurityExamBridge.tsx

"use client"

import { useCallback, useEffect } from "react"
import type { SecurityPolicy, SecuritySessionRecord } from "@/lib/exam-security/types"
import ExamSecurityMount from "./ExamSecurityMount"
import { useExamSecurityIntegration } from "@/hooks/useExamSecurityIntegration"

type Props = {
  examId: string
  submissionId?: string | null
  studentName?: string | null
  studentCourse?: string | null
  studentRut?: string | null
  currentQuestionIndex?: number
  timeLeft?: number
  enabled?: boolean

  /**
   * Debe activarse cuando el examen ya fue entregado correctamente.
   */
  isSubmitted?: boolean

  onForceSubmit?: (reason: string) => Promise<void> | void
  onSecurityTerminate?: (reason: string) => void
  onSessionReady?: (payload: { sessionId: string }) => void
}

export default function ExamSecurityExamBridge({
  examId,
  submissionId = null,
  studentName = null,
  studentCourse = null,
  studentRut = null,
  currentQuestionIndex = 0,
  timeLeft = 0,
  enabled = true,
  isSubmitted = false,
  onForceSubmit,
  onSecurityTerminate,
  onSessionReady,
}: Props) {
  const {
    securitySessionId,
    lastSecurityAction,
    wasSecurityTerminated,
    handleSessionReady: _handleSessionReady,
    handleActionApplied,
    handleTerminated,
    closeSecurityAsFinished,
    closeSecurityAsTerminated,
  } = useExamSecurityIntegration({
    examId,
    submissionId,
    enabled,
    onForceSubmit,
    onSecurityTerminate: (payload) => {
      onSecurityTerminate?.(
        payload.action.message || "El intento fue terminado por seguridad."
      )
    },
  })

  // Cierre normal por entrega del examen
  useEffect(() => {
    if (!enabled) return
    if (!isSubmitted) return

    void closeSecurityAsFinished(
      "Entrega normal del examen por parte del estudiante."
    )
  }, [enabled, isSubmitted, closeSecurityAsFinished])

  // Cierre por tiempo agotado
  useEffect(() => {
    if (!enabled) return
    if (typeof timeLeft !== "number") return
    if (timeLeft > 0) return
    if (isSubmitted) return

    void closeSecurityAsFinished("Tiempo agotado del examen.")
  }, [enabled, timeLeft, isSubmitted, closeSecurityAsFinished])

  // Cierre por terminación de seguridad
  useEffect(() => {
    if (!enabled) return
    if (!wasSecurityTerminated) return

    void closeSecurityAsTerminated(
      "Intento terminado por el motor de seguridad del examen."
    )
  }, [enabled, wasSecurityTerminated, closeSecurityAsTerminated])

  const handleSessionReady = useCallback(
    (payload: {
      sessionId: string
      policy: SecurityPolicy
      session: SecuritySessionRecord | null
    }) => {
      _handleSessionReady(payload)
      onSessionReady?.({ sessionId: payload.sessionId })
    },
    [_handleSessionReady, onSessionReady]
  )

  return (
    <>
      <ExamSecurityMount
        examId={examId}
        submissionId={submissionId}
        studentName={studentName}
        studentCourse={studentCourse}
        studentRut={studentRut}
        currentQuestionIndex={currentQuestionIndex}
        timeLeft={timeLeft}
        enabled={enabled}
        onSessionReady={handleSessionReady}
        onActionApplied={handleActionApplied}
        onTerminated={handleTerminated}
      />

      <div
        className="hidden"
        data-security-session-id={securitySessionId ?? ""}
        data-security-last-action={lastSecurityAction?.type ?? ""}
        data-security-terminated={wasSecurityTerminated ? "true" : "false"}
      />
    </>
  )
}
