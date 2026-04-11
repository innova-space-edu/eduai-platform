"use client"

import { useEffect, useState, useRef } from "react"

interface Props {
  topic: string
  context: string
}

type VisualType = "image" | "chart" | "mermaid" | "table" | "none"
type State = "idle" | "detecting" | "done" | "skip"

interface Detection {
  shouldGenerate: boolean
  type: VisualType
  imagePrompt: string
  mermaidCode: string
  chartSpec: string
  caption: string
}

// ─── Mermaid renderer ─────────────────────────────────────────────────────────
function MermaidDiagram({ code, caption }: { code: string; caption: string }) {
  const ref              = useRef<HTMLDivElement>(null)
  const [err, setErr]    = useState("")
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!code || !ref.current) return
    let cancelled = false
    ;(async () => {
      try {
        const mermaid = (await import("mermaid")).default
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          themeVariables: {
            primaryColor: "#3b82f6", primaryTextColor: "var(--text-primary)",
            primaryBorderColor: "#1e40af", lineColor: "var(--text-muted)",
            background: "var(--bg-card)", mainBkg: "var(--bg-card-soft)",
            nodeBorder: "#3b82f6", edgeLabelBackground: "var(--bg-card-soft)",
            titleColor: "var(--text-primary)",
          },
        })
        const id = `mmd-${Math.random().toString(36).slice(2)}`
        const { svg } = await mermaid.render(id, code)
        if (!cancelled && ref.current) { ref.current.innerHTML = svg; setReady(true) }
      } catch (e: any) { if (!cancelled) setErr(e.message) }
    })()
    return () => { cancelled = true }
  }, [code])

  if (err) return (
    <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg p-3">
      Error diagrama: {err}
    </p>
  )
  return (
    <div>
      {!ready && (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <div ref={ref}
        className={`w-full flex justify-center transition-opacity duration-500 ${ready ? "opacity-100" : "opacity-0"}`} />
      {caption && ready && (
        <p className="text-muted2 text-[11px] italic text-center mt-2">{caption}</p>
      )}
    </div>
  )
}

// ─── Chart.js renderer ────────────────────────────────────────────────────────
function ChartBlock({ specStr, caption }: { specStr: string; caption: string }) {
  const canvasRef         = useRef<HTMLCanvasElement>(null)
  const chartRef          = useRef<any>(null)
  const [err, setErr]     = useState("")
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!specStr || !canvasRef.current) return
    let spec: any
    try { spec = JSON.parse(specStr) } catch { setErr("JSON inválido"); return }
    ;(async () => {
      try {
        const { Chart, registerables } = await import("chart.js")
        Chart.register(...registerables)
        if (chartRef.current) chartRef.current.destroy()
        const palette = ["#3b82f6","#8b5cf6","#10b981","#f59e0b","#ef4444","#06b6d4","#ec4899"]
        if (spec.data?.datasets) {
          spec.data.datasets = spec.data.datasets.map((ds: any, i: number) => ({
            backgroundColor: palette[i % palette.length] + "44",
            borderColor:     palette[i % palette.length],
            borderWidth: 2, ...ds,
          }))
        }
        const isFlat = spec.type === "pie" || spec.type === "doughnut"
        spec.options = {
          responsive: true, maintainAspectRatio: true, ...spec.options,
          plugins: { legend: { labels: { color: "var(--text-muted)", font: { size: 11 } } }, ...(spec.options?.plugins || {}) },
          ...(!isFlat && {
            scales: {
              x: { ticks: { color: "var(--text-muted)" }, grid: { color: "var(--bg-card-soft)" } },
              y: { ticks: { color: "var(--text-muted)" }, grid: { color: "var(--bg-card-soft)" } },
            },
          }),
        }
        chartRef.current = new Chart(canvasRef.current!, spec)
        setReady(true)
      } catch (e: any) { setErr(e.message) }
    })()
    return () => { chartRef.current?.destroy() }
  }, [specStr])

  if (err) return (
    <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg p-3">
      Error gráfico: {err}
    </p>
  )
  return (
    <div>
      {!ready && (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <div className={`transition-opacity duration-500 ${ready ? "opacity-100" : "opacity-0"}`}>
        <canvas ref={canvasRef} className="max-h-64" />
      </div>
      {caption && ready && (
        <p className="text-muted2 text-[11px] italic text-center mt-2">{caption}</p>
      )}
    </div>
  )
}

// ─── Table renderer ───────────────────────────────────────────────────────────
function TableBlock({ specStr, caption }: { specStr: string; caption: string }) {
  let data: { headers?: string[]; rows?: string[][] } = {}
  try { data = JSON.parse(specStr) } catch { return null }
  const { headers = [], rows = [] } = data
  if (!rows.length) return null
  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-medium">
        <table className="w-full text-sm">
          {headers.length > 0 && (
            <thead>
              <tr className="border-b border-medium bg-card-soft-theme">
                {headers.map((h, i) => (
                  <th key={i} className="px-4 py-2.5 text-left text-sub font-semibold text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className={`border-b border-soft ${ri % 2 === 0 ? "bg-card-theme" : ""} hover:bg-card-soft-theme transition-colors`}>
                {row.map((cell, ci) => (
                  <td key={ci} className="px-4 py-2.5 text-sub text-xs">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {caption && <p className="text-muted2 text-[11px] italic text-center mt-2">{caption}</p>}
    </div>
  )
}

// ─── Image block — solo se activa cuando el usuario lo pide ──────────────────
function ImageBlock({
  imagePrompt, topic, caption, regenerateKey,
}: {
  imagePrompt: string; topic: string; caption: string; regenerateKey: number
}) {
  const [url,     setUrl]     = useState("")
  const [provider,setProv]    = useState("")
  const [loading, setLoading] = useState(true)
  const [expanded,setExp]     = useState(true)

  useEffect(() => {
    setLoading(true); setUrl("")
    fetch("/api/agents/imagenes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: imagePrompt,
        style: "educational illustration",
        width: 768, height: 432,
        provider: "auto",
        source: "auto_study",
        topic,
        customPrompt: imagePrompt + ", educational illustration, clear, detailed, professional",
      }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.imageUrl) { setUrl(d.imageUrl); setProv(d.provider) } })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [imagePrompt, regenerateKey])

  if (loading) return (
    <div className="flex items-center gap-2.5 py-4 text-muted2 text-xs">
      <div className="w-4 h-4 border-2 border-blue-500/40 border-t-blue-400 rounded-full animate-spin flex-shrink-0" />
      Generando imagen educativa...
    </div>
  )
  if (!url) return (
    <p className="text-muted2 text-xs py-2">No se pudo generar la imagen. Intenta de nuevo.</p>
  )
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-[10px] text-muted2">via {provider}</span>
        <button onClick={() => setExp(e => !e)}
          className="text-[10px] text-muted2 hover:text-sub px-2 py-1 rounded hover:bg-card-soft-theme transition-colors">
          {expanded ? "Ocultar ▲" : "Ver ▼"}
        </button>
      </div>
      {expanded && (
        <div className="relative rounded-xl overflow-hidden">
          <img src={url} alt={imagePrompt} className="w-full object-cover max-h-64" />
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-3">
            <p className="text-muted2 text-[10px] italic line-clamp-1">{caption || imagePrompt}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Botón de imagen bajo demanda ────────────────────────────────────────────
function ImageOnDemand({
  imagePrompt, topic, caption,
}: {
  imagePrompt: string; topic: string; caption: string
}) {
  const [triggered,  setTriggered]  = useState(false)
  const [regenKey,   setRegenKey]   = useState(0)

  if (!triggered) {
    return (
      <div className="flex items-center justify-between">
        {/* Descripción de lo que se generaría */}
        <p className="text-muted2 text-xs italic truncate flex-1 pr-3">
          {caption || imagePrompt}
        </p>
        <button
          onClick={() => setTriggered(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all flex-shrink-0"
          style={{
            background:  "rgba(59,130,246,0.08)",
            borderColor: "rgba(59,130,246,0.2)",
            color:       "#93c5fd",
          }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLElement).style.background   = "rgba(59,130,246,0.15)"
            ;(e.currentTarget as HTMLElement).style.borderColor  = "rgba(59,130,246,0.35)"
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLElement).style.background   = "rgba(59,130,246,0.08)"
            ;(e.currentTarget as HTMLElement).style.borderColor  = "rgba(59,130,246,0.2)"
          }}
        >
          🖼️ Generar imagen
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-end mb-2">
        <button
          onClick={() => setRegenKey(k => k + 1)}
          className="text-[10px] text-muted2 hover:text-sub px-2 py-1 rounded hover:bg-card-soft-theme transition-colors"
        >
          🔄 Regenerar
        </button>
      </div>
      <ImageBlock
        imagePrompt={imagePrompt}
        topic={topic}
        caption={caption}
        regenerateKey={regenKey}
      />
    </div>
  )
}

// ─── Metadatos por tipo ───────────────────────────────────────────────────────
const TYPE_META = {
  image:   { icon: "🖼️",  label: "Imagen educativa",  borderCls: "border-blue-500/30",   bgCls: "bg-blue-500/5",   textCls: "text-blue-400"   },
  mermaid: { icon: "🔀",  label: "Diagrama de flujo", borderCls: "border-green-500/30",  bgCls: "bg-green-500/5",  textCls: "text-green-400"  },
  chart:   { icon: "📊",  label: "Gráfico de datos",  borderCls: "border-purple-500/30", bgCls: "bg-purple-500/5", textCls: "text-purple-400" },
  table:   { icon: "📋",  label: "Tabla comparativa", borderCls: "border-amber-500/30",  bgCls: "bg-amber-500/5",  textCls: "text-amber-400"  },
  none:    { icon: "",    label: "",                   borderCls: "",                     bgCls: "",                textCls: ""                },
} as const

// ─── Componente principal ─────────────────────────────────────────────────────
export default function VisualBlock({ topic, context }: Props) {
  const [state, setState] = useState<State>("idle")
  const [det,   setDet]   = useState<Detection | null>(null)

  useEffect(() => {
    if (!context || context.length < 100) return
    detect()
  }, [context])

  async function detect() {
    setState("detecting")
    try {
      const res  = await fetch("/api/agents/visual-detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, context }),
      })
      const data: Detection = await res.json()
      if (!data.shouldGenerate || data.type === "none") { setState("skip"); return }
      setDet(data)
      setState("done")
    } catch { setState("skip") }
  }

  if (state === "idle" || state === "skip") return null

  if (state === "detecting") return (
    <div className="mt-4 flex items-center gap-2 text-muted2 text-xs">
      <div className="w-3 h-3 border border-medium border-t-transparent rounded-full animate-spin" />
      Analizando si hay algo para visualizar...
    </div>
  )

  if (!det) return null

  const meta = TYPE_META[det.type] ?? TYPE_META.image

  return (
    <div className={`mt-4 border ${meta.borderCls} rounded-2xl overflow-hidden ${meta.bgCls}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-soft">
        <div className="flex items-center gap-2">
          <span className="text-sm">{meta.icon}</span>
          <span className={`text-xs font-medium ${meta.textCls}`}>{meta.label}</span>
        </div>
        <span className="text-[10px] text-muted2">AGT-AIm v2</span>
      </div>

      {/* Contenido */}
      <div className="p-4">
        {/* ── IMAGEN: solo bajo demanda del usuario ── */}
        {det.type === "image" && (
          <ImageOnDemand
            imagePrompt={det.imagePrompt}
            topic={topic}
            caption={det.caption}
          />
        )}

        {/* ── Diagramas, gráficos y tablas: automáticos ── */}
        {det.type === "mermaid" && det.mermaidCode && (
          <MermaidDiagram code={det.mermaidCode} caption={det.caption} />
        )}
        {det.type === "chart" && det.chartSpec && (
          <ChartBlock specStr={det.chartSpec} caption={det.caption} />
        )}
        {det.type === "table" && det.chartSpec && (
          <TableBlock specStr={det.chartSpec} caption={det.caption} />
        )}
      </div>
    </div>
  )
}
