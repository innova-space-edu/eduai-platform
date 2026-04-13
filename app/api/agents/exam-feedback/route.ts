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
      const isCorrect = a.isCorrect === true || a.selectionCorrect === true
      const studentAns = q.type === "development"
        ? (a.devText || "Sin respuesta")
        : (q.options?.[a.selectedAnswer] !== undefined ? q.options[a.selectedAnswer] : "Sin respuesta")
      const correctIdx = typeof q.correctAnswer === "number" ? q.correctAnswer : 0
      const correctAns = q.type === "development"
        ? (q.modelAnswer || q.expectedAnswer || "Ver rúbrica")
        : (q.options?.[correctIdx] || "—")
      const allOptions = Array.isArray(q.options) ? q.options.map((o: string, j: number) => `  ${j===correctIdx?"✓":"-"} ${o}`).join("\n") : ""

      return `[${i}] Tipo: ${q.type}
Pregunta: ${q.question}
Opciones:\n${allOptions}
Respuesta del estudiante: "${studentAns}" → ${isCorrect ? "✓ CORRECTA" : "✗ INCORRECTA"}
Respuesta correcta: "${correctAns}"
Explicación oficial: ${q.explanation || "—"}
Puntaje obtenido: ${a.aiScore !== undefined ? a.aiScore : (isCorrect ? (q.maxPoints||1) : 0)} / ${q.maxPoints || 1}`
    }).join("\n\n")

    const prompt = `Eres un tutor educativo amigable, empático y PRECISO. Genera retroalimentación para cada pregunta.

REGLAS IMPORTANTES:
- Basa tu retroalimentación ÚNICAMENTE en la respuesta correcta indicada — no inventes ni cambies la respuesta correcta
- Para alternativas: la opción marcada con ✓ es la ÚNICA correcta — comenta por qué esa opción es la correcta
- Si el estudiante erró: explica el concepto clave que lleva a la respuesta correcta, de forma positiva
- Si fue correcta: refuerza brevemente por qué esa respuesta demuestra comprensión del concepto
- Extensión: 2-3 oraciones por pregunta, lenguaje cercano y constructivo

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
