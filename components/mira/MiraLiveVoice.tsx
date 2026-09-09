"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { HeartHandshake, Loader2, Mic2, MicOff, PhoneOff, ShieldCheck, Sparkles, Volume2, X } from "lucide-react"

type VoicePhase = "idle" | "requesting" | "listening" | "processing" | "speaking" | "error"
type HistoryItem = { role: "user" | "assistant"; content: string }
type VoiceTurn = { id: string; user: string; assistant: string }

type VoiceResponse = {
  original?: string
  responseText?: string
  audioBase64?: string
  audioMime?: string
  error?: string
}

const PHASE_LABEL: Record<VoicePhase, string> = {
  idle: "Toca el micrófono para conversar",
  requesting: "Activando micrófono…",
  listening: "MIRA te escucha…",
  processing: "MIRA está pensando…",
  speaking: "MIRA está respondiendo…",
  error: "No pude continuar",
}

function supportedMimeType() {
  if (typeof MediaRecorder === "undefined") return ""
  return ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find((type) => MediaRecorder.isTypeSupported(type)) || ""
}

function browserSpeak(text: string, onEnd: () => void) {
  if (!("speechSynthesis" in window)) {
    onEnd()
    return
  }

  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = "es-CL"
  utterance.rate = 0.94
  utterance.pitch = 1.02

  const voices = window.speechSynthesis.getVoices()
  const preferredNames = ["catalina", "paulina", "monica", "helena", "sabina", "elvira"]
  const preferred = voices.find((voice) => {
    const name = voice.name.toLowerCase()
    const lang = voice.lang.toLowerCase()
    return (lang.startsWith("es-cl") || lang.startsWith("es")) && preferredNames.some((candidate) => name.includes(candidate))
  }) || voices.find((voice) => voice.lang.toLowerCase().startsWith("es-cl"))
    || voices.find((voice) => voice.lang.toLowerCase().startsWith("es"))

  if (preferred) utterance.voice = preferred
  utterance.onend = onEnd
  utterance.onerror = onEnd
  window.speechSynthesis.speak(utterance)
}

export default function MiraLiveVoice() {
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<VoicePhase>("idle")
  const [turns, setTurns] = useState<VoiceTurn[]>([])
  const [error, setError] = useState("")
  const [autoContinue, setAutoContinue] = useState(true)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const maxRecordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const speechStartedRef = useRef(false)
  const lastSoundAtRef = useRef(0)
  const openRef = useRef(false)
  const autoContinueRef = useRef(true)
  const historyRef = useRef<HistoryItem[]>([])
  const beginListeningRef = useRef<() => Promise<void>>(async () => {})

  useEffect(() => { openRef.current = open }, [open])
  useEffect(() => { autoContinueRef.current = autoContinue }, [autoContinue])

  const clearTimers = useCallback(() => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current)
    animationFrameRef.current = null
    if (maxRecordingTimerRef.current) clearTimeout(maxRecordingTimerRef.current)
    maxRecordingTimerRef.current = null
  }, [])

  const releaseMicrophone = useCallback(() => {
    clearTimers()
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined)
      audioContextRef.current = null
    }
  }, [clearTimers])

  const stopEverything = useCallback(() => {
    const recorder = recorderRef.current
    recorderRef.current = null
    if (recorder?.state === "recording") {
      recorder.onstop = null
      recorder.stop()
    }
    releaseMicrophone()
    audioRef.current?.pause()
    audioRef.current = null
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel()
  }, [releaseMicrophone])

  useEffect(() => () => stopEverything(), [stopEverything])

  const resumeAfterSpeech = useCallback(() => {
    audioRef.current = null
    if (!openRef.current) return
    setPhase("idle")
    if (autoContinueRef.current) {
      window.setTimeout(() => {
        if (openRef.current) void beginListeningRef.current()
      }, 500)
    }
  }, [])

  const playResponse = useCallback((data: VoiceResponse) => {
    const text = String(data.responseText || "").trim()
    if (!text) {
      setPhase("idle")
      return
    }

    setPhase("speaking")
    if (data.audioBase64) {
      const audio = new Audio(`data:${data.audioMime || "audio/mpeg"};base64,${data.audioBase64}`)
      audioRef.current = audio
      audio.onended = resumeAfterSpeech
      audio.onerror = () => browserSpeak(text, resumeAfterSpeech)
      void audio.play().catch(() => browserSpeak(text, resumeAfterSpeech))
      return
    }
    browserSpeak(text, resumeAfterSpeech)
  }, [resumeAfterSpeech])

  const processAudio = useCallback(async (blob: Blob) => {
    if (blob.size < 900) {
      setPhase("idle")
      return
    }

    setPhase("processing")
    setError("")

    try {
      const formData = new FormData()
      const extension = blob.type.includes("ogg") ? "ogg" : "webm"
      formData.append("audio", blob, `mira-voice.${extension}`)
      if (historyRef.current.length) formData.append("history", JSON.stringify(historyRef.current))

      const response = await fetch("/api/agents/mira/voice", { method: "POST", body: formData })
      const data = (await response.json().catch(() => ({}))) as VoiceResponse
      if (!response.ok) throw new Error(data.error || "No se pudo procesar la conversación.")
      if (!openRef.current) return

      const original = String(data.original || "").trim()
      const reply = String(data.responseText || "").trim()
      if (!original || !reply) throw new Error("MIRA no recibió una conversación válida.")

      const turn: VoiceTurn = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        user: original,
        assistant: reply,
      }
      setTurns((current) => [...current, turn].slice(-6))
      historyRef.current = [
        ...historyRef.current,
        { role: "user", content: original },
        { role: "assistant", content: reply },
      ].slice(-10) as HistoryItem[]

      playResponse(data)
    } catch (cause) {
      if (!openRef.current) return
      setError(cause instanceof Error ? cause.message : "No se pudo procesar la conversación.")
      setPhase("error")
    }
  }, [playResponse])

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state !== "recording") return
    clearTimers()
    recorder.stop()
  }, [clearTimers])

  const monitorSilence = useCallback((stream: MediaStream) => {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return

    const context = new AudioContextClass()
    audioContextRef.current = context
    const analyser = context.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0.7
    context.createMediaStreamSource(stream).connect(analyser)
    const samples = new Uint8Array(analyser.fftSize)

    speechStartedRef.current = false
    lastSoundAtRef.current = performance.now()

    const tick = () => {
      const recorder = recorderRef.current
      if (!recorder || recorder.state !== "recording") return

      analyser.getByteTimeDomainData(samples)
      let sum = 0
      for (const sample of samples) {
        const normalized = (sample - 128) / 128
        sum += normalized * normalized
      }
      const rms = Math.sqrt(sum / samples.length)
      const now = performance.now()

      if (rms > 0.028) {
        speechStartedRef.current = true
        lastSoundAtRef.current = now
      } else if (speechStartedRef.current && now - lastSoundAtRef.current > 1250) {
        stopRecording()
        return
      }

      animationFrameRef.current = requestAnimationFrame(tick)
    }

    animationFrameRef.current = requestAnimationFrame(tick)
  }, [stopRecording])

  const beginListening = useCallback(async () => {
    if (!openRef.current || phase === "requesting" || phase === "listening" || phase === "processing") return

    stopEverything()
    setError("")
    setPhase("requesting")

    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("Este navegador no permite conversación de voz en vivo.")
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      if (!openRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      streamRef.current = stream
      chunksRef.current = []
      const mimeType = supportedMimeType()
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      recorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" })
        recorderRef.current = null
        releaseMicrophone()
        if (openRef.current) void processAudio(blob)
      }
      recorder.onerror = () => {
        recorderRef.current = null
        releaseMicrophone()
        if (openRef.current) {
          setError("El micrófono se interrumpió.")
          setPhase("error")
        }
      }

      recorder.start(250)
      setPhase("listening")
      monitorSilence(stream)
      maxRecordingTimerRef.current = setTimeout(stopRecording, 25000)
    } catch (cause) {
      releaseMicrophone()
      setError(cause instanceof Error ? cause.message : "No pude acceder al micrófono.")
      setPhase("error")
    }
  }, [monitorSilence, phase, processAudio, releaseMicrophone, stopEverything, stopRecording])

  useEffect(() => { beginListeningRef.current = beginListening }, [beginListening])

  const openConversation = () => {
    openRef.current = true
    setOpen(true)
    setError("")
    setPhase("idle")
    window.setTimeout(() => void beginListeningRef.current(), 50)
  }

  const closeConversation = () => {
    openRef.current = false
    setOpen(false)
    setPhase("idle")
    stopEverything()
  }

  const resetConversation = () => {
    historyRef.current = []
    setTurns([])
    setError("")
    setPhase("idle")
  }

  const busy = phase === "requesting" || phase === "processing" || phase === "speaking"

  return (
    <>
      <button
        type="button"
        onClick={openConversation}
        className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-3 py-2 text-xs font-bold text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-400/15"
      >
        <Mic2 className="h-4 w-4" />
        Conversación de voz
      </button>

      {open ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/90 p-3 backdrop-blur-xl sm:p-6">
          <section className="relative flex h-[min(820px,94dvh)] w-full max-w-5xl flex-col overflow-hidden rounded-[34px] border border-cyan-300/15 bg-slate-950 text-white shadow-2xl shadow-cyan-950/40">
            <header className="flex items-center justify-between gap-4 border-b border-white/10 bg-gradient-to-r from-cyan-500/10 via-violet-500/10 to-emerald-500/10 px-5 py-4 sm:px-7">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-200">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black">MIRA · Conversación de voz</p>
                  <p className="truncate text-xs text-slate-400">Asistente general y apoyo conversacional</p>
                </div>
              </div>
              <button type="button" onClick={closeConversation} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white" aria-label="Cerrar conversación de voz">
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_330px]">
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 py-8 text-center sm:px-8">
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-400/[0.06] px-3 py-1.5 text-[11px] font-bold text-emerald-200">
                  <HeartHandshake className="h-4 w-4" /> Conversación profesional, cercana y sin juicios
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (phase === "listening") stopRecording()
                    else if (!busy) void beginListening()
                  }}
                  disabled={busy}
                  className={`relative flex h-40 w-40 items-center justify-center rounded-full border shadow-[0_0_80px_rgba(34,211,238,0.18)] transition sm:h-48 sm:w-48 ${phase === "listening" ? "border-rose-300/40 bg-gradient-to-br from-rose-500 to-violet-600" : "border-cyan-300/30 bg-gradient-to-br from-cyan-400 via-sky-500 to-violet-600"} disabled:cursor-default`}
                  aria-label={phase === "listening" ? "Terminar de hablar" : "Hablar con MIRA"}
                >
                  <span className={`absolute inset-0 rounded-full border border-white/20 ${phase === "listening" ? "animate-ping" : "animate-pulse"}`} />
                  {phase === "requesting" || phase === "processing" ? <Loader2 className="h-16 w-16 animate-spin text-white" /> : phase === "listening" ? <MicOff className="h-16 w-16 text-white" /> : phase === "speaking" ? <Volume2 className="h-16 w-16 text-white" /> : <Mic2 className="h-16 w-16 text-white" />}
                </button>

                <h2 className="mt-7 text-2xl font-black tracking-tight sm:text-3xl">{PHASE_LABEL[phase]}</h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
                  Puedes hablar de cómo te sientes o de cualquier otro tema. MIRA escucha, responde y mantiene el contexto de la conversación.
                </p>

                {error ? <div className="mt-5 max-w-xl rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}

                <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
                  <button type="button" onClick={() => setAutoContinue((value) => !value)} className={`rounded-xl border px-3 py-2 text-xs font-bold ${autoContinue ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-white/5 text-slate-400"}`}>
                    {autoContinue ? "Conversación continua: sí" : "Conversación continua: no"}
                  </button>
                  <button type="button" onClick={resetConversation} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-400 hover:text-white">Nueva conversación</button>
                  <button type="button" onClick={closeConversation} className="inline-flex items-center gap-2 rounded-xl border border-rose-300/15 bg-rose-400/[0.07] px-3 py-2 text-xs font-bold text-rose-200">
                    <PhoneOff className="h-4 w-4" /> Finalizar
                  </button>
                </div>
              </div>

              <aside className="min-h-0 border-t border-white/10 bg-white/[0.025] p-5 lg:border-l lg:border-t-0 sm:p-6">
                <div className="flex items-center gap-2 text-emerald-200"><ShieldCheck className="h-4 w-4" /><p className="text-xs font-black uppercase tracking-[0.14em]">Cómo conversa MIRA</p></div>
                <p className="mt-3 text-xs leading-6 text-slate-400">Puede conversar de estudio, trabajo, relaciones, decisiones, ideas, ciencia, tecnología o temas personales. En conversaciones emocionales escucha y ayuda a ordenar lo que estás viviendo sin presentarse como terapeuta.</p>

                <div className="mt-5 min-h-0 space-y-3 overflow-y-auto lg:max-h-[520px]">
                  {turns.length ? turns.map((turn) => (
                    <div key={turn.id} className="space-y-2">
                      <div className="ml-7 rounded-2xl bg-cyan-400 px-3 py-2 text-xs leading-5 text-slate-950">{turn.user}</div>
                      <div className="mr-7 rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs leading-5 text-slate-200">{turn.assistant}</div>
                    </div>
                  )) : (
                    <div className="rounded-2xl border border-dashed border-white/10 p-4 text-xs leading-6 text-slate-500">
                      La transcripción breve de esta conversación aparecerá aquí mientras mantengas abierta esta ventana.
                    </div>
                  )}
                </div>
              </aside>
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}
