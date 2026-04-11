"use client"

import "katex/dist/katex.min.css"
import ReactMarkdown from "react-markdown"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"

// Caracteres que a veces reemplazan "\" en respuestas IA
const FAKE_BACKSLASH_RE = /[\u2191\u2197\u2B06\u25B2\u2227\u21D2\u2044\u2216\u29F5]/g

const LATEX_COMMANDS = [
  "frac", "sqrt", "sum", "int", "prod", "lim", "infty", "partial",
  "times", "cdot", "div", "pm", "leq", "geq", "neq", "approx", "equiv",
  "pi", "alpha", "beta", "gamma", "theta", "lambda", "sigma", "omega",
  "Delta", "Sigma", "bar", "overline",
  "left", "right", "text", "mathbf", "mathrm", "mathit", "vec", "hat",
  "sin", "cos", "tan", "log", "ln", "max", "min"
]

const MISSING_BACKSLASH_RE = new RegExp(
  `(?<!\\\\)\\b(${LATEX_COMMANDS.join("|")})(?=\\s*[{\\s^_\\(\\[])`,
  "g"
)

function normalizeLatex(raw: string): string {
  let s = String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")

  // Reemplaza “slashes falsos”
  s = s.replace(FAKE_BACKSLASH_RE, "\\")

  // Delimitadores alternativos
  s = s
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, e) => `$${e}$`)
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, e) => `$$${e}$$`)

  // Comandos sin backslash
  s = s.replace(MISSING_BACKSLASH_RE, (_, cmd) => `\\${cmd}`)

  // Casos comunes mal formados
  s = s
    .replace(/(?<!\\)times\b/g, "\\times")
    .replace(/(?<!\\)cdot\b/g, "\\cdot")
    .replace(/(?<!\\)sqrt\b/g, "\\sqrt")
    .replace(/(?<!\\)frac\b/g, "\\frac")
    .replace(/(?<!\\)bar\b/g, "\\bar")
    .replace(/(?<!\\)overline\b/g, "\\overline")

  return s
}

function protectExistingMath(text: string) {
  const blocks: string[] = []
  const protectedText = text.replace(/\$\$[\s\S]*?\$\$|\$[^$\n]+\$/g, (m) => {
    const key = `@@MATH_${blocks.length}@@`
    blocks.push(m)
    return key
  })
  return { protectedText, blocks }
}

function restoreExistingMath(text: string, blocks: string[]) {
  let s = text
  blocks.forEach((b, i) => {
    s = s.replace(`@@MATH_${i}@@`, b)
  })
  return s
}

function wrapLatexFragments(text: string): string {
  let s = text

  // 1) fracciones
  s = s.replace(
    /(\\frac\s*\{[^{}]+\}\s*\{[^{}]+\})/g,
    " $1 "
  )

  // 2) raíces
  s = s.replace(
    /(\\sqrt(?:\[[^\]]+\])?\s*\{[^{}]+\})/g,
    " $1 "
  )

  // 3) potencias/subíndices simples
  s = s.replace(
    /((?:[A-Za-z0-9]+)(?:\^\{[^{}]+\}|\^[A-Za-z0-9]+|_\{[^{}]+\}|_[A-Za-z0-9]+))/g,
    " $1 "
  )

  // 4) productos/divisiones tipo 2 \times 3 o 2 \times \frac{3}{4}
  s = s.replace(
    /((?:\d+|[A-Za-z]+|\\frac\s*\{[^{}]+\}\s*\{[^{}]+\}|\\sqrt(?:\[[^\]]+\])?\s*\{[^{}]+\})\s*(?:\\times|\\cdot|\\div)\s*(?:\d+|[A-Za-z]+|\\frac\s*\{[^{}]+\}\s*\{[^{}]+\}|\\sqrt(?:\[[^\]]+\])?\s*\{[^{}]+\}))/g,
    " $1 "
  )

  // 5) decimales periódicos 0.\bar{3}
  s = s.replace(
    /((?:\d+\.)?\\bar\s*\{[^{}]+\})/g,
    " $1 "
  )

  // Ahora envuelve cada fragmento latex aislado con $
  s = s.replace(
    /(?<!\$)\s*(\\(?:frac|sqrt|times|cdot|div|bar|overline|pi|alpha|beta|gamma|theta|lambda|sigma|omega|Delta|Sigma|sin|cos|tan|log|ln|left|right)[^,.;\n]*)\s*(?!\$)/g,
    (_, expr) => ` $${expr.trim()}$ `
  )

  // Caso especial: expresiones completas como "2 \times \frac{3}{4}"
  s = s.replace(
    /(?<!\$)\b(\d+\s*(?:\\times|\\cdot|\\div)\s*\$\\frac\s*\{[^{}]+\}\s*\{[^{}]+\}\$)(?!\$)/g,
    (_, expr) => ` $${expr.replace(/\$/g, "").trim()}$ `
  )

  // Limpieza
  s = s.replace(/\s{2,}/g, " ").trim()
  return s
}

function preprocessText(raw: string): string {
  const normalized = normalizeLatex(raw)

  const { protectedText, blocks } = protectExistingMath(normalized)
  let processed = wrapLatexFragments(protectedText)
  processed = restoreExistingMath(processed, blocks)

  return processed
}

export default function ExamMathText({
  text,
  className = "",
}: {
  text: string
  className?: string
}) {
  if (!text) return null

  let content = text
  try {
    content = preprocessText(text)
  } catch {
    content = text
  }

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
        components={{
          p: ({ children }) => <span>{children}</span>,
          code: ({ children }) => <code>{children}</code>,
          pre: ({ children }) => <pre>{children}</pre>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
