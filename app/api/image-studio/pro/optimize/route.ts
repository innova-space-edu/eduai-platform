import { NextRequest, NextResponse } from "next/server"
import { runAIText } from "@/lib/ai/gateway"
import { createClient } from "@/lib/supabase/server"
import { recordAdminIncident } from "@/lib/admin/edu-claw-incidents"
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
No reescribas ni sustituyas la solicitud original. Debes devolverla literalmente al inicio y, solo después, agregar posibles refinamientos estrictamente visuales compatibles.

Niveles:
- light: corrige ambigüedad y redacción sin expandir mucho.
- recommended: agrega estructura visual, jerarquía, composición y restricciones útiles.
- advanced: crea una instrucción de producción más completa, sin inventar hechos.

Reglas obligatorias:
- Empieza la respuesta con la solicitud original completa, letra por letra, en su mismo orden y sin ningún prefijo. Después puedes añadir sugerencias de diseño.
- No elimines, suavices, contradigas, traduzcas ni cambies sujeto, acción, estilo, vestimenta, colores, encuadre, fondo, iluminación, composición, detalles, personas, números, nombres propios ni texto exacto.
- No inventes datos, cifras, hechos, citas, nombres, fórmulas o contenido curricular.
- Puedes sugerir decisiones NO factuales solo donde el usuario no haya fijado esos aspectos; nunca cambies iluminación, paleta, encuadre ni composición si ya los especificó.
- Si no puedes mejorarla sin cambiar sus detalles, devuelve la solicitud original intacta.
- Si la pieza incluye texto visible, exige ortografía correcta en español y reduce el texto al mínimo necesario.
- Para infografías, afiches, diagramas o material educativo: sugiere etiquetas breves solo si el usuario no especificó otra cantidad o texto completo. No recortes contenido solicitado.
- Si el usuario escribió texto exacto entre comillas, consérvalo literalmente.
- No uses pseudo-texto, lorem ipsum, palabras inventadas ni mezcla de idiomas.
- No devuelvas JSON, YAML, Markdown, listas de cambios ni explicaciones.
- Devuelve SOLO texto plano: primero la solicitud original literal y, debajo, sugerencias opcionales compatibles; sin metadatos.`

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

Conserva la solicitud original literalmente al principio de la respuesta; añade solo mejoras visuales subordinadas que no cambien detalles, cantidades ni estilo. Si no hay mejoras seguras, devuelve la solicitud original.`

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
    console.error("[ImageStudioPro][Optimize]", error instanceof Error ? error.name : "provider_failure")
    await recordAdminIncident({
      fingerprint: "image:prompt-optimizer:failure",
      category: "runtime", severity: "medium", module: "image-studio-pro",
      title: "Optimizador visual no disponible",
      message: "El optimizador IA falló; Diseño Pro puede continuar con las reglas de la skill local.",
    })
    const typed = error as Error & { status?: number; code?: string }
    return NextResponse.json({
      error: typed.code === "EDUAI_ACCESS_RESTRICTED"
        ? typed.message
        : "No fue posible optimizar la solicitud en este momento.",
      code: typed.code,
    }, { status: typed.status || 500, headers: HEADERS })
  }
}
