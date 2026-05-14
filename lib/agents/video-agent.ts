// lib/agents/video-agent.ts
// ─────────────────────────────────────────────────────────────────────────────
// VideoAgent — generación de videos educativos IA.
// Moderniza el video-agent.ts existente sin romperlo.
// Agrega: contexto educativo, templates por asignatura, prompt optimizer.
// Proveedores: HuggingFace Spaces (Wan2 / LTX), con fallback entre ellos.
// ─────────────────────────────────────────────────────────────────────────────

import { callAIv5 } from "@/lib/ai-router-v5"
import type { Message } from "@/lib/ai-router-v5"

// ── Tipos nuevos ──────────────────────────────────────────────────────────────

export type VideoSubject =
  | "biologia"   | "fisica"    | "quimica"
  | "historia"   | "geografia" | "matematica"
  | "lenguaje"   | "ciencias"  | "general"

export type VideoStyle =
  | "diagrama_animado"   // diagramas científicos animados
  | "ilustracion"        // ilustración suave tipo Khan Academy
  | "documental"         // estilo documental realista
  | "infografia"         // infografía en movimiento
  | "microscopio"        // biología/química: células, moléculas
  | "linea_tiempo"       // historia: eventos cronológicos
  | "laboratorio"        // química/física: experimentos

export interface EduVideoRequest {
  concept:   string         // "La división celular por mitosis"
  subject?:  VideoSubject
  style?:    VideoStyle
  duration?: number         // segundos (2-10)
  level?:    string         // "2° Medio"
  language?: "es" | "en"
}

export interface EduVideoResult {
  success:      boolean
  videoUrl?:    string
  thumbnailUrl?: string
  prompt?:      string      // prompt en inglés generado
  provider?:    string
  error?:       string
}

// ── Templates de estilo por asignatura ───────────────────────────────────────

const STYLE_TEMPLATES: Record<VideoSubject, VideoStyle> = {
  biologia:    "microscopio",
  quimica:     "laboratorio",
  fisica:      "diagrama_animado",
  matematica:  "diagrama_animado",
  historia:    "linea_tiempo",
  geografia:   "documental",
  lenguaje:    "ilustracion",
  ciencias:    "diagrama_animado",
  general:     "ilustracion",
}

const STYLE_DESCRIPTORS: Record<VideoStyle, string> = {
  diagrama_animado: "animated scientific diagram, clean white background, colorful arrows and labels, educational style",
  ilustracion:      "soft educational illustration, pastel colors, friendly and clear, Khan Academy style",
  documental:       "documentary style, realistic footage, natural lighting, educational tone",
  infografia:       "animated infographic, bold colors, modern flat design, data visualization",
  microscopio:      "microscope view, biological cells and structures, scientific visualization, vivid colors",
  linea_tiempo:     "animated timeline, historical events, clean layout, chronological flow, illustrated",
  laboratorio:      "chemistry laboratory, beakers and reactions, safe educational depiction, animated",
}

// ── Generador de prompt educativo en inglés ───────────────────────────────────

async function buildEducationalPrompt(req: EduVideoRequest): Promise<string> {
  const subject = req.subject ?? "general"
  const style   = req.style   ?? STYLE_TEMPLATES[subject]
  const styleDesc = STYLE_DESCRIPTORS[style]

  const messages: Message[] = [{
    role: "user",
    content: `Create a detailed English video generation prompt for an educational video about: "${req.concept}"
${req.subject  ? `Subject: ${req.subject}` : ""}
${req.level    ? `Level: ${req.level}`     : ""}
Style: ${style} — ${styleDesc}
Duration: ${req.duration ?? 6} seconds

Requirements:
- Educational, appropriate for students
- No people, no text overlays
- Clear visual representation of the concept
- ${styleDesc}

Write ONLY the prompt in English, no explanations, max 150 words.`,
  }]

  try {
    const res = await callAIv5(messages, { task: "fast", maxTokens: 200 })
    return res.text.trim()
  } catch {
    // Fallback: prompt básico en inglés
    const fallback = `Educational animation about "${req.concept}", ${styleDesc}, clean and professional, suitable for students, no text overlays, no people, 4K quality`
    return fallback
  }
}

// ── Llamada a HuggingFace Space ───────────────────────────────────────────────

async function callHFSpace(
  prompt:    string,
  duration:  number,
  imageUrl?: string
): Promise<EduVideoResult> {
  const spaceUrl   = process.env.HF_SPACE_VIDEO_API_URL
  const spaceToken = process.env.HF_SPACE_VIDEO_API_TOKEN

  if (!spaceUrl) {
    return {
      success: false,
      error:   "HF_SPACE_VIDEO_API_URL no configurada. Agrega la URL de tu Space de Wan2/LTX en Vercel.",
    }
  }

  try {
    const body: Record<string, unknown> = {
      prompt,
      duration,
      style:     "cinematic",
      withAudio: false,
    }
    if (imageUrl) body.imageUrl = imageUrl

    const res = await fetch(spaceUrl, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        ...(spaceToken ? { "Authorization": `Bearer ${spaceToken}` } : {}),
      },
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(90_000),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      return {
        success: false,
        error:   `HF Space error ${res.status}: ${errText.slice(0, 120)}`,
      }
    }

    const data = await res.json()

    if (data.ok && data.videoUrl) {
      return {
        success:      true,
        videoUrl:     data.videoUrl,
        thumbnailUrl: data.thumbnailUrl,
        provider:     data.provider ?? "HuggingFace",
      }
    }

    return {
      success: false,
      error:   data.error ?? "El Space no devolvió videoUrl.",
    }
  } catch (err) {
    return {
      success: false,
      error:   err instanceof Error ? err.message : "Error de red al llamar HF Space.",
    }
  }
}

// ── API pública del agente ────────────────────────────────────────────────────

/**
 * generateEduVideo — genera un video educativo dado un concepto.
 * 1. Optimiza el prompt con IA (Groq fast)
 * 2. Llama al HF Space configurado
 */
export async function generateEduVideo(
  req: EduVideoRequest
): Promise<EduVideoResult> {
  const duration = Math.min(10, Math.max(2, req.duration ?? 6))

  // 1. Generar prompt optimizado
  const prompt = await buildEducationalPrompt(req)

  // 2. Llamar al Space
  const result = await callHFSpace(prompt, duration)

  return { ...result, prompt }
}

/**
 * generateConceptAnimation — genera animación de un concepto específico.
 * Shortcut con detección automática de asignatura.
 */
export async function generateConceptAnimation(
  concept: string,
  subject?: string
): Promise<EduVideoResult> {
  const subjectKey = (subject ?? "").toLowerCase()
  const detectedSubject: VideoSubject =
    subjectKey.includes("biolog")   ? "biologia"   :
    subjectKey.includes("físic")    ? "fisica"      :
    subjectKey.includes("quím")     ? "quimica"     :
    subjectKey.includes("histor")   ? "historia"    :
    subjectKey.includes("matemát")  ? "matematica"  :
    subjectKey.includes("lengua")   ? "lenguaje"    :
    subjectKey.includes("cienc")    ? "ciencias"    :
    "general"

  return generateEduVideo({
    concept,
    subject:  detectedSubject,
    duration: 6,
  })
}

/**
 * getVideoTemplates — devuelve los templates disponibles por asignatura.
 * Para mostrar en la UI del Video Studio.
 */
export function getVideoTemplates(): {
  subject:   VideoSubject
  style:     VideoStyle
  label:     string
  examples:  string[]
}[] {
  return [
    {
      subject:  "biologia",
      style:    "microscopio",
      label:    "Biología — Vista microscópica",
      examples: ["División celular", "Estructura del ADN", "Fotosíntesis"],
    },
    {
      subject:  "quimica",
      style:    "laboratorio",
      label:    "Química — Laboratorio",
      examples: ["Reacción ácido-base", "Enlace covalente", "Destilación"],
    },
    {
      subject:  "fisica",
      style:    "diagrama_animado",
      label:    "Física — Diagramas animados",
      examples: ["Movimiento parabólico", "Campo eléctrico", "Ondas sonoras"],
    },
    {
      subject:  "historia",
      style:    "linea_tiempo",
      label:    "Historia — Línea de tiempo",
      examples: ["Independencia de Chile", "Segunda Guerra Mundial", "Revolución Francesa"],
    },
    {
      subject:  "matematica",
      style:    "diagrama_animado",
      label:    "Matemática — Diagramas",
      examples: ["Función cuadrática", "Teorema de Pitágoras", "Fracciones"],
    },
    {
      subject:  "general",
      style:    "ilustracion",
      label:    "General — Ilustración educativa",
      examples: ["Ciclo del agua", "Ecosistema", "Sistema solar"],
    },
  ]
}
