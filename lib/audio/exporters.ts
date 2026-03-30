import { AudioExportFormat, AudioSegment } from "./types"

function formatTimestamp(seconds: number, format: "srt" | "vtt") {
  const ms = Math.max(0, Math.floor(seconds * 1000))
  const hh = String(Math.floor(ms / 3600000)).padStart(2, "0")
  const mm = String(Math.floor((ms % 3600000) / 60000)).padStart(2, "0")
  const ss = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")
  const mmm = String(ms % 1000).padStart(3, "0")
  return `${hh}:${mm}:${ss}${format === "srt" ? "," : "."}${mmm}`
}

function splitFallbackSegments(text: string): AudioSegment[] {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean)
  let cursor = 0
  return lines.map((line, idx) => {
    const duration = Math.max(2, Math.ceil(line.length / 18))
    const seg: AudioSegment = {
      id: `fallback_${idx + 1}`,
      start: cursor,
      end: cursor + duration,
      text: line,
    }
    cursor += duration
    return seg
  })
}

export function buildSubtitleFile(text: string, segments: AudioSegment[] | undefined, format: "srt" | "vtt") {
  const usableSegments = (segments && segments.length > 0) ? segments : splitFallbackSegments(text)
  const lines: string[] = []
  if (format === "vtt") lines.push("WEBVTT", "")

  usableSegments.forEach((seg, idx) => {
    const payload = seg.speaker ? `[${seg.speaker}] ${seg.text}` : seg.text
    if (format === "srt") lines.push(String(idx + 1))
    lines.push(`${formatTimestamp(seg.start, format)} --> ${formatTimestamp(seg.end, format)}`)
    lines.push(payload.trim(), "")
  })

  return lines.join("\n")
}

export function buildExportPayload(params: {
  format: AudioExportFormat
  text: string
  fileName?: string
  segments?: AudioSegment[]
  metadata?: Record<string, unknown>
}) {
  const safeName = (params.fileName || "audio-transcript").replace(/\.[^.]+$/, "")
  switch (params.format) {
    case "txt":
      return {
        fileName: `${safeName}.txt`,
        mimeType: "text/plain; charset=utf-8",
        content: params.text,
      }
    case "md":
      return {
        fileName: `${safeName}.md`,
        mimeType: "text/markdown; charset=utf-8",
        content: params.text,
      }
    case "srt":
      return {
        fileName: `${safeName}.srt`,
        mimeType: "text/plain; charset=utf-8",
        content: buildSubtitleFile(params.text, params.segments, "srt"),
      }
    case "vtt":
      return {
        fileName: `${safeName}.vtt`,
        mimeType: "text/vtt; charset=utf-8",
        content: buildSubtitleFile(params.text, params.segments, "vtt"),
      }
    case "json":
      return {
        fileName: `${safeName}.json`,
        mimeType: "application/json; charset=utf-8",
        content: JSON.stringify({ text: params.text, segments: params.segments || [], metadata: params.metadata || {} }, null, 2),
      }
  }
}
