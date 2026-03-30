export type AudioPipelineMode = "quick" | "pro"
export type AudioPipelineProvider = "external" | "gemini-fallback"
export type AudioExportFormat = "txt" | "md" | "srt" | "vtt" | "json"

export interface AudioPipelineOptions {
  mode?: AudioPipelineMode
  improveAudio?: boolean
  preciseSubtitles?: boolean
  diarize?: boolean
  detectLanguage?: boolean
  speakerLabels?: string[]
  createSummary?: boolean
}

export interface AudioSpeaker {
  id: string
  estimatedRole?: string
  label?: string
}

export interface AudioWordTimestamp {
  word: string
  start: number
  end: number
  confidence?: number
}

export interface AudioSegment {
  id: string
  start: number
  end: number
  text: string
  speaker?: string
  confidence?: number
  words?: AudioWordTimestamp[]
}

export interface AudioTranscriptPayload {
  transcript: string
  transcriptClean?: string
  language: string
  durationEstimate?: string
  qualityNotes?: string
  provider: AudioPipelineProvider
  mode: AudioPipelineMode
  speakers: AudioSpeaker[]
  segments: AudioSegment[]
  summary?: string
  metadata?: Record<string, unknown>
}

export interface AudioPipelineRequest {
  audioBase64: string
  mimeType: string
  fileName?: string
  fileSizeBytes?: number
  options?: AudioPipelineOptions
}

export interface AudioTranscriptionResponse extends AudioTranscriptPayload {
  success: true
  id: string | null
  modelUsed: string
}
