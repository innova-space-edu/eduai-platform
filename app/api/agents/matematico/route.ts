import { callAI } from "@/lib/ai-router"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })
  const { message, history = [] } = await req.json()

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
    ...history.map((m: any) => ({ role: m.role as "user"|"assistant", content: m.content })),
    { role: "user" as const, content: message }
  ]
  try {
    const result = await callAI(messages, { maxTokens: 3000, preferProvider: "gemini" })
    return Response.json({ text: result.text, provider: result.provider })
  } catch (e: any) {
    return new Response(e.message, { status: 500 })
  }
}
