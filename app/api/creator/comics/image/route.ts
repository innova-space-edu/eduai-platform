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
type CharacterRole = "protagonist" | "supporting" | "antagonist" | "other"

type CharacterInput = {
  id: string
  name: string
  description: string
  visualDescription: string
  fixedTraits: string
  outfit: string
  accessories: string
  prohibitedChanges: string
  role: CharacterRole
  appearsAlways: boolean
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
  western: "professional full-color western comic illustration, clean outlines, controlled cel shading, dynamic but readable composition",
  webtoon: "professional Korean webtoon illustration, clean digital linework, polished colors, vertical-friendly readable composition",
  child: "professional children's comic illustration, friendly proportions, simple readable shapes, warm colors and clear expressions",
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

function roleValue(value: unknown): CharacterRole {
  return value === "supporting" || value === "antagonist" || value === "other" ? value : "protagonist"
}

function cleanCharacters(value: unknown): CharacterInput[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 8).map((item: any, index) => ({
    id: text(item?.id, 100) || `character-${index + 1}`,
    name: text(item?.name, 80) || `Personaje ${index + 1}`,
    description: text(item?.description, 800),
    visualDescription: text(item?.visualDescription, 1600),
    fixedTraits: text(item?.fixedTraits, 900),
    outfit: text(item?.outfit, 900),
    accessories: text(item?.accessories, 600),
    prohibitedChanges: text(item?.prohibitedChanges, 900),
    role: roleValue(item?.role),
    appearsAlways: item?.appearsAlways === true,
    referenceImageUrl: text(item?.referenceImageUrl, 2000) || undefined,
  }))
}

function cleanPanel(value: unknown): PanelInput {
  const item = value as any
  return {
    id: text(item?.id, 100) || "panel",
    title: text(item?.title, 180) || "Viñeta",
    scene: text(item?.scene, 2400),
    dialogue: text(item?.dialogue, 1400),
    shot: text(item?.shot, 240),
    imagePrompt: text(item?.imagePrompt, 2200),
    emotion: text(item?.emotion, 400),
    background: text(item?.background, 1200),
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
    `Narrative role: ${character.role}.`,
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
  worldContext,
  audience,
  style,
  styleDirection,
  characters,
}: {
  title: string
  topic: string
  worldContext: string
  audience: string
  style: ComicStyle
  styleDirection: string
  characters: CharacterInput[]
}) {
  return `Create the definitive visual identity bible for one coherent comic.
Comic: ${title}. Premise: ${topic}. Audience: ${audience}.
World context and immutable setting rules: ${worldContext || "Use the premise as the complete setting."}
Art direction: ${STYLE_GUIDES[style]}. ${styleDirection}

Show only the exact named characters listed below. Do not invent a guide, mentor, teacher or any additional named character. Arrange them from left to right in the exact order listed. For each character show a full-body front view and one three-quarter view on a neutral light background. Preserve species, age, proportions, face, hair or fur, clothing colors and accessories.

${characters.map(characterContract).join("\n\n")}

This is a production model sheet, not a scene. No speech bubbles, captions, labels, written words, logos or watermark. Do not merge or redesign characters.`
}

function individualCharacterPrompt({
  title,
  worldContext,
  style,
  styleDirection,
  character,
}: {
  title: string
  worldContext: string
  style: ComicStyle
  styleDirection: string
  character: CharacterInput
}) {
  return `Using the attached cast reference as the identity source, create a focused model sheet for ${character.name} from the comic "${title}".
${characterContract(character, 0)}
World context: ${worldContext || "Use the established comic setting."}
Art direction: ${STYLE_GUIDES[style]}. ${styleDirection}
Show the exact same character in full-body front view, three-quarter view and two facial expressions. Preserve the exact identity, clothing, colors and accessories from the reference. Neutral light background. No other named character, written words, labels, speech bubbles, logo or watermark.`
}

function panelPrompt({
  title,
  topic,
  worldContext,
  audience,
  educationalGoal,
  style,
  styleDirection,
  consistencyMode,
  characters,
  panel,
  panels,
  panelIndex,
  allowExtras,
}: {
  title: string
  topic: string
  worldContext: string
  audience: string
  educationalGoal: string
  style: ComicStyle
  styleDirection: string
  consistencyMode: ConsistencyMode
  characters: CharacterInput[]
  panel: PanelInput
  panels: PanelInput[]
  panelIndex: number
  allowExtras: boolean
}) {
  const required = characters.filter((character) => character.appearsAlways)
  const selected = panel.characterIds.length
    ? characters.filter((character) => panel.characterIds.includes(character.id))
    : []
  const present = [...new Map([...required, ...selected].map((character) => [character.id, character])).values()]
  const continuity = panels
    .map((item, index) => `${index + 1}. ${item.title}: ${item.scene}`)
    .join(" ")
    .slice(0, 7000)
  const strictness = consistencyMode === "strict"
    ? "STRICT CONSISTENCY: copy the exact character identities, outfits, palette, line weight and rendering style from every attached reference. No reinterpretation is allowed."
    : consistencyMode === "high"
      ? "HIGH CONSISTENCY: use the attached identity references as the source of truth for faces, clothing, colors, proportions and art style."
      : "Maintain recognizable characters and the selected art style."
  const extrasRule = allowExtras
    ? "Unnamed background extras may appear only when needed by the scene and world. Keep them visually secondary, do not turn them into named protagonists, and do not copy the main cast identities."
    : "Do not include any background people, creatures or characters beyond the named characters listed for this panel."

  return `Create panel ${panelIndex + 1} of the same coherent comic "${title}".
${strictness}
Art direction: ${STYLE_GUIDES[style]}. ${styleDirection}
Premise: ${topic}.
WORLD CONTEXT — treat every rule below as persistent and immutable across the entire comic:
${worldContext || "Use the premise and storyboard continuity as the complete world context."}
Audience: ${audience}. Objective: ${educationalGoal || "Tell the story clearly and coherently"}.
Complete story continuity: ${continuity}

CURRENT PANEL
Title: ${panel.title}
Scene and action: ${panel.scene}
Location/background: ${panel.background || "Use the location described in the scene"}
Emotional direction: ${panel.emotion || "Natural expression matching the scene"}
Camera framing: ${panel.shot || "medium shot"}
Additional visual instruction: ${panel.imagePrompt || "Follow the scene exactly"}
Named characters allowed and required in this panel: ${present.map((character) => character.name).join(", ") || "No named main character"}
${extrasRule}

IDENTITY CONTRACT FOR PRESENT CHARACTERS
${present.length ? present.map(characterContract).join("\n\n") : "No named identity contract is required for this panel."}

COMPOSITION FOR EDITABLE DIALOGUE
- Generate one finished panel only, never a multi-panel page.
- Keep faces, hands and the main action away from the upper-left and upper-right corners.
- Preserve clear negative space in at least one upper corner for short dialogue.
- When the panel dialogue is long, preserve a calm lower band occupying roughly the bottom 22% without placing faces or essential objects there.
- Keep the focal action in the central safe area and do not crop required characters.

Do not include dialogue, text, captions, labels, letters, readable signs, speech bubbles, logos or watermark. Do not add named characters that are not listed for this panel.`
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

  const title = text(body?.title, 240) || "Historieta"
  const topic = text(body?.topic, 4000)
  const worldContext = text(body?.worldContext, 12000)
  const audience = text(body?.audience, 300) || "Estudiantes"
  const educationalGoal = text(body?.educationalGoal, 1800)
  const style = styleValue(body?.style)
  const styleDirection = text(body?.styleDirection, 1600)
  const consistencyMode = consistencyValue(body?.consistencyMode)
  const characters = cleanCharacters(body?.characters)
  const preferredModel = text(body?.preferredModel, 120)
  const allowExtras = body?.allowExtras !== false

  if (!characters.length) {
    return NextResponse.json({ error: "Agrega al menos un personaje con una descripción visual." }, { status: 400, headers: NO_CACHE })
  }

  try {
    if (action === "cast") {
      const generated = await generateGeminiImage({
        prompt: castPrompt({ title, topic, worldContext, audience, style, styleDirection, characters }),
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
        prompt: individualCharacterPrompt({ title, worldContext, style, styleDirection, character }),
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
    const requiredCharacters = characters.filter((character) => character.appearsAlways)
    const selectedCharacters = panel.characterIds.length
      ? characters.filter((character) => panel.characterIds.includes(character.id))
      : []
    const presentCharacters = [...new Map([...requiredCharacters, ...selectedCharacters].map((character) => [character.id, character])).values()]
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
        worldContext,
        audience,
        educationalGoal,
        style,
        styleDirection,
        consistencyMode,
        characters,
        panel,
        panels,
        panelIndex,
        allowExtras,
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
