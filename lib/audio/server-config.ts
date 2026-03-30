import { AudioPipelineMode } from "./types"

export function getAudioPipelineConfig() {
  return {
    providerUrl: process.env.AUDIO_PIPELINE_URL?.trim() || "",
    providerToken: process.env.AUDIO_PIPELINE_TOKEN?.trim() || "",
    providerName: process.env.AUDIO_PIPELINE_PROVIDER?.trim() || "gemini-fallback",
    defaultMode: (process.env.AUDIO_DEFAULT_MODE?.trim() as AudioPipelineMode) || "quick",
  }
}

export function hasExternalAudioPipeline() {
  const { providerUrl } = getAudioPipelineConfig()
  return !!providerUrl
}
