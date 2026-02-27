"use client"

import { useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface Visual {
  type: "image" | "mermaid" | "chart" | "table"
  title: string
  caption: string
  imagePrompt?: string
  content: string
  chartData?: any
}

interface Props {
  topic: string
  context: string
}

export default function VisualBlock({ topic, context }: Props) {
  const [visual, setVisual] = useState<Visual | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 99999))
  const mermaidRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)

  function getImageUrl(prompt: string, s: number) {
    const full = `Educational illustration: ${prompt}, clean, colorful, infographic style, white background, high quality, no text`
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(full)}?width=800&height=500&model=flux&nologo=true&seed=${s}`
  }

  async function generateVisual(type = "auto") {
    setLoading(true)
    setError("")
    setVisual(null)
    setImgLoaded(false)
    setImgError(false)

    if (chartRef.current) {
      chartRef.current.destroy()
      chartRef.current = null
    }

    try {
      const res = await fetch("/api/agents/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, context, type }),
      })
      if (!res.ok) throw new Error("Error generando visual")
      const data = await res.json()
      setVisual(data)
      setLoading(false)

      if (data.type === "mermaid") setTimeout(() => renderMermaid(data.content), 200)
      if (data.type === "chart" && data.chartData) setTimeout(() => renderChart(data.chartData), 200)

    } catch (e: any) {
      setError("No se pudo generar el visual.")
      setLoading(false)
    }
  }

  async function renderMermaid(code: string) {
    try {
      const mermaid = (await import("mermaid")).default
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        themeVariables: {
          primaryColor: "#1e40af",
          primaryTextColor: "#e2e8f0",
          primaryBorderColor: "#3b82f6",
          lineColor: "#64748b",
          secondaryColor: "#1e293b",
          background: "#0f172a",
        },
      })
      const id = "mermaid-" + Date.now()
      const { svg } = await mermaid.render(id, code)
      if (mermaidRef.current) mermaidRef.current.innerHTML = svg
    } catch (e: any) {
      if (mermaidRef.current) {
        mermaidRef.current.innerHTML = `<p class="text-red-400 text-xs p-2">Error en diagrama: ${e.message}</p>`
      }
    }
  }

  async function renderChart(chartData: any) {
    const canvas = document.getElementById("chart-canvas") as HTMLCanvasElement
    if (!canvas) return
    try {
      const { Chart, registerables } = await import("chart.js")
      Chart.register(...registerables)
      chartRef.current = new Chart(canvas, {
        type: chartData.type || "bar",
        data: {
          ...chartData.data,
          datasets: chartData.data.datasets.map((d: any) => ({
            ...d,
            backgroundColor: d.backgroundColor || ["#3b82f6","#8b5cf6","#06b6d4","#10b981","#f59e0b"],
            borderRadius: 6,
          }))
        },
        options: {
          responsive: true,
          plugins: { legend: { labels: { color: "#94a3b8", font: { size: 11 } } } },
          scales: chartData.type !== "pie" && chartData.type !== "doughnut" ? {
            x: { ticks: { color: "#64748b" }, grid: { color: "#1e293b" } },
            y: { ticks: { color: "#64748b" }, grid: { color: "#1e293b" } },
          } : undefined,
        },
      })
    } catch (e) { console.error(e) }
  }

  function regenerateImage() {
    const newSeed = Math.floor(Math.random() * 99999)
    setSeed(newSeed)
    setImgLoaded(false)
    setImgError(false)
  }

  return (
    <div className="mt-4">
      {!visual && !loading && (
        <div>
          <p className="text-xs text-gray-600 mb-2">🎨 AIm — Generar visual del concepto</p>
          <div className="flex flex-wrap gap-2">
            {[
              { type: "auto",    label: "✨ Auto" },
              { type: "image",   label: "🖼️ Imagen" },
              { type: "mermaid", label: "📊 Diagrama" },
              { type: "chart",   label: "📈 Gráfico" },
              { type: "table",   label: "📋 Tabla" },
            ].map(btn => (
              <button
                key={btn.type}
                onClick={() => generateVisual(btn.type)}
                className="bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-blue-500/40 rounded-xl px-3 py-2 text-sm text-gray-400 hover:text-white transition-all"
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <p className="text-gray-300 text-sm">AIm generando visual...</p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center justify-between">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={() => generateVisual()} className="text-xs text-gray-500 hover:text-white ml-3">↺</button>
        </div>
      )}

      {visual && !loading && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-400 font-medium">🎨 AIm</span>
              <span className="text-gray-600 text-xs">·</span>
              <span className="text-gray-400 text-xs truncate max-w-[160px]">{visual.title}</span>
            </div>
            <div className="flex items-center gap-3">
              {[
                { type: "image", label: "🖼️" },
                { type: "mermaid", label: "📊" },
                { type: "chart", label: "📈" },
                { type: "table", label: "📋" },
              ].filter(b => b.type !== visual.type).map(btn => (
                <button key={btn.type} onClick={() => generateVisual(btn.type)}
                  className="text-xs text-gray-600 hover:text-gray-300 transition-colors">{btn.label}
                </button>
              ))}
              <button onClick={() => {
                if (visual.type === "image") regenerateImage()
                else generateVisual(visual.type)
              }} className="text-xs text-gray-600 hover:text-gray-300">↺</button>
              <button onClick={() => setVisual(null)} className="text-xs text-gray-600 hover:text-gray-300">✕</button>
            </div>
          </div>

          <div className="p-4">
            {/* Imagen — generada client-side con Pollinations */}
            {visual.type === "image" && visual.imagePrompt && !imgError && (
              <div className="relative">
                {!imgLoaded && (
                  <div className="w-full h-52 bg-gray-800 rounded-xl flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <div className="text-center">
                      <p className="text-gray-400 text-sm">Generando imagen con FLUX...</p>
                      <p className="text-gray-600 text-xs mt-1">Puede tomar 10-20 segundos</p>
                    </div>
                  </div>
                )}
                <img
                  src={getImageUrl(visual.imagePrompt, seed)}
                  alt={visual.title}
                  onLoad={() => setImgLoaded(true)}
                  onError={() => setImgError(true)}
                  className={`w-full rounded-xl transition-opacity duration-700 ${imgLoaded ? "opacity-100" : "opacity-0 absolute"}`}
                />
                {imgLoaded && (
                  <div className="absolute top-2 right-2">
                    <span className="bg-black/60 text-gray-300 text-xs px-2 py-1 rounded-full">FLUX · Pollinations</span>
                  </div>
                )}
              </div>
            )}

            {visual.type === "image" && imgError && (
              <div className="bg-gray-800 rounded-xl p-8 text-center">
                <p className="text-4xl mb-3">🖼️</p>
                <p className="text-gray-400 text-sm mb-1">Pollinations no respondió</p>
                <p className="text-gray-600 text-xs mb-4">El servicio puede estar ocupado</p>
                <button
                  onClick={() => { setSeed(Math.floor(Math.random() * 99999)); setImgError(false); setImgLoaded(false) }}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-lg transition-colors"
                >
                  ↺ Reintentar
                </button>
              </div>
            )}

            {/* Mermaid */}
            {visual.type === "mermaid" && (
              <div ref={mermaidRef} className="overflow-x-auto flex justify-center min-h-[120px]" />
            )}

            {/* Chart */}
            {visual.type === "chart" && (
              <div className="relative h-64">
                <canvas id="chart-canvas" />
              </div>
            )}

            {/* Tabla */}
            {visual.type === "table" && (
              <div className="overflow-x-auto">
                <div className="prose prose-invert prose-sm max-w-none
                  [&_table]:w-full [&_table]:border-collapse
                  [&_th]:bg-gray-800 [&_th]:text-blue-300 [&_th]:font-semibold [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-left [&_th]:text-sm [&_th]:border [&_th]:border-gray-700
                  [&_td]:px-4 [&_td]:py-2 [&_td]:text-gray-300 [&_td]:text-sm [&_td]:border [&_td]:border-gray-800
                  [&_tr:hover_td]:bg-gray-800/40 [&_tr:nth-child(even)_td]:bg-gray-900/50">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{visual.content}</ReactMarkdown>
                </div>
              </div>
            )}

            {visual.caption && (
              <p className="text-gray-600 text-xs mt-3 italic text-center">{visual.caption}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
