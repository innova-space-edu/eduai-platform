"use client"

import { useState } from "react"

interface Props {
  text: string
}

export default function VoiceNarrator({ text }: Props) {
  const [loading, setLoading] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)

  function cleanText(raw: string) {
    return raw
      .replace(/#{1,6}\s/g, "")
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/`[^`]*`/g, "")
      .replace(/\$\$[^$]*\$\$/g, "fórmula matemática")
      .replace(/\$[^$]*\$/g, "fórmula")
      .replace(/---FOLLOWUPS---[\s\S]*/g, "")
      .replace(/\n+/g, " ")
      .trim()
      .slice(0, 500)
  }

  async function speak() {
    if (loading) return

    // Si ya hay audio reproduciéndolo, pausar/reanudar
    if (audio) {
      if (playing) {
        audio.pause()
        setPlaying(false)
      } else {
        audio.play()
        setPlaying(true)
      }
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/agents/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanText(text) }),
      })

      if (!res.ok) {
        // Fallback a Web Speech API si falla HF
        fallbackTTS()
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const newAudio = new Audio(url)

      newAudio.onplay = () => setPlaying(true)
      newAudio.onpause = () => setPlaying(false)
      newAudio.onended = () => {
        setPlaying(false)
        setAudio(null)
        URL.revokeObjectURL(url)
      }

      setAudio(newAudio)
      newAudio.play()

    } catch (e) {
      console.error("TTS error:", e)
      fallbackTTS()
    } finally {
      setLoading(false)
    }
  }

  function fallbackTTS() {
    if (!("speechSynthesis" in window)) return
    const clean = cleanText(text)
    const utterance = new SpeechSynthesisUtterance(clean)
    utterance.lang = "es-ES"
    utterance.rate = 1
    const voices = window.speechSynthesis.getVoices()
    const spanish = voices.find(v => v.lang.startsWith("es"))
    if (spanish) utterance.voice = spanish
    utterance.onstart = () => setPlaying(true)
    utterance.onend = () => setPlaying(false)
    window.speechSynthesis.speak(utterance)
  }

  function stop() {
    if (audio) {
      audio.pause()
      audio.currentTime = 0
      setAudio(null)
    }
    window.speechSynthesis?.cancel()
    setPlaying(false)
  }

  return (
    <div className="flex items-center gap-2 mt-2">
      <button
        onClick={speak}
        disabled={loading}
        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-all ${
          playing
            ? "bg-blue-600/20 border border-blue-500/40 text-blue-400"
            : "bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-blue-500 text-gray-400 hover:text-white"
        } disabled:opacity-50`}
        title="AVN — Agente de Voz"
      >
        {loading ? (
          <>
            <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Cargando voz...
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

      {(playing || audio) && (
        <button
          onClick={stop}
          className="text-gray-600 hover:text-red-400 text-xs px-2 py-1.5 rounded-full transition-colors"
        >
          ⏹
        </button>
      )}

      <span className="text-gray-700 text-xs">AVN</span>
    </div>
  )
}
