"use client"

import { useEffect, useRef } from "react"
import katex from "katex"
import "katex/dist/katex.min.css"
import { normalizeMathTextForDisplay } from "@/lib/exam/latex-response"

// Split text into math and non-math segments
function parseSegments(text: string): { type: "text" | "block" | "inline"; content: string }[] {
  const segments: { type: "text" | "block" | "inline"; content: string }[] = []
  // Match $$...$$ first, then $...$
  const re = /(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g
  let last = 0
  let m: RegExpExecArray | null

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      segments.push({ type: "text", content: text.slice(last, m.index) })
    }
    const raw = m[0]
    if (raw.startsWith("$$")) {
      segments.push({ type: "block", content: raw.slice(2, -2) })
    } else {
      segments.push({ type: "inline", content: raw.slice(1, -1) })
    }
    last = m.index + raw.length
  }

  if (last < text.length) {
    segments.push({ type: "text", content: text.slice(last) })
  }

  return segments
}

function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function looksLikeEquation(value: string): boolean {
  const s = value.trim()
  if (!s.includes("=")) return false
  return /[a-zA-Z]\s*[+\-]?|\d/.test(s)
}

function autoFormatEquationList(raw: string): string {
  let text = String(raw || "").replace(/\r\n/g, "\n")

  // Si el docente ya usó saltos de línea, se respetan tal cual.
  if (text.includes("\n")) return text

  const lower = text.toLowerCase()
  const isLikelySystem =
    lower.includes("sistema") ||
    lower.includes("ecuacion") ||
    lower.includes("ecuación") ||
    lower.includes("igualación") ||
    lower.includes("sustitución")

  if (!isLikelySystem || !text.includes(":") || !text.includes("=")) return text

  const colonIndex = text.indexOf(":")
  const intro = text.slice(0, colonIndex + 1).trim()
  let rest = text.slice(colonIndex + 1).trim()

  if (!rest.includes(",")) return text

  let finalQuestion = ""
  const questionStart = rest.search(/[¿?]/)
  if (questionStart > 0) {
    finalQuestion = rest.slice(questionStart).trim()
    rest = rest.slice(0, questionStart).trim()
  }

  rest = rest.replace(/[.;:]\s*$/, "").trim()

  const equations = rest
    .split(/\s*,\s*/)
    .map((part) => part.trim().replace(/[.;:]\s*$/, ""))
    .filter(Boolean)

  if (equations.length < 2 || !equations.every(looksLikeEquation)) return text

  return [intro, ...equations, finalQuestion].filter(Boolean).join("\n")
}

// Normalize common LaTeX issues: unescaped commands, unicode arrows as backslash, etc.
function normalizeLatex(raw: string): string {
  const text = autoFormatEquationList(String(raw || ""))
  return normalizeMathTextForDisplay(text)
}

function renderMath(latex: string, display: boolean): string {
  try {
    return katex.renderToString(latex.trim(), {
      throwOnError: false,
      displayMode: display,
      strict: false,
      trust: false,
    })
  } catch {
    return escapeHtml(latex)
  }
}

export default function ExamMathText({
  text,
  className = "",
}: {
  text: string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const normalized = normalizeLatex(text || "")
    const segments = parseSegments(normalized)

    ref.current.innerHTML = segments
      .map((seg) => {
        if (seg.type === "text") return escapeHtml(seg.content)
        return renderMath(seg.content, seg.type === "block")
      })
      .join("")
  }, [text])

  return <span ref={ref} className={`whitespace-pre-wrap ${className}`.trim()} />
}
