"use client"

import "katex/dist/katex.min.css"
import ReactMarkdown from "react-markdown"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"

const FAKE_BACKSLASH_RE = /[\u2191\u2197\u2B06\u25B2\u2227\u21D2\u2044\u2216\u29F5]/g

const LATEX_COMMANDS = [
  "frac",
  "sqrt",
  "sum",
  "int",
  "prod",
  "lim",
  "infty",
  "partial",
  "times",
  "cdot",
  "div",
  "pm",
  "leq",
  "geq",
  "neq",
  "approx",
  "equiv",
  "pi",
  "alpha",
  "beta",
  "gamma",
  "theta",
  "lambda",
  "sigma",
  "omega",
  "Delta",
  "Sigma",
  "bar",
  "overline",
  "left",
  "right",
  "text",
  "mathbf",
  "mathrm",
  "mathit",
  "vec",
  "hat",
  "sin",
  "cos",
  "tan",
  "log",
  "ln",
  "max",
  "min",
]

const MISSING_BACKSLASH_RE = new RegExp(
  `(?<!\\\\)\\b(${LATEX_COMMANDS.join("|")})(?=\\s*[{\\s^_\\(\\[])`,
  "g"
)

function normalizeLatex(raw: string): string {
  let s = String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")

  s = s.replace(FAKE_BACKSLASH_RE, "\\")
  s = s
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, expr) => `$${expr}$`)
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, expr) => `$$${expr}$$`)

  s = s.replace(MISSING_BACKSLASH_RE, (_, cmd) => `\\${cmd}`)

  s = s
    .replace(/(?<!\\)\bfrac(?=\s*[{])/g, "\\frac")
    .replace(/(?<!\\)\bsqrt(?=\s*[{[])/g, "\\sqrt")
    .replace(/(?<!\\)\btimes\b/g, "\\times")
    .replace(/(?<!\\)\bcdot\b/g, "\\cdot")
    .replace(/(?<!\\)\bdiv\b/g, "\\div")
    .replace(/(?<!\\)\bbar(?=\s*[{])/g, "\\bar")
    .replace(/(?<!\\)\boverline(?=\s*[{])/g, "\\overline")

  return s
}

function protectExistingMath(text: string) {
  const blocks: string[] = []

  const protectedText = text.replace(/\$\$[\s\S]*?\$\$|\$[^$\n]+\$/g, (match) => {
    const key = `§§KEEPBLOCK${blocks.length}§§`
    blocks.push(match)
    return key
  })

  return { protectedText, blocks }
}

function restoreExistingMath(text: string, blocks: string[]) {
  let s = text
  blocks.forEach((block, i) => {
    const key = `§§KEEPBLOCK${i}§§`
    s = s.replaceAll(key, block)
  })
  return s
}

function wrapLatexFragments(text: string): string {
  let s = text

  s = s.replace(
    /(\\frac\s*\{[^{}]+\}\s*\{[^{}]+\})/g,
    " $1 "
  )

  s = s.replace(
    /(\\sqrt(?:\[[^\]]+\])?\s*\{[^{}]+\})/g,
    " $1 "
  )

  s = s.replace(
    /((?:\d+|[A-Za-z]+|\\frac\s*\{[^{}]+\}\s*\{[^{}]+\}|\\sqrt(?:\[[^\]]+\])?\s*\{[^{}]+\})\s*(?:\\times|\\cdot|\\div)\s*(?:\d+|[A-Za-z]+|\\frac\s*\{[^{}]+\}\s*\{[^{}]+\}|\\sqrt(?:\[[^\]]+\])?\s*\{[^{}]+\}))/g,
    " $1 "
  )

  s = s.replace(
    /((?:[A-Za-z0-9]+)(?:\^\{[^{}]+\}|\^[A-Za-z0-9]+|_\{[^{}]+\}|_[A-Za-z0-9]+))/g,
    " $1 "
  )

  s = s.replace(
    /((?:\d+\.)?\\bar\s*\{[^{}]+\})/g,
    " $1 "
  )

  s = s.replace(
    /(?<!\$)(\\(?:frac|sqrt|times|cdot|div|bar|overline|pi|alpha|beta|gamma|theta|lambda|sigma|omega|Delta|Sigma|sin|cos|tan|log|ln|left|right)\b[\s\S]*?)(?=(?:\s+[A-ZÁÉÍÓÚÑ¿¡][^$\\]|[.,;:]?\s|$))/g,
    (_m, expr) => {
      const cleanExpr = expr.trim()
      return cleanExpr ? ` $${cleanExpr}$ ` : expr
    }
  )

  s = s.replace(/\s{2,}/g, " ").trim()

  return s
}

function preprocessText(raw: string): string {
  const normalized = normalizeLatex(raw)
  const { protectedText, blocks } = protectExistingMath(normalized)
  const processed = wrapLatexFragments(protectedText)
  return restoreExistingMath(processed, blocks)
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
