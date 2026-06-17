"use client"

import { useEffect, useState } from "react"
import katex from "katex"
import "katex/dist/katex.min.css"
import { buildReadableDevelopmentAnswer, normalizeLatexSource, normalizeMathTextForDisplay } from "@/lib/exam/latex-response"

const PATCH_KEY = "__eduaiExamLatexAnswerFix"
const CACHE_TTL_MS = 6000
const RENDERED_ATTR = "data-eduai-latex-rendered"

function isExamPage() {
  return typeof window !== "undefined" && window.location.pathname.startsWith("/examen/p/")
}

function isResultsPage() {
  return typeof window !== "undefined" && window.location.pathname.startsWith("/examen/resultados/")
}

function getResultsExamId() {
  if (typeof window === "undefined") return ""
  const match = window.location.pathname.match(/^\/examen\/resultados\/([^/?#]+)/)
  return match ? decodeURIComponent(match[1]) : ""
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
      return { ...data, submission: rescored.submission }
    }
  } catch {}

  return data
}

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function renderMath(latex: string, displayMode = false) {
  try {
    return katex.renderToString(latex.trim(), {
      throwOnError: false,
      displayMode,
      strict: false,
      trust: false,
    })
  } catch {
    return escapeHtml(latex)
  }
}

function renderMixedText(raw: string) {
  const normalized = normalizeMathTextForDisplay(raw || "")
  const regex = /(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g
  let html = ""
  let last = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(normalized)) !== null) {
    html += escapeHtml(normalized.slice(last, match.index))
    const token = match[0]
    html += token.startsWith("$$")
      ? renderMath(token.slice(2, -2), true)
      : renderMath(token.slice(1, -1), false)
    last = match.index + token.length
  }

  html += escapeHtml(normalized.slice(last))
  return html.replace(/\n/g, "<br />")
}

function looksLikeRawLatex(text: string) {
  return /\\(frac|sqrt|begin|end|times|cdot|div|leq|geq|neq|approx|pi)\b/.test(text || "")
}

function patchResultsLatex() {
  if (!isResultsPage()) return
  const elements = Array.from(document.querySelectorAll("p,span,div"))
  for (const element of elements) {
    if (!(element instanceof HTMLElement)) continue
    if (element.hasAttribute(RENDERED_ATTR)) continue
    if (element.closest("textarea,input,select,script,style")) continue
    if (element.querySelector(".katex")) continue

    const raw = (element.textContent || "").trim()
    if (!raw || raw.length > 900 || !looksLikeRawLatex(raw)) continue

    element.innerHTML = renderMixedText(raw)
    element.setAttribute(RENDERED_ATTR, "true")
    element.classList.add("eduai-rendered-math")
  }
}

async function tryRescoreResultsExam() {
  const examId = getResultsExamId()
  if (!examId) return false

  const key = `eduai-results-math-rescore:${examId}`
  const last = Number(sessionStorage.getItem(key) || 0)
  if (Date.now() - last < 60_000) return false
  sessionStorage.setItem(key, String(Date.now()))

  const response = await fetch("/api/agents/exam-math-rescore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ examId }),
  })
  const data = await response.json().catch(() => ({}))
  return Boolean(response.ok && data?.success && data?.changed)
}

export default function ExamLatexAnswerFix() {
  const [message, setMessage] = useState("")

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
            const nextBody = { ...body, answers: body.answers.map(normalizeAnswer) }
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
      } catch {}

      return originalFetch(input, init)
    }
  }, [])

  useEffect(() => {
    if (!isResultsPage()) return

    let timer: ReturnType<typeof setTimeout> | null = null
    const schedule = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(patchResultsLatex, 120)
    }

    schedule()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    const interval = window.setInterval(patchResultsLatex, 1200)

    tryRescoreResultsExam()
      .then((changed) => {
        if (!changed) return
        setMessage("Se recalcularon respuestas matemáticas. Recarga para ver nota/puntajes actualizados.")
        setTimeout(() => setMessage(""), 4500)
      })
      .catch(() => {})

    return () => {
      if (timer) clearTimeout(timer)
      observer.disconnect()
      window.clearInterval(interval)
    }
  }, [])

  if (!message) return null

  return (
    <div className="fixed bottom-24 right-5 z-[120] max-w-sm rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-xs font-semibold text-emerald-800 shadow-2xl print:hidden">
      {message}
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="ml-2 rounded-xl bg-emerald-600 px-2 py-1 text-[11px] font-black text-white"
      >
        Recargar
      </button>
    </div>
  )
}
