"use client"

import { useEffect, useRef } from "react"
import katex from "katex"
import "katex/dist/katex.min.css"

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

// Normalize common LaTeX issues: unescaped commands, unicode arrows as backslash, etc.
function normalizeLatex(raw: string): string {
  let s = String(raw || "")
  // Unicode fake backslashes
  s = s.replace(/[↑↗⬆▲∧⇒⁄∖⧵]/g, "\\")
  // \( \) → $  $
  s = s.replace(/\\\(([^)]*?)\\\)/g, (_, e) => `$${e}$`)
  // \[ \] → $$ $$
  s = s.replace(/\\\[([^\]]*?)\\\]/g, (_, e) => `$$${e}$$`)
  return s
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
    return latex
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
        if (seg.type === "text") return seg.content
        return renderMath(seg.content, seg.type === "block")
      })
      .join("")
  }, [text])

  return <span ref={ref} className={className} />
}
