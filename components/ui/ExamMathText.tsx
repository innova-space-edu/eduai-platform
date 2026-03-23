"use client"

import "katex/dist/katex.min.css"
import ReactMarkdown from "react-markdown"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"

/**
 * Repara LaTeX mal formateado antes de renderizar.
 * Solo convierte delimitadores alternativos (\( \) y \[ \]) al formato estándar.
 * NO modifica espacios alrededor de operadores para no romper texto normal.
 */
function repairCommonLatex(text: string) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // Delimitadores alternativos → estándar
    .replace(/\\\(([^]*?)\\\)/g, (_, expr) => `$${expr}$`)
    .replace(/\\\[([^]*?)\\\]/g, (_, expr) => `$$${expr}$$`)
    // Compactar espacios redundantes dentro de expresiones $...$
    .replace(/\$([^$]+)\$/g, (_, expr) => `$${expr.replace(/[ \t]{2,}/g, " ")}$`)
    .replace(/\$\$([^$]+)\$\$/g, (_, expr) => `$$${expr.replace(/[ \t]{2,}/g, " ")}$$`)
}

/**
 * Detecta si un fragmento de texto CONTIENE expresiones claramente matemáticas.
 * Conservador: solo detecta comandos LaTeX específicos o delimitadores $, NO detecta
 * llaves sueltas, guiones, acentos circunflejos u otros caracteres ambiguos.
 */
function looksLikeMath(text: string): boolean {
  return (
    // Comandos LaTeX específicos de matemáticas
    /\\frac\s*\{|\\sqrt\s*[\[{]|\\sum\s*[_^]|\\int\s*[_^]|\\prod\s*[_^]/.test(text) ||
    /\\cdot|\\times|\\div|\\pm|\\leq|\\geq|\\neq|\\approx|\\equiv/.test(text) ||
    /\\pi\b|\\alpha\b|\\beta\b|\\gamma\b|\\theta\b|\\lambda\b|\\sigma\b|\\omega\b/.test(text) ||
    /\\infty\b|\\partial\b|\\nabla\b|\\Delta\b|\\Sigma\b/.test(text) ||
    /\\text\s*\{|\\mathbf\s*\{|\\mathrm\s*\{|\\mathit\s*\{/.test(text) ||
    /\\left\s*[([|]|\\right\s*[)\]|]/.test(text) ||
    // Superíndices/subíndices solo si van con letras/números específicos
    /[a-zA-Z0-9]\^[{0-9]|[a-zA-Z0-9]_[{0-9]/.test(text)
  )
}

function hasMathDelimiters(text: string): boolean {
  return /\$\$[\s\S]*?\$\$|\$[^$\n]+\$/.test(text)
}

function normalizeMathDelimiters(text: string): string {
  const repaired = repairCommonLatex(text)

  // Si ya tiene delimitadores $ correctos, solo retornar reparado
  if (hasMathDelimiters(repaired)) return repaired

  // Solo auto-envolver si parece CLARAMENTE una expresión matemática LaTeX
  if (looksLikeMath(repaired)) return `$${repaired}$`

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
