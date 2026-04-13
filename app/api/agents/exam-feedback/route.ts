// app/api/agents/exam-feedback/route.ts
import { NextRequest, NextResponse } from "next/server"

async function callAI(prompt: string): Promise<string> {
  const gKey = process.env.GEMINI_API_KEY
  if (gKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${gKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 2000, responseMimeType: "application/json" },
          }),
          signal: AbortSignal.timeout(25000),
        }
      )
      if (res.ok) {
        const d = await res.json()
        return d.candidates?.[0]?.content?.parts?.[0]?.text || ""
      }
    } catch {}
  }

  const gqKey = process.env.GROQ_API_KEY
  if (!gqKey) throw new Error("Sin API key")
  const Groq = (await import("groq-sdk")).default
  const groq = new Groq({ apiKey: gqKey })
  const res = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    temperature: 0.3, max_tokens: 2000,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "Eres un tutor educativo. Responde SOLO con JSON válido." },
      { role: "user", content: prompt },
    ],
  })
  return res.choices[0]?.message?.content || ""
}

export async function POST(req: NextRequest) {
  try {
    const { questions, answers } = await req.json()
    if (!Array.isArray(questions) || !questions.length) {
      return NextResponse.json({ feedback: [] })
    }

    const questionBlock = questions.map((q: any, i: number) => {
      const a = answers?.[i] || {}
      const isCorrect = a.isCorrect === true
      const studentAns = q.type === "development"
        ? (a.devText || "Sin respuesta")
        : (q.options?.[a.selectedAnswer] || "Sin respuesta")
      const correctAns = q.type === "development"
        ? (q.modelAnswer || q.expectedAnswer || "Ver rúbrica")
        : (q.options?.[q.correctAnswer] || "—")

      return `[${i}] Pregunta: ${q.question}
Tipo: ${q.type}
Respuesta estudiante: ${studentAns}
Respuesta correcta: ${q.type !== "development" ? correctAns : "Ver rúbrica"}
¿Correcta?: ${isCorrect ? "Sí" : "No"}
Explicación del autor: ${q.explanation || "—"}`
    }).join("\n\n")

    const prompt = `Eres un tutor educativo amigable y empático. Genera retroalimentación breve (2-3 oraciones) para cada pregunta de este examen.

Para cada pregunta:
- Si fue correcta: refuerza por qué está bien y destaca lo que el estudiante demostró saber
- Si fue incorrecta: explica el concepto clave de forma clara y positiva, sin regañar
- Si es desarrollo: comenta sobre la calidad de la respuesta dada
- Usa lenguaje cercano, motivador y constructivo

PREGUNTAS:
${questionBlock}

Responde SOLO con este JSON, sin texto adicional:
{
  "feedback": [
    { "index": 0, "text": "retroalimentación aquí" },
    { "index": 1, "text": "retroalimentación aquí" }
  ]
}`

    const raw = await callAI(prompt)
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim())
    return NextResponse.json({ feedback: parsed.feedback || [] })
  } catch (err: any) {
    return NextResponse.json({ feedback: [] })
  }
}
