// components/exam-security/ExamSecurityExamBridge.tsx

"use client"

import { useEffect } from "react"
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

  isSubmitted?: boolean
  onForceSubmit?: (reason: string) => Promise<void> | void
  onSecurityTerminate?: (reason: string) => void
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
}: Props) {
  const {
    securitySessionId,
    lastSecurityAction,
    wasSecurityTerminated,
    handleSessionReady,
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

  useEffect(() => {
    if (!enabled) return
    if (!isSubmitted) return

    void closeSecurityAsFinished("Entrega normal del examen por parte del estudiante.")
  }, [enabled, isSubmitted, closeSecurityAsFinished])

  useEffect(() => {
    if (!enabled) return
    if (typeof timeLeft !== "number") return
    if (timeLeft > 0) return
    if (isSubmitted) return

    void closeSecurityAsFinished("Tiempo agotado del examen.")
  }, [enabled, timeLeft, isSubmitted, closeSecurityAsFinished])

  useEffect(() => {
    if (!enabled) return
    if (!wasSecurityTerminated) return

    void closeSecurityAsTerminated(
      "Intento terminado por el motor de seguridad del examen."
    )
  }, [enabled, wasSecurityTerminated, closeSecurityAsTerminated])

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
