import type { WhisperTranscriptionResult } from "@/lib/ai/local/whisper-transcribe"
import type { WhisperLongFormResult } from "@/lib/ai/local/whisper-longform"

export type WhisperExportFormat = "txt" | "srt" | "vtt"
export type WhisperExportResult = WhisperTranscriptionResult | WhisperLongFormResult

type Cue = { start: number; end: number; text: string }

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function cuesFor(result: WhisperExportResult, fallbackDurationSeconds: number): Cue[] {
  if ("chunks" in result) {
    return result.chunks
      .map(chunk => ({ start: chunk.startSeconds, end: chunk.endSeconds, text: cleanText(chunk.result.text) }))
      .filter(cue => cue.text)
  }
  const text = cleanText(result.text)
  return text ? [{ start: 0, end: Math.max(0.1, fallbackDurationSeconds), text }] : []
}

function clock(seconds: number, separator: "," | ".") {
  const safe = Math.max(0, seconds)
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const wholeSeconds = Math.floor(safe % 60)
  const milliseconds = Math.round((safe - Math.floor(safe)) * 1000)
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(2, "0")}${separator}${String(milliseconds).padStart(3, "0")}`
}

export function renderWhisperExport(result: WhisperExportResult, format: WhisperExportFormat, fallbackDurationSeconds: number) {
  if (format === "txt") return `${cleanText(result.text)}\n`
  const cues = cuesFor(result, fallbackDurationSeconds)
  if (format === "vtt") {
    return `WEBVTT\n\n${cues.map(cue => `${clock(cue.start, ".")} --> ${clock(cue.end, ".")}\n${cue.text}`).join("\n\n")}\n`
  }
  return `${cues.map((cue, index) => `${index + 1}\n${clock(cue.start, ",")} --> ${clock(cue.end, ",")}\n${cue.text}`).join("\n\n")}\n`
}

export function downloadWhisperExport(result: WhisperExportResult, format: WhisperExportFormat, fallbackDurationSeconds: number) {
  const mime = format === "txt" ? "text/plain;charset=utf-8" : format === "vtt" ? "text/vtt;charset=utf-8" : "application/x-subrip;charset=utf-8"
  const blob = new Blob([renderWhisperExport(result, format, fallbackDurationSeconds)], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `eduai-whisper-${new Date().toISOString().replace(/[:.]/g, "-")}.${format}`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
