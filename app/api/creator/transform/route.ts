import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { structureWithAI, type OutputFormat } from "@/lib/content-processor"

export const runtime = "nodejs"
export const maxDuration = 55

const TARGET_FORMATS: OutputFormat[] = [
  "infographic",
  "ppt",
  "poster",
  "podcast",
  "mindmap",
  "flashcards",
  "quiz",
  "timeline",
  "cornell",
  "glossary",
  "story",
  "song",
  "lessonplan",
]
const MAX_BODY_BYTES = 500_000
const HEADERS = { "Cache-Control": "no-store, max-age=0" }

function safeJson(value: unknown) {
  return JSON.stringify(value, (_key, child) => {
    if (typeof child === "string" && child.startsWith("data:")) return "[archivo embebido omitido]"
    if (typeof child === "string" && child.length > 20_000) return `${child.slice(0, 20_000)}…`
    if (_key === "imageUrl" || _key === "thumbnailUrl" || _key === "embedUrl") return child
    return child
  }).slice(0, 190_000)
}

function sourceTitle(data: any) {
  return data?.title || data?.headline || data?.deckTitle || data?.centralTopic || data?.topic || "Material EduAI"
}

export async function POST(request: NextRequest) {
  const length = Number(request.headers.get("content-length") || 0)
  if (length > MAX_BODY_BYTES) return NextResponse.json({ error: "El material es demasiado extenso para transformarlo de una vez." }, { status: 413, headers: HEADERS })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401, headers: HEADERS })

  const body = await request.json().catch(() => null)
  const targetFormat = body?.targetFormat as OutputFormat
  if (!TARGET_FORMATS.includes(targetFormat)) return NextResponse.json({ error: "Formato de destino no compatible." }, { status: 400, headers: HEADERS })
  if (!body?.data || typeof body.data !== "object") return NextResponse.json({ error: "Falta el material de origen." }, { status: 400, headers: HEADERS })

  const key = process.env.GEMINI_API_KEY
  if (!key) return NextResponse.json({ error: "El motor de transformación no está configurado." }, { status: 503, headers: HEADERS })

  const sourceFormat = typeof body?.sourceFormat === "string" ? body.sourceFormat.slice(0, 80) : "material"
  const instruction = typeof body?.instruction === "string" ? body.instruction.trim().slice(0, 1500) : ""
  const sourceData = body.data
  const rawText = `TRANSFORMACIÓN DE MATERIAL EDUCATIVO
Formato de origen: ${sourceFormat}
Formato de destino: ${targetFormat}
Título de origen: ${sourceTitle(sourceData)}
Instrucción adicional: ${instruction || "Conservar todas las ideas importantes y adaptar la estructura pedagógica al nuevo formato."}

Material estructurado de origen:
${safeJson(sourceData)}

Reglas:
- No inventes cifras, fuentes, fechas ni respuestas que no se desprendan del material.
- Conserva la intención pedagógica, los conceptos principales y el nivel de dificultad.
- Reorganiza el contenido para aprovechar el formato de destino; no copies solamente la misma estructura.
- El resultado debe seguir siendo editable por bloques y capas.
- Usa español de Chile claro y correcto.`

  const extracted = {
    success: true,
    sourceType: "text" as const,
    title: sourceTitle(sourceData),
    rawText,
    wordCount: rawText.split(/\s+/).filter(Boolean).length,
  }

  try {
    const structured = await structureWithAI(extracted, targetFormat, key)
    if (!structured.success || !structured.data) return NextResponse.json({ error: "No fue posible adaptar el material al formato elegido." }, { status: 422, headers: HEADERS })

    const sourceDesign = sourceData?._design && typeof sourceData._design === "object" ? sourceData._design : null
    return NextResponse.json({
      success: true,
      output: {
        format: targetFormat,
        data: {
          ...structured.data,
          ...(sourceDesign ? { _design: sourceDesign } : {}),
          _transformation: {
            sourceFormat,
            targetFormat,
            sourceTitle: sourceTitle(sourceData),
            transformedAt: new Date().toISOString(),
          },
        },
      },
    }, { headers: HEADERS })
  } catch (error) {
    console.error("[CreatorTransform]", error)
    return NextResponse.json({ error: "La transformación tardó demasiado o falló temporalmente." }, { status: 500, headers: HEADERS })
  }
}
