"use client"

import { useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"

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
  const mermaidRef = useRef<HTMLDivElement>(null)

  async function generateVisual(type = "auto") {
    setLoading(true)
    setError("")
    setVisual(null)
    setImgLoaded(false)

    try {
      const res = await fetch("/api/agents/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, context, type }),
      })
      if (!res.ok) throw new Error("Error generando visual")
      const data = await res.json()
      setVisual(data)

      // Renderizar mermaid si corresponde
      if (data.type === "mermaid") {
        setTimeout(() => renderMermaid(data.content), 100)
      }

      // Renderizar chart si corresponde
      if (data.type === "chart" && data.chartData) {
        setTimeout(() => renderChart(data.chartData), 100)
      }

    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function renderMermaid(code: string) {
    try {
      const mermaid = (await import("mermaid")).default
      mermaid.initialize({ startOnLoad: false, theme: "dark" })
      const { svg } = await mermaid.render("mermaid-svg", code)
      if (mermaidRef.current) {
        mermaidRef.current.innerHTML = svg
      }
    } catch (e) {
      console.error("Mermaid error:", e)
    }
  }

  async function renderChart(chartData: any) {
    const canvas = document.getElementById("chart-canvas") as HTMLCanvasElement
    if (!canvas) return
    const { Chart, registerables } = await import("chart.js")
    Chart.register(...registerables)
    new Chart(canvas, {
      type: chartData.type || "bar",
      data: chartData.data,
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: "#e2e8f0" } },
        },
        scales: {
          x: { ticks: { color: "#94a3b8" }, grid: { color: "#1e293b" } },
          y: { ticks: { color: "#94a3b8" }, grid: { color: "#1e293b" } },
        },
      },
    })
  }

  return (
    <div className="mt-6">
      {/* Botones de tipo */}
      {!visual && !loading && (
        <div>
          <p className="text-xs text-gray-500 mb-2">🎨 AIm — Generar visual del concepto</p>
          <div className="flex flex-wrap gap-2">
            {[
              { type: "auto",    label: "✨ Auto",      desc: "La IA decide" },
              { type: "image",   label: "🖼️ Imagen",   desc: "Ilustración" },
              { type: "mermaid", label: "📊 Diagrama",  desc: "Flujo/proceso" },
              { type: "chart",   label: "📈 Gráfico",   desc: "Datos visuales" },
              { type: "table",   label: "📋 Tabla",     desc: "Comparación" },
            ].map(btn => (
              <button
                key={btn.type}
                onClick={() => generateVisual(btn.type)}
                className="flex flex-col items-center bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-blue-500/50 rounded-xl px-3 py-2 transition-all group"
              >
                <span className="text-sm font-medium text-gray-300 group-hover:text-white">{btn.label}</span>
                <span className="text-xs text-gray-600">{btn.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <div>
            <p className="text-gray-300 text-sm">AIm generando visual...</p>
            <p className="text-gray-600 text-xs">Analizando el concepto y creando la imagen</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Visual generado */}
      {visual && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1">
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                <span className="text-blue-400 text-xs font-medium">AIm — {visual.title}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => generateVisual("auto")}
                className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
              >
                ↺ Regenerar
              </button>
              <button
                onClick={() => { setVisual(null); setError("") }}
                className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Contenido */}
          <div className="p-4">
            {/* Imagen */}
            {visual.type === "image" && visual.url && (
              <div className="relative">
                {!imgLoaded && (
                  <div className="w-full h-48 bg-gray-800 rounded-xl animate-pulse flex items-center justify-center">
                    <span className="text-gray-600 text-sm">Generando imagen con FLUX...</span>
                  </div>
                )}
                <img
                  src={visual.url}
                  alt={visual.title}
                  onLoad={() => setImgLoaded(true)}
                  onError={() => setError("Error cargando imagen")}
                  className={`w-full rounded-xl object-cover transition-opacity duration-500 ${imgLoaded ? "opacity-100" : "opacity-0 absolute"}`}
                />
              </div>
            )}

            {/* Mermaid */}
            {visual.type === "mermaid" && (
              <div ref={mermaidRef} className="overflow-x-auto" />
            )}

            {/* Chart */}
            {visual.type === "chart" && (
              <canvas id="chart-canvas" className="max-h-64" />
            )}

            {/* Tabla */}
            {visual.type === "table" && (
              <div className="prose prose-invert prose-sm max-w-none overflow-x-auto">
                <ReactMarkdown>{visual.content}</ReactMarkdown>
              </div>
            )}

            {/* Caption */}
            {visual.caption && (
              <p className="text-gray-500 text-xs mt-3 italic">{visual.caption}</p>
            )}
          </div>

          {/* Botón para nuevo tipo */}
          <div className="px-4 pb-3 flex flex-wrap gap-2">
            {[
              { type: "image",   label: "🖼️" },
              { type: "mermaid", label: "📊" },
              { type: "chart",   label: "📈" },
              { type: "table",   label: "📋" },
            ].filter(b => b.type !== visual.type).map(btn => (
              <button
                key={btn.type}
                onClick={() => generateVisual(btn.type)}
                className="text-xs text-gray-600 hover:text-gray-400 bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded-lg transition-all"
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
