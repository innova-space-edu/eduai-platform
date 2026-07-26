import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 55

const NO_CACHE = { "Cache-Control": "no-store, max-age=0" }

type CharacterRole = "protagonist" | "supporting" | "antagonist" | "other"

type CharacterInput = {
  name: string
  description: string
  visualDescription: string
  fixedTraits: string
  outfit: string
  accessories: string
  prohibitedChanges: string
  role: CharacterRole
  appearsAlways: boolean
  userCreated: boolean
}

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
          role: { type: "string", enum: ["protagonist", "supporting", "antagonist", "other"] },
          appearsAlways: { type: "boolean" },
        },
        required: [
          "name",
          "description",
          "visualDescription",
          "fixedTraits",
          "outfit",
          "accessories",
          "prohibitedChanges",
          "role",
          "appearsAlways",
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

function roleValue(value: unknown): CharacterRole {
  return value === "supporting" || value === "antagonist" || value === "other" ? value : "protagonist"
}

function cleanProvidedCharacters(value: unknown): CharacterInput[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 8).map((character: any, index) => ({
    name: text(character?.name, 80) || `Personaje ${index + 1}`,
    description: text(character?.description, 800),
    visualDescription: text(character?.visualDescription, 1600),
    fixedTraits: text(character?.fixedTraits, 900),
    outfit: text(character?.outfit, 900),
    accessories: text(character?.accessories, 600),
    prohibitedChanges: text(character?.prohibitedChanges, 900),
    role: roleValue(character?.role),
    appearsAlways: character?.appearsAlways === true,
    userCreated: character?.userCreated !== false,
  }))
}

function normalizeGeneratedCharacter(value: any, index: number) {
  return {
    name: text(value?.name, 80) || `Personaje ${index + 1}`,
    description: text(value?.description, 800),
    visualDescription: text(value?.visualDescription, 1600),
    fixedTraits: text(value?.fixedTraits, 900),
    outfit: text(value?.outfit, 900),
    accessories: text(value?.accessories, 600),
    prohibitedChanges: text(value?.prohibitedChanges, 900),
    role: roleValue(value?.role),
    appearsAlways: value?.appearsAlways === true,
    userCreated: false,
  }
}

function mergeCharacter(existing: CharacterInput, generated?: ReturnType<typeof normalizeGeneratedCharacter>) {
  if (!generated) return existing
  return {
    ...existing,
    description: existing.description || generated.description,
    visualDescription: existing.visualDescription || generated.visualDescription,
    fixedTraits: existing.fixedTraits || generated.fixedTraits,
    outfit: existing.outfit || generated.outfit,
    accessories: existing.accessories || generated.accessories,
    prohibitedChanges: existing.prohibitedChanges || generated.prohibitedChanges,
    role: existing.role,
    appearsAlways: existing.appearsAlways,
    userCreated: true,
  }
}

function finalCast(
  provided: CharacterInput[],
  generatedValue: unknown,
  autoCast: boolean,
) {
  const generated = Array.isArray(generatedValue)
    ? generatedValue.slice(0, 8).map(normalizeGeneratedCharacter)
    : []
  const generatedByName = new Map(generated.map((character) => [character.name.toLowerCase(), character]))
  const preserved = provided.map((character) => mergeCharacter(character, generatedByName.get(character.name.toLowerCase())))

  if (provided.length >= 2 || (provided.length === 1 && !autoCast)) return preserved
  if (provided.length === 1 && autoCast) {
    const additions = generated
      .filter((character) => !provided.some((item) => item.name.toLowerCase() === character.name.toLowerCase()))
      .filter((character) => !/^(guía|guia|mentor|mentora|teacher|profesor|profesora)$/i.test(character.name))
      .slice(0, 3)
    return [...preserved, ...additions]
  }
  return generated.slice(0, 5)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401, headers: NO_CACHE })

  const body = await request.json().catch(() => null)
  const topic = text(body?.topic, 4000)
  const worldContext = text(body?.worldContext, 12000)
  const audience = text(body?.audience, 300) || "Estudiantes"
  const educationalGoal = text(body?.educationalGoal, 1800)
  const style = text(body?.style, 40) || "manga"
  const requestedCount = Math.max(4, Math.min(10, Number(body?.panelCount) || 6))
  const providedCharacters = cleanProvidedCharacters(body?.characters)
  const autoCast = body?.autoCast !== false
  const allowExtras = body?.allowExtras !== false

  if (!topic && !worldContext) {
    return NextResponse.json({ error: "Describe el tema, la historia o el contexto del mundo." }, { status: 400, headers: NO_CACHE })
  }
  const key = process.env.GEMINI_API_KEY_TEXT || process.env.GEMINI_API_KEY
  if (!key) return NextResponse.json({ error: "El motor de storyboard no está configurado." }, { status: 503, headers: NO_CACHE })

  const castRule = providedCharacters.length >= 2
    ? `El reparto con nombre está cerrado. Usa exactamente estos ${providedCharacters.length} personajes y no inventes otros personajes con nombre.`
    : providedCharacters.length === 1 && autoCast
      ? "Conserva exactamente al personaje aportado y crea entre 1 y 3 personajes secundarios coherentes con este mundo. Sus funciones deben surgir de la historia; no crees automáticamente un guía, mentor, profesor o acompañante pedagógico."
      : providedCharacters.length === 1
        ? "Usa únicamente el personaje aportado como personaje con nombre. No inventes coprotagonistas ni guías."
        : "Crea entre 2 y 5 personajes diversos cuyas funciones nazcan del conflicto y del mundo. No uses un guía o mentor como fórmula predeterminada."

  const extrasRule = allowExtras
    ? "Puedes incluir extras sin nombre —peatones, criaturas, robots, estudiantes, guardias o multitudes— cuando el mundo y la escena lo requieran. No los agregues al reparto principal ni les des diálogos extensos."
    : "No agregues extras ni personajes ambientales que no estén en el reparto."

  const prompt = `Crea un storyboard profesional y coherente, preparado para generar imágenes con identidad persistente.

PREMISA O TEMA
${topic || "La premisa se encuentra dentro del contexto del mundo."}

CONTEXTO COMPLETO DEL MUNDO E HISTORIA
${worldContext || "No se entregó un contexto adicional."}

Público: ${audience}
Objetivo: ${educationalGoal || "Desarrollar la historia con claridad, coherencia y valor educativo cuando corresponda"}
Formato visual: ${style}
Cantidad exacta de viñetas: ${requestedCount}
Personajes aportados por el usuario: ${providedCharacters.length ? JSON.stringify(providedCharacters) : "Ninguno"}

REGLAS DEL REPARTO
- ${castRule}
- ${extrasRule}
- Nunca agregues un personaje llamado Guía, Mentor, Profesor o equivalente salvo que aparezca expresamente en los personajes aportados o sea indispensable según el contexto escrito por el usuario.
- Conserva sin cambios los nombres de los personajes aportados.
- Los personajes marcados appearsAlways deben aparecer en todas las viñetas.
- characterNames debe contener exclusivamente nombres del reparto final que sean visibles en esa viñeta.

FIDELIDAD AL CONTEXTO
- El contexto completo del mundo es una fuente de verdad persistente, no una introducción descartable.
- Respeta sus reglas sociales, tecnológicas, históricas, geográficas, mágicas, científicas, estéticas y narrativas durante toda la obra.
- No reemplaces el mundo por una ambientación escolar genérica ni introduzcas enseñanza explícita cuando el usuario no la pidió.
- Cada lugar, objeto, conflicto y diálogo debe ser compatible con ese contexto.

REGLAS DE HISTORIA
- Debe existir inicio, desarrollo del conflicto, progresión, giro o descubrimiento, resolución y cierre.
- Cada viñeta debe avanzar la historia; evita repetir acciones, encuadres o diálogos.
- El diálogo será una capa editable y no debe aparecer escrito dentro de imagePrompt.
- Mantén los diálogos breves: idealmente 25 a 70 palabras por viñeta y máximo 110 palabras.
- Todo el contenido debe estar en español.

CONTRATO VISUAL
- visualDescription debe detallar edad aparente, especie, rostro, cabello o pelaje, ojos, proporciones y rasgos reconocibles.
- fixedTraits debe enumerar rasgos físicos que jamás deben cambiar.
- outfit debe fijar ropa, calzado y colores exactos.
- accessories debe fijar accesorios permanentes.
- prohibitedChanges debe indicar qué no se puede modificar.
- No cambies edad, especie, rostro, cuerpo, cabello, pelaje, ropa, colores ni accesorios entre viñetas.

DIRECCIÓN VISUAL
- styleDirection debe definir línea, sombreado, paleta, iluminación, nivel de detalle, fondos y composición global.
- scene debe describir acción, posiciones, lugar, objetos y relación espacial.
- background debe conservar la continuidad ambiental.
- emotion debe definir expresiones y lenguaje corporal.
- shot debe indicar encuadre y ángulo.
- imagePrompt debe describir solo elementos visuales específicos; no debe redefinir identidades.
- Compón la escena dejando zonas seguras para el diálogo: evita rostros y acciones principales en las esquinas superiores y reserva una franja inferior discreta cuando el diálogo sea largo.
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
            temperature: 0.42,
            maxOutputTokens: 9000,
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
    const characters = finalCast(providedCharacters, data.characters, autoCast)
    const allowedNames = new Map(characters.map((character) => [character.name.toLowerCase(), character.name]))
    const alwaysNames = characters.filter((character) => character.appearsAlways).map((character) => character.name)

    data.characters = characters
    data.panels = (Array.isArray(data.panels) ? data.panels : [])
      .slice(0, requestedCount)
      .map((panel: any) => {
        const requestedNames = Array.isArray(panel?.characterNames) ? panel.characterNames : []
        const characterNames = requestedNames
          .map((name: unknown) => allowedNames.get(text(name, 80).toLowerCase()))
          .filter(Boolean)
        return {
          ...panel,
          dialogue: text(panel?.dialogue, 1400),
          characterNames: [...new Set([...alwaysNames, ...characterNames])],
        }
      })

    return NextResponse.json({ success: true, storyboard: data }, { headers: NO_CACHE })
  } catch (error) {
    console.error("[Comics][Storyboard]", error)
    return NextResponse.json({ error: "El storyboard tardó demasiado o falló temporalmente." }, { status: 500, headers: NO_CACHE })
  }
}
