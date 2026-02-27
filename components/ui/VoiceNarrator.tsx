"use client"

import { useEffect, useRef, useState } from "react"

interface Props {
  text: string
  autoPlay?: boolean
  addMotivation?: boolean
}

const MOTIVATIONAL = [
  "¡Ánimo, lo estás haciendo genial!",
  "¡No te preocupes, cada paso cuenta!",
  "¡Sigue así, vas muy bien!",
  "¡Excelente, continúa aprendiendo!",
  "¡Tú puedes, confía en ti!",
]

export default function VoiceNarrator({ text, autoPlay = false, addMotivation = false }: Props) {
  const [loading, setLoading] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [supported, setSupported] = useState(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const hasPlayedRef = useRef(false)

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      setSupported(true)
    }
  }, [])

  useEffect(() => {
    if (autoPlay && text && supported && !hasPlayedRef.current) {
      hasPlayedRef.current = true
      // Esperar que el streaming termine completamente
      const timer = setTimeout(() => speak(), 800)
      return () => clearTimeout(timer)
    }
  }, [text, autoPlay, supported])

  function getBestFeminineVoice(): SpeechSynthesisVoice | null {
    const voices = window.speechSynthesis.getVoices()

    // Prioridad 1: voz femenina española explícita
    const femaleSpanish = voices.find(v =>
      v.lang.startsWith("es") && (
        v.name.toLowerCase().includes("female") ||
        v.name.toLowerCase().includes("mujer") ||
        v.name.toLowerCase().includes("paulina") ||
        v.name.toLowerCase().includes("mónica") ||
        v.name.toLowerCase().includes("monica") ||
        v.name.toLowerCase().includes("laura") ||
        v.name.toLowerCase().includes("helena") ||
        v.name.toLowerCase().includes("lucia") ||
        v.name.toLowerCase().includes("lucía") ||
        v.name.toLowerCase().includes("jorge") === false // evitar nombres masculinos
      )
    )
    if (femaleSpanish) return femaleSpanish

    // Prioridad 2: cualquier voz española
    const anySpanish = voices.find(v => v.lang.startsWith("es"))
    if (anySpanish) return anySpanish

    // Prioridad 3: cualquier voz disponible
    return voices[0] || null
  }

  function cleanText(raw: string) {
    return raw
      .replace(/#{1,6}\s/g, "")
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/`[^`]*`/g, "")
      .replace(/\$\$[^$]*\$\$/g, "fórmula matemática")
      .replace(/\$[^$]*\$/g, "fórmula")
      .replace(/---FOLLOWUPS---[\s\S]*/g, "")
      .replace(/\[.*?\]/g, "")
      .replace(/\n+/g, ". ")
      .trim()
  }

  function speak() {
    if (!supported || loading) return
    window.speechSynthesis.cancel()

    setLoading(true)

    // Cargar voces (puede ser asíncrono en algunos browsers)
    const trySpeak = () => {
      const clean = cleanText(text)
      const motivation = addMotivation
        ? " " + MOTIVATIONAL[Math.floor(Math.random() * MOTIVATIONAL.length)]
        : ""

      const utterance = new SpeechSynthesisUtterance(clean + motivation)
      const voice = getBestFeminineVoice()

      if (voice) utterance.voice = voice
      utterance.lang = voice?.lang || "es-ES"
      utterance.rate = 0.92      // ligeramente más lento — suave
      utterance.pitch = 1.15     // tono más agudo — femenino
      utterance.volume = 1

      utterance.onstart = () => { setPlaying(true); setLoading(false) }
      utterance.onend = () => { setPlaying(false) }
      utterance.onerror = () => { setPlaying(false); setLoading(false) }

      utteranceRef.current = utterance
      window.speechSynthesis.speak(utterance)
    }

    const voices = window.speechSynthesis.getVoices()
    if (voices.length > 0) {
      trySpeak()
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        trySpeak()
        setLoading(false)
      }
      // timeout fallback
      setTimeout(() => { trySpeak(); setLoading(false) }, 1000)
    }
  }

  function stop() {
    window.speechSynthesis.cancel()
    setPlaying(false)
    setLoading(false)
  }

  function toggle() {
    if (playing) {
      stop()
    } else {
      speak()
    }
  }

  if (!supported) return null

  return (
    <div className="flex items-center gap-2 mt-2">
      <button
        onClick={toggle}
        disabled={loading}
        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-all disabled:opacity-50 ${
          playing
            ? "bg-pink-600/20 border border-pink-500/40 text-pink-400"
            : "bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-pink-500/50 text-gray-400 hover:text-pink-300"
        }`}
      >
        {loading ? (
          <>
            <div className="w-3 h-3 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
            <span>Cargando voz...</span>
          </>
        ) : playing ? (
          <>
            <div className="flex gap-0.5 items-end h-3">
              <div className="w-0.5 h-2 bg-pink-400 rounded-full animate-pulse" />
              <div className="w-0.5 h-3 bg-pink-400 rounded-full animate-pulse delay-75" />
              <div className="w-0.5 h-1.5 bg-pink-400 rounded-full animate-pulse delay-150" />
            </div>
            <span>⏸ Pausar</span>
          </>
        ) : (
          <span>🔊 Escuchar</span>
        )}
      </button>

      {playing && (
        <button
          onClick={stop}
          className="text-gray-700 hover:text-red-400 text-xs px-2 py-1.5 rounded-full transition-colors"
        >
          ⏹
        </button>
      )}
    </div>
  )
}
