"use client"

import { useEffect, useRef, useState } from "react"

interface Props {
  text: string
  autoPlay?: boolean
  addMotivation?: boolean
}

export default function VoiceNarrator({ text, autoPlay = false, addMotivation = false }: Props) {
  const [loading, setLoading] = useState(false)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const hasPlayedRef = useRef(false)

  useEffect(() => {
    if (autoPlay && text && !hasPlayedRef.current) {
      hasPlayedRef.current = true
      speak()
    }
  }, [text, autoPlay])

  async function speak() {
    if (loading || playing) return
    stopAudio()
    setLoading(true)

    try {
      const res = await fetch("/api/agents/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, addMotivation }),
      })

      if (!res.ok) {
        fallbackTTS()
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio

      audio.onplay = () => setPlaying(true)
      audio.onpause = () => setPlaying(false)
      audio.onended = () => {
        setPlaying(false)
        audioRef.current = null
        URL.revokeObjectURL(url)
      }

      audio.play()
    } catch (e) {
      console.error("TTS error:", e)
      fallbackTTS()
    } finally {
      setLoading(false)
    }
  }

  function fallbackTTS() {
    if (!("speechSynthesis" in window)) return
    const clean = text.replace(/[#*`$\[\]]/g, "").replace(/\n+/g, " ").trim()
    const utterance = new SpeechSynthesisUtterance(clean)
    utterance.lang = "es-ES"
    const voices = window.speechSynthesis.getVoices()
    const spanish = voices.find(v => v.lang.startsWith("es"))
    if (spanish) utterance.voice = spanish
    utterance.onstart = () => setPlaying(true)
    utterance.onend = () => setPlaying(false)
    if (addMotivation) {
      const motivations = ["Ánimo, lo estás haciendo genial.", "Sigue así, vas muy bien."]
      const mot = new SpeechSynthesisUtterance(motivations[Math.floor(Math.random() * motivations.length)])
      mot.lang = "es-ES"
      if (spanish) mot.voice = spanish
      window.speechSynthesis.speak(utterance)
      window.speechSynthesis.speak(mot)
    } else {
      window.speechSynthesis.speak(utterance)
    }
  }

  function stopAudio() {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    window.speechSynthesis?.cancel()
    setPlaying(false)
  }

  function togglePlay() {
    if (playing) {
      stopAudio()
    } else {
      speak()
    }
  }

  return (
    <div className="flex items-center gap-2 mt-2">
      <button
        onClick={togglePlay}
        disabled={loading}
        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-all disabled:opacity-50 ${
          playing
            ? "bg-blue-600/20 border border-blue-500/40 text-blue-400"
            : "bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-blue-500 text-gray-400 hover:text-white"
        }`}
      >
        {loading ? (
          <>
            <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Generando audio...
          </>
        ) : playing ? (
          <>
            <div className="flex gap-0.5 items-end h-3">
              <div className="w-0.5 h-2 bg-blue-400 rounded-full animate-pulse" />
              <div className="w-0.5 h-3 bg-blue-400 rounded-full animate-pulse delay-75" />
              <div className="w-0.5 h-1.5 bg-blue-400 rounded-full animate-pulse delay-150" />
            </div>
            ⏸ Pausar
          </>
        ) : (
          <>🔊 Escuchar</>
        )}
      </button>

      {playing && (
        <button
          onClick={stopAudio}
          className="text-gray-600 hover:text-red-400 text-xs px-2 py-1.5 rounded-full transition-colors"
        >
          ⏹
        </button>
      )}
    </div>
  )
}
