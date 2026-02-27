"use client"

import { useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface Visual {
  type: "image" | "mermaid" | "chart" | "table"
  title: string
  caption: string
  url?: string
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
  const mermaidRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)

  async function generateVisual(type = "auto") {
    setLoading(true)
    setError("")
    setVisual(null)
    setImgLoaded(false)
    setImgError(false)

    // Destruir chart anterior
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

      if (data.type === "mermaid") setTimeout(() => renderMermaid(data.content), 200)
      if (data.type === "chart" && data.chartData) setTimeout(() => renderChart(data.chartData), 200)

    } catch (e: any) {
      setError("No se pudo generar el visual. Intenta de nuevo.")
    } finally {
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
          tertiaryColor: "#0f172a",
          background: "#0f172a",
          nodeBorder: "#3b82f6",
          clusterBkg: "#1e293b",
          titleColor: "#e2e8f0",
          edgeLabelBackground: "#1e293b",
        },
        flowchart: { curve: "basis" },
      })
      const id = "mermaid-" + Date.now()
      const { svg } = await mermaid.render(id, code)
      if (mermaidRef.current) mermaidRef.current.innerHTML = svg
    } catch (e: any) {
      if (mermaidRef.current) {
        mermaidRef.current.innerHTML = `<pre class="text-xs text-gray-500 whitespace-pre-wrap p-2">${e.message}</pre>`
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
            backgroundColor: d.backgroundColor || ["#3b82f6","#8b5cf6","#06b6d4","#10b981","#f59e0b","#ef4444"],
            borderColor: d.borderColor || "transparent",
            borderRadius: 6,
          }))
        },
        options: {
          responsive: true,
          plugins: {
            legend: { labels: { color: "#94a3b8", font: { size: 11 } } },
            tooltip: { backgroundColor: "#1e293b", titleColor: "#e2e8f0", bodyColor: "#94a3b8" },
          },
          scales: chartData.type !== "pie" && chartData.type !== "doughnut" ? {
            x: { ticks: { color: "#64748b", font: { size: 10 } }, grid: { color: "#1e293b" } },
            y: { ticks: { color: "#64748b", font: { size: 10 } }, grid: { color: "#1e293b" } },
          } : undefined,
        },
      })
    } catch (e) {
      console.error("Chart error:", e)
    }
  }

  const typeButtons = [
    { type: "auto",    label: "✨ Auto",      desc: "IA decide" },
    { type: "image",   label: "🖼️ Imagen",    desc: "FLUX" },
    { type: "mermaid", label: "📊 Diagrama",  desc: "Flujo" },
    { type: "chart",   label: "📈 Gráfico",   desc: "Datos" },
    { type: "table",   label: "📋 Tabla",     desc: "Comparar" },
  ]

  return (
    <div className="mt-4">
      {!visual && !loading && (
        <div>
          <p className="text-xs text-gray-600 mb-2">🎨 AIm — Generar visual del concepto</p>
          <div className="flex flex-wrap gap-2">
            {typeButtons.map(btn => (
              <button
                key={btn.type}
                onClick={() => generateVisual(btn.type)}
                className="flex items-center gap-1.5 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-blue-500/40 rounded-xl px-3 py-2 transition-all group"
              >
                <span className="text-sm">{btn.label}</span>
                <span className="text-xs text-gray-600 group-hover:text-gray-400">{btn.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <div>
            <p className="text-gray-300 text-sm">AIm generando visual...</p>
            <p className="text-gray-600 text-xs">Analizando el concepto</p>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center justify-between">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={() => generateVisual("auto")} className="text-xs text-gray-500 hover:text-white transition-colors ml-3">↺ Reintentar</button>
        </div>
      )}

      {visual && !loading && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-400 font-medium">🎨 AIm</span>
              <span className="text-gray-600 text-xs">·</span>
              <span className="text-gray-400 text-xs">{visual.title}</span>
            </div>
            <div className="flex items-center gap-3">
              {typeButtons.filter(b => b.type !== "auto" && b.type !== visual.type).map(btn => (
                <button
                  key={btn.type}
                  onClick={() => generateVisual(btn.type)}
                  className="text-xs text-gray-600 hover:text-gray-300 transition-colors"
                  title={btn.label}
                >
                  {btn.label.split(" ")[0]}
                </button>
              ))}
              <button onClick={() => generateVisual(visual.type)} className="text-xs text-gray-600 hover:text-gray-300 transition-colors" title="Regenerar">↺</button>
              <button onClick={() => setVisual(null)} className="text-xs text-gray-600 hover:text-gray-300 transition-colors">✕</button>
            </div>
          </div>

          <div className="p-4">
            {/* Imagen FLUX */}
            {visual.type === "image" && visual.url && !imgError && (
              <div className="relative min-h-[180px] bg-gray-800 rounded-xl overflow-hidden">
                {!imgLoaded && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-500 text-xs">Generando con FLUX...</p>
                  </div>
                )}
                <img
                  src={visual.url}
                  alt={visual.title}
                  onLoad={() => setImgLoaded(true)}
                  onError={() => setImgError(true)}
                  className={`w-full rounded-xl transition-opacity duration-500 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
                />
              </div>
            )}
            {visual.type === "image" && imgError && (
              <div className="bg-gray-800 rounded-xl p-6 text-center">
                <p className="text-gray-500 text-sm mb-3">Error cargando imagen de FLUX</p>
                <button onClick={() => generateVisual("image")} className="text-xs text-blue-400 hover:text-blue-300">↺ Reintentar</button>
              </div>
            )}

            {/* Mermaid */}
            {visual.type === "mermaid" && (
              <div ref={mermaidRef} className="overflow-x-auto flex justify-center min-h-[100px]" />
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
                  [&_th]:bg-gray-800 [&_th]:text-blue-300 [&_th]:font-semibold [&_th]:px-4 [&_th]:py-2 [&_th]:text-left [&_th]:text-sm [&_th]:border [&_th]:border-gray-700
                  [&_td]:px-4 [&_td]:py-2 [&_td]:text-gray-300 [&_td]:text-sm [&_td]:border [&_td]:border-gray-800
                  [&_tr:hover_td]:bg-gray-800/50
                ">
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
