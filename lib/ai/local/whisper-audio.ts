export const WHISPER_SAMPLE_RATE = 16_000
export const WHISPER_MAX_SECONDS = 30
export const WHISPER_N_FFT = 400
export const WHISPER_PADDED_FFT = 512
export const WHISPER_HOP_LENGTH = 160
export const WHISPER_N_MELS = 80
export const WHISPER_N_FRAMES = 3000

export type WhisperAudioFeatures = {
  waveform: Float32Array
  features: Float32Array
  durationSeconds: number
  sourceDurationSeconds: number
  segmentStartSeconds: number
  segmentEndSeconds: number
  truncated: boolean
  decodeMs: number
  featureMs: number
  validFrames: number
}

const LOG_ZERO_GUARD = Math.pow(2, -24)
const LN_10 = Math.log(10)
let cachedMelFilters: Float32Array[] | null = null
let cachedWindow: Float32Array | null = null

function hzToMel(freq: number) {
  const fSp = 200 / 3
  const minLogHz = 1000
  const minLogMel = minLogHz / fSp
  const logStep = Math.log(6.4) / 27
  return freq >= minLogHz
    ? minLogMel + Math.log(freq / minLogHz) / logStep
    : freq / fSp
}

function melToHz(mel: number) {
  const fSp = 200 / 3
  const minLogHz = 1000
  const minLogMel = minLogHz / fSp
  const logStep = Math.log(6.4) / 27
  return mel >= minLogMel
    ? minLogHz * Math.exp(logStep * (mel - minLogMel))
    : fSp * mel
}

function getHannWindow() {
  if (cachedWindow) return cachedWindow
  const window = new Float32Array(WHISPER_PADDED_FFT)
  for (let index = 0; index < window.length; index += 1) {
    window[index] = 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / window.length)
  }
  cachedWindow = window
  return window
}

function getMelFilters() {
  if (cachedMelFilters) return cachedMelFilters
  const bins = WHISPER_PADDED_FFT / 2 + 1
  const minMel = hzToMel(0)
  const maxMel = hzToMel(WHISPER_SAMPLE_RATE / 2)
  const melPoints = Array.from({ length: WHISPER_N_MELS + 2 }, (_, index) =>
    minMel + (index / (WHISPER_N_MELS + 1)) * (maxMel - minMel),
  )
  const hzPoints = melPoints.map(melToHz)
  const fftFreqs = Array.from({ length: bins }, (_, index) =>
    index * WHISPER_SAMPLE_RATE / WHISPER_PADDED_FFT,
  )
  const filters: Float32Array[] = []

  for (let melIndex = 0; melIndex < WHISPER_N_MELS; melIndex += 1) {
    const lowerHz = hzPoints[melIndex]
    const centerHz = hzPoints[melIndex + 1]
    const upperHz = hzPoints[melIndex + 2]
    const lowerWidth = Math.max(1e-12, centerHz - lowerHz)
    const upperWidth = Math.max(1e-12, upperHz - centerHz)
    const slaneyNorm = 2 / Math.max(1e-12, upperHz - lowerHz)
    const filter = new Float32Array(bins)
    for (let bin = 0; bin < bins; bin += 1) {
      const freq = fftFreqs[bin]
      const lower = (freq - lowerHz) / lowerWidth
      const upper = (upperHz - freq) / upperWidth
      filter[bin] = Math.max(0, Math.min(lower, upper)) * slaneyNorm
    }
    filters.push(filter)
  }
  cachedMelFilters = filters
  return filters
}

function reflectIndex(index: number, length: number) {
  if (length <= 1) return 0
  let result = index
  while (result < 0 || result >= length) {
    if (result < 0) result = -result
    if (result >= length) result = 2 * length - result - 2
  }
  return result
}

function reverseBits(value: number, bits: number) {
  let result = 0
  for (let bit = 0; bit < bits; bit += 1) {
    result = (result << 1) | (value & 1)
    value >>>= 1
  }
  return result
}

function powerSpectrum(samples: Float32Array) {
  const n = samples.length
  const real = new Float64Array(n)
  const imag = new Float64Array(n)
  const bits = Math.log2(n)

  for (let index = 0; index < n; index += 1) {
    real[reverseBits(index, bits)] = samples[index]
  }

  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1
    const angle = -2 * Math.PI / size
    const stepCos = Math.cos(angle)
    const stepSin = Math.sin(angle)
    for (let start = 0; start < n; start += size) {
      let wReal = 1
      let wImag = 0
      for (let offset = 0; offset < half; offset += 1) {
        const even = start + offset
        const odd = even + half
        const oddReal = real[odd] * wReal - imag[odd] * wImag
        const oddImag = real[odd] * wImag + imag[odd] * wReal
        const evenReal = real[even]
        const evenImag = imag[even]
        real[even] = evenReal + oddReal
        imag[even] = evenImag + oddImag
        real[odd] = evenReal - oddReal
        imag[odd] = evenImag - oddImag
        const nextReal = wReal * stepCos - wImag * stepSin
        wImag = wReal * stepSin + wImag * stepCos
        wReal = nextReal
      }
    }
  }

  const spectrum = new Float32Array(n / 2 + 1)
  for (let bin = 0; bin < spectrum.length; bin += 1) {
    spectrum[bin] = real[bin] * real[bin] + imag[bin] * imag[bin]
  }
  return spectrum
}

function computeWhisperLogMel(waveform: Float32Array) {
  if (!waveform.length) return { features: new Float32Array(WHISPER_N_MELS * WHISPER_N_FRAMES), validFrames: 0 }
  const validFrames = Math.min(WHISPER_N_FRAMES, Math.floor(waveform.length / WHISPER_HOP_LENGTH))
  const filters = getMelFilters()
  const window = getHannWindow()
  const mel = Array.from({ length: WHISPER_N_MELS }, () => new Float32Array(validFrames))
  const frame = new Float32Array(WHISPER_PADDED_FFT)
  let maxValue = Number.NEGATIVE_INFINITY

  for (let frameIndex = 0; frameIndex < validFrames; frameIndex += 1) {
    const center = frameIndex * WHISPER_HOP_LENGTH
    const start = center - WHISPER_PADDED_FFT / 2
    for (let index = 0; index < WHISPER_PADDED_FFT; index += 1) {
      const sampleIndex = reflectIndex(start + index, waveform.length)
      frame[index] = waveform[sampleIndex] * window[index]
    }
    const spectrum = powerSpectrum(frame)
    for (let melIndex = 0; melIndex < WHISPER_N_MELS; melIndex += 1) {
      const filter = filters[melIndex]
      let energy = 0
      for (let bin = 0; bin < spectrum.length; bin += 1) energy += spectrum[bin] * filter[bin]
      const value = Math.log(energy + LOG_ZERO_GUARD) / LN_10
      mel[melIndex][frameIndex] = value
      if (value > maxValue) maxValue = value
    }
  }

  if (!Number.isFinite(maxValue)) maxValue = -8
  const clipValue = maxValue - 8
  const features = new Float32Array(WHISPER_N_MELS * WHISPER_N_FRAMES)
  for (let melIndex = 0; melIndex < WHISPER_N_MELS; melIndex += 1) {
    const offset = melIndex * WHISPER_N_FRAMES
    for (let frameIndex = 0; frameIndex < validFrames; frameIndex += 1) {
      features[offset + frameIndex] = (Math.max(mel[melIndex][frameIndex], clipValue) + 4) / 4
    }
  }
  return { features, validFrames }
}

async function decodeAudioBlob(blob: Blob) {
  if (typeof window === "undefined") throw new Error("El audio local requiere un navegador.")
  const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextCtor) throw new Error("Web Audio API no está disponible en este navegador.")
  const context = new AudioContextCtor()
  try {
    const encoded = await blob.arrayBuffer()
    const audio = await context.decodeAudioData(encoded.slice(0))
    const channels = audio.numberOfChannels
    const mono = new Float32Array(audio.length)
    for (let channel = 0; channel < channels; channel += 1) {
      const source = audio.getChannelData(channel)
      for (let index = 0; index < source.length; index += 1) mono[index] += source[index] / channels
    }
    if (audio.sampleRate === WHISPER_SAMPLE_RATE) return mono

    const targetLength = Math.max(1, Math.ceil(audio.duration * WHISPER_SAMPLE_RATE))
    const offline = new OfflineAudioContext(1, targetLength, WHISPER_SAMPLE_RATE)
    const buffer = offline.createBuffer(1, mono.length, audio.sampleRate)
    buffer.copyToChannel(mono, 0)
    const source = offline.createBufferSource()
    source.buffer = buffer
    source.connect(offline.destination)
    source.start(0)
    const rendered = await offline.startRendering()
    return new Float32Array(rendered.getChannelData(0))
  } finally {
    void context.close().catch(() => undefined)
  }
}

export async function prepareWhisperAudio(
  blob: Blob,
  options: { segmentStartSeconds?: number } = {},
): Promise<WhisperAudioFeatures> {
  const decodeStarted = performance.now()
  const decoded = await decodeAudioBlob(blob)
  const decodeMs = performance.now() - decodeStarted
  const maxSamples = WHISPER_SAMPLE_RATE * WHISPER_MAX_SECONDS
  const sourceDurationSeconds = decoded.length / WHISPER_SAMPLE_RATE
  const maxStartSeconds = Math.max(0, sourceDurationSeconds - WHISPER_MAX_SECONDS)
  const requestedStartSeconds = Number.isFinite(options.segmentStartSeconds) ? Number(options.segmentStartSeconds) : 0
  const segmentStartSeconds = Math.min(maxStartSeconds, Math.max(0, requestedStartSeconds))
  const startSample = Math.min(decoded.length, Math.max(0, Math.round(segmentStartSeconds * WHISPER_SAMPLE_RATE)))
  const waveform = decoded.length > maxSamples
    ? decoded.slice(startSample, Math.min(decoded.length, startSample + maxSamples))
    : decoded
  const durationSeconds = waveform.length / WHISPER_SAMPLE_RATE
  const featureStarted = performance.now()
  const { features, validFrames } = computeWhisperLogMel(waveform)
  const featureMs = performance.now() - featureStarted
  return {
    waveform,
    features,
    durationSeconds,
    sourceDurationSeconds,
    segmentStartSeconds,
    segmentEndSeconds: segmentStartSeconds + durationSeconds,
    truncated: sourceDurationSeconds > WHISPER_MAX_SECONDS,
    decodeMs,
    featureMs,
    validFrames,
  }
}
