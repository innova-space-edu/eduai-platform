// components/exam-security/ExamSecurityMount.tsx

"use client"

import ExamSecurityClient from "./ExamSecurityClient"
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

type Props = {
  examId: string
  submissionId?: string | null
  studentName?: string | null
  studentCourse?: string | null
  studentRut?: string | null
  currentQuestionIndex?: number
  timeLeft?: number
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

export default function ExamSecurityMount({
  examId,
  submissionId = null,
  studentName = null,
  studentCourse = null,
  studentRut = null,
  currentQuestionIndex = 0,
  timeLeft = 0,
  enabled = true,
  onSessionReady,
  onActionApplied,
  onTerminated,
}: Props) {
  return (
    <ExamSecurityClient
      examId={examId}
      submissionId={submissionId}
      studentName={studentName}
      studentCourse={studentCourse}
      studentRut={studentRut}
      enabled={enabled}
      getCurrentQuestionIndex={() => currentQuestionIndex}
      getCurrentTimeLeft={() => timeLeft}
      onSessionReady={onSessionReady}
      onActionApplied={onActionApplied}
      onTerminated={onTerminated}
    />
  )
}
