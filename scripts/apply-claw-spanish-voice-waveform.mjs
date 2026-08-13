import { readFileSync, writeFileSync } from "node:fs"

const MARKER = "CLAW_SPANISH_VOICE_WAVEFORM_V1"

function load(path) {
  return readFileSync(path, "utf8")
}

function save(path, source) {
  writeFileSync(path, source)
}

function replaceOnce(source, from, to, label) {
  if (!source.includes(from)) {
    throw new Error(`[claw-voice] No se encontró ${label}`)
  }
  return source.replace(from, to)
}

function replaceBetween(source, start, end, replacement, label) {
  const startIndex = source.indexOf(start)
  if (startIndex < 0) throw new Error(`[claw-voice] No se encontró inicio de ${label}`)
  const endIndex = source.indexOf(end, startIndex)
  if (endIndex < 0) throw new Error(`[claw-voice] No se encontró final de ${label}`)
  return source.slice(0, startIndex) + replacement + source.slice(endIndex)
}

function patchClaw() {
  const path = "components/dashboard/ClawStudyConsole.tsx"
  let source = load(path)
  if (source.includes(MARKER)) return

  source = replaceOnce(
    source,
    "  Loader2,\n  Mic,\n  PenLine,",
    "  Loader2,\n  Mic,\n  Check,\n  X,\n  PenLine,",
    "iconos de voz",
  )

  source = replaceOnce(
    source,
    'const MAX_RECORDING_SECONDS = 90',
    `const MAX_RECORDING_SECONDS = 90\nconst WAVEFORM_BAR_COUNT = 44\nconst WAVEFORM_SAMPLE_MS = 64\n// ${MARKER}`,
    "constantes de grabación",
  )

  source = replaceOnce(
    source,
    `  const [voiceError, setVoiceError] = useState("")\n  const inputRef = useRef<HTMLTextAreaElement>(null)\n  const transcriptRef = useRef<HTMLDivElement>(null)\n  const mediaRecorderRef = useRef<MediaRecorder | null>(null)\n  const mediaStreamRef = useRef<MediaStream | null>(null)\n  const recordingChunksRef = useRef<Blob[]>([])\n  const recordingTimerRef = useRef<number | null>(null)\n  const recordingStartedAtRef = useRef(0)`,
    `  const [voiceError, setVoiceError] = useState("")\n  const [waveform, setWaveform] = useState<number[]>(() => Array(WAVEFORM_BAR_COUNT).fill(0.12))\n  const inputRef = useRef<HTMLTextAreaElement>(null)\n  const transcriptRef = useRef<HTMLDivElement>(null)\n  const mediaRecorderRef = useRef<MediaRecorder | null>(null)\n  const mediaStreamRef = useRef<MediaStream | null>(null)\n  const recordingChunksRef = useRef<Blob[]>([])\n  const recordingTimerRef = useRef<number | null>(null)\n  const recordingStartedAtRef = useRef(0)\n  const audioContextRef = useRef<AudioContext | null>(null)\n  const analyserRef = useRef<AnalyserNode | null>(null)\n  const waveformFrameRef = useRef<number | null>(null)\n  const waveformLastSampleRef = useRef(0)\n  const recordingDecisionRef = useRef<"transcribe" | "discard">("transcribe")`,
    "refs del micrófono",
  )

  source = replaceOnce(
    source,
    `  useEffect(() => {\n    return () => {\n      if (recordingTimerRef.current !== null) window.clearInterval(recordingTimerRef.current)\n      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop()\n      mediaStreamRef.current?.getTracks().forEach((track) => track.stop())\n    }\n  }, [])`,
    `  useEffect(() => {\n    return () => {\n      recordingDecisionRef.current = "discard"\n      if (recordingTimerRef.current !== null) window.clearInterval(recordingTimerRef.current)\n      if (waveformFrameRef.current !== null) window.cancelAnimationFrame(waveformFrameRef.current)\n      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop()\n      mediaStreamRef.current?.getTracks().forEach((track) => track.stop())\n      void audioContextRef.current?.close().catch(() => {})\n    }\n  }, [])`,
    "cleanup de grabación",
  )

  source = replaceOnce(
    source,
    `          mode: "pro",\n          improveAudio: false,\n          preciseSubtitles: false,\n          diarize: false,\n          detectLanguage: true,\n          createSummary: false,`,
    `          mode: "pro",\n          improveAudio: false,\n          preciseSubtitles: false,\n          diarize: false,\n          detectLanguage: false,\n          language: "es",\n          transcriptionPrompt:\n            "Transcribe fielmente este mensaje corto hablado en español de Chile o español latinoamericano. Mantén nombres propios, términos educativos, matemáticos y científicos. Usa puntuación natural. No traduzcas, no cambies de idioma y no inventes palabras si el audio es tenue.",\n          createSummary: false,`,
    "configuración de transcripción",
  )

  source = replaceBetween(
    source,
    `  const stopRecording = () => {`,
    `\n\n  const handleCreateAction`,
    `  const stopWaveform = () => {\n    if (waveformFrameRef.current !== null) {\n      window.cancelAnimationFrame(waveformFrameRef.current)\n      waveformFrameRef.current = null\n    }\n    analyserRef.current = null\n    if (audioContextRef.current) {\n      void audioContextRef.current.close().catch(() => {})\n      audioContextRef.current = null\n    }\n    waveformLastSampleRef.current = 0\n    setWaveform(Array(WAVEFORM_BAR_COUNT).fill(0.12))\n  }\n\n  const startWaveform = (stream: MediaStream) => {\n    try {\n      const audioContext = new AudioContext()\n      const sourceNode = audioContext.createMediaStreamSource(stream)\n      const analyser = audioContext.createAnalyser()\n      analyser.fftSize = 512\n      analyser.smoothingTimeConstant = 0.72\n      sourceNode.connect(analyser)\n      audioContextRef.current = audioContext\n      analyserRef.current = analyser\n      waveformLastSampleRef.current = 0\n      setWaveform(Array(WAVEFORM_BAR_COUNT).fill(0.12))\n\n      const samples = new Uint8Array(analyser.fftSize)\n      const draw = (time: number) => {\n        const currentAnalyser = analyserRef.current\n        if (!currentAnalyser) return\n\n        if (time - waveformLastSampleRef.current >= WAVEFORM_SAMPLE_MS) {\n          currentAnalyser.getByteTimeDomainData(samples)\n          let energy = 0\n          for (let index = 0; index < samples.length; index += 1) {\n            const centered = (samples[index] - 128) / 128\n            energy += centered * centered\n          }\n          const rms = Math.sqrt(energy / samples.length)\n          const level = Math.max(0.08, Math.min(1, rms * 7.2))\n          setWaveform((current) => [...current.slice(1), level])\n          waveformLastSampleRef.current = time\n        }\n\n        waveformFrameRef.current = window.requestAnimationFrame(draw)\n      }\n\n      waveformFrameRef.current = window.requestAnimationFrame(draw)\n    } catch {\n      // La grabación sigue funcionando aunque Web Audio no esté disponible.\n    }\n  }\n\n  const cleanupRecordingHardware = () => {\n    if (recordingTimerRef.current !== null) {\n      window.clearInterval(recordingTimerRef.current)\n      recordingTimerRef.current = null\n    }\n    mediaStreamRef.current?.getTracks().forEach((track) => track.stop())\n    mediaStreamRef.current = null\n    mediaRecorderRef.current = null\n    stopWaveform()\n  }\n\n  const finishRecording = (decision: "transcribe" | "discard") => {\n    const recorder = mediaRecorderRef.current\n    if (!recorder || recorder.state !== "recording") return\n    recordingDecisionRef.current = decision\n    recorder.stop()\n  }\n\n  const cancelRecording = () => finishRecording("discard")\n  const confirmRecording = () => finishRecording("transcribe")\n\n  const startRecording = async () => {\n    if (voiceState === "recording") {\n      confirmRecording()\n      return\n    }\n    if (voiceState === "transcribing" || loading) return\n\n    setVoiceError("")\n    setToolsOpen(false)\n\n    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {\n      setVoiceError("Este navegador no permite grabar audio desde el chat.")\n      return\n    }\n\n    let stream: MediaStream | null = null\n    try {\n      stream = await navigator.mediaDevices.getUserMedia({\n        audio: {\n          echoCancellation: true,\n          noiseSuppression: true,\n          autoGainControl: true,\n          channelCount: 1,\n          sampleRate: 48000,\n        },\n      })\n\n      const mimeType = getRecordingMimeType()\n      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)\n      mediaStreamRef.current = stream\n      mediaRecorderRef.current = recorder\n      recordingChunksRef.current = []\n      recordingDecisionRef.current = "transcribe"\n      recordingStartedAtRef.current = Date.now()\n      setRecordingSeconds(0)\n      setWaveform(Array(WAVEFORM_BAR_COUNT).fill(0.12))\n      setVoiceState("recording")\n\n      recorder.ondataavailable = (event) => {\n        if (event.data.size > 0) recordingChunksRef.current.push(event.data)\n      }\n\n      recorder.onerror = () => {\n        setVoiceError("La grabación se interrumpió. Revisa el permiso del micrófono e inténtalo otra vez.")\n      }\n\n      recorder.onstop = async () => {\n        const chunks = recordingChunksRef.current\n        recordingChunksRef.current = []\n        const recordedMime = recorder.mimeType || mimeType || "audio/webm"\n        const audioBlob = new Blob(chunks, { type: recordedMime })\n        const decision = recordingDecisionRef.current\n\n        cleanupRecordingHardware()\n\n        if (decision === "discard") {\n          setVoiceState("idle")\n          setRecordingSeconds(0)\n          return\n        }\n\n        setVoiceState("transcribing")\n        try {\n          await transcribeRecording(audioBlob, recordedMime)\n        } catch (error) {\n          setVoiceError(error instanceof Error ? error.message : "No se pudo transcribir la grabación.")\n        } finally {\n          setVoiceState("idle")\n          setRecordingSeconds(0)\n        }\n      }\n\n      recorder.start(200)\n      startWaveform(stream)\n      recordingTimerRef.current = window.setInterval(() => {\n        const elapsed = Math.floor((Date.now() - recordingStartedAtRef.current) / 1000)\n        setRecordingSeconds(elapsed)\n        if (elapsed >= MAX_RECORDING_SECONDS && mediaRecorderRef.current?.state === "recording") {\n          recordingDecisionRef.current = "transcribe"\n          mediaRecorderRef.current.stop()\n        }\n      }, 250)\n    } catch (error) {\n      stream?.getTracks().forEach((track) => track.stop())\n      stopWaveform()\n      setVoiceState("idle")\n      setVoiceError(\n        error instanceof DOMException && error.name === "NotAllowedError"\n          ? "Necesito permiso para usar el micrófono. Habilítalo en el navegador y vuelve a intentarlo."\n          : "No pude acceder al micrófono. Revisa que esté conectado y disponible.",\n      )\n    }\n  }`,
    "lógica de grabación",
  )

  source = replaceOnce(
    source,
    `              voiceState === "recording"\n                ? "Te escucho… pulsa el micrófono otra vez para terminar."`,
    `              voiceState === "recording"\n                ? "Te escucho… confirma con ✓ cuando termines o cancela con ×."`,
    "placeholder de grabación",
  )

  source = replaceBetween(
    source,
    `              <button\n                type="button"\n                onClick={startRecording}`,
    `\n\n            <button\n              type="button"\n              onClick={() => send()}`,
    `              <button\n                type="button"\n                onClick={startRecording}\n                disabled={voiceState === "transcribing" || (loading && voiceState !== "recording")}\n                className={\`relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-transparent transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-40 lg:h-10 lg:w-10 min-[2048px]:h-11 min-[2048px]:w-11 \${\n                  voiceState === "recording"\n                    ? "text-red-500"\n                    : "text-muted2 hover:text-blue-600"\n                }\`}\n                aria-label={voiceState === "recording" ? "Finalizar grabación" : "Dictar mensaje por voz"}\n                title={voiceState === "recording" ? "Finalizar y transcribir" : "Dictar por voz"}\n              >\n                {voiceState === "recording" && (\n                  <span className="absolute inset-1 rounded-full border border-red-300/80 motion-safe:animate-ping" />\n                )}\n                {voiceState === "transcribing" ? (\n                  <Loader2 size={19} className="animate-spin min-[2048px]:h-5 min-[2048px]:w-5" />\n                ) : (\n                  <Mic size={20} strokeWidth={2.1} className="relative min-[2048px]:h-[22px] min-[2048px]:w-[22px]" />\n                )}\n              </button>\n\n              {voiceState === "recording" && (\n                <div\n                  className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full border border-slate-200 bg-white/85 px-2 py-1 shadow-sm backdrop-blur-sm lg:gap-2 lg:px-2.5 dark:border-slate-700 dark:bg-slate-900/75"\n                  aria-label={\`Grabando \${formatRecordingTime(recordingSeconds)}\`}\n                >\n                  <span className="hidden shrink-0 text-[9px] font-bold tabular-nums text-red-500 sm:inline lg:text-[10px] min-[2048px]:text-[11px]">\n                    {formatRecordingTime(recordingSeconds)}\n                  </span>\n                  <div className="flex h-7 min-w-[72px] flex-1 items-center justify-end gap-[2px] overflow-hidden sm:min-w-[110px] lg:h-8 lg:min-w-[150px] min-[2048px]:min-w-[210px]" aria-hidden="true">\n                    {waveform.map((level, index) => (\n                      <span\n                        key={index}\n                        className="w-[2px] shrink-0 rounded-full bg-slate-500/80 transition-[height,opacity] duration-75 dark:bg-slate-300/80 lg:w-[3px]"\n                        style={{\n                          height: \`\${Math.max(4, Math.round(level * 27))}px\`,\n                          opacity: 0.34 + level * 0.66,\n                        }}\n                      />\n                    ))}\n                  </div>\n                  <button\n                    type="button"\n                    onClick={cancelRecording}\n                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white lg:h-8 lg:w-8"\n                    aria-label="Cancelar grabación"\n                    title="Cancelar"\n                  >\n                    <X size={17} strokeWidth={2.2} />\n                  </button>\n                  <button\n                    type="button"\n                    onClick={confirmRecording}\n                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-emerald-600 transition hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 dark:hover:bg-emerald-950/40 lg:h-8 lg:w-8"\n                    aria-label="Aceptar grabación y transcribir"\n                    title="Aceptar y transcribir"\n                  >\n                    <Check size={18} strokeWidth={2.4} />\n                  </button>\n                </div>\n              )}\n\n              {voiceState === "transcribing" && (\n                <span className="truncate text-[10px] font-semibold text-blue-600 lg:text-[11px] min-[2048px]:text-xs">\n                  Transcribiendo en español…\n                </span>\n              )}\n              {voiceState === "idle" && voiceError && (\n                <span className="max-w-[230px] truncate text-[10px] text-red-500 lg:max-w-[360px] lg:text-[11px] min-[2048px]:max-w-[520px] min-[2048px]:text-xs" title={voiceError}>\n                  {voiceError}\n                </span>\n              )}`,
    "interfaz de onda de voz",
  )

  save(path, source)
}

function patchAudioTypes() {
  const path = "lib/audio/types.ts"
  let source = load(path)
  if (source.includes("transcriptionPrompt?:")) return

  source = replaceOnce(
    source,
    `  detectLanguage?:  boolean\n  speakerLabels?:   string[]`,
    `  detectLanguage?:  boolean\n  language?:        string\n  transcriptionPrompt?: string\n  speakerLabels?:   string[]`,
    "opciones de idioma del pipeline",
  )
  save(path, source)
}

function patchAudioPipeline() {
  const path = "lib/audio/pipeline.ts"
  let source = load(path)
  if (source.includes("options.transcriptionPrompt.slice")) return

  source = replaceOnce(
    source,
    `    detectLanguage:  options?.detectLanguage !== false,\n    speakerLabels:   options?.speakerLabels  || [],`,
    `    detectLanguage:  options?.detectLanguage !== false,\n    language:        String(options?.language || "").trim().toLowerCase(),\n    transcriptionPrompt: String(options?.transcriptionPrompt || "").trim(),\n    speakerLabels:   options?.speakerLabels  || [],`,
    "normalización de idioma",
  )

  source = replaceOnce(
    source,
    `  formData.append("temperature", "0")`,
    `  formData.append("temperature", "0")\n  if (options.language) formData.append("language", options.language.slice(0, 8))\n  if (options.transcriptionPrompt) formData.append("prompt", options.transcriptionPrompt.slice(0, 900))`,
    "idioma y prompt de Whisper",
  )

  source = replaceOnce(
    source,
    `OBJETIVO:\n- Entregar transcripción completa y exacta`,
    `OBJETIVO:\n- Entregar transcripción completa y exacta\n- Idioma esperado: ${"${options.language || \"detección automática\"}"}. Si se indicó un idioma, no traduzcas ni cambies a otro idioma.\n- Contexto de transcripción: ${"${options.transcriptionPrompt || \"sin contexto adicional\"}"}\n- Entregar el texto hablado, no una traducción`,
    "fallback de Gemini con idioma",
  )

  save(path, source)
}

patchClaw()
patchAudioTypes()
patchAudioPipeline()
console.log("[claw-voice] dictado en español + onda de voz en tiempo real aplicados")
