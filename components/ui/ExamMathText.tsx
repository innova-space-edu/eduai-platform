"use client"

import "katex/dist/katex.min.css"
import ReactMarkdown from "react-markdown"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"

/**
 * Repara LaTeX mal formateado antes de renderizar.
 * Casos que maneja:
 * 1. Delimitadores alternativos \( \) y \[ \] → $ y $$
 * 2. Comandos LaTeX sin delimitadores $ (ej: "A = \frac{1}{2} \times b")
 * 3. "imes" suelto (resultado de \times mal parseado sin \)
 * 4. "rac{" suelto (resultado de \frac mal parseado sin \)
 */
function repairLatex(text: string): string {
  let s = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // Delimitadores alternativos → estándar
    .replace(/\\\(([^]*?)\\\)/g, (_, e) => `$${e}$`)
    .replace(/\\\[([^]*?)\\\]/g, (_, e) => `$$${e}$$`)

  // Reparar "rac{" → "\frac{" y "imes" → "\times" (LaTeX truncado)
  s = s
    .replace(/\brac\{/g, "\\frac{")
    .replace(/\bimes\b/g, "\\times")

  return s
}

/**
 * Detecta si el texto tiene LaTeX que necesita delimitadores.
 * Incluye casos sin delimitadores (ej: "A = \frac{1}{2}")
 */
function hasLatexContent(text: string): boolean {
  // Ya tiene delimitadores $
  if (/\$\$[\s\S]*?\$\$|\$[^$\n]+\$/.test(text)) return false // ya está bien

  return (
    /\\frac\s*\{/.test(text) ||
    /\\sqrt\s*[\[{]/.test(text) ||
    /\\sum\s*[_^]|\\int\s*[_^]|\\prod\s*[_^]/.test(text) ||
    /\\cdot|\\times|\\div|\\pm|\\leq|\\geq|\\neq|\\approx|\\equiv/.test(text) ||
    /\\pi\b|\\alpha\b|\\beta\b|\\gamma\b|\\theta\b|\\lambda\b/.test(text) ||
    /\\sigma\b|\\omega\b|\\infty\b|\\partial\b/.test(text) ||
    /\\left\s*[([|]|\\right\s*[)\]|]/.test(text) ||
    /\\text\s*\{|\\mathbf\s*\{|\\mathrm\s*\{/.test(text) ||
    /[a-zA-Z0-9]\^[{0-9]|[a-zA-Z0-9]_[{0-9]/.test(text)
  )
}

/**
 * Envuelve en $ el texto que contiene LaTeX sin delimitadores.
 * Si el texto mezcla texto normal con LaTeX (ej: "A = \frac{1}{2} \times b \times h"),
 * envuelve toda la expresión en $...$
 */
function wrapLatexIfNeeded(text: string): string {
  const repaired = repairLatex(text)

  // Si ya tiene delimitadores $ correctos, retornar reparado
  if (/\$\$[\s\S]*?\$\$|\$[^$\n]+\$/.test(repaired)) return repaired

  // Si contiene comandos LaTeX sin delimitadores, envolverlo
  if (hasLatexContent(repaired)) return `$${repaired}$`

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

  const content = wrapLatexIfNeeded(text)

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
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
