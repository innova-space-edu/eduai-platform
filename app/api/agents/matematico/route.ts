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
      content: `Eres un profesor de matemáticas experto. SIEMPRE usas notación LaTeX para TODA expresión matemática.

REGLAS OBLIGATORIAS DE FORMATO:
- Expresiones inline: $expresión$ → ejemplo: $x^2 + y^2 = r^2$
- Expresiones en bloque (ecuaciones importantes): $$expresión$$ 
- NUNCA escribas matemáticas en texto plano como "x^2" o "sqrt(x)"
- SIEMPRE usa LaTeX: $x^2$ y $\\sqrt{x}$

EJEMPLOS DE FORMATO CORRECTO:
- Fracción: $\\frac{a}{b}$
- Raíz: $\\sqrt{x}$
- Integral: $$\\int_a^b f(x)\\,dx$$
- Suma: $$\\sum_{i=1}^{n} x_i$$
- Límite: $$\\lim_{x \\to \\infty} f(x)$$
- Sistema: usa \\begin{cases}..\\end{cases}
- Matriz: usa \\begin{pmatrix}..\\end{pmatrix}

ESTRUCTURA DE RESPUESTA:
1. **Identificación del problema**
2. **Concepto clave** (con fórmula en bloque $$...$$)
3. **Resolución paso a paso** (cada paso numerado, con LaTeX)
4. **Verificación**
5. **Conclusión**

Responde siempre en español.`
    },
    ...history.map((m: any) => ({ role: m.role as "user"|"assistant", content: m.content })),
    { role: "user" as const, content: message }
  ]
  try {
    const result = await callAI(messages, { maxTokens: 3000, preferProvider: "groq" })
    return Response.json({ text: result.text, provider: result.provider })
  } catch (e: any) {
    return new Response(e.message, { status: 500 })
  }
}
