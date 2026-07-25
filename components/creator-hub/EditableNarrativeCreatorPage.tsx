"use client"

import { useCallback, useRef, useState, type ChangeEvent } from "react"
import Link from "next/link"
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  Copy,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Info,
  LoaderCircle,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
  WandSparkles,
} from "lucide-react"
import CreatorHubUtilityBar from "@/components/creator-hub/CreatorHubUtilityBar"
import ColorPalette from "@/components/ui/ColorPalette"
import TemplatePicker from "@/components/design/TemplatePicker"
import { getDefaultDesignTemplateId } from "@/lib/design-templates/registry"
import { getCreatorHubFormat } from "@/components/creator-hub/catalog"
import { saveCreatorHubProject, updateCreatorHubProject } from "@/components/creator-hub/project-store"
import { downloadRenderedAsImage } from "@/lib/creator-downloads"

const SOURCE_TYPES = [
  { id: "topic", icon: "💡", label: "Tema", description: "Describe lo que necesitas" },
  { id: "text", icon: "📝", label: "Texto", description: "Pega contenido completo" },
  { id: "url", icon: "🔗", label: "URL", description: "Procesa una página web" },
  { id: "pdf", icon: "📄", label: "PDF", description: "Carga un documento" },
  { id: "docx", icon: "📎", label: "DOCX", description: "Carga un archivo Word" },
] as const

type SourceType = (typeof SOURCE_TYPES)[number]["id"]
type NarrativeFormat = "story" | "song" | "podcast"
type Step = "input" | "processing" | "result"

type ApiResponse = {
  success?: boolean
  error?: string
  output?: { data?: any }
}

const CONFIG = {
  story: {
    title: "Edita el relato educativo",
    description: "Ajusta personajes, capítulos, contenido y enseñanza final sin volver a generar.",
    processing: ["Diseñando personajes", "Organizando la trama", "Redactando capítulos"],
  },
  song: {
    title: "Edita la canción educativa",
    description: "Modifica versos, coro, estilo y consejo de interpretación manteniendo la estructura.",
    processing: ["Seleccionando conceptos", "Construyendo rimas", "Organizando coro y versos"],
  },
  podcast: {
    title: "Edita el guion del podcast",
    description: "Corrige cada intervención, cambia voces y emociones, y reordena la conversación.",
    processing: ["Diseñando la conversación", "Distribuyendo voces", "Preparando el guion final"],
  },
} as const

function safeArray(value: unknown): any[] {
  return Array.isArray(value) ? value : []
}

function safeFileName(value: string) {
  return value
    .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 60) || "eduai-narrativa"
}

function resultTitle(format: NarrativeFormat, data: any, fallback: string) {
  return data?.title || data?.subject || (format === "podcast" ? "Podcast" : fallback)
}

function designPalette(data: any) {
  const palette = data?._design?.palette
  return {
    background: typeof palette?.background === "string" ? palette.background : undefined,
    primary: typeof palette?.primary === "string" ? palette.primary : undefined,
  }
}

function moveItem<T>(items: T[], from: number, to: number) {
  if (to < 0 || to >= items.length) return items
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-muted2">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-soft bg-card-soft-theme px-3 py-2.5 text-xs text-main outline-none placeholder:text-muted2 focus:border-blue-500/35" />
    </label>
  )
}

function TextArea({ label, value, onChange, rows = 4, placeholder }: { label: string; value: string; onChange: (value: string) => void; rows?: number; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-muted2">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} placeholder={placeholder} className="w-full resize-y rounded-xl border border-soft bg-card-soft-theme px-3 py-2.5 text-xs leading-5 text-main outline-none placeholder:text-muted2 focus:border-blue-500/35" />
    </label>
  )
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-muted2">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-soft bg-card-soft-theme px-3 py-2.5 text-xs text-main outline-none focus:border-blue-500/35">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

function ItemActions({ index, length, onMove, onDuplicate, onRemove }: { index: number; length: number; onMove: (from: number, to: number) => void; onDuplicate: () => void; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => onMove(index, index - 1)} disabled={index === 0} title="Subir" className="rounded-lg border border-soft p-1.5 text-muted2 disabled:opacity-25"><ArrowUp size={12} /></button>
      <button type="button" onClick={() => onMove(index, index + 1)} disabled={index === length - 1} title="Bajar" className="rounded-lg border border-soft p-1.5 text-muted2 disabled:opacity-25"><ArrowDown size={12} /></button>
      <button type="button" onClick={onDuplicate} title="Duplicar" className="rounded-lg border border-soft p-1.5 text-muted2"><Copy size={12} /></button>
      <button type="button" onClick={onRemove} title="Eliminar" className="rounded-lg border border-red-500/20 p-1.5 text-red-500"><Trash2 size={12} /></button>
    </div>
  )
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-blue-500/30 bg-blue-500/5 px-3 py-2.5 text-xs font-bold text-blue-600"><Plus size={13} /> {label}</button>
}

function StoryEditor({ data, onChange }: { data: any; onChange: (next: any) => void }) {
  const characters = safeArray(data?.characters)
  const chapters = safeArray(data?.chapters)
  const patch = (changes: Record<string, unknown>) => onChange({ ...data, ...changes })

  return (
    <div className="space-y-4">
      <Field label="Título" value={data?.title || ""} onChange={(title) => patch({ title })} />
      <Field label="Tema o asignatura" value={data?.subject || ""} onChange={(subject) => patch({ subject })} />
      <TextArea label="Enseñanza o moraleja" value={data?.moral || ""} onChange={(moral) => patch({ moral })} rows={3} />

      <div className="border-t border-soft pt-4">
        <div className="flex items-center justify-between"><h3 className="text-xs font-black text-main">Personajes</h3><span className="text-[10px] font-bold text-muted2">{characters.length}</span></div>
        <div className="mt-3 space-y-2">
          {characters.map((character: any, index: number) => (
            <div key={`character-${index}`} className="grid grid-cols-[1fr_1.2fr_auto] items-end gap-2 rounded-2xl border border-soft bg-card-soft-theme p-3">
              <Field label="Nombre" value={character?.name || ""} onChange={(name) => patch({ characters: characters.map((item, itemIndex) => itemIndex === index ? { ...item, name } : item) })} />
              <Field label="Rol" value={character?.role || ""} onChange={(role) => patch({ characters: characters.map((item, itemIndex) => itemIndex === index ? { ...item, role } : item) })} />
              <button type="button" onClick={() => patch({ characters: characters.filter((_, itemIndex) => itemIndex !== index) })} className="mb-0.5 rounded-xl border border-red-500/20 p-2.5 text-red-500"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
        <AddButton label="Agregar personaje" onClick={() => patch({ characters: [...characters, { name: "Nuevo personaje", role: "Rol en la historia" }] })} />
      </div>

      <div className="border-t border-soft pt-4">
        <div className="flex items-center justify-between"><h3 className="text-xs font-black text-main">Capítulos</h3><span className="text-[10px] font-bold text-muted2">{chapters.length}</span></div>
        <div className="mt-3 space-y-3">
          {chapters.map((chapter: any, index: number) => (
            <section key={`chapter-${index}`} className="rounded-2xl border border-soft bg-card-soft-theme p-3">
              <div className="mb-3 flex items-center justify-between gap-2"><span className="text-[10px] font-black uppercase tracking-wider text-muted2">Capítulo {index + 1}</span><ItemActions index={index} length={chapters.length} onMove={(from, to) => patch({ chapters: moveItem(chapters, from, to) })} onDuplicate={() => patch({ chapters: [...chapters.slice(0, index + 1), { ...chapter }, ...chapters.slice(index + 1)] })} onRemove={() => patch({ chapters: chapters.filter((_, itemIndex) => itemIndex !== index) })} /></div>
              <Field label="Título" value={chapter?.title || ""} onChange={(title) => patch({ chapters: chapters.map((item, itemIndex) => itemIndex === index ? { ...item, title } : item) })} />
              <div className="mt-2"><TextArea label="Contenido" value={chapter?.content || ""} onChange={(content) => patch({ chapters: chapters.map((item, itemIndex) => itemIndex === index ? { ...item, content } : item) })} rows={7} /></div>
            </section>
          ))}
        </div>
        <AddButton label="Agregar capítulo" onClick={() => patch({ chapters: [...chapters, { title: "Nuevo capítulo", content: "Escribe aquí el desarrollo del capítulo." }] })} />
      </div>
    </div>
  )
}

function SongEditor({ data, onChange }: { data: any; onChange: (next: any) => void }) {
  const verses = safeArray(data?.verses)
  const chorusLines = safeArray(data?.chorus?.lines).map(String)
  const patch = (changes: Record<string, unknown>) => onChange({ ...data, ...changes })

  return (
    <div className="space-y-4">
      <Field label="Título" value={data?.title || ""} onChange={(title) => patch({ title })} />
      <div className="grid grid-cols-2 gap-2"><Field label="Tema" value={data?.subject || ""} onChange={(subject) => patch({ subject })} /><Field label="Estilo musical" value={data?.style || ""} onChange={(style) => patch({ style })} /></div>
      <TextArea label="Coro — una línea por renglón" value={chorusLines.join("\n")} onChange={(value) => patch({ chorus: { ...(data?.chorus || {}), lines: value.split("\n").map((line) => line.trim()).filter(Boolean) } })} rows={5} />
      <TextArea label="Consejo de interpretación" value={data?.tip || ""} onChange={(tip) => patch({ tip })} rows={3} />

      <div className="border-t border-soft pt-4">
        <div className="flex items-center justify-between"><h3 className="text-xs font-black text-main">Versos y puentes</h3><span className="text-[10px] font-bold text-muted2">{verses.length}</span></div>
        <div className="mt-3 space-y-3">
          {verses.map((verse: any, index: number) => (
            <section key={`verse-${index}`} className="rounded-2xl border border-soft bg-card-soft-theme p-3">
              <div className="mb-3 flex items-center justify-between gap-2"><span className="text-[10px] font-black uppercase tracking-wider text-muted2">Sección {index + 1}</span><ItemActions index={index} length={verses.length} onMove={(from, to) => patch({ verses: moveItem(verses, from, to) })} onDuplicate={() => patch({ verses: [...verses.slice(0, index + 1), { ...verse, lines: [...safeArray(verse?.lines)] }, ...verses.slice(index + 1)] })} onRemove={() => patch({ verses: verses.filter((_, itemIndex) => itemIndex !== index) })} /></div>
              <Field label="Nombre de la sección" value={verse?.label || ""} onChange={(label) => patch({ verses: verses.map((item, itemIndex) => itemIndex === index ? { ...item, label } : item) })} />
              <div className="mt-2"><TextArea label="Letra — una línea por renglón" value={safeArray(verse?.lines).join("\n")} onChange={(value) => patch({ verses: verses.map((item, itemIndex) => itemIndex === index ? { ...item, lines: value.split("\n").map((line) => line.trim()).filter(Boolean) } : item) })} rows={6} /></div>
            </section>
          ))}
        </div>
        <AddButton label="Agregar sección" onClick={() => patch({ verses: [...verses, { label: `Verso ${verses.length + 1}`, lines: ["Nueva línea de la canción"] }] })} />
      </div>
    </div>
  )
}

const EMOTIONS = ["neutral", "enthusiastic", "curious", "thoughtful", "surprised", "humorous"]

function PodcastEditor({ data, onChange }: { data: any; onChange: (next: any) => void }) {
  const segments = safeArray(data?.segments)
  const patch = (changes: Record<string, unknown>) => onChange({ ...data, ...changes })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_120px] gap-2"><Field label="Título" value={data?.title || ""} onChange={(title) => patch({ title })} /><Field label="Duración" value={data?.duration || ""} onChange={(duration) => patch({ duration })} /></div>
      <div className="border-t border-soft pt-4">
        <div className="flex items-center justify-between"><h3 className="text-xs font-black text-main">Intervenciones</h3><span className="text-[10px] font-bold text-muted2">{segments.length}</span></div>
        <div className="mt-3 space-y-3">
          {segments.map((segment: any, index: number) => (
            <section key={`segment-${index}`} className="rounded-2xl border border-soft bg-card-soft-theme p-3">
              <div className="mb-3 flex items-center justify-between gap-2"><span className="text-[10px] font-black uppercase tracking-wider text-muted2">Intervención {index + 1}</span><ItemActions index={index} length={segments.length} onMove={(from, to) => patch({ segments: moveItem(segments, from, to) })} onDuplicate={() => patch({ segments: [...segments.slice(0, index + 1), { ...segment }, ...segments.slice(index + 1)] })} onRemove={() => patch({ segments: segments.filter((_, itemIndex) => itemIndex !== index) })} /></div>
              <div className="grid grid-cols-2 gap-2"><SelectField label="Voz" value={segment?.speaker || "A"} onChange={(speaker) => patch({ segments: segments.map((item, itemIndex) => itemIndex === index ? { ...item, speaker } : item) })} options={[{ value: "A", label: "Voz A" }, { value: "B", label: "Voz B" }]} /><SelectField label="Emoción" value={segment?.emotion || "neutral"} onChange={(emotion) => patch({ segments: segments.map((item, itemIndex) => itemIndex === index ? { ...item, emotion } : item) })} options={EMOTIONS.map((emotion) => ({ value: emotion, label: emotion }))} /></div>
              <div className="mt-2"><TextArea label="Texto" value={segment?.text || ""} onChange={(text) => patch({ segments: segments.map((item, itemIndex) => itemIndex === index ? { ...item, text } : item) })} rows={5} /></div>
            </section>
          ))}
        </div>
        <AddButton label="Agregar intervención" onClick={() => patch({ segments: [...segments, { speaker: segments.length % 2 === 0 ? "A" : "B", emotion: "neutral", text: "Nueva intervención del podcast." }] })} />
      </div>
    </div>
  )
}

function StoryPreview({ data, accentColor }: { data: any; accentColor: string }) {
  const characters = safeArray(data?.characters)
  const chapters = safeArray(data?.chapters)
  return (
    <article className="mx-auto min-h-[920px] w-full max-w-[820px] overflow-hidden rounded-[28px] border border-amber-200 bg-[#fffdf7] text-slate-900 shadow-sm">
      <header className="relative overflow-hidden border-b border-amber-200 px-8 py-10 text-center sm:px-12">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full opacity-10" style={{ background: accentColor }} />
        <p className="relative text-[10px] font-black uppercase tracking-[0.24em]" style={{ color: accentColor }}>Relato educativo</p>
        <h1 className="relative mx-auto mt-4 max-w-2xl font-serif text-4xl font-black leading-tight">{data?.title || "Historia educativa"}</h1>
        <p className="relative mt-3 text-sm font-semibold text-slate-500">{data?.subject || "Tema de aprendizaje"}</p>
      </header>
      {characters.length > 0 && <section className="border-b border-amber-100 bg-amber-50/50 px-7 py-5 sm:px-10"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-700">Personajes</p><div className="mt-3 flex flex-wrap gap-2">{characters.map((character: any, index: number) => <span key={`story-character-${index}`} className="rounded-full border border-amber-200 bg-white px-3 py-1.5 text-[10px] font-bold text-slate-600"><strong style={{ color: accentColor }}>{character?.name}</strong>{character?.role ? ` · ${character.role}` : ""}</span>)}</div></section>}
      <div className="space-y-8 px-8 py-9 sm:px-12">{chapters.map((chapter: any, index: number) => <section key={`story-preview-${index}`}><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-black text-white" style={{ background: accentColor }}>{index + 1}</span><h2 className="font-serif text-2xl font-black">{chapter?.title || `Capítulo ${index + 1}`}</h2></div><p className="mt-4 whitespace-pre-line font-serif text-[15px] leading-8 text-slate-700">{chapter?.content || "Contenido pendiente."}</p></section>)}</div>
      {data?.moral && <section className="mx-7 mb-8 rounded-3xl border px-6 py-5 text-center sm:mx-10" style={{ borderColor: `${accentColor}35`, background: `${accentColor}0c` }}><p className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: accentColor }}>Enseñanza final</p><p className="mt-2 font-serif text-base font-bold italic leading-7 text-slate-700">{data.moral}</p></section>}
      <footer className="flex items-center justify-between border-t border-amber-200 px-8 py-4 text-[9px] font-bold uppercase tracking-widest text-slate-400"><span>EduAI Creator Studio</span><span>Relato editable</span></footer>
    </article>
  )
}

function SongPreview({ data, accentColor }: { data: any; accentColor: string }) {
  const verses = safeArray(data?.verses)
  const chorus = safeArray(data?.chorus?.lines)
  return (
    <article className="mx-auto min-h-[900px] w-full max-w-[760px] overflow-hidden rounded-[28px] border border-white/10 text-white shadow-sm" style={{ background: "linear-gradient(155deg,#09061a,#15103b 52%,#072d35)" }}>
      <header className="relative overflow-hidden px-8 py-10 text-center sm:px-12"><div className="absolute inset-0 opacity-20" style={{ backgroundImage: `radial-gradient(ellipse at 25% 30%,${accentColor},transparent 48%),radial-gradient(ellipse at 85% 70%,#06b6d4,transparent 42%)` }} /><div className="relative"><p className="text-[10px] font-black uppercase tracking-[0.24em]" style={{ color: accentColor }}>Canción educativa</p><h1 className="mt-3 text-4xl font-black leading-tight">{data?.title || "Canción educativa"}</h1><p className="mt-3 text-sm font-semibold text-slate-300">{data?.subject || "Tema"} · {data?.style || "Estilo libre"}</p></div></header>
      {chorus.length > 0 && <section className="mx-6 rounded-3xl border px-6 py-6 text-center sm:mx-10" style={{ borderColor: `${accentColor}40`, background: `${accentColor}13` }}><p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: accentColor }}>Coro</p><div className="mt-3 space-y-1">{chorus.map((line: string, index: number) => <p key={`chorus-${index}`} className="text-base font-bold leading-7">{line}</p>)}</div></section>}
      <div className="grid gap-4 px-6 py-7 sm:grid-cols-2 sm:px-10">{verses.map((verse: any, index: number) => <section key={`song-preview-${index}`} className="rounded-3xl border border-white/10 bg-white/[0.055] p-5"><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-black uppercase tracking-[0.14em]" style={{ color: accentColor }}>{verse?.label || `Verso ${index + 1}`}</h2><span className="text-[9px] font-bold text-slate-500">{index + 1}</span></div><div className="mt-4 space-y-1.5">{safeArray(verse?.lines).map((line: string, lineIndex: number) => <p key={`song-line-${lineIndex}`} className="text-sm leading-6 text-slate-200">{line}</p>)}</div></section>)}</div>
      {data?.tip && <section className="mx-6 mb-7 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-5 py-4 text-xs leading-6 text-amber-100 sm:mx-10"><strong>Consejo de interpretación:</strong> {data.tip}</section>}
      <footer className="flex items-center justify-between border-t border-white/10 px-8 py-4 text-[9px] font-bold uppercase tracking-widest text-slate-600"><span>EduAI Creator Studio</span><span>Letra editable</span></footer>
    </article>
  )
}

const EMOTION_LABELS: Record<string, string> = { neutral: "Neutral", enthusiastic: "Entusiasta", curious: "Curioso", thoughtful: "Reflexivo", surprised: "Sorprendido", humorous: "Humorístico" }

function PodcastPreview({ data, accentColor }: { data: any; accentColor: string }) {
  const segments = safeArray(data?.segments)
  return (
    <article className="mx-auto min-h-[820px] w-full max-w-[860px] overflow-hidden rounded-[28px] border border-slate-200 bg-white text-slate-900 shadow-sm">
      <header className="px-8 py-8 text-white sm:px-10" style={{ background: `linear-gradient(135deg,${accentColor},#4f46e5)` }}><p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/70">Guion de podcast educativo</p><h1 className="mt-2 text-3xl font-black leading-tight">{data?.title || "Podcast educativo"}</h1><p className="mt-2 text-sm font-semibold text-white/75">Duración estimada: {data?.duration || "Sin definir"}</p></header>
      <div className="space-y-4 bg-slate-50 px-6 py-7 sm:px-9">{segments.map((segment: any, index: number) => { const isA = segment?.speaker !== "B"; const color = isA ? accentColor : "#f97316"; return <section key={`podcast-preview-${index}`} className={`flex gap-3 ${isA ? "justify-start" : "justify-end"}`}><div className={`max-w-[82%] rounded-3xl border bg-white p-4 shadow-sm ${isA ? "rounded-tl-md" : "rounded-tr-md"}`} style={{ borderColor: `${color}2d` }}><div className="flex flex-wrap items-center gap-2"><span className="rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-white" style={{ background: color }}>Voz {segment?.speaker || "A"}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-bold text-slate-500">{EMOTION_LABELS[segment?.emotion] || segment?.emotion || "Neutral"}</span><span className="ml-auto text-[9px] font-bold text-slate-300">{String(index + 1).padStart(2, "0")}</span></div><p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-650">{segment?.text || "Intervención pendiente."}</p></div></section> })}</div>
      <footer className="flex items-center justify-between border-t border-slate-200 px-8 py-4 text-[9px] font-bold uppercase tracking-widest text-slate-400"><span>EduAI Creator Studio</span><span>{segments.length} intervenciones</span></footer>
    </article>
  )
}

function cleanPdfText(value: unknown) {
  return String(value || "").replace(/[\u{1F000}-\u{1FFFF}]/gu, "").replace(/[\u{2600}-\u{27BF}]/gu, "").replace(/\s{2,}/g, " ").trim()
}

async function downloadNarrativePDF(data: any, format: "story" | "song", fileName: string, accentColor: string) {
  const { jsPDF } = await import("jspdf")
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const hex = accentColor.replace("#", "").padEnd(6, "0")
  const accent: [number, number, number] = [parseInt(hex.slice(0, 2), 16) || 37, parseInt(hex.slice(2, 4), 16) || 99, parseInt(hex.slice(4, 6), 16) || 235]
  const pageW = 210
  const pageH = 297
  const margin = 18
  const contentW = pageW - margin * 2
  let y = 48

  const paintPage = () => { pdf.setFillColor(255, 255, 255); pdf.rect(0, 0, pageW, pageH, "F") }
  const newPage = () => { pdf.addPage(); paintPage(); y = margin }
  const check = (need = 18) => { if (y + need > pageH - 18) newPage() }
  const paragraph = (value: unknown, indent = 0, italic = false) => { const lines = pdf.splitTextToSize(cleanPdfText(value), contentW - indent); pdf.setFont("helvetica", italic ? "italic" : "normal"); pdf.setFontSize(10); pdf.setTextColor(65, 75, 90); for (const line of lines) { check(6); pdf.text(line, margin + indent, y); y += 5 } y += 2 }
  const heading = (value: string) => { check(14); pdf.setFillColor(...accent); pdf.roundedRect(margin, y - 4, 3, 8, 1, 1, "F"); pdf.setTextColor(35, 42, 56); pdf.setFont("helvetica", "bold"); pdf.setFontSize(13); pdf.text(cleanPdfText(value), margin + 7, y); y += 9 }

  paintPage()
  pdf.setFillColor(...accent)
  pdf.rect(0, 0, pageW, 38, "F")
  pdf.setTextColor(255, 255, 255)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(22)
  const titleLines = pdf.splitTextToSize(cleanPdfText(data?.title || (format === "story" ? "Relato educativo" : "Canción educativa")), contentW)
  let titleY = 16
  for (const line of titleLines.slice(0, 2)) { pdf.text(line, margin, titleY); titleY += 8 }
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(9)
  pdf.text(cleanPdfText(data?.subject || data?.style || "EduAI Creator Studio"), margin, 33)

  if (format === "story") {
    const characters = safeArray(data?.characters)
    if (characters.length) { heading("Personajes"); for (const character of characters) paragraph(`${character?.name || "Personaje"}: ${character?.role || ""}`, 4) }
    for (const [index, chapter] of safeArray(data?.chapters).entries()) { heading(`${index + 1}. ${chapter?.title || `Capítulo ${index + 1}`}`); paragraph(chapter?.content) }
    if (data?.moral) { heading("Enseñanza final"); paragraph(data.moral, 0, true) }
  } else {
    const chorus = safeArray(data?.chorus?.lines)
    if (chorus.length) { heading("Coro"); for (const line of chorus) paragraph(line, 4) }
    for (const verse of safeArray(data?.verses)) { heading(verse?.label || "Verso"); for (const line of safeArray(verse?.lines)) paragraph(line, 4) }
    if (data?.tip) { heading("Consejo de interpretación"); paragraph(data.tip) }
  }

  const pages = pdf.getNumberOfPages()
  for (let page = 1; page <= pages; page++) { pdf.setPage(page); pdf.setFillColor(...accent); pdf.rect(0, pageH - 9, pageW, 9, "F"); pdf.setTextColor(255, 255, 255); pdf.setFontSize(7); pdf.text("Generado por EduAI Creator Studio", margin, pageH - 3.5); pdf.text(`${page} / ${pages}`, pageW - margin, pageH - 3.5, { align: "right" }) }
  pdf.save(`${fileName}.pdf`)
}

function downloadNarrativeText(data: any, format: "story" | "song", fileName: string) {
  const lines: string[] = [String(data?.title || "Material EduAI"), String(data?.subject || ""), ""]
  if (format === "story") {
    for (const [index, chapter] of safeArray(data?.chapters).entries()) { lines.push(`${index + 1}. ${chapter?.title || "Capítulo"}`, String(chapter?.content || ""), "") }
    if (data?.moral) lines.push("ENSEÑANZA FINAL", String(data.moral))
  } else {
    lines.push("CORO", ...safeArray(data?.chorus?.lines).map(String), "")
    for (const verse of safeArray(data?.verses)) lines.push(String(verse?.label || "Verso").toUpperCase(), ...safeArray(verse?.lines).map(String), "")
    if (data?.tip) lines.push("CONSEJO", String(data.tip))
  }
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `${fileName}.txt`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 800)
}

function NarrativeDownloadBar({ format, data, title, accentColor }: { format: "story" | "song"; data: any; title: string; accentColor: string }) {
  const [downloading, setDownloading] = useState<string | null>(null)
  const fileName = safeFileName(title)
  const run = async (kind: "png" | "pdf" | "txt") => {
    setDownloading(kind)
    try {
      if (kind === "png") await downloadRenderedAsImage("creator-result-container", fileName, "png")
      else if (kind === "pdf") await downloadNarrativePDF(data, format, fileName, accentColor)
      else downloadNarrativeText(data, format, fileName)
    } finally { setDownloading(null) }
  }
  return <div className="rounded-2xl border border-soft bg-card-theme p-3.5"><div className="flex flex-wrap items-center gap-2"><span className="mr-1 text-[11px] font-semibold uppercase tracking-widest text-muted2">↓ Exportar</span><button type="button" onClick={() => run("png")} disabled={downloading !== null} className="inline-flex items-center gap-1.5 rounded-xl border border-violet-500/25 bg-violet-500/5 px-3 py-1.5 text-xs font-semibold text-violet-600 disabled:opacity-40">{downloading === "png" ? <LoaderCircle size={13} className="animate-spin" /> : <ImageIcon size={13} />} PNG</button><button type="button" onClick={() => run("pdf")} disabled={downloading !== null} className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/25 bg-red-500/5 px-3 py-1.5 text-xs font-semibold text-red-600 disabled:opacity-40">{downloading === "pdf" ? <LoaderCircle size={13} className="animate-spin" /> : <FileText size={13} />} PDF</button><button type="button" onClick={() => run("txt")} disabled={downloading !== null} className="inline-flex items-center gap-1.5 rounded-xl border border-blue-500/25 bg-blue-500/5 px-3 py-1.5 text-xs font-semibold text-blue-600 disabled:opacity-40">TXT</button></div></div>
}

function NarrativeEditor({ format, data, onChange }: { format: NarrativeFormat; data: any; onChange: (next: any) => void }) {
  if (format === "story") return <StoryEditor data={data} onChange={onChange} />
  if (format === "song") return <SongEditor data={data} onChange={onChange} />
  return <PodcastEditor data={data} onChange={onChange} />
}

function NarrativePreview({ format, data, accentColor }: { format: NarrativeFormat; data: any; accentColor: string }) {
  if (format === "story") return <StoryPreview data={data} accentColor={accentColor} />
  if (format === "song") return <SongPreview data={data} accentColor={accentColor} />
  return <PodcastPreview data={data} accentColor={accentColor} />
}

export default function EditableNarrativeCreatorPage({ format }: { format: NarrativeFormat }) {
  const meta = getCreatorHubFormat(format)
  const config = CONFIG[format]
  const [sourceType, setSourceType] = useState<SourceType>("topic")
  const [content, setContent] = useState("")
  const [fileName, setFileName] = useState("")
  const [accentColor, setAccentColor] = useState(meta?.color || "#8b5cf6")
  const [designTemplateId, setDesignTemplateId] = useState(() => getDefaultDesignTemplateId(format))
  const [step, setStep] = useState<Step>("input")
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; setFileName(file.name); const reader = new FileReader(); reader.onload = () => setContent(String(reader.result || "").split(",")[1] || ""); reader.readAsDataURL(file) }, [])
  const reset = () => { setSourceType("topic"); setContent(""); setFileName(""); setStep("input"); setProcessing(false); setResult(null); setError(null); setProjectId(null); setSaved(false); setAccentColor(meta?.color || "#8b5cf6"); setDesignTemplateId(getDefaultDesignTemplateId(format)); if (fileRef.current) fileRef.current.value = "" }

  const generate = async () => {
    if (!content.trim()) return
    setProcessing(true); setError(null); setSaved(false); setStep("processing")
    try {
      const response = await fetch("/api/process-content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceType, content, fileName, outputFormat: format, designTemplateId }) })
      const payload = await response.json() as ApiResponse
      if (!payload.success || !payload.output?.data) throw new Error(payload.error || "No fue posible generar el material")
      const generated = payload.output.data
      setResult(generated); setStep("result")
      const project = saveCreatorHubProject({ format, title: resultTitle(format, generated, meta?.label || "Material"), data: generated, accentColor, designTemplateId })
      setProjectId(project?.id || null); setSaved(Boolean(project))
    } catch (generationError: unknown) { setError(generationError instanceof Error ? generationError.message : "Ocurrió un error inesperado"); setStep("input") } finally { setProcessing(false) }
  }

  const updateResult = (next: any) => { setResult(next); if (!projectId) return; const updated = updateCreatorHubProject(projectId, { title: resultTitle(format, next, meta?.label || "Material"), data: next, accentColor, designTemplateId }); setSaved(Boolean(updated)) }
  if (!meta) return null
  const palette = designPalette(result)
  const currentTitle = resultTitle(format, result, meta.label)

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-soft bg-header-theme backdrop-blur-xl"><div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-5 py-3.5 sm:px-7"><div className="flex min-w-0 items-center gap-3"><Link href="/creator-hub/materials" className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-soft text-muted2 hover:text-main"><ArrowLeft size={15} /></Link><div className="flex h-10 w-10 items-center justify-center rounded-2xl text-xl" style={{ background: `${meta.color}16`, border: `1px solid ${meta.color}2c` }}>{meta.icon}</div><div className="min-w-0"><p className="truncate text-sm font-bold text-main sm:text-base">{meta.label} editable</p><p className="hidden text-[11px] text-muted2 sm:block">Genera, modifica y exporta contenido narrativo.</p></div></div><div className="flex items-center gap-2">{saved && <span className="hidden items-center gap-1.5 text-[11px] font-bold text-emerald-600 sm:flex"><CheckCircle2 size={13} /> Cambios guardados</span>}{(step === "result" || step === "processing") && <button type="button" onClick={reset} disabled={processing} className="inline-flex items-center gap-1.5 rounded-xl border border-soft px-3 py-2 text-xs font-bold text-muted2"><RotateCcw size={13} /> Nueva creación</button>}</div></div></header>
      <main className="mx-auto grid max-w-[1600px] items-start gap-5 px-5 py-6 sm:px-7 xl:grid-cols-[430px_minmax(0,1fr)]">
        <aside className="space-y-4 xl:sticky xl:top-[82px] xl:max-h-[calc(100vh-96px)] xl:overflow-y-auto xl:pr-1">
          {step !== "result" ? <><section className="rounded-3xl border border-soft bg-card-theme p-4 sm:p-5"><div className="flex items-center gap-2"><WandSparkles size={15} style={{ color: meta.color }} /><h2 className="text-sm font-bold text-main">Configura el material</h2></div><p className="mt-1.5 text-xs leading-relaxed text-muted2">Selecciona una fuente y crea una primera versión completamente editable.</p><div className="mt-5"><label className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted2">1. Fuente</label><div className="mt-2 grid grid-cols-2 gap-2">{SOURCE_TYPES.map((source) => { const active = sourceType === source.id; return <button key={source.id} type="button" onClick={() => { setSourceType(source.id); setContent(""); setFileName(""); setError(null); if (fileRef.current) fileRef.current.value = "" }} className="rounded-2xl border p-2.5 text-left" style={{ background: active ? `${meta.color}10` : "var(--bg-card-soft)", borderColor: active ? `${meta.color}35` : "var(--border-soft)" }}><span className="block text-base">{source.icon}</span><span className="mt-1 block text-xs font-bold" style={{ color: active ? meta.color : "var(--text-secondary)" }}>{source.label}</span><span className="mt-0.5 block text-[10px] text-muted2">{source.description}</span></button> })}</div></div><div className="mt-4"><label className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted2">2. Contenido</label>{sourceType === "topic" || sourceType === "text" || sourceType === "url" ? <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={sourceType === "text" ? 9 : 5} placeholder={sourceType === "topic" ? meta.placeholder : sourceType === "url" ? "https://ejemplo.com/articulo" : "Pega aquí el contenido..."} className="mt-2 w-full resize-y rounded-2xl border border-soft bg-card-soft-theme px-3.5 py-3 text-sm text-main outline-none" /> : <button type="button" onClick={() => fileRef.current?.click()} className="mt-2 w-full rounded-2xl border-2 border-dashed p-6 text-center" style={{ borderColor: content ? "rgba(16,185,129,0.32)" : "var(--border-medium)" }}>{content ? <CheckCircle2 size={24} className="mx-auto text-emerald-500" /> : <Upload size={24} className="mx-auto text-muted2" />}<span className="mt-2 block text-xs font-bold text-sub">{content ? `${fileName} cargado` : `Subir archivo .${sourceType}`}</span><input ref={fileRef} type="file" accept={sourceType === "pdf" ? ".pdf" : ".docx,.doc"} onChange={handleFile} className="hidden" /></button>}</div>{error && <div className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/5 p-3 text-xs text-red-500">❌ {error}</div>}</section><section className="space-y-5 rounded-3xl border border-soft bg-card-theme p-4 sm:p-5"><TemplatePicker format={format} value={designTemplateId} onChange={(templateId, nextAccent) => { setDesignTemplateId(templateId); if (nextAccent) setAccentColor(nextAccent) }} compact /><ColorPalette value={accentColor} onChange={setAccentColor} /></section><button type="button" onClick={generate} disabled={!content.trim() || processing} className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold text-white disabled:opacity-35" style={{ background: `linear-gradient(135deg,${meta.color}cc,${meta.color})` }}>{processing ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}{processing ? "Generando material editable..." : `Generar ${meta.label}`}</button></> : <section className="rounded-3xl border border-soft bg-card-theme p-4 sm:p-5"><p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: meta.color }}>Edición activa</p><h2 className="mt-1 text-base font-bold text-main">{config.title}</h2><p className="mb-4 mt-1 text-xs leading-relaxed text-muted2">{config.description}</p><NarrativeEditor format={format} data={result} onChange={updateResult} /></section>}
        </aside>
        <section className="min-w-0 overflow-hidden rounded-3xl border border-soft bg-card-theme"><div className="flex items-center justify-between border-b border-soft px-5 py-3.5"><div><p className="text-sm font-bold text-main">Vista narrativa</p><p className="text-[11px] text-muted2">Los cambios se reflejan inmediatamente.</p></div><span className="rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: `${meta.color}12`, color: meta.color }}>{meta.icon} {meta.label}</span></div>{step === "input" && <div className="flex min-h-[680px] flex-col items-center justify-center px-6 text-center"><div className="flex h-20 w-20 items-center justify-center rounded-[28px] text-4xl" style={{ background: `${meta.color}12` }}>{meta.icon}</div><h2 className="mt-5 text-lg font-bold text-main">Crea una primera versión con IA</h2><p className="mt-2 max-w-xl text-sm text-muted2">Después podrás editar cada personaje, capítulo, verso o intervención.</p><div className="mt-5 flex max-w-2xl items-start gap-2 rounded-2xl border border-soft bg-card-soft-theme p-3.5 text-left"><Info size={15} className="text-blue-500" /><p className="text-xs text-muted2">La mejora está aislada en Creator Hub y no modifica Cuaderno EduAI ni agentes.</p></div></div>}{step === "processing" && <div className="flex min-h-[680px] flex-col items-center justify-center px-6 text-center"><LoaderCircle size={44} className="animate-spin" style={{ color: meta.color }} /><h2 className="mt-5 text-lg font-bold text-main">Preparando contenido editable...</h2><div className="mt-5 flex flex-wrap justify-center gap-2">{config.processing.map((label) => <span key={label} className="animate-pulse rounded-full border border-soft px-3 py-1 text-[11px] text-muted2">{label}</span>)}</div></div>}{step === "result" && result && <div className="space-y-4 p-4 sm:p-5"><div className="flex items-center gap-3 rounded-2xl border p-3.5" style={{ background: `${meta.color}08`, borderColor: `${meta.color}22` }}><CheckCircle2 size={18} style={{ color: meta.color }} /><div className="flex-1"><p className="text-sm font-bold" style={{ color: meta.color }}>{meta.label} listo para editar</p><p className="text-[11px] text-muted2">Edita desde el panel izquierdo.</p></div><Link href="/creator-hub/projects" className="flex items-center gap-1.5 text-xs font-bold text-sub"><FolderOpen size={13} /> Ver proyectos</Link></div><div id="creator-result-container" className="overflow-auto rounded-2xl border p-3 sm:p-5" style={{ background: palette.background || "var(--bg-card-soft)", borderColor: palette.primary ? `${palette.primary}22` : "var(--border-soft)" }}><NarrativePreview format={format} data={result} accentColor={accentColor} /></div>{format !== "podcast" && <NarrativeDownloadBar format={format} data={result} title={currentTitle} accentColor={accentColor} />}<CreatorHubUtilityBar format={format} data={result} accentColor={accentColor} designTemplateId={designTemplateId} title={currentTitle} /></div>}</section>
      </main>
    </div>
  )
}
