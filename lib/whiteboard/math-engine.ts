import type {
  WhiteboardGraphPoint,
  WhiteboardSolveResult,
  WhiteboardVerificationLine,
} from "@/lib/whiteboard/types"

const EPSILON = 1e-8
const DEFAULT_SAMPLES = [-3.25, -2, -0.75, 0.5, 1.5, 2.75, 4]

type Token = { type: "number" | "name" | "operator" | "paren" | "comma"; value: string }
type Polynomial = { a: number; b: number; c: number }

function closeEnough(a: number, b: number, tolerance = 1e-7) {
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b))
}

function cleanLatex(value: string) {
  return value
    .trim()
    .replace(/^\$+|\$+$/g, "")
    .replace(/\\left|\\right/g, "")
    .replace(/\\,/g, "")
    .replace(/\\!/g, "")
    .replace(/\\operatorname\{([^}]+)\}/g, "$1")
    .replace(/\\mathrm\{([^}]+)\}/g, "$1")
    .replace(/\\text\{([^}]+)\}/g, "$1")
    .replace(/−/g, "-")
    .replace(/×|\\times|\\cdot/g, "*")
    .replace(/÷|\\div/g, "/")
    .replace(/\\pi/g, "pi")
    .replace(/\\infty/g, "Infinity")
}

function replaceFractions(source: string) {
  let output = source
  let changed = true
  let guard = 0
  while (changed && guard < 12) {
    changed = false
    guard += 1
    output = output.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (_, numerator, denominator) => {
      changed = true
      return `((${numerator})/(${denominator}))`
    })
  }
  return output
}

export function latexToEngineExpression(latex: string) {
  let source = replaceFractions(cleanLatex(latex))
  source = source
    .replace(/\\sqrt\[2\]\{([^{}]+)\}/g, "sqrt($1)")
    .replace(/\\sqrt\{([^{}]+)\}/g, "sqrt($1)")
    .replace(/\\sin/g, "sin")
    .replace(/\\cos/g, "cos")
    .replace(/\\tan/g, "tan")
    .replace(/\\ln/g, "ln")
    .replace(/\\log/g, "log")
    .replace(/\\abs\{([^{}]+)\}/g, "abs($1)")
    .replace(/\{/g, "(")
    .replace(/\}/g, ")")
    .replace(/\s+/g, "")

  source = source.replace(/(\d|\)|x|pi)(?=(x|pi|sin|cos|tan|sqrt|ln|log|abs|\())/g, "$1*")
  source = source.replace(/(x|pi|\))(?=\d)/g, "$1*")
  return source
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let index = 0
  while (index < source.length) {
    const char = source[index]
    if (/\s/.test(char)) {
      index += 1
      continue
    }
    if (/\d|\./.test(char)) {
      let value = char
      index += 1
      while (index < source.length && /\d|\./.test(source[index])) value += source[index++]
      if (!/^\d*\.?\d+$/.test(value)) throw new Error("Número inválido")
      tokens.push({ type: "number", value })
      continue
    }
    if (/[a-zA-Z]/.test(char)) {
      let value = char
      index += 1
      while (index < source.length && /[a-zA-Z0-9_]/.test(source[index])) value += source[index++]
      tokens.push({ type: "name", value })
      continue
    }
    if ("+-*/^".includes(char)) {
      tokens.push({ type: "operator", value: char })
      index += 1
      continue
    }
    if (char === "(" || char === ")") {
      tokens.push({ type: "paren", value: char })
      index += 1
      continue
    }
    if (char === ",") {
      tokens.push({ type: "comma", value: char })
      index += 1
      continue
    }
    throw new Error(`Símbolo no soportado: ${char}`)
  }
  return tokens
}

class ExpressionParser {
  private index = 0

  constructor(private readonly tokens: Token[], private readonly variables: Record<string, number>) {}

  parse() {
    const value = this.expression()
    if (this.index !== this.tokens.length) throw new Error("Expresión incompleta")
    return value
  }

  private peek() {
    return this.tokens[this.index]
  }

  private consume() {
    return this.tokens[this.index++]
  }

  private expression(): number {
    let value = this.term()
    while (this.peek()?.type === "operator" && (this.peek().value === "+" || this.peek().value === "-")) {
      const operator = this.consume().value
      const right = this.term()
      value = operator === "+" ? value + right : value - right
    }
    return value
  }

  private term(): number {
    let value = this.power()
    while (this.peek()?.type === "operator" && (this.peek().value === "*" || this.peek().value === "/")) {
      const operator = this.consume().value
      const right = this.power()
      if (operator === "/" && Math.abs(right) < EPSILON) throw new Error("División por cero")
      value = operator === "*" ? value * right : value / right
    }
    return value
  }

  private power(): number {
    let value = this.unary()
    if (this.peek()?.type === "operator" && this.peek().value === "^") {
      this.consume()
      value = Math.pow(value, this.power())
    }
    return value
  }

  private unary(): number {
    if (this.peek()?.type === "operator" && (this.peek().value === "+" || this.peek().value === "-")) {
      const operator = this.consume().value
      const value = this.unary()
      return operator === "-" ? -value : value
    }
    return this.primary()
  }

  private primary(): number {
    const token = this.consume()
    if (!token) throw new Error("Falta un valor")
    if (token.type === "number") return Number(token.value)
    if (token.type === "paren" && token.value === "(") {
      const value = this.expression()
      const close = this.consume()
      if (close?.type !== "paren" || close.value !== ")") throw new Error("Falta cerrar paréntesis")
      return value
    }
    if (token.type === "name") {
      const name = token.value.toLowerCase()
      if (name === "pi") return Math.PI
      if (name === "e") return Math.E
      if (name in this.variables) return this.variables[name]
      if (this.peek()?.type === "paren" && this.peek().value === "(") {
        this.consume()
        const argument = this.expression()
        const close = this.consume()
        if (close?.type !== "paren" || close.value !== ")") throw new Error("Falta cerrar función")
        const functions: Record<string, (value: number) => number> = {
          sqrt: Math.sqrt,
          sin: Math.sin,
          cos: Math.cos,
          tan: Math.tan,
          ln: Math.log,
          log: Math.log10,
          abs: Math.abs,
        }
        const fn = functions[name]
        if (!fn) throw new Error(`Función no soportada: ${name}`)
        return fn(argument)
      }
      throw new Error(`Variable no soportada: ${name}`)
    }
    throw new Error("Expresión inválida")
  }
}

export function evaluateLatex(latex: string, variables: Record<string, number> = {}) {
  const expression = latexToEngineExpression(latex)
  return new ExpressionParser(tokenize(expression), variables).parse()
}

function splitEquation(latex: string) {
  const normalized = cleanLatex(latex)
  const index = normalized.indexOf("=")
  if (index < 0) return null
  return { left: normalized.slice(0, index), right: normalized.slice(index + 1) }
}

function equationResidual(latex: string, x: number) {
  const equation = splitEquation(latex)
  if (!equation) throw new Error("No es una ecuación")
  return evaluateLatex(equation.left, { x }) - evaluateLatex(equation.right, { x })
}

function polynomialForEquation(latex: string): Polynomial | null {
  try {
    const f0 = equationResidual(latex, 0)
    const f1 = equationResidual(latex, 1)
    const fm1 = equationResidual(latex, -1)
    const c = f0
    const b = (f1 - fm1) / 2
    const a = (f1 + fm1) / 2 - c
    for (const x of [-3, -2, 0.5, 2, 4]) {
      const expected = a * x * x + b * x + c
      if (!closeEnough(equationResidual(latex, x), expected, 1e-6)) return null
    }
    return { a: Math.abs(a) < EPSILON ? 0 : a, b: Math.abs(b) < EPSILON ? 0 : b, c: Math.abs(c) < EPSILON ? 0 : c }
  } catch {
    return null
  }
}

function formatNumber(value: number) {
  if (closeEnough(value, Math.round(value))) return String(Math.round(value))
  return Number(value.toPrecision(10)).toString()
}

function normalizePolynomial(poly: Polynomial) {
  const scale = Math.abs(poly.a) > EPSILON ? poly.a : Math.abs(poly.b) > EPSILON ? poly.b : poly.c
  if (Math.abs(scale) < EPSILON) return poly
  return { a: poly.a / scale, b: poly.b / scale, c: poly.c / scale }
}

function equationsEquivalent(first: string, second: string) {
  const left = polynomialForEquation(first)
  const right = polynomialForEquation(second)
  if (!left || !right) return null
  const a = normalizePolynomial(left)
  const b = normalizePolynomial(right)
  return closeEnough(a.a, b.a, 1e-6) && closeEnough(a.b, b.b, 1e-6) && closeEnough(a.c, b.c, 1e-6)
}

function expressionsEquivalent(first: string, second: string) {
  try {
    return DEFAULT_SAMPLES.every((x) => closeEnough(evaluateLatex(first, { x }), evaluateLatex(second, { x }), 1e-6))
  } catch {
    return null
  }
}

export function verifyProcedure(lines: string[]): WhiteboardVerificationLine[] {
  const cleanLines = lines.map((line) => line.trim()).filter(Boolean)
  return cleanLines.map((line, index) => {
    if (index === 0) return { index: 0, latex: line, valid: true, message: "Expresión inicial." }
    const previous = cleanLines[index - 1]
    const equivalent = previous.includes("=") && line.includes("=")
      ? equationsEquivalent(previous, line)
      : expressionsEquivalent(previous, line)
    if (equivalent === true) {
      return { index, latex: line, valid: true, message: "La transformación conserva la equivalencia." }
    }
    if (equivalent === false) {
      return { index, latex: line, valid: false, message: "Esta línea no es equivalente a la anterior. Revisa la operación aplicada a ambos lados." }
    }
    return { index, latex: line, valid: null, message: "Este paso necesita revisión simbólica avanzada." }
  })
}

function graphFromLatex(latex: string) {
  const equation = splitEquation(latex)
  let expression = latex
  if (equation && cleanLatex(equation.left).replace(/\s/g, "") === "y") expression = equation.right
  else if (equation && cleanLatex(equation.right).replace(/\s/g, "") === "y") expression = equation.left
  const points: WhiteboardGraphPoint[] = []
  for (let index = 0; index <= 120; index += 1) {
    const x = -10 + index / 6
    try {
      const y = evaluateLatex(expression, { x })
      if (Number.isFinite(y) && Math.abs(y) <= 1000) points.push({ x, y })
    } catch {
      return null
    }
  }
  if (points.length < 3) return null
  const values = points.map((point) => point.y)
  const yMin = Math.max(-100, Math.min(...values, -1))
  const yMax = Math.min(100, Math.max(...values, 1))
  return { expressionLatex: expression, xMin: -10, xMax: 10, yMin, yMax, points }
}

export function solveDeterministically(latex: string, lines: string[] = []): WhiteboardSolveResult | null {
  const normalizedLatex = normalizeLatexForDisplay(latex)
  if (!normalizedLatex) return null

  const equation = splitEquation(normalizedLatex)
  if (equation) {
    const polynomial = polynomialForEquation(normalizedLatex)
    if (polynomial) {
      const { a, b, c } = polynomial
      if (Math.abs(a) < EPSILON && Math.abs(b) < EPSILON) {
        const valid = Math.abs(c) < EPSILON
        return {
          normalizedLatex,
          classification: valid ? "identity" : "contradiction",
          steps: [{ index: 1, explanation: valid ? "Ambos lados representan la misma cantidad." : "La igualdad conduce a una contradicción.", latex: valid ? "0=0" : `${formatNumber(c)}=0`, valid }],
          answerLatex: valid ? "\\mathbb{R}" : "\\varnothing",
          explanation: valid ? "La ecuación es verdadera para todos los valores permitidos." : "La ecuación no tiene solución.",
          verified: true,
          engine: "deterministic",
          verification: { valid },
          graph: null,
        }
      }
      if (Math.abs(a) < EPSILON) {
        const solution = -c / b
        const answer = `x=${formatNumber(solution)}`
        return {
          normalizedLatex,
          classification: "linear-equation",
          steps: [
            { index: 1, explanation: "Se agrupan los términos para obtener una ecuación lineal equivalente.", latex: `${formatNumber(b)}x+${formatNumber(c)}=0`, valid: true },
            { index: 2, explanation: "Se despeja la variable dividiendo por su coeficiente.", latex: answer, valid: true },
          ],
          answerLatex: answer,
          explanation: `La solución verificada es $${answer}$.`,
          verified: closeEnough(equationResidual(normalizedLatex, solution), 0, 1e-7),
          engine: "deterministic",
          verification: { valid: closeEnough(equationResidual(normalizedLatex, solution), 0, 1e-7), substitutionLatex: normalizedLatex.replace(/x/g, `(${formatNumber(solution)})`) },
          graph: graphFromLatex(normalizedLatex),
        }
      }
      const discriminant = b * b - 4 * a * c
      if (discriminant < -EPSILON) {
        return {
          normalizedLatex,
          classification: "quadratic-equation",
          steps: [{ index: 1, explanation: "Se calcula el discriminante.", latex: `\\Delta=${formatNumber(discriminant)}`, valid: true }],
          answerLatex: "\\varnothing_{\\mathbb{R}}",
          explanation: "El discriminante es negativo, por lo que no existen soluciones reales.",
          verified: true,
          engine: "deterministic",
          verification: { valid: true },
          graph: graphFromLatex(normalizedLatex),
        }
      }
      const root = Math.sqrt(Math.max(0, discriminant))
      const first = (-b + root) / (2 * a)
      const second = (-b - root) / (2 * a)
      const answer = closeEnough(first, second)
        ? `x=${formatNumber(first)}`
        : `x_1=${formatNumber(first)},\\quad x_2=${formatNumber(second)}`
      return {
        normalizedLatex,
        classification: "quadratic-equation",
        steps: [
          { index: 1, explanation: "Se identifican los coeficientes de la ecuación cuadrática.", latex: `a=${formatNumber(a)},\\;b=${formatNumber(b)},\\;c=${formatNumber(c)}`, valid: true },
          { index: 2, explanation: "Se calcula el discriminante.", latex: `\\Delta=b^2-4ac=${formatNumber(discriminant)}`, valid: true },
          { index: 3, explanation: "Se aplica la fórmula general.", latex: answer, valid: true },
        ],
        answerLatex: answer,
        explanation: `Las soluciones reales son $${answer}$.`,
        verified: closeEnough(equationResidual(normalizedLatex, first), 0) && closeEnough(equationResidual(normalizedLatex, second), 0),
        engine: "deterministic",
        verification: { valid: true },
        graph: graphFromLatex(normalizedLatex),
      }
    }
  }

  if (!normalizedLatex.includes("x")) {
    try {
      const value = evaluateLatex(normalizedLatex)
      const answer = formatNumber(value)
      return {
        normalizedLatex,
        classification: "numeric-expression",
        steps: [{ index: 1, explanation: "Se evalúa la expresión respetando la prioridad de operaciones.", latex: `${normalizedLatex}=${answer}`, valid: true }],
        answerLatex: answer,
        explanation: `El valor de la expresión es $${answer}$.`,
        verified: true,
        engine: "deterministic",
        verification: { valid: true },
        graph: null,
      }
    } catch {
      // Continúa hacia el motor avanzado.
    }
  }

  const verificationLines = lines.length > 1 ? verifyProcedure(lines) : []
  if (verificationLines.length) {
    return {
      normalizedLatex,
      classification: "procedure",
      steps: verificationLines.map((line) => ({ index: line.index, explanation: line.message, latex: line.latex, valid: line.valid })),
      answerLatex: lines.at(-1) || normalizedLatex,
      explanation: "Se verificó cada transición que el motor determinista puede interpretar.",
      verified: verificationLines.every((line) => line.valid !== false),
      engine: "deterministic",
      verification: { valid: verificationLines.every((line) => line.valid !== false), lines: verificationLines },
      graph: graphFromLatex(normalizedLatex),
      warning: verificationLines.some((line) => line.valid === null) ? "Algunos pasos requieren revisión simbólica avanzada." : null,
    }
  }

  const graph = graphFromLatex(normalizedLatex)
  if (graph) {
    return {
      normalizedLatex,
      classification: "function",
      steps: [],
      answerLatex: normalizedLatex,
      explanation: "La expresión se interpretó como una función graficable.",
      verified: true,
      engine: "deterministic",
      verification: null,
      graph,
    }
  }

  return null
}

export function normalizeLatexForDisplay(value: string) {
  return value.trim().replace(/^\$\$?|\$\$?$/g, "").trim().slice(0, 8000)
}

export async function callPythonMathEngine(input: {
  latex: string
  lines?: string[]
  mode: string
}): Promise<WhiteboardSolveResult | null> {
  const endpoint = process.env.WHITEBOARD_MATH_ENGINE_URL?.trim()
  if (!endpoint) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 18000)
  try {
    const response = await fetch(`${endpoint.replace(/\/$/, "")}/solve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.WHITEBOARD_MATH_ENGINE_TOKEN ? { Authorization: `Bearer ${process.env.WHITEBOARD_MATH_ENGINE_TOKEN}` } : {}),
      },
      body: JSON.stringify(input),
      signal: controller.signal,
      cache: "no-store",
    })
    if (!response.ok) return null
    const result = await response.json()
    return { ...result, engine: "sympy" } as WhiteboardSolveResult
  } catch (error) {
    console.warn("[whiteboard/python-engine]", error instanceof Error ? error.message : error)
    return null
  } finally {
    clearTimeout(timer)
  }
}
