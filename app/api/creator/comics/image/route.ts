import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdmin } from "@supabase/supabase-js"
import {
  GEMINI_IMAGE_MODELS,
  aspectRatio,
  getGeminiImageKeys,
} from "@/lib/image-config"

export const runtime = "nodejs"
export const maxDuration = 55

const NO_CACHE = { "Cache-Control": "no-store, max-age=0" }
const MAX_REFERENCE_BYTES = 8 * 1024 * 1024
const MAX_REFERENCES = 7

type ComicStyle = "manga" | "western" | "webtoon" | "child"
type ConsistencyMode = "basic" | "high" | "strict"
type Action = "cast" | "character" | "panel"

type CharacterInput = {
  id: string
  name: string
  description: string
  visualDescription: string
  fixedTraits: string
  outfit: string
  accessories: string
  prohibitedChanges: string
  referenceImageUrl?: string
}

type PanelInput = {
  id: string
  title: string
  scene: string
  dialogue: string
  shot: string
  imagePrompt: string
  emotion: string
  background: string
  characterIds: string[]
}

type ReferencePart = {
  inlineData: {
    mimeType: string
    data: string
  }
}

const STYLE_GUIDES: Record<ComicStyle, string> = {
  manga: "professional black-and-white educational manga, precise ink line art, controlled screentones, expressive faces, cinematic panel composition",
  western: "professional full-color western comic illustration, clean outlines, controlled cel shading, dynamic but readable educational composition",
  webtoon: "professional Korean webtoon illustration, clean digital linework, polished colors, vertical-friendly readable composition",
  child: "professional children's educational comic illustration, friendly proportions, simple readable shapes, warm colors and clear expressions",
}

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

function styleValue(value: unknown): ComicStyle {
  return value === "western" || value === "webtoon" || value === "child" ? value : "manga"
}

function consistencyValue(value: unknown): ConsistencyMode {
  return value === "basic" || value === "strict" ? value : "high"
}

function cleanCharacters(value: unknown): CharacterInput[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 8).map((item: any, index) => ({
    id: text(item?.id, 100) || `character-${index + 1}`,
    name: text(item?.name, 80) || `Personaje ${index + 1}`,
    description: text(item?.description, 600),
    visualDescription: text(item?.visualDescription, 1200),
    fixedTraits: text(item?.fixedTraits, 700),
    outfit: text(item?.outfit, 700),
    accessories: text(item?.accessories, 500),
    prohibitedChanges: text(item?.prohibitedChanges, 700),
    referenceImageUrl: text(item?.referenceImageUrl, 2000) || undefined,
  }))
}

function cleanPanel(value: unknown): PanelInput {
  const item = value as any
  return {
    id: text(item?.id, 100) || "panel",
    title: text(item?.title, 180) || "Viñeta",
    scene: text(item?.scene, 1800),
    dialogue: text(item?.dialogue, 1200),
    shot: text(item?.shot, 200),
    imagePrompt: text(item?.imagePrompt, 1800),
    emotion: text(item?.emotion, 300),
    background: text(item?.background, 800),
    characterIds: Array.isArray(item?.characterIds)
      ? item.characterIds.map((id: unknown) => text(id, 100)).filter(Boolean).slice(0, 8)
      : [],
  }
}

function parseDataUrl(source: string): ReferencePart | null {
  const match = source.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=]+)$/)
  if (!match) return null
  const bytes = Buffer.from(match[2], "base64")
  if (!bytes.length || bytes.length > MAX_REFERENCE_BYTES) return null
  return { inlineData: { mimeType: match[1], data: match[2] } }
}

function allowedReferenceHost(hostname: string) {
  try {
    const ownHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://invalid.local").hostname
    return hostname === ownHost
  } catch {
    return false
  }
}

async function loadReference(source: string): Promise<ReferencePart | null> {
  const data = parseDataUrl(source)
  if (data) return data

  let url: URL
  try {
    url = new URL(source)
  } catch {
    return null
  }
  if (url.protocol !== "https:" || !allowedReferenceHost(url.hostname)) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8_000)
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "EduAI-Comic-Reference/1.0" },
      signal: controller.signal,
    })
    if (!response.ok) return null
    const length = Number(response.headers.get("content-length") || 0)
    if (length > MAX_REFERENCE_BYTES) return null
    const mimeType = response.headers.get("content-type") || "image/png"
    if (!mimeType.startsWith("image/")) return null
    const buffer = Buffer.from(await response.arrayBuffer())
    if (!buffer.length || buffer.length > MAX_REFERENCE_BYTES) return null
    return { inlineData: { mimeType, data: buffer.toString("base64") } }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function uploadImage(imageDataUrl: string, userId: string, category: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return imageDataUrl

  const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!match) return imageDataUrl
  const extension = match[1].includes("jpeg") ? "jpg" : match[1].split("/")[1] || "png"
  const path = `comics/${userId}/${category}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${extension}`
  const admin = createAdmin(url, serviceKey)
  const { error } = await admin.storage
    .from("generated-images")
    .upload(path, Buffer.from(match[2], "base64"), {
      contentType: match[1],
      cacheControl: "31536000",
      upsert: false,
    })
  if (error) {
    console.warn("[Comics][Storage]", error.message)
    return imageDataUrl
  }
  const { data } = admin.storage.from("generated-images").getPublicUrl(path)
  return data.publicUrl || imageDataUrl
}

function orderedModels(preferredModel: string) {
  const available = [...new Set(GEMINI_IMAGE_MODELS)]
  if (!preferredModel || !available.includes(preferredModel)) return available
  return [preferredModel, ...available.filter((model) => model !== preferredModel)]
}

async function generateGeminiImage({
  prompt,
  width,
  height,
  references,
  preferredModel,
}: {
  prompt: string
  width: number
  height: number
  references: string[]
  preferredModel: string
}) {
  const keys = getGeminiImageKeys()
  if (!keys.length) throw new Error("No hay una clave Gemini configurada para generar imágenes.")

  const referenceParts = (
    await Promise.all(references.slice(0, MAX_REFERENCES).map((source) => loadReference(source)))
  ).filter((part): part is ReferencePart => Boolean(part))

  let lastError = "El motor no devolvió una imagen."
  for (const model of orderedModels(preferredModel)) {
    for (const key of keys) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 50_000)
      try {
        const imageSettings: Record<string, string> = { aspectRatio: aspectRatio(width, height) }
        if (model.startsWith("gemini-3")) imageSettings.imageSize = "1K"
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": key,
            },
            body: JSON.stringify({
              contents: [{
                role: "user",
                parts: [
                  { text: prompt },
                  ...referenceParts,
                ],
              }],
              generationConfig: {
                responseModalities: ["TEXT", "IMAGE"],
                responseFormat: { image: imageSettings },
              },
            }),
            signal: controller.signal,
          },
        )
        if (!response.ok) {
          lastError = `Gemini ${model}: HTTP ${response.status}`
          continue
        }
        const payload = await response.json()
        const parts = payload?.candidates?.[0]?.content?.parts || []
        const imagePart = parts.find((part: any) => part?.inlineData?.data && part?.inlineData?.mimeType?.startsWith("image/"))
        if (imagePart) {
          return {
            imageDataUrl: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`,
            model,
            referenceCount: referenceParts.length,
          }
        }
        lastError = `Gemini ${model} respondió sin imagen.`
      } catch (error) {
        lastError = error instanceof Error && error.name === "AbortError"
          ? `Gemini ${model} excedió el tiempo disponible.`
          : error instanceof Error ? error.message : "Falló el motor de imagen."
      } finally {
        clearTimeout(timer)
      }
    }
  }
  throw new Error(lastError)
}

function characterContract(character: CharacterInput, index: number) {
  return [
    `CHARACTER ${index + 1}: ${character.name}.`,
    character.description ? `Role and personality: ${character.description}.` : "",
    character.visualDescription ? `Physical appearance: ${character.visualDescription}.` : "",
    character.fixedTraits ? `Immutable traits: ${character.fixedTraits}.` : "",
    character.outfit ? `Permanent outfit and colors: ${character.outfit}.` : "",
    character.accessories ? `Permanent accessories: ${character.accessories}.` : "",
    character.prohibitedChanges ? `Never change: ${character.prohibitedChanges}.` : "",
  ].filter(Boolean).join(" ")
}

function castPrompt({
  title,
  topic,
  audience,
  style,
  styleDirection,
  characters,
}: {
  title: string
  topic: string
  audience: string
  style: ComicStyle
  styleDirection: string
  characters: CharacterInput[]
}) {
  return `Create the definitive visual identity bible for one coherent educational comic.
Comic: ${title}. Topic: ${topic}. Audience: ${audience}.
Art direction: ${STYLE_GUIDES[style]}. ${styleDirection}

Show every character as a clean professional model sheet on one neutral light background. Arrange characters from left to right in the exact order listed below. For each character show a full-body front view and one three-quarter view. Keep proportions, face, hair, species, clothing colors, accessories and age unambiguous. Characters must be visually distinct from one another.

${characters.map(characterContract).join("\n\n")}

This image is a production reference, not a comic scene. No speech bubbles, no captions, no labels, no written words, no logos and no watermark. Do not redesign or merge characters.`
}

function individualCharacterPrompt({
  title,
  style,
  styleDirection,
  character,
}: {
  title: string
  style: ComicStyle
  styleDirection: string
  character: CharacterInput
}) {
  return `Using the attached cast reference as the identity source, create a focused model sheet for ${character.name} from the comic "${title}".
${characterContract(character, 0)}
Art direction: ${STYLE_GUIDES[style]}. ${styleDirection}
Show the exact same character in full-body front view, three-quarter view and two clear facial expressions. Preserve the exact face, hair or fur, body proportions, clothing, colors and accessories from the reference. Neutral light background. No written words, no labels, no speech bubbles, no logo and no watermark.`
}

function panelPrompt({
  title,
  topic,
  audience,
  educationalGoal,
  style,
  styleDirection,
  consistencyMode,
  characters,
  panel,
  panels,
  panelIndex,
}: {
  title: string
  topic: string
  audience: string
  educationalGoal: string
  style: ComicStyle
  styleDirection: string
  consistencyMode: ConsistencyMode
  characters: CharacterInput[]
  panel: PanelInput
  panels: PanelInput[]
  panelIndex: number
}) {
  const present = panel.characterIds.length
    ? characters.filter((character) => panel.characterIds.includes(character.id))
    : characters
  const continuity = panels
    .map((item, index) => `${index + 1}. ${item.title}: ${item.scene}`)
    .join(" ")
    .slice(0, 5000)
  const strictness = consistencyMode === "strict"
    ? "STRICT CONSISTENCY: copy the exact character identities, outfits, palette, line weight and rendering style from every attached reference. No reinterpretation is allowed."
    : consistencyMode === "high"
      ? "HIGH CONSISTENCY: use the attached identity references as the source of truth for faces, clothing, colors, proportions and art style."
      : "Maintain recognizable characters and the selected art style."

  return `Create panel ${panelIndex + 1} of the same coherent educational comic "${title}" about ${topic}.
${strictness}
Art direction: ${STYLE_GUIDES[style]}. ${styleDirection}
Audience: ${audience}. Educational objective: ${educationalGoal || "Explain the topic clearly through the story"}.
Complete story continuity: ${continuity}

CURRENT PANEL
Title: ${panel.title}
Scene and action: ${panel.scene}
Location/background: ${panel.background || "Use the location described in the scene"}
Emotional direction: ${panel.emotion || "Natural expression matching the scene"}
Camera framing: ${panel.shot || "medium shot"}
Additional visual instruction: ${panel.imagePrompt || "Follow the scene exactly"}
Characters present: ${present.map((character) => character.name).join(", ") || "No main character"}

IDENTITY CONTRACT FOR PRESENT CHARACTERS
${present.map(characterContract).join("\n\n")}

Generate one single finished comic panel only. Do not create a page with multiple panels. Do not include any dialogue, text, captions, labels, letters, speech bubbles, logo or watermark. Leave suitable negative space for an editable dialogue layer. Keep every character identical to the attached references.`
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401, headers: NO_CACHE })

  const body = await request.json().catch(() => null)
  const action = text(body?.action, 20) as Action
  if (action !== "cast" && action !== "character" && action !== "panel") {
    return NextResponse.json({ error: "Acción de imagen no válida." }, { status: 400, headers: NO_CACHE })
  }

  const title = text(body?.title, 240) || "Historieta educativa"
  const topic = text(body?.topic, 2000)
  const audience = text(body?.audience, 300) || "Estudiantes"
  const educationalGoal = text(body?.educationalGoal, 1200)
  const style = styleValue(body?.style)
  const styleDirection = text(body?.styleDirection, 1200)
  const consistencyMode = consistencyValue(body?.consistencyMode)
  const characters = cleanCharacters(body?.characters)
  const preferredModel = text(body?.preferredModel, 120)

  if (!characters.length) {
    return NextResponse.json({ error: "Agrega al menos un personaje con una descripción visual." }, { status: 400, headers: NO_CACHE })
  }

  try {
    if (action === "cast") {
      const generated = await generateGeminiImage({
        prompt: castPrompt({ title, topic, audience, style, styleDirection, characters }),
        width: 1376,
        height: 768,
        references: [],
        preferredModel,
      })
      const imageUrl = await uploadImage(generated.imageDataUrl, user.id, "cast")
      return NextResponse.json({
        success: true,
        imageUrl,
        provider: "Gemini Imagen",
        model: generated.model,
        referenceCount: generated.referenceCount,
      }, { headers: NO_CACHE })
    }

    if (action === "character") {
      const characterId = text(body?.characterId, 100)
      const character = characters.find((item) => item.id === characterId)
      if (!character) return NextResponse.json({ error: "No se encontró el personaje." }, { status: 400, headers: NO_CACHE })
      const castImageUrl = text(body?.castImageUrl, 2000)
      const generated = await generateGeminiImage({
        prompt: individualCharacterPrompt({ title, style, styleDirection, character }),
        width: 1024,
        height: 1024,
        references: castImageUrl ? [castImageUrl] : [],
        preferredModel,
      })
      const imageUrl = await uploadImage(generated.imageDataUrl, user.id, `character-${character.id.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40) || "ref"}`)
      return NextResponse.json({
        success: true,
        imageUrl,
        provider: "Gemini Imagen",
        model: generated.model,
        referenceCount: generated.referenceCount,
      }, { headers: NO_CACHE })
    }

    const panel = cleanPanel(body?.panel)
    const panels = Array.isArray(body?.panels) ? body.panels.slice(0, 10).map(cleanPanel) : [panel]
    const panelIndex = Math.max(0, Math.min(panels.length - 1, Number(body?.panelIndex) || 0))
    const castImageUrl = text(body?.castImageUrl, 2000)
    const neighborImages = Array.isArray(body?.neighborImages)
      ? body.neighborImages.map((value: unknown) => text(value, 2000)).filter(Boolean).slice(0, 2)
      : []
    const presentCharacters = panel.characterIds.length
      ? characters.filter((character) => panel.characterIds.includes(character.id))
      : characters
    const references = [
      castImageUrl,
      ...presentCharacters.map((character) => character.referenceImageUrl || ""),
      ...(consistencyMode === "strict" ? neighborImages : []),
    ].filter(Boolean)

    const vertical = style === "webtoon"
    const generated = await generateGeminiImage({
      prompt: panelPrompt({
        title,
        topic,
        audience,
        educationalGoal,
        style,
        styleDirection,
        consistencyMode,
        characters,
        panel,
        panels,
        panelIndex,
      }),
      width: vertical ? 768 : 1200,
      height: vertical ? 1376 : 896,
      references,
      preferredModel,
    })
    const imageUrl = await uploadImage(generated.imageDataUrl, user.id, `panel-${panelIndex + 1}`)
    return NextResponse.json({
      success: true,
      imageUrl,
      provider: "Gemini Imagen",
      model: generated.model,
      referenceCount: generated.referenceCount,
    }, { headers: NO_CACHE })
  } catch (error) {
    console.error("[Comics][Image]", error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : "No fue posible generar la imagen.",
    }, { status: 502, headers: NO_CACHE })
  }
}
