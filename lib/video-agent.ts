import crypto from "crypto"
import {
  getProviderOrder,
  HF_API_TOKEN,
  HF_VIDEO_ENDPOINT,
  isProviderConfigured,
  normalizeDuration,
  normalizeMode,
  type VideoProvider,
} from "@/lib/video-config"

export type GenerateVideoInput = {
  prompt: string
  style?: string | null
  duration?: number | null
  withAudio?: boolean | null
  mode?: "text_to_video" | "image_to_video" | string | null
  imageUrl?: string | null
}

export type GenerateVideoResult = {
  ok: boolean
  provider?: VideoProvider
  videoUrl?: string
  error?: string
  blocked?: boolean
  moderationReason?: string
  raw?: any
}

/**
 * ============================================
 * MODERACIÓN
 * ============================================
 */

const SEXUAL_BLOCKLIST = [
  "desnudo",
  "desnuda",
  "desnudos",
  "desnudas",
  "sin ropa",
  "sin ropa interior",
  "ropa interior transparente",
  "topless",
  "en pelotas",
  "completamente desnudo",
  "completamente desnuda",
  "pechos",
  "senos",
  "tetas",
  "tetona",
  "pezones",
  "nalgas",
  "trasero",
  "culo",
  "vagina",
  "vulva",
  "pene",
  "miembro",
  "genitales",
  "sexo",
  "acto sexual",
  "penetracion",
  "penetración",
  "masturb",
  "oral",
  "sexo oral",
  "sexo anal",
  "orgasmo",
  "tocandose",
  "tocándose",
  "acariciandose",
  "acariciándose",
  "sensual",
  "erotico",
  "erótico",
  "sexy",
  "seductora",
  "seductor",
  "provocativa",
  "provocativo",
  "porn",
  "porno",
  "pornografia",
  "pornografía",
  "nsfw",
  "onlyfans",
  "contenido adulto",
  "escort",
  "stripper",
  "striptease",
  "bdsm",
  "fetiche",
  "adolescente sexy",
  "niña sexy",
  "niño sexy",
  "teen sexy",
  "schoolgirl sexy",
  "schoolboy sexy",
  "incesto",
  "zoofilia",
  "necrofilia",
  "violacion",
  "violación",
  "abuso sexual",
  "sexo forzado",
  "violencia sexual",
]

const HIGH_RISK_REGEX = [
  /\b(nsfw|porn|porno|onlyfans)\b/i,
  /\b(sexo|sexual|er[oó]tico|sensual|provocativ[oa])\b/i,
  /\b(desnud[oa]s?|topless|sin ropa)\b/i,
  /\b(vagina|vulva|pene|genital(?:es)?)\b/i,
  /\b(pechos|senos|tetas|pezones|nalgas|culo)\b/i,
  /\b(masturb\w*|orgasm\w*|eyacul\w*|climax)\b/i,
  /\b(escort|stripper|striptease|prostitu\w*)\b/i,
  /\b(violaci[oó]n|abuso sexual|sexo forzado)\b/i,
  /\b(teen sexy|schoolgirl sexy|schoolboy sexy|lolita)\b/i,
]

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function containsBlockedSexualContent(input: string): { blocked: boolean; reason?: string } {
  const text = normalizeText(input)

  for (const term of SEXUAL_BLOCKLIST) {
    if (text.includes(normalizeText(term))) {
      return {
        blocked: true,
        reason: `Prompt bloqueado por contenido sexual explícito o sugerente: "${term}"`,
      }
    }
  }

  for (const regex of HIGH_RISK_REGEX) {
    if (regex.test(text)) {
      return {
        blocked: true,
        reason: "Prompt bloqueado por patrón sexual explícito o sensible.",
      }
    }
  }

  return { blocked: false }
}

function sanitizePrompt(input: string): string {
  return input.replace(/\s+/g, " ").trim()
}

/**
 * ============================================
 * PROVEEDORES
 * ============================================
 */

async function callHFSpace(input: GenerateVideoInput): Promise<GenerateVideoResult> {
  console.log("[VIDEO][HF] Iniciando callHFSpace")
  console.log("[VIDEO][HF] Endpoint:", HF_VIDEO_ENDPOINT)
  console.log("[VIDEO][HF] Token configurado:", Boolean(HF_API_TOKEN))

  if (!HF_VIDEO_ENDPOINT) {
    console.error("[VIDEO][HF] HF_VIDEO_ENDPOINT no configurado")
    return { ok: false, provider: "hf-space", error: "HF_VIDEO_ENDPOINT no configurado" }
  }

  const payload = {
    prompt: input.prompt,
    mode: normalizeMode(input.mode),
    image_url: input.imageUrl || null,
    duration: normalizeDuration(input.duration),
    style: input.style || "",
    with_audio: Boolean(input.withAudio),
  }

  console.log("[VIDEO][HF] Payload:", payload)

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  if (HF_API_TOKEN) {
    headers.Authorization = `Bearer ${HF_API_TOKEN}`
  }

  try {
    const url = `${HF_VIDEO_ENDPOINT}/generate`
    console.log("[VIDEO][HF] URL final:", url)

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    })

    const rawText = await res.text()
    console.log("[VIDEO][HF] Status:", res.status)
    console.log("[VIDEO][HF] Respuesta raw:", rawText)

    let data: any = null
    try {
      data = JSON.parse(rawText)
    } catch {
      data = { raw: rawText }
    }

    if (!res.ok) {
      console.error("[VIDEO][HF] Error HTTP:", res.status, data)
      return {
        ok: false,
        provider: "hf-space",
        error: data?.error || `HF Space error (${res.status})`,
        raw: data,
      }
    }

    console.log("[VIDEO][HF] OK:", data)

    return {
      ok: Boolean(data?.ok),
      provider: "hf-space",
      videoUrl: data?.video_url || data?.videoUrl || "",
      raw: data,
    }
  } catch (error: any) {
    console.error("[VIDEO][HF] Excepción:", error)
    return {
      ok: false,
      provider: "hf-space",
      error: error?.message || "Error inesperado llamando HF Space",
    }
  }
}

async function callReplicate(_: GenerateVideoInput): Promise<GenerateVideoResult> {
  console.log("[VIDEO][REPLICATE] No implementado aún")
  return {
    ok: false,
    provider: "replicate",
    error: "Replicate aún no implementado en esta fase.",
  }
}

async function callFal(_: GenerateVideoInput): Promise<GenerateVideoResult> {
  console.log("[VIDEO][FAL] No implementado aún")
  return {
    ok: false,
    provider: "fal",
    error: "fal aún no implementado en esta fase.",
  }
}

/**
 * ============================================
 * ORQUESTADOR
 * ============================================
 */

export async function generateVideoWithFallback(
  input: GenerateVideoInput
): Promise<GenerateVideoResult> {
  console.log("[VIDEO] generateVideoWithFallback()")
  console.log("[VIDEO] Input original:", input)

  const cleanedPrompt = sanitizePrompt(input.prompt)
  console.log("[VIDEO] Prompt limpio:", cleanedPrompt)

  const moderation = containsBlockedSexualContent(cleanedPrompt)
  if (moderation.blocked) {
    console.warn("[VIDEO] Prompt bloqueado:", moderation.reason)
    return {
      ok: false,
      blocked: true,
      moderationReason: moderation.reason,
      error: moderation.reason,
    }
  }

  const normalizedInput: GenerateVideoInput = {
    ...input,
    prompt: cleanedPrompt,
    duration: normalizeDuration(input.duration),
    mode: normalizeMode(input.mode),
  }

  console.log("[VIDEO] Input normalizado:", normalizedInput)

  const providerOrder = getProviderOrder()
  console.log("[VIDEO] Provider order (raw):", providerOrder)

  const providers = providerOrder.filter(isProviderConfigured)
  console.log("[VIDEO] Providers configurados:", providers)

  if (!providers.length) {
    console.error("[VIDEO] No hay proveedores configurados válidos.")
  }

  for (const provider of providers) {
    console.log(`[VIDEO] Intentando provider: ${provider}`)

    try {
      let result: GenerateVideoResult

      switch (provider) {
        case "hf-space":
          result = await callHFSpace(normalizedInput)
          break
        case "replicate":
          result = await callReplicate(normalizedInput)
          break
        case "fal":
        case "ltx":
        case "cogvideox":
        case "hunyuan":
          result = await callFal(normalizedInput)
          break
        default:
          result = {
            ok: false,
            provider,
            error: `Proveedor no soportado: ${provider}`,
          }
      }

      console.log(`[VIDEO] Resultado provider ${provider}:`, result)

      if (result.ok && result.videoUrl) {
        console.log(`[VIDEO] Éxito con provider ${provider}`)
        return result
      }
    } catch (error: any) {
      console.error(`[VIDEO] Error con provider ${provider}:`, error)
    }
  }

  console.error("[VIDEO] Todos los proveedores fallaron o no están disponibles.")
  return {
    ok: false,
    error: "Todos los proveedores fallaron o no están disponibles.",
  }
}

/**
 * ============================================
 * HASH / CACHE
 * ============================================
 */

export function buildVideoJobHash(input: GenerateVideoInput): string {
  const base = JSON.stringify({
    prompt: sanitizePrompt(input.prompt),
    style: input.style || "",
    duration: normalizeDuration(input.duration),
    withAudio: Boolean(input.withAudio),
    mode: normalizeMode(input.mode),
    imageUrl: input.imageUrl || "",
  })

  return crypto.createHash("sha256").update(base).digest("hex")
}

/**
 * ============================================
 * PROCESS JOB (COMPAT CON TU COLA)
 * ============================================
 */

export async function processVideoJob(input: GenerateVideoInput): Promise<{
  ok: boolean
  status: "completed" | "failed" | "blocked"
  provider?: VideoProvider
  videoUrl?: string
  error?: string
  moderationReason?: string
  raw?: any
}> {
  console.log("[VIDEO][PROCESS] Procesando job:", input)

  const result = await generateVideoWithFallback(input)

  if (!result.ok) {
    console.warn("[VIDEO][PROCESS] Job fallido:", result)
    return {
      ok: false,
      status: result.blocked ? "blocked" : "failed",
      provider: result.provider,
      error: result.error,
      moderationReason: result.moderationReason,
      raw: result.raw,
    }
  }

  console.log("[VIDEO][PROCESS] Job completado:", result)

  return {
    ok: true,
    status: "completed",
    provider: result.provider,
    videoUrl: result.videoUrl,
    raw: result.raw,
  }
}
