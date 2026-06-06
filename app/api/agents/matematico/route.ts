import { callAI } from "@/lib/ai-router"
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

    Responde siempre en español.`
      },
      ...safeHistory,
      { role: "user" as const, content: message }
    ]

    const result = await callAI(messages, { maxTokens: 3000, preferProvider: "gemini" })
    return Response.json({ text: result.text, provider: result.provider })
  } catch (error) {
    console.error("[agents/matematico]", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "No fue posible consultar al agente matemático." },
      { status: 500 },
    )
  }
}
