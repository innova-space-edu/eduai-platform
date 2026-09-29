"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  Bot,
  BookOpen,
  FileQuestion,
  ImageIcon,
  Loader2,
  Mic,
  PenLine,
  Plus,
  Send,
  Sparkles,
} from "lucide-react"

type Role = "user" | "assistant"
type Message = { role: Role; content: string }
type Suggestion = { label: string; href: string; emoji: string }
type CapabilityTool = {
  name: string
  label: string
  icon: string
  description: string
  category: string
}
type CapabilityPage = {
  key: string
  label: string
  href: string
  emoji: string
  description: string
  group: string
}
type VoiceState = "idle" | "recording" | "transcribing"

type Props = {
  displayName?: string
  isAdmin?: boolean
}

const MAX_RECORDING_SECONDS = 90

const CREATE_ACTIONS = [
  {
    label: "Planificar clase",
    icon: PenLine,
    prompt: "Quiero planificar una clase. Tema: ",
    hint: "Objetivo, inicio, desarrollo, cierre y evaluación",
  },
  {
    label: "Crear actividad",
    icon: BookOpen,
    prompt: "Quiero crear una actividad de aprendizaje. Tema: ",
    hint: "Actividad aplicable en aula con instrucciones claras",
  },
  {
    label: "Crear evaluación",
    icon: FileQuestion,
    prompt: "Quiero crear una evaluación. Tema: ",
    hint: "Preguntas, pauta, niveles de logro y retroalimentación",
  },
  {
    label: "Crear rúbrica",
    icon: FileQuestion,
    prompt: "Quiero crear una rúbrica para evaluar ",
    hint: "Criterios, indicadores y niveles de desempeño",
  },
  {
    label: "Adaptar para PIE",
    icon: Sparkles,
    prompt: "Necesito adaptar para PIE el siguiente material o actividad: ",
    hint: "Ajustes de acceso, instrucciones y carga cognitiva",
  },
  {
    label: "Crear material visual",
    icon: ImageIcon,
    prompt: "Quiero crear un material visual educativo sobre ",
    hint: "Infografía, apoyo visual o recurso para la clase",
  },
]

function renderInlineContent(text: string) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g)

  return parts.map((part, index) => {
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (link) {
      const href = link[2]
      if (href.startsWith("/")) {
        return (
          <Link
            key={index}
            href={href}
            className="inline-flex items-center gap-1 rounded-lg bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700 hover:bg-violet-200 min-[2048px]:text-sm"
          >
            {link[1]} <ArrowRight size={11} />
          </Link>
        )
      }
      return (
        <a key={index} href={href} target="_blank" rel="noreferrer" className="font-semibold text-blue-700 underline underline-offset-2">
          {link[1]}
        </a>
      )
    }

    const bold = part.match(/^\*\*([^*]+)\*\*$/)
    if (bold) return <strong key={index} className="font-semibold text-main">{bold[1]}</strong>

    const italic = part.match(/^\*([^*\n]+)\*$/)
    if (italic) return <em key={index}>{italic[1]}</em>

    const code = part.match(/^`([^`]+)`$/)
    if (code) return <code key={index} className="rounded-md bg-black/5 px-1.5 py-0.5 text-[0.92em]">{code[1]}</code>

    return <span key={index}>{part.replace(/\*\*/g, "").replace(/__/g, "")}</span>
  })
}

function renderContent(text: string) {
  const lines = String(text || "").replace(/\r/g, "").split("\n")

  return (
    <div className="space-y-1.5 lg:space-y-2 min-[2048px]:space-y-2.5">
      {lines.map((line, index) => {
        const trimmed = line.trim()
        if (!trimmed) return <div key={`space-${index}`} className="h-1" />

        const heading = trimmed.match(/^#{1,4}\s+(.+)$/)
        if (heading) {
          return (
            <p key={index} className="pt-1 font-bold text-main">
              {renderInlineContent(heading[1])}
            </p>
          )
        }

        const bullet = trimmed.match(/^[-*•]\s+(.+)$/)
        if (bullet) {
          return (
            <div key={index} className="flex items-start gap-2">
              <span className="mt-[1px] shrink-0 text-blue-600">•</span>
              <span className="min-w-0">{renderInlineContent(bullet[1])}</span>
            </div>
          )
        }

        const numbered = trimmed.match(/^(\d+)[.)]\s+(.+)$/)
        if (numbered) {
          return (
            <div key={index} className="flex items-start gap-2">
              <span className="shrink-0 font-semibold text-blue-700">{numbered[1]}.</span>
              <span className="min-w-0">{renderInlineContent(numbered[2])}</span>
            </div>
          )
        }

        return <p key={index}>{renderInlineContent(line)}</p>
      })}
    </div>
  )
}

function getRecordingMimeType() {
  if (typeof MediaRecorder === "undefined") return ""
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/mp4",
    "audio/webm",
    "audio/ogg;codecs=opus",
  ]
  return candidates.find((mime) => MediaRecorder.isTypeSupported(mime)) || ""
}

function getAudioExtension(mimeType: string) {
  const mime = mimeType.split(";")[0]
  if (mime === "audio/mp4") return "m4a"
  if (mime === "audio/ogg") return "ogg"
  return "webm"
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const value = String(reader.result || "")
      resolve(value.includes(",") ? value.split(",")[1] : value)
    }
    reader.onerror = () => reject(new Error("No se pudo preparar la grabación"))
    reader.readAsDataURL(blob)
  })
}

function formatRecordingTime(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${String(secs).padStart(2, "0")}`
}

export default function ClawStudyConsole({ displayName = "Docente", isAdmin = false }: Props) {
  const [input, setInput] = useState("")
  const [teacherCourse, setTeacherCourse] = useState("")
  const [teacherSubject, setTeacherSubject] = useState("")
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Hola ${displayName} 👋 Soy Claw, tu asistente de trabajo docente en EduAI. Puedo ayudarte a planificar clases, crear actividades y evaluaciones, construir rúbricas, adaptar materiales para PIE, preparar recursos y revisar ideas. Si falta un dato importante, te preguntaré solo lo necesario para poder avanzar. ¿Qué necesitas preparar hoy?`,
    },
  ])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [voiceState, setVoiceState] = useState<VoiceState>("idle")
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [voiceError, setVoiceError] = useState("")
  const [capabilityTools, setCapabilityTools] = useState<CapabilityTool[]>([])
  const [capabilityPages, setCapabilityPages] = useState<CapabilityPage[]>([])
  const [capabilitiesError, setCapabilitiesError] = useState("")
  const [selectedTool, setSelectedTool] = useState<CapabilityTool | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const recordingChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<number | null>(null)
  const recordingStartedAtRef = useRef(0)

  const contextualPrompt = useMemo(() => {
    const contextBits = [
      teacherCourse ? `Curso: ${teacherCourse}` : "",
      teacherSubject ? `Asignatura: ${teacherSubject}` : "",
    ].filter(Boolean)

    const base = isAdmin
      ? "Modo docente + administración activo. Claw prioriza tareas pedagógicas y puede usar herramientas EduAI cuando corresponda."
      : "Modo docente activo. Claw trabaja como copiloto pedagógico: conversa, pregunta lo mínimo necesario y transforma tus indicaciones en material utilizable."

    return contextBits.length ? `${base} · ${contextBits.join(" · ")}` : base
  }, [isAdmin, teacherCourse, teacherSubject])

  const syncCapabilities = async () => {
    try {
      const response = await fetch("/api/agents/claw-chat", { method: "GET", cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || "No se pudieron cargar las capacidades")

      setCapabilityTools(Array.isArray(data?.tools) ? data.tools : [])
      setCapabilityPages(Array.isArray(data?.pages) ? data.pages : [])
      setCapabilitiesError("")
    } catch {
      setCapabilitiesError("No se pudo sincronizar la lista de herramientas. El chat sigue disponible.")
    }
  }

  useEffect(() => {
    void syncCapabilities()
    // Se sincroniza también cada vez que se abre el panel de herramientas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const transcript = transcriptRef.current
    if (!transcript) return
    requestAnimationFrame(() => {
      transcript.scrollTop = transcript.scrollHeight
    })
  }, [messages, loading, suggestions])

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current !== null) window.clearInterval(recordingTimerRef.current)
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop()
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  const send = async (override?: string) => {
    const text = String(override ?? input).trim()
    if (!text || loading || voiceState === "recording") return

    const requestedToolName = selectedTool?.name
    setInput("")
    setSelectedTool(null)
    setToolsOpen(false)
    setSuggestions([])
    const nextMessages: Message[] = [...messages, { role: "user", content: text }]
    setMessages(nextMessages)
    setLoading(true)

    try {
      const response = await fetch("/api/agents/claw-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: nextMessages.slice(-14),
          pageContext: {
            pathname: "/dashboard",
            pageTitle: "Conversación principal con Claw",
            mode: isAdmin ? "admin_teacher" : "teacher",
            subject: teacherSubject || undefined,
            selectedSubtopic: teacherCourse || undefined,
            availableActions: [
              ...capabilityTools.map((tool) => tool.name),
              "navigate_to_page",
            ],
          },
          userName: displayName,
          requestedTool: requestedToolName,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || "No se pudo responder")

      setMessages((prev) => [...prev, { role: "assistant", content: data.reply || "Listo." }])
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : [])
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: error instanceof Error ? `No pude completar la acción: ${error.message}` : "No pude completar la acción.",
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const transcribeRecording = async (audioBlob: Blob, recorderMime: string) => {
    if (audioBlob.size < 1000) throw new Error("La grabación quedó demasiado corta. Intenta hablar un poco más.")

    const normalizedMime = (recorderMime || audioBlob.type || "audio/webm").split(";")[0]
    const audioBase64 = await blobToBase64(audioBlob)
    const extension = getAudioExtension(normalizedMime)

    const response = await fetch("/api/agents/audio/pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audioBase64,
        mimeType: normalizedMime,
        fileName: `claw-dictado-${Date.now()}.${extension}`,
        fileSizeBytes: audioBlob.size,
        options: {
          mode: "pro",
          improveAudio: false,
          preciseSubtitles: false,
          diarize: false,
          detectLanguage: true,
          createSummary: false,
        },
      }),
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data?.error || "No se pudo transcribir el audio")

    const transcript = String(data?.transcriptClean || data?.transcript || "").trim()
    if (!transcript) throw new Error("No pude detectar palabras claras en la grabación.")

    setInput((current) => {
      const previous = current.trim()
      return previous ? `${previous} ${transcript}` : transcript
    })
    window.setTimeout(() => inputRef.current?.focus(), 80)
  }

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current
    if (recorder?.state === "recording") recorder.stop()
  }

  const startRecording = async () => {
    if (voiceState === "recording") {
      stopRecording()
      return
    }
    if (voiceState === "transcribing" || loading) return

    setVoiceError("")
    setToolsOpen(false)

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceError("Este navegador no permite grabar audio desde el chat.")
      return
    }

    let stream: MediaStream | null = null
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      })

      const mimeType = getRecordingMimeType()
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      mediaStreamRef.current = stream
      mediaRecorderRef.current = recorder
      recordingChunksRef.current = []
      recordingStartedAtRef.current = Date.now()
      setRecordingSeconds(0)
      setVoiceState("recording")

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data)
      }

      recorder.onerror = () => {
        setVoiceError("La grabación se interrumpió. Revisa el permiso del micrófono e inténtalo otra vez.")
      }

      recorder.onstop = async () => {
        if (recordingTimerRef.current !== null) {
          window.clearInterval(recordingTimerRef.current)
          recordingTimerRef.current = null
        }

        const chunks = recordingChunksRef.current
        recordingChunksRef.current = []
        const recordedMime = recorder.mimeType || mimeType || "audio/webm"
        const audioBlob = new Blob(chunks, { type: recordedMime })

        mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
        mediaStreamRef.current = null
        mediaRecorderRef.current = null
        setVoiceState("transcribing")

        try {
          await transcribeRecording(audioBlob, recordedMime)
        } catch (error) {
          setVoiceError(error instanceof Error ? error.message : "No se pudo transcribir la grabación.")
        } finally {
          setVoiceState("idle")
          setRecordingSeconds(0)
        }
      }

      recorder.start(250)
      recordingTimerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartedAtRef.current) / 1000)
        setRecordingSeconds(elapsed)
        if (elapsed >= MAX_RECORDING_SECONDS && mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop()
        }
      }, 250)
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop())
      setVoiceState("idle")
      setVoiceError(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Necesito permiso para usar el micrófono. Habilítalo en el navegador y vuelve a intentarlo."
          : "No pude acceder al micrófono. Revisa que esté conectado y disponible.",
      )
    }
  }

  const handleCreateAction = (prompt: string) => {
    setSelectedTool(null)
    setInput(prompt)
    setToolsOpen(false)
    setTimeout(() => inputRef.current?.focus(), 60)
  }

  const handleCapabilityTool = (tool: CapabilityTool) => {
    setSelectedTool(tool)
    setInput("")
    setToolsOpen(false)
    setTimeout(() => inputRef.current?.focus(), 60)
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-soft bg-card-theme shadow-sm animate-fade-in lg:rounded-[1.75rem] min-[2048px]:rounded-[2.25rem]">
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-soft px-3 py-3 lg:gap-4 lg:px-5 lg:py-4 min-[2048px]:px-8 min-[2048px]:py-5">
        <div className="flex min-w-0 items-start gap-2 lg:gap-3 min-[2048px]:gap-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-500/20 lg:h-10 lg:w-10 lg:rounded-2xl min-[2048px]:h-12 min-[2048px]:w-12">
            <Bot size={18} className="min-[2048px]:h-6 min-[2048px]:w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-black text-main lg:text-lg min-[2048px]:text-xl">Claw — Copiloto Docente EduAI</h1>
            <p className="mt-0.5 hidden text-xs leading-relaxed text-muted2 lg:block min-[2048px]:text-sm">
              Planifica, crea, adapta, revisa y continúa el trabajo desde una sola conversación.
            </p>
          </div>
        </div>
        <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700 lg:inline-flex min-[2048px]:px-4 min-[2048px]:py-1.5 min-[2048px]:text-xs">
          activo
        </span>
      </div>

      <div
        ref={transcriptRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-app/40 px-2.5 py-3 lg:space-y-4 lg:px-5 lg:py-5 min-[2048px]:space-y-5 min-[2048px]:px-8 min-[2048px]:py-7"
      >
        <div className="mx-auto flex w-full max-w-none items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/70 px-2.5 py-2 text-[10px] text-violet-800 lg:max-w-[980px] lg:rounded-2xl lg:px-3 lg:text-xs min-[2048px]:max-w-[1280px] min-[2048px]:px-4 min-[2048px]:py-2.5 min-[2048px]:text-sm">
          <Sparkles size={13} className="shrink-0" />
          <span>{contextualPrompt}</span>
        </div>

        <div className="mx-auto w-full max-w-none space-y-3 lg:max-w-[980px] lg:space-y-4 min-[2048px]:max-w-[1280px] min-[2048px]:space-y-5">
          {messages.length === 1 && (
            <div className="rounded-2xl border border-soft bg-card-soft-theme p-3 lg:rounded-3xl lg:p-4">
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black text-main lg:text-sm">¿Qué quieres hacer?</p>
                  <p className="mt-0.5 text-[10px] text-muted2 lg:text-[11px]">Elige una tarea y completa el tema o material en el cuadro de mensaje.</p>
                </div>
                <span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-bold text-blue-700 lg:text-[10px]">Docente</span>
              </div>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {CREATE_ACTIONS.map((action) => {
                  const Icon = action.icon
                  return (
                    <button
                      key={`quick-${action.label}`}
                      type="button"
                      onClick={() => handleCreateAction(action.prompt)}
                      className="flex min-w-0 items-center gap-2 rounded-xl border border-soft bg-card-theme px-2.5 py-2 text-left transition hover:border-blue-200 hover:bg-blue-50/50 lg:rounded-2xl lg:px-3 lg:py-2.5"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                        <Icon size={15} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-bold text-main lg:text-xs">{action.label}</p>
                        <p className="truncate text-[9px] text-muted2 lg:text-[10px]">{action.hint}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[94%] rounded-2xl px-3 py-2.5 text-[13px] leading-5 shadow-sm lg:max-w-[86%] lg:rounded-3xl lg:px-4 lg:py-3 lg:text-sm lg:leading-6 min-[2048px]:max-w-[80%] min-[2048px]:px-5 min-[2048px]:py-4 min-[2048px]:text-base min-[2048px]:leading-7 ${
                  message.role === "user"
                    ? "rounded-br-md bg-blue-600 text-white lg:rounded-br-lg"
                    : "rounded-bl-md border border-soft bg-card-soft-theme text-main lg:rounded-bl-lg"
                }`}
              >
                {message.role === "assistant" ? renderContent(message.content) : <p className="whitespace-pre-wrap">{message.content}</p>}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-soft bg-card-soft-theme px-3 py-2.5 text-[11px] text-muted2 shadow-sm lg:rounded-3xl lg:rounded-bl-lg lg:px-4 lg:py-3 lg:text-xs min-[2048px]:text-sm">
                <Loader2 size={14} className="animate-spin" /> Claw está pensando...
              </div>
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 lg:gap-2">
              {suggestions.map((suggestion) => (
                <Link
                  key={`${suggestion.href}-${suggestion.label}`}
                  href={suggestion.href}
                  className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700 hover:bg-violet-100 lg:px-3 lg:py-1.5 lg:text-[11px] min-[2048px]:text-xs"
                >
                  {suggestion.emoji} {suggestion.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="relative shrink-0 border-t border-soft bg-card-theme px-2 py-2 lg:px-5 lg:py-4 min-[2048px]:px-8 min-[2048px]:py-5">
        {toolsOpen && (
          <div className="absolute bottom-[calc(100%-4px)] left-2 z-30 w-[min(340px,calc(100vw-76px))] overflow-hidden rounded-2xl border border-soft bg-card-theme p-2 shadow-2xl lg:left-6 lg:w-[380px] lg:rounded-3xl min-[2048px]:w-[440px] min-[2048px]:p-3">
            <div className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-muted2 lg:text-[11px] min-[2048px]:text-xs">Contexto docente</div>
            <div className="grid grid-cols-2 gap-1.5 px-1 pb-2">
              <input
                value={teacherCourse}
                onChange={(event) => setTeacherCourse(event.target.value)}
                placeholder="Curso, ej. 2° Medio"
                className="min-w-0 rounded-xl border border-soft bg-card-soft-theme px-2.5 py-2 text-[11px] text-main outline-none placeholder:text-muted2 focus:border-blue-200 lg:text-xs"
              />
              <input
                value={teacherSubject}
                onChange={(event) => setTeacherSubject(event.target.value)}
                placeholder="Asignatura"
                className="min-w-0 rounded-xl border border-soft bg-card-soft-theme px-2.5 py-2 text-[11px] text-main outline-none placeholder:text-muted2 focus:border-blue-200 lg:text-xs"
              />
            </div>
            <p className="px-2 pb-2 text-[9px] leading-relaxed text-muted2 lg:text-[10px]">
              Opcional. Claw usará este contexto durante la conversación y evitará volver a preguntarlo.
            </p>

            <div className="border-t border-soft px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted2 lg:text-[11px] min-[2048px]:text-xs">Acciones docentes</div>
            <div className="grid gap-1">
              {CREATE_ACTIONS.map((action) => {
                const Icon = action.icon
                return (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => handleCreateAction(action.prompt)}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition hover:bg-blue-50 lg:gap-3 lg:rounded-2xl lg:px-3 lg:py-2.5 min-[2048px]:py-3"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 lg:h-9 lg:w-9 lg:rounded-xl min-[2048px]:h-10 min-[2048px]:w-10">
                      <Icon size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-main lg:text-sm min-[2048px]:text-[15px]">{action.label}</p>
                      <p className="text-[10px] text-muted2 lg:text-[11px] min-[2048px]:text-xs">{action.hint}</p>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="my-2 border-t border-soft" />
            <div className="flex items-center justify-between gap-2 px-2 pb-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted2 lg:text-[11px] min-[2048px]:text-xs">Herramientas activas</div>
              <button
                type="button"
                onClick={() => void syncCapabilities()}
                className="text-[9px] font-bold text-blue-600 hover:text-blue-700 lg:text-[10px]"
              >
                Actualizar
              </button>
            </div>
            {capabilityTools.length > 0 ? (
              <div className="grid max-h-36 grid-cols-2 gap-1 overflow-y-auto pr-1">
                {capabilityTools.map((tool) => (
                  <button
                    key={tool.name}
                    type="button"
                    onClick={() => handleCapabilityTool(tool)}
                    className="min-w-0 rounded-xl px-2.5 py-2 text-left transition hover:bg-blue-50 lg:rounded-2xl"
                    title={tool.description}
                  >
                    <div className="truncate text-[11px] font-bold text-main lg:text-xs">{tool.icon} {tool.label}</div>
                    <div className="mt-0.5 truncate text-[9px] text-muted2 lg:text-[10px]">{tool.description}</div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="px-2 py-2 text-[9px] text-muted2 lg:text-[10px]">
                {capabilitiesError || "Sincronizando herramientas…"}
              </p>
            )}

            <div className="my-2 border-t border-soft" />
            <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted2 lg:text-[11px] min-[2048px]:text-xs">Módulos EduAI sincronizados</div>
            {capabilityPages.length > 0 ? (
              <div className="grid max-h-32 grid-cols-2 gap-1 overflow-y-auto pr-1">
                {capabilityPages.map((page) => (
                  <Link
                    key={page.key}
                    href={page.href}
                    onClick={() => setToolsOpen(false)}
                    className="min-w-0 rounded-xl px-2.5 py-2 transition hover:bg-violet-50 lg:rounded-2xl"
                    title={page.description}
                  >
                    <div className="truncate text-[11px] font-bold text-main lg:text-xs">{page.emoji} {page.label}</div>
                    <div className="mt-0.5 truncate text-[9px] text-muted2 lg:text-[10px]">{page.description}</div>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        )}

        <div className="mx-auto w-full max-w-none rounded-2xl border border-soft bg-card-soft-theme p-1.5 shadow-sm transition focus-within:border-blue-200 focus-within:shadow-md lg:max-w-[980px] lg:rounded-[1.5rem] lg:p-2 min-[2048px]:max-w-[1280px] min-[2048px]:rounded-[1.8rem] min-[2048px]:p-2.5">
          {selectedTool && (
            <div className="mx-2 mt-1 flex items-center justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-[10px] text-blue-800 lg:text-[11px]">
              <span className="min-w-0 truncate">
                {selectedTool.icon} Herramienta seleccionada: <strong>{selectedTool.label}</strong>
              </span>
              <button
                type="button"
                onClick={() => setSelectedTool(null)}
                className="shrink-0 rounded-full px-1.5 py-0.5 font-black hover:bg-blue-100"
                aria-label="Quitar herramienta seleccionada"
              >
                ×
              </button>
            </div>
          )}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => {
              setInput(event.target.value)
              if (voiceError) setVoiceError("")
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                send()
              }
            }}
            rows={2}
            placeholder={
              voiceState === "recording"
                ? "Te escucho… pulsa el micrófono otra vez para terminar."
                : voiceState === "transcribing"
                  ? "Transcribiendo tu grabación con alta precisión…"
                  : "Describe lo que necesitas: clase, actividad, evaluación, rúbrica, adaptación PIE, material o una consulta docente..."
            }
            className="min-h-[52px] max-h-28 w-full resize-none overflow-y-auto bg-transparent px-2.5 py-2 text-[13px] text-main outline-none placeholder:text-muted2 lg:min-h-[64px] lg:max-h-32 lg:px-3 lg:text-sm min-[2048px]:min-h-[76px] min-[2048px]:max-h-40 min-[2048px]:px-4 min-[2048px]:py-3 min-[2048px]:text-base"
            disabled={loading || voiceState === "transcribing"}
          />

          <div className="flex items-center justify-between gap-2 border-t border-soft px-1 pt-1.5 lg:pt-2 min-[2048px]:pt-2.5">
            <div className="flex min-w-0 items-center gap-1 lg:gap-2">
              <button
                type="button"
                onClick={() => {
                  const next = !toolsOpen
                  setToolsOpen(next)
                  if (next) void syncCapabilities()
                }}
                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition lg:h-10 lg:w-10 min-[2048px]:h-11 min-[2048px]:w-11 ${
                  toolsOpen
                    ? "rotate-45 border-blue-200 bg-blue-50 text-blue-700"
                    : "border-soft bg-card-theme text-main hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                }`}
                aria-label="Abrir acciones y contexto docente"
                title="Acciones docentes, contexto y herramientas"
              >
                <Plus size={19} className="min-[2048px]:h-5 min-[2048px]:w-5" />
              </button>

              <button
                type="button"
                onClick={startRecording}
                disabled={voiceState === "transcribing" || (loading && voiceState !== "recording")}
                className={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-transparent transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-40 lg:h-10 lg:w-10 min-[2048px]:h-11 min-[2048px]:w-11 ${
                  voiceState === "recording"
                    ? "text-red-500"
                    : "text-muted2 hover:text-blue-600"
                }`}
                aria-label={voiceState === "recording" ? "Detener grabación" : "Dictar mensaje por voz"}
                title={voiceState === "recording" ? "Detener y transcribir" : "Dictar por voz"}
              >
                {voiceState === "recording" && (
                  <span className="absolute inset-1 rounded-full border border-red-300/80 motion-safe:animate-ping" />
                )}
                {voiceState === "transcribing" ? (
                  <Loader2 size={19} className="animate-spin min-[2048px]:h-5 min-[2048px]:w-5" />
                ) : (
                  <Mic size={20} strokeWidth={2.1} className="relative min-[2048px]:h-[22px] min-[2048px]:w-[22px]" />
                )}
              </button>

              {voiceState === "recording" && (
                <span className="truncate text-[10px] font-semibold tabular-nums text-red-500 lg:text-[11px] min-[2048px]:text-xs">
                  Grabando {formatRecordingTime(recordingSeconds)}
                </span>
              )}
              {voiceState === "transcribing" && (
                <span className="truncate text-[10px] font-semibold text-blue-600 lg:text-[11px] min-[2048px]:text-xs">
                  Transcribiendo…
                </span>
              )}
              {voiceState === "idle" && voiceError && (
                <span className="max-w-[230px] truncate text-[10px] text-red-500 lg:max-w-[360px] lg:text-[11px] min-[2048px]:max-w-[520px] min-[2048px]:text-xs" title={voiceError}>
                  {voiceError}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => send()}
              disabled={loading || voiceState !== "idle" || !input.trim()}
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-blue-600 px-3 text-[11px] font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40 lg:h-10 lg:px-4 lg:text-xs min-[2048px]:h-11 min-[2048px]:px-5 min-[2048px]:text-sm"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              <span className="hidden lg:inline">Enviar</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
