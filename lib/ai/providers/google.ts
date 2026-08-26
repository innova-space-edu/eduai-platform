import { GoogleGenAI } from "@google/genai"

export type GatewayMessage = {
  role: "system" | "user" | "assistant"
  content: string
}

export type GoogleTextResult = {
  text: string
  provider: "google"
  model: string
}

export type GoogleGroundedResult = GoogleTextResult & {
  usedSearch: boolean
  searchQueries: string[]
  sources: Array<{ title: string; uri: string }>
}

export type GoogleImageResult = {
  dataUrl: string
  mimeType: string
  provider: "google"
  model: string
  interactionId?: string | null
}

function useVertexText(): boolean {
  return process.env.GOOGLE_GENAI_USE_VERTEX === "true"
}

function vertexTextConfig() {
  const project = process.env.GOOGLE_CLOUD_PROJECT?.trim() || ""
  const location = process.env.GOOGLE_CLOUD_LOCATION?.trim() || "us-central1"
  return { project, location }
}

function apiKey(kind: "text" | "image" | "video" = "text"): string {
  const key =
    (kind === "text" ? process.env.GEMINI_API_KEY_TEXT : undefined) ||
    (kind === "image" ? process.env.GEMINI_API_KEY_IMAGE : undefined) ||
    (kind === "video" ? process.env.GEMINI_API_KEY_VIDEO : undefined) ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY

  if (!key) throw new Error(`No hay una API key de Google configurada para ${kind}`)
  return key
}

function client(kind: "text" | "image" | "video" = "text") {
  if (kind === "text" && useVertexText()) {
    const { project, location } = vertexTextConfig()
    if (!project) {
      throw new Error("GOOGLE_GENAI_USE_VERTEX=true requiere GOOGLE_CLOUD_PROJECT")
    }

    return new GoogleGenAI({
      vertexai: true,
      project,
      location,
    })
  }

  return new GoogleGenAI({ apiKey: apiKey(kind) })
}

export function googleModel(kind: "text" | "lite" | "image" | "video"): string {
  switch (kind) {
    case "lite":
      return process.env.GOOGLE_TEXT_MODEL_LITE || process.env.GEMINI_TEXT_MODEL_LITE || "gemini-3.5-flash-lite"
    case "image":
      return process.env.GOOGLE_IMAGE_MODEL_PRIMARY || process.env.GEMINI_IMAGE_MODEL_PRIMARY || "gemini-3.1-flash-image"
    case "video":
      return process.env.GOOGLE_VIDEO_MODEL_PRIMARY || "veo-3.1-generate-preview"
    case "text":
    default:
      return process.env.GOOGLE_TEXT_MODEL_PRIMARY || process.env.GEMINI_TEXT_MODEL_PRIMARY || "gemini-3.6-flash"
  }
}

function toContents(messages: GatewayMessage[]) {
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }))
}

function parseStructuredJson<T>(raw: string): T {
  const text = raw.trim()
  const attempts = new Set<string>()
  if (text) attempts.add(text)

  const unfenced = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()
  if (unfenced) attempts.add(unfenced)

  const firstObject = unfenced.indexOf("{")
  const lastObject = unfenced.lastIndexOf("}")
  if (firstObject >= 0 && lastObject > firstObject) attempts.add(unfenced.slice(firstObject, lastObject + 1))

  const firstArray = unfenced.indexOf("[")
  const lastArray = unfenced.lastIndexOf("]")
  if (firstArray >= 0 && lastArray > firstArray) attempts.add(unfenced.slice(firstArray, lastArray + 1))

  let lastError: unknown = null
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate) as T
    } catch (error) {
      lastError = error
    }
  }

  const preview = text.replace(/\s+/g, " ").slice(0, 180)
  const suffix = lastError instanceof Error ? ` (${lastError.message})` : ""
  throw new Error(`Google devolvió una salida estructurada no válida${suffix}. Inicio recibido: ${preview || "vacío"}`)
}

export async function generateGoogleText(input: {
  messages: GatewayMessage[]
  maxOutputTokens?: number
  lite?: boolean
  model?: string
}): Promise<GoogleTextResult> {
  const ai = client("text")
  const model = input.model || googleModel(input.lite ? "lite" : "text")
  const systemInstruction = input.messages.find((message) => message.role === "system")?.content

  const response = await ai.models.generateContent({
    model,
    contents: toContents(input.messages),
    config: {
      ...(systemInstruction ? { systemInstruction } : {}),
      maxOutputTokens: input.maxOutputTokens ?? 4000,
    },
  })

  return {
    text: response.text ?? "",
    provider: "google",
    model,
  }
}

export async function generateGoogleGroundedText(input: {
  messages: GatewayMessage[]
  maxOutputTokens?: number
  temperature?: number
  model?: string
}): Promise<GoogleGroundedResult> {
  const ai = client("text")
  const model = input.model || googleModel("text")
  const systemInstruction = input.messages.find((message) => message.role === "system")?.content

  const response = await ai.models.generateContent({
    model,
    contents: toContents(input.messages),
    config: {
      ...(systemInstruction ? { systemInstruction } : {}),
      maxOutputTokens: input.maxOutputTokens ?? 4096,
      temperature: input.temperature ?? 0.4,
      tools: [{ googleSearch: {} }],
    },
  } as any)

  const candidate = (response as any)?.candidates?.[0]
  const grounding = candidate?.groundingMetadata || {}
  const searchQueries = Array.isArray(grounding.webSearchQueries)
    ? grounding.webSearchQueries.map((value: unknown) => String(value)).filter(Boolean)
    : []
  const sources = Array.isArray(grounding.groundingChunks)
    ? grounding.groundingChunks
        .map((chunk: any) => chunk?.web)
        .filter((web: any) => web?.uri)
        .map((web: any) => ({ title: String(web.title || web.uri), uri: String(web.uri) }))
    : []

  return {
    text: response.text ?? "",
    provider: "google",
    model,
    usedSearch: searchQueries.length > 0 || sources.length > 0,
    searchQueries,
    sources,
  }
}

export async function streamGoogleText(input: {
  messages: GatewayMessage[]
  maxOutputTokens?: number
  lite?: boolean
  model?: string
}): Promise<ReadableStream<Uint8Array>> {
  const ai = client("text")
  const model = input.model || googleModel(input.lite ? "lite" : "text")
  const systemInstruction = input.messages.find((message) => message.role === "system")?.content
  const stream = await ai.models.generateContentStream({
    model,
    contents: toContents(input.messages),
    config: {
      ...(systemInstruction ? { systemInstruction } : {}),
      maxOutputTokens: input.maxOutputTokens ?? 4000,
    },
  })

  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.text) controller.enqueue(encoder.encode(chunk.text))
        }
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
  })
}

export async function generateGoogleStructured<T = Record<string, unknown>>(input: {
  messages: GatewayMessage[]
  schema: Record<string, unknown>
  maxOutputTokens?: number
  lite?: boolean
  model?: string
}): Promise<GoogleTextResult & { data: T }> {
  const ai = client("text")
  const model = input.model || googleModel(input.lite ? "lite" : "text")
  const systemInstruction = input.messages.find((message) => message.role === "system")?.content

  const response = await ai.models.generateContent({
    model,
    contents: toContents(input.messages),
    config: {
      ...(systemInstruction ? { systemInstruction } : {}),
      maxOutputTokens: input.maxOutputTokens ?? 4000,
      responseMimeType: "application/json",
      responseJsonSchema: input.schema,
    },
  })

  const text = (response.text ?? "").trim()
  return {
    text,
    data: parseStructuredJson<T>(text),
    provider: "google",
    model,
  }
}

export async function generateGoogleImage(input: {
  prompt: string
  aspectRatio?: string
  imageSize?: "0.5K" | "1K" | "2K" | "4K"
  previousInteractionId?: string | null
  model?: string
}): Promise<GoogleImageResult> {
  const ai = client("image")
  const model = input.model || googleModel("image")

  const interaction = await ai.interactions.create({
    model,
    input: input.prompt,
    ...(input.previousInteractionId
      ? { previous_interaction_id: input.previousInteractionId }
      : {}),
    response_format: {
      type: "image",
      mime_type: "image/png",
      aspect_ratio: input.aspectRatio || "1:1",
      image_size: input.imageSize || "1K",
    },
  } as any)

  const image = (interaction as any).output_image
  if (!image?.data) throw new Error("Google no devolvió datos de imagen")

  const mimeType = image.mime_type || "image/png"
  return {
    dataUrl: `data:${mimeType};base64,${image.data}`,
    mimeType,
    provider: "google",
    model,
    interactionId: (interaction as any).id || null,
  }
}

export function hasGoogleAI(kind: "text" | "image" | "video" = "text"): boolean {
  if (kind === "text" && useVertexText()) {
    return Boolean(vertexTextConfig().project)
  }

  try {
    return Boolean(apiKey(kind))
  } catch {
    return false
  }
}
