// app/exam-focus/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Modo Focus — página de estudio con música ambient, timer Pomodoro y
// chat con EduAI Claw integrado. Para estudiantes antes/durante el estudio.
// ─────────────────────────────────────────────────────────────────────────────

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import SuperAgentChat from "@/components/superagent/SuperAgentChat"
import {
  recommendMusic,
  getTracksByMood,
  createMusicSession,
} from "@/lib/agents/music-agent"
import type { MusicMood, MusicActivity, MusicTrack } from "@/lib/agents/music-agent"

// ── Tipos ─────────────────────────────────────────────────────────────────────

type PomodoroPhase = "work" | "short_break" | "long_break"

const POMODORO_CONFIG: Record<PomodoroPhase, { label: string; mins: number; color: string }> = {
  work:        { label: "Foco",          mins: 25, color: "text-violet-600" },
  short_break: { label: "Descanso",      mins: 5,  color: "text-emerald-600" },
  long_break:  { label: "Descanso largo",mins: 15, color: "text-sky-600"     },
}

const MOOD_ICONS: Record<MusicMood, string> = {
  focus:     "🎯",
  calm:      "🌿",
  energetic: "⚡",
  nature:    "🌊",
  classical: "🎼",
}

const ACTIVITY_OPTIONS: { value: MusicActivity; label: string; icon: string }[] = [
  { value: "studying",  label: "Estudio general", icon: "📚" },
  { value: "exam",      label: "Preparar examen", icon: "📝" },
  { value: "reading",   label: "Lectura",          icon: "📖" },
  { value: "creative",  label: "Trabajo creativo", icon: "✏️" },
  { value: "break",     label: "Descanso",         icon: "☕" },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function ExamFocusPage() {
  // Pomodoro
  const [phase,       setPhase]     = useState<PomodoroPhase>("work")
  const [timeLeft,    setTimeLeft]  = useState(25 * 60)
  const [running,     setRunning]   = useState(false)
  const [cycles,      setCycles]    = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Música
  const [activity,    setActivity]  = useState<MusicActivity>("studying")
  const [subject,     setSubject]   = useState("")
  const [currentTrack, setCurrentTrack] = useState<MusicTrack | null>(null)
  const [showMusic,   setShowMusic] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Chat
  const [showChat,    setShowChat]  = useState(false)

  // Stats
  const [focusMinutes, setFocusMinutes] = useState(0)

  // ── Pomodoro ───────────────────────────────────────────────────────────────

  const startPhase = useCallback((p: PomodoroPhase) => {
    setPhase(p)
    setTimeLeft(POMODORO_CONFIG[p].mins * 60)
    setRunning(false)
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  useEffect(() => {
    if (!running) return

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          setRunning(false)

          // Auto-avanzar al siguiente ciclo
          if (phase === "work") {
            setFocusMinutes(m => m + POMODORO_CONFIG.work.mins)
            setCycles(c => {
              const next = c + 1
              startPhase(next > 0 && next % 4 === 0 ? "long_break" : "short_break")
              return next
            })
          } else {
            startPhase("work")
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [running, phase, startPhase])

  // ── Música ─────────────────────────────────────────────────────────────────

  const rec = recommendMusic(activity, subject)

  function selectTrack(track: MusicTrack) {
    setCurrentTrack(track)
    setShowMusic(true)
  }

  function stopMusic() {
    setCurrentTrack(null)
    if (iframeRef.current) iframeRef.current.src = ""
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const config = POMODORO_CONFIG[phase]
  const pct    = Math.round((1 - timeLeft / (config.mins * 60)) * 100)

  return (
    <main className="min-h-screen bg-app text-main p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">🎯 Modo Focus</h1>
            <p className="text-sub text-sm mt-0.5">
              Pomodoro · Música · EduAI Claw
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-sub">
            <span>🕐</span>
            <span>{focusMinutes} min de foco hoy</span>
            <span>·</span>
            <span>{cycles} ciclos</span>
          </div>
        </div>

        {/* Grid principal */}
        <div className="grid gap-6 lg:grid-cols-[1fr,380px]">

          {/* ── Columna izquierda: Pomodoro + Música ── */}
          <div className="space-y-5">

            {/* Timer Pomodoro */}
            <div className="rounded-2xl border border-soft bg-card-theme p-6 text-center space-y-5">
              <h2 className="text-sm uppercase tracking-widest text-sub">Temporizador Pomodoro</h2>

              {/* Selector de fase */}
              <div className="flex justify-center gap-2">
                {(Object.entries(POMODORO_CONFIG) as [PomodoroPhase, typeof POMODORO_CONFIG[PomodoroPhase]][])
                  .map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => startPhase(key)}
                      className={[
                        "rounded-xl px-3 py-1.5 text-xs font-medium border transition-all",
                        phase === key
                          ? "border-violet-500/40 bg-violet-500/15 text-violet-700"
                          : "border-soft bg-card-soft-theme text-sub hover:text-main",
                      ].join(" ")}
                    >
                      {cfg.label} {cfg.mins}min
                    </button>
                  ))}
              </div>

              {/* Círculo de progreso */}
              <div className="relative w-44 h-44 mx-auto">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor"
                    strokeWidth="4" className="text-card-soft-theme" />
                  <circle cx="50" cy="50" r="45" fill="none"
                    stroke="currentColor" strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 45}`}
                    strokeDashoffset={`${2 * Math.PI * 45 * (1 - pct / 100)}`}
                    className={config.color}
                    style={{ transition: "stroke-dashoffset 1s linear" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-4xl font-mono font-bold ${config.color}`}>
                    {formatTime(timeLeft)}
                  </span>
                  <span className="text-xs text-sub mt-1">{config.label}</span>
                </div>
              </div>

              {/* Controles */}
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setRunning(r => !r)}
                  className={[
                    "rounded-2xl px-6 py-2.5 text-sm font-semibold border transition-all",
                    running
                      ? "border-orange-400/30 bg-orange-500/10 text-orange-700 hover:bg-orange-500/20"
                      : "border-violet-500/30 bg-violet-600 text-white hover:bg-violet-500",
                  ].join(" ")}
                >
                  {running ? "⏸ Pausar" : "▶ Iniciar"}
                </button>
                <button
                  onClick={() => { setRunning(false); setTimeLeft(config.mins * 60) }}
                  className="rounded-2xl border border-soft bg-card-soft-theme px-4 py-2.5 text-sm text-sub hover:text-main"
                >
                  ↺ Reiniciar
                </button>
              </div>
            </div>

            {/* Selección de actividad */}
            <div className="rounded-2xl border border-soft bg-card-theme p-5">
              <h2 className="text-sm font-semibold text-main mb-3">¿Qué estás haciendo?</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                {ACTIVITY_OPTIONS.map(({ value, label, icon }) => (
                  <button
                    key={value}
                    onClick={() => setActivity(value)}
                    className={[
                      "rounded-2xl border px-3 py-2.5 text-sm text-left transition-all flex items-center gap-2",
                      activity === value
                        ? "border-violet-500/40 bg-violet-500/10 text-violet-700"
                        : "border-soft bg-card-soft-theme text-sub hover:text-main",
                    ].join(" ")}
                  >
                    <span>{icon}</span>
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="flex-1 rounded-xl border border-soft bg-card-soft-theme px-3 py-2 text-sm text-main"
                >
                  <option value="">Sin asignatura específica</option>
                  {["Matemática","Lenguaje","Física","Química","Biología",
                    "Historia","Inglés","Tecnología","Artes"].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Música */}
            <div className="rounded-2xl border border-soft bg-card-theme p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-main">
                  🎵 Música recomendada
                  <span className="ml-2 text-xs text-sub font-normal">
                    {MOOD_ICONS[rec.mood]} {rec.mood}
                  </span>
                </h2>
                {currentTrack && (
                  <button
                    onClick={stopMusic}
                    className="text-xs text-sub hover:text-red-600 border border-soft rounded-xl px-2 py-1"
                  >
                    ⏹ Detener
                  </button>
                )}
              </div>

              <p className="text-xs text-sub">{rec.reason}</p>

              <div className="space-y-2">
                {rec.tracks.map(track => (
                  <button
                    key={track.id}
                    onClick={() => selectTrack(track)}
                    className={[
                      "w-full text-left rounded-2xl border px-4 py-3 transition-all",
                      currentTrack?.id === track.id
                        ? "border-emerald-500/40 bg-emerald-500/10"
                        : "border-soft bg-card-soft-theme hover:border-violet-500/30",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-main">{track.title}</p>
                        <p className="text-xs text-sub mt-0.5">{track.description}</p>
                      </div>
                      <span className="text-lg ml-3">
                        {currentTrack?.id === track.id ? "🔊" : "▶"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Iframe de música */}
              {currentTrack?.embedUrl && (
                <div className="rounded-2xl overflow-hidden border border-soft aspect-video">
                  <iframe
                    ref={iframeRef}
                    src={currentTrack.embedUrl}
                    className="w-full h-full"
                    allow="autoplay"
                    title={currentTrack.title}
                  />
                </div>
              )}

              {/* Tips de estudio */}
              {rec.studyTips.length > 0 && (
                <div className="rounded-2xl bg-card-soft-theme border border-soft p-3 space-y-1">
                  <p className="text-xs font-semibold text-sub uppercase tracking-wide">Tips</p>
                  {rec.studyTips.map((tip, i) => (
                    <p key={i} className="text-xs text-sub">• {tip}</p>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Columna derecha: Chat EduAI Claw ── */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.03] p-1">
              <SuperAgentChat
                context={{
                  page:    "exam-focus",
                  subject: subject || undefined,
                }}
                placeholder="Pregúntame algo sobre tu estudio…"
                initialMessage={`¡Hola! 🦅 Estoy aquí para ayudarte mientras estudias${subject ? ` ${subject}` : ""}.

Puedo:
• Explicar conceptos
• Generar preguntas de práctica
• Resumir textos
• Adaptar contenido para NEE

¿En qué trabajamos?`}
                maxHeight="520px"
                showProviderInfo
              />
            </div>

            {/* Accesos rápidos */}
            <div className="rounded-2xl border border-soft bg-card-theme p-4">
              <p className="text-xs uppercase tracking-widest text-sub mb-3">Accesos rápidos</p>
              <div className="space-y-2">
                {[
                  { icon: "📝", text: `Genera 5 preguntas de práctica de ${subject || "mi asignatura"}` },
                  { icon: "🔬", text: "Explica el concepto que estoy estudiando" },
                  { icon: "📄", text: "Resume en 5 puntos clave lo más importante" },
                  { icon: "♿", text: "Adapta este contenido para dislexia" },
                ].map(({ icon, text }) => (
                  <button
                    key={text}
                    onClick={() => {
                      // Disparar desde el input del chat — workaround sencillo
                      const input = document.querySelector("textarea") as HTMLTextAreaElement | null
                      if (input) {
                        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                          window.HTMLTextAreaElement.prototype, "value"
                        )?.set
                        nativeInputValueSetter?.call(input, text)
                        input.dispatchEvent(new Event("input", { bubbles: true }))
                        input.focus()
                      }
                    }}
                    className="w-full text-left flex items-center gap-2 rounded-xl border border-soft bg-card-soft-theme px-3 py-2 text-xs text-sub hover:text-main hover:border-violet-500/30 transition-all"
                  >
                    <span>{icon}</span>
                    <span>{text}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
