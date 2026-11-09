import { runAIText } from "@/lib/ai/gateway"
import { solveExactMath, formatExactMath } from "@/lib/math/exact-solver"
import { createClient } from "@/lib/supabase/server"

type HistoryMessage = {
  role: "user" | "assistant"
  content: string
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: "Debes iniciar sesión para usar el agente matemático." }, { status: 401 })
    }

    const body = await req.json()
    const message = typeof body?.message === "string" ? body.message.trim() : ""
    const history = Array.isArray(body?.history) ? body.history : []

    if (!message) {
      return Response.json({ error: "Escribe una consulta matemática antes de enviar." }, { status: 400 })
    }

    // Deterministic exact answers for recognized mathematics. No LLM call or code execution.
    const verifiedMath = process.env.EDUAI_EXACT_MATH_ENABLED === "true"
      ? solveExactMath({ question: message }) : null
    if (verifiedMath?.verified) {
      return Response.json({ text: formatExactMath(verifiedMath), provider: "EDUAI Exact Math",
        model: "Rational Solver", reused: false, generationAvoided: true,
        verified: true, engine: verifiedMath.engine, exactResult: verifiedMath })
    }

    const safeHistory: HistoryMessage[] = history
      .filter((item: unknown): item is HistoryMessage => {
        if (!item || typeof item !== "object") return false
        const candidate = item as Partial<HistoryMessage>
        return (
          (candidate.role === "user" || candidate.role === "assistant") &&
          typeof candidate.content === "string"
        )
      })
      .slice(-8)

    const messages = [
      {
        role: "system" as const,
        content: `Eres un profesor de matemáticas experto. REGLA ABSOLUTA: TODA expresión matemática DEBE estar en LaTeX. Prohibido texto plano matemático.

FORMATO LATEX OBLIGATORIO:
- Inline: $x^2$, $\\sqrt{x}$, $\\frac{a}{b}$, $\\pi$, $\\infty$
- Bloque (ecuaciones principales): $$x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$
- Sistemas: $$\\begin{cases} x+y=1 \\\\ x-y=0 \\end{cases}$$
- Matrices: $$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$$
- Integrales: $$\\int_a^b f(x)\\,dx$$
- Sumas: $$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$
- Límites: $$\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$$

NUNCA escribas: "x^2", "sqrt(x)", "1/2" — siempre $x^2$, $\\sqrt{x}$, $\\frac{1}{2}$

GRÁFICAS: Solo cuando soliciten una gráfica, añade un bloque de código con lenguaje eduai-chart y un JSON válido. Para y=a x^2+b x+c usa {"type":"quadratic","title":"Gráfica","a":1,"b":-2,"c":1,"xMin":-4,"xMax":6}. Para datos usa {"type":"bar","title":"Datos","labels":["A","B"],"values":[2,5]}. Nunca inventes datos.
PYTHON: Cuando se pida, ofrece código en un bloque marcado python. No afirmes haberlo ejecutado si no usaste un motor aislado.
FORMATO: Evita códigos LaTeX crudos sin delimitadores. Las fórmulas deben poder renderizarse. Usa colores y tablas solo cuando aporten claridad.

ESTRUCTURA OBLIGATORIA:
## 🔍 Problema
[identificar tipo]

## 📐 Concepto clave
$$fórmula\\ principal$$

## ✏️ Solución paso a paso
**Paso 1:** ...con LaTeX...
**Paso 2:** ...
...

## ✅ Resultado
$$respuesta\\ final$$

## 💡 Verificación
[comprobar resultado]

Responde siempre en español.`,
      },
      ...safeHistory,
      { role: "user" as const, content: message },
    ]

    const result = await runAIText({
      messages,
      capability: "text",
      maxOutputTokens: 3000,
      preferredProvider: "google",
      fallbackToDefault: true,
      context: {
        userId: user.id,
        module: "matematico",
        reusePolicy: "exact_private",
        visibility: "private",
      },
      supabase,
    })

    return Response.json({
      text: result.data,
      provider: result.provider,
      model: result.model,
      reused: result.reused,
      generationAvoided: result.reused,
    })
  } catch (error) {
    console.error("[agents/matematico]", error)
    const typed = error as Error & { status?: number; code?: string }
    return Response.json(
      {
        error: typed?.message || "No fue posible consultar al agente matemático.",
        code: typed?.code || undefined,
      },
      { status: typed?.status || 500 },
    )
  }
}