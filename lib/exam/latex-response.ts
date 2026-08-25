const MATH_ENVIRONMENTS = "matrix|bmatrix|pmatrix|aligned|array"

const UNICODE_MATH_REPLACEMENTS: Array<[RegExp, string]> = [
  [/×|✕|∙|·/g, "\\times"],
  [/÷/g, "\\div"],
  [/≤/g, "\\leq"],
  [/≥/g, "\\geq"],
  [/≠/g, "\\neq"],
  [/≈/g, "\\approx"],
  [/π/g, "\\pi"],
  [/→/g, "\\rightarrow"],
  [/←/g, "\\leftarrow"],
  [/↔/g, "\\leftrightarrow"],
  [/⇒/g, "\\Rightarrow"],
  [/⇌|⇄/g, "\\rightleftharpoons"],
]

function normalizeUnicodeMath(value: string) {
  let text = value
  for (const [pattern, replacement] of UNICODE_MATH_REPLACEMENTS) {
    text = text.replace(pattern, replacement)
  }

  return text
    .replace(/√\s*\{([^{}]+)\}/g, "\\sqrt{$1}")
    .replace(/√\s*\(([^()]+)\)/g, "\\sqrt{$1}")
    .replace(/√\s*([A-Za-z0-9]+(?:\s*[+\-]\s*[A-Za-z0-9]+)?)/g, "\\sqrt{$1}")
}

function repairCommonOcrLatex(value: string) {
  return value
    // Algunos OCR cambian la barra invertida por símbolos parecidos o la omiten.
    // Las flechas matemáticas se normalizan antes y no deben convertirse en barras.
    .replace(/[↑↗⬆▲∧⁄∖⧵]/g, "\\")
    .replace(/(^|[^\\])\/(frac|sqrt|sum|int|lim|sin|cos|tan|log|ln)\b/g, "$1\\$2")
    .replace(/(^|[^\\])\b(frac|sqrt|sum|int|lim|sin|cos|tan|log|ln)\s*\{/g, "$1\\$2{")
    .replace(/\\\s+(frac|sqrt|sum|int|lim|sin|cos|tan|log|ln)\b/g, "\\$1")
    .replace(/\\frac\s*([A-Za-z0-9])\s*([A-Za-z0-9])(?=$|[\s+\-=),.;])/g, "\\frac{$1}{$2}")
    .replace(/\\sqrt\s+([A-Za-z0-9]+)(?=$|[\s+\-=),.;])/g, "\\sqrt{$1}")
    // Fracciones simples escritas como 1/2 se transforman en LaTeX solo en contexto matemático.
    .replace(/(^|[\s=+\-([{])([0-9]+)\s*\/\s*([0-9]+)(?=$|[\s=+\-)\]}.,;])/g, "$1\\frac{$2}{$3}")
}

function repairAnswerBlanks(value: string): string {
  // La IA suele usar "__" o "____" para dejar espacios de coeficientes.
  // Dentro de LaTeX, "_" significa subíndice y rompe expresiones como:
  // $__ H_{2}+__ O_{2}→2H_{2}O$.
  // Se transforma el marcador de respuesta en un subrayado LaTeX válido.
  return value.replace(/(^|[^\\])_{2,}/g, (_match, prefix) => {
    return `${prefix}\\underline{\\hspace{0.9cm}}`
  })
}

export function normalizeLatexSource(value: unknown): string {
  let text = normalizeUnicodeMath(String(value ?? ""))
    .replace(/\r\n/g, "\n")
    .trim()

  text = repairCommonOcrLatex(text)
  text = repairAnswerBlanks(text)

  text = text
    .replace(/\\dfrac/g, "\\frac")
    .replace(/\\tfrac/g, "\\frac")
    .replace(/\\displaystyle\s*/g, "")
    // IMPORTANTE: \left y \right son comandos de tamaño, pero también son
    // prefijos de comandos válidos como \leftarrow, \rightarrow y
    // \rightleftharpoons. El límite de palabra evita convertir, por ejemplo,
    // \rightarrow en el texto crudo "arrow".
    .replace(/\\left\b/g, "")
    .replace(/\\right\b/g, "")
    .replace(/\\,/g, " ")
    .replace(/\\;/g, " ")
    .replace(/\\!/g, "")
    .replace(/\\protect\s*/g, "")

  // El OCR de escritura suele devolver {1 2} en vez de {12}. Se compactan
  // solo grupos formados por dígitos/espacios para no tocar texto normal.
  text = text.replace(/\{\s*([0-9]+(?:\s+[0-9]+)+)\s*\}/g, (_match, digits) => {
    return `{${String(digits).replace(/\s+/g, "")}}`
  })

  // Repara llaves duplicadas o espacios que rompen comandos comunes.
  text = text
    .replace(/\\frac\s*\{\s*([^{}]+?)\s*\}\s*\{\s*([^{}]+?)\s*\}/g, "\\frac{$1}{$2}")
    .replace(/\\sqrt\s*\{\s*([^{}]+?)\s*\}/g, "\\sqrt{$1}")

  return text.replace(/[ \t]+/g, " ").trim()
}

function hasLatexCommand(value: string): boolean {
  return /\\(frac|sqrt|sum|int|prod|lim|pi|times|cdot|div|leq|geq|neq|approx|begin|end|text|sin|cos|tan|log|ln|rightarrow|leftarrow|leftrightarrow|Rightarrow|rightleftharpoons|underline|hspace)\b/.test(value)
}

function hasLatexStructure(value: string): boolean {
  return /[_^]\{[^{}]+\}/.test(value)
}

function isMostlyMathLine(value: string): boolean {
  if (!hasLatexCommand(value) && !hasLatexStructure(value)) return false

  const withoutCommands = value
    .replace(new RegExp(`\\\\(?:begin|end)\\{(?:${MATH_ENVIRONMENTS})\\}`, "g"), "")
    .replace(/\\(?:frac|sqrt|sum|int|prod|lim|pi|times|cdot|div|leq|geq|neq|approx|text|sin|cos|tan|log|ln|rightarrow|leftarrow|leftrightarrow|Rightarrow|rightleftharpoons|underline|hspace)\b/g, "")
    .replace(/[_^]\{[^{}]+\}/g, "")
    .replace(/\{[^{}]*\}/g, "")

  // Palabras de 3+ letras suelen indicar prosa. Símbolos químicos como Fe, Mg,
  // CO, H u O no deben impedir que una ecuación química se trate como matemática.
  const proseWords = withoutCommands.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,}/g) || []
  const hasOperator = /[=+]|\\(?:rightarrow|leftarrow|leftrightarrow|Rightarrow|rightleftharpoons)\b/.test(value)

  if (hasOperator && proseWords.length <= 1) return true
  return proseWords.length === 0
}

function wrapLatexEnvironments(value: string): string {
  return value.replace(
    new RegExp(`(\\\\begin\\{(${MATH_ENVIRONMENTS})\\}[\\s\\S]*?\\\\end\\{\\2\\})`, "g"),
    (_match, block) => `\n$$${block}$$\n`,
  )
}

function wrapLatexFragmentsInProse(value: string): string {
  return value
    .replace(/(\\frac\s*\{[^{}]+\}\s*\{[^{}]+\})/g, "$$$1$")
    .replace(/(\\sqrt\s*\{[^{}]+\})/g, "$$$1$")
    .replace(/(\\underline\s*\{\s*\\hspace\s*\{[^{}]+\}\s*\})/g, "$$$1$")
    .replace(/(\\(?:pi|times|cdot|div|leq|geq|neq|approx|rightarrow|leftarrow|leftrightarrow|Rightarrow|rightleftharpoons)\b)/g, "$$$1$")
    // Fórmulas o variables con índices/superíndices fuera de delimitadores.
    .replace(/([A-Za-z0-9]+(?:[_^]\{[^{}]+\})[A-Za-z0-9]*(?:(?:[_^]\{[^{}]+\})[A-Za-z0-9]*)*)/g, "$$$1$")
}

function normalizeUndelimitedMath(value: string): string {
  // Conserva bloques ya delimitados y normaliza únicamente el texto restante.
  const segments = value.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g)

  return segments
    .map((segment) => {
      if (!segment) return ""
      if (segment.startsWith("$")) return segment

      return segment
        .split("\n")
        .map((line) => {
          if (!line.trim()) return line
          if (isMostlyMathLine(line)) return `$${line.trim()}$`
          return wrapLatexFragmentsInProse(line)
        })
        .join("\n")
    })
    .join("")
}

export function normalizeMathTextForDisplay(value: unknown): string {
  let text = normalizeLatexSource(value)
  if (!text) return ""

  // Evita que aparezcan comandos crudos como \begin{matrix} en la interfaz.
  // Si el OCR devuelve una matriz o desarrollo en LaTeX, se envuelve como bloque matemático.
  text = wrapLatexEnvironments(text)

  // Normaliza también contenido mixto: una misma pregunta puede contener prosa,
  // fórmulas ya delimitadas y otros fragmentos LaTeX sin $...$.
  return normalizeUndelimitedMath(text)
}

export function latexToReadableText(value: unknown): string {
  let text = normalizeLatexSource(value)
  if (!text) return ""

  text = text
    .replace(/\$\$?/g, "")
    .replace(new RegExp(`\\\\begin\\{(?:${MATH_ENVIRONMENTS})\\}`, "g"), "")
    .replace(new RegExp(`\\\\end\\{(?:${MATH_ENVIRONMENTS})\\}`, "g"), "")
    .replace(/\s*\\\\\s*/g, "\n")
    .replace(/\\underline\s*\{\s*\\hspace\s*\{[^{}]+\}\s*\}/g, "____")
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
    .replace(/\\rightarrow/g, "→")
    .replace(/\\leftarrow/g, "←")
    .replace(/\\leftrightarrow/g, "↔")
    .replace(/\\Rightarrow/g, "⇒")
    .replace(/\\rightleftharpoons/g, "⇌")
    .replace(/\\/g, "")
    .replace(/\s*&\s*/g, " ")
    .replace(/\{([^{}]+)\}/g, "$1")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  return text
}

function normalizePlainDevelopmentText(value: unknown): string {
  const source = String(value ?? "").trim()
  if (!source) return ""
  return hasLatexCommand(source) || hasLatexStructure(source) || /\$/.test(source)
    ? latexToReadableText(source)
    : source
}

export function buildReadableDevelopmentAnswer(answer: any): string {
  const latex = normalizeLatexSource(answer?.developmentLatex || answer?.latex || answer?.developmentLatexSource || "")
  const readableLatex = latexToReadableText(latex)
  const explicit = normalizePlainDevelopmentText(answer?.devText || "")

  const parts = [readableLatex, explicit]
    .map((part) => String(part || "").trim())
    .filter(Boolean)

  return Array.from(new Set(parts)).join("\n")
}
