"use client"

import { useMemo, useRef } from "react"

type ChartType = "bar" | "line" | "quadratic"
type ChartSpec = {
  type: ChartType
  title: string
  labels: string[]
  values: number[]
  a: number
  b: number
  c: number
  xMin: number
  xMax: number
}

function parseSpec(raw: string): ChartSpec | null {
  if (raw.length > 6000) return null
  let data: Record<string, unknown>
  try {
    data = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
  if (!data || !["bar", "line", "quadratic"].includes(String(data.type))) return null
  const type = data.type as ChartType
  const safeNumber = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 1e6 ? v : fallback
  const labels = Array.isArray(data.labels) ? data.labels.slice(0, 20).map(v => String(v).slice(0, 20)) : []
  const values = Array.isArray(data.values) ? data.values.slice(0, 20).map(v => safeNumber(v, 0)) : []
  if (type !== "quadratic" && (!values.length || values.length !== labels.length)) return null
  const xMin = safeNumber(data.xMin, -5)
  const xMax = safeNumber(data.xMax, 5)
  return {
    type,
    title: String(data.title || "Gráfica EduAI").slice(0, 90),
    labels,
    values,
    a: safeNumber(data.a, 1),
    b: safeNumber(data.b, 0),
    c: safeNumber(data.c, 0),
    xMin: xMax > xMin ? xMin : -5,
    xMax: xMax > xMin ? xMax : 5,
  }
}

export default function EduAIChart({ raw }: { raw: string }) {
  const spec = useMemo(() => parseSpec(raw), [raw])
  const svgRef = useRef<SVGSVGElement>(null)
  if (!spec) return <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">No se pudo mostrar la gráfica. Revisa los datos.</p>

  const width = 640
  const height = 320
  const left = 54
  const right = 18
  const top = 24
  const bottom = 56
  const chartW = width - left - right
  const chartH = height - top - bottom
  const points = spec.type === "quadratic"
    ? Array.from({ length: 101 }, (_, index) => {
        const x = spec.xMin + (spec.xMax - spec.xMin) * index / 100
        return { x, y: spec.a * x * x + spec.b * x + spec.c }
      })
    : spec.values.map((y, index) => ({ x: index, y }))
  const ys = points.map(p => p.y).filter(Number.isFinite)
  const rawMin = Math.min(0, ...ys)
  const rawMax = Math.max(0, ...ys)
  const padding = Math.max(0.5, (rawMax - rawMin) * 0.1)
  const yMin = rawMin - padding
  const yMax = rawMax + padding
  const scaleY = (v: number) => top + (yMax - v) / (yMax - yMin) * chartH
  const scaleX = (index: number) => left + index / Math.max(1, points.length - 1) * chartW
  const yZero = scaleY(0)
  const plot = points.map((p, index) => scaleX(index).toFixed(2) + "," + scaleY(p.y).toFixed(2)).join(" ")
  const chartTitle = spec.title

  function downloadSVG() {
    const svg = svgRef.current
    if (!svg) return
    const data = new Blob([svg.outerHTML], { type: "image/svg+xml;charset=utf-8" })
    const url = URL.createObjectURL(data)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "eduai-grafica.svg"
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  return (
    <figure className="my-4 min-w-0 overflow-hidden rounded-2xl border border-soft bg-card-theme p-3 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <figcaption className="text-sm font-bold text-main">{chartTitle}</figcaption>
        <button type="button" onClick={downloadSVG} className="rounded-lg border border-soft px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50" title="Descarga SVG para Canva u otro editor compatible">
          Exportar SVG
        </button>
      </div>
      <svg ref={svgRef} viewBox="0 0 640 320" role="img" aria-label={chartTitle} className="w-full rounded-lg bg-white" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width={width} height={height} fill="#ffffff" />
        {Array.from({ length: 5 }, (_, index) => {
          const value = yMin + (yMax - yMin) * index / 4
          const y = scaleY(value)
          return <g key={index}>
            <line x1={left} y1={y} x2={width - right} y2={y} stroke="#e2e8f0" />
            <text x={left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#475569">{Number(value.toFixed(2))}</text>
          </g>
        })}
        <line x1={left} y1={top} x2={left} y2={top + chartH} stroke="#64748b" />
        <line x1={left} y1={yZero} x2={width - right} y2={yZero} stroke="#64748b" />
        {spec.type === "bar"
          ? points.map((p, index) => {
              const slot = chartW / Math.max(1, points.length)
              const x = left + slot * index + slot * 0.15
              const y = Math.min(yZero, scaleY(p.y))
              return <rect key={index} x={x} y={y} width={slot * 0.7} height={Math.max(1, Math.abs(scaleY(p.y) - yZero))} rx="4" fill="#2563eb" />
            })
          : <polyline points={plot} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
        {spec.type === "line" && points.map((p, index) => <circle key={index} cx={scaleX(index)} cy={scaleY(p.y)} r="4" fill="#7c3aed" />)}
        {spec.type === "quadratic"
          ? Array.from({ length: 5 }, (_, index) => {
              const value = spec.xMin + (spec.xMax - spec.xMin) * index / 4
              return <text key={index} x={left + chartW * index / 4} y={height - 25} textAnchor="middle" fontSize="11" fill="#475569">{Number(value.toFixed(2))}</text>
            })
          : spec.labels.map((label, index) => {
              const x = spec.type === "bar" ? left + chartW * (index + 0.5) / spec.labels.length : scaleX(index)
              return <text key={index} x={x} y={height - 25} textAnchor="middle" fontSize="10" fill="#475569">{label}</text>
            })}
      </svg>
      <p className="mt-2 text-[11px] text-muted2">Gráfica vectorial · exportable para materiales y presentaciones.</p>
    </figure>
  )
}
