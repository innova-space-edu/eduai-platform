"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  ArrowRightLeft,
  AudioLines,
  Loader2,
  MessageCircle,
  Mic,
  MicOff,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
} from "lucide-react"
import { useEduAIMusic } from "@/components/music/MusicProvider"

type VoicePhase = "idle" | "requesting" | "listening" | "processing" | "speaking" | "error"
export type VoiceMode = "translate" | "conversation"
export type VoiceLanguage = "auto" | "es" | "en"
type LanguageCode = "es" | "en"
type HistoryItem = { role: "user" | "assistant"; content: string }

type VoiceTurn = {
  id: string
  mode: VoiceMode
  original: string
  responseText: string
  sourceCode: LanguageCode
  targetCode: LanguageCode
  sourceLanguage: string
  targetLanguage: string
}

type Props = {
  conversationOnly?: boolean
  defaultMode?: VoiceMode
  defaultLanguage?: VoiceLanguage
  assistantLabel?: string
  contextLabel?: string
  buttonTitle?: string
  buttonClassName?: string
  onConversationTurn?: (transcript: string, detectedLanguage: LanguageCode) => Promise<string>
}

const LANGUAGE_META: Record<LanguageCode, { label: string; flag: string; speech: string }> = {
  es: { label: "Español", flag: "🇨🇱", speech: "es-CL" },
  en: { label: "English", flag: "🇺🇸", speech: "en-US" },
}

const PHASE_COPY: Record<VoicePhase, string> = {
  idle: "Listo para conversar",
  requesting: "Activando micrófono…",
  listening: "Escuchando…",
  processing: "Pensando…",
  speaking: "Respondiendo…",
  error: "No pude continuar",
}

function oppositeLanguage(language: LanguageCode): LanguageCode {
  return language === "es" ? "en" : "es"
}

function supportedMimeType() {
  if (typeof MediaRecorder === "undefined") return ""
  return ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"]
    .find((type) => MediaRecorder.isTypeSupported(type)) || ""
}

function speechVoice(lang: LanguageCode) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return undefined
  const voices = window.speechSynthesis.getVoices()
  const locale = LANGUAGE_META[lang].speech.toLowerCase()

  const preferredNames = lang === "es"
    ? ["Catalina", "Francisca", "Paulina", "Google español", "Microsoft"]
    : ["Aria", "Jenny", "Samantha", "Google US English", "Microsoft"]

  return voices.find((voice) => voice.lang.toLowerCase() === locale && preferredNames.some((name) => voice.name.includes(name)))
    || voices.find((voice) => voice.lang.toLowerCase() === locale)
    || voices.find((voice) => voice.lang.toLowerCase().startsWith(lang))
}

function plainSpeechText(text: string) {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#*_\x60>~]/g, "")
    .replace(/\s*\n+\s*/g, ". ")
    .replace(/\s{2,}/g, " ")
    .trim()
}

function browserSpeak(text: string, lang: LanguageCode, onEnd: () => void) {
  if (!("speechSynthesis" in window)) {
    onEnd()
    return
  }

  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(plainSpeechText(text))
  utterance.lang = LANGUAGE_META[lang].speech
  utterance.rate = 1
  utterance.pitch = 1
  const voice = speechVoice(lang)
  if (voice) utterance.voice = voice
  utterance.onend = onEnd
  utterance.onerror = onEnd
  window.speechSynthesis.speak(utterance)
}

export default function MiraVoicePopup({
  conversationOnly = false,
  defaultMode = "conversation",
  defaultLanguage = "auto",
  assistantLabel = "MIRA",
  contextLabel = "Hablar sin salir del chat",
  buttonTitle = "Hablar con MIRA",
  buttonClassName = "",
  onConversationTurn,
}: Props) {
  const music = useEduAIMusic()
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<VoicePhase>("idle")
  const [mode, setMode] = useState<VoiceMode>(conversationOnly ? "conversation" : defaultMode)
  const [language, setLanguage] = useState<VoiceLanguage>(defaultLanguage)
  const [turns, setTurns] = useState<VoiceTurn[]>([])
  const [error, setError] = useState("")
  const [autoContinue, setAutoContinue] = useState(true)
  const [muteOutput, setMuteOutput] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [detectedLanguage, setDetectedLanguage] = useState<LanguageCode | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const maxRecordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const speechStartedRef = useRef(false)
  const lastSoundAtRef = useRef(0)
  const openRef = useRef(false)
  const autoContinueRef = useRef(true)
  const muteOutputRef = useRef(false)
  const historyRef = useRef<HistoryItem[]>([])
  const beginListeningRef = useRef<() => Promise<void>>(async () => {})
  const musicWasPlayingRef = useRef(false)

  useEffect(() => { openRef.current = open }, [open])
  useEffect(() => { autoContinueRef.current = autoContinue }, [autoContinue])
  useEffect(() => { muteOutputRef.current = muteOutput }, [muteOutput])

  const clearRecordingTimers = useCallback(() => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current)
    animationFrameRef.current = null
    if (maxRecordingTimerRef.current) clearTimeout(maxRecordingTimerRef.current)
    maxRecordingTimerRef.current = null
  }, [])

  const releaseMicrophone = useCallback(() => {
    clearRecordingTimers()
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setAudioLevel(0)
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
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel()
  }, [releaseMicrophone])

  const resumeAfterSpeech = useCallback(() => {
    if (!openRef.current) return
    setPhase("idle")
    if (autoContinueRef.current) {
      window.setTimeout(() => {
        if (openRef.current) void beginListeningRef.current()
      }, 180)
    }
  }, [])

  const playResponse = useCallback((text: string, lang: LanguageCode) => {
    setPhase("speaking")
    if (muteOutputRef.current || !text.trim()) {
      window.setTimeout(resumeAfterSpeech, 120)
      return
    }
    browserSpeak(text, lang, resumeAfterSpeech)
  }, [resumeAfterSpeech])

  const processAudio = useCallback(async (blob: Blob) => {
    if (blob.size < 900) {
      setPhase("idle")
      if (autoContinueRef.current) window.setTimeout(() => void beginListeningRef.current(), 220)
      return
    }

    setPhase("processing")
    setError("")

    try {
      const formData = new FormData()
      const extension = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "m4a" : "webm"
      formData.append("audio", blob, `mira-turn.${extension}`)
      formData.append("mode", onConversationTurn ? "transcribe" : mode)
      formData.append("language", language)
      if (!onConversationTurn && mode === "conversation" && historyRef.current.length) {
        formData.append("history", JSON.stringify(historyRef.current))
      }

      const response = await fetch("/api/agents/traductor/voice", {
        method: "POST",
        body: formData,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "No se pudo procesar el audio.")
      if (!openRef.current) return

      const sourceCode: LanguageCode = data.sourceCode === "en" ? "en" : "es"
      setDetectedLanguage(sourceCode)

      let responseText = String(data.responseText || data.reply || data.translated || "").trim()
      let targetCode: LanguageCode = data.targetCode === "en" ? "en" : data.targetCode === "es" ? "es" : mode === "translate" ? oppositeLanguage(sourceCode) : sourceCode
      let targetLanguage = String(data.targetLanguage || `${assistantLabel} · ${LANGUAGE_META[targetCode].label}`)

      if (onConversationTurn) {
        responseText = String(await onConversationTurn(String(data.original || data.transcript || "").trim(), sourceCode) || "").trim()
        if (!openRef.current) return
        targetCode = sourceCode
        targetLanguage = `${assistantLabel} · ${LANGUAGE_META[targetCode].label}`
      }

      const original = String(data.original || data.transcript || "").trim()
      if (!original) throw new Error("No pude reconocer lo que dijiste.")
      if (!responseText) throw new Error("No se recibió una respuesta de voz.")

      const nextTurn: VoiceTurn = {
        id: `${Date.now()}-${turns.length}`,
        mode: onConversationTurn ? "conversation" : mode,
        original,
        responseText,
        sourceCode,
        targetCode,
        sourceLanguage: String(data.sourceLanguage || `Tú · ${LANGUAGE_META[sourceCode].label}`),
        targetLanguage,
      }

      setTurns((current) => [...current, nextTurn].slice(-4))
      if (!onConversationTurn && mode === "conversation") {
        historyRef.current = [
          ...historyRef.current,
          { role: "user", content: original },
          { role: "assistant", content: responseText },
        ].slice(-8) as HistoryItem[]
      }

      playResponse(responseText, targetCode)
    } catch (cause) {
      if (!openRef.current) return
      setError(cause instanceof Error ? cause.message : "No se pudo procesar la conversación.")
      setPhase("error")
    }
  }, [assistantLabel, language, mode, onConversationTurn, playResponse, turns.length])

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state !== "recording") return
    clearRecordingTimers()
    recorder.stop()
  }, [clearRecordingTimers])

  const monitorSilence = useCallback((stream: MediaStream) => {
    const AudioContextClass = window.AudioContext
      || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return

    const context = new AudioContextClass()
    audioContextRef.current = context
    const analyser = context.createAnalyser()
    analyser.fftSize = 1024
    analyser.smoothingTimeConstant = 0.72
    context.createMediaStreamSource(stream).connect(analyser)
    const samples = new Uint8Array(analyser.fftSize)
    let frameCount = 0

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

      frameCount += 1
      if (frameCount % 3 === 0) setAudioLevel(Math.min(1, Math.max(0.06, rms * 11)))

      if (rms > 0.021) {
        speechStartedRef.current = true
        lastSoundAtRef.current = now
      } else if (speechStartedRef.current && now - lastSoundAtRef.current > 900) {
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
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      streamRef.current = stream
      chunksRef.current = []
      const mimeType = supportedMimeType()
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      recorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onerror = () => {
        releaseMicrophone()
        setError("El micrófono se interrumpió. Vuelve a intentarlo.")
        setPhase("error")
      }
      recorder.onstop = () => {
        const recordedType = recorder.mimeType || mimeType || "audio/webm"
        const blob = new Blob(chunksRef.current, { type: recordedType })
        recorderRef.current = null
        releaseMicrophone()
        void processAudio(blob)
      }

      recorder.start(160)
      setPhase("listening")
      monitorSilence(stream)
      maxRecordingTimerRef.current = setTimeout(stopRecording, 30000)
    } catch (cause) {
      releaseMicrophone()
      setError(
        cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "Necesito permiso para usar el micrófono. Habilítalo en el navegador."
          : cause instanceof Error ? cause.message : "No pude acceder al micrófono.",
      )
      setPhase("error")
    }
  }, [monitorSilence, phase, processAudio, releaseMicrophone, stopEverything, stopRecording])

  useEffect(() => {
    beginListeningRef.current = beginListening
  }, [beginListening])

  useEffect(() => {
    return () => {
      stopEverything()
      if (musicWasPlayingRef.current) {
        music.setPlaying(true)
        musicWasPlayingRef.current = false
      }
    }
  }, [music.setPlaying, stopEverything])

  const resetConversation = useCallback(() => {
    stopEverything()
    historyRef.current = []
    setTurns([])
    setError("")
    setDetectedLanguage(null)
    setPhase("idle")
  }, [stopEverything])

  function selectMode(nextMode: VoiceMode) {
    if (nextMode === mode || conversationOnly) return
    resetConversation()
    setMode(nextMode)
  }

  function selectLanguage(nextLanguage: VoiceLanguage) {
    if (nextLanguage === language) return
    resetConversation()
    setLanguage(nextLanguage)
  }

  function openVoice() {
    musicWasPlayingRef.current = music.playing
    if (music.playing) music.setPlaying(false)
    openRef.current = true
    setOpen(true)
    setError("")
    setPhase("idle")
    window.setTimeout(() => {
      if (openRef.current) void beginListeningRef.current()
    }, 100)
  }

  function closeVoice() {
    openRef.current = false
    setOpen(false)
    setPhase("idle")
    stopEverything()
    if (musicWasPlayingRef.current) {
      music.setPlaying(true)
      musicWasPlayingRef.current = false
    }
  }

  function handleMicPress() {
    if (phase === "listening") {
      stopRecording()
      return
    }
    if (phase === "speaking") {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel()
      setPhase("idle")
      return
    }
    if (phase === "idle" || phase === "error") void beginListening()
  }

  const activeCode: LanguageCode = language === "en" ? "en" : language === "es" ? "es" : detectedLanguage || "es"
  const translateTarget = oppositeLanguage(activeCode)
  const waveformActive = phase === "listening" || phase === "speaking"
  const latestTurn = turns[turns.length - 1]

  return (
    <>
      <button
        type="button"
        onClick={openVoice}
        aria-label={buttonTitle}
        title={buttonTitle}
        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-md shadow-blue-500/20 transition hover:-translate-y-0.5 hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${buttonClassName}`}
      >
        <AudioLines size={18} />
      </button>

      {open && (
        <aside
          role="dialog"
          aria-modal="false"
          aria-label="MIRA conversación en vivo"
          className="fixed bottom-36 right-5 z-[90] w-[min(92vw,430px)] overflow-hidden rounded-[28px] border border-cyan-300/20 bg-[#08111f]/[0.97] text-white shadow-[0_28px_90px_rgba(2,8,23,.55)] backdrop-blur-2xl max-sm:bottom-28 max-sm:left-3 max-sm:right-3 max-sm:w-auto"
        >
          <div className="border-b border-white/10 px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-black">
                  <AudioLines size={17} className="text-cyan-300" />
                  <span>MIRA · conversación en vivo</span>
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.8)]" />
                </div>
                <p className="mt-1 truncate text-[11px] text-slate-400">{contextLabel}</p>
              </div>
              <button
                type="button"
                onClick={closeVoice}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-slate-300 transition hover:bg-white/[0.1] hover:text-white"
                aria-label="Cerrar conversación de voz"
              >
                <X size={15} />
              </button>
            </div>

            {!conversationOnly && (
              <div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-white/[0.035] p-1">
                <button
                  type="button"
                  onClick={() => selectMode("translate")}
                  className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold transition ${mode === "translate" ? "bg-cyan-400 text-slate-950" : "text-slate-400 hover:bg-white/[0.06] hover:text-white"}`}
                >
                  <ArrowRightLeft size={13} /> Traducción
                </button>
                <button
                  type="button"
                  onClick={() => selectMode("conversation")}
                  className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold transition ${mode === "conversation" ? "bg-blue-500 text-white" : "text-slate-400 hover:bg-white/[0.06] hover:text-white"}`}
                >
                  <MessageCircle size={13} /> Conversación
                </button>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {(["auto", "es", "en"] as VoiceLanguage[]).map((code) => {
                const active = language === code
                const label = code === "auto" ? "AUTO Idioma" : `${LANGUAGE_META[code].flag} ${LANGUAGE_META[code].label}`
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => selectLanguage(code)}
                    className={`rounded-full border px-3 py-1.5 text-[10px] font-bold transition ${active ? "border-cyan-300/50 bg-cyan-400/15 text-cyan-100" : "border-white/10 bg-white/[0.025] text-slate-400 hover:bg-white/[0.07] hover:text-white"}`}
                  >
                    {label}
                  </button>
                )
              })}
              {mode === "translate" && (
                <span className="ml-auto text-[10px] font-semibold text-slate-400">
                  → {LANGUAGE_META[translateTarget].flag} {LANGUAGE_META[translateTarget].label}
                </span>
              )}
            </div>
          </div>

          <div className="px-4 pb-4 pt-3">
            <div className="relative flex h-32 items-center justify-center overflow-hidden rounded-[24px] border border-cyan-300/10 bg-[radial-gradient(circle_at_center,rgba(14,165,233,.16),rgba(2,6,23,.22)_58%,rgba(2,6,23,.04))]">
              <div className="absolute inset-x-4 flex h-24 items-center justify-center gap-[3px]" aria-hidden="true">
                {Array.from({ length: 27 }, (_, index) => {
                  const center = 1 - Math.abs(index - 13) / 13
                  const listenScale = phase === "listening" ? 0.18 + audioLevel * (0.72 + center * 0.28) : 0.18
                  const speakingScale = phase === "speaking" ? 0.42 + center * 0.42 : listenScale
                  const scale = waveformActive ? speakingScale : phase === "processing" ? 0.24 + center * 0.18 : 0.13 + center * 0.08
                  return (
                    <span
                      key={index}
                      className={`mira-voice-wave-bar ${phase === "speaking" ? "is-speaking" : ""}`}
                      style={{
                        height: `${28 + ((index * 19) % 50)}%`,
                        transform: `scaleY(${Math.min(1, scale)})`,
                        animationDelay: `${-((index % 7) * 0.07)}s`,
                      }}
                    />
                  )
                })}
              </div>

              <button
                type="button"
                onClick={handleMicPress}
                disabled={phase === "requesting" || phase === "processing"}
                className={`relative z-10 flex h-20 w-20 items-center justify-center rounded-full border text-white transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/20 disabled:cursor-wait ${phase === "listening" ? "border-cyan-200/70 bg-gradient-to-br from-cyan-300 via-sky-500 to-blue-700 shadow-[0_0_42px_rgba(34,211,238,.45)]" : phase === "speaking" ? "border-blue-200/70 bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-700 shadow-[0_0_42px_rgba(59,130,246,.42)]" : "border-white/15 bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-700 shadow-[0_0_34px_rgba(14,165,233,.3)]"}`}
                aria-label={phase === "listening" ? "Detener y enviar" : "Comenzar a hablar"}
              >
                {phase === "requesting" || phase === "processing" ? (
                  <Loader2 size={28} className="animate-spin" />
                ) : phase === "speaking" ? (
                  <Volume2 size={30} />
                ) : phase === "listening" ? (
                  <MicOff size={30} />
                ) : (
                  <Mic size={30} />
                )}
              </button>
            </div>

            <div className="mt-3 text-center">
              <p className="text-sm font-black text-white">{PHASE_COPY[phase]}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                {mode === "conversation"
                  ? "Habla naturalmente. MIRA detecta español o inglés, responde y vuelve a escuchar."
                  : "Habla en español o inglés. MIRA detecta el idioma y traduce al otro idioma."}
              </p>
            </div>

            {error && (
              <div className="mt-3 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-[11px] leading-relaxed text-rose-100">
                {error}
              </div>
            )}

            {latestTurn && (
              <div className="mt-3 space-y-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
                  <div className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">{latestTurn.sourceLanguage}</div>
                  <p className="mt-1 max-h-16 overflow-y-auto text-[11px] leading-relaxed text-slate-200">{latestTurn.original}</p>
                </div>
                <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.07] px-3 py-2.5">
                  <div className="text-[9px] font-black uppercase tracking-[0.15em] text-cyan-300">{latestTurn.targetLanguage}</div>
                  <p className="mt-1 max-h-20 overflow-y-auto text-[11px] leading-relaxed text-white">{latestTurn.responseText}</p>
                </div>
              </div>
            )}

            <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-2.5 py-2 text-[10px] text-slate-300">
                <input
                  type="checkbox"
                  checked={autoContinue}
                  onChange={(event) => setAutoContinue(event.target.checked)}
                  className="h-3.5 w-3.5 accent-cyan-400"
                />
                <span className="truncate">Conversación autónoma</span>
              </label>
              <span className="rounded-xl border border-cyan-300/10 bg-cyan-400/[0.07] px-2.5 py-2 text-[10px] font-bold text-cyan-200">
                Respuestas rápidas
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setMuteOutput((value) => !value)
                  if (!muteOutput && "speechSynthesis" in window) {
                    window.speechSynthesis.cancel()
                    setPhase("idle")
                    if (autoContinueRef.current) window.setTimeout(() => void beginListeningRef.current(), 180)
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-2 text-[10px] font-semibold text-slate-300 transition hover:bg-white/[0.06]"
              >
                {muteOutput ? <VolumeX size={13} /> : <Volume2 size={13} />}
                {muteOutput ? "Activar voz" : "Silenciar"}
              </button>
              <button
                type="button"
                onClick={resetConversation}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-2 text-[10px] font-semibold text-slate-300 transition hover:bg-white/[0.06]"
              >
                <RotateCcw size={13} /> Limpiar
              </button>
              <button
                type="button"
                onClick={closeVoice}
                className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-[10px] font-bold text-rose-200 transition hover:bg-rose-400/20"
              >
                <X size={13} /> Finalizar
              </button>
            </div>
          </div>
        </aside>
      )}

      <style jsx global>{`
        .mira-voice-wave-bar {
          width: 3px;
          min-height: 14px;
          border-radius: 999px;
          background: linear-gradient(to top, #2563eb, #22d3ee 58%, #a5f3fc);
          box-shadow: 0 0 10px rgba(34, 211, 238, 0.28);
          transform-origin: center;
          transition: transform 90ms linear, opacity 120ms ease;
          opacity: 0.74;
        }
        @keyframes mira-voice-speaking-wave {
          from { transform: scaleY(.28); opacity: .58; }
          to { transform: scaleY(1); opacity: 1; }
        }
        .mira-voice-wave-bar.is-speaking {
          animation: mira-voice-speaking-wave .52s ease-in-out infinite alternate;
        }
      `}</style>
    </>
  )
}
