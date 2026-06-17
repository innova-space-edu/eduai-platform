export function normalizeLatexSource(value: unknown): string {
  let text = String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[↑↗⬆▲∧⇒⁄∖⧵]/g, "\\")
    .trim()

  text = text
    .replace(/\\dfrac/g, "\\frac")
    .replace(/\\tfrac/g, "\\frac")
    .replace(/\\left/g, "")
    .replace(/\\right/g, "")
    .replace(/\\,/g, " ")
    .replace(/\\;/g, " ")
    .replace(/\\!/g, "")
    .replace(/\\protect\s*/g, "")

  // El OCR de escritura suele devolver {1 2} en vez de {12}. Se compactan
  // solo grupos formados por dígitos/espacios para no tocar texto normal.
  text = text.replace(/\{\s*([0-9]+(?:\s+[0-9]+)+)\s*\}/g, (_match, digits) => {
    return `{${String(digits).replace(/\s+/g, "")}}`
  })

  return text.replace(/[ \t]+/g, " ").trim()
}

function hasLatexCommand(value: string): boolean {
  return /\\(frac|sqrt|sum|int|prod|lim|pi|times|cdot|div|leq|geq|neq|approx|begin|end|text|sin|cos|tan|log|ln)\b/.test(value)
}

function isMostlyMathLine(value: string): boolean {
  if (!hasLatexCommand(value)) return false
  const withoutCommands = value.replace(/\\[A-Za-z]+/g, "")
  const words = withoutCommands.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,}/g) || []
  return words.length === 0
}

function wrapLatexFragmentsInProse(value: string): string {
  return value
    .replace(/(\\frac\s*\{[^{}]+\}\s*\{[^{}]+\})/g, "$$$1$")
    .replace(/(\\sqrt\s*\{[^{}]+\})/g, "$$$1$")
    .replace(/(\\(?:pi|times|cdot|div|leq|geq|neq|approx)\b)/g, "$$$1$")
}

export function normalizeMathTextForDisplay(value: unknown): string {
  const text = normalizeLatexSource(value)
  if (!text) return ""
  if (/\$[^$]+\$|\$\$[\s\S]*?\$\$/.test(text)) return text

  if (!hasLatexCommand(text)) return text

  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean)
  return lines
    .map((line) => (isMostlyMathLine(line) ? `$${line}$` : wrapLatexFragmentsInProse(line)))
    .join("\n")
}

export function latexToReadableText(value: unknown): string {
  let text = normalizeLatexSource(value)
  if (!text) return ""

  text = text
    .replace(/\$\$?/g, "")
    .replace(/\\begin\{(?:matrix|bmatrix|pmatrix|aligned|array)\}/g, "")
    .replace(/\\end\{(?:matrix|bmatrix|pmatrix|aligned|array)\}/g, "")
    .replace(/\s*\\\\\s*/g, "\n")
    .replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, "$1/$2")
    .replace(/\\sqrt\s*\{([^{}]+)\}/g, "raíz($1)")
    .replace(/\\times/g, "×")
    .replace(/\\cdot/g, "·")
    .replace(/\\div/g, "÷")
    .replace(/\\leq/g, "≤")
    .replace(/\\geq/g, "≥")
    .replace(/\\neq/g, "≠")
    .replace(/\\approx/g, "≈")
    .replace(/\\pi/g, "π")
    .replace(/\\/g, "")
    .replace(/\s*&\s*/g, " ")
    .replace(/\{([^{}]+)\}/g, "$1")
    .replace(/[ \t]+/g, " ")
    .trim()

  return text
}

export function buildReadableDevelopmentAnswer(answer: any): string {
  const explicit = String(answer?.devText || "").trim()
  const latex = normalizeLatexSource(answer?.developmentLatex || answer?.latex || answer?.developmentLatexSource || "")
  const display = normalizeMathTextForDisplay(latex)
  const readable = latexToReadableText(latex)

  const parts = [readable, display, explicit]
    .map((part) => String(part || "").trim())
    .filter(Boolean)

  return Array.from(new Set(parts)).join("\n")
}
