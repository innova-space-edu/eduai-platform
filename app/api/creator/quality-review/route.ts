import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 55

const MAX_BODY_BYTES = 350_000
const HEADERS = { "Cache-Control": "no-store, max-age=0" }

const QUALITY_SCHEMA = {
  type: "object",
  properties: {
    overallScore: { type: "integer", minimum: 0, maximum: 100 },
    spellingScore: { type: "integer", minimum: 0, maximum: 100 },
    pedagogyScore: { type: "integer", minimum: 0, maximum: 100 },
    coherenceScore: { type: "integer", minimum: 0, maximum: 100 },
    accessibilityScore: { type: "integer", minimum: 0, maximum: 100 },
    factualRiskScore: { type: "integer", minimum: 0, maximum: 100 },
    readingLevel: { type: "string" },
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          severity: { type: "string", enum: ["critical", "warning", "suggestion"] },
          category: { type: "string" },
          path: { type: "string" },
          message: { type: "string" },
          suggestion: { type: "string" },
        },
        required: ["severity", "category", "path", "message", "suggestion"],
      },
    },
    checks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          status: { type: "string", enum: ["pass", "warning", "fail"] },
          detail: { type: "string" },
        },
        required: ["label", "status", "detail"],
      },
    },
  },
  required: [
    "overallScore",
    "spellingScore",
    "pedagogyScore",
    "coherenceScore",
    "accessibilityScore",
    "factualRiskScore",
    "readingLevel",
    "summary",
    "strengths",
    "issues",
    "checks",
  ],
}

function sanitizeForReview(value: unknown) {
  const json = JSON.stringify(value, (_key, child) => {
    if (typeof child === "string" && child.startsWith("data:")) return "[archivo embebido omitido]"
    if (typeof child === "string" && child.length > 12_000) return `${child.slice(0, 12_000)}…`
    return child
  })
  return json.slice(0, 180_000)
}

export async function POST(request: NextRequest) {
  const length = Number(request.headers.get("content-length") || 0)
  if (length > MAX_BODY_BYTES) return NextResponse.json({ error: "El material es demasiado extenso para revisarlo de una vez." }, { status: 413, headers: HEADERS })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401, headers: HEADERS })

  const body = await request.json().catch(() => null)
  if (!body?.data || typeof body.data !== "object") return NextResponse.json({ error: "Falta el material para revisar." }, { status: 400, headers: HEADERS })

  const key = process.env.GEMINI_API_KEY
  if (!key) return NextResponse.json({ error: "El revisor de calidad no está configurado." }, { status: 503, headers: HEADERS })

  const format = typeof body?.format === "string" ? body.format.slice(0, 80) : "material educativo"
  const audience = typeof body?.audience === "string" ? body.audience.slice(0, 160) : "estudiantes de enseñanza media"
  const content = sanitizeForReview(body.data)

  const prompt = `Actúa como revisor pedagógico, editorial y de accesibilidad de materiales educativos en español de Chile.
Formato: ${format}
Público declarado: ${audience}
Material estructurado:
${content}

Evalúa con exigencia:
- ortografía, puntuación y claridad;
- coherencia entre título, contenido, actividades, preguntas, respuestas y conclusión;
- adecuación pedagógica y nivel de lectura;
- ambigüedad, repetición, exceso de texto y distractores defectuosos;
- accesibilidad: lenguaje comprensible, contraste descrito, dependencia exclusiva del color y estructura;
- riesgo factual: marca riesgo alto cuando una afirmación concreta requiere fuente o verificación; no inventes una corrección factual;
- para quiz, detecta respuestas múltiples o alternativas débiles;
- para plan de clase, revisa alineación objetivo-actividad-evaluación;
- para tablas, revisa encabezados, unidades y consistencia de filas;
- para historietas, revisa continuidad y correspondencia entre escena y diálogo.

El campo path debe identificar el lugar aproximado, por ejemplo questions[2].options, sections[1].points o objective.
Entrega sugerencias accionables y breves. factualRiskScore significa 100 = bajo riesgo y 0 = riesgo muy alto.`

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.15,
          maxOutputTokens: 5000,
          responseMimeType: "application/json",
          responseSchema: QUALITY_SCHEMA,
        },
      }),
      signal: AbortSignal.timeout(50_000),
    })

    if (!response.ok) {
      console.error("[CreatorQuality]", response.status, await response.text())
      return NextResponse.json({ error: "El revisor de calidad no respondió correctamente." }, { status: 502, headers: HEADERS })
    }
    const payload = await response.json()
    const raw = payload?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!raw) return NextResponse.json({ error: "El revisor no devolvió resultados." }, { status: 502, headers: HEADERS })
    return NextResponse.json({ success: true, review: JSON.parse(raw), reviewedAt: new Date().toISOString() }, { headers: HEADERS })
  } catch (error) {
    console.error("[CreatorQuality]", error)
    return NextResponse.json({ error: "La revisión tardó demasiado o falló temporalmente." }, { status: 500, headers: HEADERS })
  }
}
