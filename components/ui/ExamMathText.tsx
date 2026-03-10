"use client"

import "katex/dist/katex.min.css"
import ReactMarkdown from "react-markdown"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"

function repairCommonLatex(text: string) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")

    // Delimitadores alternativos -> estándar
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, expr) => `$${expr}$`)
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, expr) => `$$${expr}$$`)

    // Operadores pegados al siguiente término
    .replace(/\\cdot(?=[A-Za-z0-9(])/g, "\\cdot ")
    .replace(/\\times(?=[A-Za-z0-9(])/g, "\\times ")
    .replace(/\\div(?=[A-Za-z0-9(])/g, "\\div ")
    .replace(/\\pm(?=[A-Za-z0-9(])/g, "\\pm ")
    .replace(/\\leq(?=[A-Za-z0-9(])/g, "\\leq ")
    .replace(/\\geq(?=[A-Za-z0-9(])/g, "\\geq ")
    .replace(/\\neq(?=[A-Za-z0-9(])/g, "\\neq ")

    // Operadores pegados al término anterior
    .replace(/([A-Za-z0-9}])\\cdot/g, "$1 \\cdot")
    .replace(/([A-Za-z0-9}])\\times/g, "$1 \\times")
    .replace(/([A-Za-z0-9}])\\div/g, "$1 \\div")
    .replace(/([A-Za-z0-9}])\\pm/g, "$1 \\pm")
    .replace(/([A-Za-z0-9}])\\leq/g, "$1 \\leq")
    .replace(/([A-Za-z0-9}])\\geq/g, "$1 \\geq")
    .replace(/([A-Za-z0-9}])\\neq/g, "$1 \\neq")

    // Operadores básicos sin espacio
    .replace(/([A-Za-z0-9}])=([A-Za-z0-9{\\(])/g, "$1 = $2")
    .replace(/([A-Za-z0-9}])\+([A-Za-z0-9{\\(])/g, "$1 + $2")
    .replace(/([A-Za-z0-9}])-([A-Za-z0-9{\\(])/g, "$1 - $2")

    // Compactar espacios redundantes
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

function looksLikeMath(text: string) {
  return /\\frac|\\sqrt|\\cdot|\\times|\\div|\\pm|\\leq|\\geq|\\neq|\\pi|\\alpha|\\beta|\\theta|\\sum|\\int|\^|_|\{|\}/.test(
    text
  )
}

function hasMathDelimiters(text: string) {
  return /\$\$[\s\S]*\$\$|\$[^$]+\$/.test(text)
}

function normalizeMathDelimiters(text: string) {
  const repaired = repairCommonLatex(text)

  if (hasMathDelimiters(repaired)) {
    return repaired
  }

  // Si parece una expresión matemática simple, envolverla automáticamente
  if (looksLikeMath(repaired)) {
    return `$${repaired}$`
  }

  return repaired
}

export default function ExamMathText({
  text,
  className = "",
}: {
  text: string
  className?: string
}) {
  if (!text) return null

  const content = normalizeMathDelimiters(text)

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
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
