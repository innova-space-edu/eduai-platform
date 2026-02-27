"use client"

import { useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface Visual {
  type: "image" | "mermaid" | "chart" | "table" | "none"
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
  const [loading, setLoading] = useState(true)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [seed] = useState(() => Math.floor(Math.random() * 99999))
  const mermaidRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)

  useEffect(() => {
    if (context) generateVisual()
  }, [context])

  function getImageUrl(prompt: string) {
    const full = `${prompt}, educational diagram, clean, colorful, white background, high quality, detailed`
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(full)}?width=800&height=480&model=flux&nologo=true&seed=${seed}`
  }

  async function generateVisual() {
    setLoading(true)
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
        body: JSON.stringify({ topic, context }),
      })
      if (!res.ok) return

      const data = await res.json()
      if (data.type === "none") { setLoading(false); return }

      setVisual(data)
      setLoading(false)

      if (data.type === "mermaid") setTimeout(() => renderMermaid(data.content), 200)
      if (data.type === "chart" && data.chartData) setTimeout(() => renderChart(data.chartData), 200)

    } catch {
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
      console.error("Mermaid:", e.message)
      setVisual(null)
    }
  }

  async function renderChart(chartData: any) {
    const canvas = document.getElementById(`chart-${seed}`) as HTMLCanvasElement
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
            backgroundColor: d.backgroundColor || ["#3b82f6","#8b5cf6","#06b6d4","#10b981","#f59e0b","#ef4444"],
            borderRadius: chartData.type === "bar" ? 6 : 0,
          }))
        },
        options: {
          responsive: true,
          plugins: {
            legend: { labels: { color: "#94a3b8", font: { size: 11 } } },
            tooltip: { backgroundColor: "#1e293b", titleColor: "#e2e8f0", bodyColor: "#94a3b8" },
          },
          scales: chartData.type !== "pie" && chartData.type !== "doughnut" ? {
            x: { ticks: { color: "#64748b" }, grid: { color: "#1e293b" } },
            y: { ticks: { color: "#64748b" }, grid: { color: "#1e293b" } },
          } : undefined,
        },
      })
    } catch (e) { console.error(e) }
  }

  if (loading) {
    return (
      <div className="mt-4 flex items-center gap-2 text-gray-700 text-xs">
        <div className="w-3 h-3 border border-gray-700 border-t-transparent rounded-full animate-spin" />
        AIm analizando contexto...
      </div>
    )
  }

  if (!visual || visual.type === "none") return null

  return (
    <div className="mt-4 bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-xs text-blue-400 font-medium">🎨 AIm</span>
          <span className="text-gray-700 text-xs">·</span>
          <span className="text-gray-500 text-xs">{visual.title}</span>
        </div>
        <button
          onClick={generateVisual}
          className="text-xs text-gray-700 hover:text-gray-400 transition-colors"
          title="Regenerar"
        >
          ↺
        </button>
      </div>

      <div className="p-4">
        {/* Imagen FLUX */}
        {visual.type === "image" && visual.imagePrompt && (
          <>
            {!imgLoaded && !imgError && (
              <div className="w-full h-52 bg-gray-800 rounded-xl flex flex-col items-center justify-center gap-2">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-500 text-xs">Generando imagen con FLUX...</p>
              </div>
            )}
            {imgError && (
              <div className="w-full h-32 bg-gray-800 rounded-xl flex flex-col items-center justify-center gap-2">
                <p className="text-gray-600 text-xs">No se pudo generar la imagen</p>
                <button
                  onClick={() => { setImgError(false); setImgLoaded(false) }}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  ↺ Reintentar
                </button>
              </div>
            )}
            <img
              src={getImageUrl(visual.imagePrompt)}
              alt={visual.title}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              className={`w-full rounded-xl transition-opacity duration-700 ${imgLoaded ? "opacity-100" : "opacity-0 h-0"}`}
            />
          </>
        )}

        {/* Mermaid */}
        {visual.type === "mermaid" && (
          <div ref={mermaidRef} className="overflow-x-auto flex justify-center min-h-[100px]" />
        )}

        {/* Chart */}
        {visual.type === "chart" && (
          <div className="h-60">
            <canvas id={`chart-${seed}`} />
          </div>
        )}

        {/* Tabla */}
        {visual.type === "table" && (
          <div className="overflow-x-auto">
            <div className="prose prose-invert prose-sm max-w-none
              [&_table]:w-full [&_table]:border-collapse
              [&_th]:bg-gray-800 [&_th]:text-blue-300 [&_th]:font-semibold [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-left [&_th]:text-sm [&_th]:border [&_th]:border-gray-700
              [&_td]:px-4 [&_td]:py-2 [&_td]:text-gray-300 [&_td]:text-sm [&_td]:border [&_td]:border-gray-800
              [&_tr:nth-child(even)_td]:bg-gray-800/30 [&_tr:hover_td]:bg-gray-800/50">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{visual.content}</ReactMarkdown>
            </div>
          </div>
        )}

        {visual.caption && (
          <p className="text-gray-600 text-xs mt-3 italic text-center">{visual.caption}</p>
        )}
      </div>
    </div>
  )
}