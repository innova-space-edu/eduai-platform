type LinearEquation = {
  a: number
  b: number
  c: number
  raw: string
}

type SystemSolution = {
  x: number
  y: number
  equations: LinearEquation[]
  determinant: number
  dx: number
  dy: number
}

const EPS = 1e-7

function normalizeMathText(value: string) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\$+/g, "")
    .replace(/[−–—]/g, "-")
    .replace(/\u2212/g, "-")
    .replace(/,/g, ".")
}

function parseNumber(raw: string): number {
  const s = String(raw || "").trim().replace(/\s+/g, "")
  if (!s || s === "+") return 1
  if (s === "-") return -1

  const frac = s.match(/^([+-]?\d+(?:\.\d+)?)\/([+-]?\d+(?:\.\d+)?)$/)
  if (frac) {
    const den = Number(frac[2])
    return den === 0 ? NaN : Number(frac[1]) / den
  }

  return Number(s)
}

function parseExpression(expr: string) {
  const cleaned = normalizeMathText(expr)
    .replace(/\*/g, "")
    .replace(/\s+/g, "")
    .replace(/(?<!^)-/g, "+-")

  const terms = cleaned.split("+").filter(Boolean)
  let x = 0
  let y = 0
  let c = 0

  for (const term of terms) {
    if (/x/i.test(term)) {
      const coeff = term.replace(/x/gi, "")
      const n = parseNumber(coeff)
      if (!Number.isFinite(n)) return null
      x += n
      continue
    }

    if (/y/i.test(term)) {
      const coeff = term.replace(/y/gi, "")
      const n = parseNumber(coeff)
      if (!Number.isFinite(n)) return null
      y += n
      continue
    }

    const n = parseNumber(term)
    if (!Number.isFinite(n)) return null
    c += n
  }

  return { x, y, c }
}

function parseEquation(line: string): LinearEquation | null {
  const raw = normalizeMathText(line).trim()
  if (!raw.includes("=")) return null

  const [leftRaw, rightRaw] = raw.split("=")
  if (!leftRaw || !rightRaw) return null

  const left = parseExpression(leftRaw)
  const right = parseExpression(rightRaw)
  if (!left || !right) return null

  const a = left.x - right.x
  const b = left.y - right.y
  const c = right.c - left.c

  if (Math.abs(a) < EPS && Math.abs(b) < EPS) return null
  return { a, b, c, raw }
}

function extractLinearSystem(question: string): LinearEquation[] {
  const text = normalizeMathText(question)
  const lines = text
    .split(/[\n;]/)
    .map((line) => line.trim())
    .filter(Boolean)

  const equations: LinearEquation[] = []

  for (const line of lines) {
    if (!line.includes("=")) continue
    const eq = parseEquation(line)
    if (eq) equations.push(eq)
  }

  if (equations.length >= 2) return equations.slice(0, 2)

  const compact = text.replace(/\s+/g, " ")
  const candidates = compact.match(/[+-]?\d*\s*x\s*[+-]\s*\d*\s*y\s*=\s*[+-]?\d+(?:\.\d+)?/gi) || []
  for (const candidate of candidates) {
    const eq = parseEquation(candidate)
    if (eq) equations.push(eq)
    if (equations.length >= 2) break
  }

  return equations.slice(0, 2)
}

function solveSystem(equations: LinearEquation[]): SystemSolution | null {
  if (equations.length < 2) return null

  const [e1, e2] = equations
  const determinant = e1.a * e2.b - e1.b * e2.a
  if (Math.abs(determinant) < EPS) return null

  const dx = e1.c * e2.b - e1.b * e2.c
  const dy = e1.a * e2.c - e1.c * e2.a
  const x = dx / determinant
  const y = dy / determinant

  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return { x, y, equations, determinant, dx, dy }
}

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a))
  let y = Math.abs(Math.round(b))
  while (y) {
    const t = y
    y = x % y
    x = t
  }
  return x || 1
}

function formatNumber(value: number): string {
  if (Math.abs(value) < EPS) return "0"
  if (Math.abs(value - Math.round(value)) < EPS) return String(Math.round(value))

  const sign = value < 0 ? "-" : ""
  const abs = Math.abs(value)
  for (let den = 2; den <= 12; den++) {
    const num = Math.round(abs * den)
    if (Math.abs(abs - num / den) < EPS) {
      const g = gcd(num, den)
      return `${sign}${num / g}/${den / g}`
    }
  }

  return String(Number(value.toFixed(3))).replace(".", ",")
}

function answerText(solution: SystemSolution) {
  return `x = ${formatNumber(solution.x)}, y = ${formatNumber(solution.y)}`
}

function parseOptionPair(option: string): { x: number; y: number } | null {
  const text = normalizeMathText(option)
  const xMatch = text.match(/x\s*=\s*(-?\d+(?:\.\d+)?(?:\/-?\d+(?:\.\d+)?)?)/i)
  const yMatch = text.match(/y\s*=\s*(-?\d+(?:\.\d+)?(?:\/-?\d+(?:\.\d+)?)?)/i)
  if (!xMatch || !yMatch) return null

  const x = parseNumber(xMatch[1])
  const y = parseNumber(yMatch[1])
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return { x, y }
}

function findMatchingOption(options: string[], solution: SystemSolution) {
  return options.findIndex((option) => {
    const parsed = parseOptionPair(option)
    return parsed && Math.abs(parsed.x - solution.x) < 1e-5 && Math.abs(parsed.y - solution.y) < 1e-5
  })
}

function buildExplanation(solution: SystemSolution) {
  const [e1, e2] = solution.equations
  const ans = answerText(solution)
  return [
    `La solución correcta del sistema es ${ans}.`,
    `Usando determinantes: D = ${formatNumber(e1.a)}·${formatNumber(e2.b)} - ${formatNumber(e1.b)}·${formatNumber(e2.a)} = ${formatNumber(solution.determinant)}.`,
    `Dx = ${formatNumber(e1.c)}·${formatNumber(e2.b)} - ${formatNumber(e1.b)}·${formatNumber(e2.c)} = ${formatNumber(solution.dx)}, entonces x = ${formatNumber(solution.dx)}/${formatNumber(solution.determinant)} = ${formatNumber(solution.x)}.`,
    `Dy = ${formatNumber(e1.a)}·${formatNumber(e2.c)} - ${formatNumber(e1.c)}·${formatNumber(e2.a)} = ${formatNumber(solution.dy)}, entonces y = ${formatNumber(solution.dy)}/${formatNumber(solution.determinant)} = ${formatNumber(solution.y)}.`,
    `Por lo tanto, la alternativa correcta es ${ans}.`,
  ].join(" ")
}

function buildSteps(solution: SystemSolution) {
  const [e1, e2] = solution.equations
  return [
    `Sistema detectado: ${e1.raw} y ${e2.raw}.`,
    `Se calcula D = ${formatNumber(solution.determinant)}.`,
    `Se calcula Dx = ${formatNumber(solution.dx)} y x = ${formatNumber(solution.x)}.`,
    `Se calcula Dy = ${formatNumber(solution.dy)} y y = ${formatNumber(solution.y)}.`,
    `Solución final: ${answerText(solution)}.`,
  ]
}

export function autoFixQuestionMath(question: any): any {
  if (!question || typeof question !== "object") return question
  if (question.type !== "multiple_choice" && question.type !== "mixed_choice_development") return question
  if (!Array.isArray(question.options) || question.options.length < 2) return question

  const text = String(question.question || question.statement || "")
  const equations = extractLinearSystem(text)
  const solution = solveSystem(equations)
  if (!solution) return question

  const fixed = { ...question, options: [...question.options] }
  const correctText = answerText(solution)
  let correctIndex = findMatchingOption(fixed.options, solution)

  if (correctIndex < 0) {
    const current = Number.isInteger(Number(fixed.correctAnswer))
      ? Math.max(0, Math.min(fixed.options.length - 1, Number(fixed.correctAnswer)))
      : 0
    fixed.options[current] = correctText
    correctIndex = current
  }

  fixed.correctAnswer = correctIndex
  fixed.answerText = fixed.options[correctIndex]
  fixed.explanation = buildExplanation(solution)
  fixed.solutionSteps = buildSteps(solution)

  if (Array.isArray(fixed.distractorRationales)) {
    fixed.distractorRationales = fixed.options.map((option: string, index: number) =>
      index === correctIndex
        ? "Correcta: coincide con la solución del sistema."
        : `Distractor: ${option} no satisface simultáneamente las dos ecuaciones.`,
    )
  }

  if (fixed.type === "mixed_choice_development") {
    fixed.modelAnswer = fixed.modelAnswer || fixed.explanation
    fixed.expectedLatex = fixed.expectedLatex || `x=${formatNumber(solution.x)},\\ y=${formatNumber(solution.y)}`
  }

  return fixed
}
