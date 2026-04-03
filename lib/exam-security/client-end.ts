// lib/exam-security/client-end.ts

type EndSecuritySessionInput = {
  sessionId: string
  examId: string
  submissionId?: string | null
  status?: "finished" | "terminated"
  reason?: string
}

export async function endSecuritySession({
  sessionId,
  examId,
  submissionId = null,
  status = "finished",
  reason,
}: EndSecuritySessionInput) {
  try {
    const res = await fetch("/api/exam-security/session/end", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId,
        examId,
        submissionId,
        status,
        reason,
      }),
    })

    const json = await res.json().catch(() => null)

    return {
      ok: res.ok,
      data: json,
    }
  } catch (error) {
    console.error("[exam-security/client-end:endSecuritySession]", error)

    return {
      ok: false,
      data: null,
    }
  }
}
