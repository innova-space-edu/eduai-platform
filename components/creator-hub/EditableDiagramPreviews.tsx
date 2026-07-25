"use client"

import { useMemo } from "react"

type PositionedNode = {
  id: string
  label: string
  description?: string
  category: string
  color: string
  importance: number
  connections: string[]
  edgeLabels: string[]
  x: number
  y: number
  width: number
  height: number
}

const FALLBACK_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899"]

function textLines(value: string, max = 18) {
  const words = String(value || "").split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > max && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  if (lines.length <= 2) return lines
  return [lines[0], `${lines[1].slice(0, Math.max(1, max - 1))}…`]
}

function nodeSize(category: string, importance: number, label: string) {
  const lines = textLines(label, category === "main" ? 16 : 18)
  const base = category === "main" ? 118 : category === "sub" ? 104 : 88
  const extra = Math.max(0, importance - 1) * 8
  return { width: base + extra, height: (lines.length > 1 ? 50 : 40) + extra * 0.25 }
}

function buildMindmapLayout(data: any): PositionedNode[] {
  const rawNodes = Array.isArray(data?.nodes) ? data.nodes : []
  const centerX = 500
  const centerY = 320
  const mains = rawNodes.filter((node: any) => node.category === "main")
  const subs = rawNodes.filter((node: any) => node.category === "sub")
  const details = rawNodes.filter((node: any) => node.category === "detail")
  const positions = new Map<string, PositionedNode>()

  const register = (node: any, index: number, x: number, y: number) => {
    const color = typeof node.color === "string" && node.color ? node.color : FALLBACK_COLORS[index % FALLBACK_COLORS.length]
    const importance = Number(node.importance) || 1
    const size = nodeSize(node.category || "sub", importance, node.label || "Concepto")
    positions.set(String(node.id || `node-${index + 1}`), {
      id: String(node.id || `node-${index + 1}`),
      label: String(node.label || "Concepto"),
      description: typeof node.description === "string" ? node.description : "",
      category: String(node.category || "sub"),
      color,
      importance,
      connections: Array.isArray(node.connections) ? node.connections.map(String) : [],
      edgeLabels: Array.isArray(node.edgeLabels) ? node.edgeLabels.map(String) : [],
      x,
      y,
      width: size.width,
      height: size.height,
    })
  }

  const mainCount = Math.max(1, mains.length)
  mains.forEach((node: any, index: number) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / mainCount
    register(node, index, centerX + Math.cos(angle) * 235, centerY + Math.sin(angle) * 205)
  })

  const mainIds = new Set(mains.map((node: any) => String(node.id)))
  const subsByMain = new Map<string, any[]>()
  mains.forEach((node: any) => subsByMain.set(String(node.id), []))
  subs.forEach((node: any, index: number) => {
    const parent = (Array.isArray(node.connections) ? node.connections : []).find((connection: string) => mainIds.has(String(connection)))
    const fallback = mains[index % mainCount]?.id
    const key = String(parent || fallback || "")
    if (!subsByMain.has(key)) subsByMain.set(key, [])
    subsByMain.get(key)?.push(node)
  })

  subsByMain.forEach((children, parentId) => {
    const parent = positions.get(parentId)
    if (!parent) return
    const baseAngle = Math.atan2(parent.y - centerY, parent.x - centerX)
    const spread = Math.min(1.35, Math.max(0.55, children.length * 0.42))
    children.forEach((node: any, index: number) => {
      const offset = children.length === 1 ? 0 : -spread / 2 + (spread * index) / (children.length - 1)
      const angle = baseAngle + offset
      register(node, positions.size, parent.x + Math.cos(angle) * 132, parent.y + Math.sin(angle) * 112)
    })
  })

  const subIds = new Set(subs.map((node: any) => String(node.id)))
  details.forEach((node: any, index: number) => {
    const parentId = (Array.isArray(node.connections) ? node.connections : []).find((connection: string) => subIds.has(String(connection)))
    const fallback = subs[index % Math.max(1, subs.length)]?.id || mains[index % mainCount]?.id
    const parent = positions.get(String(parentId || fallback || ""))
    if (!parent) return
    const baseAngle = Math.atan2(parent.y - centerY, parent.x - centerX)
    const siblingCount = Array.from(positions.values()).filter((position) => position.connections.includes(parent.id) && position.category === "detail").length
    const angle = baseAngle + (siblingCount - 0.5) * 0.42
    register(node, positions.size, parent.x + Math.cos(angle) * 98, parent.y + Math.sin(angle) * 82)
  })

  rawNodes.forEach((node: any, index: number) => {
    const id = String(node.id || `node-${index + 1}`)
    if (positions.has(id)) return
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(1, rawNodes.length)
    register(node, index, centerX + Math.cos(angle) * 245, centerY + Math.sin(angle) * 220)
  })

  return Array.from(positions.values())
}

export function EditableMindmapPreview({ data }: { data: any }) {
  const nodes = useMemo(() => buildMindmapLayout(data), [data])
  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes])
  const centralTopic = String(data?.centralTopic || "Tema central")
  const centerLines = textLines(centralTopic, 20)

  return (
    <article className="overflow-hidden rounded-3xl border border-white/10" style={{ background: "radial-gradient(ellipse at center,#11233f 0%,#07111f 58%,#040813 100%)" }}>
      <header className="border-b border-white/10 px-6 py-4 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Mapa mental editable</p>
        <h1 className="mt-1 text-lg font-black text-white">{centralTopic}</h1>
      </header>

      <div className="overflow-x-auto p-3">
        <svg viewBox="0 0 1000 650" role="img" aria-label={`Mapa mental sobre ${centralTopic}`} className="min-w-[820px] w-full">
          <defs>
            <filter id="mindmap-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#000000" floodOpacity="0.35" />
            </filter>
            <pattern id="mindmap-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="#94a3b8" opacity="0.10" />
            </pattern>
          </defs>
          <rect width="1000" height="650" fill="url(#mindmap-grid)" />

          {nodes.flatMap((node) => node.connections.map((connection, connectionIndex) => {
            const parent = nodeMap.get(connection)
            if (!parent) return null
            const midX = (parent.x + node.x) / 2
            const midY = (parent.y + node.y) / 2 - 14
            const edgeLabel = node.edgeLabels[connectionIndex]
            return (
              <g key={`${node.id}-${connection}-${connectionIndex}`}>
                <path d={`M ${parent.x} ${parent.y} Q ${midX} ${midY} ${node.x} ${node.y}`} fill="none" stroke={node.color} strokeWidth={node.category === "main" ? 3 : 2} strokeOpacity={node.category === "detail" ? 0.42 : 0.66} strokeDasharray={node.category === "detail" ? "6 5" : undefined} />
                {edgeLabel && <text x={midX} y={midY - 4} textAnchor="middle" fontSize="10" fill="#94a3b8">{edgeLabel.slice(0, 24)}</text>}
              </g>
            )
          }))}

          {nodes.filter((node) => node.category === "main" && node.connections.length === 0).map((node) => (
            <path key={`center-${node.id}`} d={`M 500 320 Q ${(500 + node.x) / 2} ${(320 + node.y) / 2 - 12} ${node.x} ${node.y}`} fill="none" stroke={node.color} strokeWidth="3" strokeOpacity="0.72" />
          ))}

          <g filter="url(#mindmap-shadow)">
            <rect x="402" y="274" width="196" height="92" rx="28" fill="#0f766e" stroke="#5eead4" strokeWidth="2" />
            {centerLines.map((line, index) => <text key={index} x="500" y={315 + (index - (centerLines.length - 1) / 2) * 20} textAnchor="middle" fontSize="17" fontWeight="800" fill="#ffffff">{line}</text>)}
          </g>

          {nodes.map((node) => {
            const lines = textLines(node.label, node.category === "main" ? 16 : 18)
            return (
              <g key={node.id} transform={`translate(${node.x - node.width / 2},${node.y - node.height / 2})`} filter="url(#mindmap-shadow)">
                <rect width={node.width} height={node.height} rx={node.category === "detail" ? 12 : 18} fill={`${node.color}28`} stroke={node.color} strokeWidth={node.category === "main" ? 2.5 : 1.6} />
                <rect width={node.width} height="6" rx="3" fill={node.color} opacity="0.88" />
                {lines.map((line, index) => <text key={index} x={node.width / 2} y={node.height / 2 + 5 + (index - (lines.length - 1) / 2) * 15} textAnchor="middle" fontSize={node.category === "main" ? 13 : 11} fontWeight={node.category === "main" ? 800 : 700} fill="#f8fafc">{line}</text>)}
              </g>
            )
          })}
        </svg>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-6 py-3 text-[9px] font-bold uppercase tracking-widest text-slate-600">
        <span>{nodes.length} conceptos</span>
        <span>EduAI Creator Studio</span>
      </footer>
    </article>
  )
}

const IMPORTANCE = {
  high: { color: "#f97316", label: "Alta" },
  medium: { color: "#3b82f6", label: "Media" },
  low: { color: "#94a3b8", label: "Complementaria" },
} as const

export function EditableTimelinePreview({ data }: { data: any }) {
  const events = Array.isArray(data?.events) ? data.events : []
  const links = Array.isArray(data?.causalLinks) ? data.causalLinks : []

  return (
    <article className="overflow-hidden rounded-3xl border border-white/10" style={{ background: "linear-gradient(155deg,#140b05,#1f1209 48%,#07111f)" }}>
      <header className="relative overflow-hidden border-b border-white/10 px-7 py-8 text-center">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(ellipse at 20% 20%,#f97316,transparent 45%),radial-gradient(ellipse at 85% 40%,#3b82f6,transparent 42%)" }} />
        <div className="relative z-10">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-400">Línea de tiempo editable</p>
          <h1 className="mt-2 text-3xl font-black leading-tight text-white">{data?.title || "Línea de tiempo"}</h1>
          {data?.period && <p className="mt-2 text-sm font-semibold text-orange-200">{data.period}</p>}
        </div>
      </header>

      <div className="relative px-5 py-7 sm:px-8">
        <div className="absolute bottom-8 left-[37px] top-8 w-0.5 bg-gradient-to-b from-orange-500 via-blue-500 to-slate-600 sm:left-1/2 sm:-translate-x-1/2" />
        <div className="space-y-5">
          {events.map((event: any, index: number) => {
            const importance = IMPORTANCE[event.importance as keyof typeof IMPORTANCE] || IMPORTANCE.medium
            const left = index % 2 === 0
            return (
              <section key={`${event.title}-${index}`} className={`relative grid items-center gap-4 pl-12 sm:grid-cols-[1fr_46px_1fr] sm:pl-0`}>
                <div className={`${left ? "sm:col-start-1 sm:text-right" : "sm:col-start-3 sm:text-left"} rounded-2xl border border-white/10 bg-white/[0.045] p-4`}>
                  <div className={`flex flex-wrap items-center gap-2 ${left ? "sm:justify-end" : ""}`}>
                    <span className="rounded-full px-2.5 py-1 text-[10px] font-black" style={{ background: `${importance.color}20`, color: importance.color }}>{importance.label}</span>
                    <span className="text-xs font-black" style={{ color: importance.color }}>{event.date || "Sin fecha"}</span>
                  </div>
                  <h2 className="mt-2 text-base font-black text-white">{event.icon || "📌"} {event.title || `Hito ${index + 1}`}</h2>
                  {event.description && <p className="mt-2 text-xs leading-6 text-slate-300">{event.description}</p>}
                  {event.impact && <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold text-slate-400">Impacto: {event.impact}</p>}
                </div>
                <div className={`absolute left-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border-4 border-[#160d07] text-sm font-black text-white sm:static sm:col-start-2 sm:row-start-1 sm:mx-auto sm:translate-y-0`} style={{ background: importance.color }}>{index + 1}</div>
                <div className={`${left ? "hidden sm:block sm:col-start-3" : "hidden sm:block sm:col-start-1"}`} />
              </section>
            )
          })}
        </div>
      </div>

      {links.length > 0 && (
        <section className="mx-5 mb-6 rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:mx-8">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-400">Relaciones causales</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {links.map((link: any, index: number) => (
              <div key={index} className="rounded-xl border border-white/10 bg-black/10 px-3 py-2.5 text-xs leading-relaxed text-slate-300">
                <span className="font-bold text-white">{link.from}</span> <span className="font-black text-orange-400">→ {link.label || "se relaciona con"} →</span> <span className="font-bold text-white">{link.to}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="flex items-center justify-between border-t border-white/10 px-6 py-3 text-[9px] font-bold uppercase tracking-widest text-slate-600">
        <span>{events.length} hitos</span>
        <span>EduAI Creator Studio</span>
      </footer>
    </article>
  )
}
