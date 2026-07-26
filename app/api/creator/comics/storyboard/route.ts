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
    styleDirection: { type: "string" },
    characters: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          visualDescription: { type: "string" },
          fixedTraits: { type: "string" },
          outfit: { type: "string" },
          accessories: { type: "string" },
          prohibitedChanges: { type: "string" },
        },
        required: [
          "name",
          "description",
          "visualDescription",
          "fixedTraits",
          "outfit",
          "accessories",
          "prohibitedChanges",
        ],
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
          emotion: { type: "string" },
          background: { type: "string" },
          characterNames: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: [
          "title",
          "scene",
          "dialogue",
          "shot",
          "imagePrompt",
          "emotion",
          "background",
          "characterNames",
        ],
      },
    },
  },
  required: ["title", "summary", "styleDirection", "characters", "panels"],
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
    ? body.characters.slice(0, 8).map((character: any) => ({
        name: text(character?.name, 80),
        description: text(character?.description, 600),
        visualDescription: text(character?.visualDescription, 1200),
        fixedTraits: text(character?.fixedTraits, 700),
        outfit: text(character?.outfit, 700),
        accessories: text(character?.accessories, 500),
        prohibitedChanges: text(character?.prohibitedChanges, 700),
      }))
    : []

  if (!topic) return NextResponse.json({ error: "Describe el tema o la historia." }, { status: 400, headers: NO_CACHE })
  const key = process.env.GEMINI_API_KEY_TEXT || process.env.GEMINI_API_KEY
  if (!key) return NextResponse.json({ error: "El motor de storyboard no está configurado." }, { status: 503, headers: NO_CACHE })

  const prompt = `Crea un storyboard educativo profesional, coherente y preparado para generar imágenes con identidad persistente.

Tema o historia: ${topic}
Público: ${audience}
Objetivo educativo: ${educationalGoal || "Explicar el tema de manera clara, rigurosa y entretenida"}
Formato visual: ${style}
Cantidad exacta de viñetas: ${requestedCount}
Personajes propuestos: ${providedCharacters.length ? JSON.stringify(providedCharacters) : "Crea 2 o 3 personajes apropiados"}

REGLAS DE HISTORIA
- Debe existir inicio, pregunta o conflicto, exploración, evidencia, comprensión, resolución y cierre.
- Cada viñeta debe avanzar la historia y el aprendizaje; evita repetir acciones o diálogos.
- El diálogo será una capa editable, por lo que no debe aparecer escrito dentro de imagePrompt.
- Todo el contenido debe estar en español.

CONTRATO VISUAL DE PERSONAJES
- Conserva los nombres aportados por el usuario cuando existan.
- visualDescription debe detallar edad aparente, especie si corresponde, rostro, cabello o pelaje, ojos, proporciones y rasgos reconocibles.
- fixedTraits debe enumerar los rasgos físicos que jamás deben cambiar.
- outfit debe fijar ropa, calzado y colores exactos para toda la historieta.
- accessories debe fijar accesorios permanentes.
- prohibitedChanges debe indicar explícitamente qué no se puede modificar entre viñetas.
- No cambies edad, especie, rostro, cuerpo, cabello, pelaje, ropa, colores ni accesorios durante la historia.

DIRECCIÓN VISUAL
- styleDirection debe definir linework, sombreado, paleta, iluminación, nivel de detalle, fondos y composición global, para repetirse en todas las imágenes.
- scene debe describir acción, posición de personajes, lugar, objetos y relación espacial.
- background debe describir el ambiente constante y los elementos visibles del fondo.
- emotion debe describir expresiones y lenguaje corporal.
- shot debe indicar encuadre y ángulo de cámara.
- characterNames debe contener exactamente los nombres de los personajes visibles en esa viñeta.
- imagePrompt debe describir solo los elementos específicos adicionales de la viñeta; no debe redefinir ni cambiar la identidad de los personajes.
- No incluyas texto, títulos, globos, carteles legibles, marcas de agua ni diálogos en imagePrompt.`

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.45,
            maxOutputTokens: 8000,
            responseMimeType: "application/json",
            responseSchema: SCHEMA,
          },
        }),
        signal: AbortSignal.timeout(50_000),
      },
    )

    if (!response.ok) {
      console.error("[Comics][Storyboard]", response.status, await response.text())
      return NextResponse.json({ error: "No fue posible generar el storyboard. Intenta nuevamente." }, { status: 502, headers: NO_CACHE })
    }

    const payload = await response.json()
    const raw = payload?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!raw) return NextResponse.json({ error: "El motor no devolvió un storyboard." }, { status: 502, headers: NO_CACHE })
    const data = JSON.parse(raw)
    data.characters = Array.isArray(data.characters) ? data.characters.slice(0, 8) : []
    data.panels = Array.isArray(data.panels) ? data.panels.slice(0, requestedCount) : []
    return NextResponse.json({ success: true, storyboard: data }, { headers: NO_CACHE })
  } catch (error) {
    console.error("[Comics][Storyboard]", error)
    return NextResponse.json({ error: "El storyboard tardó demasiado o falló temporalmente." }, { status: 500, headers: NO_CACHE })
  }
}
