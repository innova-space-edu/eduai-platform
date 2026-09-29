import { NextRequest, NextResponse } from "next/server"
import { runAIText } from "@/lib/ai/gateway"
import { createClient } from "@/lib/supabase/server"
import { getSkillGuidance } from "@innova-space/visual-design"
import {
  buildLocalOptimizationBrief,
  buildVisualOptimizationProfile,
  ensureProductionPrompt,
  extractOptimizedPromptText,
  normalizeOptimizationLevel,
} from "@/lib/visual-design/prompt-optimizer"

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
  const level = normalizeOptimizationLevel(body?.level)
  const profile = buildVisualOptimizationProfile({
    primarySkill,
    selectedSkills,
    textCritical,
    format,
    level,
  })
  const specialistGuidance = getSkillGuidance(selectedSkills, {
    mode: "generative",
    maxSkills: 4,
    maxRulesPerSkill: 4,
    maxQaPerSkill: 2,
  })

  const system = `Eres el optimizador de solicitudes visuales de EDUAI Image Studio Pro.
Tu trabajo NO es parafrasear: convierte una solicitud breve en una instrucción visual de producción claramente mejorada.

Niveles:
- light: corrige ambigüedad y redacción sin expandir mucho.
- recommended: agrega estructura visual, jerarquía, composición y restricciones útiles.
- advanced: crea una instrucción de producción más completa, sin inventar hechos.

Reglas obligatorias:
- Conserva la intención del usuario. No cambies tema, personas, números, nombres propios ni texto exacto.
- No inventes datos, cifras, hechos, citas, nombres, fórmulas o contenido curricular.
- Puedes añadir decisiones NO factuales de diseño: composición, jerarquía, distribución, espacio negativo, encuadre, iluminación, paleta y acabado cuando correspondan.
- El resultado debe ser claramente más útil para un modelo generador que la solicitud original.
- Si la pieza incluye texto visible, exige ortografía correcta en español y reduce el texto al mínimo necesario.
- Para infografías, afiches, diagramas o material educativo: un título corto y hasta 6 etiquetas breves de 1 a 4 palabras. Nunca pidas párrafos dentro de la imagen.
- Si el usuario escribió texto exacto entre comillas, consérvalo literalmente.
- No uses pseudo-texto, lorem ipsum, palabras inventadas ni mezcla de idiomas.
- No devuelvas JSON, YAML, Markdown, listas de cambios ni explicaciones.
- Devuelve SOLO el prompt optimizado en texto plano, listo para un modelo de imagen.`

  const userPrompt = `Solicitud original:
${prompt}

Contexto del router local:
- nivel de optimización: ${level}
- skill principal: ${primarySkill}
- skills seleccionadas: ${selectedSkills.join(", ") || "sin clasificación adicional"}
- formato: ${format}
- texto visible crítico: ${textCritical ? "sí" : "no"}

Perfil local obligatorio:
${JSON.stringify(profile, null, 2)}

Reglas compactas de las skills seleccionadas:
${JSON.stringify(specialistGuidance, null, 2)}

Convierte la solicitud en una instrucción visual de producción claramente mejorada. Devuelve únicamente el prompt final en texto plano.`

  try {
    const result = await runAIText({
      messages: [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
      maxOutputTokens: level === "advanced" ? 1400 : level === "recommended" ? 1100 : 700,
      lite: true,
      context: {
        userId: user.id,
        module: "image-studio-pro-prompt-optimizer",
        reusePolicy: "exact_private",
        visibility: "private",
      },
      supabase,
    })

    const raw = String(result.text || result.data || "").trim()
    const candidate = extractOptimizedPromptText(raw)
    const optimizedPrompt = ensureProductionPrompt(
      prompt,
      candidate || prompt,
      profile
    ).slice(0, 6500)
    const brief = buildLocalOptimizationBrief(prompt, optimizedPrompt, profile)

    return NextResponse.json({
      success: true,
      optimizedPrompt,
      originalPrompt: prompt,
      level,
      profile,
      brief,
      changes: profile.appliedChanges.slice(0, 10),
      selectedSkills,
      primarySkill,
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
