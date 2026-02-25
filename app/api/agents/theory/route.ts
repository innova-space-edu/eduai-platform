import Groq from "groq-sdk"
import { createClient } from "@/lib/supabase/server"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { topic, level = 1 } = await req.json()

  const levelDescriptions: Record<number, string> = {
    1: "principiante absoluto, sin conocimientos previos",
    2: "estudiante con nociones básicas del tema",
    3: "estudiante intermedio que conoce los conceptos base",
    4: "estudiante avanzado que puede analizar casos",
    5: "experto que puede evaluar problemas complejos",
    6: "maestro que puede enseñar el tema a otros",
  }

  const systemPrompt = `Eres AGT (Agente Generador de Teoría), un tutor experto que crea explicaciones educativas completas.

REGLAS:
- Explica en español siempre
- Adapta el lenguaje al nivel del estudiante
- Usa ejemplos concretos y cotidianos
- Estructura el contenido con secciones claras usando ## para títulos
- Usa **negrita** para conceptos clave
- Sé didáctico, claro y motivador
- IMPORTANTE: Completa SIEMPRE todas las secciones sin cortar el texto`

  const userPrompt = `Crea una explicación teórica COMPLETA sobre: "${topic}"

Nivel del estudiante: ${levelDescriptions[level] || levelDescriptions[1]}

Usa exactamente esta estructura y completa CADA sección:

## ¿Qué es ${topic}?
(2-3 párrafos de introducción clara)

## Conceptos fundamentales
(los 3-4 pilares esenciales del tema)

## ¿Cómo funciona?
(desarrollo con ejemplos concretos)

## Aplicaciones en la vida real
(3-4 ejemplos de para qué sirve)

## Resumen clave
(5 puntos esenciales en lista)

Sé conciso pero completo. No excedas 700 palabras en total.`

  try {
    const stream = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      stream: true,
      temperature: 0.7,
      max_tokens: 1500,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || ""
            if (text) controller.enqueue(encoder.encode(text))
          }
        } catch (e) {
          controller.error(e)
        } finally {
          controller.close()
        }
      }
    })

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-cache",
      }
    })
  } catch (e: any) {
    return new Response(e.message || "Error", { status: 500 })
  }
}
