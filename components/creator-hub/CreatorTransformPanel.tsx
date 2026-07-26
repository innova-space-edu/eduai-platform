"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, CheckCircle2, LoaderCircle, Repeat2, Sparkles } from "lucide-react"
import { CREATOR_HUB_FORMATS } from "@/components/creator-hub/catalog"
import { saveCreatorHubProject } from "@/components/creator-hub/project-store"

const SUPPORTED_TARGETS = new Set([
  "infographic",
  "ppt",
  "poster",
  "podcast",
  "mindmap",
  "flashcards",
  "quiz",
  "timeline",
  "cornell",
  "glossary",
  "story",
  "song",
  "lessonplan",
])

function titleFromData(data: any, fallback: string) {
  return data?.title || data?.headline || data?.deckTitle || data?.centralTopic || data?.topic || fallback
}

export default function CreatorTransformPanel({
  sourceFormat,
  data,
  accentColor,
  designTemplateId,
}: {
  sourceFormat: string
  data: any
  accentColor: string
  designTemplateId?: string
}) {
  const targets = useMemo(() => CREATOR_HUB_FORMATS.filter((item) => SUPPORTED_TARGETS.has(item.id) && item.id !== sourceFormat), [sourceFormat])
  const [targetFormat, setTargetFormat] = useState(targets[0]?.id || "infographic")
  const [instruction, setInstruction] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [created, setCreated] = useState<{ id: string; format: string; title: string } | null>(null)

  const transform = async () => {
    setLoading(true)
    setError("")
    setCreated(null)
    try {
      const response = await fetch("/api/creator/transform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceFormat, targetFormat, data, instruction }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.output?.data) throw new Error(payload?.error || "No fue posible transformar el material.")
      const meta = CREATOR_HUB_FORMATS.find((item) => item.id === targetFormat)
      const transformed = payload.output.data
      const title = titleFromData(transformed, meta?.label || "Material transformado")
      const project = saveCreatorHubProject({
        format: targetFormat,
        title,
        data: transformed,
        accentColor,
        designTemplateId,
      })
      if (!project) throw new Error("El material se transformó, pero no fue posible guardarlo en Mis proyectos.")
      setCreated({ id: project.id, format: targetFormat, title })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible transformar el material.")
    } finally {
      setLoading(false)
    }
  }

  if (targets.length === 0) return null

  return (
    <section className="rounded-3xl border border-soft bg-card-theme p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600"><Repeat2 size={18} /></div>
        <div><h2 className="text-sm font-bold text-main">Transformar este material</h2><p className="mt-1 text-xs leading-5 text-muted2">Reutiliza el contenido y conviértelo en otro formato sin comenzar desde cero.</p></div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)]">
        <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-muted2">Formato de destino</span><select value={targetFormat} onChange={(event) => setTargetFormat(event.target.value)} className="w-full rounded-xl border border-soft bg-card-soft-theme px-3 py-2.5 text-xs text-main outline-none">{targets.map((target) => <option key={target.id} value={target.id}>{target.icon} {target.label}</option>)}</select></label>
        <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-muted2">Instrucción adicional</span><input value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="Ej: conviértelo en una actividad para 2° medio y conserva los ejemplos" className="w-full rounded-xl border border-soft bg-card-soft-theme px-3 py-2.5 text-xs text-main outline-none" /></label>
      </div>

      {error && <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-500">{error}</div>}
      {created && <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 sm:flex-row sm:items-center"><CheckCircle2 size={16} className="flex-shrink-0 text-emerald-600" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-emerald-700">{created.title}</p><p className="text-[10px] text-emerald-700/70">La nueva versión quedó guardada como un proyecto independiente.</p></div><Link href={`/creator-hub/projects/${encodeURIComponent(created.id)}`} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-[10px] font-bold text-white">Abrir y editar <ArrowRight size={11} /></Link></div>}

      <button type="button" onClick={transform} disabled={loading} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">{loading ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}{loading ? "Transformando..." : "Crear nuevo material"}</button>
    </section>
  )
}
