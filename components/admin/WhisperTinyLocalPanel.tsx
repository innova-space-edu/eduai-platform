"use client"

import { useEffect, useRef, useState } from "react"
import { FileAudio, Gauge, Loader2, Mic, Play, ShieldCheck, Square, Upload, Waves } from "lucide-react"
import { DEFAULT_LITERT_WHISPER_MODEL_ID, EDUAI_LITERT_VERSION, getLocalAIModel } from "@/lib/ai/local/litert-models"
import { probeLiteRTCapabilities } from "@/lib/ai/local/litert-capabilities"
import { readLiteRTRouteProfile, saveLiteRTRouteProfile } from "@/lib/ai/local/litert-router"
import { recordLocalAIEvent } from "@/lib/ai/local/litert-telemetry"
import { prepareWhisperAudio, WHISPER_MAX_SECONDS, type WhisperAudioFeatures } from "@/lib/ai/local/whisper-audio"
import { transcribeWhisperFeatures, type WhisperBackend, type WhisperTranscriptionResult } from "@/lib/ai/local/whisper-transcribe"

type CalibrationResult = {
  backend: WhisperBackend
  supported: boolean
  endToEndMs?: number
  acquireMs?: number
  text?: string
  decodedTokens?: number
  textValid?: boolean
  error?: string
}

type RunState = {
  status: "idle" | "preparing" | "running" | "success" | "error"
  result?: WhisperTranscriptionResult
  totalMs?: number
  preprocessMs?: number
  fallbackUsed?: boolean
  error?: string
}

function formatMs(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—"
  return value < 100 ? `${value.toFixed(1)} ms` : value < 1000 ? `${Math.round(value)} ms` : `${(value / 1000).toFixed(2)} s`
}

function formatSeconds(value: number) {
  return `${value.toFixed(1)} s`
}

function isValidTranscript(result: WhisperTranscriptionResult) {
  return result.decodedTokens > 1 && result.text.trim().length > 0
}

export default function WhisperTinyLocalPanel() {
  const model = getLocalAIModel(DEFAULT_LITERT_WHISPER_MODEL_ID)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState("")
  const [sourceDurationSeconds, setSourceDurationSeconds] = useState<number | null>(null)
  const [segmentStartSeconds, setSegmentStartSeconds] = useState(0)
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [run, setRun] = useState<RunState>({ status: "idle" })
  const [calibrating, setCalibrating] = useState(false)
  const [calibration, setCalibration] = useState<CalibrationResult[]>([])
  const [routeRevision, setRouteRevision] = useState(0)
  const [phase, setPhase] = useState("")
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedAtRef = useRef(0)
  const preparedRef = useRef<{ blob: Blob; segmentStartSeconds: number; data: WhisperAudioFeatures } | null>(null)

  useEffect(() => {
    setRouteRevision(1)
    const handler = () => setRouteRevision(value => value + 1)
    window.addEventListener("eduai:litert-route-profile", handler)
    return () => {
      window.removeEventListener("eduai:litert-route-profile", handler)
      if (timerRef.current) clearInterval(timerRef.current)
      recorderRef.current?.state !== "inactive" && recorderRef.current?.stop()
      streamRef.current?.getTracks().forEach(track => track.stop())
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  }, [audioUrl])

  const routeProfile = routeRevision ? readLiteRTRouteProfile(EDUAI_LITERT_VERSION, DEFAULT_LITERT_WHISPER_MODEL_ID) : null

  function resetPreparedState() {
    preparedRef.current = null
    setRun({ status: "idle" })
    setCalibration([])
    setPhase("")
  }

  function replaceAudio(blob: Blob) {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    const url = URL.createObjectURL(blob)
    setAudioBlob(blob)
    setAudioUrl(url)
    setSourceDurationSeconds(null)
    setSegmentStartSeconds(0)
    resetPreparedState()
  }

  function updateSegmentStart(value: number) {
    const maxStart = Math.max(0, (sourceDurationSeconds || WHISPER_MAX_SECONDS) - WHISPER_MAX_SECONDS)
    const next = Math.min(maxStart, Math.max(0, value))
    setSegmentStartSeconds(next)
    resetPreparedState()
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
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
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
      setRun({ status: "idle" })
      setRecording(true)
      recorder.start(250)
      timerRef.current = setInterval(() => {
        const elapsed = (performance.now() - startedAtRef.current) / 1000
        setRecordingSeconds(Math.min(WHISPER_MAX_SECONDS, elapsed))
        if (elapsed >= WHISPER_MAX_SECONDS && recorder.state !== "inactive") recorder.stop()
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
    if (Math.abs(data.segmentStartSeconds - segmentStartSeconds) >= 0.01) setSegmentStartSeconds(data.segmentStartSeconds)
    return data
  }

  async function runOnBackend(features: WhisperAudioFeatures, backend: WhisperBackend, maxTokens?: number) {
    setPhase(`Whisper Tiny · ${backend.toUpperCase()} · encode/decode…`)
    return transcribeWhisperFeatures(features.features, backend, { maxTokens })
  }

  async function transcribe() {
    if (!audioBlob || run.status === "running" || calibrating) return
    const started = performance.now()
    setRun({ status: "preparing" })
    try {
      const features = await preparedAudio()
      setRun({ status: "running" })
      const capabilities = await probeLiteRTCapabilities()
      const profile = readLiteRTRouteProfile(EDUAI_LITERT_VERSION, DEFAULT_LITERT_WHISPER_MODEL_ID)
      const preferred: WhisperBackend = profile?.backend === "webgpu" || profile?.backend === "wasm"
        ? profile.backend
        : capabilities.webgpu ? "webgpu" : "wasm"
      const alternatives: WhisperBackend[] = preferred === "webgpu" ? ["webgpu", "wasm"] : capabilities.webgpu ? ["wasm", "webgpu"] : ["wasm"]
      let result: WhisperTranscriptionResult | null = null
      let fallbackUsed = false
      const errors: string[] = []
      for (const backend of alternatives) {
        try {
          result = await runOnBackend(features, backend)
          fallbackUsed = backend !== preferred
          break
        } catch (error) {
          errors.push(`${backend.toUpperCase()}: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
      if (!result) throw new Error(`Whisper local no pudo ejecutarse. ${errors.join(" | ")}`)
      const preprocessMs = features.decodeMs + features.featureMs
      const totalMs = performance.now() - started
      setRun({ status: "success", result, totalMs, preprocessMs, fallbackUsed })
      setPhase(isValidTranscript(result) ? "Transcripción local completada" : "Sin texto: prueba otro tramo del audio o una grabación con voz clara")
      recordLocalAIEvent({
        groupId: `whisper-${Date.now()}`,
        kind: "inference",
        backend: result.backend,
        modelId: DEFAULT_LITERT_WHISPER_MODEL_ID,
        latencyMs: totalMs,
        endToEndMs: totalMs,
        preprocessMs,
        modelAcquireMs: result.acquireMs,
        computeMs: result.encodeMs + result.decodeMs,
        readbackMs: 0,
        postprocessMs: result.tokenizerMs,
        runtimeReused: true,
        modelReused: result.modelReused,
        runCount: 1,
        success: true,
        note: `Whisper local · ${result.decodedTokens} tokens · ${result.cacheSource} · tramo ${features.segmentStartSeconds.toFixed(1)}-${features.segmentEndSeconds.toFixed(1)}s${fallbackUsed ? " · fallback local" : ""}`,
      })
    } catch (error) {
      setRun({ status: "error", totalMs: performance.now() - started, error: error instanceof Error ? error.message : "La transcripción local falló." })
      setPhase("")
    }
  }

  async function calibrate() {
    if (!audioBlob || calibrating || run.status === "running") return
    setCalibrating(true)
    setCalibration([])
    try {
      const features = await preparedAudio()
      const capabilities = await probeLiteRTCapabilities()
      const backends: WhisperBackend[] = capabilities.webgpu ? ["wasm", "webgpu"] : ["wasm"]
      const results: CalibrationResult[] = []
      const groupId = `whisper-benchmark-${Date.now()}`
      for (const backend of backends) {
        try {
          const result = await runOnBackend(features, backend, 96)
          const textValid = isValidTranscript(result)
          results.push({
            backend,
            supported: true,
            endToEndMs: result.modelEndToEndMs,
            acquireMs: result.acquireMs,
            text: result.text,
            decodedTokens: result.decodedTokens,
            textValid,
          })
          recordLocalAIEvent({
            groupId,
            kind: "benchmark",
            backend,
            modelId: DEFAULT_LITERT_WHISPER_MODEL_ID,
            latencyMs: result.modelEndToEndMs,
            endToEndMs: result.modelEndToEndMs,
            modelAcquireMs: result.acquireMs,
            computeMs: result.encodeMs + result.decodeMs,
            postprocessMs: result.tokenizerMs,
            runtimeReused: true,
            modelReused: result.modelReused,
            runCount: 1,
            success: textValid,
            note: textValid
              ? `Whisper Router V3 calibration · tramo ${features.segmentStartSeconds.toFixed(1)}-${features.segmentEndSeconds.toFixed(1)}s`
              : "Whisper calibration descartada: la muestra no produjo texto válido",
          })
        } catch (error) {
          results.push({ backend, supported: false, error: error instanceof Error ? error.message : "No compatible" })
        }
      }
      setCalibration(results)
      const valid = results
        .filter(result => result.supported && result.textValid && typeof result.endToEndMs === "number")
        .sort((a, b) => (a.endToEndMs || Infinity) - (b.endToEndMs || Infinity))
      if (valid.length) {
        saveLiteRTRouteProfile({
          modelId: DEFAULT_LITERT_WHISPER_MODEL_ID,
          backend: valid[0].backend,
          medianEndToEndMs: valid[0].endToEndMs!,
          p95EndToEndMs: valid[0].endToEndMs!,
          alternativeMedianEndToEndMs: valid[1]?.endToEndMs ?? null,
        })
        setPhase("Calibración Whisper completada con texto válido")
      } else {
        setPhase("Calibración no guardada: selecciona un tramo que contenga voz y vuelva a probar")
      }
    } catch (error) {
      setRun({ status: "error", error: error instanceof Error ? error.message : "No fue posible calibrar Whisper." })
    } finally {
      setCalibrating(false)
    }
  }

  const prepared = preparedRef.current?.blob === audioBlob && Math.abs(preparedRef.current.segmentStartSeconds - segmentStartSeconds) < 0.01
    ? preparedRef.current.data
    : null
  const sourceDuration = sourceDurationSeconds || prepared?.sourceDurationSeconds || 0
  const maxSegmentStart = Math.max(0, sourceDuration - WHISPER_MAX_SECONDS)
  const segmentEndPreview = Math.min(sourceDuration || segmentStartSeconds + WHISPER_MAX_SECONDS, segmentStartSeconds + WHISPER_MAX_SECONDS)

  return (
    <section className="mt-4 rounded-[30px] border border-sky-400/15 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.10),transparent_30%),linear-gradient(180deg,rgba(4,15,29,0.99),rgba(3,9,20,0.99))] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl"><div className="flex items-center gap-2 text-sky-300"><Waves className="h-4 w-4" /><p className="text-xs font-black uppercase tracking-[0.2em]">Whisper local · ASR v1.1</p></div><h2 className="mt-2 text-2xl font-black text-white">Whisper Tiny INT8 · voz a texto en el navegador</h2><p className="mt-2 text-sm leading-relaxed text-slate-400">Modelo ~{model?.sizeMB || 41.1} MB. Audio mono a 16 kHz, log-Mel de 80×3000, firmas encode/decode y tokenizer Whisper. Máximo {WHISPER_MAX_SECONDS} s por inferencia.</p></div>
        <div className="rounded-2xl border border-emerald-400/15 bg-emerald-950/20 px-4 py-3"><div className="flex items-center gap-2 text-emerald-200"><ShieldCheck className="h-4 w-4" /><span className="text-xs font-black">100% local</span></div><p className="mt-1 text-[10px] text-slate-500">Sin fallback cloud automático</p></div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-[24px] border border-white/10 bg-slate-950/50 p-4">
          <div className="flex items-center gap-2"><Mic className="h-4 w-4 text-sky-300" /><h3 className="text-sm font-black text-white">Entrada de audio</h3></div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => void (recording ? Promise.resolve(stopRecording()) : startRecording())} className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-black ${recording ? "border-red-400/25 bg-red-950/25 text-red-100" : "border-sky-400/20 bg-sky-950/25 text-sky-100"}`}>{recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}{recording ? `Detener · ${recordingSeconds.toFixed(1)} s` : "Grabar micrófono"}</button>
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-3 text-xs font-black text-slate-200"><Upload className="h-4 w-4" />Subir audio<input type="file" accept="audio/*" className="sr-only" onChange={event => { const file = event.target.files?.[0]; if (file) replaceAudio(file) }} /></label>
          </div>

          {audioBlob ? <div className="mt-4 rounded-2xl border border-white/5 bg-black/20 p-3">
            <div className="flex items-center gap-2 text-xs text-slate-300"><FileAudio className="h-4 w-4 text-sky-300" /><span className="font-black">Audio listo</span></div>
            {audioUrl ? <audio controls src={audioUrl} className="mt-3 w-full" onLoadedMetadata={event => {
              const duration = event.currentTarget.duration
              if (Number.isFinite(duration) && duration > 0) {
                setSourceDurationSeconds(duration)
                const maxStart = Math.max(0, duration - WHISPER_MAX_SECONDS)
                if (segmentStartSeconds > maxStart) setSegmentStartSeconds(maxStart)
              }
            }} /> : null}
            <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
              <div className="rounded-xl bg-black/20 p-2"><span className="text-slate-600">Archivo</span><p className="mt-1 font-black text-slate-300">{sourceDuration ? formatSeconds(sourceDuration) : "leyendo duración…"}</p></div>
              <div className="rounded-xl bg-black/20 p-2"><span className="text-slate-600">Ruta V3</span><p className="mt-1 font-black text-slate-300">{routeProfile ? `${routeProfile.backend.toUpperCase()} · ${formatMs(routeProfile.medianEndToEndMs)}` : "sin calibrar"}</p></div>
            </div>
            {sourceDuration > WHISPER_MAX_SECONDS ? <div className="mt-3 rounded-xl border border-amber-400/15 bg-amber-950/15 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[10px] font-black text-amber-100">Tramo usado por Whisper: {segmentStartSeconds.toFixed(1)}–{segmentEndPreview.toFixed(1)} s</p><div className="flex gap-1.5"><button type="button" onClick={() => updateSegmentStart(0)} className="rounded-lg border border-white/10 px-2 py-1 text-[9px] font-black text-slate-300">Inicio</button><button type="button" onClick={() => updateSegmentStart(maxSegmentStart)} className="rounded-lg border border-white/10 px-2 py-1 text-[9px] font-black text-slate-300">Final</button></div></div>
              <input type="range" min={0} max={maxSegmentStart} step={0.5} value={Math.min(segmentStartSeconds, maxSegmentStart)} onChange={event => updateSegmentStart(Number(event.target.value))} className="mt-3 w-full accent-cyan-400" />
              <p className="mt-2 text-[9px] leading-4 text-amber-100/60">El archivo es mayor a 30 s. Cambia este tramo si la voz que quieres transcribir está en otra parte del audio.</p>
            </div> : null}
            {prepared ? <p className="mt-2 text-[9px] text-slate-600">Procesado: {formatSeconds(prepared.durationSeconds)} · {prepared.validFrames} frames válidos</p> : null}
          </div> : <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-5 text-center text-xs text-slate-600">Graba una frase o selecciona un archivo de audio.</div>}

          <div className="mt-4 grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => void transcribe()} disabled={!audioBlob || recording || run.status === "preparing" || run.status === "running" || calibrating} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-950/25 px-4 py-3 text-xs font-black text-emerald-100 disabled:opacity-40">{run.status === "preparing" || run.status === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}Transcribir local</button><button type="button" onClick={() => void calibrate()} disabled={!audioBlob || recording || calibrating || run.status === "running"} className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-400/20 bg-violet-950/25 px-4 py-3 text-xs font-black text-violet-100 disabled:opacity-40">{calibrating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gauge className="h-4 w-4" />}Calibrar WASM/WebGPU</button></div>
          {phase ? <p className="mt-3 text-[10px] font-bold text-sky-200/70">{phase}</p> : null}
        </div>

        <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Resultado</p><h3 className="mt-1 text-lg font-black text-white">Transcripción</h3></div>{run.result ? <div className="flex gap-1.5"><span className="rounded-full bg-emerald-950/40 px-2.5 py-1 text-[10px] font-black text-emerald-200">{run.result.backend.toUpperCase()}</span><span className="rounded-full bg-slate-950/60 px-2.5 py-1 text-[10px] font-black text-slate-300">{run.result.modelReused ? "POOL HIT" : run.result.cacheHit ? "CACHE HIT" : run.result.cacheSource.toUpperCase()}</span></div> : null}</div>
          {run.status === "success" && run.result ? <>
            <div className="mt-4 min-h-32 rounded-2xl border border-emerald-400/10 bg-emerald-950/15 p-4 text-sm leading-6 text-slate-100">{run.result.text || <span className="text-slate-500">Whisper no detectó texto en este tramo. Si el archivo supera 30 s, mueve el selector hacia una zona con voz.</span>}</div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{[["Preproceso", formatMs(run.preprocessMs)], ["Modelo", formatMs(run.result.modelEndToEndMs)], ["Encoder", formatMs(run.result.encodeMs)], ["Decoder", formatMs(run.result.decodeMs)], ["Adquirir", formatMs(run.result.acquireMs)], ["Tokenizer", formatMs(run.result.tokenizerMs)], ["Tokens", `${run.result.decodedTokens}`], ["Total real", formatMs(run.totalMs)]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-950/55 p-2.5"><p className="text-[9px] uppercase text-slate-600">{label}</p><p className="mt-1 text-xs font-black text-white">{value}</p></div>)}</div>
            {run.fallbackUsed ? <p className="mt-3 rounded-xl border border-amber-400/15 bg-amber-950/20 p-3 text-[10px] text-amber-100">El backend preferido falló; EduAI usó el otro backend local. El audio no salió del navegador.</p> : null}
            <details className="mt-3 rounded-xl border border-white/5 bg-slate-950/40 p-3 text-[10px] text-slate-500"><summary className="cursor-pointer font-black text-slate-300">Firmas LiteRT detectadas</summary><div className="mt-2 space-y-1"><p>encode in: {run.result.encodeInputs.map(item => `${item.name} [${item.shape.join("×")}] ${item.dtype}`).join(" · ")}</p><p>encode out: {run.result.encodeOutputs.map(item => `${item.name} [${item.shape.join("×")}] ${item.dtype}`).join(" · ")}</p><p>decode in: {run.result.decodeInputs.map(item => `${item.name} [${item.shape.join("×")}] ${item.dtype}`).join(" · ")}</p><p>decode out: {run.result.decodeOutputs.map(item => `${item.name} [${item.shape.join("×")}] ${item.dtype}`).join(" · ")}</p><p>token ids: {run.result.tokenIds.slice(0, 12).join(", ") || "ninguno"}</p></div></details>
          </> : run.status === "error" ? <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-950/20 p-4 text-xs leading-5 text-amber-100">{run.error}</div> : <div className="mt-4 grid min-h-52 place-items-center rounded-2xl border border-dashed border-white/10 text-center text-xs text-slate-600">La transcripción aparecerá aquí.</div>}
        </div>
      </div>

      {calibration.length ? <div className="mt-4 rounded-[24px] border border-violet-400/15 bg-violet-950/15 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-black text-violet-100">Calibración Router V3 · Whisper</p><p className="mt-1 text-[10px] text-slate-500">Solo se guarda un perfil si el backend produce texto válido con esta muestra.</p></div>{routeProfile ? <span className="rounded-full bg-emerald-950/35 px-3 py-1 text-[10px] font-black text-emerald-200">Perfil actual: {routeProfile.backend.toUpperCase()}</span> : null}</div><div className="mt-3 grid gap-2 sm:grid-cols-2">{calibration.map(item => <div key={item.backend} className="rounded-2xl border border-white/5 bg-black/20 p-3"><div className="flex items-center justify-between"><span className="text-xs font-black text-white">{item.backend.toUpperCase()}</span><span className={`text-[10px] font-black ${item.supported && item.textValid ? "text-emerald-300" : "text-amber-300"}`}>{!item.supported ? "No compatible" : item.textValid ? formatMs(item.endToEndMs) : "Sin texto válido"}</span></div>{item.supported ? <p className="mt-1 text-[10px] text-slate-500">Adquisición {formatMs(item.acquireMs)} · {item.decodedTokens || 0} tokens</p> : <p className="mt-2 text-[10px] leading-4 text-slate-500">{item.error}</p>}</div>)}</div></div> : null}
    </section>
  )
}
