export type WhisperQualityPreset = "fast" | "balanced" | "quality"

export type WhisperVadStats = {
  activeFrames: number
  totalFrames: number
  speechRatio: number
  rmsMean: number
  rmsPeak: number
  rmsFloor: number
  threshold: number
}

export type WhisperTranscriptQuality = {
  score: number
  warnings: string[]
  repetitionRatio: number
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

function percentile(values: number[], ratio: number) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * ratio)))
  return sorted[index]
}

function rmsRange(waveform: Float32Array, start: number, end: number) {
  if (end <= start) return 0
  let energy = 0
  for (let index = start; index < end; index += 1) {
    const value = waveform[index] || 0
    energy += value * value
  }
  return Math.sqrt(energy / Math.max(1, end - start))
}

export function analyzeWhisperSpeechActivity(
  waveform: Float32Array,
  sampleRate: number,
  startSeconds: number,
  endSeconds: number,
  preset: WhisperQualityPreset = "balanced",
): WhisperVadStats {
  const duration = Math.max(0, endSeconds - startSeconds)
  if (!duration || !waveform.length || !sampleRate) {
    return { activeFrames: 0, totalFrames: 0, speechRatio: 0, rmsMean: 0, rmsPeak: 0, rmsFloor: 0, threshold: 0 }
  }

  const frameSeconds = preset === "quality" ? 0.18 : preset === "fast" ? 0.32 : 0.24
  const hopSeconds = frameSeconds / 2
  const frameSamples = Math.max(1, Math.round(frameSeconds * sampleRate))
  const startSample = Math.max(0, Math.round(startSeconds * sampleRate))
  const endSample = Math.min(waveform.length, Math.round(endSeconds * sampleRate))
  const hopSamples = Math.max(1, Math.round(hopSeconds * sampleRate))
  const values: number[] = []

  for (let cursor = startSample; cursor < endSample; cursor += hopSamples) {
    values.push(rmsRange(waveform, cursor, Math.min(endSample, cursor + frameSamples)))
  }

  if (!values.length) {
    return { activeFrames: 0, totalFrames: 0, speechRatio: 0, rmsMean: 0, rmsPeak: 0, rmsFloor: 0, threshold: 0 }
  }

  const rmsFloor = percentile(values, 0.2)
  const rmsPeak = percentile(values, 0.95)
  const floorMultiplier = preset === "quality" ? 1.9 : preset === "fast" ? 2.5 : 2.15
  const peakShare = preset === "quality" ? 0.045 : preset === "fast" ? 0.07 : 0.055
  const threshold = Math.max(0.0015, rmsFloor * floorMultiplier, rmsPeak * peakShare)
  const activeFrames = values.filter(value => value >= threshold).length
  const rmsMean = values.reduce((sum, value) => sum + value, 0) / values.length

  return {
    activeFrames,
    totalFrames: values.length,
    speechRatio: activeFrames / values.length,
    rmsMean,
    rmsPeak,
    rmsFloor,
    threshold,
  }
}

function normalizeWord(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "")
}

function collapseRepeatedPhrases(words: string[]) {
  const output = [...words]
  let changed = true
  while (changed) {
    changed = false
    const maxPhrase = Math.min(10, Math.floor(output.length / 2))
    for (let size = maxPhrase; size >= 3; size -= 1) {
      for (let index = 0; index + size * 2 <= output.length; index += 1) {
        const left = output.slice(index, index + size).map(normalizeWord)
        const right = output.slice(index + size, index + size * 2).map(normalizeWord)
        if (left.every((word, offset) => word && word === right[offset])) {
          output.splice(index + size, size)
          changed = true
          break
        }
      }
      if (changed) break
    }
  }
  return output
}

export function cleanWhisperTranscript(value: string) {
  const compact = value
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([¿¡])\s+/g, "$1")
    .replace(/([!?.,])\1{2,}/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
  if (!compact) return ""

  const words = compact.split(/\s+/)
  const deduped: string[] = []
  for (const word of words) {
    const normalized = normalizeWord(word)
    const previous = deduped.length ? normalizeWord(deduped[deduped.length - 1]) : ""
    const beforePrevious = deduped.length > 1 ? normalizeWord(deduped[deduped.length - 2]) : ""
    if (normalized && normalized === previous && normalized === beforePrevious) continue
    deduped.push(word)
  }

  const phraseCleaned = collapseRepeatedPhrases(deduped)
  const text = phraseCleaned.join(" ").replace(/\s+([,.;:!?])/g, "$1").trim()
  return text ? text.charAt(0).toLocaleUpperCase() + text.slice(1) : ""
}

function repetitionRatio(text: string) {
  const words = text.split(/\s+/).map(normalizeWord).filter(Boolean)
  if (words.length < 6) return 0
  let repeats = 0
  for (let index = 2; index < words.length; index += 1) {
    if (words[index] === words[index - 1] || words[index] === words[index - 2]) repeats += 1
  }
  return repeats / words.length
}

export function estimateWhisperTranscriptQuality(input: {
  text: string
  decodedTokens: number
  durationSeconds: number
  languageConfidence: number
  vad: WhisperVadStats
}): WhisperTranscriptQuality {
  const text = input.text.trim()
  const duration = Math.max(0.5, input.durationSeconds)
  const charsPerSecond = text.length / duration
  const tokensPerSecond = input.decodedTokens / duration
  const repetition = repetitionRatio(text)
  const speechComponent = clamp((input.vad.speechRatio - 0.04) / 0.5)
  const languageComponent = clamp(input.languageConfidence || 0)
  const textCoverage = clamp(charsPerSecond / 5.5)
  const tokenDensity = tokensPerSecond > 11 ? clamp(1 - (tokensPerSecond - 11) / 10) : clamp(tokensPerSecond / 1.2)
  const repetitionComponent = clamp(1 - repetition * 4)

  const score = clamp(
    speechComponent * 0.24 +
    languageComponent * 0.24 +
    textCoverage * 0.22 +
    tokenDensity * 0.16 +
    repetitionComponent * 0.14,
  )

  const warnings: string[] = []
  if (input.vad.speechRatio < 0.08) warnings.push("muy poca voz detectada")
  if (input.languageConfidence > 0 && input.languageConfidence < 0.6) warnings.push("idioma con baja confianza")
  if (text.length < 8 && input.vad.speechRatio > 0.2) warnings.push("texto demasiado corto para la voz detectada")
  if (repetition > 0.12) warnings.push("posible repetición/alucinación")
  if (tokensPerSecond > 11) warnings.push("densidad de tokens anómala")
  if (score < 0.45) warnings.push("segmento de baja confianza")

  return { score, warnings, repetitionRatio: repetition }
}
