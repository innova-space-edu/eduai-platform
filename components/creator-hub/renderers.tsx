/**
 * components/creator-hub/renderers.tsx
 *
 * Todos los renderers copiados del creator original (app/creator/page.tsx).
 * El archivo original NO se modifica. Este es un módulo independiente
 * para usar exclusivamente en /creator-hub.
 */
"use client"

import { useState, useRef } from "react"

// ─── Paleta de colores para mapa mental ──────────────────────────────────────
const BRANCH_COLORS = [
  { bg: "#3b82f6", light: "#dbeafe", text: "#1e40af" },
  { bg: "#10b981", light: "#d1fae5", text: "#065f46" },
  { bg: "#f59e0b", light: "#fef3c7", text: "#92400e" },
  { bg: "#ef4444", light: "#fee2e2", text: "#991b1b" },
  { bg: "#8b5cf6", light: "#ede9fe", text: "#4c1d95" },
  { bg: "#06b6d4", light: "#cffafe", text: "#0e7490" },
  { bg: "#ec4899", light: "#fce7f3", text: "#831843" },
]

// ═════════════════════════════════════════════════════════════════════════════
// MAPA MENTAL
// ═════════════════════════════════════════════════════════════════════════════
export function MindmapRenderer({ data }: { data: any }) {
  const [selected, setSelected] = useState<any>(null)
  const [hovered,  setHovered]  = useState<string | null>(null)
  const [scale,    setScale]    = useState(1)
  const [pan,      setPan]      = useState({ x: 0, y: 0 })
  const dragging  = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 })

  const nodes        = data.nodes || []
  const centralTopic = data.centralTopic || "Tema"
  const VW = 700, VH = 460
  const cx = VW / 2, cy = VH / 2

  const mainNodes = nodes.filter((n: any) => n.category === "main")
  const subNodes  = nodes.filter((n: any) => n.category === "sub")
  const detNodes  = nodes.filter((n: any) => n.category === "detail")

  type LayoutNode = {
    id: string; label: string; x: number; y: number
    category: string; color: typeof BRANCH_COLORS[0]
    isCenter?: boolean; parent?: string; description?: string
  }

  const layout: LayoutNode[] = [
    { id: "__center__", label: centralTopic, x: cx, y: cy, category: "center", color: BRANCH_COLORS[0], isCenter: true },
  ]

  mainNodes.forEach((n: any, i: number) => {
    const angle = (2 * Math.PI * i) / mainNodes.length - Math.PI / 2
    layout.push({
      ...n, x: cx + Math.cos(angle) * 170, y: cy + Math.sin(angle) * 170,
      color: BRANCH_COLORS[(i + 1) % BRANCH_COLORS.length], parent: "__center__",
    })
  })

  const subsPerMain = Math.ceil(subNodes.length / Math.max(mainNodes.length, 1))
  subNodes.forEach((sub: any, si: number) => {
    if (layout.find(l => l.id === sub.id)) return
    const parentMainIdx = Math.floor(si / subsPerMain)
    const parentMain = layout[1 + (parentMainIdx % mainNodes.length)]
    if (!parentMain) return
    const spread = subsPerMain > 1 ? (si % subsPerMain - (subsPerMain - 1) / 2) * 0.45 : 0
    const baseAngle = Math.atan2(parentMain.y - cy, parentMain.x - cx)
    layout.push({
      ...sub, x: parentMain.x + Math.cos(baseAngle + spread) * 100,
      y: parentMain.y + Math.sin(baseAngle + spread) * 100,
      color: parentMain.color, parent: parentMain.id,
    })
  })

  const placedSubs = layout.filter(l => l.category === "sub")
  detNodes.forEach((det: any, di: number) => {
    if (layout.find(l => l.id === det.id)) return
    const parentSub = placedSubs[di % Math.max(placedSubs.length, 1)]
    if (!parentSub) return
    const angle = (2 * Math.PI * di) / Math.max(detNodes.length, 1) + Math.atan2(parentSub.y - cy, parentSub.x - cx)
    layout.push({
      ...det, x: parentSub.x + Math.cos(angle) * 65, y: parentSub.y + Math.sin(angle) * 65,
      color: parentSub.color, parent: parentSub.id,
    })
  })

  function bezierPath(x1: number, y1: number, x2: number, y2: number) {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - 25
    return `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`
  }

  function nodeSize(n: LayoutNode) {
    const len = n.label.length
    if (n.isCenter) return { w: Math.max(110, len * 8 + 20), h: 38 }
    if (n.category === "main")   return { w: Math.max(80, len * 7 + 16), h: 30 }
    if (n.category === "sub")    return { w: Math.max(65, len * 6 + 14), h: 24 }
    return { w: Math.max(55, len * 5.5 + 12), h: 20 }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-blue-400 font-bold text-sm">🧠 {centralTopic}</h3>
        <div className="flex gap-2">
          <button onClick={() => setScale(s => Math.min(s + 0.15, 2.2))} className="w-7 h-7 rounded-lg bg-gray-800 text-gray-400 hover:text-white text-sm flex items-center justify-center">+</button>
          <button onClick={() => setScale(s => Math.max(s - 0.15, 0.35))} className="w-7 h-7 rounded-lg bg-gray-800 text-gray-400 hover:text-white text-sm flex items-center justify-center">−</button>
          <button onClick={() => { setScale(1); setPan({ x: 0, y: 0 }) }} className="px-2 h-7 rounded-lg bg-gray-800 text-gray-500 hover:text-white text-xs">Reset</button>
        </div>
      </div>

      <div
        className="relative bg-gray-950 rounded-3xl border border-gray-800 overflow-hidden cursor-grab active:cursor-grabbing"
        style={{ height: 460 }}
        onMouseDown={e => { dragging.current = true; dragStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y } }}
        onMouseMove={e => { if (!dragging.current) return; setPan({ x: dragStart.current.px + e.clientX - dragStart.current.x, y: dragStart.current.py + e.clientY - dragStart.current.y }) }}
        onMouseUp={() => { dragging.current = false }}
        onMouseLeave={() => { dragging.current = false }}
        onWheel={e => { e.preventDefault(); setScale(s => Math.max(0.3, Math.min(2.5, s - e.deltaY * 0.001))) }}
      >
        <div className="absolute inset-0 opacity-20 pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle, #4b5563 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

        <svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`}
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, transformOrigin: "center", transition: dragging.current ? "none" : "transform 0.1s" }}>
          <defs>
            {BRANCH_COLORS.map((c, i) => (
              <linearGradient key={i} id={`hub-grad${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={c.bg} />
                <stop offset="100%" stopColor={c.bg + "cc"} />
              </linearGradient>
            ))}
          </defs>
          {layout.map(node => {
            if (!node.parent) return null
            const parent = layout.find(l => l.id === node.parent)
            if (!parent) return null
            return (
              <path key={`line-${node.id}`} d={bezierPath(parent.x, parent.y, node.x, node.y)}
                fill="none" stroke={node.color.bg + "77"}
                strokeWidth={node.category === "main" ? 2.5 : node.category === "sub" ? 1.8 : 1.2}
                strokeDasharray={node.category === "detail" ? "5,4" : undefined} />
            )
          })}
          {layout.map(node => {
            const { w, h } = nodeSize(node)
            const isHov = hovered === node.id
            const isSel = selected?.id === node.id
            const colorIdx = BRANCH_COLORS.indexOf(node.color)
            return (
              <g key={node.id} style={{ cursor: "pointer" }}
                onMouseEnter={() => setHovered(node.id)} onMouseLeave={() => setHovered(null)}
                onMouseDown={e => { e.stopPropagation(); setSelected(node.id === "__center__" ? null : node) }}>
                {(isHov || isSel) && (
                  <rect x={node.x - w / 2 - 4} y={node.y - h / 2 - 4} width={w + 8} height={h + 8} rx={h / 2 + 4}
                    fill={node.color.bg + "22"} stroke={node.color.bg + "55"} strokeWidth={1} />
                )}
                {node.isCenter ? (
                  <rect x={node.x - w / 2} y={node.y - h / 2} width={w} height={h} rx={h / 2}
                    fill={`url(#hub-grad0)`} stroke="white" strokeWidth={1.5}
                    filter={isSel ? `drop-shadow(0 0 8px ${node.color.bg})` : undefined} />
                ) : node.category === "main" ? (
                  <rect x={node.x - w / 2} y={node.y - h / 2} width={w} height={h} rx={h / 2}
                    fill={node.color.bg} stroke={node.color.bg + "aa"} strokeWidth={1}
                    filter={isHov ? `drop-shadow(0 0 6px ${node.color.bg}88)` : undefined} />
                ) : node.category === "sub" ? (
                  <rect x={node.x - w / 2} y={node.y - h / 2} width={w} height={h} rx={6}
                    fill={node.color.light} stroke={node.color.bg} strokeWidth={1.2} />
                ) : (
                  <rect x={node.x - w / 2} y={node.y - h / 2} width={w} height={h} rx={5}
                    fill="rgba(255,255,255,0.04)" stroke={node.color.bg + "55"} strokeWidth={1} strokeDasharray="3,2" />
                )}
                <text x={node.x} y={node.y} textAnchor="middle" dominantBaseline="middle"
                  fontSize={node.isCenter ? 12 : node.category === "main" ? 10 : node.category === "sub" ? 9 : 8}
                  fontWeight={node.isCenter ? "bold" : "600"} fontFamily="system-ui, sans-serif"
                  fill={node.isCenter || node.category === "main" ? "white" : node.color.text}>
                  {node.label.length > 18 ? node.label.substring(0, 16) + "…" : node.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {selected && (
        <div className="rounded-2xl p-4 border transition-all"
          style={{ background: selected.color?.light + "18", borderColor: selected.color?.bg + "44" }}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-bold text-sm text-white mb-1">{selected.label}</h4>
              {selected.description && <p className="text-gray-400 text-xs leading-relaxed">{selected.description}</p>}
              <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full font-semibold"
                style={{ background: selected.color?.bg + "22", color: selected.color?.bg }}>
                {selected.category === "main" ? "Concepto principal" : selected.category === "sub" ? "Subtema" : "Detalle"}
              </span>
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-600 hover:text-gray-400 text-xl leading-none flex-shrink-0">×</button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-[10px] text-gray-600">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />Tema central</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" />Conceptos principales</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-200 border border-amber-400 inline-block" />Subtemas</span>
        <span className="ml-auto">Arrastra · Rueda = zoom · Click = detalle</span>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// INFOGRAFÍA
// ═════════════════════════════════════════════════════════════════════════════
export function InfographicRenderer({ data }: { data: any }) {
  const PALETTES: Record<string, { primary: string; secondary: string; accent: string; bg: string; card: string; text: string; muted: string }> = {
    blue:   { primary: "#2563eb", secondary: "#1d4ed8", accent: "#60a5fa", bg: "linear-gradient(135deg,#0f172a,#1e3a5f)", card: "rgba(59,130,246,0.08)", text: "#e0f2fe", muted: "#93c5fd" },
    green:  { primary: "#16a34a", secondary: "#15803d", accent: "#4ade80", bg: "linear-gradient(135deg,#052e16,#14532d)", card: "rgba(34,197,94,0.08)", text: "#dcfce7", muted: "#86efac" },
    purple: { primary: "#7c3aed", secondary: "#6d28d9", accent: "#c084fc", bg: "linear-gradient(135deg,#1e1b4b,#3b0764)", card: "rgba(168,85,247,0.08)", text: "#f5f3ff", muted: "#d8b4fe" },
    orange: { primary: "#ea580c", secondary: "#c2410c", accent: "#fb923c", bg: "linear-gradient(135deg,#431407,#7c2d12)", card: "rgba(249,115,22,0.08)", text: "#fff7ed", muted: "#fdba74" },
    red:    { primary: "#dc2626", secondary: "#b91c1c", accent: "#f87171", bg: "linear-gradient(135deg,#450a0a,#7f1d1d)", card: "rgba(239,68,68,0.08)", text: "#fef2f2", muted: "#fca5a5" },
    teal:   { primary: "#0d9488", secondary: "#0f766e", accent: "#2dd4bf", bg: "linear-gradient(135deg,#042f2e,#134e4a)", card: "rgba(20,184,166,0.08)", text: "#f0fdfa", muted: "#5eead4" },
    indigo: { primary: "#4338ca", secondary: "#3730a3", accent: "#818cf8", bg: "linear-gradient(135deg,#1e1b4b,#312e81)", card: "rgba(99,102,241,0.08)", text: "#eef2ff", muted: "#a5b4fc" },
  }
  const p = PALETTES[data.colorScheme] || PALETTES.blue
  const sections: any[] = data.sections || []

  return (
    <div className="rounded-3xl overflow-hidden font-sans" style={{ background: p.bg }}>
      <div className="relative px-6 pt-8 pb-6 text-center overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: `radial-gradient(circle at 20% 50%, ${p.primary} 0%, transparent 50%), radial-gradient(circle at 80% 20%, ${p.accent} 0%, transparent 40%)` }} />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-3 text-xs font-semibold"
            style={{ background: p.primary + "33", color: p.accent, border: `1px solid ${p.primary}44` }}>
            📊 Infografía Educativa
          </div>
          <h1 className="text-2xl font-black leading-tight mb-2" style={{ color: p.text }}>{data.title}</h1>
          {data.subtitle && <p className="text-sm" style={{ color: p.muted }}>{data.subtitle}</p>}
        </div>
      </div>

      {data.keyFact && (
        <div className="mx-5 mb-5 rounded-2xl px-5 py-4 text-center"
          style={{ background: `linear-gradient(135deg, ${p.primary}22, ${p.accent}11)`, border: `1px solid ${p.primary}44` }}>
          <p className="text-sm font-bold" style={{ color: p.accent }}>💡 {data.keyFact}</p>
        </div>
      )}

      <div className="px-5 pb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sections.map((sec: any, i: number) => (
          <div key={i} className="rounded-2xl p-4 border" style={{ background: p.card, borderColor: p.primary + "22" }}>
            <div className="flex items-center gap-2.5 mb-3 pb-2" style={{ borderBottom: `1px solid ${p.primary}22` }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: p.primary + "22" }}>
                {sec.icon || "📌"}
              </div>
              <h3 className="font-bold text-sm leading-tight" style={{ color: p.text }}>{sec.heading}</h3>
            </div>
            {sec.stat && (
              <div className="mb-3 rounded-xl px-3 py-2 text-center" style={{ background: p.primary + "22" }}>
                <span className="text-2xl font-black" style={{ color: p.accent }}>{sec.stat.value}</span>
                {sec.stat.label && <p className="text-[10px] mt-0.5" style={{ color: p.muted }}>{sec.stat.label}</p>}
              </div>
            )}
            <ul className="space-y-1.5">
              {(sec.points || []).map((pt: string, j: number) => (
                <li key={j} className="flex gap-2 text-xs leading-relaxed" style={{ color: p.muted }}>
                  <span className="flex-shrink-0 mt-0.5 font-bold" style={{ color: p.accent }}>▸</span>{pt}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {data.conclusion && (
        <div className="mx-5 mb-5 rounded-2xl px-5 py-3 text-center" style={{ background: p.card, borderTop: `2px solid ${p.primary}44` }}>
          <p className="text-xs italic" style={{ color: p.muted }}>📝 {data.conclusion}</p>
        </div>
      )}

      <div className="px-5 pb-4 flex items-center justify-between">
        <span className="text-[10px]" style={{ color: p.primary + "88" }}>Generado con EduAI Creator Studio</span>
        <span className="text-[10px]" style={{ color: p.primary + "88" }}>{new Date().toLocaleDateString("es-CL")}</span>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// PPT
// ═════════════════════════════════════════════════════════════════════════════
export function PPTRenderer({ data }: { data: any }) {
  const [idx, setIdx] = useState(0)
  const slides = data.slides || []
  const s = slides[idx]
  if (!s) return null

  const THEMES: Record<string, { bg: string; accent: string; text: string; sub: string }> = {
    academic:  { bg: "linear-gradient(135deg,#0f172a,#1e293b)", accent: "#3b82f6", text: "#f1f5f9", sub: "#94a3b8" },
    minimal:   { bg: "linear-gradient(135deg,#18181b,#27272a)", accent: "#a1a1aa", text: "#fafafa",  sub: "#71717a" },
    corporate: { bg: "linear-gradient(135deg,#0c1a2e,#1a3a5c)", accent: "#0ea5e9", text: "#e0f2fe", sub: "#7dd3fc" },
    creative:  { bg: "linear-gradient(135deg,#1a0533,#2d1b69)", accent: "#c084fc", text: "#f5f3ff", sub: "#d8b4fe" },
    dark:      { bg: "linear-gradient(135deg,#000000,#111111)", accent: "#22d3ee", text: "#f0fdfa", sub: "#67e8f9" },
  }
  const theme = THEMES[data.theme] || THEMES.academic
  const isTitle = idx === 0 || s.type === "title"
  const isQuote = s.type === "quote"
  const isStats = s.type === "stats"

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-gray-400 text-xs font-medium">{data.title}</span>
        <span className="text-gray-600 text-xs">{idx + 1} / {slides.length}</span>
      </div>

      <div className="aspect-video rounded-2xl overflow-hidden border border-white/10 relative flex flex-col" style={{ background: theme.bg }}>
        <div className="absolute inset-0 opacity-5 pointer-events-none"
          style={{ backgroundImage: `radial-gradient(circle at top right, ${theme.accent}, transparent 60%)` }} />
        <div className="absolute top-0 left-0 w-1.5 h-full" style={{ background: theme.accent }} />

        <div className="relative z-10 flex-1 flex flex-col justify-center px-10 py-6">
          {isTitle ? (
            <div className="text-center">
              <div className="w-16 h-1 mx-auto mb-5 rounded-full" style={{ background: theme.accent }} />
              <h1 className="text-2xl font-black leading-tight mb-3" style={{ color: theme.text }}>{s.title}</h1>
              {s.subtitle && <p className="text-sm" style={{ color: theme.sub }}>{s.subtitle}</p>}
              {data.author && <p className="text-xs mt-6" style={{ color: theme.accent }}>{data.author}</p>}
            </div>
          ) : isQuote ? (
            <div className="text-center px-4">
              <div className="text-5xl mb-3 opacity-30" style={{ color: theme.accent }}>"</div>
              <p className="text-lg font-semibold italic leading-relaxed" style={{ color: theme.text }}>{s.title}</p>
              {s.notes && <p className="text-xs mt-4" style={{ color: theme.sub }}>— {s.notes}</p>}
            </div>
          ) : isStats ? (
            <div>
              <h2 className="text-base font-bold mb-4" style={{ color: theme.accent }}>{s.title}</h2>
              <div className="grid grid-cols-3 gap-3">
                {(s.bullets || []).slice(0, 3).map((b: string, i: number) => {
                  const [val, ...rest] = b.split(" — ")
                  return (
                    <div key={i} className="rounded-xl p-3 text-center" style={{ background: theme.accent + "15" }}>
                      <p className="text-xl font-black" style={{ color: theme.accent }}>{val}</p>
                      <p className="text-[10px] mt-1" style={{ color: theme.sub }}>{rest.join(" — ")}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-1 h-6 rounded-full" style={{ background: theme.accent }} />
                <h2 className="text-base font-bold" style={{ color: theme.text }}>{s.title}</h2>
              </div>
              <div className="space-y-2.5">
                {(s.bullets || []).map((b: string, i: number) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                      style={{ background: theme.accent + "22", color: theme.accent }}>{i + 1}</div>
                    <p className="text-sm leading-relaxed" style={{ color: theme.sub }}>{b}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="absolute bottom-3 right-4">
          <span className="text-[10px]" style={{ color: theme.accent + "66" }}>{idx + 1}</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}
          className="px-3 py-1.5 rounded-lg border border-white/10 text-gray-500 text-xs disabled:opacity-30 hover:border-white/20 hover:text-gray-300 transition-all">← Anterior</button>
        <div className="flex gap-1.5">
          {slides.map((_: any, i: number) => (
            <button key={i} onClick={() => setIdx(i)} className="rounded-full transition-all"
              style={{ width: i === idx ? 20 : 6, height: 6, background: i === idx ? theme.accent : "rgba(255,255,255,0.15)" }} />
          ))}
        </div>
        <button onClick={() => setIdx(Math.min(slides.length - 1, idx + 1))} disabled={idx === slides.length - 1}
          className="px-3 py-1.5 rounded-lg border border-white/10 text-gray-500 text-xs disabled:opacity-30 hover:border-white/20 hover:text-gray-300 transition-all">Siguiente →</button>
      </div>

      {s.notes && (
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
          <span className="text-gray-700 text-[10px] font-semibold uppercase tracking-wider">Notas del presentador</span>
          <p className="text-gray-500 text-xs mt-1">{s.notes}</p>
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// PODCAST
// ═════════════════════════════════════════════════════════════════════════════
export function PodcastRenderer({ data }: { data: any }) {
  const [current, setCurrent] = useState(0)
  const segments = data.segments || []
  const total = segments.length
  const BARS = 56
  const bars = Array.from({ length: BARS }, (_, i) => Math.max(0.15, Math.sin(i * 127.1 + 311.7) * 0.5 + 0.5))
  const progress = total > 0 ? current / total : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex-shrink-0 relative" style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed)" }}>
          <div className="absolute inset-0 flex items-center justify-center text-3xl">🎙️</div>
          <div className="absolute bottom-1 right-1 w-3 h-3 bg-red-400 rounded-full animate-pulse" />
        </div>
        <div>
          <h3 className="text-white font-bold text-sm">{data.title}</h3>
          <p className="text-gray-500 text-xs mt-0.5">EduAI Podcast · {data.duration || "5 min"}</p>
          <div className="flex gap-2 mt-1.5">
            <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-medium">🎙 Álvaro</span>
            <span className="text-[10px] bg-pink-500/10 text-pink-400 border border-pink-500/20 px-2 py-0.5 rounded-full font-medium">🎙 Elvira</span>
          </div>
        </div>
      </div>

      <div className="bg-gray-900/80 rounded-2xl p-4 border border-white/5">
        <div className="flex items-end gap-[2px] h-12 mb-3">
          {bars.map((h, i) => (
            <div key={i} className="flex-1 rounded-full transition-all duration-75"
              style={{ height: `${h * 100}%`, background: i / BARS <= progress ? "linear-gradient(to top, #3b82f6, #8b5cf6)" : "rgba(255,255,255,0.08)" }} />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrent(c => Math.max(0, c - 1))} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xs transition-colors">⏮</button>
          <button onClick={() => setCurrent(c => Math.min(total - 1, c + 1))} className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm" style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)" }}>▶</button>
          <button onClick={() => setCurrent(c => Math.min(total - 1, c + 1))} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xs transition-colors">⏭</button>
          <span className="text-gray-600 text-xs ml-auto">{current + 1} / {total}</span>
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
        {segments.map((seg: any, i: number) => {
          const isA = seg.speaker === "A"
          const isActive = i === current
          return (
            <div key={i} onClick={() => setCurrent(i)}
              className={`flex gap-3 p-3 rounded-2xl cursor-pointer transition-all border ${
                isActive ? (isA ? "bg-blue-500/10 border-blue-500/20" : "bg-pink-500/10 border-pink-500/20") : "bg-white/[0.02] border-transparent hover:bg-white/[0.04]"
              }`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${isA ? "bg-blue-500/20 text-blue-400" : "bg-pink-500/20 text-pink-400"}`}>
                {isA ? "A" : "B"}
              </div>
              <div className="flex-1">
                <p className={`text-[10px] font-semibold mb-0.5 ${isA ? "text-blue-400" : "text-pink-400"}`}>{isA ? "Álvaro" : "Elvira"}</p>
                <p className="text-gray-400 text-xs leading-relaxed">{seg.text}</p>
              </div>
              {isActive && (
                <div className="flex-shrink-0 flex gap-0.5 items-end">
                  {[0, 1, 2].map(d => (
                    <div key={d} className="w-1 rounded-full animate-bounce"
                      style={{ height: 8 + d * 4, background: isA ? "#3b82f6" : "#ec4899", animationDelay: `${d * 100}ms` }} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// POSTER
// ═════════════════════════════════════════════════════════════════════════════
export function PosterRenderer({ data }: { data: any }) {
  const SCHEMES: Record<string, { bg: string; accent: string; text: string; sub: string; badge: string }> = {
    vibrant:    { bg: "linear-gradient(135deg,#0f172a,#1e1b4b,#2d0f3f)", accent: "#818cf8", text: "#f1f5f9", sub: "#94a3b8", badge: "rgba(129,140,248,0.15)" },
    pastel:     { bg: "linear-gradient(135deg,#fef9ff,#f0f9ff,#fff7ed)", accent: "#7c3aed", text: "#1e1b4b", sub: "#6b7280",  badge: "rgba(124,58,237,0.1)" },
    dark:       { bg: "linear-gradient(135deg,#000,#18181b)",             accent: "#22d3ee", text: "#f0fdfa", sub: "#a1a1aa", badge: "rgba(34,211,238,0.1)" },
    monochrome: { bg: "linear-gradient(135deg,#18181b,#27272a)",          accent: "#a1a1aa", text: "#fafafa",  sub: "#71717a", badge: "rgba(161,161,170,0.1)" },
    neon:       { bg: "linear-gradient(135deg,#000,#0a0a1a)",             accent: "#4ade80", text: "#f0fdf4", sub: "#6ee7b7", badge: "rgba(74,222,128,0.1)" },
  }
  const s = SCHEMES[data.colorScheme] || SCHEMES.vibrant

  return (
    <div className="rounded-3xl overflow-hidden border border-white/10" style={{ background: s.bg }}>
      <div className="relative px-8 pt-10 pb-8 text-center overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `radial-gradient(ellipse at 50% 0%, ${s.accent}88, transparent 70%)` }} />
        <div className="relative z-10">
          <h1 className="text-3xl font-black leading-tight mb-3" style={{ color: s.text }}>{data.headline}</h1>
          {data.tagline && <p className="text-sm font-medium" style={{ color: s.accent }}>{data.tagline}</p>}
        </div>
      </div>
      <div className="mx-8 h-px opacity-20" style={{ background: s.accent }} />
      <div className="px-8 py-6 space-y-4">
        {(data.mainPoints || []).map((pt: any, i: number) => (
          <div key={i} className="flex gap-4 rounded-2xl p-4 border border-white/5" style={{ background: s.badge }}>
            <div className="text-2xl flex-shrink-0 w-10 h-10 flex items-center justify-center">{pt.icon}</div>
            <div>
              <h3 className="font-bold text-sm mb-0.5" style={{ color: s.text }}>{pt.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: s.sub }}>{pt.description}</p>
              {pt.stat && <span className="inline-block mt-1.5 text-xs font-bold px-2 py-0.5 rounded-lg" style={{ background: s.accent + "22", color: s.accent }}>{pt.stat}</span>}
            </div>
          </div>
        ))}
      </div>
      {data.callToAction && (
        <div className="mx-8 mb-8 rounded-2xl px-6 py-4 text-center" style={{ background: s.accent + "22", border: `2px solid ${s.accent}44` }}>
          <p className="font-bold text-sm" style={{ color: s.accent }}>{data.callToAction}</p>
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// FLASHCARDS
// ═════════════════════════════════════════════════════════════════════════════
export function FlashcardsRenderer({ data }: { data: any }) {
  const [idx, setIdx]       = useState(0)
  const [flipped, setFlipped] = useState(false)
  const cards = data.cards || []
  const card  = cards[idx]
  if (!card) return null

  return (
    <div className="text-center space-y-4">
      <div className="flex items-center justify-between px-1">
        <span className="text-blue-400 font-bold text-sm">{data.deckTitle}</span>
        <span className="text-gray-600 text-xs bg-gray-800 rounded-full px-3 py-1">{idx + 1} / {cards.length}</span>
      </div>

      <div onClick={() => setFlipped(!flipped)}
        className={`min-h-[200px] rounded-3xl p-7 cursor-pointer border transition-all flex flex-col items-center justify-center select-none ${
          flipped ? "bg-green-500/[0.06] border-green-500/20" : "bg-blue-500/[0.06] border-blue-500/20"
        }`}>
        <span className={`text-[10px] font-bold tracking-widest mb-3 px-3 py-1 rounded-full ${flipped ? "bg-green-500/10 text-green-400" : "bg-blue-500/10 text-blue-400"}`}>
          {flipped ? "↩ RESPUESTA" : "PREGUNTA → toca para voltear"}
        </span>
        <p className="text-white font-semibold text-base leading-relaxed">{flipped ? card.back : card.front}</p>
        {card.hint && !flipped && <p className="text-gray-600 text-xs mt-3 italic">💡 {card.hint}</p>}
        {card.difficulty && (
          <div className="flex gap-1 mt-3">
            {[1, 2, 3].map(d => <div key={d} className={`w-2 h-2 rounded-full ${d <= card.difficulty ? "bg-yellow-400" : "bg-white/10"}`} />)}
          </div>
        )}
      </div>

      <div className="flex justify-center gap-2">
        <button onClick={() => { setIdx(Math.max(0, idx - 1)); setFlipped(false) }} disabled={idx === 0}
          className="px-4 py-2 rounded-xl border border-white/10 text-gray-500 text-sm disabled:opacity-30 hover:border-white/20 hover:text-gray-300 transition-all">← Anterior</button>
        <button onClick={() => { setIdx(Math.min(cards.length - 1, idx + 1)); setFlipped(false) }} disabled={idx === cards.length - 1}
          className="px-4 py-2 rounded-xl bg-blue-600/20 border border-blue-500/20 text-blue-400 text-sm disabled:opacity-30 hover:bg-blue-600/30 transition-all">Siguiente →</button>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// QUIZ
// ═════════════════════════════════════════════════════════════════════════════
export function QuizRenderer({ data }: { data: any }) {
  const [qIdx, setQIdx]     = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [done, setDone]     = useState(false)
  const questions = data.questions || []
  const q     = questions[qIdx]
  const score = Object.keys(answers).reduce((acc, k) => {
    const i = Number(k)
    return acc + (answers[i] === questions[i]?.correctAnswer ? 1 : 0)
  }, 0)

  if (done) {
    const pct = score / questions.length
    return (
      <div className="text-center py-8 space-y-4">
        <div className="text-6xl">{pct >= 0.7 ? "🏆" : pct >= 0.4 ? "📚" : "💪"}</div>
        <h3 className="text-3xl font-extrabold text-white">{score} <span className="text-gray-600">/ {questions.length}</span></h3>
        <div className="w-full bg-gray-800 rounded-full h-2 max-w-xs mx-auto">
          <div className="h-2 rounded-full transition-all duration-700"
            style={{ width: `${(score / questions.length) * 100}%`, background: pct >= 0.7 ? "#22c55e" : pct >= 0.4 ? "#f59e0b" : "#ef4444" }} />
        </div>
        <p className="text-gray-400 text-sm">{pct >= 0.7 ? "¡Excelente dominio del tema!" : pct >= 0.4 ? "Buen progreso, sigue repasando" : "Repasa el material y vuelve a intentar"}</p>
        <button onClick={() => { setAnswers({}); setQIdx(0); setDone(false) }}
          className="mt-2 px-6 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors">Reintentar</button>
      </div>
    )
  }

  if (!q) return null
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div className="flex gap-1">
          {questions.map((_: any, i: number) => (
            <div key={i} className={`h-1 rounded-full transition-all ${i === qIdx ? "w-6 bg-blue-400" : answers[i] !== undefined ? "w-3 bg-green-400/60" : "w-3 bg-white/10"}`} />
          ))}
        </div>
        <span className="text-blue-400 text-xs font-semibold">{score} pts</span>
      </div>

      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
        <p className="text-xs text-gray-600 mb-2">Pregunta {qIdx + 1} de {questions.length}</p>
        <p className="text-white font-semibold text-sm leading-relaxed">{q.question}</p>
      </div>

      <div className="space-y-2">
        {(q.options || []).map((opt: string, i: number) => {
          const answered = answers[qIdx] !== undefined
          const selected = answers[qIdx] === i
          const correct  = i === q.correctAnswer
          let cls = "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06] cursor-pointer"
          if (answered && correct) cls = "bg-green-500/10 border-green-500/30 cursor-default"
          else if (answered && selected) cls = "bg-red-500/10 border-red-500/30 cursor-default"
          else if (answered) cls = "bg-white/[0.01] border-white/[0.04] opacity-50 cursor-default"
          return (
            <button key={i} onClick={() => !answered && setAnswers({ ...answers, [qIdx]: i })}
              className={`w-full text-left p-3.5 rounded-2xl border text-sm transition-all ${cls}`}>
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: answered && correct ? "rgba(34,197,94,0.2)" : answered && selected ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.06)" }}>
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="text-gray-300 flex-1">{opt}</span>
                {answered && correct && <span>✅</span>}
                {answered && selected && !correct && <span>❌</span>}
              </div>
            </button>
          )
        })}
      </div>

      {answers[qIdx] !== undefined && q.explanation && (
        <div className="bg-blue-500/[0.06] border-l-2 border-blue-500/50 rounded-xl p-3">
          <p className="text-gray-400 text-xs">💡 {q.explanation}</p>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        {qIdx > 0 && (
          <button onClick={() => setQIdx(qIdx - 1)} className="px-3 py-2 rounded-xl border border-white/10 text-gray-500 text-xs hover:border-white/20 hover:text-gray-300 transition-all">← Anterior</button>
        )}
        {qIdx < questions.length - 1 ? (
          <button onClick={() => setQIdx(qIdx + 1)} disabled={answers[qIdx] === undefined}
            className="px-4 py-2 rounded-xl bg-blue-600/80 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-30 transition-colors">Siguiente →</button>
        ) : (
          <button onClick={() => setDone(true)} disabled={answers[qIdx] === undefined}
            className="px-4 py-2 rounded-xl bg-green-600/80 hover:bg-green-500 text-white text-xs font-semibold disabled:opacity-30 transition-colors">Ver resultado 🏆</button>
        )}
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// TIMELINE
// ═════════════════════════════════════════════════════════════════════════════
export function TimelineRenderer({ data }: { data: any }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const events: any[] = data.events || []
  const DOT_COLORS: Record<string, string> = { high: "#ef4444", medium: "#f59e0b", low: "#3b82f6" }

  return (
    <div className="space-y-3">
      <div className="text-center">
        <h3 className="text-white font-bold text-sm">⏳ {data.title}</h3>
        {data.period && <p className="text-gray-600 text-xs mt-0.5">{data.period}</p>}
      </div>

      <div className="relative pl-8">
        <div className="absolute left-3 top-2 bottom-2 w-[2px] rounded-full"
          style={{ background: "linear-gradient(to bottom, #3b82f6, #8b5cf6, #ec4899)" }} />

        {events.map((evt: any, i: number) => {
          const dotColor = DOT_COLORS[evt.importance] || DOT_COLORS.low
          const isHov    = hoveredIdx === i
          return (
            <div key={i} className="mb-3 relative"
              onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)}>
              <div className="absolute -left-5 top-3 w-3.5 h-3.5 rounded-full border-2 border-gray-950 transition-transform"
                style={{ background: dotColor, transform: isHov ? "scale(1.4)" : "scale(1)" }} />
              <div className={`rounded-2xl p-3.5 border transition-all ${isHov ? "bg-white/[0.06] border-white/15" : "bg-white/[0.02] border-white/[0.05]"}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-base">{evt.icon || "📅"}</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: dotColor + "22", color: dotColor }}>{evt.date}</span>
                  {evt.importance === "high" && <span className="text-[10px] text-red-400 font-semibold">⭐ Hito clave</span>}
                </div>
                <h4 className="text-gray-200 font-bold text-xs mb-0.5">{evt.title}</h4>
                <p className="text-gray-500 text-[11px] leading-relaxed">{evt.description}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Mapa de renderers exportado ─────────────────────────────────────────────
export const RENDERERS: Record<string, React.FC<{ data: any }>> = {
  infographic: InfographicRenderer,
  ppt:         PPTRenderer,
  poster:      PosterRenderer,
  podcast:     PodcastRenderer,
  mindmap:     MindmapRenderer,
  flashcards:  FlashcardsRenderer,
  quiz:        QuizRenderer,
  timeline:    TimelineRenderer,
}
