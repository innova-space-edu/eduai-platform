"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import {
  ArrowLeft, Upload, Mic, FileAudio, Loader2,
  Sparkles, FileText, ClipboardList, AlignLeft,
  CheckSquare, Wand2, Download, Copy, Check,
  ChevronDown, ChevronUp, Trash2, Clock
} from "lucide-react"

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface Speaker { id: string; estimatedRole: string }

interface Transcription {
  id: string
  file_name: string
  file_size_bytes: number | null
  duration_hint: string | null
  status: string
  transcript_raw: string
  transcript_clean: string
  summary: string
  language: string
  speakers: Speaker[]
  created_at: string
}

type Operation = "clean" | "notes" | "minutes" | "summary" | "actions" | "custom"
type ExportFormat = "txt" | "srt" | "vtt" | "md"

// ── Constantes ────────────────────────────────────────────────────────────────
const ACCEPTED_FORMATS = ".mp3,.wav,.m4a,.mp4,.webm"
const MAX_SIZE_MB = 50
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

const OPERATIONS: { id: Operation; icon: React.ElementType; label: string; desc: string }[] = [
  { id: "clean",   icon: Wand2,         label: "Limpiar",      desc: "Corrige puntuación y elimina muletillas"    },
  { id: "notes",   icon: FileText,      label: "Apuntes",      desc: "Clase → apuntes estructurados con títulos"  },
  { id: "minutes", icon: ClipboardList, label: "Acta",         desc: "Reunión → acta formal con acuerdos"         },
  { id: "summary", icon: AlignLeft,     label: "Resumen",      desc: "Resumen ejecutivo en puntos clave"          },
  { id: "actions", icon: CheckSquare,   label: "Tareas",       desc: "Extrae tareas y compromisos mencionados"    },
  { id: "custom",  icon: Sparkles,      label: "Personalizar", desc: "Instrucción libre sobre la transcripción"   },
]

const MIME_MAP: Record<string, string> = {
  mp3: "audio/mpeg",  wav: "audio/wav",  m4a: "audio/mp4",
  mp4: "audio/mp4",  webm: "audio/webm",
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatBytes(bytes: number | null): string {
  if (!bytes) return ""
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return "ahora"
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

// ── Exportadores de texto ─────────────────────────────────────────────────────
function exportTXT(text: string, fileName: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a"); a.href = url; a.download = `${fileName}.txt`; a.click()
  URL.revokeObjectURL(url)
}

function exportMarkdown(text: string, fileName: string) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a"); a.href = url; a.download = `${fileName}.md`; a.click()
  URL.revokeObjectURL(url)
}

function textToSRT(text: string): string {
  // Divide el texto en bloques y genera SRT básico
  const lines = text.split("\n").filter(l => l.trim())
  let srt = ""; let idx = 1; let time = 0
  for (const line of lines) {
    if (!line.trim()) continue
    const dur = Math.max(3, Math.ceil(line.length / 20))
    const start = new Date(time * 1000).toISOString().substring(11, 23).replace(".", ",")
    time += dur
    const end   = new Date(time * 1000).toISOString().substring(11, 23).replace(".", ",")
    srt += `${idx}\n${start} --> ${end}\n${line.trim()}\n\n`
    idx++
  }
  return srt
}

function textToVTT(text: string): string {
  return "WEBVTT\n\n" + textToSRT(text).replace(/,/g, ".")
}

function exportSubtitle(text: string, fileName: string, format: "srt" | "vtt") {
  const content = format === "srt" ? textToSRT(text) : textToVTT(text)
  const mime    = format === "srt" ? "text/plain" : "text/vtt"
  const blob    = new Blob([content], { type: `${mime};charset=utf-8` })
  const url     = URL.createObjectURL(blob)
  const a       = document.createElement("a"); a.href = url; a.download = `${fileName}.${format}`; a.click()
  URL.revokeObjectURL(url)
}

// ═════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════════
export default function AudioLabPage() {
  const router   = useRouter()
  const supabase = createClient()

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/login")
    })
  }, [])

  // ── State: upload ─────────────────────────────────────────────────────────
  const [dragActive,    setDragActive]    = useState(false)
  const [selectedFile,  setSelectedFile]  = useState<File | null>(null)
  const [uploading,     setUploading]     = useState(false)
  const [uploadError,   setUploadError]   = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── State: transcripción activa ───────────────────────────────────────────
  const [activeTranscription, setActiveTranscription] = useState<Transcription | null>(null)
  const [editedText,          setEditedText]          = useState("")

  // ── State: operaciones ────────────────────────────────────────────────────
  const [selectedOp,       setSelectedOp]       = useState<Operation>("summary")
  const [customInstruction, setCustomInstruction] = useState("")
  const [opResult,          setOpResult]          = useState("")
  const [opLoading,         setOpLoading]         = useState(false)
  const [opError,           setOpError]           = useState("")

  // ── State: historial ──────────────────────────────────────────────────────
  const [history,        setHistory]        = useState<Transcription[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [showHistory,    setShowHistory]    = useState(false)

  // ── State: copied ─────────────────────────────────────────────────────────
  const [copied, setCopied] = useState(false)

  // ── Cargar historial ──────────────────────────────────────────────────────
  useEffect(() => {
    loadHistory()
  }, [])

  async function loadHistory() {
    setHistoryLoading(true)
    const { data } = await supabase
      .from("audio_transcriptions")
      .select("*")
      .eq("status", "done")
      .order("created_at", { ascending: false })
      .limit(20)
    setHistory(data || [])
    setHistoryLoading(false)
  }

  // ── Validar archivo ───────────────────────────────────────────────────────
  function validateFile(file: File): string | null {
    if (file.size > MAX_SIZE_BYTES) return `El archivo pesa ${(file.size/1024/1024).toFixed(1)} MB. Máximo ${MAX_SIZE_MB} MB.`
    const ext = file.name.split(".").pop()?.toLowerCase() || ""
    if (!MIME_MAP[ext]) return `Formato no soportado: .${ext}. Usa MP3, WAV, M4A, MP4 o WEBM.`
    return null
  }

  function handleFileSelect(file: File) {
    setUploadError("")
    const err = validateFile(file)
    if (err) { setUploadError(err); return }
    setSelectedFile(file)
    setActiveTranscription(null)
    setOpResult("")
    setEditedText("")
  }

  // ── Drag & Drop ───────────────────────────────────────────────────────────
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    setDragActive(e.type === "dragenter" || e.type === "dragover")
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileSelect(file)
  }, [])

  // ── Transcribir ───────────────────────────────────────────────────────────
  async function handleTranscribe() {
    if (!selectedFile) return
    setUploading(true)
    setUploadError("")

    try {
      // Leer como base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload  = () => resolve((reader.result as string).split(",")[1])
        reader.onerror = () => reject(new Error("Error leyendo el archivo"))
        reader.readAsDataURL(selectedFile)
      })

      const ext      = selectedFile.name.split(".").pop()?.toLowerCase() || "mp3"
      const mimeType = MIME_MAP[ext] || "audio/mpeg"

      const res  = await fetch("/api/agents/transcription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64:  base64,
          mimeType,
          fileName:     selectedFile.name,
          fileSizeBytes: selectedFile.size,
        }),
      })

      const data = await res.json()
      if (!data.success) throw new Error(data.error || "Error transcribiendo")

      // Recargar historial y mostrar resultado
      await loadHistory()

      // Construir objeto local para mostrar
      const newTranscription: Transcription = {
        id:              data.id,
        file_name:       selectedFile.name,
        file_size_bytes: selectedFile.size,
        duration_hint:   data.durationEstimate || "",
        status:          "done",
        transcript_raw:  data.transcript,
        transcript_clean: data.transcript,
        summary:         "",
        language:        data.language,
        speakers:        data.speakers || [],
        created_at:      new Date().toISOString(),
      }

      setActiveTranscription(newTranscription)
      setEditedText(data.transcript)
      setSelectedFile(null)
      setOpResult("")

    } catch (err: any) {
      setUploadError(err.message || "Error inesperado")
    } finally {
      setUploading(false)
    }
  }

  // ── Ejecutar operación ────────────────────────────────────────────────────
  async function handleOperation() {
    if (!editedText.trim() || !activeTranscription) return
    setOpLoading(true)
    setOpError("")
    setOpResult("")

    try {
      const res = await fetch("/api/agents/transcript-editor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcriptionId:    activeTranscription.id,
          transcript:         editedText,
          operation:          selectedOp,
          customInstruction:  customInstruction,
        }),
      })

      const data = await res.json()
      if (!data.success) throw new Error(data.error || "Error procesando")
      setOpResult(data.output)

    } catch (err: any) {
      setOpError(err.message || "Error procesando la transcripción")
    } finally {
      setOpLoading(false)
    }
  }

  // ── Copiar al clipboard ───────────────────────────────────────────────────
  async function handleCopy(text: string) {
    await navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Exportar ──────────────────────────────────────────────────────────────
  function handleExport(text: string, format: ExportFormat) {
    const base = activeTranscription?.file_name.replace(/\.[^.]+$/, "") || "transcript"
    if      (format === "txt") exportTXT(text, base)
    else if (format === "md")  exportMarkdown(text, base)
    else if (format === "srt") exportSubtitle(text, base, "srt")
    else if (format === "vtt") exportSubtitle(text, base, "vtt")
  }

  // ── Cargar del historial ──────────────────────────────────────────────────
  function loadFromHistory(t: Transcription) {
    setActiveTranscription(t)
    setEditedText(t.transcript_clean || t.transcript_raw)
    setOpResult("")
    setOpError("")
    setShowHistory(false)
  }

  const textToShow    = opResult || editedText
  const hasTranscript = !!activeTranscription

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-950">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-gray-950/90 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.06] text-gray-400 hover:text-white hover:bg-white/[0.07] transition-all"
            >
              <ArrowLeft size={15} />
            </Link>
            <div
              className="w-9 h-9 rounded-2xl flex items-center justify-center shadow-md"
              style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)", boxShadow: "0 4px 12px rgba(124,58,237,0.3)" }}
            >
              <Mic size={17} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-sm leading-tight">Audio Lab</h1>
              <p className="text-gray-600 text-[11px]">Transcripción y edición con IA</p>
            </div>
          </div>

          {/* Historial toggle */}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all"
            style={{
              background:  showHistory ? "rgba(124,58,237,0.1)" : "rgba(255,255,255,0.03)",
              borderColor: showHistory ? "rgba(124,58,237,0.3)" : "rgba(255,255,255,0.08)",
              color:       showHistory ? "#c4b5fd" : "#9ca3af",
            }}
          >
            <Clock size={12} />
            <span>Historial</span>
            <span className="tabular-nums">({history.length})</span>
            {showHistory ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">

        {/* ── Historial desplegable ─────────────────────────────────────────── */}
        {showHistory && (
          <div
            className="rounded-2xl border overflow-hidden animate-fade-in"
            style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.07)" }}
          >
            <div className="px-4 py-3 border-b border-white/[0.06]">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest">Transcripciones recientes</p>
            </div>
            {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="text-gray-600 animate-spin" />
              </div>
            ) : history.length === 0 ? (
              <div className="py-8 text-center text-gray-600 text-sm">Sin transcripciones aún</div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {history.map(t => (
                  <button
                    key={t.id}
                    onClick={() => loadFromHistory(t)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-all text-left"
                  >
                    <FileAudio size={16} className="text-purple-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-300 text-sm font-medium truncate">{t.file_name}</p>
                      <p className="text-gray-600 text-xs">{formatBytes(t.file_size_bytes)} · {t.language?.toUpperCase()} · {timeAgo(t.created_at)}</p>
                    </div>
                    <span className="text-gray-700 text-xs flex-shrink-0">{t.transcript_raw?.length} chars</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Upload zone ──────────────────────────────────────────────────── */}
        {!hasTranscript && (
          <div className="flex flex-col gap-4 animate-fade-in">
            <div>
              <h2 className="text-white font-semibold text-lg mb-1">Sube tu audio</h2>
              <p className="text-gray-500 text-sm">MP3, WAV, M4A, MP4 o WEBM · máximo {MAX_SIZE_MB} MB</p>
            </div>

            {/* Drag & Drop area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={handleDrag} onDragLeave={handleDrag}
              onDragOver={handleDrag}  onDrop={handleDrop}
              className="border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all"
              style={{
                background:   selectedFile ? "rgba(124,58,237,0.05)" : dragActive ? "rgba(124,58,237,0.08)" : "rgba(255,255,255,0.02)",
                borderColor:  selectedFile ? "rgba(124,58,237,0.4)"  : dragActive ? "rgba(124,58,237,0.4)"  : "rgba(255,255,255,0.1)",
              }}
            >
              <input
                ref={fileInputRef} type="file" accept={ACCEPTED_FORMATS}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
                className="hidden"
              />

              {selectedFile ? (
                <div className="space-y-2">
                  <FileAudio size={36} className="mx-auto text-purple-400" />
                  <p className="text-white font-semibold">{selectedFile.name}</p>
                  <p className="text-gray-500 text-sm">{formatBytes(selectedFile.size)}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <Upload size={36} className="mx-auto text-gray-600" />
                  <div>
                    <p className="text-gray-300 font-medium">Arrastra tu audio aquí</p>
                    <p className="text-gray-600 text-sm mt-1">o haz clic para seleccionar</p>
                  </div>
                </div>
              )}
            </div>

            {uploadError && (
              <div className="px-4 py-3 rounded-xl border border-red-500/25 bg-red-500/8 text-red-400 text-sm">
                ❌ {uploadError}
              </div>
            )}

            {selectedFile && !uploadError && (
              <button
                onClick={handleTranscribe}
                disabled={uploading}
                className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl font-bold text-sm text-white transition-all disabled:opacity-50"
                style={{
                  background:  "linear-gradient(135deg, #7c3aed, #a855f7)",
                  boxShadow:   "0 4px 20px rgba(124,58,237,0.3)",
                }}
              >
                {uploading ? (
                  <><Loader2 size={18} className="animate-spin" /> Transcribiendo con Gemini...</>
                ) : (
                  <><Mic size={18} /> Transcribir audio</>
                )}
              </button>
            )}

            {uploading && (
              <p className="text-center text-gray-500 text-xs">
                Esto puede tomar entre 15 segundos y 2 minutos según el tamaño del audio.
              </p>
            )}
          </div>
        )}

        {/* ── Transcripción activa ──────────────────────────────────────────── */}
        {hasTranscript && (
          <div className="flex flex-col gap-5 animate-fade-in">

            {/* Info del archivo */}
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-2xl border"
              style={{ background: "rgba(124,58,237,0.06)", borderColor: "rgba(124,58,237,0.2)" }}
            >
              <FileAudio size={18} className="text-purple-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">{activeTranscription.file_name}</p>
                <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
                  {activeTranscription.file_size_bytes && <span>{formatBytes(activeTranscription.file_size_bytes)}</span>}
                  {activeTranscription.duration_hint   && <span>~{activeTranscription.duration_hint}</span>}
                  {activeTranscription.language        && <span>{activeTranscription.language.toUpperCase()}</span>}
                  {activeTranscription.speakers?.length > 1 && (
                    <span>{activeTranscription.speakers.length} hablantes</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => { setActiveTranscription(null); setSelectedFile(null); setOpResult("") }}
                className="text-gray-600 hover:text-gray-400 transition-colors flex-shrink-0"
                title="Nueva transcripción"
              >
                <Trash2 size={14} />
              </button>
            </div>

            {/* Editor de transcripción */}
            <div
              className="rounded-2xl border overflow-hidden"
              style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.07)" }}
            >
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest">Transcripción</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-600 text-xs">{editedText.length} caracteres</span>
                </div>
              </div>
              <textarea
                value={editedText}
                onChange={e => setEditedText(e.target.value)}
                className="w-full bg-transparent px-4 py-4 text-gray-300 text-sm leading-relaxed resize-none focus:outline-none min-h-[200px] max-h-[400px] overflow-y-auto"
                placeholder="La transcripción aparecerá aquí..."
              />
            </div>

            {/* Exportar transcripción */}
            <ExportBar text={editedText} onExport={handleExport} onCopy={() => handleCopy(editedText)} copied={copied} />

            {/* Operaciones IA */}
            <div
              className="rounded-2xl border overflow-hidden"
              style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.07)" }}
            >
              <div className="px-4 py-3 border-b border-white/[0.06]">
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest">Procesar con IA</p>
              </div>

              {/* Grid de operaciones */}
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {OPERATIONS.map(op => {
                  const Icon     = op.icon
                  const isActive = selectedOp === op.id
                  return (
                    <button
                      key={op.id}
                      onClick={() => setSelectedOp(op.id)}
                      className="flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all"
                      style={{
                        background:  isActive ? "rgba(124,58,237,0.1)"  : "rgba(255,255,255,0.02)",
                        borderColor: isActive ? "rgba(124,58,237,0.35)" : "rgba(255,255,255,0.06)",
                      }}
                    >
                      <Icon size={15} className="flex-shrink-0 mt-0.5" style={{ color: isActive ? "#c4b5fd" : "#6b7280" }} />
                      <div>
                        <p className="text-xs font-semibold leading-tight" style={{ color: isActive ? "#e2e8f0" : "#9ca3af" }}>
                          {op.label}
                        </p>
                        <p className="text-[10px] text-gray-600 mt-0.5 leading-tight">{op.desc}</p>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Instrucción custom */}
              {selectedOp === "custom" && (
                <div className="px-4 pb-3">
                  <textarea
                    value={customInstruction}
                    onChange={e => setCustomInstruction(e.target.value)}
                    placeholder="Ej: Traduce al inglés, Extrae solo las preguntas del profesor, Formatea como guión de video..."
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-gray-300 text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500/40 transition-all resize-none min-h-[72px]"
                  />
                </div>
              )}

              {/* Botón procesar */}
              <div className="px-4 pb-4">
                <button
                  onClick={handleOperation}
                  disabled={opLoading || !editedText.trim() || (selectedOp === "custom" && !customInstruction.trim())}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-40"
                  style={{ background: "rgba(124,58,237,0.7)", border: "1px solid rgba(124,58,237,0.4)" }}
                >
                  {opLoading ? (
                    <><Loader2 size={16} className="animate-spin" /> Procesando...</>
                  ) : (
                    <><Sparkles size={16} /> {OPERATIONS.find(o => o.id === selectedOp)?.label || "Procesar"}</>
                  )}
                </button>

                {opError && (
                  <p className="text-red-400 text-xs mt-2">❌ {opError}</p>
                )}
              </div>
            </div>

            {/* Resultado de la operación */}
            {opResult && (
              <div
                className="rounded-2xl border overflow-hidden animate-fade-in"
                style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(124,58,237,0.2)" }}
              >
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest">
                      {OPERATIONS.find(o => o.id === selectedOp)?.label}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopy(opResult)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-all"
                      style={{ background: "rgba(255,255,255,0.04)", color: "#9ca3af" }}
                    >
                      {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
                      {copied ? "Copiado" : "Copiar"}
                    </button>
                  </div>
                </div>

                {/* Resultado renderizado como prose */}
                <div className="px-4 py-4">
                  <div
                    className="prose prose-invert prose-sm max-w-none text-gray-300"
                    style={{ fontSize: "0.875rem", lineHeight: "1.7" }}
                    dangerouslySetInnerHTML={{
                      __html: opResult
                        .replace(/^#{3} (.+)$/gm, "<h3 class='text-white font-bold text-sm mt-4 mb-1'>$1</h3>")
                        .replace(/^#{2} (.+)$/gm, "<h2 class='text-white font-bold text-base mt-5 mb-2'>$1</h2>")
                        .replace(/^# (.+)$/gm,    "<h1 class='text-white font-bold text-lg mt-5 mb-2'>$1</h1>")
                        .replace(/\*\*(.+?)\*\*/g, "<strong class='text-gray-200'>$1</strong>")
                        .replace(/^- \[ \] (.+)$/gm, "<div class='flex gap-2 items-start'><input type='checkbox' class='mt-1' /><span>$1</span></div>")
                        .replace(/^- (.+)$/gm,    "<div class='flex gap-2'><span class='text-purple-400 flex-shrink-0'>·</span><span>$1</span></div>")
                        .replace(/^(\d+)\. (.+)$/gm, "<div class='flex gap-2'><span class='text-purple-400 font-bold flex-shrink-0'>$1.</span><span>$2</span></div>")
                        .replace(/^> (.+)$/gm,    "<blockquote class='border-l-2 border-purple-500/50 pl-3 text-gray-400 italic'>$1</blockquote>")
                        .replace(/\n{2,}/g,       "<br/><br/>")
                        .replace(/\n/g,           "<br/>")
                    }}
                  />
                </div>

                {/* Exportar resultado */}
                <div className="px-4 pb-4">
                  <ExportBar text={opResult} onExport={handleExport} onCopy={() => handleCopy(opResult)} copied={copied} compact />
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTE: barra de exportación
// ─────────────────────────────────────────────────────────────────────────────
function ExportBar({
  text, onExport, onCopy, copied, compact = false,
}: {
  text: string
  onExport: (text: string, fmt: ExportFormat) => void
  onCopy: () => void
  copied: boolean
  compact?: boolean
}) {
  const formats: { id: ExportFormat; label: string }[] = [
    { id: "txt", label: "TXT"  },
    { id: "md",  label: "MD"   },
    { id: "srt", label: "SRT"  },
    { id: "vtt", label: "VTT"  },
  ]

  return (
    <div className={`flex items-center gap-2 flex-wrap ${compact ? "" : ""}`}>
      <span className="text-gray-600 text-[11px] font-semibold uppercase tracking-widest flex items-center gap-1">
        <Download size={11} /> Exportar
      </span>
      {formats.map(f => (
        <button
          key={f.id}
          onClick={() => onExport(text, f.id)}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
          style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)", color: "#9ca3af" }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLElement).style.background    = "rgba(255,255,255,0.07)"
            ;(e.currentTarget as HTMLElement).style.color         = "#e2e8f0"
            ;(e.currentTarget as HTMLElement).style.borderColor   = "rgba(255,255,255,0.14)"
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLElement).style.background    = "rgba(255,255,255,0.03)"
            ;(e.currentTarget as HTMLElement).style.color         = "#9ca3af"
            ;(e.currentTarget as HTMLElement).style.borderColor   = "rgba(255,255,255,0.08)"
          }}
        >
          {f.label}
        </button>
      ))}
      <button
        onClick={onCopy}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
        style={{
          background:  copied ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.03)",
          borderColor: copied ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.08)",
          color:       copied ? "#6ee7b7" : "#9ca3af",
        }}
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
        {copied ? "Copiado" : "Copiar"}
      </button>
    </div>
  )
}
