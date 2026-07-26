"use client"

import VideoSummaryRenderer from "@/components/creator-hub/VideoSummaryRenderer"
import SourceStudioPreview from "@/components/creator-hub/SourceStudioPreview"
import EducationalDocumentPreview from "@/components/creator-hub/EducationalDocumentPreview"
import { RENDERERS } from "@/components/creator-hub/renderers"

const EDUCATIONAL_FORMATS = new Set([
  "worksheet",
  "rubric",
  "exam",
  "answer-key",
  "lab-sheet",
  "exit-ticket",
  "checklist",
  "report",
])

function list(value: unknown): any[] {
  return Array.isArray(value) ? value.filter((item) => !(item && typeof item === "object" && item.hidden === true)) : []
}

function ComicPreview({ data, accentColor }: { data: any; accentColor: string }) {
  const panels = list(data?.panels)
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 text-slate-900">
      <header className="mb-5 border-b border-slate-200 pb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: accentColor }}>Historieta educativa</p>
        <h1 className="mt-2 text-2xl font-black">{data?.title || "Historieta"}</h1>
        {data?.summary && <p className="mt-2 text-sm leading-6 text-slate-600">{data.summary}</p>}
      </header>
      <div className={`grid gap-4 ${data?.style === "webtoon" ? "grid-cols-1" : "md:grid-cols-2"}`}>
        {panels.map((panel, index) => (
          <section key={panel?.id || index} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            <div className={`relative flex items-center justify-center overflow-hidden bg-white ${data?.style === "webtoon" ? "aspect-[2/3]" : "aspect-[4/3]"}`}>
              {panel?.imageUrl ? <img src={panel.imageUrl} alt={panel?.title || `Viñeta ${index + 1}`} className="h-full w-full object-cover" /> : <div className="p-6 text-center text-xs text-slate-400">Imagen pendiente</div>}
              {panel?.dialogue && <div className="absolute left-3 top-3 max-w-[74%] rounded-2xl rounded-tl-sm border border-black/10 bg-white/95 px-3 py-2 text-[11px] font-semibold leading-4 shadow-lg">{panel.dialogue}</div>}
            </div>
            <div className="p-3"><p className="text-xs font-black" style={{ color: accentColor }}>{index + 1}. {panel?.title || "Viñeta"}</p><p className="mt-1 text-[11px] leading-5 text-slate-600">{panel?.scene}</p></div>
          </section>
        ))}
      </div>
    </article>
  )
}

function TablePreview({ data, accentColor }: { data: any; accentColor: string }) {
  const columns = list(data?.columns)
  const rows = list(data?.rows)
  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-900">
      <header className="border-b border-slate-200 px-6 py-5"><p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: accentColor }}>Tabla de datos</p><h1 className="mt-1 text-xl font-black">{data?.title || "Tabla"}</h1>{data?.description && <p className="mt-2 text-xs leading-5 text-slate-500">{data.description}</p>}</header>
      <div className="overflow-x-auto"><table className="w-full min-w-[620px] border-collapse text-left text-xs"><thead><tr>{columns.map((column, index) => <th key={column?.id || index} className="border-b border-slate-200 px-4 py-3 font-black" style={{ color: accentColor }}>{column?.label || column?.name || `Columna ${index + 1}`}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={row?.id || rowIndex} className={rowIndex % 2 ? "bg-slate-50" : "bg-white"}>{list(row?.values || row).map((value, valueIndex) => <td key={valueIndex} className="border-b border-slate-100 px-4 py-3 text-slate-600">{String(value ?? "")}</td>)}</tr>)}</tbody></table></div>
    </article>
  )
}

export default function ProjectReadOnlyPreview({ format, data, accentColor = "#7c3aed" }: { format: string; data: any; accentColor?: string }) {
  if (format === "comic" || format === "comics") return <ComicPreview data={data} accentColor={accentColor} />
  if (format === "data-table") return <TablePreview data={data} accentColor={accentColor} />
  if (format === "video-summary") return <VideoSummaryRenderer data={data} />
  if (format === "report" && Array.isArray(data?._sources)) return <SourceStudioPreview data={data} accentColor={accentColor} />
  if (EDUCATIONAL_FORMATS.has(format)) return <EducationalDocumentPreview format={format as any} data={data} accentColor={accentColor} />
  const Renderer = RENDERERS[format]
  if (Renderer) return <Renderer data={data} />
  return <pre className="max-h-[900px] overflow-auto rounded-2xl border border-soft bg-card-soft-theme p-4 text-xs leading-5 text-sub">{JSON.stringify(data, null, 2)}</pre>
}
