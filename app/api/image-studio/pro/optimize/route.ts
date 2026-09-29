import { NextRequest, NextResponse } from "next/server"
import { runAIText } from "@/lib/ai/gateway"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 30

const HEADERS = { "Cache-Control": "no-store, max-age=0" }

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401, headers: HEADERS })

  const body = await request.json().catch(() => null)
  const prompt = clean(body?.prompt, 5000)
  if (!prompt) return NextResponse.json({ error: "Escribe una solicitud para optimizar." }, { status: 400, headers: HEADERS })

  const format = clean(body?.format, 40) || "1:1"
  const primarySkill = clean(body?.primarySkill, 100) || "visual-design"
  const selectedSkills = Array.isArray(body?.selectedSkills)
    ? body.selectedSkills.map((value: unknown) => clean(value, 80)).filter(Boolean).slice(0, 8)
    : []
  const textCritical = body?.textCritical === true

  const system = `Eres el optimizador de solicitudes visuales de EDUAI Image Studio Pro.
Tu tarea es REESCRIBIR la solicitud del usuario como un prompt de producción claro y coherente en español de Chile.

Reglas obligatorias:
- Conserva la intención del usuario. No cambies tema, personas, números, nombres propios ni texto exacto.
- No inventes datos, cifras, hechos, citas, nombres, fórmulas o contenido curricular.
- Organiza la solicitud en una sola instrucción compacta que describa: objetivo visual, composición, jerarquía, estilo, iluminación/paleta si corresponde y restricciones importantes.
- Evita palabras vacías como "masterpiece", "best quality" o acumulaciones de adjetivos.
- Si la pieza incluye texto visible, exige ortografía correcta en español y reduce el texto al mínimo necesario.
- Para infografías, afiches, diagramas o material educativo: un título corto y hasta 6 etiquetas breves de 1 a 4 palabras. Nunca pidas párrafos dentro de la imagen.
- Si el usuario escribió texto exacto entre comillas, consérvalo literalmente.
- Si no puedes determinar una etiqueta factual sin inventar, indica que se omita.
- No uses pseudo-texto, lorem ipsum, palabras inventadas ni mezcla de idiomas.
- No expliques lo que hiciste. Devuelve SOLO la solicitud optimizada, sin markdown ni encabezados.`

  const userPrompt = `Solicitud original:
${prompt}

Contexto del router local:
- skill principal: ${primarySkill}
- skills seleccionadas: ${selectedSkills.join(", ") || "sin clasificación adicional"}
- formato: ${format}
- texto visible crítico: ${textCritical ? "sí" : "no"}

Reescribe la solicitud para obtener una imagen más coherente, legible y consistente.`

  try {
    const result = await runAIText({
      messages: [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
      maxOutputTokens: 700,
      lite: true,
      context: {
        userId: user.id,
        module: "image-studio-pro-prompt-optimizer",
        reusePolicy: "exact_private",
        visibility: "private",
      },
      supabase,
    })

    const optimizedPrompt = String(result.text || result.data || "").trim()
      .replace(/^\s*["“]|["”]\s*$/g, "")
      .slice(0, 6000)

    if (!optimizedPrompt) throw new Error("El optimizador no devolvió contenido")

    return NextResponse.json({
      success: true,
      optimizedPrompt,
      provider: result.provider,
      model: result.model,
      reused: result.reused,
      generationAvoided: result.reused,
    }, { headers: HEADERS })
  } catch (error) {
    console.error("[ImageStudioPro][Optimize]", error)
    const typed = error as Error & { status?: number; code?: string }
    return NextResponse.json({
      error: typed.code === "EDUAI_ACCESS_RESTRICTED"
        ? typed.message
        : "No fue posible optimizar la solicitud en este momento.",
      code: typed.code,
    }, { status: typed.status || 500, headers: HEADERS })
  }
}
