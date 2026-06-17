"use client"

import { useEffect } from "react"
import { buildReadableDevelopmentAnswer, normalizeLatexSource, normalizeMathTextForDisplay } from "@/lib/exam/latex-response"

const PATCH_KEY = "__eduaiExamLatexAnswerFix"
const CACHE_TTL_MS = 6000

function isExamPage() {
  return typeof window !== "undefined" && window.location.pathname.startsWith("/examen/p/")
}

function normalizeAnswer(answer: any) {
  if (!answer || typeof answer !== "object") return answer
  if (!("developmentLatex" in answer) && !("devText" in answer)) return answer

  const latex = normalizeLatexSource(answer.developmentLatex || "")
  const displayLatex = normalizeMathTextForDisplay(latex)
  const readable = buildReadableDevelopmentAnswer({ ...answer, developmentLatex: latex })

  if (!latex && !readable) return answer

  return {
    ...answer,
    // Para la evaluación automática se envía una lectura humana. El LaTeX original
    // queda guardado como fuente para revisión docente, pero no se envía como código crudo.
    devText: readable || answer.devText || displayLatex,
    developmentLatex: "",
    developmentLatexSource: latex,
    developmentRenderedText: displayLatex,
  }
}

async function tryRescoreSubmission(originalFetch: typeof fetch, data: any) {
  const submissionId = data?.submission?.id
  if (!submissionId) return data

  try {
    const res = await originalFetch("/api/agents/exam-math-rescore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId }),
    })
    const rescored = await res.json().catch(() => ({}))
    if (res.ok && rescored?.success && rescored?.submission) {
      return {
        ...data,
        submission: rescored.submission,
      }
    }
  } catch {
    // Si el recalculo no está disponible, se usa la respuesta original.
  }

  return data
}

export default function ExamLatexAnswerFix() {
  useEffect(() => {
    if (typeof window === "undefined") return
    const win = window as typeof window & Record<string, any>
    if (win[PATCH_KEY]) return

    const originalFetch = window.fetch.bind(window)
    let lastRecognitionKey = ""
    let lastRecognitionAt = 0
    let lastRecognitionPayload: any = null
    win[PATCH_KEY] = true

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
        const method = String(init?.method || "GET").toUpperCase()

        if (isExamPage() && method === "POST" && url.includes("/api/whiteboard/recognize") && typeof init?.body === "string") {
          const key = init.body
          const now = Date.now()
          if (key === lastRecognitionKey && lastRecognitionPayload && now - lastRecognitionAt < CACHE_TTL_MS) {
            return new Response(JSON.stringify(lastRecognitionPayload), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          }

          const response = await originalFetch(input, init)
          const clone = response.clone()
          clone.json().then((payload) => {
            if (response.ok) {
              lastRecognitionKey = key
              lastRecognitionAt = Date.now()
              lastRecognitionPayload = payload
            }
          }).catch(() => {})
          return response
        }

        if (isExamPage() && method === "POST" && url.includes("/api/agents/examen-docente") && typeof init?.body === "string") {
          const body = JSON.parse(init.body)

          if (body?.action === "submit" && Array.isArray(body.answers)) {
            const nextBody = {
              ...body,
              answers: body.answers.map(normalizeAnswer),
            }
            const response = await originalFetch(input, { ...init, body: JSON.stringify(nextBody) })
            const data = await response.clone().json().catch(() => null)
            if (!response.ok || !data?.success) return response

            const finalData = await tryRescoreSubmission(originalFetch, data)
            return new Response(JSON.stringify(finalData), {
              status: response.status,
              statusText: response.statusText,
              headers: { "Content-Type": "application/json" },
            })
          }
        }
      } catch {
        // Se deja pasar la petición original si no corresponde a entrega/OCR de examen.
      }

      return originalFetch(input, init)
    }
  }, [])

  return null
}
