export type StudioVideoMode = "text_to_video" | "image_to_video"
export type StudioResolution = "720p" | "1080p" | "4k"
export type StudioAspectRatio = "16:9" | "9:16"

export type VideoStudioModel = {
  key: string
  name: string
  provider: "auto" | "fal"
  tier: "free" | "economy" | "balanced" | "premium"
  description: string
  badges: string[]
  modes: StudioVideoMode[]
  durations: number[]
  resolutions: StudioResolution[]
  audio: "optional" | "included" | "auto"
  endpointText?: string
  endpointImage?: string
  recommended?: boolean
}

export const VIDEO_STUDIO_MODELS: VideoStudioModel[] = [
  {
    key: "free-auto",
    name: "EduAI Auto",
    provider: "auto",
    tier: "free",
    description: "Reutiliza primero y luego usa el router gratuito de EduAI antes de recurrir a Veo.",
    badges: ["Gratis", "Ahorro primero", "Reutilización"],
    modes: ["text_to_video", "image_to_video"],
    durations: [2, 4, 6, 8, 10],
    resolutions: ["720p"],
    audio: "optional",
    recommended: true,
  },
  {
    key: "kling-3-standard",
    name: "Kling 3 Standard",
    provider: "fal",
    tier: "economy",
    description: "Buena relación costo/calidad, movimiento cinematográfico y audio nativo opcional.",
    badges: ["Cinemático", "Audio", "3–15 s"],
    modes: ["text_to_video", "image_to_video"],
    durations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    resolutions: ["720p"],
    audio: "optional",
    endpointText: "fal-ai/kling-video/v3/standard/text-to-video",
    endpointImage: "fal-ai/kling-video/v3/standard/image-to-video",
  },
  {
    key: "wan-2.7",
    name: "Wan 2.7",
    provider: "fal",
    tier: "balanced",
    description: "Movimiento fluido, 720p/1080p y música de fondo generada automáticamente cuando no se aporta audio.",
    badges: ["720p/1080p", "2–15 s", "Multi-shot"],
    modes: ["text_to_video", "image_to_video"],
    durations: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    resolutions: ["720p", "1080p"],
    audio: "auto",
    endpointText: "fal-ai/wan/v2.7/text-to-video",
    endpointImage: "fal-ai/wan/v2.7/image-to-video",
  },
  {
    key: "ltx-2.3-fast",
    name: "LTX 2.3 Fast",
    provider: "fal",
    tier: "balanced",
    description: "Generación rápida desde texto o imagen, audio opcional y salida de alta resolución.",
    badges: ["Rápido", "1080p/4K", "Audio"],
    modes: ["text_to_video", "image_to_video"],
    durations: [6, 8, 10, 12, 14, 16, 18, 20],
    resolutions: ["1080p", "4k"],
    audio: "optional",
    endpointText: "fal-ai/ltx-2.3/text-to-video/fast",
    endpointImage: "fal-ai/ltx-2.3/image-to-video/fast",
  },
  {
    key: "veo-3.1-fast",
    name: "Veo 3.1 Fast",
    provider: "fal",
    tier: "premium",
    description: "Modelo premium de Google servido por fal.ai, con audio opcional y hasta 4K en texto a video.",
    badges: ["Google", "Audio", "Hasta 4K"],
    modes: ["text_to_video", "image_to_video"],
    durations: [4, 6, 8],
    resolutions: ["720p", "1080p", "4k"],
    audio: "optional",
    endpointText: "fal-ai/veo3.1/fast",
    endpointImage: "fal-ai/veo3.1/fast/image-to-video",
  },
  {
    key: "seedance-2.0-fast",
    name: "Seedance 2.0 Fast",
    provider: "fal",
    tier: "premium",
    description: "Video cinematográfico con audio sincronizado, física y control de cámara; optimizado para producción.",
    badges: ["ByteDance", "Audio nativo", "720p"],
    modes: ["text_to_video", "image_to_video"],
    durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    resolutions: ["720p"],
    audio: "included",
    endpointText: "bytedance/seedance-2.0/fast/text-to-video",
    endpointImage: "bytedance/seedance-2.0/fast/image-to-video",
  },
]

export function getVideoStudioModel(key: string | null | undefined) {
  return VIDEO_STUDIO_MODELS.find((model) => model.key === key) || VIDEO_STUDIO_MODELS[0]
}

export function endpointForMode(model: VideoStudioModel, mode: StudioVideoMode) {
  return mode === "image_to_video" ? model.endpointImage : model.endpointText
}

export function validateVideoModelSelection(input: {
  model: VideoStudioModel
  mode: StudioVideoMode
  duration: number
  resolution: StudioResolution
}) {
  if (!input.model.modes.includes(input.mode)) return "El modelo no admite este modo de generación."
  if (!input.model.durations.includes(input.duration)) return "La duración no está disponible para el modelo seleccionado."
  if (!input.model.resolutions.includes(input.resolution)) return "La resolución no está disponible para el modelo seleccionado."
  if (input.model.provider === "fal" && !endpointForMode(input.model, input.mode)) return "El endpoint del modelo no está disponible."
  return null
}

// Conservative fallback estimates from the public fal.ai model pages. These are
// estimates only: the UI explicitly labels them as estimated and the server owns
// the reservation amount. They can be replaced by live provider pricing later.
export function estimateProviderUsd(input: {
  modelKey: string
  duration: number
  resolution: StudioResolution
  withAudio: boolean
}) {
  const seconds = Math.max(1, input.duration)
  switch (input.modelKey) {
    case "kling-3-standard":
      return seconds * (input.withAudio ? 0.126 : 0.084)
    case "wan-2.7":
      return seconds * (input.resolution === "1080p" ? 0.15 : 0.10)
    case "veo-3.1-fast":
      if (input.resolution === "4k") return seconds * (input.withAudio ? 0.35 : 0.30)
      return seconds * (input.withAudio ? 0.15 : 0.10)
    case "seedance-2.0-fast":
      return seconds * 0.2419
    case "ltx-2.3-fast":
      // Deliberately conservative until the live account pricing endpoint is used.
      return seconds * (input.resolution === "4k" ? 0.20 : 0.08)
    default:
      return 0
  }
}

export function buildFalVideoInput(input: {
  modelKey: string
  prompt: string
  style?: string | null
  mode: StudioVideoMode
  duration: number
  resolution: StudioResolution
  aspectRatio: StudioAspectRatio
  withAudio: boolean
  imageUrl?: string | null
  userId?: string | null
}) {
  const prompt = input.style?.trim() ? `${input.prompt}. Estilo visual: ${input.style.trim()}.` : input.prompt

  switch (input.modelKey) {
    case "kling-3-standard":
      return {
        prompt,
        duration: String(input.duration),
        generate_audio: input.withAudio,
        ...(input.mode === "text_to_video"
          ? { aspect_ratio: input.aspectRatio }
          : { start_image_url: input.imageUrl }),
      }
    case "wan-2.7":
      return {
        prompt,
        aspect_ratio: input.aspectRatio,
        resolution: input.resolution === "1080p" ? "1080p" : "720p",
        duration: input.duration,
        enable_prompt_expansion: true,
        enable_safety_checker: true,
        ...(input.mode === "image_to_video" ? { image_url: input.imageUrl } : {}),
      }
    case "ltx-2.3-fast":
      return {
        prompt,
        duration: input.duration,
        resolution: input.resolution === "4k" ? "2160p" : "1080p",
        aspect_ratio: input.aspectRatio,
        fps: 25,
        generate_audio: input.withAudio,
        ...(input.mode === "image_to_video" ? { image_url: input.imageUrl } : {}),
      }
    case "veo-3.1-fast":
      return {
        prompt,
        aspect_ratio: input.aspectRatio,
        duration: `${input.duration}s`,
        resolution: input.resolution,
        generate_audio: input.withAudio,
        auto_fix: true,
        safety_tolerance: "4",
        ...(input.mode === "image_to_video" ? { image_url: input.imageUrl } : {}),
      }
    case "seedance-2.0-fast":
      return {
        prompt,
        resolution: "720p",
        duration: String(input.duration),
        aspect_ratio: input.aspectRatio,
        generate_audio: input.withAudio,
        bitrate_mode: "standard",
        ...(input.userId ? { end_user_id: input.userId } : {}),
        ...(input.mode === "image_to_video" ? { image_url: input.imageUrl } : {}),
      }
    default:
      throw new Error("Modelo premium no compatible.")
  }
}
