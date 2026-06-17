"use client"

import { useEffect, useMemo, useState } from "react"
import katex from "katex"
import "katex/dist/katex.min.css"
import { normalizeMathTextForDisplay } from "@/lib/exam/latex-response"

const PATCH_ATTR = "data-eduai-review-latex-rendered"
const TOAST_TIMEOUT = 4200

function isResultsPage() {
  return typeof window !== "undefined" && window.location.pathname.startsWith("/examen/resultados/")
}

function getExamIdFromPath() {
  if (typeof window === "undefined") return ""
  const match = window.location.pathname.match(/^\/examen\/resultados\/([^/?#]+)/)
  return match ? decodeURIComponent(match[1]) : ""
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
  let last = 0
  let html = ""
  let match: RegExpExecArray | null

  while ((match = regex.exec(normalized)) !== null) {
    html += escapeHtml(normalized.slice(last, match.index))
    const token = match[0]
    if (token.startsWith("$$")) {
      html += renderMath(token.slice(2, -2), true)
    } else {
      html += renderMath(token.slice(1, -1), false)
    }
    last = match.index + token.length
  }

  html += escapeHtml(normalized.slice(last))
  return html.replace(/\n/g, "<br />")
}

function looksLikeRawMath(value: string) {
  return /\\(frac|sqrt|begin|end|times|cdot|div|leq|geq|neq|approx|pi)\b/.test(value || "")
}

function shouldPatchElement(element: Element) {
  if (!(element instanceof HTMLElement)) return false
  if (element.hasAttribute(PATCH_ATTR)) return false
  if (element.closest("textarea,input,select,script,style")) return false
  if (element.children.length > 0 && element.querySelector(".katex")) return false

  const text = (element.textContent || "").trim()
  if (!text || text.length > 900) return false
  if (!looksLikeRawMath(text)) return false

  const reviewModal = element.closest("[class*='max-w-4xl'],[class*='rounded-2xl'],[role='dialog']")
  const resultPage = window.location.pathname.startsWith("/examen/resultados/")
  return Boolean(reviewModal || resultPage)
}

function patchLatexInResults() {
  if (!isResultsPage()) return

  const candidates = Array.from(document.querySelectorAll("p,span,div"))
  for (const element of candidates) {
    if (!shouldPatchElement(element)) continue
    const text = (element.textContent || "").trim()
    element.innerHTML = renderMixedText(text)
    element.setAttribute(PATCH_ATTR, "true")
    element.classList.add("eduai-rendered-math")
  }
}

async function rescoreExam(examId: string) {
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

export default function ResultsReviewLatexFix() {
  const [active, setActive] = useState(false)
  const [message, setMessage] = useState("")
  const examId = useMemo(() => (active ? getExamIdFromPath() : ""), [active])

  useEffect(() => {
    const sync = () => setActive(isResultsPage())
    sync()
    const interval = window.setInterval(sync, 1000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!active) return

    let timer: ReturnType<typeof setTimeout> | null = null
    const schedule = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(patchLatexInResults, 100)
    }

    schedule()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    const interval = window.setInterval(patchLatexInResults, 1200)

    return () => {
      if (timer) clearTimeout(timer)
      observer.disconnect()
      window.clearInterval(interval)
    }
  }, [active])

  useEffect(() => {
    if (!active || !examId) return

    let cancelled = false
    rescoreExam(examId)
      .then((changed) => {
        if (cancelled || !changed) return
        setMessage("Se recalcularon respuestas matemáticas. Recarga para ver nota/puntajes actualizados.")
        setTimeout(() => setMessage(""), TOAST_TIMEOUT)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [active, examId])

  if (!active || !message) return null

  return (
    <div className="fixed bottom-24 right-5 z-[120] max-w-sm rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-xs font-semibold text-emerald-800 shadow-2xl">
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
