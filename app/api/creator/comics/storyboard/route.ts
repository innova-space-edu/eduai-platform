import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 55

const NO_CACHE = { "Cache-Control": "no-store, max-age=0" }

const SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    characters: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          visualDescription: { type: "string" },
        },
        required: ["name", "description", "visualDescription"],
      },
    },
    panels: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          scene: { type: "string" },
          dialogue: { type: "string" },
          shot: { type: "string" },
          imagePrompt: { type: "string" },
        },
        required: ["title", "scene", "dialogue", "shot", "imagePrompt"],
      },
    },
  },
  required: ["title", "summary", "characters", "panels"],
}

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401, headers: NO_CACHE })

  const body = await request.json().catch(() => null)
  const topic = text(body?.topic, 2000)
  const audience = text(body?.audience, 300) || "Estudiantes"
  const educationalGoal = text(body?.educationalGoal, 1200)
  const style = text(body?.style, 40) || "manga"
  const requestedCount = Math.max(4, Math.min(10, Number(body?.panelCount) || 6))
  const providedCharacters = Array.isArray(body?.characters)
    ? body.characters.slice(0, 8).map((character: any) => ({ name: text(character?.name, 80), description: text(character?.description, 500) }))
    : []

  if (!topic) return NextResponse.json({ error: "Describe el tema o la historia." }, { status: 400, headers: NO_CACHE })
  const key = process.env.GEMINI_API_KEY
  if (!key) return NextResponse.json({ error: "El motor de storyboard no está configurado." }, { status: 503, headers: NO_CACHE })

  const prompt = `Crea un storyboard educativo coherente y visualmente consistente.
Tema o historia: ${topic}
Público: ${audience}
Objetivo educativo: ${educationalGoal || "Explicar el tema de manera clara y entretenida"}
Estilo visual: ${style}
Cantidad exacta de viñetas: ${requestedCount}
Personajes propuestos: ${providedCharacters.length ? JSON.stringify(providedCharacters) : "Crea 2 o 3 personajes apropiados"}

Reglas:
- Toda la historia debe tener inicio, conflicto/pregunta, exploración, evidencia, resolución y cierre.
- Mantén exactamente la misma ropa, rasgos, colores y accesorios de cada personaje en todas las viñetas.
- visualDescription debe detallar edad aproximada, cabello, rostro, ropa, colores y accesorios de cada personaje.
- scene describe acciones, lugar, emociones y objetos visibles.
- dialogue debe corresponder directamente a la escena y aportar al aprendizaje.
- imagePrompt debe ser autosuficiente, describir la viñeta concreta y repetir los rasgos visuales de los personajes presentes.
- No incluyas texto escrito dentro de imagePrompt; los diálogos se añadirán como capas editables.
- Todo en español.`

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 6000,
          responseMimeType: "application/json",
          responseSchema: SCHEMA,
        },
      }),
      signal: AbortSignal.timeout(50_000),
    })

    if (!response.ok) {
      console.error("[Comics][Storyboard]", response.status, await response.text())
      return NextResponse.json({ error: "No fue posible generar el storyboard. Intenta nuevamente." }, { status: 502, headers: NO_CACHE })
    }

    const payload = await response.json()
    const raw = payload?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!raw) return NextResponse.json({ error: "El motor no devolvió un storyboard." }, { status: 502, headers: NO_CACHE })
    const data = JSON.parse(raw)
    data.panels = Array.isArray(data.panels) ? data.panels.slice(0, requestedCount) : []
    return NextResponse.json({ success: true, storyboard: data }, { headers: NO_CACHE })
  } catch (error) {
    console.error("[Comics][Storyboard]", error)
    return NextResponse.json({ error: "El storyboard tardó demasiado o falló temporalmente." }, { status: 500, headers: NO_CACHE })
  }
}
