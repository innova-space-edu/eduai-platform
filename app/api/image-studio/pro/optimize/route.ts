import { NextRequest, NextResponse } from "next/server"
import { runAIText } from "@/lib/ai/gateway"
import { createClient } from "@/lib/supabase/server"
import { getSkillGuidance } from "@innova-space/visual-design"
import {
  buildVisualOptimizationProfile,
  ensureProductionPrompt,
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
Tu trabajo NO es parafrasear. Debes convertir una solicitud breve en un brief visual de producción claramente mejorado.

Niveles:
- light: corrige ambigüedad y redacción sin expandir mucho.
- recommended: agrega estructura visual, jerarquía, composición y restricciones útiles.
- advanced: genera un brief de producción completo, pero sin inventar hechos.

Reglas obligatorias:
- Conserva la intención del usuario. No cambies tema, personas, números, nombres propios ni texto exacto.
- No inventes datos, cifras, hechos, citas, nombres, fórmulas o contenido curricular.
- Puedes añadir decisiones NO factuales de diseño: composición, jerarquía, distribución, espacio negativo, encuadre, iluminación, paleta y acabado cuando correspondan.
- Para conocimiento común directamente implícito en el tema, usa solo etiquetas universalmente establecidas; si existe duda factual, omítela.
- El resultado debe ser claramente más útil para un modelo generador que la solicitud original.
- Evita palabras vacías como "masterpiece", "best quality" o cadenas de adjetivos.
- Si la pieza incluye texto visible, exige ortografía correcta en español y reduce el texto al mínimo necesario.
- Para infografías, afiches, diagramas o material educativo: un título corto y hasta 6 etiquetas breves de 1 a 4 palabras. Nunca pidas párrafos dentro de la imagen.
- Si el usuario escribió texto exacto entre comillas, consérvalo literalmente.
- No uses pseudo-texto, lorem ipsum, palabras inventadas ni mezcla de idiomas.
- Devuelve SOLO JSON válido. Sin markdown ni comentarios.

Esquema de salida:
{
  "optimizedPrompt": "prompt final en español",
  "changes": ["cambio concreto 1", "cambio concreto 2"],
  "brief": {
    "objective": "objetivo visual",
    "composition": "composición propuesta",
    "style": "estilo y acabado",
    "visibleText": {
      "title": "título si corresponde o cadena vacía",
      "labels": ["máximo 6 etiquetas breves"]
    },
    "mustInclude": ["elementos obligatorios"],
    "avoid": ["errores o elementos a evitar"]
  }
}`
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
- nivel de optimización: ${level}
- skill principal: ${primarySkill}
- skills seleccionadas: ${selectedSkills.join(", ") || "sin clasificación adicional"}
- formato: ${format}
- texto visible crítico: ${textCritical ? "sí" : "no"}

Perfil local obligatorio:
${JSON.stringify(profile, null, 2)}

Reglas compactas de las skills seleccionadas:
${JSON.stringify(specialistGuidance, null, 2)}

Convierte la solicitud en un brief visual de producción claramente mejorado y devuelve el JSON solicitado.`

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
    const jsonText = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim()
    const start = jsonText.indexOf("{")
    const end = jsonText.lastIndexOf("}")
    let parsed: any = {}
    try {
      parsed = JSON.parse(start >= 0 && end > start ? jsonText.slice(start, end + 1) : jsonText)
    } catch {
      parsed = { optimizedPrompt: raw }
    }

    const candidate = clean(parsed?.optimizedPrompt, 6000) || clean(raw, 6000)
    if (!candidate) throw new Error("El optimizador no devolvió contenido")
    const optimizedPrompt = ensureProductionPrompt(prompt, candidate, profile).slice(0, 6500)
    const changes = Array.isArray(parsed?.changes)
      ? parsed.changes.map((value: unknown) => clean(value, 180)).filter(Boolean).slice(0, 8)
      : []
    const brief = parsed?.brief && typeof parsed.brief === "object"
      ? {
          objective: clean(parsed.brief.objective, 500),
          composition: clean(parsed.brief.composition, 700),
          style: clean(parsed.brief.style, 500),
          visibleText: {
            title: clean(parsed.brief.visibleText?.title, 160),
            labels: Array.isArray(parsed.brief.visibleText?.labels)
              ? parsed.brief.visibleText.labels.map((value: unknown) => clean(value, 80)).filter(Boolean).slice(0, 6)
              : [],
          },
          mustInclude: Array.isArray(parsed.brief.mustInclude)
            ? parsed.brief.mustInclude.map((value: unknown) => clean(value, 160)).filter(Boolean).slice(0, 8)
            : [],
          avoid: Array.isArray(parsed.brief.avoid)
            ? parsed.brief.avoid.map((value: unknown) => clean(value, 160)).filter(Boolean).slice(0, 8)
            : [],
        }
      : null

    return NextResponse.json({
      success: true,
      optimizedPrompt,
      originalPrompt: prompt,
      level,
      profile,
      brief,
      changes: [...new Set([...profile.appliedChanges, ...changes])].slice(0, 10),
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
