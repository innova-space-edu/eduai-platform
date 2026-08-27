"use client"

import { useEffect, useRef, useState } from "react"
import { Download, FileAudio, Gauge, Languages, Loader2, Mic, Play, ShieldCheck, Square, Upload, Waves, X } from "lucide-react"
import { DEFAULT_LITERT_WHISPER_MODEL_ID, EDUAI_LITERT_VERSION, getLocalAIModel } from "@/lib/ai/local/litert-models"
import { probeLiteRTCapabilities } from "@/lib/ai/local/litert-capabilities"
import { readLiteRTRouteProfile, saveLiteRTRouteProfile } from "@/lib/ai/local/litert-router"
import { recordLocalAIEvent } from "@/lib/ai/local/litert-telemetry"
import { prepareWhisperAudio, WHISPER_MAX_SECONDS, type WhisperAudioFeatures } from "@/lib/ai/local/whisper-audio"
import {
  type WhisperBackend,
  type WhisperProgress,
  type WhisperTask,
  type WhisperTranscriptionResult,
} from "@/lib/ai/local/whisper-transcribe"
import {
  transcribeWhisperLongForm,
  WHISPER_LONGFORM_OVERLAP_SECONDS,
  WHISPER_LONGFORM_QUALITY_VERSION,
  type WhisperLongFormProgress,
  type WhisperLongFormResult,
} from "@/lib/ai/local/whisper-longform"
import { transcribeWhisperFeaturesWorker } from "@/lib/ai/local/whisper-worker-client"
import { downloadWhisperExport, type WhisperExportFormat } from "@/lib/ai/local/whisper-export"

type CalibrationResult = {
  backend: WhisperBackend
  supported: boolean
  endToEndMs?: number
  acquireMs?: number
  decodedTokens?: number
  textValid?: boolean
  language?: string
  error?: string
}

type AnyWhisperResult = WhisperTranscriptionResult | WhisperLongFormResult

type RunState = {
  status: "idle" | "preparing" | "running" | "success" | "error"
  result?: AnyWhisperResult
  totalMs?: number
  preprocessMs?: number
  fallbackUsed?: boolean
  error?: string
}

const MAX_RECORDING_SECONDS = 300
const EXPORT_FORMATS: WhisperExportFormat[] = ["txt", "srt", "vtt"]

const LANGUAGE_OPTIONS = [
  ["auto", "Automático"], ["es", "Español"], ["en", "English"], ["pt", "Português"],
  ["fr", "Français"], ["de", "Deutsch"], ["it", "Italiano"], ["ca", "Català"],
  ["nl", "Nederlands"], ["ru", "Русский"], ["zh", "中文"], ["ja", "日本語"],
  ["ko", "한국어"], ["ar", "العربية"],
] as const

const LANGUAGE_LABELS = new Map<string, string>(LANGUAGE_OPTIONS.map(([code, label]) => [code, label]))

function languageLabel(code?: string) {
  if (!code) return "—"
  return LANGUAGE_LABELS.get(code) || code.toUpperCase()
}

function formatMs(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—"
  return value < 100 ? `${value.toFixed(1)} ms` : value < 1000 ? `${Math.round(value)} ms` : `${(value / 1000).toFixed(2)} s`
}

function formatSeconds(value: number) {
  return `${value.toFixed(1)} s`
}

function formatConfidence(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—"
  return `${Math.round(value * 100)}%`
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError"
}

function isLongFormResult(result?: AnyWhisperResult): result is WhisperLongFormResult {
  return Boolean(result && "chunks" in result)
}

function isValidTranscript(result: AnyWhisperResult) {
  return result.decodedTokens > 1 && result.text.trim().length > 0
}

function progressLabel(progress: WhisperProgress | null) {
  if (!progress) return ""
  if (progress.phase === "encoder") return "Codificando audio en Worker…"
  if (progress.phase === "language") return progress.language
    ? `Idioma detectado: ${languageLabel(progress.language)} · ${formatConfidence(progress.languageConfidence)}`
    : "Detectando idioma…"
  if (progress.phase === "tokenizer") return "Construyendo texto final…"
  return `Decodificando · ${progress.current} tokens${progress.tokensPerSecond ? ` · ${progress.tokensPerSecond.toFixed(1)} tok/s` : ""}`
}

function longFormChunkCount(durationSeconds: number) {
  if (durationSeconds <= WHISPER_MAX_SECONDS) return 1
  const step = WHISPER_MAX_SECONDS - WHISPER_LONGFORM_OVERLAP_SECONDS
  return Math.max(1, Math.ceil((durationSeconds - WHISPER_MAX_SECONDS) / step) + 1)
}

export default function WhisperTinyLocalPanel() {
  const model = getLocalAIModel(DEFAULT_LITERT_WHISPER_MODEL_ID)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState("")
  const [sourceDurationSeconds, setSourceDurationSeconds] = useState<number | null>(null)
  const [segmentStartSeconds, setSegmentStartSeconds] = useState(0)
  const [fullAudio, setFullAudio] = useState(true)
  const [language, setLanguage] = useState("auto")
  const [task, setTask] = useState<WhisperTask>("transcribe")
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [run, setRun] = useState<RunState>({ status: "idle" })
  const [calibrating, setCalibrating] = useState(false)
  const [calibration, setCalibration] = useState<CalibrationResult[]>([])
  const [routeRevision, setRouteRevision] = useState(0)
  const [phase, setPhase] = useState("")
  const [progress, setProgress] = useState<WhisperProgress | null>(null)
  const [longProgress, setLongProgress] = useState<WhisperLongFormProgress | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedAtRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const preparedRef = useRef<{ blob: Blob; segmentStartSeconds: number; data: WhisperAudioFeatures } | null>(null)
  const audioUrlRef = useRef("")

  useEffect(() => {
    setRouteRevision(1)
    const handler = () => setRouteRevision(value => value + 1)
    window.addEventListener("eduai:litert-route-profile", handler)
    return () => {
      window.removeEventListener("eduai:litert-route-profile", handler)
      if (timerRef.current) clearInterval(timerRef.current)
      abortRef.current?.abort()
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop()
      streamRef.current?.getTracks().forEach(track => track.stop())
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    }
  }, [])

  const routeProfile = routeRevision ? readLiteRTRouteProfile(EDUAI_LITERT_VERSION, DEFAULT_LITERT_WHISPER_MODEL_ID) : null

  function resetInferenceState() {
    abortRef.current?.abort()
    abortRef.current = null
    setRun({ status: "idle" })
    setCalibration([])
    setProgress(null)
    setLongProgress(null)
    setPhase("")
  }

  function resetPreparedState() {
    preparedRef.current = null
    resetInferenceState()
  }

  function replaceAudio(blob: Blob) {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    const url = URL.createObjectURL(blob)
    audioUrlRef.current = url
    setAudioBlob(blob)
    setAudioUrl(url)
    setSourceDurationSeconds(null)
    setSegmentStartSeconds(0)
    setFullAudio(true)
    resetPreparedState()
  }

  function updateSegmentStart(value: number) {
    const maxStart = Math.max(0, (sourceDurationSeconds || WHISPER_MAX_SECONDS) - WHISPER_MAX_SECONDS)
    setSegmentStartSeconds(Math.min(maxStart, Math.max(0, value)))
    resetPreparedState()
  }

  function updateLanguage(value: string) {
    setLanguage(value)
    resetInferenceState()
  }

  function updateTask(value: WhisperTask) {
    setTask(value)
    resetInferenceState()
  }

  function finishRecording() {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    setRecording(false)
  }

  async function startRecording() {
    if (recording || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      if (!navigator.mediaDevices?.getUserMedia) setRun({ status: "error", error: "El navegador no permite capturar micrófono en esta página." })
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      const preferredMime = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find(type => MediaRecorder.isTypeSupported(type))
      const recorder = preferredMime ? new MediaRecorder(stream, { mimeType: preferredMime }) : new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = event => { if (event.data.size) chunksRef.current.push(event.data) }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" })
        if (blob.size) replaceAudio(blob)
        finishRecording()
      }
      recorder.onerror = () => {
        finishRecording()
        setRun({ status: "error", error: "La grabación del micrófono se interrumpió." })
      }
      recorderRef.current = recorder
      streamRef.current = stream
      startedAtRef.current = performance.now()
      setRecordingSeconds(0)
      setRecording(true)
      recorder.start(250)
      timerRef.current = setInterval(() => {
        const elapsed = (performance.now() - startedAtRef.current) / 1000
        setRecordingSeconds(Math.min(MAX_RECORDING_SECONDS, elapsed))
        if (elapsed >= MAX_RECORDING_SECONDS && recorder.state !== "inactive") recorder.stop()
      }, 100)
    } catch (error) {
      finishRecording()
      setRun({ status: "error", error: error instanceof Error ? error.message : "No fue posible abrir el micrófono." })
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== "inactive") recorder.stop()
    else finishRecording()
  }

  async function preparedAudio() {
    if (!audioBlob) throw new Error("Graba o selecciona un audio primero.")
    const cached = preparedRef.current
    if (cached?.blob === audioBlob && Math.abs(cached.segmentStartSeconds - segmentStartSeconds) < 0.01) return cached.data
    setPhase("Decodificando audio y preparando log-Mel…")
    const data = await prepareWhisperAudio(audioBlob, { segmentStartSeconds })
    preparedRef.current = { blob: audioBlob, segmentStartSeconds: data.segmentStartSeconds, data }
    setSourceDurationSeconds(data.sourceDurationSeconds)
    return data
  }

  async function runSingleOnBackend(features: WhisperAudioFeatures, backend: WhisperBackend, maxTokens: number, signal?: AbortSignal) {
    return transcribeWhisperFeaturesWorker(features.features, backend, {
      maxTokens,
      language,
      task,
      includeTimestamps: true,
      signal,
      yieldEveryTokens: 1,
      onProgress: value => {
        setProgress(value)
        setLongProgress(null)
        setPhase(progressLabel(value))
      },
    })
  }

  function cancelCurrent() {
    abortRef.current?.abort()
  }

  async function backendCandidates() {
    const capabilities = await probeLiteRTCapabilities()
    const profile = readLiteRTRouteProfile(EDUAI_LITERT_VERSION, DEFAULT_LITERT_WHISPER_MODEL_ID)
    const preferred: WhisperBackend = profile?.backend === "webgpu" || profile?.backend === "wasm"
      ? profile.backend
      : capabilities.webgpu ? "webgpu" : "wasm"
    return {
      preferred,
      alternatives: preferred === "webgpu" ? ["webgpu", "wasm"] as WhisperBackend[] : capabilities.webgpu ? ["wasm", "webgpu"] as WhisperBackend[] : ["wasm"] as WhisperBackend[],
    }
  }

  async function transcribe() {
    if (!audioBlob || run.status === "running" || calibrating) return
    const started = performance.now()
    const controller = new AbortController()
    abortRef.current = controller
    setProgress(null)
    setLongProgress(null)
    setRun({ status: "preparing" })
    try {
      const sourceDuration = sourceDurationSeconds || 0
      const useLongForm = fullAudio && sourceDuration > WHISPER_MAX_SECONDS
      const { preferred, alternatives } = await backendCandidates()
      setRun({ status: "running" })
      let result: AnyWhisperResult | null = null
      let preprocessMs = 0
      let fallbackUsed = false
      const errors: string[] = []

      for (const backend of alternatives) {
        try {
          if (useLongForm) {
            setPhase(`Whisper Long-form · ${backend.toUpperCase()} · preparando archivo completo…`)
            const longResult = await transcribeWhisperLongForm(audioBlob, {
              backend,
              language,
              task,
              signal: controller.signal,
              overlapSeconds: WHISPER_LONGFORM_OVERLAP_SECONDS,
              maxTokensPerChunk: 192,
              transcribeFeatures: transcribeWhisperFeaturesWorker,
              onProgress: value => {
                setLongProgress(value)
                setProgress(value.modelProgress || null)
                const number = Math.min(value.chunkCount, value.chunkIndex + 1)
                const range = typeof value.startSeconds === "number" ? ` · ${value.startSeconds.toFixed(0)}–${(value.endSeconds || 0).toFixed(0)} s` : ""
                setPhase(value.phase === "merge" ? "Uniendo bloques y eliminando solapamientos…" : `Bloque ${number}/${value.chunkCount}${range}${value.modelProgress ? ` · ${progressLabel(value.modelProgress)}` : ""}`)
              },
            })
            result = longResult
            preprocessMs = longResult.decodeMs + longResult.featureMs
          } else {
            const features = await preparedAudio()
            result = await runSingleOnBackend(features, backend, 192, controller.signal)
            preprocessMs = features.decodeMs + features.featureMs
          }
          fallbackUsed = backend !== preferred
          break
        } catch (error) {
          if (controller.signal.aborted || isAbortError(error)) throw error
          errors.push(`${backend.toUpperCase()}: ${error instanceof Error ? error.message : String(error)}`)
        }
      }

      if (!result) throw new Error(`Whisper local no pudo ejecutarse. ${errors.join(" | ")}`)
      const totalMs = performance.now() - started
      setRun({ status: "success", result, totalMs, preprocessMs, fallbackUsed })
      setProgress(null)
      setLongProgress(null)
      setPhase(isValidTranscript(result)
        ? `${task === "translate" ? "Traducción" : "Transcripción"} local completada · ${languageLabel(result.language)}${isLongFormResult(result) ? ` · ${result.chunks.length} bloques` : ""}`
        : "Whisper no detectó texto útil en el audio")

      const computeMs = isLongFormResult(result)
        ? result.encodeMs + result.languageDetectionMs + result.decodeWallMs
        : result.encodeMs + result.languageDetectionMs + result.decodeMs
      recordLocalAIEvent({
        groupId: `whisper-${Date.now()}`,
        kind: "inference",
        backend: result.backend,
        modelId: DEFAULT_LITERT_WHISPER_MODEL_ID,
        latencyMs: totalMs,
        endToEndMs: totalMs,
        preprocessMs,
        modelAcquireMs: result.acquireMs,
        computeMs,
        readbackMs: 0,
        postprocessMs: result.tokenizerMs,
        runtimeReused: true,
        modelReused: result.modelReused,
        runCount: isLongFormResult(result) ? result.chunks.length : 1,
        success: true,
        note: isLongFormResult(result)
          ? `Whisper long-form ${result.qualityVersion} · Worker · ${result.chunks.length} bloques · ${result.decodedTokens} tokens · RTF ${result.realTimeFactor.toFixed(2)} · idioma ${result.language} · ${result.task}${fallbackUsed ? " · fallback local" : ""}`
          : `Whisper local · Worker · ${result.decodedTokens} tokens · ${result.tokensPerSecond.toFixed(1)} tok/s · idioma ${result.language} · ${result.task}${fallbackUsed ? " · fallback local" : ""}`,
      })
    } catch (error) {
      setProgress(null)
      setLongProgress(null)
      if (controller.signal.aborted || isAbortError(error)) {
        setRun({ status: "idle" })
        setPhase("Transcripción cancelada por el usuario")
      } else {
        setRun({ status: "error", totalMs: performance.now() - started, error: error instanceof Error ? error.message : "La transcripción local falló." })
        setPhase("")
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
    }
  }

  async function calibrate() {
    if (!audioBlob || calibrating || run.status === "running") return
    const controller = new AbortController()
    abortRef.current = controller
    setCalibrating(true)
    setCalibration([])
    setProgress(null)
    setLongProgress(null)
    try {
      const features = await preparedAudio()
      const capabilities = await probeLiteRTCapabilities()
      const backends: WhisperBackend[] = capabilities.webgpu ? ["wasm", "webgpu"] : ["wasm"]
      const results: CalibrationResult[] = []
      const groupId = `whisper-benchmark-${Date.now()}`
      for (const backend of backends) {
        if (controller.signal.aborted) break
        try {
          const result = await runSingleOnBackend(features, backend, 96, controller.signal)
          const textValid = isValidTranscript(result)
          results.push({ backend, supported: true, endToEndMs: result.modelEndToEndMs, acquireMs: result.acquireMs, decodedTokens: result.decodedTokens, textValid, language: result.language })
          recordLocalAIEvent({
            groupId, kind: "benchmark", backend, modelId: DEFAULT_LITERT_WHISPER_MODEL_ID,
            latencyMs: result.modelEndToEndMs, endToEndMs: result.modelEndToEndMs, modelAcquireMs: result.acquireMs,
            computeMs: result.encodeMs + result.languageDetectionMs + result.decodeMs, postprocessMs: result.tokenizerMs,
            runtimeReused: true, modelReused: result.modelReused, runCount: 1, success: textValid,
            note: textValid ? `Whisper Router V3 calibration · Worker · ${result.language} · ${result.task}` : "Whisper calibration descartada: sin texto válido",
          })
        } catch (error) {
          if (controller.signal.aborted || isAbortError(error)) break
          results.push({ backend, supported: false, error: error instanceof Error ? error.message : "No compatible" })
        }
      }
      if (controller.signal.aborted) return setPhase("Calibración Whisper cancelada")
      setCalibration(results)
      const valid = results.filter(item => item.supported && item.textValid && typeof item.endToEndMs === "number").sort((a, b) => (a.endToEndMs || Infinity) - (b.endToEndMs || Infinity))
      if (valid.length) {
        saveLiteRTRouteProfile({ modelId: DEFAULT_LITERT_WHISPER_MODEL_ID, backend: valid[0].backend, medianEndToEndMs: valid[0].endToEndMs!, p95EndToEndMs: valid[0].endToEndMs!, alternativeMedianEndToEndMs: valid[1]?.endToEndMs ?? null })
        setPhase(`Calibración Whisper completada · ${languageLabel(valid[0].language)}`)
      } else setPhase("Calibración no guardada: selecciona un tramo con voz y vuelve a probar")
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) setPhase("Calibración Whisper cancelada")
      else setRun({ status: "error", error: error instanceof Error ? error.message : "No fue posible calibrar Whisper." })
    } finally {
      setCalibrating(false)
      setProgress(null)
      if (abortRef.current === controller) abortRef.current = null
    }
  }

  const prepared = preparedRef.current?.blob === audioBlob && Math.abs(preparedRef.current.segmentStartSeconds - segmentStartSeconds) < 0.01 ? preparedRef.current.data : null
  const sourceDuration = sourceDurationSeconds || prepared?.sourceDurationSeconds || 0
  const maxSegmentStart = Math.max(0, sourceDuration - WHISPER_MAX_SECONDS)
  const segmentEndPreview = Math.min(sourceDuration || segmentStartSeconds + WHISPER_MAX_SECONDS, segmentStartSeconds + WHISPER_MAX_SECONDS)
  const busy = run.status === "preparing" || run.status === "running" || calibrating
  const decoderProgress = progress?.phase === "decoder" ? Math.min(100, (progress.current / Math.max(1, progress.total)) * 100) : 0
  const chunkCount = longFormChunkCount(sourceDuration)
  const longOverallProgress = longProgress ? Math.min(100, ((longProgress.chunkIndex + (progress?.phase === "decoder" ? decoderProgress / 100 : 0.15)) / Math.max(1, longProgress.chunkCount)) * 100) : 0
  const result = run.result
  const longResult = isLongFormResult(result) ? result : null
  const singleResult = result && !longResult ? result as WhisperTranscriptionResult : null

  return (
    <section className="mt-4 rounded-[30px] border border-sky-400/15 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.10),transparent_30%),linear-gradient(180deg,rgba(4,15,29,0.99),rgba(3,9,20,0.99))] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-sky-300"><Waves className="h-4 w-4" /><p className="text-xs font-black uppercase tracking-[0.2em]">Whisper local · ASR {WHISPER_LONGFORM_QUALITY_VERSION}</p></div>
          <h2 className="mt-2 text-2xl font-black text-white">Whisper Tiny INT8 · voz a texto multilingüe</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">Audio corto o archivo completo con cortes sensibles a silencio, overlap objetivo de {WHISPER_LONGFORM_OVERLAP_SECONDS} s, idioma automático/manual, timestamps globales y modelo ejecutado en Worker dedicado. Todo permanece en el navegador.</p>
        </div>
        <div className="rounded-2xl border border-emerald-400/15 bg-emerald-950/20 px-4 py-3"><div className="flex items-center gap-2 text-emerald-200"><ShieldCheck className="h-4 w-4" /><span className="text-xs font-black">100% local</span></div><p className="mt-1 text-[10px] text-slate-500">Worker dedicado · sin fallback cloud</p></div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-[24px] border border-white/10 bg-slate-950/50 p-4">
          <div className="flex items-center gap-2"><Mic className="h-4 w-4 text-sky-300" /><h3 className="text-sm font-black text-white">Entrada de audio</h3></div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => void (recording ? Promise.resolve(stopRecording()) : startRecording())} className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-black ${recording ? "border-red-400/25 bg-red-950/25 text-red-100" : "border-sky-400/20 bg-sky-950/25 text-sky-100"}`}>{recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}{recording ? `Detener · ${recordingSeconds.toFixed(1)} s` : "Grabar micrófono"}</button>
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-3 text-xs font-black text-slate-200"><Upload className="h-4 w-4" />Subir audio<input type="file" accept="audio/*" className="sr-only" onChange={event => { const file = event.target.files?.[0]; if (file) replaceAudio(file) }} /></label>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="rounded-xl border border-white/5 bg-black/20 p-3"><span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-slate-500"><Languages className="h-3.5 w-3.5" />Idioma del audio</span><select value={language} disabled={busy} onChange={event => updateLanguage(event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-2.5 py-2 text-xs font-bold text-slate-200 outline-none disabled:opacity-50">{LANGUAGE_OPTIONS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
            <label className="rounded-xl border border-white/5 bg-black/20 p-3"><span className="text-[10px] font-black uppercase tracking-wide text-slate-500">Tarea</span><select value={task} disabled={busy} onChange={event => updateTask(event.target.value as WhisperTask)} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-2.5 py-2 text-xs font-bold text-slate-200 outline-none disabled:opacity-50"><option value="transcribe">Transcribir · idioma original</option><option value="translate">Traducir · salida en inglés</option></select></label>
          </div>

          {audioBlob ? <div className="mt-4 rounded-2xl border border-white/5 bg-black/20 p-3">
            <div className="flex items-center gap-2 text-xs text-slate-300"><FileAudio className="h-4 w-4 text-sky-300" /><span className="font-black">Audio listo</span></div>
            {audioUrl ? <audio controls src={audioUrl} className="mt-3 w-full" onLoadedMetadata={event => {
              const duration = event.currentTarget.duration
              if (Number.isFinite(duration) && duration > 0) {
                setSourceDurationSeconds(duration)
                setFullAudio(duration > WHISPER_MAX_SECONDS)
              }
            }} /> : null}
            <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]"><div className="rounded-xl bg-black/20 p-2"><span className="text-slate-600">Archivo</span><p className="mt-1 font-black text-slate-300">{sourceDuration ? formatSeconds(sourceDuration) : "leyendo duración…"}</p></div><div className="rounded-xl bg-black/20 p-2"><span className="text-slate-600">Ruta V3</span><p className="mt-1 font-black text-slate-300">{routeProfile ? `${routeProfile.backend.toUpperCase()} · ${formatMs(routeProfile.medianEndToEndMs)}` : "sin calibrar"}</p></div></div>

            {sourceDuration > WHISPER_MAX_SECONDS ? <div className="mt-3 rounded-xl border border-cyan-400/15 bg-cyan-950/10 p-3">
              <p className="text-[10px] font-black text-cyan-100">Modo de procesamiento</p>
              <div className="mt-2 grid grid-cols-2 gap-2"><button type="button" disabled={busy} onClick={() => { setFullAudio(true); resetInferenceState() }} className={`rounded-lg border px-2 py-2 text-[10px] font-black ${fullAudio ? "border-cyan-400/30 bg-cyan-950/35 text-cyan-100" : "border-white/10 text-slate-400"}`}>Archivo completo · {chunkCount} bloques</button><button type="button" disabled={busy} onClick={() => { setFullAudio(false); resetInferenceState() }} className={`rounded-lg border px-2 py-2 text-[10px] font-black ${!fullAudio ? "border-amber-400/30 bg-amber-950/25 text-amber-100" : "border-white/10 text-slate-400"}`}>Solo tramo de 30 s</button></div>
              {fullAudio ? <p className="mt-2 text-[9px] leading-4 text-cyan-100/60">EduAI usa un overlap objetivo de {WHISPER_LONGFORM_OVERLAP_SECONDS} s y busca un punto silencioso cerca del límite. El último bloque puede ser más corto para evitar reprocesar audio innecesario.</p> : <><div className="mt-3 flex items-center justify-between"><p className="text-[10px] font-black text-amber-100">Tramo: {segmentStartSeconds.toFixed(1)}–{segmentEndPreview.toFixed(1)} s</p><div className="flex gap-1"><button type="button" onClick={() => updateSegmentStart(0)} className="rounded border border-white/10 px-2 py-1 text-[9px] text-slate-300">Inicio</button><button type="button" onClick={() => updateSegmentStart(maxSegmentStart)} className="rounded border border-white/10 px-2 py-1 text-[9px] text-slate-300">Final</button></div></div><input type="range" min={0} max={maxSegmentStart} step={0.5} value={Math.min(segmentStartSeconds, maxSegmentStart)} onChange={event => updateSegmentStart(Number(event.target.value))} className="mt-2 w-full accent-amber-400" /></>}
              <p className="mt-2 text-[9px] text-slate-500">La calibración WASM/WebGPU siempre usa el tramo seleccionado de 30 s, no el archivo completo.</p>
            </div> : null}
          </div> : <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-5 text-center text-xs text-slate-600">Graba una frase o selecciona un archivo de audio.</div>}

          {busy && (progress || longProgress) ? <div className="mt-4 rounded-xl border border-sky-400/15 bg-sky-950/15 p-3"><div className="flex items-center justify-between gap-3"><p className="text-[10px] font-black text-sky-100">{phase}</p><button type="button" onClick={cancelCurrent} className="inline-flex items-center gap-1 rounded-lg border border-red-400/20 px-2 py-1 text-[9px] font-black text-red-200"><X className="h-3 w-3" />Cancelar</button></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-900"><div className="h-full rounded-full bg-cyan-400 transition-[width] duration-150" style={{ width: `${longProgress ? longOverallProgress : decoderProgress}%` }} /></div>{longProgress ? <p className="mt-1 text-[9px] text-slate-500">Progreso global del archivo: bloque {Math.min(longProgress.chunkCount, longProgress.chunkIndex + 1)}/{longProgress.chunkCount}. La inferencia pesada corre fuera del hilo de interfaz.</p> : <p className="mt-1 text-[9px] text-slate-500">La inferencia pesada corre en un Worker dedicado.</p>}</div> : null}

          <div className="mt-4 grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => void transcribe()} disabled={!audioBlob || recording || busy} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-950/25 px-4 py-3 text-xs font-black text-emerald-100 disabled:opacity-40">{run.status === "preparing" || run.status === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{sourceDuration > WHISPER_MAX_SECONDS && fullAudio ? (task === "translate" ? "Traducir archivo completo" : "Transcribir archivo completo") : task === "translate" ? "Traducir local" : "Transcribir local"}</button><button type="button" onClick={() => void calibrate()} disabled={!audioBlob || recording || busy} className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-400/20 bg-violet-950/25 px-4 py-3 text-xs font-black text-violet-100 disabled:opacity-40">{calibrating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gauge className="h-4 w-4" />}Calibrar WASM/WebGPU</button></div>
          {phase && !busy ? <p className="mt-3 text-[10px] font-bold text-sky-200/70">{phase}</p> : null}
        </div>

        <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Resultado</p><h3 className="mt-1 text-lg font-black text-white">{task === "translate" ? "Traducción al inglés" : "Transcripción"}</h3></div>{result ? <div className="flex flex-wrap justify-end gap-1.5"><span className="rounded-full bg-cyan-950/40 px-2.5 py-1 text-[10px] font-black text-cyan-200">{languageLabel(result.language)} · {formatConfidence(result.languageConfidence)}</span><span className="rounded-full bg-emerald-950/40 px-2.5 py-1 text-[10px] font-black text-emerald-200">{result.backend.toUpperCase()}</span><span className="rounded-full bg-sky-950/40 px-2.5 py-1 text-[10px] font-black text-sky-200">WORKER</span><span className="rounded-full bg-slate-950/60 px-2.5 py-1 text-[10px] font-black text-slate-300">{result.modelReused ? "POOL HIT" : result.cacheHit ? "CACHE HIT" : result.cacheSource.toUpperCase()}</span></div> : null}</div>
          {run.status === "success" && result ? <>
            <div className="mt-4 min-h-32 rounded-2xl border border-emerald-400/10 bg-emerald-950/15 p-4 text-sm leading-6 text-slate-100">{result.text || <span className="text-slate-500">Whisper no detectó texto en el audio.</span>}</div>
            <div className="mt-3 flex flex-wrap items-center gap-2"><span className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">Exportar</span>{EXPORT_FORMATS.map(format => <button key={format} type="button" onClick={() => downloadWhisperExport(result, format, sourceDuration || WHISPER_MAX_SECONDS)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-950/50 px-2.5 py-1.5 text-[10px] font-black uppercase text-slate-200 transition hover:border-sky-400/25 hover:text-sky-100"><Download className="h-3 w-3" />{format}</button>)}</div>
            <div className="mt-3 flex flex-wrap gap-2 text-[10px]"><span className="rounded-lg border border-cyan-400/10 bg-cyan-950/20 px-2.5 py-1.5 text-cyan-100">Idioma {result.languageSource === "auto" ? "detectado" : "forzado"}: <strong>{languageLabel(result.language)}</strong> · {formatConfidence(result.languageConfidence)}</span><span className="rounded-lg border border-violet-400/10 bg-violet-950/20 px-2.5 py-1.5 text-violet-100">Tarea: <strong>{result.task === "translate" ? "Traducir a inglés" : "Transcribir original"}</strong></span>{longResult ? <span className="rounded-lg border border-sky-400/10 bg-sky-950/20 px-2.5 py-1.5 text-sky-100">Archivo completo: <strong>{longResult.chunks.length} bloques</strong> · overlap objetivo {longResult.overlapSeconds}s · {longResult.qualityVersion}</span> : null}<span className="rounded-lg border border-white/5 bg-slate-950/40 px-2.5 py-1.5 text-slate-400">{result.timestampTokens.length} timestamps internos</span></div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">{longResult ? [["Total", formatMs(longResult.totalMs)], ["RTF", longResult.realTimeFactor.toFixed(2)], ["Preproceso", formatMs(run.preprocessMs)], ["Modelo", formatMs(longResult.modelEndToEndMs)], ["Encoder", formatMs(longResult.encodeMs)], ["Decoder", formatMs(longResult.decodeWallMs)], ["Adquirir", formatMs(longResult.acquireMs)], ["Tokens", `${longResult.decodedTokens}`], ["Velocidad", `${longResult.tokensPerSecond.toFixed(1)} tok/s`], ["ms/token", `${longResult.msPerToken.toFixed(0)} ms`]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-950/55 p-2.5"><p className="text-[9px] uppercase text-slate-600">{label}</p><p className="mt-1 text-xs font-black text-white">{value}</p></div>) : singleResult ? [["Preproceso", formatMs(run.preprocessMs)], ["Modelo", formatMs(singleResult.modelEndToEndMs)], ["Encoder", formatMs(singleResult.encodeMs)], ["Idioma", formatMs(singleResult.languageDetectionMs)], ["Decoder", formatMs(singleResult.decodeWallMs)], ["Adquirir", formatMs(singleResult.acquireMs)], ["Tokenizer", formatMs(singleResult.tokenizerMs)], ["Tokens", `${singleResult.decodedTokens}`], ["Velocidad", `${singleResult.tokensPerSecond.toFixed(1)} tok/s`], ["ms/token", `${singleResult.msPerToken.toFixed(0)} ms`]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-950/55 p-2.5"><p className="text-[9px] uppercase text-slate-600">{label}</p><p className="mt-1 text-xs font-black text-white">{value}</p></div>) : null}</div>

            {longResult ? <details className="mt-3 rounded-xl border border-white/5 bg-slate-950/40 p-3 text-[10px] text-slate-500" open><summary className="cursor-pointer font-black text-slate-300">Bloques transcritos · timestamps globales</summary><div className="mt-3 space-y-2">{longResult.chunks.map((chunk, index) => { const previous = longResult.chunks[index - 1]; const actualOverlap = previous ? Math.max(0, previous.endSeconds - chunk.startSeconds) : 0; return <div key={chunk.index} className="rounded-xl border border-white/5 bg-black/20 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-black text-slate-300">Bloque {chunk.index + 1}/{longResult.chunks.length} · {chunk.startSeconds.toFixed(1)}–{chunk.endSeconds.toFixed(1)} s</span><span>{index ? `overlap real ${actualOverlap.toFixed(1)} s · ` : ""}{formatMs(chunk.result.modelEndToEndMs)} · {chunk.result.decodedTokens} tokens</span></div><p className="mt-2 leading-4 text-slate-400">{chunk.result.text || "Sin texto"}</p></div> })}</div></details> : singleResult ? <details className="mt-3 rounded-xl border border-white/5 bg-slate-950/40 p-3 text-[10px] text-slate-500"><summary className="cursor-pointer font-black text-slate-300">Diagnóstico técnico · tokens y timestamps</summary><div className="mt-2 space-y-1"><p>prompt: {singleResult.prefixTokenIds.join(", ")}</p><p>texto técnico: {singleResult.rawText || "—"}</p><p>token ids: {singleResult.tokenIds.slice(0, 20).join(", ") || "ninguno"}</p></div></details> : null}
            {run.fallbackUsed ? <p className="mt-3 rounded-xl border border-amber-400/15 bg-amber-950/20 p-3 text-[10px] text-amber-100">El backend preferido falló; EduAI usó el otro backend local. El audio no salió del navegador.</p> : null}
          </> : run.status === "error" ? <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-950/20 p-4 text-xs leading-5 text-amber-100">{run.error}</div> : <div className="mt-4 grid min-h-52 place-items-center rounded-2xl border border-dashed border-white/10 text-center text-xs text-slate-600">La transcripción aparecerá aquí.</div>}
        </div>
      </div>

      {calibration.length ? <div className="mt-4 rounded-[24px] border border-violet-400/15 bg-violet-950/15 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-black text-violet-100">Calibración Router V3 · Whisper</p><p className="mt-1 text-[10px] text-slate-500">La calibración usa una ventana de hasta 30 s y solo guarda un backend si produce texto válido. La inferencia se ejecuta en Worker.</p></div>{routeProfile ? <span className="rounded-full bg-emerald-950/35 px-3 py-1 text-[10px] font-black text-emerald-200">Perfil actual: {routeProfile.backend.toUpperCase()}</span> : null}</div><div className="mt-3 grid gap-2 sm:grid-cols-2">{calibration.map(item => <div key={item.backend} className="rounded-2xl border border-white/5 bg-black/20 p-3"><div className="flex items-center justify-between"><span className="text-xs font-black text-white">{item.backend.toUpperCase()}</span><span className={`text-[10px] font-black ${item.supported && item.textValid ? "text-emerald-300" : "text-amber-300"}`}>{!item.supported ? "No compatible" : item.textValid ? formatMs(item.endToEndMs) : "Sin texto válido"}</span></div>{item.supported ? <p className="mt-1 text-[10px] text-slate-500">Adquisición {formatMs(item.acquireMs)} · {item.decodedTokens || 0} tokens · {languageLabel(item.language)}</p> : <p className="mt-2 text-[10px] leading-4 text-slate-500">{item.error}</p>}</div>)}</div></div> : null}
    </section>
  )
}
