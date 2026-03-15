"use client"

import { useEffect, useMemo, useRef, useState } from "react"

interface Props {
  text: string
  autoPlay?: boolean
  addMotivation?: boolean
}

type NarrationMode = "explicacion" | "refuerzo"

const MOTIVATIONAL = [
  "Excelente, sigue así.",
  "Muy bien, vamos paso a paso.",
  "Tómate un segundo para pensar la idea principal.",
  "Lo estás haciendo muy bien, continúa.",
  "Perfecto, ahora conecta esta idea con lo que ya aprendiste.",
]

function cleanForSegmentation(text: string) {
  return String(text || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/\$\$([\s\S]*?)\$\$/g, " Fórmula matemática importante. ")
    .replace(/\$([^$]+)\$/g, " Expresión matemática. ")
    .replace(/---FOLLOWUPS---[\s\S]*/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[[^\]]+\]\([^)]*\)/g, "$1")
    .replace(/[>#*_~]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s{2,}/g, " ")
    .trim()
}

function splitForNarration(text: string) {
  const clean = cleanForSegmentation(text)
  if (!clean) return { explanation: "", reinforcement: "" }

  const normalized = clean
    .replace(/\n\n+/g, " \n ")
    .replace(/\n/g, " ")
    .trim()

  if (normalized.length <= 700) {
    return { explanation: normalized, reinforcement: "" }
  }

  const sentences = normalized.split(/(?<=[.!?])\s+/).filter(Boolean)
  const first: string[] = []
  const second: string[] = []
  let acc = 0
  const target = Math.min(Math.max(Math.floor(normalized.length * 0.72), 650), 1050)

  for (const sentence of sentences) {
    if (acc < target || first.length === 0) {
      first.push(sentence)
      acc += sentence.length
    } else {
      second.push(sentence)
    }
  }

  return {
    explanation: first.join(" ").trim(),
    reinforcement: second.join(" ").trim(),
  }
}

// ── Waveform animado (solo visual, no afecta lógica) ─────────────────────────
function WaveformBars({ active }: { active: boolean }) {
  const heights = [3, 5, 4, 6, 3, 5, 4]
  return (
    <div className="flex items-center gap-[3px] h-4">
      {heights.map((h, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full"
          style={{
            height: active ? `${h * 2.5}px` : "3px",
            background: active ? "#60a5fa" : "rgba(148,163,184,0.3)",
            transition: `height 0.15s ease ${i * 0.05}s`,
            animation: active
              ? `waveBar 0.7s ease-in-out ${i * 0.1}s infinite alternate`
              : "none",
          }}
        />
      ))}
      <style>{`
        @keyframes waveBar {
          from { transform: scaleY(0.4); }
          to   { transform: scaleY(1); }
        }
      `}</style>
    </div>
  )
}

export default function VoiceNarrator({ text, autoPlay = false, addMotivation = false }: Props) {
  const [loading, setLoading] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState("")
  const hasPlayedRef = useRef(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const narration = useMemo(() => splitForNarration(text), [text])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ""
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current)
        audioUrlRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    hasPlayedRef.current = false
  }, [text])

  useEffect(() => {
    if (autoPlay && text && !hasPlayedRef.current) {
      hasPlayedRef.current = true
      const timer = setTimeout(() => {
        void speak()
      }, 700)
      return () => clearTimeout(timer)
    }
  }, [autoPlay, text, narration.explanation, narration.reinforcement])

  async function requestSegment(segmentText: string, mode: NarrationMode) {
    const speaker = mode === "refuerzo" ? "B" : "A"
    const res = await fetch("/api/agents/tts-chunk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        segments: [{ speaker, text: segmentText }],
      }),
      signal: abortRef.current?.signal,
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      throw new Error(detail || `Error TTS ${res.status}`)
    }

    return new Uint8Array(await res.arrayBuffer())
  }

  function concatArrays(parts: Uint8Array[]) {
    const total = parts.reduce((sum, part) => sum + part.byteLength, 0)
    const merged = new Uint8Array(total)
    let offset = 0
    for (const part of parts) {
      merged.set(part, offset)
      offset += part.byteLength
    }
    return merged
  }

  async function speak() {
    if (!text?.trim()) return

    setLoading(true)
    setError("")
    setPlaying(false)

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    try {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ""
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current)
        audioUrlRef.current = null
      }

      const parts: Uint8Array[] = []

      if (narration.explanation) {
        parts.push(await requestSegment(narration.explanation, "explicacion"))
      }

      const reinforcementPieces: string[] = []
      if (narration.reinforcement) reinforcementPieces.push(narration.reinforcement)
      if (addMotivation) {
        reinforcementPieces.push(MOTIVATIONAL[Math.floor(Math.random() * MOTIVATIONAL.length)])
      }

      if (reinforcementPieces.length > 0) {
        parts.push(await requestSegment(reinforcementPieces.join(" "), "refuerzo"))
      }

      const merged = concatArrays(parts)
      const blob = new Blob([merged], { type: "audio/mpeg" })
      const url = URL.createObjectURL(blob)
      audioUrlRef.current = url

      const audio = new Audio(url)
      audioRef.current = audio
      audio.onplay  = () => setPlaying(true)
      audio.onended = () => setPlaying(false)
      audio.onpause = () => setPlaying(false)

      await audio.play()
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        console.error("Voice narrator error:", err)
        setError("No se pudo narrar este bloque.")
      }
    } finally {
      setLoading(false)
    }
  }

  function stop() {
    abortRef.current?.abort()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setPlaying(false)
    }
  }

  // ── Solo el return cambió ──────────────────────────────────────────────────
  return (
    <div className="flex items-center gap-3 mt-3 flex-wrap">

      {/* Botón player */}
      <button
        onClick={playing ? stop : () => void speak()}
        disabled={loading}
        className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background:  playing ? "rgba(239,68,68,0.08)"  : "rgba(59,130,246,0.08)",
          borderColor: playing ? "rgba(239,68,68,0.2)"   : "rgba(59,130,246,0.2)",
        }}
      >
        {/* Spinner o ícono */}
        {loading ? (
          <span
            className="w-3.5 h-3.5 rounded-full border-2 animate-spin"
            style={{ borderColor: "rgba(59,130,246,0.2)", borderTopColor: "#60a5fa" }}
          />
        ) : (
          <span className="text-sm leading-none" style={{ color: playing ? "#f87171" : "#93c5fd" }}>
            {playing ? "⏹" : "▶"}
          </span>
        )}

        {/* Waveform animado */}
        <WaveformBars active={playing} />

        {/* Texto del botón */}
        <span
          className="text-xs font-medium"
          style={{ color: playing ? "#f87171" : "#93c5fd" }}
        >
          {loading ? "Generando voz..." : playing ? "Detener narración" : "Escuchar narración"}
        </span>
      </button>

      {/* Info voces — igual que antes */}
      <span className="text-[11px] text-gray-500">
        Voz A: Álvaro · Voz B: Elvira
      </span>

      {error && <span className="text-[11px] text-red-400">{error}</span>}
    </div>
  )
}
