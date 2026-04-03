// components/exam-security/ExamSecurityMount.tsx

"use client"

import ExamSecurityClient from "./ExamSecurityClient"

type Props = {
  examId: string
  submissionId?: string | null
  studentName?: string | null
  studentCourse?: string | null
  studentRut?: string | null
  currentQuestionIndex?: number
  timeLeft?: number
  enabled?: boolean
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
    />
  )
}
