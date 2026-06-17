"use client"

import { useEffect } from "react"
import { buildReadableDevelopmentAnswer, normalizeLatexSource, normalizeMathTextForDisplay } from "@/lib/exam/latex-response"

const PATCH_KEY = "__eduaiExamLatexAnswerFix"

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
    // ya queda guardado en el artefacto del cuaderno y se puede revisar desde resultados.
    devText: readable || answer.devText || displayLatex,
    developmentLatex: "",
    developmentLatexSource: latex,
    developmentRenderedText: displayLatex,
  }
}

export default function ExamLatexAnswerFix() {
  useEffect(() => {
    if (typeof window === "undefined") return
    const win = window as typeof window & Record<string, any>
    if (win[PATCH_KEY]) return

    const originalFetch = window.fetch.bind(window)
    win[PATCH_KEY] = true

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
        const method = String(init?.method || "GET").toUpperCase()

        if (isExamPage() && method === "POST" && url.includes("/api/agents/examen-docente") && typeof init?.body === "string") {
          const body = JSON.parse(init.body)

          if (body?.action === "submit" && Array.isArray(body.answers)) {
            const nextBody = {
              ...body,
              answers: body.answers.map(normalizeAnswer),
            }
            return originalFetch(input, { ...init, body: JSON.stringify(nextBody) })
          }
        }
      } catch {
        // Se deja pasar la petición original si no corresponde a entrega de examen.
      }

      return originalFetch(input, init)
    }
  }, [])

  return null
}
