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
  "caderas sensuales",
  "vagina",
  "vulva",
  "pene",
  "miembro",
  "genitales",
  "paquete",
  "bulto sexual",
  "entrepierna",

  "sexo",
  "acto sexual",
  "penetracion",
  "penetración",
  "masturb",
  "oral",
  "sexo oral",
  "sexo anal",
  "eyacul",
  "climax",
  "orgasmo",
  "correrse",
  "venirse",
  "tocandose",
  "tocándose",
  "acariciandose",
  "acariciándose",
  "beso apasionado",
  "lamer",
  "chupar",
  "frotar",
  "sentada encima",
  "cabalgando",

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
  "prostituta",
  "prostituto",
  "stripper",
  "striptease",
  "bdsm",
  "fetiche",
  "dominacion sexual",
  "dominación sexual",
  "sumision",
  "sumisión",

  "mujer voluptuosa",
  "mujer sexy",
  "mujer erotica",
  "mujer erótica",
  "hombre sexy",
  "hombre musculoso sensual",
  "cuerpo sexualizado",
  "curvas provocativas",
  "cuerpo provocativo",
  "cuerpo erotico",
  "cuerpo erótico",

  "adolescente sexy",
  "niña sexy",
  "niño sexy",
  "menor sexualizado",
  "lolita",
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
  if (!HF_VIDEO_ENDPOINT) {
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

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  if (HF_API_TOKEN) {
    headers.Authorization = `Bearer ${HF_API_TOKEN}`
  }

  const res = await fetch(`${HF_VIDEO_ENDPOINT}/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  })

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    return {
      ok: false,
      provider: "hf-space",
      error: data?.error || `HF Space error (${res.status})`,
      raw: data,
    }
  }

  return {
    ok: Boolean(data?.ok),
    provider: "hf-space",
    videoUrl: data?.video_url || data?.videoUrl || "",
    raw: data,
  }
}

async function callReplicate(_: GenerateVideoInput): Promise<GenerateVideoResult> {
  return {
    ok: false,
    provider: "replicate",
    error: "Replicate aún no implementado en esta fase.",
  }
}

async function callFal(_: GenerateVideoInput): Promise<GenerateVideoResult> {
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
  const cleanedPrompt = sanitizePrompt(input.prompt)

  const moderation = containsBlockedSexualContent(cleanedPrompt)
  if (moderation.blocked) {
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

  const providers = getProviderOrder().filter(isProviderConfigured)

  for (const provider of providers) {
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

      if (result.ok && result.videoUrl) {
        return result
      }
    } catch (error: any) {
      console.error(`[video-agent] Error con provider ${provider}:`, error)
    }
  }

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
  const result = await generateVideoWithFallback(input)

  if (!result.ok) {
    return {
      ok: false,
      status: result.blocked ? "blocked" : "failed",
      provider: result.provider,
      error: result.error,
      moderationReason: result.moderationReason,
      raw: result.raw,
    }
  }

  return {
    ok: true,
    status: "completed",
    provider: result.provider,
    videoUrl: result.videoUrl,
    raw: result.raw,
  }
}
