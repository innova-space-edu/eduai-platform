// components/exam/ExamAudioButton.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Botón de narración de preguntas para el examen del estudiante.
// Usa el VoiceAgent (Edge TTS existente) para leer la pregunta en voz alta.
// Se integra en app/examen/p/[code]/page.tsx sin romper nada.
// ─────────────────────────────────────────────────────────────────────────────

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  buildQuestionNarrationText,
  releaseAudioUrl,
} from "@/lib/agents/voice-agent"

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ExamAudioButtonProps {
  questionText:   string
  questionNumber: number
  questionType:   "multiple_choice" | "true_false" | "development"
  options?:       string[]
  pieMode?:       boolean     // velocidad lenta
  compact?:       boolean     // solo ícono sin texto
}

// ── Estados del botón ─────────────────────────────────────────────────────────

type AudioState = "idle" | "loading" | "playing" | "error"

// ── Componente ────────────────────────────────────────────────────────────────

export default function ExamAudioButton({
  questionText,
  questionNumber,
  questionType,
  options,
  pieMode = false,
  compact = false,
}: ExamAudioButtonProps) {
  const [state,    setState]    = useState<AudioState>("idle")
  const [errorMsg, setErrorMsg] = useState<string>("")
  const audioRef   = useRef<HTMLAudioElement | null>(null)
  const blobUrlRef = useRef<string | null>(null)

  // Limpiar audio al desmontar o cambiar pregunta
  useEffect(() => {
    return () => {
      stopAudio()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionNumber])

  function stopAudio() {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ""
      audioRef.current = null
    }
    releaseAudioUrl(blobUrlRef.current ?? undefined)
    blobUrlRef.current = null
    setState("idle")
  }

  const handleClick = useCallback(async () => {
    // Si está reproduciendo, detener
    if (state === "playing") {
      stopAudio()
      return
    }

    // Si está cargando, ignorar
    if (state === "loading") return

    setState("loading")
    setErrorMsg("")

    try {
      const text = buildQuestionNarrationText(
        questionText,
        questionNumber,
        questionType,
        options
      )

      const res = await fetch("/api/agents/tts", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          speaker:      "B",          // voz femenina (ElviraNeural)
          rate:         pieMode ? "-25%" : "+0%",
          motivational: false,
        }),
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => "")
        throw new Error(`TTS error ${res.status}: ${errText.slice(0, 80)}`)
      }

      const blob   = await res.blob()
      const url    = URL.createObjectURL(blob)
      blobUrlRef.current = url

      const audio  = new Audio(url)
      audioRef.current = audio

      audio.onended = () => {
        setState("idle")
        releaseAudioUrl(url)
        blobUrlRef.current = null
      }

      audio.onerror = () => {
        setState("error")
        setErrorMsg("Error al reproducir el audio.")
        releaseAudioUrl(url)
        blobUrlRef.current = null
      }

      await audio.play()
      setState("playing")
    } catch (err) {
      console.error("[ExamAudioButton]", err)
      setState("error")
      setErrorMsg(err instanceof Error ? err.message : "Error al generar audio.")
      // Auto-reset después de 3 segundos
      setTimeout(() => setState("idle"), 3000)
    }
  }, [state, questionText, questionNumber, questionType, options, pieMode])

  // ── Labels y estilos por estado ───────────────────────────────────────────

  const config = {
    idle: {
      icon:  "🔊",
      label: compact ? "" : "Escuchar",
      style: "border-soft bg-card-soft-theme text-sub hover:text-main hover:border-blue-400/30",
      title: "Escuchar pregunta",
    },
    loading: {
      icon:  "⏳",
      label: compact ? "" : "Cargando…",
      style: "border-soft bg-card-soft-theme text-sub opacity-70 cursor-wait",
      title: "Generando audio…",
    },
    playing: {
      icon:  "⏹",
      label: compact ? "" : "Detener",
      style: "border-blue-500/40 bg-blue-500/15 text-blue-700 hover:bg-blue-500/25",
      title: "Detener narración",
    },
    error: {
      icon:  "⚠️",
      label: compact ? "" : "Error",
      style: "border-red-400/30 bg-red-500/10 text-red-600 cursor-default",
      title: errorMsg || "Error al generar audio",
    },
  }[state]

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={handleClick}
        disabled={state === "loading" || state === "error"}
        title={config.title}
        aria-label={config.title}
        className={[
          "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition-all",
          config.style,
          compact ? "px-2 py-1" : "",
        ].join(" ")}
      >
        <span className={state === "loading" ? "animate-pulse" : ""}>{config.icon}</span>
        {!compact && config.label && (
          <span>{config.label}</span>
        )}
        {state === "playing" && !compact && (
          <span className="flex gap-0.5 items-end h-3.5">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="w-0.5 bg-blue-600 rounded-full animate-bounce"
                style={{
                  height: `${[60, 100, 70][i]}%`,
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </span>
        )}
      </button>

      {state === "error" && errorMsg && (
        <p className="text-xs text-red-600 max-w-[200px]">{errorMsg}</p>
      )}
    </div>
  )
}
