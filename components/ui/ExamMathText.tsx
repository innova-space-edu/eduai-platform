"use client"

import "katex/dist/katex.min.css"
import ReactMarkdown from "react-markdown"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"

// ─── Caracteres que Gemini/LLMs usan como sustituto de \ ─────────────────────
// U+2191 ↑  U+2197 ↗  U+2B06 ⬆  U+25B2 ▲  U+2227 ∧  U+21D2 ⇒
const FAKE_BACKSLASH_RE = /[\u2191\u2197\u2B06\u25B2\u2227\u21D2](?=[a-zA-Z])/g

// Comandos LaTeX conocidos — si aparecen sin \ real, añadirla
const LATEX_COMMANDS = [
  "frac","sqrt","sum","int","prod","lim","infty","partial",
  "times","cdot","div","pm","leq","geq","neq","approx","equiv",
  "pi","alpha","beta","gamma","theta","lambda","sigma","omega","Delta","Sigma",
  "left","right","text","mathbf","mathrm","mathit","vec","hat","bar",
  "sin","cos","tan","log","ln","max","min",
]
// Regex: palabra que coincide con un comando LaTeX precedido de espacio/inicio
// pero NO precedida de \ real
const MISSING_BACKSLASH_RE = new RegExp(
  `(?<!\\\\)\\b(${LATEX_COMMANDS.join("|")})(?=\\s*[{\\s^_\\(\\[])`,
  "g"
)

function repairLatex(raw: string): string {
  let s = String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")

  // 1. Reemplazar caracteres Unicode falsos por \ real
  s = s.replace(FAKE_BACKSLASH_RE, "\\")

  // 2. Delimitadores alternativos → estándar
  s = s
    .replace(/\\\(([^]*?)\\\)/g, (_, e) => `$${e}$`)
    .replace(/\\\[([^]*?)\\\]/g, (_, e) => `$$${e}$$`)

  // 3. Comandos LaTeX sin \ (ej: "frac{1}{2}" → "\frac{1}{2}")
  //    Solo aplica fuera de delimitadores $ ya existentes
  s = s.replace(MISSING_BACKSLASH_RE, (_, cmd) => `\\${cmd}`)

  return s
}

// ─── Detectar si contiene LaTeX sin delimitadores ────────────────────────────
function needsWrapping(text: string): boolean {
  // Ya tiene delimitadores $ → no envolver de nuevo
  if (/\$\$[\s\S]*?\$\$|\$[^$\n]+\$/.test(text)) return false

  return (
    /\\frac\s*\{/.test(text) ||
    /\\sqrt\s*[\[{]/.test(text) ||
    /\\(sum|int|prod)\s*[_^]/.test(text) ||
    /\\(times|cdot|div|pm|leq|geq|neq|approx|equiv)\b/.test(text) ||
    /\\(pi|alpha|beta|gamma|theta|lambda|sigma|omega|infty|partial)\b/.test(text) ||
    /\\(left|right)\s*[([|]/.test(text) ||
    /\\(text|mathbf|mathrm)\s*\{/.test(text) ||
    /[a-zA-Z0-9]\^[{0-9]/.test(text) ||
    /[a-zA-Z0-9]_[{0-9]/.test(text)
  )
}

function processText(text: string): string {
  const repaired = repairLatex(text)
  if (/\$\$[\s\S]*?\$\$|\$[^$\n]+\$/.test(repaired)) return repaired
  if (needsWrapping(repaired)) return `$${repaired}$`
  return repaired
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function ExamMathText({
  text,
  className = "",
}: {
  text: string
  className?: string
}) {
  if (!text) return null

  let content: string
  try {
    content = processText(text)
  } catch {
    content = text // fallback: texto crudo si algo falla
  }

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
        components={{
          p:    ({ children }) => <span>{children}</span>,
          code: ({ children }) => <code>{children}</code>,
          pre:  ({ children }) => <pre>{children}</pre>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
