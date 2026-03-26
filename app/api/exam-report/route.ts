// app/api/exam-report/route.ts
import { NextRequest, NextResponse } from "next/server"

export const runtime     = "nodejs"
export const maxDuration = 30

export async function POST(req: NextRequest) {
  const GEMINI_KEY = process.env.GEMINI_API_KEY
  if (!GEMINI_KEY) return NextResponse.json({ error: "Sin API key" }, { status: 500 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const { exam, submissions } = body
  if (!exam || !submissions?.length) return NextResponse.json({ error: "Datos insuficientes" }, { status: 400 })

  const questions: any[] = exam.questions || []
  const total = submissions.length
  const avgGrade = submissions.reduce((a: number, s: any) => a + s.grade, 0) / total
  const passCount = submissions.filter((s: any) => s.grade >= 4.0).length
  const passRate  = Math.round((passCount / total) * 100)
  const maxGrade  = Math.max(...submissions.map((s: any) => s.grade))
  const minGrade  = Math.min(...submissions.map((s: any) => s.grade))

  // Analizar qué preguntas tuvieron menor rendimiento
  const qStats = questions.map((q: any, qi: number) => {
    const maxPts  = q.maxPoints || 1
    let totalEarned = 0; let count = 0
    submissions.forEach((s: any) => {
      const a = s.answers?.[qi]
      if (!a) return
      count++
      if (a.type === "multiple_choice") totalEarned += a.isCorrect ? maxPts : 0
      else if (a.type === "true_false") {
        if (a.selectionCorrect || a.isCorrect) totalEarned += (a.selectionPoints || 1)
        totalEarned += Math.min(a.justificationMaxPoints || 0, a.justificationScore || 0)
      } else if (a.type === "development") {
        totalEarned += Math.min(maxPts, a.manualScore ?? a.aiScore ?? 0)
      }
    })
    const pct = count > 0 ? Math.round((totalEarned / count / maxPts) * 100) : 0
    return { qi: qi + 1, question: q.question?.slice(0, 80), type: q.type, ability: q.ability, pct, maxPts }
  }).sort((a, b) => a.pct - b.pct)

  const worst3  = qStats.slice(0, 3)
  const best3   = qStats.slice(-3).reverse()
  const level   = avgGrade >= 5.5 ? "alto" : avgGrade >= 4.0 ? "medio" : "bajo"

  const prompt = `Eres un analista pedagógico experto en evaluaciones escolares chilenas.
Analiza los siguientes resultados de un examen y redacta un informe de análisis de desempeño.

DATOS DEL EXAMEN:
- Título: "${exam.title}"
- Tema: "${exam.topic}"
- Total alumnos: ${total}
- Promedio del curso: ${avgGrade.toFixed(1)} (escala 1.0-7.0)
- Tasa de aprobación: ${passRate}% (${passCount} de ${total} alumnos)
- Nota máxima: ${maxGrade} | Nota mínima: ${minGrade}
- Nivel de rendimiento general: ${level}

PREGUNTAS CON MENOR RENDIMIENTO (las más difíciles):
${worst3.map(q => `- P${q.qi}: "${q.question}" → ${q.pct}% de logro | Tipo: ${q.type} | Habilidad: ${q.ability || "no especificada"}`).join("\n")}

PREGUNTAS CON MAYOR RENDIMIENTO (las más dominadas):
${best3.map(q => `- P${q.qi}: "${q.question}" → ${q.pct}% de logro`).join("\n")}

DISTRIBUCIÓN DE NOTAS:
${[
  { r: "7.0-6.0", c: submissions.filter((s:any) => s.grade >= 6).length },
  { r: "5.9-5.0", c: submissions.filter((s:any) => s.grade >= 5 && s.grade < 6).length },
  { r: "4.9-4.0", c: submissions.filter((s:any) => s.grade >= 4 && s.grade < 5).length },
  { r: "3.9-1.0", c: submissions.filter((s:any) => s.grade < 4).length },
].map(d => `- ${d.r}: ${d.c} alumnos`).join("\n")}

INSTRUCCIONES:
Redacta exactamente 3 párrafos en español formal:

1. ANÁLISIS GENERAL (aprox. 150 palabras): Describe el rendimiento general del curso. Explica POR QUÉ el nivel es ${level} (causas pedagógicas concretas, no solo estadísticas). Menciona la distribución de notas y qué dice sobre el dominio del contenido.

2. CONTENIDOS CRÍTICOS (aprox. 200 palabras): Analiza en detalle las preguntas con menor rendimiento. Identifica qué habilidades cognitivas o contenidos específicos les costó más a los estudiantes y por qué probablemente ocurrió. Relaciona con el tipo de pregunta (alternativas, V/F, desarrollo) y la habilidad cognitiva evaluada.

3. RECOMENDACIONES (aprox. 150 palabras): Proporciona 3-4 recomendaciones pedagógicas concretas y accionables para abordar las debilidades detectadas. Menciona también los contenidos que los alumnos dominaron bien y cómo consolidarlos.

Escribe de forma justificada, académica pero accesible. Usa lenguaje claro y directo.
Responde SOLO con el texto de los 3 párrafos, sin títulos ni markdown.`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.6, maxOutputTokens: 1200 },
        }),
        signal: AbortSignal.timeout(25000),
      }
    )
    if (!res.ok) throw new Error(`Gemini ${res.status}`)
    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ""

    // Separar los 3 párrafos
    const paragraphs = text.split(/\n\n+/).filter(Boolean)

    return NextResponse.json({
      success: true,
      analysis: {
        paragraphs,
        fullText: text,
        level,
        avgGrade: Math.round(avgGrade * 10) / 10,
        passRate,
        worst3,
        best3,
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
