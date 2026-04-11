"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import {
  ArrowLeft, Upload, Mic, FileAudio, Loader2,
  Sparkles, FileText, ClipboardList, AlignLeft,
  CheckSquare, Wand2, Download, Copy, Check,
  ChevronDown, ChevronUp, Trash2, Clock,
  Users, Captions, ShieldCheck, AudioLines, BookOpen, Highlighter, ScanSearch
} from "lucide-react"

type Operation = "clean" | "notes" | "minutes" | "summary" | "actions" | "chapters" | "highlights" | "study_guide" | "custom"
type ExportFormat = "txt" | "md" | "srt" | "vtt" | "json"
type PipelineMode = "quick" | "pro"

interface Speaker { id: string; estimatedRole?: string; label?: string }
interface Segment { id: string; start: number; end: number; text: string; speaker?: string; confidence?: number }

interface Transcription {
  id: string | null
  file_name: string
  file_size_bytes: number | null
  duration_hint: string | null
  status: string
  transcript_raw: string
  transcript_clean: string
  summary: string
  language: string
  speakers: Speaker[]
  segments: Segment[]
  qualityNotes?: string
  provider?: string
  created_at: string
}

const ACCEPTED_FORMATS = ".mp3,.wav,.m4a,.mp4,.webm"
const MAX_SIZE_MB = 50
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

const OPERATIONS: { id: Operation; icon: React.ElementType; label: string; desc: string }[] = [
  { id: "clean", icon: Wand2, label: "Limpiar", desc: "Corrige puntuación y muletillas" },
  { id: "notes", icon: FileText, label: "Apuntes", desc: "Clase → apuntes estructurados" },
  { id: "minutes", icon: ClipboardList, label: "Acta", desc: "Reunión → acuerdos y pendientes" },
  { id: "summary", icon: AlignLeft, label: "Resumen", desc: "Puntos clave ejecutivos" },
  { id: "actions", icon: CheckSquare, label: "Tareas", desc: "Extrae acciones y responsables" },
  { id: "chapters", icon: BookOpen, label: "Capítulos", desc: "Divide por bloques temáticos" },
  { id: "highlights", icon: Highlighter, label: "Highlights", desc: "Frases o ideas destacadas" },
  { id: "study_guide", icon: ScanSearch, label: "Guía estudio", desc: "Resumen + preguntas + mini quiz" },
  { id: "custom", icon: Sparkles, label: "Personalizar", desc: "Instrucción libre" },
]

const MIME_MAP: Record<string, string> = {
  mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4",
  mp4: "audio/mp4", webm: "audio/webm",
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return ""
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "ahora"
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

export default function AudioLabPage() {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")

  const [mode, setMode] = useState<PipelineMode>("quick")
  const [improveAudio, setImproveAudio] = useState(false)
  const [diarize, setDiarize] = useState(false)
  const [preciseSubtitles, setPreciseSubtitles] = useState(false)
  const [createSummary, setCreateSummary] = useState(false)

  const [activeTranscription, setActiveTranscription] = useState<Transcription | null>(null)
  const [editedText, setEditedText] = useState("")
  const [selectedOp, setSelectedOp] = useState<Operation>("summary")
  const [customInstruction, setCustomInstruction] = useState("")
  const [opResult, setOpResult] = useState("")
  const [opLoading, setOpLoading] = useState(false)
  const [opError, setOpError] = useState("")
  const [history, setHistory] = useState<Transcription[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [copied, setCopied] = useState(false)

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

    const mapped = (data || []).map((row: any) => ({
      ...row,
      speakers: Array.isArray(row.speakers) ? row.speakers : safeJSON(row.speakers, []),
      segments: Array.isArray(row.segments_json) ? row.segments_json : safeJSON(row.segments_json, []),
    }))
    setHistory(mapped)
    setHistoryLoading(false)
  }

  function safeJSON<T>(value: unknown, fallback: T): T {
    if (Array.isArray(value)) return value as T
    if (typeof value !== "string" || !value.trim()) return fallback
    try { return JSON.parse(value) as T } catch { return fallback }
  }

  function validateFile(file: File): string | null {
    if (file.size > MAX_SIZE_BYTES) return `El archivo pesa ${(file.size / 1024 / 1024).toFixed(1)} MB. Máximo ${MAX_SIZE_MB} MB.`
    const ext = file.name.split(".").pop()?.toLowerCase() || ""
    if (!MIME_MAP[ext]) return `Formato no soportado: .${ext}. Usa MP3, WAV, M4A, MP4 o WEBM.`
    return null
  }

  function handleFileSelect(file: File) {
    const err = validateFile(file)
    setUploadError(err || "")
    if (err) return
    setSelectedFile(file)
    setActiveTranscription(null)
    setOpResult("")
    setEditedText("")
  }

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

  async function handleTranscribe() {
    if (!selectedFile) return
    setUploading(true)
    setUploadError("")

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(",")[1])
        reader.onerror = () => reject(new Error("Error leyendo el archivo"))
        reader.readAsDataURL(selectedFile)
      })

      const ext = selectedFile.name.split(".").pop()?.toLowerCase() || "mp3"
      const mimeType = MIME_MAP[ext] || "audio/mpeg"

      const res = await fetch("/api/agents/audio/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64: base64,
          mimeType,
          fileName: selectedFile.name,
          fileSizeBytes: selectedFile.size,
          options: {
            mode,
            improveAudio,
            diarize,
            preciseSubtitles,
            createSummary,
            detectLanguage: true,
          },
        }),
      })

      const data = await res.json()
      if (!data.success) throw new Error(data.error || "Error transcribiendo")

      const transcription: Transcription = {
        id: data.id || null,
        file_name: selectedFile.name,
        file_size_bytes: selectedFile.size,
        duration_hint: data.durationEstimate || "",
        status: "done",
        transcript_raw: data.transcript || "",
        transcript_clean: data.transcriptClean || data.transcript || "",
        summary: data.summary || "",
        language: data.language || "es",
        speakers: data.speakers || [],
        segments: data.segments || [],
        qualityNotes: data.qualityNotes || "",
        provider: data.provider || "",
        created_at: new Date().toISOString(),
      }

      setActiveTranscription(transcription)
      setEditedText(transcription.transcript_clean || transcription.transcript_raw)
      setSelectedFile(null)
      setOpResult("")
      await loadHistory()
    } catch (err: any) {
      setUploadError(err?.message || "Error inesperado")
    } finally {
      setUploading(false)
    }
  }

  async function handleOperation() {
    if (!activeTranscription || !editedText.trim()) return
    setOpLoading(true)
    setOpError("")
    setOpResult("")
    try {
      const res = await fetch("/api/agents/transcript-editor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcriptionId: activeTranscription.id,
          transcript: editedText,
          operation: selectedOp,
          customInstruction,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || "Error procesando")
      setOpResult(data.output)
    } catch (err: any) {
      setOpError(err?.message || "Error procesando")
    } finally {
      setOpLoading(false)
    }
  }

  async function handleCopy(text: string) {
    await navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  async function handleExport(format: ExportFormat) {
    const text = opResult || editedText
    if (!text.trim()) return
    const res = await fetch("/api/agents/audio/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        format,
        text,
        fileName: activeTranscription?.file_name || "audio-transcript",
        segments: activeTranscription?.segments || [],
        metadata: {
          provider: activeTranscription?.provider,
          language: activeTranscription?.language,
          mode,
        },
      }),
    })
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    const fileBase = (activeTranscription?.file_name || "audio-transcript").replace(/\.[^.]+$/, "")
    a.href = url
    a.download = `${fileBase}.${format}`
    a.click()
    URL.revokeObjectURL(url)
  }

  function loadFromHistory(t: Transcription) {
    setActiveTranscription(t)
    setEditedText(t.transcript_clean || t.transcript_raw)
    setOpResult("")
    setOpError("")
    setShowHistory(false)
  }

  const hasTranscript = !!activeTranscription

  return (
    <div className="min-h-screen bg-app">
      <header className="sticky top-0 z-20 border-b border-soft bg-app backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="w-8 h-8 flex items-center justify-center rounded-xl bg-card-soft-theme text-sub hover:text-main hover:bg-input-theme transition-all">
              <ArrowLeft size={15} />
            </Link>
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-md" style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)", boxShadow: "0 4px 12px rgba(124,58,237,0.3)" }}>
              <Mic size={18} className="text-main" />
            </div>
            <div>
              <h1 className="text-main font-bold text-sm leading-tight">Audio Lab Pro</h1>
              <p className="text-muted2 text-[11px]">Transcripción y edición robusta</p>
            </div>
          </div>

          <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all" style={{ background: showHistory ? "rgba(124,58,237,0.1)" : "var(--bg-card)", borderColor: showHistory ? "rgba(124,58,237,0.3)" : "var(--border-soft)", color: showHistory ? "#c4b5fd" : "#9ca3af" }}>
            <Clock size={12} />
            <span>Historial</span>
            <span className="tabular-nums">({history.length})</span>
            {showHistory ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-6">
        {showHistory && (
          <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--bg-card-soft)", borderColor: "var(--bg-card-soft)" }}>
            <div className="px-4 py-3 border-b border-soft"><p className="text-sub text-xs font-semibold uppercase tracking-widest">Transcripciones recientes</p></div>
            {historyLoading ? <div className="flex items-center justify-center py-8"><Loader2 size={20} className="text-muted2 animate-spin" /></div> : history.length === 0 ? <div className="py-8 text-center text-muted2 text-sm">Sin transcripciones aún</div> : (
              <div className="divide-y divide-[var(--border-soft)]">
                {history.map((t) => (
                  <button key={`${t.id}_${t.created_at}`} onClick={() => loadFromHistory(t)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-card-soft-theme transition-all text-left">
                    <FileAudio size={16} className="text-purple-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sub text-sm font-medium truncate">{t.file_name}</p>
                      <p className="text-muted2 text-xs">{formatBytes(t.file_size_bytes)} · {t.language?.toUpperCase()} · {timeAgo(t.created_at)}</p>
                    </div>
                    <span className="text-muted2 text-xs flex-shrink-0">{t.segments?.length || 0} seg.</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {!hasTranscript && (
          <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
            <div className="flex flex-col gap-4 animate-fade-in">
              <div>
                <h2 className="text-main font-semibold text-lg mb-1">Sube tu audio o video</h2>
                <p className="text-muted2 text-sm">MP3, WAV, M4A, MP4 o WEBM · máximo {MAX_SIZE_MB} MB</p>
              </div>

              <div onClick={() => fileInputRef.current?.click()} onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop} className="border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all" style={{ background: selectedFile ? "rgba(124,58,237,0.05)" : dragActive ? "rgba(124,58,237,0.08)" : "var(--bg-card-soft)", borderColor: selectedFile ? "rgba(124,58,237,0.4)" : dragActive ? "rgba(124,58,237,0.4)" : "var(--border-medium)" }}>
                <input ref={fileInputRef} type="file" accept={ACCEPTED_FORMATS} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }} className="hidden" />
                {selectedFile ? (
                  <div className="space-y-2">
                    <FileAudio size={36} className="mx-auto text-purple-400" />
                    <p className="text-main font-semibold">{selectedFile.name}</p>
                    <p className="text-muted2 text-sm">{formatBytes(selectedFile.size)}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Upload size={36} className="mx-auto text-muted2" />
                    <div>
                      <p className="text-sub font-medium">Arrastra tu archivo aquí</p>
                      <p className="text-muted2 text-sm mt-1">o haz clic para seleccionar</p>
                    </div>
                  </div>
                )}
              </div>

              {uploadError && <div className="px-4 py-3 rounded-xl border border-red-500/25 bg-red-500/8 text-red-400 text-sm">❌ {uploadError}</div>}

              {selectedFile && !uploadError && (
                <button onClick={handleTranscribe} disabled={uploading} className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl font-bold text-sm text-white transition-all disabled:opacity-50" style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)", boxShadow: "0 4px 20px rgba(124,58,237,0.3)" }}>
                  {uploading ? <><Loader2 size={18} className="animate-spin" /> Procesando audio...</> : <><Mic size={18} /> Ejecutar pipeline</>}
                </button>
              )}
            </div>

            <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--bg-card-soft)", borderColor: "var(--bg-card-soft)" }}>
              <div className="px-4 py-3 border-b border-soft"><p className="text-sub text-xs font-semibold uppercase tracking-widest">Pipeline robusto</p></div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setMode("quick")} className="rounded-xl border px-3 py-2 text-sm font-semibold transition-all" style={{ background: mode === "quick" ? "rgba(124,58,237,0.12)" : "var(--bg-card-soft)", borderColor: mode === "quick" ? "rgba(124,58,237,0.35)" : "var(--border-soft)", color: mode === "quick" ? "#e9d5ff" : "#9ca3af" }}>Modo rápido</button>
                  <button onClick={() => setMode("pro")} className="rounded-xl border px-3 py-2 text-sm font-semibold transition-all" style={{ background: mode === "pro" ? "rgba(124,58,237,0.12)" : "var(--bg-card-soft)", borderColor: mode === "pro" ? "rgba(124,58,237,0.35)" : "var(--border-soft)", color: mode === "pro" ? "#e9d5ff" : "#9ca3af" }}>Modo pro</button>
                </div>

                <ToggleRow icon={AudioLines} label="Mejorar audio" desc="Prepara la integración con enhancement" value={improveAudio} onChange={setImproveAudio} />
                <ToggleRow icon={Users} label="Separar hablantes" desc="Ideal para reuniones y clases" value={diarize} onChange={setDiarize} />
                <ToggleRow icon={Captions} label="Subtítulos precisos" desc="Usa segmentos al exportar SRT/VTT" value={preciseSubtitles} onChange={setPreciseSubtitles} />
                <ToggleRow icon={ShieldCheck} label="Crear resumen base" desc="Genera resumen junto a la transcripción" value={createSummary} onChange={setCreateSummary} />

                <div className="rounded-xl border border-soft bg-card-soft-theme p-3 text-xs text-muted2 leading-relaxed">
                  <p className="text-sub font-semibold mb-1">Arquitectura lista para crecer</p>
                  <p>Este módulo ya queda preparado para conectar Faster-Whisper, WhisperX, pyannote o un microservicio externo vía <code className="text-purple-700">AUDIO_PIPELINE_URL</code>.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {hasTranscript && activeTranscription && (
          <div className="grid xl:grid-cols-[1.2fr_0.8fr] gap-6">
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border" style={{ background: "rgba(124,58,237,0.06)", borderColor: "rgba(124,58,237,0.2)" }}>
                <FileAudio size={18} className="text-purple-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-main font-semibold text-sm truncate">{activeTranscription.file_name}</p>
                  <div className="flex gap-3 flex-wrap text-xs text-muted2 mt-0.5">
                    {activeTranscription.file_size_bytes && <span>{formatBytes(activeTranscription.file_size_bytes)}</span>}
                    {activeTranscription.duration_hint && <span>~{activeTranscription.duration_hint}</span>}
                    {activeTranscription.language && <span>{activeTranscription.language.toUpperCase()}</span>}
                    {activeTranscription.speakers?.length > 1 && <span>{activeTranscription.speakers.length} hablantes</span>}
                    {activeTranscription.provider && <span>{activeTranscription.provider}</span>}
                  </div>
                </div>
                <button onClick={() => { setActiveTranscription(null); setSelectedFile(null); setOpResult("") }} className="text-muted2 hover:text-sub transition-colors flex-shrink-0" title="Nueva transcripción"><Trash2 size={14} /></button>
              </div>

              <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--bg-card-soft)", borderColor: "var(--bg-card-soft)" }}>
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-soft">
                  <p className="text-sub text-xs font-semibold uppercase tracking-widest">Transcripción</p>
                  <div className="flex items-center gap-2 text-xs text-muted2">
                    <span>{editedText.length} caracteres</span>
                    {!!activeTranscription.qualityNotes && <span className="truncate max-w-[220px]">· {activeTranscription.qualityNotes}</span>}
                  </div>
                </div>
                <textarea value={editedText} onChange={(e) => setEditedText(e.target.value)} className="w-full bg-transparent px-4 py-4 text-sub text-sm leading-relaxed resize-none focus:outline-none min-h-[260px] max-h-[520px] overflow-y-auto" placeholder="La transcripción aparecerá aquí..." />
              </div>

              <ExportBar onExport={handleExport} onCopy={() => handleCopy(opResult || editedText)} copied={copied} />

              {!!activeTranscription.summary && !opResult && (
                <div className="rounded-2xl border p-4" style={{ background: "var(--bg-card-soft)", borderColor: "var(--bg-card-soft)" }}>
                  <p className="text-sub text-xs font-semibold uppercase tracking-widest mb-2">Resumen base</p>
                  <p className="text-sub text-sm leading-relaxed whitespace-pre-wrap">{activeTranscription.summary}</p>
                </div>
              )}

              <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--bg-card-soft)", borderColor: "var(--bg-card-soft)" }}>
                <div className="px-4 py-3 border-b border-soft"><p className="text-sub text-xs font-semibold uppercase tracking-widest">Procesar con IA</p></div>
                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {OPERATIONS.map((op) => {
                    const Icon = op.icon
                    const isActive = selectedOp === op.id
                    return (
                      <button key={op.id} onClick={() => setSelectedOp(op.id)} className="flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all" style={{ background: isActive ? "rgba(124,58,237,0.1)" : "var(--bg-card-soft)", borderColor: isActive ? "rgba(124,58,237,0.35)" : "var(--bg-card-soft)" }}>
                        <Icon size={15} className="flex-shrink-0 mt-0.5" style={{ color: isActive ? "#c4b5fd" : "#6b7280" }} />
                        <div>
                          <p className="text-xs font-semibold leading-tight" style={{ color: isActive ? "#e2e8f0" : "#9ca3af" }}>{op.label}</p>
                          <p className="text-[10px] text-muted2 mt-0.5 leading-tight">{op.desc}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>

                {selectedOp === "custom" && (
                  <div className="px-4 pb-3">
                    <textarea value={customInstruction} onChange={(e) => setCustomInstruction(e.target.value)} placeholder="Ej: Traduce al inglés, extrae solo preguntas del profesor, conviértelo en guión de video..." className="w-full bg-card-soft-theme border border-soft rounded-xl px-3.5 py-2.5 text-sub text-sm placeholder-gray-400 focus:outline-none focus:border-purple-500/40 transition-all resize-none min-h-[72px]" />
                  </div>
                )}

                <div className="px-4 pb-4">
                  <button onClick={handleOperation} disabled={opLoading || !editedText.trim() || (selectedOp === "custom" && !customInstruction.trim())} className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-semibold text-sm text-main transition-all disabled:opacity-40" style={{ background: "rgba(124,58,237,0.7)", border: "1px solid rgba(124,58,237,0.4)" }}>
                    {opLoading ? <><Loader2 size={16} className="animate-spin" /> Procesando...</> : <><Sparkles size={16} /> {OPERATIONS.find((o) => o.id === selectedOp)?.label || "Procesar"}</>}
                  </button>
                  {opError && <p className="text-red-400 text-xs mt-2">❌ {opError}</p>}
                </div>
              </div>

              {opResult && (
                <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--bg-card-soft)", borderColor: "rgba(124,58,237,0.2)" }}>
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-soft">
                    <p className="text-sub text-xs font-semibold uppercase tracking-widest">Resultado IA</p>
                    <button onClick={() => handleCopy(opResult)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-all" style={{ background: "var(--bg-input)", color: "#9ca3af" }}>{copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}{copied ? "Copiado" : "Copiar"}</button>
                  </div>
                  <div className="px-4 py-4 whitespace-pre-wrap text-sm text-sub leading-relaxed">{opResult}</div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--bg-card-soft)", borderColor: "var(--bg-card-soft)" }}>
                <div className="px-4 py-3 border-b border-soft"><p className="text-sub text-xs font-semibold uppercase tracking-widest">Segmentos</p></div>
                <div className="max-h-[420px] overflow-y-auto divide-y divide-[var(--border-soft)]">
                  {activeTranscription.segments?.length ? activeTranscription.segments.map((seg) => (
                    <div key={seg.id} className="px-4 py-3 text-sm">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="text-xs text-purple-700">{seg.speaker || "Segmento"}</div>
                        <div className="text-[11px] text-muted2">{seg.start.toFixed(1)}s → {seg.end.toFixed(1)}s</div>
                      </div>
                      <p className="text-sub leading-relaxed">{seg.text}</p>
                    </div>
                  )) : <div className="px-4 py-6 text-sm text-muted2">Aún no hay segmentos disponibles.</div>}
                </div>
              </div>

              <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--bg-card-soft)", borderColor: "var(--bg-card-soft)" }}>
                <div className="px-4 py-3 border-b border-soft"><p className="text-sub text-xs font-semibold uppercase tracking-widest">Hablantes</p></div>
                <div className="p-4 space-y-2">
                  {activeTranscription.speakers?.length ? activeTranscription.speakers.map((sp) => (
                    <div key={sp.id} className="rounded-xl border border-soft bg-card-soft-theme px-3 py-2">
                      <p className="text-sm font-semibold text-main">{sp.label || sp.id}</p>
                      {sp.estimatedRole && <p className="text-xs text-muted2">{sp.estimatedRole}</p>}
                    </div>
                  )) : <p className="text-sm text-muted2">No se detectaron hablantes múltiples.</p>}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ToggleRow({ icon: Icon, label, desc, value, onChange }: { icon: React.ElementType; label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className="w-full flex items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition-all" style={{ background: value ? "rgba(124,58,237,0.08)" : "var(--bg-card-soft)", borderColor: value ? "rgba(124,58,237,0.25)" : "var(--bg-card-soft)" }}>
      <div className="flex items-start gap-3">
        <Icon size={16} className="mt-0.5" style={{ color: value ? "#c4b5fd" : "#6b7280" }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: value ? "#e9d5ff" : "#d1d5db" }}>{label}</p>
          <p className="text-xs text-muted2 mt-0.5">{desc}</p>
        </div>
      </div>
      <div className={`w-10 h-6 rounded-full border transition-all ${value ? "bg-purple-500/80 border-purple-400/60" : "bg-card-soft-theme border-medium"}`}>
        <div className={`w-4 h-4 rounded-full bg-white mt-[3px] transition-all ${value ? "ml-[19px]" : "ml-[3px]"}`} />
      </div>
    </button>
  )
}

function ExportBar({ onExport, onCopy, copied }: { onExport: (fmt: ExportFormat) => void; onCopy: () => void; copied: boolean }) {
  const formats: { id: ExportFormat; label: string }[] = [
    { id: "txt", label: "TXT" },
    { id: "md", label: "MD" },
    { id: "srt", label: "SRT" },
    { id: "vtt", label: "VTT" },
    { id: "json", label: "JSON" },
  ]
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-muted2 text-[11px] font-semibold uppercase tracking-widest flex items-center gap-1"><Download size={11} /> Exportar</span>
      {formats.map((f) => (
        <button key={f.id} onClick={() => onExport(f.id)} className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all" style={{ background: "var(--bg-card)", borderColor: "var(--border-soft)", color: "#9ca3af" }}>{f.label}</button>
      ))}
      <button onClick={onCopy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all" style={{ background: copied ? "rgba(16,185,129,0.08)" : "var(--bg-card)", borderColor: copied ? "rgba(16,185,129,0.25)" : "var(--border-soft)", color: copied ? "#6ee7b7" : "#9ca3af" }}>
        {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? "Copiado" : "Copiar"}
      </button>
    </div>
  )
}
