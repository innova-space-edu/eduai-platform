"use client"

type KeyMoment = {
  timestamp?: string
  title?: string
  summary?: string
  evidenceType?: "audio" | "visual" | "both" | string
}

type Concept = {
  name?: string
  explanation?: string
  example?: string
  importance?: "main" | "supporting" | string
}

type GlossaryTerm = {
  term?: string
  definition?: string
}

type VideoSummaryData = {
  title?: string
  channel?: string
  duration?: string
  executiveSummary?: string
  centralThesis?: string
  keyMoments?: KeyMoment[]
  concepts?: Concept[]
  takeaways?: string[]
  questions?: string[]
  glossary?: GlossaryTerm[]
  limitations?: string[]
  sourceUrl?: string
  videoId?: string
  embedUrl?: string
  thumbnailUrl?: string
  generatedAt?: string
  settings?: {
    language?: string
    detailLevel?: string
    summaryStyle?: string
    audience?: string
    includeVisualAnalysis?: boolean
  }
}

function toSeconds(timestamp?: string) {
  if (!timestamp) return 0
  const parts = timestamp.split(":").map((value) => Number(value))
  if (parts.some((value) => !Number.isFinite(value) || value < 0)) return 0
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parts[0] || 0
}

function timestampUrl(sourceUrl?: string, timestamp?: string) {
  if (!sourceUrl) return "#"
  try {
    const url = new URL(sourceUrl)
    url.searchParams.set("t", `${toSeconds(timestamp)}s`)
    return url.toString()
  } catch {
    return sourceUrl
  }
}

function evidenceLabel(value?: string) {
  if (value === "visual") return "Evidencia visual"
  if (value === "both") return "Audio + visual"
  return "Contenido hablado"
}

function evidenceIcon(value?: string) {
  if (value === "visual") return "👁️"
  if (value === "both") return "🎬"
  return "🔊"
}

function formatLabel(value?: string) {
  const labels: Record<string, string> = {
    concise: "Conciso",
    standard: "Estándar",
    detailed: "Detallado",
    explanatory: "Explicativo",
    class: "Apoyo de clase",
    critical: "Análisis crítico",
    executive: "Ejecutivo",
    secondary: "Enseñanza media",
    teacher: "Docente",
    general: "Público general",
    university: "Universitario",
  }
  return value ? labels[value] || value : ""
}

export default function VideoSummaryRenderer({ data }: { data: unknown }) {
  const summary = (typeof data === "object" && data !== null ? data : {}) as VideoSummaryData
  const moments = Array.isArray(summary.keyMoments) ? summary.keyMoments : []
  const concepts = Array.isArray(summary.concepts) ? summary.concepts : []
  const takeaways = Array.isArray(summary.takeaways) ? summary.takeaways : []
  const questions = Array.isArray(summary.questions) ? summary.questions : []
  const glossary = Array.isArray(summary.glossary) ? summary.glossary : []
  const limitations = Array.isArray(summary.limitations) ? summary.limitations : []
  const embedUrl = summary.embedUrl || (summary.videoId ? `https://www.youtube-nocookie.com/embed/${summary.videoId}` : "")

  return (
    <article className="mx-auto max-w-6xl space-y-5 text-main">
      <section className="overflow-hidden rounded-3xl border border-soft bg-card-theme">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <div className="relative aspect-video min-h-[260px] bg-black">
            {embedUrl ? (
              <iframe
                src={embedUrl}
                title={summary.title || "Video de YouTube"}
                className="absolute inset-0 h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-white/70">Vista del video no disponible</div>
            )}
          </div>

          <div className="flex flex-col justify-center p-5 sm:p-7">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-red-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-red-500">YouTube</span>
              {summary.duration && <span className="rounded-full border border-soft px-3 py-1 text-[10px] font-bold text-muted2">⏱ {summary.duration}</span>}
              {summary.channel && <span className="rounded-full border border-soft px-3 py-1 text-[10px] font-bold text-muted2">Canal: {summary.channel}</span>}
            </div>
            <h1 className="mt-4 text-2xl font-black leading-tight sm:text-3xl">{summary.title || "Resumen del video"}</h1>
            {summary.centralThesis && (
              <div className="mt-4 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-500">Tesis central</p>
                <p className="mt-1.5 text-sm font-semibold leading-relaxed text-sub">{summary.centralThesis}</p>
              </div>
            )}
            {summary.sourceUrl && (
              <a
                href={summary.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex w-fit items-center gap-2 rounded-xl border border-soft px-3 py-2 text-xs font-bold text-sub transition hover:border-red-500/30 hover:text-red-500"
              >
                ▶ Abrir video original
              </a>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
        <div className="rounded-3xl border border-soft bg-card-theme p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/10 text-xl">🧾</span>
            <div>
              <h2 className="font-black">Resumen general</h2>
              <p className="text-[11px] text-muted2">Síntesis construida desde el audio y las imágenes del video.</p>
            </div>
          </div>
          <p className="mt-4 whitespace-pre-line text-sm leading-7 text-sub">{summary.executiveSummary || "No se generó un resumen general."}</p>
        </div>

        <div className="rounded-3xl border border-soft bg-card-theme p-5 sm:p-6">
          <h2 className="text-sm font-black">Configuración aplicada</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {summary.settings?.language && <span className="rounded-full bg-card-soft-theme px-3 py-1.5 text-[10px] font-bold text-sub">🌐 {summary.settings.language}</span>}
            {summary.settings?.detailLevel && <span className="rounded-full bg-card-soft-theme px-3 py-1.5 text-[10px] font-bold text-sub">📚 {formatLabel(summary.settings.detailLevel)}</span>}
            {summary.settings?.summaryStyle && <span className="rounded-full bg-card-soft-theme px-3 py-1.5 text-[10px] font-bold text-sub">🧭 {formatLabel(summary.settings.summaryStyle)}</span>}
            {summary.settings?.audience && <span className="rounded-full bg-card-soft-theme px-3 py-1.5 text-[10px] font-bold text-sub">👥 {formatLabel(summary.settings.audience)}</span>}
            <span className="rounded-full bg-card-soft-theme px-3 py-1.5 text-[10px] font-bold text-sub">{summary.settings?.includeVisualAnalysis === false ? "🔊 Solo contenido principal" : "🎬 Audio y análisis visual"}</span>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-soft bg-card-theme p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-black">Momentos clave del video</h2>
            <p className="mt-1 text-xs text-muted2">Selecciona una marca de tiempo para abrir el momento exacto en YouTube.</p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted2">{moments.length} segmentos</span>
        </div>

        <div className="relative mt-5 space-y-3 before:absolute before:bottom-4 before:left-[39px] before:top-4 before:w-px before:bg-[var(--border-medium)]">
          {moments.map((moment, index) => (
            <div key={`${moment.timestamp}-${index}`} className="relative grid grid-cols-[80px_minmax(0,1fr)] gap-3">
              <a
                href={timestampUrl(summary.sourceUrl, moment.timestamp)}
                target="_blank"
                rel="noreferrer"
                className="relative z-10 flex h-9 items-center justify-center rounded-xl border border-red-500/25 bg-card-theme text-[11px] font-black text-red-500 transition hover:bg-red-500/10"
                title={`Abrir el video en ${moment.timestamp || "este momento"}`}
              >
                {moment.timestamp || "00:00"}
              </a>
              <div className="rounded-2xl border border-soft bg-card-soft-theme p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-black">{moment.title || `Momento ${index + 1}`}</h3>
                  <span className="rounded-full border border-soft bg-card-theme px-2.5 py-1 text-[9px] font-bold text-muted2">
                    {evidenceIcon(moment.evidenceType)} {evidenceLabel(moment.evidenceType)}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-6 text-sub">{moment.summary}</p>
              </div>
            </div>
          ))}
          {moments.length === 0 && <p className="py-8 text-center text-sm text-muted2">No se identificaron momentos clave.</p>}
        </div>
      </section>

      <section className="rounded-3xl border border-soft bg-card-theme p-5 sm:p-6">
        <h2 className="text-lg font-black">Conceptos principales</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {concepts.map((concept, index) => (
            <div key={`${concept.name}-${index}`} className="rounded-2xl border border-soft bg-card-soft-theme p-4">
              <div className="flex items-start gap-3">
                <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-sm font-black ${concept.importance === "main" ? "bg-blue-500/15 text-blue-500" : "bg-violet-500/10 text-violet-500"}`}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="text-sm font-black">{concept.name || `Concepto ${index + 1}`}</h3>
                  <p className="mt-1.5 text-xs leading-6 text-sub">{concept.explanation}</p>
                  {concept.example && (
                    <p className="mt-2 rounded-xl border border-soft bg-card-theme px-3 py-2 text-[11px] leading-5 text-muted2"><strong className="text-sub">Ejemplo:</strong> {concept.example}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-5 sm:p-6">
          <h2 className="font-black text-emerald-600">Aprendizajes esenciales</h2>
          <ol className="mt-4 space-y-3">
            {takeaways.map((takeaway, index) => (
              <li key={`${takeaway}-${index}`} className="flex gap-3 text-sm leading-6 text-sub">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[10px] font-black text-emerald-600">{index + 1}</span>
                <span>{takeaway}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-5 sm:p-6">
          <h2 className="font-black text-amber-600">Preguntas para profundizar</h2>
          <ol className="mt-4 space-y-3">
            {questions.map((question, index) => (
              <li key={`${question}-${index}`} className="flex gap-3 text-sm leading-6 text-sub">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-[10px] font-black text-amber-600">?</span>
                <span>{question}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {(glossary.length > 0 || limitations.length > 0) && (
        <section className="grid gap-4 lg:grid-cols-2">
          {glossary.length > 0 && (
            <div className="rounded-3xl border border-soft bg-card-theme p-5 sm:p-6">
              <h2 className="font-black">Glosario del video</h2>
              <dl className="mt-4 space-y-3">
                {glossary.map((item, index) => (
                  <div key={`${item.term}-${index}`} className="rounded-2xl bg-card-soft-theme p-3.5">
                    <dt className="text-xs font-black text-blue-500">{item.term}</dt>
                    <dd className="mt-1 text-xs leading-5 text-sub">{item.definition}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {limitations.length > 0 && (
            <div className="rounded-3xl border border-orange-500/20 bg-orange-500/5 p-5 sm:p-6">
              <h2 className="font-black text-orange-600">Observaciones y límites del análisis</h2>
              <ul className="mt-4 space-y-2">
                {limitations.map((limitation, index) => (
                  <li key={`${limitation}-${index}`} className="flex gap-2 text-xs leading-6 text-sub"><span className="text-orange-500">•</span>{limitation}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <footer className="flex flex-col gap-1 border-t border-soft pt-4 text-[10px] text-muted2 sm:flex-row sm:items-center sm:justify-between">
        <span>EduAI Creator Hub · Resumen multimodal de video</span>
        {summary.generatedAt && <span>Generado: {new Date(summary.generatedAt).toLocaleString("es-CL")}</span>}
      </footer>
    </article>
  )
}
