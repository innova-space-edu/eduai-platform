"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowRightLeft, Languages, Loader2, MessageCircle, Mic, MicOff, RotateCcw, Volume2, X } from "lucide-react"

type VoicePhase = "idle" | "requesting" | "listening" | "processing" | "speaking" | "error"
type VoiceMode = "translate" | "conversation"
type LanguageCode = "es" | "en"
type HistoryItem = { role: "user" | "assistant"; content: string }

type VoiceTurn = {
  id: string
  mode: VoiceMode
  original: string
  responseText: string
  sourceLanguage: string
  targetLanguage: string
  sourceCode: LanguageCode
  targetCode: LanguageCode
}

const PHASE_COPY: Record<VoiceMode, Record<VoicePhase, string>> = {
  translate: {
    idle: "Toca el mar para traducir",
    requesting: "Activando micrófono…",
    listening: "Te escucho…",
    processing: "MIRA está traduciendo…",
    speaking: "MIRA está reproduciendo la traducción…",
    error: "No pude continuar",
  },
  conversation: {
    idle: "Toca el mar para conversar",
    requesting: "Activando micrófono…",
    listening: "MIRA te escucha…",
    processing: "MIRA está pensando…",
    speaking: "MIRA está respondiendo…",
    error: "No pude continuar",
  },
}

const LANGUAGE_META: Record<LanguageCode, { label: string; flag: string }> = {
  es: { label: "Español", flag: "🇨🇱" },
  en: { label: "English", flag: "🇺🇸" },
}

function oppositeLanguage(language: LanguageCode): LanguageCode {
  return language === "es" ? "en" : "es"
}

function supportedMimeType() {
  if (typeof MediaRecorder === "undefined") return ""
  return ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find(type => MediaRecorder.isTypeSupported(type)) || ""
}

function browserSpeak(text: string, lang: LanguageCode, onEnd: () => void) {
  if (!("speechSynthesis" in window)) {
    onEnd()
    return
  }

  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = lang === "es" ? "es-CL" : "en-US"
  utterance.rate = 0.96
  utterance.pitch = 1

  const voices = window.speechSynthesis.getVoices()
  const preferred = voices.find(voice => voice.lang.toLowerCase().startsWith(utterance.lang.toLowerCase()))
    || voices.find(voice => voice.lang.toLowerCase().startsWith(lang))
  if (preferred) utterance.voice = preferred

  utterance.onend = onEnd
  utterance.onerror = onEnd
  window.speechSynthesis.speak(utterance)
}

export default function MiraVoiceMode() {
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<VoicePhase>("idle")
  const [mode, setMode] = useState<VoiceMode>("translate")
  const [language, setLanguage] = useState<LanguageCode>("es")
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

  const clearRecordingTimers = useCallback(() => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current)
    animationFrameRef.current = null
    if (maxRecordingTimerRef.current) clearTimeout(maxRecordingTimerRef.current)
    maxRecordingTimerRef.current = null
  }, [])

  const releaseMicrophone = useCallback(() => {
    clearRecordingTimers()
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined)
      audioContextRef.current = null
    }
  }, [clearRecordingTimers])

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

  const resumeAfterSpeech = useCallback(() => {
    audioRef.current = null
    if (!openRef.current) return
    setPhase("idle")
    if (autoContinueRef.current) {
      window.setTimeout(() => {
        if (openRef.current) void beginListeningRef.current()
      }, 450)
    }
  }, [])

  const playResponse = useCallback((data: VoiceTurn & { audioBase64?: string; audioMime?: string }) => {
    setPhase("speaking")
    if (data.audioBase64) {
      const audio = new Audio(`data:${data.audioMime || "audio/mpeg"};base64,${data.audioBase64}`)
      audioRef.current = audio
      audio.onended = resumeAfterSpeech
      audio.onerror = () => browserSpeak(data.responseText, data.targetCode, resumeAfterSpeech)
      void audio.play().catch(() => browserSpeak(data.responseText, data.targetCode, resumeAfterSpeech))
      return
    }
    browserSpeak(data.responseText, data.targetCode, resumeAfterSpeech)
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
      formData.append("audio", blob, `mira-turn.${extension}`)
      formData.append("mode", mode)
      formData.append("language", language)
      if (mode === "conversation" && historyRef.current.length) {
        formData.append("history", JSON.stringify(historyRef.current))
      }

      const response = await fetch("/api/agents/traductor/voice", {
        method: "POST",
        body: formData,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "No se pudo procesar el audio.")
      if (!openRef.current) return

      const nextTurn: VoiceTurn = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        mode: data.mode === "conversation" ? "conversation" : "translate",
        original: data.original,
        responseText: data.responseText || data.reply || data.translated,
        sourceLanguage: data.sourceLanguage,
        targetLanguage: data.targetLanguage,
        sourceCode: data.sourceCode,
        targetCode: data.targetCode,
      }

      setTurns(current => [...current, nextTurn].slice(-6))
      if (nextTurn.mode === "conversation") {
        historyRef.current = [
          ...historyRef.current,
          { role: "user", content: nextTurn.original },
          { role: "assistant", content: nextTurn.responseText },
        ].slice(-8) as HistoryItem[]
      }

      playResponse({ ...nextTurn, audioBase64: data.audioBase64, audioMime: data.audioMime })
    } catch (cause) {
      if (!openRef.current) return
      setError(cause instanceof Error ? cause.message : "No se pudo procesar la conversación.")
      setPhase("error")
    }
  }, [language, mode, playResponse])

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state !== "recording") return
    clearRecordingTimers()
    recorder.stop()
  }, [clearRecordingTimers])

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
      } else if (speechStartedRef.current && now - lastSoundAtRef.current > 1200) {
        stopRecording()
        return
      }

      animationFrameRef.current = requestAnimationFrame(tick)
    }

    animationFrameRef.current = requestAnimationFrame(tick)
  }, [stopRecording])

  const beginListening = useCallback(async () => {
    if (!openRef.current || phase === "requesting" || phase === "processing") return

    stopEverything()
    setError("")
    setPhase("requesting")

    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("Este navegador no permite usar el micrófono en modo conversación.")
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      })
      if (!openRef.current) {
        stream.getTracks().forEach(track => track.stop())
        return
      }

      streamRef.current = stream
      chunksRef.current = []
      const mimeType = supportedMimeType()
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      recorderRef.current = recorder

      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onerror = () => {
        releaseMicrophone()
        setError("El micrófono se interrumpió. Vuelve a intentarlo.")
        setPhase("error")
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" })
        recorderRef.current = null
        releaseMicrophone()
        void processAudio(blob)
      }

      recorder.start(250)
      setPhase("listening")
      monitorSilence(stream)
      maxRecordingTimerRef.current = setTimeout(stopRecording, 20000)
    } catch (cause) {
      releaseMicrophone()
      setError(cause instanceof Error ? cause.message : "No pude acceder al micrófono.")
      setPhase("error")
    }
  }, [monitorSilence, phase, processAudio, releaseMicrophone, stopEverything, stopRecording])

  useEffect(() => {
    beginListeningRef.current = beginListening
  }, [beginListening])

  useEffect(() => () => stopEverything(), [stopEverything])

  function resetConversation() {
    stopEverything()
    historyRef.current = []
    setTurns([])
    setError("")
    setPhase("idle")
  }

  function selectMode(nextMode: VoiceMode) {
    if (nextMode === mode) return
    resetConversation()
    setMode(nextMode)
  }

  function selectLanguage(nextLanguage: LanguageCode) {
    if (nextLanguage === language) return
    resetConversation()
    setLanguage(nextLanguage)
  }

  function openVoiceMode() {
    openRef.current = true
    setOpen(true)
    setError("")
    setPhase("idle")
  }

  function closeVoiceMode() {
    openRef.current = false
    setOpen(false)
    setPhase("idle")
    stopEverything()
  }

  function handleOrbPress() {
    if (phase === "listening") {
      stopRecording()
      return
    }
    if (phase === "speaking") {
      audioRef.current?.pause()
      if ("speechSynthesis" in window) window.speechSynthesis.cancel()
      setPhase("idle")
      return
    }
    if (phase === "idle" || phase === "error") void beginListening()
  }

  const targetLanguage = oppositeLanguage(language)
  const description = mode === "translate"
    ? `Habla en ${LANGUAGE_META[language].label}. MIRA traducirá y reproducirá tu mensaje en ${LANGUAGE_META[targetLanguage].label}.`
    : `Habla con MIRA en ${LANGUAGE_META[language].label}. Recordará los últimos turnos, responderá y volverá a escucharte automáticamente.`

  return (
    <>
      <button
        type="button"
        onClick={openVoiceMode}
        aria-label="Abrir voz en vivo con MIRA"
        title="Traducción y conversación de voz"
        className="mira-launcher fixed bottom-24 right-5 z-30 h-16 w-16 overflow-hidden rounded-full border border-cyan-200/30 shadow-2xl shadow-cyan-900/30 transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
      >
        <span className="mira-water absolute inset-0" />
        <span className="relative z-10 flex h-full w-full items-center justify-center text-white">
          <Mic size={22} />
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/[0.94] text-white backdrop-blur-2xl">
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-5 py-5 sm:px-8">
            <header className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Languages size={17} className="text-cyan-300" />
                  MIRA · voz en vivo
                </div>
                <p className="mt-1 text-xs text-slate-400">Traducción instantánea o conversación autónoma</p>
              </div>
              <button
                type="button"
                onClick={closeVoiceMode}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
                aria-label="Cerrar modo voz"
              >
                <X size={18} />
              </button>
            </header>

            <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1.5">
              <button
                type="button"
                onClick={() => selectMode("translate")}
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-semibold transition ${
                  mode === "translate" ? "bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-900/20" : "text-slate-300 hover:bg-white/[0.06]"
                }`}
              >
                <ArrowRightLeft size={15} /> Traducción
              </button>
              <button
                type="button"
                onClick={() => selectMode("conversation")}
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-semibold transition ${
                  mode === "conversation" ? "bg-blue-500 text-white shadow-lg shadow-blue-950/30" : "text-slate-300 hover:bg-white/[0.06]"
                }`}
              >
                <MessageCircle size={15} /> Conversación
              </button>
            </div>

            <div className="mt-5 text-center">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {mode === "translate" ? "Hablar en" : "Conversar en"}
              </p>
              <div className="flex items-center justify-center gap-2">
                {(["es", "en"] as LanguageCode[]).map(code => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => selectLanguage(code)}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                      language === code
                        ? "border-cyan-300/50 bg-cyan-400/15 text-cyan-100"
                        : "border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.07] hover:text-white"
                    }`}
                  >
                    {LANGUAGE_META[code].flag} {LANGUAGE_META[code].label}
                  </button>
                ))}
                {mode === "translate" && (
                  <>
                    <span className="px-1 text-cyan-300">→</span>
                    <span className="rounded-full border border-blue-300/20 bg-blue-400/10 px-4 py-2 text-xs font-semibold text-blue-100">
                      {LANGUAGE_META[targetLanguage].flag} {LANGUAGE_META[targetLanguage].label}
                    </span>
                  </>
                )}
              </div>
            </div>

            <main className="flex flex-1 flex-col items-center justify-center py-8 text-center">
              <button
                type="button"
                onClick={handleOrbPress}
                disabled={phase === "requesting" || phase === "processing"}
                className={`mira-orb relative h-52 w-52 overflow-hidden rounded-full border transition focus:outline-none focus:ring-4 focus:ring-cyan-300/20 disabled:cursor-wait sm:h-60 sm:w-60 ${
                  phase === "listening"
                    ? "border-cyan-200/70 shadow-[0_0_80px_rgba(34,211,238,0.35)]"
                    : phase === "speaking"
                      ? "border-blue-200/70 shadow-[0_0_80px_rgba(59,130,246,0.35)]"
                      : "border-white/15 shadow-[0_0_65px_rgba(8,145,178,0.22)]"
                }`}
                aria-label={phase === "listening" ? "Detener grabación" : "Comenzar a hablar"}
              >
                <span className="mira-water absolute inset-0" />
                <span className="mira-current absolute -inset-10" />
                <span className="mira-glow absolute inset-[18%] rounded-full" />
                <span className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-3">
                  {phase === "requesting" || phase === "processing" ? (
                    <Loader2 size={36} className="animate-spin" />
                  ) : phase === "speaking" ? (
                    <Volume2 size={38} />
                  ) : phase === "listening" ? (
                    <MicOff size={38} />
                  ) : (
                    <Mic size={38} />
                  )}
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-50/90">
                    {phase === "listening" ? "Toca para enviar" : phase === "speaking" ? "Toca para detener" : "Hablar"}
                  </span>
                </span>
              </button>

              <p className="mt-6 text-base font-semibold text-white">{PHASE_COPY[mode][phase]}</p>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-400">{description}</p>

              {error && (
                <div className="mt-5 max-w-md rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                  {error}
                </div>
              )}

              {turns.length > 0 && (
                <div className="mt-8 flex w-full flex-col gap-4 text-left">
                  {turns.slice(-4).map(turn => (
                    <div key={turn.id} className={turn.mode === "translate" ? "grid gap-3 sm:grid-cols-2" : "space-y-3"}>
                      <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-5">
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                          {turn.sourceLanguage}
                        </div>
                        <p className="text-sm leading-relaxed text-slate-100">{turn.original}</p>
                      </div>
                      <div className="rounded-3xl border border-cyan-300/15 bg-cyan-400/[0.07] p-5">
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
                          {turn.targetLanguage}
                        </div>
                        <p className="text-sm leading-relaxed text-white">{turn.responseText}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </main>

            <footer className="flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-4 sm:flex-row">
              <label className="flex cursor-pointer items-center gap-3 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={autoContinue}
                  onChange={event => setAutoContinue(event.target.checked)}
                  className="h-4 w-4 accent-cyan-400"
                />
                {mode === "conversation" ? "Conversación autónoma: seguir escuchando" : "Seguir escuchando después de traducir"}
              </label>
              <button
                type="button"
                onClick={resetConversation}
                className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs text-slate-300 transition hover:bg-white/5 hover:text-white"
              >
                <RotateCcw size={13} /> Limpiar conversación
              </button>
            </footer>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes mira-tide {
          0% { transform: translate3d(-8%, 5%, 0) rotate(0deg) scale(1.05); }
          50% { transform: translate3d(7%, -5%, 0) rotate(180deg) scale(1.18); }
          100% { transform: translate3d(-8%, 5%, 0) rotate(360deg) scale(1.05); }
        }
        @keyframes mira-current {
          0%, 100% { transform: translate3d(-5%, 2%, 0) rotate(-8deg); opacity: .62; }
          50% { transform: translate3d(7%, -4%, 0) rotate(12deg); opacity: .95; }
        }
        @keyframes mira-breathe {
          0%, 100% { transform: scale(.92); opacity: .42; }
          50% { transform: scale(1.12); opacity: .82; }
        }
        .mira-water {
          background:
            radial-gradient(circle at 30% 25%, rgba(165,243,252,.95), transparent 23%),
            radial-gradient(circle at 68% 38%, rgba(56,189,248,.88), transparent 30%),
            radial-gradient(circle at 45% 78%, rgba(14,116,144,.9), transparent 42%),
            linear-gradient(145deg, #22d3ee 0%, #0284c7 43%, #0f3f72 72%, #071f3a 100%);
        }
        .mira-water::before,
        .mira-water::after {
          content: "";
          position: absolute;
          inset: -28%;
          border-radius: 38% 62% 55% 45% / 52% 44% 56% 48%;
          background: linear-gradient(115deg, rgba(255,255,255,.26), rgba(34,211,238,.03) 48%, rgba(15,23,42,.25));
          animation: mira-tide 8s linear infinite;
          mix-blend-mode: screen;
        }
        .mira-water::after {
          inset: -18%;
          animation-duration: 11s;
          animation-direction: reverse;
          opacity: .65;
        }
        .mira-current {
          border-radius: 43% 57% 48% 52% / 57% 42% 58% 43%;
          background: conic-gradient(from 190deg, transparent, rgba(224,242,254,.28), transparent 42%, rgba(14,165,233,.34), transparent 72%);
          animation: mira-current 5.5s ease-in-out infinite;
          mix-blend-mode: screen;
        }
        .mira-glow {
          background: radial-gradient(circle, rgba(255,255,255,.24), rgba(125,211,252,.08) 45%, transparent 72%);
          animation: mira-breathe 2.8s ease-in-out infinite;
        }
        .mira-launcher .mira-water::before,
        .mira-launcher .mira-water::after { animation-duration: 5.5s; }
        @media (prefers-reduced-motion: reduce) {
          .mira-water::before,
          .mira-water::after,
          .mira-current,
          .mira-glow { animation: none !important; }
        }
      `}</style>
    </>
  )
}
