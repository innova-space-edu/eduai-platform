/**
 * components/creator-hub/renderers.tsx
 * v2 — Canva-style templates + fixed mindmap layout
 * Formatos: mindmap, infographic, ppt, poster, timeline, flashcards, quiz, podcast
 */
"use client"

import { useEffect, useMemo, useRef, useState } from "react"

// ─── Paleta de ramas del mapa mental ─────────────────────────────────────────
const BRANCH = [
  { bg: "#3b82f6", light: "#dbeafe", text: "#1e3a8a", dark: "#1d4ed8" },
  { bg: "#10b981", light: "#d1fae5", text: "#064e3b", dark: "#059669" },
  { bg: "#f59e0b", light: "#fef3c7", text: "#78350f", dark: "#d97706" },
  { bg: "#ef4444", light: "#fee2e2", text: "#7f1d1d", dark: "#dc2626" },
  { bg: "#8b5cf6", light: "#ede9fe", text: "#3b0764", dark: "#7c3aed" },
  { bg: "#06b6d4", light: "#cffafe", text: "#164e63", dark: "#0891b2" },
  { bg: "#ec4899", light: "#fce7f3", text: "#500724", dark: "#db2777" },
]

// ─── Selector de plantillas ──────────────────────────────────────────────────
function Tpl({ opts, val, onChange, color }: { opts: string[]; val: string; onChange: (v: string) => void; color: string }) {
  return (
    <div className="flex gap-2 mb-4 flex-wrap">
      {opts.map(o => (
        <button key={o} onClick={() => onChange(o)}
          className="px-3 py-1 rounded-full text-xs font-semibold border transition-all"
          style={{
            background: val === o ? color + "18" : "transparent",
            borderColor: val === o ? color + "50" : "var(--border-medium)",
            color: val === o ? color : "#6b7280",
          }}>
          {o}
        </button>
      ))}
      <span className="ml-auto text-[10px] text-muted2 self-center">Plantilla</span>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAPA MENTAL — layout radial corregido
// ═══════════════════════════════════════════════════════════════════════════════
export function MindmapRenderer({ data }: { data: any }) {
  const [selected, setSelected] = useState<any>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const dragging = useRef(false)
  const drag0 = useRef({ x: 0, y: 0, px: 0, py: 0 })

  const nodes: any[] = data.nodes || []
  const centralTopic: string = data.centralTopic || "Tema"
  const VW = 960, VH = 600
  const cx = VW / 2, cy = VH / 2

  const mainNodes = nodes.filter(n => n.category === "main")
  const subNodes  = nodes.filter(n => n.category === "sub")
  const detNodes  = nodes.filter(n => n.category === "detail")
  const mainIds   = new Set(mainNodes.map(n => n.id))
  const subIds    = new Set(subNodes.map(n => n.id))

  type LNode = { id: string; label: string; x: number; y: number; category: string; colorIdx: number; parentId: string; isCenter?: boolean; description?: string }

  // ── Centro ────────────────────────────────────────────────────────────────
  const layout: LNode[] = [
    { id: "__center__", label: centralTopic, x: cx, y: cy, category: "center", colorIdx: 0, parentId: "", isCenter: true },
  ]

  // ── Nodos principales en círculo ──────────────────────────────────────────
  const Rm = Math.min(230, Math.max(170, 240 - mainNodes.length * 5))
  mainNodes.forEach((n: any, i: number) => {
    const a = (2 * Math.PI * i / mainNodes.length) - Math.PI / 2
    layout.push({ ...n, x: cx + Math.cos(a) * Rm, y: cy + Math.sin(a) * Rm, colorIdx: (i + 1) % BRANCH.length, parentId: "__center__" })
  })

  // ── Subnodos: agrupar por padre real (connections) ──────────────────────
  const subsByMain = new Map<string, any[]>()
  mainNodes.forEach((m: any) => subsByMain.set(m.id, []))
  subNodes.forEach((sub: any, si: number) => {
    const pid = (sub.connections as string[] || []).find(c => mainIds.has(c))
    if (pid && subsByMain.has(pid)) { subsByMain.get(pid)!.push(sub) }
    else {
      const fb = mainNodes[si % Math.max(mainNodes.length, 1)]?.id
      if (fb) subsByMain.get(fb)?.push(sub)
    }
  })

  // ── Colocar subnodos en abanico ────────────────────────────────────────
  const Rs = 130
  subsByMain.forEach((subs, mid) => {
    const pm = layout.find(l => l.id === mid); if (!pm) return
    const base = Math.atan2(pm.y - cy, pm.x - cx)
    const fan  = Math.min(Math.PI * 0.7, Math.max(0.4, subs.length * 0.38))
    subs.forEach((sub: any, j: number) => {
      const off = subs.length > 1 ? -fan/2 + fan * j / (subs.length - 1) : 0
      const a   = base + off
      layout.push({ ...sub, x: pm.x + Math.cos(a) * Rs, y: pm.y + Math.sin(a) * Rs, colorIdx: pm.colorIdx, parentId: mid })
    })
  })

  // ── Detalles: conectar a subnodo real ──────────────────────────────────
  const Rd = 80
  detNodes.forEach((det: any, di: number) => {
    const psid    = (det.connections as string[] || []).find(c => subIds.has(c))
    const placed  = layout.filter(l => l.category === "sub")
    const ps      = psid ? layout.find(l => l.id === psid) : placed[di % Math.max(placed.length, 1)]
    if (!ps) return
    const sibs    = layout.filter(l => l.parentId === ps.id && l.category === "detail").length
    const base    = Math.atan2(ps.y - cy, ps.x - cx)
    const off     = (sibs - 0.5) * 0.55
    layout.push({ ...det, x: ps.x + Math.cos(base + off) * Rd, y: ps.y + Math.sin(base + off) * Rd, colorIdx: ps.colorIdx, parentId: ps.id })
  })

  // ── Curva suave radial ────────────────────────────────────────────────
  function curve(x1: number, y1: number, x2: number, y2: number) {
    const dx = x2 - x1, dy = y2 - y1
    const L  = Math.sqrt(dx*dx + dy*dy) || 1
    const nx = -dy / L * L * 0.12, ny = dx / L * L * 0.12
    return `M ${x1} ${y1} Q ${(x1+x2)/2+nx} ${(y1+y2)/2+ny} ${x2} ${y2}`
  }

  // ── Texto multilínea ─────────────────────────────────────────────────
  function wrap(s: string, max: number): string[] {
    if (s.length <= max) return [s]
    const ws = s.split(" "); const lines: string[] = []; let cur = ""
    for (const w of ws) {
      if ((cur + " " + w).trim().length > max && cur) { lines.push(cur.trim()); cur = w }
      else cur = (cur + " " + w).trim()
    }
    if (cur) lines.push(cur.trim())
    const out = lines.slice(0, 2)
    if (lines.length > 2) out[1] = out[1].slice(0, -2) + "…"
    return out
  }

  function sz(n: LNode) {
    if (n.isCenter) return { w: Math.max(130, n.label.length * 7.5 + 28), h: 44 }
    if (n.category === "main") { const ls = wrap(n.label, 12); return { w: Math.max(92, n.label.length * 6.5 + 22), h: ls.length > 1 ? 46 : 34 } }
    if (n.category === "sub")    return { w: Math.max(74, Math.min(n.label.length, 16) * 6.2 + 18), h: 27 }
    return { w: Math.max(62, Math.min(n.label.length, 13) * 5.8 + 14), h: 22 }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-emerald-400 font-bold text-sm">🧠 {centralTopic}</h3>
        <div className="flex gap-2">
          {[["+ ", () => setScale(s => Math.min(s + 0.15, 2.5))],
            ["−",  () => setScale(s => Math.max(s - 0.15, 0.3))],
            ["↺",  () => { setScale(1); setPan({ x: 0, y: 0 }) }]
          ].map(([label, fn]: any, i) => (
            <button key={i} onClick={fn}
              className="w-7 h-7 rounded-lg bg-card-soft-theme text-sub hover:text-main text-sm flex items-center justify-center transition-colors">
              {label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="relative rounded-2xl border border-soft overflow-hidden cursor-grab active:cursor-grabbing select-none"
        style={{ height: 480, background: "radial-gradient(ellipse at 40% 40%, #0d1f3c, #060c1a)" }}
        onMouseDown={e => { dragging.current = true; drag0.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y } }}
        onMouseMove={e => { if (!dragging.current) return; setPan({ x: drag0.current.px + e.clientX - drag0.current.x, y: drag0.current.py + e.clientY - drag0.current.y }) }}
        onMouseUp={() => { dragging.current = false }}
        onMouseLeave={() => { dragging.current = false }}
        onWheel={e => { e.preventDefault(); setScale(s => Math.max(0.3, Math.min(2.5, s - e.deltaY * 0.001))) }}>

        <div className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{ backgroundImage: "radial-gradient(#6b7280 1px, transparent 1px)", backgroundSize: "30px 30px" }} />

        <svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`}
          style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${scale})`, transformOrigin: "center", transition: dragging.current ? "none" : "transform 0.1s" }}>
          <defs>
            {BRANCH.map((c, i) => (
              <radialGradient key={i} id={`g${i}`} cx="35%" cy="30%">
                <stop offset="0%" stopColor={c.dark} />
                <stop offset="100%" stopColor={c.bg} />
              </radialGradient>
            ))}
            <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Líneas de conexión */}
          {layout.map(n => {
            if (!n.parentId) return null
            const p = layout.find(l => l.id === n.parentId); if (!p) return null
            const c = BRANCH[n.colorIdx % BRANCH.length]
            return (
              <path key={`l-${n.id}`} d={curve(p.x, p.y, n.x, n.y)} fill="none"
                stroke={c.bg}
                strokeWidth={n.category === "main" ? 2.5 : n.category === "sub" ? 1.8 : 1.2}
                strokeOpacity={n.category === "main" ? 0.75 : n.category === "sub" ? 0.55 : 0.4}
                strokeDasharray={n.category === "detail" ? "4 3" : undefined} />
            )
          })}

          {/* Nodos */}
          {layout.map(n => {
            const { w, h } = sz(n)
            const hov = hovered === n.id
            const sel = selected?.id === n.id
            const c   = BRANCH[n.colorIdx % BRANCH.length]
            const maxC = n.isCenter ? 14 : n.category === "main" ? 12 : n.category === "sub" ? 14 : 11
            const lines = wrap(n.label, maxC)

            return (
              <g key={n.id} style={{ cursor: "pointer" }}
                onMouseEnter={() => setHovered(n.id)} onMouseLeave={() => setHovered(null)}
                onMouseDown={e => { e.stopPropagation(); setSelected(n.isCenter ? null : n) }}>

                {(hov || sel) && (
                  <rect x={n.x-w/2-6} y={n.y-h/2-6} width={w+12} height={h+12} rx={h/2+6}
                    fill={c.bg + "18"} stroke={c.bg + "70"} strokeWidth={1} />
                )}

                {n.isCenter ? (
                  <rect x={n.x-w/2} y={n.y-h/2} width={w} height={h} rx={h/2}
                    fill={`url(#g0)`} stroke="rgba(255,255,255,0.35)" strokeWidth={2}
                    filter={sel ? "url(#glow)" : undefined} />
                ) : n.category === "main" ? (
                  <rect x={n.x-w/2} y={n.y-h/2} width={w} height={h} rx={h/2}
                    fill={`url(#g${n.colorIdx})`} stroke={c.bg + "90"} strokeWidth={1}
                    filter={hov ? "url(#glow)" : undefined} />
                ) : n.category === "sub" ? (
                  <rect x={n.x-w/2} y={n.y-h/2} width={w} height={h} rx={7}
                    fill={c.bg + "1a"} stroke={c.bg} strokeWidth={1.3} />
                ) : (
                  <rect x={n.x-w/2} y={n.y-h/2} width={w} height={h} rx={5}
                    fill="var(--bg-card)" stroke={c.bg + "55"} strokeWidth={1}
                    strokeDasharray="3 2" />
                )}

                <text x={n.x} textAnchor="middle" dominantBaseline="middle"
                  fontSize={n.isCenter ? 12 : n.category === "main" ? 11 : n.category === "sub" ? 10 : 9}
                  fontWeight={n.isCenter || n.category === "main" ? "700" : "600"}
                  fontFamily="system-ui, -apple-system, sans-serif"
                  fill={n.isCenter || n.category === "main" ? "white" : c.text}
                  style={{ userSelect: "none", pointerEvents: "none" }}>
                  {lines.map((line, i) => (
                    <tspan key={i} x={n.x} y={n.y + (i - (lines.length - 1) / 2) * 13}>{line}</tspan>
                  ))}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {selected && (
        <div className="rounded-2xl p-4 border" style={{
          background: BRANCH[selected.colorIdx]?.bg + "10",
          borderColor: BRANCH[selected.colorIdx]?.bg + "40"
        }}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-bold text-sm text-main mb-1">{selected.label}</h4>
              {selected.description && <p className="text-sub text-xs leading-relaxed">{selected.description}</p>}
              <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full font-semibold"
                style={{ background: BRANCH[selected.colorIdx]?.bg + "20", color: BRANCH[selected.colorIdx]?.bg }}>
                {selected.category === "main" ? "Concepto principal" : selected.category === "sub" ? "Subtema" : "Detalle"}
              </span>
            </div>
            <button onClick={() => setSelected(null)} className="text-muted2 hover:text-sub text-xl leading-none">×</button>
          </div>
        </div>
      )}

      <p className="text-[10px] text-muted2 text-right">Arrastra · Rueda = zoom · Click = detalle</p>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// INFOGRAFÍA — 3 templates
// ═══════════════════════════════════════════════════════════════════════════════
export function InfographicRenderer({ data }: { data: any }) {
  const [tpl, setTpl] = useState("Moderno")
  const SCHEME: Record<string, string> = {
    blue: "#3b82f6", green: "#16a34a", purple: "#8b5cf6",
    orange: "#ea580c", red: "#ef4444", teal: "#0d9488", indigo: "#4338ca"
  }
  const accent = SCHEME[data.colorScheme] || "#3b82f6"
  const sections: any[] = data.sections || []

  const T: Record<string, {
    wrap: string; hdrBg: string; hdrText: string; card: string; cardBorder: string;
    title: string; body: string; accent2: string; sectionHdr: string; statBg: string
  }> = {
    Moderno: {
      wrap: `linear-gradient(160deg,#09142a,#0d1f3f)`,
      hdrBg: `linear-gradient(135deg,${accent}30,${accent}08)`,
      hdrText: accent, card: "var(--bg-input)", cardBorder: "var(--border-soft)",
      title: "var(--text-primary)", body: "var(--text-muted)", accent2: accent, sectionHdr: "var(--bg-card)", statBg: accent + "20",
    },
    Claro: {
      wrap: `linear-gradient(160deg,#f8fafc,#eef2f7)`,
      hdrBg: `linear-gradient(135deg,${accent}20,${accent}05)`,
      hdrText: accent, card: "#ffffff", cardBorder: "rgba(0,0,0,0.07)",
      title: "var(--bg-card)", body: "#475569", accent2: accent, sectionHdr: accent + "0d", statBg: accent + "14",
    },
    Impacto: {
      wrap: `#050505`,
      hdrBg: accent,
      hdrText: "#ffffff", card: "var(--bg-input)", cardBorder: "var(--border-medium)",
      title: "#ffffff", body: "#a1a1aa", accent2: "#ffffff", sectionHdr: accent, statBg: accent + "25",
    },
  }
  const t = T[tpl]

  return (
    <div>
      <Tpl opts={["Moderno","Claro","Impacto"]} val={tpl} onChange={setTpl} color={accent} />
      <div className="rounded-2xl overflow-hidden" style={{ background: t.wrap }}>

        {/* Header */}
        <div className="relative px-6 pt-8 pb-6 text-center overflow-hidden" style={{ background: t.hdrBg }}>
          {tpl !== "Impacto" && (
            <div className="absolute inset-0 opacity-20 pointer-events-none"
              style={{ backgroundImage: `radial-gradient(ellipse at 25% 50%,${accent}80,transparent 55%),radial-gradient(ellipse at 80% 20%,${accent}40,transparent 40%)` }} />
          )}
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-3 text-xs font-bold"
              style={{
                background: tpl === "Impacto" ? "rgba(255,255,255,0.2)" : accent + "28",
                color: t.hdrText,
                border: `1px solid ${tpl === "Impacto" ? "rgba(255,255,255,0.3)" : accent + "45"}`,
              }}>
              📊 Infografía Educativa
            </div>
            <h1 className="text-2xl font-black leading-tight mb-2" style={{ color: tpl === "Impacto" ? "#fff" : t.title }}>
              {data.title}
            </h1>
            {data.subtitle && <p className="text-sm" style={{ color: tpl === "Impacto" ? "rgba(255,255,255,0.8)" : t.body }}>{data.subtitle}</p>}
          </div>
        </div>

        {/* Key fact */}
        {data.keyFact && (
          <div className="mx-5 mb-4 rounded-2xl px-5 py-3 text-center"
            style={{ background: accent + "18", border: `1px solid ${accent}35` }}>
            <p className="text-sm font-bold" style={{ color: accent }}>💡 {data.keyFact}</p>
          </div>
        )}

        {/* Sections */}
        <div className={`px-5 pb-5 grid gap-3 ${sections.length > 3 ? "sm:grid-cols-2" : ""} grid-cols-1`}>
          {sections.map((sec: any, i: number) => (
            <div key={i} className="rounded-2xl overflow-hidden border" style={{ background: t.card, borderColor: t.cardBorder }}>
              <div className="flex items-center gap-3 px-4 py-3 border-b"
                style={{ background: t.sectionHdr, borderColor: t.cardBorder }}>
                {tpl === "Impacto" && (
                  <span className="font-black opacity-20 text-main tabular-nums leading-none" style={{ fontSize: 28 }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                )}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: accent + "22" }}>
                  {sec.icon || "📌"}
                </div>
                <h3 className="font-bold text-sm flex-1" style={{ color: tpl === "Impacto" ? "white" : t.hdrText }}>
                  {sec.heading}
                </h3>
              </div>
              <div className="px-4 py-3">
                {sec.stat && (
                  <div className="mb-3 rounded-xl px-3 py-2 text-center" style={{ background: t.statBg }}>
                    <span className="text-2xl font-black" style={{ color: accent }}>{sec.stat.value}</span>
                    {sec.stat.label && <p className="text-[10px] mt-0.5" style={{ color: t.body }}>{sec.stat.label}</p>}
                  </div>
                )}
                <ul className="space-y-1.5">
                  {(sec.points || []).map((pt: string, j: number) => (
                    <li key={j} className="flex gap-2 text-xs leading-relaxed" style={{ color: t.body }}>
                      <span className="flex-shrink-0 font-bold mt-0.5" style={{ color: accent }}>▸</span>{pt}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {data.conclusion && (
          <div className="mx-5 mb-5 rounded-2xl px-5 py-3 text-center" style={{ background: t.card, border: `1px solid ${t.cardBorder}` }}>
            <p className="text-xs italic" style={{ color: t.body }}>📝 {data.conclusion}</p>
          </div>
        )}
        <div className="px-5 pb-4 flex justify-between">
          <span className="text-[10px]" style={{ color: t.body + "55" }}>EduAI Creator Studio</span>
          <span className="text-[10px]" style={{ color: t.body + "55" }}>{new Date().toLocaleDateString("es-CL")}</span>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRESENTACIÓN — 3 themes, selector interno
// ═══════════════════════════════════════════════════════════════════════════════
export function PPTRenderer({ data }: { data: any }) {
  const [idx, setIdx]   = useState(0)
  const [tpl, setTpl]   = useState("Académico")
  const slides = data.slides || []
  const s = slides[idx]
  if (!s) return null

  const THEMES: Record<string, { bg: string; accent: string; text: string; sub: string; bar: string; cardBg: string }> = {
    Académico:  { bg: "linear-gradient(150deg,#0a1628,#112040)", accent: "#3b82f6", text: "var(--text-primary)", sub: "var(--text-muted)", bar: "#3b82f6", cardBg: "rgba(59,130,246,0.12)" },
    Ejecutivo:  { bg: "linear-gradient(150deg,#070f1a,#0c1a2e)", accent: "#22d3ee", text: "#ecfeff", sub: "#67e8f9", bar: "#22d3ee", cardBg: "rgba(34,211,238,0.1)" },
    Minimalista:{ bg: "linear-gradient(150deg,#18181b,#27272a)", accent: "#e4e4e7", text: "#fafafa", sub: "#a1a1aa", bar: "#e4e4e7", cardBg: "var(--bg-card-soft)" },
  }
  const T = THEMES[tpl]
  const isTitle = idx === 0 || s.type === "title"
  const isQuote = s.type === "quote"
  const isStats = s.type === "stats"
  const is2col  = s.layout === "two-column" && (s.bullets?.length || 0) >= 4

  return (
    <div className="space-y-3">
      <Tpl opts={["Académico","Ejecutivo","Minimalista"]} val={tpl} onChange={setTpl} color={T.accent} />

      <div className="flex justify-between items-center">
        <span className="text-sub text-xs font-medium truncate max-w-[180px]">{data.title}</span>
        <span className="text-muted2 text-xs">{idx + 1} / {slides.length}</span>
      </div>

      <div className="aspect-video rounded-2xl overflow-hidden border border-soft relative flex flex-col"
        style={{ background: T.bg }}>
        {/* Accent bar */}
        <div className="absolute top-0 left-0 h-1 w-full" style={{ background: `linear-gradient(90deg,${T.bar},${T.bar}44)` }} />
        <div className="absolute left-0 top-0 w-1.5 h-full opacity-70" style={{ background: T.bar }} />
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: `radial-gradient(ellipse at top right,${T.accent},transparent 55%)` }} />

        <div className="relative z-10 flex-1 flex flex-col justify-center px-10 py-6">
          {isTitle ? (
            <div className="text-center">
              <div className="w-12 h-0.5 mx-auto mb-5 rounded-full" style={{ background: T.accent }} />
              <h1 className="text-2xl font-black leading-tight mb-3" style={{ color: T.text }}>{s.title}</h1>
              {s.subtitle && <p className="text-sm" style={{ color: T.sub }}>{s.subtitle}</p>}
              {data.author && <p className="text-xs mt-6 font-semibold" style={{ color: T.accent }}>{data.author}</p>}
            </div>
          ) : isQuote ? (
            <div className="text-center px-4">
              <div className="text-5xl mb-2 opacity-25 font-serif leading-none" style={{ color: T.accent }}>"</div>
              <p className="text-lg font-semibold italic leading-relaxed" style={{ color: T.text }}>{s.title}</p>
              {s.notes && <p className="text-xs mt-3" style={{ color: T.sub }}>— {s.notes}</p>}
            </div>
          ) : isStats ? (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-5 rounded-full" style={{ background: T.accent }} />
                <h2 className="text-base font-bold" style={{ color: T.text }}>{s.title}</h2>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {(s.bullets || []).slice(0, 3).map((b: string, i: number) => {
                  const [val, ...rest] = b.split(" — ")
                  return (
                    <div key={i} className="rounded-xl p-3 text-center border border-soft" style={{ background: T.cardBg }}>
                      <p className="text-xl font-black" style={{ color: T.accent }}>{val}</p>
                      <p className="text-[10px] mt-1 leading-snug" style={{ color: T.sub }}>{rest.join(" — ")}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : is2col ? (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-5 rounded-full" style={{ background: T.accent }} />
                <h2 className="text-base font-bold" style={{ color: T.text }}>{s.title}</h2>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {(s.bullets || []).map((b: string, i: number) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                      style={{ background: T.accent + "22", color: T.accent }}>{i + 1}</div>
                    <p className="text-xs leading-relaxed" style={{ color: T.sub }}>{b}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-5 rounded-full" style={{ background: T.accent }} />
                <h2 className="text-base font-bold" style={{ color: T.text }}>{s.title}</h2>
              </div>
              <div className="space-y-2.5">
                {(s.bullets || []).map((b: string, i: number) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                      style={{ background: T.accent + "22", color: T.accent }}>{i + 1}</div>
                    <p className="text-sm leading-relaxed" style={{ color: T.sub }}>{b}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="absolute bottom-2 right-3">
          <span className="text-[10px]" style={{ color: T.accent + "55" }}>{idx + 1}</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}
          className="px-3 py-1.5 rounded-lg border border-soft text-muted2 text-xs disabled:opacity-30 hover:border-medium hover:text-sub transition-all">← Ant.</button>
        <div className="flex gap-1">
          {slides.map((_: any, i: number) => (
            <button key={i} onClick={() => setIdx(i)} className="rounded-full transition-all"
              style={{ width: i === idx ? 20 : 6, height: 6, background: i === idx ? T.accent : "rgba(255,255,255,0.15)" }} />
          ))}
        </div>
        <button onClick={() => setIdx(Math.min(slides.length - 1, idx + 1))} disabled={idx === slides.length - 1}
          className="px-3 py-1.5 rounded-lg border border-soft text-muted2 text-xs disabled:opacity-30 hover:border-medium hover:text-sub transition-all">Sig. →</button>
      </div>

      {s.notes && (
        <div className="bg-card-soft-theme rounded-xl p-3">
          <span className="text-muted2 text-[10px] font-semibold uppercase tracking-wider">Notas</span>
          <p className="text-muted2 text-xs mt-1">{s.notes}</p>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// AFICHE — 3 templates Canva-style
// ═══════════════════════════════════════════════════════════════════════════════
export function PosterRenderer({ data }: { data: any }) {
  const [tpl, setTpl] = useState("Hero")

  const SCHEMES: Record<string, { bg: string; accent: string; text: string; sub: string; cardBg: string; cardBorder: string }> = {
    vibrant:    { bg: "linear-gradient(135deg,#0f172a,#1e1b4b,#2d0f3f)", accent: "#818cf8", text: "var(--text-primary)", sub: "var(--text-muted)", cardBg: "rgba(129,140,248,0.1)", cardBorder: "rgba(129,140,248,0.2)" },
    pastel:     { bg: "linear-gradient(135deg,#fef9ff,#f0f9ff,#fff7ed)", accent: "#7c3aed", text: "#1e1b4b", sub: "#6b7280",  cardBg: "rgba(124,58,237,0.06)", cardBorder: "rgba(124,58,237,0.15)" },
    dark:       { bg: "linear-gradient(135deg,#000,#18181b)",             accent: "#22d3ee", text: "#f0fdfa", sub: "#a1a1aa", cardBg: "rgba(34,211,238,0.07)", cardBorder: "rgba(34,211,238,0.2)" },
    monochrome: { bg: "linear-gradient(135deg,#18181b,#27272a)",          accent: "#e4e4e7", text: "#fafafa", sub: "#71717a",  cardBg: "rgba(228,228,231,0.07)", cardBorder: "rgba(228,228,231,0.15)" },
    neon:       { bg: "linear-gradient(135deg,#000,#071020)",             accent: "#4ade80", text: "#f0fdf4", sub: "#6ee7b7", cardBg: "rgba(74,222,128,0.07)", cardBorder: "rgba(74,222,128,0.2)" },
  }
  const cs = SCHEMES[data.colorScheme] || SCHEMES.vibrant

  return (
    <div>
      <Tpl opts={["Hero","Revista","Split"]} val={tpl} onChange={setTpl} color={cs.accent} />

      {/* ── HERO: gran titular centrado ────────────────────────────── */}
      {tpl === "Hero" && (
        <div className="rounded-2xl overflow-hidden border border-soft" style={{ background: cs.bg }}>
          <div className="relative px-8 pt-12 pb-8 text-center overflow-hidden">
            <div className="absolute inset-0 opacity-25"
              style={{ backgroundImage: `radial-gradient(ellipse at 50% 0%,${cs.accent}aa,transparent 65%)` }} />
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5 text-xs font-bold border"
                style={{ background: cs.accent + "18", color: cs.accent, borderColor: cs.accent + "35" }}>
                🎨 Afiche Educativo
              </div>
              <h1 className="text-4xl font-black leading-tight mb-3" style={{ color: cs.text }}>{data.headline}</h1>
              {data.tagline && <p className="text-base font-medium" style={{ color: cs.accent }}>{data.tagline}</p>}
            </div>
          </div>
          <div className="mx-6 h-px" style={{ background: `linear-gradient(90deg,transparent,${cs.accent}55,transparent)` }} />
          <div className="px-6 py-5 space-y-3">
            {(data.mainPoints || []).map((pt: any, i: number) => (
              <div key={i} className="flex gap-4 rounded-2xl p-4 border" style={{ background: cs.cardBg, borderColor: cs.cardBorder }}>
                <div className="text-2xl flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl"
                  style={{ background: cs.accent + "18" }}>{pt.icon}</div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-sm mb-0.5" style={{ color: cs.text }}>{pt.title}</h3>
                    {pt.stat && <span className="text-xs font-bold px-2 py-0.5 rounded-lg flex-shrink-0"
                      style={{ background: cs.accent + "22", color: cs.accent }}>{pt.stat}</span>}
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: cs.sub }}>{pt.description}</p>
                </div>
              </div>
            ))}
          </div>
          {data.callToAction && (
            <div className="mx-6 mb-6 rounded-2xl px-6 py-4 text-center border-2"
              style={{ background: cs.accent + "18", borderColor: cs.accent + "50" }}>
              <p className="font-bold text-sm" style={{ color: cs.accent }}>{data.callToAction}</p>
            </div>
          )}
        </div>
      )}

      {/* ── REVISTA: titular izquierda, puntos en grid ────────────── */}
      {tpl === "Revista" && (
        <div className="rounded-2xl overflow-hidden border border-soft" style={{ background: cs.bg }}>
          <div className="flex">
            {/* Columna izquierda: titular */}
            <div className="w-2/5 p-7 flex flex-col justify-between relative overflow-hidden"
              style={{ background: `linear-gradient(160deg,${cs.accent}30,${cs.accent}08)`, borderRight: `1px solid ${cs.accent}25` }}>
              <div className="absolute inset-0 opacity-20"
                style={{ backgroundImage: `radial-gradient(ellipse at 0% 50%,${cs.accent}80,transparent)` }} />
              <div className="relative z-10">
                <p className="text-[10px] font-bold tracking-widest mb-4" style={{ color: cs.accent }}>AFICHE EDUCATIVO</p>
                <h1 className="text-2xl font-black leading-tight mb-3" style={{ color: cs.text }}>{data.headline}</h1>
                {data.tagline && <p className="text-xs leading-relaxed" style={{ color: cs.sub }}>{data.tagline}</p>}
              </div>
              {data.callToAction && (
                <p className="relative z-10 text-xs font-bold mt-4" style={{ color: cs.accent }}>→ {data.callToAction}</p>
              )}
            </div>
            {/* Columna derecha: puntos */}
            <div className="flex-1 p-5 space-y-3">
              {(data.mainPoints || []).map((pt: any, i: number) => (
                <div key={i} className="flex gap-3 rounded-xl p-3 border" style={{ background: cs.cardBg, borderColor: cs.cardBorder }}>
                  <span className="text-xl flex-shrink-0">{pt.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-bold text-xs" style={{ color: cs.text }}>{pt.title}</h3>
                      {pt.stat && <span className="text-[10px] font-bold px-1.5 py-px rounded"
                        style={{ background: cs.accent + "22", color: cs.accent }}>{pt.stat}</span>}
                    </div>
                    <p className="text-[11px] leading-relaxed" style={{ color: cs.sub }}>{pt.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SPLIT: fondo dividido con cards prominentes ────────────── */}
      {tpl === "Split" && (
        <div className="rounded-2xl overflow-hidden border border-soft">
          {/* Header dividido */}
          <div className="flex" style={{ background: cs.accent }}>
            <div className="flex-1 px-8 py-8">
              <h1 className="text-3xl font-black leading-tight" style={{ color: cs.bg.includes("#fff") ? "#0f172a" : "white" }}>
                {data.headline}
              </h1>
              {data.tagline && <p className="mt-2 text-sm font-medium opacity-80" style={{ color: cs.bg.includes("#fff") ? "#374151" : "rgba(255,255,255,0.85)" }}>
                {data.tagline}
              </p>}
            </div>
          </div>

          {/* Body */}
          <div className="p-5 grid sm:grid-cols-2 gap-3" style={{ background: cs.bg }}>
            {(data.mainPoints || []).map((pt: any, i: number) => (
              <div key={i} className="rounded-2xl p-4 border relative overflow-hidden"
                style={{ background: cs.cardBg, borderColor: cs.cardBorder }}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="text-2xl">{pt.icon}</div>
                  <h3 className="font-bold text-sm" style={{ color: cs.text }}>{pt.title}</h3>
                </div>
                <p className="text-xs leading-relaxed mb-2" style={{ color: cs.sub }}>{pt.description}</p>
                {pt.stat && (
                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
                    style={{ background: cs.accent + "25", color: cs.accent }}>
                    ✦ {pt.stat}
                  </div>
                )}
              </div>
            ))}
          </div>

          {data.callToAction && (
            <div className="px-5 pb-5">
              <div className="rounded-2xl px-5 py-3 text-center border"
                style={{ background: cs.accent + "18", borderColor: cs.accent + "45" }}>
                <p className="font-bold text-sm" style={{ color: cs.accent }}>{data.callToAction}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIMELINE — 2 modos: vertical mejorado + tarjetas en grid
// ═══════════════════════════════════════════════════════════════════════════════
export function TimelineRenderer({ data }: { data: any }) {
  const [tpl, setTpl]     = useState("Línea")
  const [expanded, setExpanded] = useState<number | null>(null)
  const events: any[]     = data.events || []
  const IMP: Record<string, string> = { high: "#ef4444", medium: "#f59e0b", low: "#3b82f6" }
  const IMP_BG: Record<string, string> = { high: "#ef444418", medium: "#f59e0b18", low: "#3b82f618" }

  return (
    <div className="space-y-3">
      <div className="text-center">
        <h3 className="text-main font-bold text-sm">⏳ {data.title}</h3>
        {data.period && <p className="text-muted2 text-xs mt-0.5">{data.period}</p>}
      </div>

      <Tpl opts={["Línea","Tarjetas"]} val={tpl} onChange={setTpl} color="#f97316" />

      {/* ── LÍNEA VERTICAL ───────────────────────────────────────── */}
      {tpl === "Línea" && (
        <div className="relative pl-10">
          {/* Línea vertical degradada */}
          <div className="absolute left-4 top-3 bottom-3 w-0.5 rounded-full"
            style={{ background: "linear-gradient(to bottom,#3b82f6,#8b5cf6,#ec4899,#f97316)" }} />

          {events.map((evt: any, i: number) => {
            const color  = IMP[evt.importance] || IMP.low
            const isOpen = expanded === i
            return (
              <div key={i} className="mb-4 relative">
                {/* Dot */}
                <button
                  onClick={() => setExpanded(isOpen ? null : i)}
                  className="absolute -left-6 top-3.5 w-4 h-4 rounded-full border-2 border-card transition-all z-10"
                  style={{ background: color, boxShadow: isOpen ? `0 0 10px ${color}80` : "none",
                    transform: isOpen ? "scale(1.35)" : "scale(1)" }} />

                <div
                  onClick={() => setExpanded(isOpen ? null : i)}
                  className="rounded-2xl border cursor-pointer transition-all"
                  style={{
                    background: isOpen ? IMP_BG[evt.importance] : "rgba(255,255,255,0.025)",
                    borderColor: isOpen ? color + "50" : "var(--bg-card-soft)",
                  }}>
                  <div className="flex items-center gap-3 p-4">
                    <span className="text-xl flex-shrink-0">{evt.icon || "📅"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ background: color + "25", color }}>
                          {evt.date}
                        </span>
                        {evt.importance === "high" && (
                          <span className="text-[10px] text-red-400 font-semibold">★ Hito clave</span>
                        )}
                      </div>
                      <h4 className="text-main font-bold text-xs mt-1">{evt.title}</h4>
                    </div>
                    <span className="text-muted2 text-xs transition-transform" style={{ transform: isOpen ? "rotate(90deg)" : "none" }}>›</span>
                  </div>

                  {isOpen && (
                    <div className="px-4 pb-4 border-t" style={{ borderColor: "var(--bg-card-soft)" }}>
                      <p className="text-sub text-xs leading-relaxed mt-3">{evt.description}</p>
                      {evt.impact && (
                        <p className="mt-2 text-xs font-semibold" style={{ color }}>⚡ {evt.impact}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── TARJETAS ─────────────────────────────────────────────── */}
      {tpl === "Tarjetas" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {events.map((evt: any, i: number) => {
            const color = IMP[evt.importance] || IMP.low
            return (
              <div key={i} className="rounded-2xl overflow-hidden border border-soft">
                {/* Top color bar */}
                <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg,${color},${color}55)` }} />
                <div className="p-4" style={{ background: "rgba(255,255,255,0.025)" }}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{evt.icon || "📅"}</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: color + "25", color }}>
                        {evt.date}
                      </span>
                    </div>
                    {evt.importance === "high" && (
                      <span className="text-[10px] text-amber-400 font-bold flex-shrink-0">★ Clave</span>
                    )}
                  </div>
                  <h4 className="text-main font-bold text-xs mb-1.5">{evt.title}</h4>
                  <p className="text-muted2 text-[11px] leading-relaxed">{evt.description}</p>
                  {evt.impact && (
                    <p className="mt-2 text-[10px] font-semibold" style={{ color }}>⚡ {evt.impact}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PODCAST — sin cambios (ya estaba bien)
// ═══════════════════════════════════════════════════════════════════════════════
export function PodcastRenderer({ data }: { data: any }) {
  const segments: any[] = data.segments || []
  const total = segments.length

  // ── Audio state ────────────────────────────────────────────────────────
  const audioRef       = useRef<HTMLAudioElement>(null)
  const [audioUrl,     setAudioUrl]     = useState<string | null>(null)
  const [generating,   setGenerating]   = useState(false)
  const [genError,     setGenError]     = useState("")
  const [playing,      setPlaying]      = useState(false)
  const [currentTime,  setCurrentTime]  = useState(0)
  const [duration,     setDuration]     = useState(0)
  const [currentSeg,   setCurrentSeg]   = useState(0)

  // ── Estimated segment timestamps (by word count @ ~2.2 wps) ───────────
  const segTimestamps = useMemo(() => {
    const WPS = 2.2
    let cum = 0
    return segments.map((seg: any) => {
      const words = String(seg.text || "").split(/\s+/).filter(Boolean).length
      const dur   = Math.max(1.5, words / WPS + 0.4)
      const start = cum
      cum += dur
      return { start, end: cum, dur }
    })
  }, [segments])

  // ── Auto-generate audio on mount ──────────────────────────────────────
  useEffect(() => {
    if (segments.length === 0) return
    generateAudio()
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  }, []) // eslint-disable-line

  async function generateAudio() {
    setGenerating(true)
    setGenError("")
    try {
      const res = await fetch("/api/agents/tts-chunk", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ segments: segments.map((s: any) => ({ speaker: s.speaker, text: s.text })) }),
      })
      if (!res.ok) throw new Error(`TTS respondió ${res.status}`)
      const blob = await res.blob()
      if (blob.size < 1000) throw new Error("Audio demasiado pequeño, reintenta")
      const url = URL.createObjectURL(blob)
      setAudioUrl(url)
    } catch (e: any) {
      setGenError(e.message || "Error generando audio")
    } finally {
      setGenerating(false)
    }
  }

  // ── Audio element event handlers ──────────────────────────────────────
  function onTimeUpdate() {
    const t = audioRef.current?.currentTime || 0
    setCurrentTime(t)
    const idx = segTimestamps.findIndex((ts, i) =>
      t >= ts.start && (i === segTimestamps.length - 1 || t < segTimestamps[i + 1].start)
    )
    if (idx !== -1) setCurrentSeg(idx)
  }

  function onLoadedMetadata() {
    setDuration(audioRef.current?.duration || 0)
  }

  function onEnded() { setPlaying(false) }

  function togglePlay() {
    if (!audioRef.current) return
    if (playing) { audioRef.current.pause(); setPlaying(false) }
    else { audioRef.current.play(); setPlaying(true) }
  }

  function seekTo(e: React.MouseEvent<HTMLDivElement>) {
    if (!audioRef.current || !duration) return
    const rect  = e.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    audioRef.current.currentTime = ratio * duration
  }

  function skipToSegment(idx: number) {
    if (!audioRef.current) return
    audioRef.current.currentTime = segTimestamps[idx]?.start || 0
    setCurrentSeg(idx)
    audioRef.current.play()
    setPlaying(true)
  }

  function formatTime(s: number) {
    if (!isFinite(s)) return "0:00"
    const m = Math.floor(s / 60), sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, "0")}`
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const BARS     = 48


  return (
    <div className="space-y-4">

      {/* ── Hidden real audio element ─────────────────────────────── */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={onLoadedMetadata}
          onEnded={onEnded}
          style={{ display: "none" }}
        />
      )}

      {/* ── Cover + title ─────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <div
          className="w-16 h-16 rounded-2xl flex-shrink-0 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}
        >
          <div className="absolute inset-0 flex items-center justify-center text-3xl">🎙️</div>
          {playing && (
            <div className="absolute inset-0 flex items-end justify-center gap-[2px] pb-1.5 px-1.5">
              {[0,1,2,3].map(i => (
                <div key={i} className="w-1 rounded-full bg-white/60 animate-bounce"
                  style={{ height: 4 + i * 3, animationDelay: `${i * 80}ms` }} />
              ))}
            </div>
          )}
          {!playing && <div className="absolute bottom-1 right-1 w-2.5 h-2.5 bg-red-400 rounded-full animate-pulse" />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-main font-bold text-sm leading-tight">{data.title}</h3>
          <p className="text-muted2 text-xs mt-0.5">EduAI Podcast · {data.duration || `${total} segmentos`}</p>
          <div className="flex gap-2 mt-1.5">
            <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-medium">🎙 Álvaro</span>
            <span className="text-[10px] bg-pink-500/10 text-pink-400 border border-pink-500/20 px-2 py-0.5 rounded-full font-medium">🎙 Elvira</span>
          </div>
        </div>
      </div>

      {/* ── Player ────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-soft p-4 space-y-3" style={{ background: "var(--bg-header)" }}>

        {/* Generation state */}
        {generating && (
          <div className="flex items-center gap-2.5 py-1">
            <div className="flex gap-1 items-end h-5">
              {[0,1,2,3,4].map(i => (
                <div key={i} className="w-1 rounded-full bg-amber-400/70 animate-bounce"
                  style={{ height: 8 + Math.abs(Math.sin(i)) * 8, animationDelay: `${i * 100}ms` }} />
              ))}
            </div>
            <p className="text-amber-400 text-xs font-medium">Generando voces con Edge TTS…</p>
          </div>
        )}

        {genError && (
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-red-400">⚠ {genError}</span>
            <button onClick={generateAudio} className="text-amber-400 hover:text-amber-300 font-semibold underline">Reintentar</button>
          </div>
        )}

        {/* Waveform */}
        <div
          onClick={seekTo}
          className={`flex items-end gap-[1.5px] h-10 ${audioUrl ? "cursor-pointer" : "pointer-events-none"}`}
        >
          {Array.from({ length: BARS }, (_, i) => {
            const filled = i / BARS <= progress / 100
            const h = Math.max(0.12, Math.abs(Math.sin(i * 127.1 + 311.7) * 0.5 + 0.5))
            return (
              <div key={i} className="flex-1 rounded-full transition-all duration-75"
                style={{
                  height:     `${h * 100}%`,
                  background: filled ? "linear-gradient(to top,#3b82f6,#8b5cf6)" : "var(--border-soft)",
                  opacity:    filled ? 1 : 0.5,
                }} />
            )
          })}
        </div>

        {/* Progress bar (click to seek) */}
        <div onClick={seekTo} className={`h-1 rounded-full overflow-hidden ${audioUrl ? "cursor-pointer" : ""}`} style={{ background: "var(--border-soft)" }}>
          <div className="h-full rounded-full transition-all duration-200"
            style={{ width: `${progress}%`, background: "linear-gradient(90deg,#3b82f6,#8b5cf6)" }} />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Skip back */}
          <button
            onClick={() => { if (audioRef.current) { audioRef.current.currentTime = Math.max(0, currentTime - 10); } }}
            disabled={!audioUrl}
            className="w-7 h-7 rounded-full bg-card-soft-theme hover:bg-input-theme flex items-center justify-center text-xs text-sub transition disabled:opacity-30"
            title="−10s"
          >⏪</button>

          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            disabled={!audioUrl || generating}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold transition-all disabled:opacity-30 disabled:scale-100 hover:scale-105"
            style={{ background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", boxShadow: audioUrl ? "0 0 15px rgba(59,130,246,0.4)" : "none" }}
          >
            {generating ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : playing ? "⏸" : "▶"}
          </button>

          {/* Skip forward */}
          <button
            onClick={() => { if (audioRef.current) { audioRef.current.currentTime = Math.min(duration, currentTime + 10); } }}
            disabled={!audioUrl}
            className="w-7 h-7 rounded-full bg-card-soft-theme hover:bg-input-theme flex items-center justify-center text-xs text-sub transition disabled:opacity-30"
            title="+10s"
          >⏩</button>

          {/* Time */}
          <span className="text-muted2 text-xs tabular-nums ml-1">
            {formatTime(currentTime)} / {formatTime(duration || segTimestamps.reduce((s, t) => s + t.dur, 0))}
          </span>

          {/* Segment counter */}
          <span className="text-muted2 text-xs ml-auto">{currentSeg + 1} / {total}</span>
        </div>
      </div>

      {/* ── Transcript segments ────────────────────────────────────── */}
      <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
        {segments.map((seg: any, i: number) => {
          const isA      = seg.speaker === "A"
          const isActive = i === currentSeg && playing
          return (
            <div
              key={i}
              onClick={() => audioUrl && skipToSegment(i)}
              className={`flex gap-3 p-3 rounded-2xl border transition-all ${audioUrl ? "cursor-pointer" : "cursor-default"}
                ${isActive
                  ? isA ? "bg-blue-500/10 border-blue-500/25" : "bg-pink-500/10 border-pink-500/25"
                  : i === currentSeg
                  ? isA ? "bg-blue-500/5 border-blue-500/15" : "bg-pink-500/5 border-pink-500/15"
                  : "bg-card-soft-theme border-transparent hover:bg-input-theme"
                }`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0
                ${isA ? "bg-blue-500/20 text-blue-400" : "bg-pink-500/20 text-pink-400"}`}>
                {isA ? "A" : "B"}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[10px] font-semibold mb-0.5 ${isA ? "text-blue-400" : "text-pink-400"}`}>
                  {isA ? "Álvaro" : "Elvira"}
                </p>
                <p className="text-sub text-xs leading-relaxed">{seg.text}</p>
              </div>
              {isActive && (
                <div className="flex-shrink-0 flex gap-0.5 items-end self-center">
                  {[0, 1, 2].map(d => (
                    <div key={d} className="w-1 rounded-full animate-bounce"
                      style={{ height: 8 + d * 3, background: isA ? "#3b82f6" : "#ec4899", animationDelay: `${d * 100}ms` }} />
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

// ═══════════════════════════════════════════════════════════════════════════════
// FLASHCARDS — sin cambios significativos
// ═══════════════════════════════════════════════════════════════════════════════
export function FlashcardsRenderer({ data }: { data: any }) {
  const [idx, setIdx]     = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [correct, setCorrect] = useState<Set<number>>(new Set())
  const cards = data.cards || []
  const card  = cards[idx]
  if (!card) return null

  function mark(ok: boolean) {
    if (ok) setCorrect(c => new Set([...c, idx]))
    const next = idx < cards.length - 1 ? idx + 1 : 0
    setIdx(next); setFlipped(false)
  }

  return (
    <div className="text-center space-y-4">
      <div className="flex items-center justify-between px-1">
        <span className="text-blue-400 font-bold text-sm">{data.deckTitle}</span>
        <div className="flex items-center gap-3">
          <span className="text-green-400 text-xs font-semibold">{correct.size} / {cards.length}</span>
          <span className="text-muted2 text-xs bg-card-soft-theme rounded-full px-3 py-1">{idx + 1} / {cards.length}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1 bg-card-soft-theme rounded-full">
        <div className="h-1 bg-green-400 rounded-full transition-all" style={{ width: `${(correct.size / cards.length) * 100}%` }} />
      </div>

      <div onClick={() => setFlipped(!flipped)}
        className={`min-h-[200px] rounded-2xl p-7 cursor-pointer border-2 transition-all flex flex-col items-center justify-center select-none ${
          flipped ? "bg-green-500/[0.06] border-green-500/25" : "bg-blue-500/[0.06] border-blue-500/20"
        }`}>
        <span className={`text-[10px] font-bold tracking-widest mb-4 px-3 py-1 rounded-full ${flipped ? "bg-green-500/12 text-green-400" : "bg-blue-500/12 text-blue-400"}`}>
          {flipped ? "↩ RESPUESTA" : "PREGUNTA — toca para ver"}
        </span>
        <p className="text-main font-semibold text-base leading-relaxed">{flipped ? card.back : card.front}</p>
        {card.hint && !flipped && <p className="text-muted2 text-xs mt-3 italic">💡 {card.hint}</p>}
        {flipped && card.mnemonic && <p className="text-amber-400/70 text-xs mt-3 italic">🧠 {card.mnemonic}</p>}
        {card.difficulty && (
          <div className="flex gap-1 mt-3">
            {[1, 2, 3].map(d => <div key={d} className={`w-2 h-2 rounded-full ${d <= card.difficulty ? "bg-yellow-400" : "bg-card-soft-theme"}`} />)}
          </div>
        )}
      </div>

      {flipped ? (
        <div className="flex gap-3 justify-center">
          <button onClick={() => mark(false)} className="flex-1 max-w-[140px] py-2.5 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm font-semibold hover:bg-red-500/20 transition-all">✗ Repasar</button>
          <button onClick={() => mark(true)} className="flex-1 max-w-[140px] py-2.5 rounded-2xl border border-green-500/30 bg-green-500/10 text-green-400 text-sm font-semibold hover:bg-green-500/20 transition-all">✓ Domino</button>
        </div>
      ) : (
        <div className="flex justify-center gap-2">
          <button onClick={() => { setIdx(Math.max(0, idx - 1)); setFlipped(false) }} disabled={idx === 0}
            className="px-4 py-2 rounded-xl border border-soft text-muted2 text-sm disabled:opacity-30 hover:border-medium hover:text-sub transition-all">← Ant.</button>
          <button onClick={() => { setIdx(Math.min(cards.length - 1, idx + 1)); setFlipped(false) }} disabled={idx === cards.length - 1}
            className="px-4 py-2 rounded-xl bg-blue-600/20 border border-blue-500/20 text-blue-400 text-sm disabled:opacity-30 hover:bg-blue-600/30 transition-all">Sig. →</button>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUIZ — sin cambios
// ═══════════════════════════════════════════════════════════════════════════════
export function QuizRenderer({ data }: { data: any }) {
  const [qIdx, setQIdx]       = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [done, setDone]       = useState(false)
  const questions             = data.questions || []
  const q                     = questions[qIdx]
  const score                 = Object.keys(answers).reduce((acc, k) => {
    const i = Number(k)
    return acc + (answers[i] === questions[i]?.correctAnswer ? 1 : 0)
  }, 0)

  if (done) {
    const pct = score / questions.length
    return (
      <div className="text-center py-8 space-y-4">
        <div className="text-6xl">{pct >= 0.7 ? "🏆" : pct >= 0.4 ? "📚" : "💪"}</div>
        <h3 className="text-3xl font-extrabold text-main">{score} <span className="text-muted2">/ {questions.length}</span></h3>
        <div className="w-full bg-card-soft-theme rounded-full h-2 max-w-xs mx-auto">
          <div className="h-2 rounded-full transition-all duration-700"
            style={{ width: `${(score / questions.length) * 100}%`, background: pct >= 0.7 ? "#22c55e" : pct >= 0.4 ? "#f59e0b" : "#ef4444" }} />
        </div>
        <p className="text-sub text-sm">{pct >= 0.7 ? "¡Excelente dominio!" : pct >= 0.4 ? "Buen progreso, sigue repasando" : "Repasa y vuelve a intentar"}</p>
        <button onClick={() => { setAnswers({}); setQIdx(0); setDone(false) }}
          className="mt-2 px-6 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-main text-sm font-semibold transition-colors">
          Reintentar
        </button>
      </div>
    )
  }

  if (!q) return null
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div className="flex gap-1">
          {questions.map((_: any, i: number) => (
            <div key={i} className={`h-1 rounded-full transition-all ${i === qIdx ? "w-6 bg-blue-400" : answers[i] !== undefined ? "w-3 bg-green-400/60" : "w-3 bg-card-soft-theme"}`} />
          ))}
        </div>
        <span className="text-blue-400 text-xs font-semibold">{score} pts</span>
      </div>

      <div className="bg-card-soft-theme border border-soft rounded-2xl p-5">
        <p className="text-xs text-muted2 mb-2">Pregunta {qIdx + 1} de {questions.length}</p>
        <p className="text-main font-semibold text-sm leading-relaxed">{q.question}</p>
      </div>

      <div className="space-y-2">
        {(q.options || []).map((opt: string, i: number) => {
          const answered = answers[qIdx] !== undefined
          const selected = answers[qIdx] === i
          const correct  = i === q.correctAnswer
          let cls = "bg-card-soft-theme border-soft hover:bg-input-theme cursor-pointer"
          if (answered && correct)          cls = "bg-green-500/10 border-green-500/30 cursor-default"
          else if (answered && selected)    cls = "bg-red-500/10 border-red-500/30 cursor-default"
          else if (answered)                cls = "bg-card-soft-theme border-soft opacity-50 cursor-default"
          return (
            <button key={i} onClick={() => !answered && setAnswers({ ...answers, [qIdx]: i })}
              className={`w-full text-left p-3.5 rounded-2xl border text-sm transition-all ${cls}`}>
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: answered && correct ? "rgba(34,197,94,0.2)" : answered && selected ? "rgba(239,68,68,0.2)" : "var(--bg-card-soft)" }}>
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="text-sub flex-1">{opt}</span>
                {answered && correct  && <span>✅</span>}
                {answered && selected && !correct && <span>❌</span>}
              </div>
            </button>
          )
        })}
      </div>

      {answers[qIdx] !== undefined && q.explanation && (
        <div className="bg-blue-500/[0.06] border-l-2 border-blue-500/50 rounded-xl p-3">
          <p className="text-sub text-xs">💡 {q.explanation}</p>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        {qIdx > 0 && (
          <button onClick={() => setQIdx(qIdx - 1)} className="px-3 py-2 rounded-xl border border-soft text-muted2 text-xs hover:border-medium hover:text-sub transition-all">← Ant.</button>
        )}
        {qIdx < questions.length - 1 ? (
          <button onClick={() => setQIdx(qIdx + 1)} disabled={answers[qIdx] === undefined}
            className="px-4 py-2 rounded-xl bg-blue-600/80 hover:bg-blue-500 text-main text-xs font-semibold disabled:opacity-30 transition-colors">Siguiente →</button>
        ) : (
          <button onClick={() => setDone(true)} disabled={answers[qIdx] === undefined}
            className="px-4 py-2 rounded-xl bg-green-600/80 hover:bg-green-500 text-main text-xs font-semibold disabled:opacity-30 transition-colors">Ver resultado 🏆</button>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// NUEVOS RENDERERS v2 — Cornell, Glosario, Cuento, Canción, Plan de Clase
// ─────────────────────────────────────────────────────────────────────────
// 1. Añade estas funciones a: components/creator-hub/renderers.tsx
// 2. Añade las nuevas entradas a FORMAT_META en: app/creator-hub/[format]/page.tsx
// 3. Actualiza el map RENDERERS al final de renderers.tsx
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────
// CORNELL NOTES RENDERER
// data shape: { title, subject, date, mainNotes: [{topic, notes}], summary, keywords[] }
// ─────────────────────────────────────────────────────────────────────────
export function CornellRenderer({ data }: { data: any }) {
  const notes: any[] = data.mainNotes || []
  return (
    <div className="space-y-3 font-mono text-xs">
      {/* Header */}
      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-main font-bold text-sm">{data.title}</p>
          <p className="text-muted2 text-[11px] mt-0.5">{data.subject} · {data.date || "Hoy"}</p>
        </div>
        <span className="text-violet-400 text-2xl">📓</span>
      </div>

      {/* Cornell grid */}
      <div className="rounded-2xl border border-soft overflow-hidden" style={{ background: "rgba(255,255,255,0.02)" }}>
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_2fr] border-b border-soft">
          <div className="px-3 py-2 border-r border-soft text-violet-400 font-bold text-[10px] tracking-widest">PREGUNTAS / PALABRAS CLAVE</div>
          <div className="px-3 py-2 text-blue-400 font-bold text-[10px] tracking-widest">APUNTES</div>
        </div>

        {/* Rows */}
        {notes.map((row: any, i: number) => (
          <div key={i} className={`grid grid-cols-[1fr_2fr] border-b border-soft/50 ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
            <div className="px-3 py-3 border-r border-soft/50">
              <p className="text-violet-300 font-semibold text-[11px] leading-relaxed">{row.topic}</p>
            </div>
            <div className="px-3 py-3">
              <p className="text-sub text-[11px] leading-relaxed whitespace-pre-line">{row.notes}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Summary box */}
      {data.summary && (
        <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 px-4 py-3">
          <p className="text-violet-400 font-bold text-[10px] tracking-widest mb-2">▸ RESUMEN</p>
          <p className="text-sub text-xs leading-relaxed">{data.summary}</p>
        </div>
      )}

      {/* Keywords */}
      {Array.isArray(data.keywords) && data.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.keywords.map((kw: string, i: number) => (
            <span key={i} className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-violet-500/20 bg-violet-500/8 text-violet-300">
              {kw}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// GLOSSARY RENDERER
// data shape: { title, subject, terms: [{term, definition, example?, category?}] }
// ─────────────────────────────────────────────────────────────────────────
export function GlossaryRenderer({ data }: { data: any }) {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("Todos")
  const terms: any[] = data.terms || []

  const categories = ["Todos", ...Array.from(new Set(terms.map(t => t.category).filter(Boolean)))]

  const filtered = terms.filter(t => {
    const matchSearch = !search || t.term.toLowerCase().includes(search.toLowerCase()) || t.definition.toLowerCase().includes(search.toLowerCase())
    const matchCat    = filter === "Todos" || t.category === filter
    return matchSearch && matchCat
  })

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-emerald-400 font-bold text-sm">📖 {data.title}</h3>
        <span className="text-muted2 text-xs">{filtered.length} / {terms.length} términos</span>
      </div>

      {/* Search + filter */}
      <div className="flex gap-2">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar término..."
          className="flex-1 bg-card-soft-theme border border-soft rounded-xl px-3 py-2 text-main text-xs placeholder:text-muted2 focus:outline-none focus:border-emerald-500/40"
        />
      </div>

      {categories.length > 2 && (
        <div className="flex gap-1.5 overflow-x-auto">
          {categories.map(c => (
            <button key={c} onClick={() => setFilter(c)}
              className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition border ${filter === c ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-card-soft-theme border-soft text-muted2 hover:text-sub"}`}>
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Terms */}
      <div className="space-y-2">
        {filtered.map((t: any, i: number) => (
          <div key={i} className="rounded-2xl border border-soft bg-card-soft-theme p-3.5">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <span className="text-main font-bold text-sm">{t.term}</span>
              {t.category && (
                <span className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  {t.category}
                </span>
              )}
            </div>
            <p className="text-sub text-xs leading-relaxed">{t.definition}</p>
            {t.example && (
              <p className="mt-2 text-[11px] text-muted2 italic border-t border-soft/50 pt-2">
                💡 Ej: {t.example}
              </p>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-muted2 text-sm py-8">No se encontraron términos</p>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// STORY RENDERER
// data shape: { title, subject, moral, characters: [{name, role}], chapters: [{title, content}] }
// ─────────────────────────────────────────────────────────────────────────
export function StoryRenderer({ data }: { data: any }) {
  const [chapterIdx, setChapterIdx] = useState(0)
  const chapters: any[] = data.chapters || []
  const chapter = chapters[chapterIdx]

  return (
    <div className="space-y-4">
      {/* Book cover */}
      <div className="rounded-2xl p-5 text-center"
        style={{ background: "linear-gradient(135deg,rgba(248,113,113,0.1),rgba(251,146,60,0.1))", border: "1px solid rgba(248,113,113,0.2)" }}>
        <div className="text-4xl mb-2">📚</div>
        <h3 className="text-main font-bold text-base">{data.title}</h3>
        {data.subject && <p className="text-muted2 text-xs mt-1">Tema: {data.subject}</p>}
        {data.characters?.length > 0 && (
          <div className="flex justify-center gap-2 mt-3 flex-wrap">
            {data.characters.map((c: any, i: number) => (
              <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-300">
                {c.name} · <span className="opacity-70">{c.role}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Chapter navigation */}
      {chapters.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto">
          {chapters.map((_: any, i: number) => (
            <button key={i} onClick={() => setChapterIdx(i)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition border ${i === chapterIdx ? "bg-red-500/15 border-red-500/30 text-red-300" : "bg-card-soft-theme border-soft text-muted2 hover:text-sub"}`}>
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Chapter content */}
      {chapter && (
        <div className="rounded-2xl border border-soft p-5 space-y-3" style={{ background: "rgba(255,255,255,0.02)" }}>
          {chapter.title && <h4 className="text-red-300 font-bold text-sm">{chapter.title}</h4>}
          <p className="text-sub text-sm leading-loose whitespace-pre-line">{chapter.content}</p>
        </div>
      )}

      {/* Moral */}
      {data.moral && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <p className="text-amber-400 font-bold text-[10px] tracking-widest mb-1.5">🌟 MORALEJA</p>
          <p className="text-sub text-sm leading-relaxed italic">{data.moral}</p>
        </div>
      )}

      {/* Navigation buttons */}
      {chapters.length > 1 && (
        <div className="flex justify-between gap-2 pt-1">
          <button onClick={() => setChapterIdx(i => Math.max(0, i - 1))} disabled={chapterIdx === 0}
            className="px-4 py-2 rounded-xl border border-soft text-muted2 text-xs disabled:opacity-30 hover:text-sub transition">← Ant.</button>
          <button onClick={() => setChapterIdx(i => Math.min(chapters.length - 1, i + 1))} disabled={chapterIdx === chapters.length - 1}
            className="px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/25 text-red-300 text-xs disabled:opacity-30 hover:bg-red-500/25 transition">Sig. →</button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// SONG / RAP RENDERER
// data shape: { title, subject, style, verses: [{label, lines[]}], chorus?: {lines[]}, tip? }
// ─────────────────────────────────────────────────────────────────────────
export function SongRenderer({ data }: { data: any }) {
  const verses: any[] = data.verses || []

  return (
    <div className="space-y-4">
      {/* Cover */}
      <div className="rounded-2xl p-4 flex items-center gap-4"
        style={{ background: "linear-gradient(135deg,rgba(251,146,60,0.1),rgba(250,204,21,0.1))", border: "1px solid rgba(251,146,60,0.2)" }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
          style={{ background: "linear-gradient(135deg,#f97316,#eab308)" }}>
          🎵
        </div>
        <div>
          <h3 className="text-main font-bold text-sm">{data.title}</h3>
          <p className="text-muted2 text-xs mt-0.5">{data.subject}</p>
          {data.style && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/20 text-orange-300 font-medium mt-1 inline-block">
              {data.style}
            </span>
          )}
        </div>
      </div>

      {/* Chorus */}
      {data.chorus && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/8 p-4">
          <p className="text-amber-400 font-bold text-[10px] tracking-widest mb-2">🔁 CORO</p>
          <div className="space-y-1">
            {(data.chorus.lines || []).map((line: string, i: number) => (
              <p key={i} className="text-main text-sm leading-relaxed font-medium">{line}</p>
            ))}
          </div>
        </div>
      )}

      {/* Verses */}
      {verses.map((verse: any, i: number) => (
        <div key={i} className="space-y-1.5">
          <p className="text-orange-400 font-bold text-[10px] tracking-widest">{verse.label || `ESTROFA ${i + 1}`}</p>
          <div className="rounded-2xl border border-soft bg-card-soft-theme p-4 space-y-1">
            {(verse.lines || []).map((line: string, j: number) => (
              <p key={j} className="text-sub text-sm leading-relaxed">{line}</p>
            ))}
          </div>
        </div>
      ))}

      {/* Mnemonic tip */}
      {data.tip && (
        <div className="rounded-xl border border-soft bg-card-soft-theme px-4 py-3">
          <p className="text-muted2 text-xs leading-relaxed">💡 <span className="text-sub">{data.tip}</span></p>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// LESSON PLAN RENDERER
// data shape: { title, subject, grade, duration, objective, bloom, phases: [{name, duration, activity, materials, notes}], assessment, resources[] }
// ─────────────────────────────────────────────────────────────────────────
export function LessonPlanRenderer({ data }: { data: any }) {
  const phases: any[] = data.phases || []
  const COLORS: Record<string, string> = {
    "Inicio":      "#3b82f6",
    "Desarrollo":  "#8b5cf6",
    "Cierre":      "#10b981",
    "Evaluación":  "#f59e0b",
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl p-4 border border-blue-500/20 bg-blue-500/5 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-main font-bold text-sm">{data.title}</h3>
            <p className="text-muted2 text-xs mt-0.5">{data.subject} · {data.grade}</p>
          </div>
          <span className="text-3xl">🗒️</span>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-soft/50">
          <div>
            <p className="text-muted2 text-[10px]">Duración</p>
            <p className="text-main text-xs font-semibold">{data.duration || "45 min"}</p>
          </div>
          <div>
            <p className="text-muted2 text-[10px]">Nivel Bloom</p>
            <p className="text-blue-300 text-xs font-semibold">{data.bloom || "-"}</p>
          </div>
        </div>
        {data.objective && (
          <div className="pt-2 border-t border-soft/50">
            <p className="text-muted2 text-[10px] mb-1">Objetivo de aprendizaje</p>
            <p className="text-sub text-xs leading-relaxed">{data.objective}</p>
          </div>
        )}
      </div>

      {/* Phases timeline */}
      <div className="space-y-2.5">
        <p className="text-muted2 text-[10px] font-semibold tracking-widest">FASES DE LA CLASE</p>
        {phases.map((phase: any, i: number) => {
          const color = COLORS[phase.name] || "#6b7280"
          return (
            <div key={i} className="flex gap-3 items-start">
              <div className="flex flex-col items-center flex-shrink-0">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold" style={{ background: color }}>
                  {i + 1}
                </div>
                {i < phases.length - 1 && (
                  <div className="w-0.5 h-4 mt-1 rounded" style={{ background: color + "40" }} />
                )}
              </div>
              <div className="flex-1 rounded-2xl border border-soft bg-card-soft-theme p-3.5 -mt-0.5">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-bold" style={{ color }}>{phase.name}</span>
                  <span className="text-muted2 text-[10px]">{phase.duration}</span>
                </div>
                <p className="text-sub text-xs leading-relaxed">{phase.activity}</p>
                {phase.materials && (
                  <p className="mt-1.5 text-[11px] text-muted2">🔧 {phase.materials}</p>
                )}
                {phase.notes && (
                  <p className="mt-1.5 text-[11px] text-amber-400/70 italic">📌 {phase.notes}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Assessment */}
      {data.assessment && (
        <div className="rounded-2xl border border-green-500/20 bg-green-500/5 px-4 py-3">
          <p className="text-green-400 font-bold text-[10px] tracking-widest mb-1.5">📋 EVALUACIÓN</p>
          <p className="text-sub text-xs leading-relaxed">{data.assessment}</p>
        </div>
      )}

      {/* Resources */}
      {Array.isArray(data.resources) && data.resources.length > 0 && (
        <div className="rounded-2xl border border-soft bg-card-soft-theme px-4 py-3">
          <p className="text-muted2 font-bold text-[10px] tracking-widest mb-2">📎 RECURSOS</p>
          <ul className="space-y-1">
            {data.resources.map((r: string, i: number) => (
              <li key={i} className="text-sub text-xs flex items-start gap-1.5">
                <span className="text-muted2 mt-0.5">·</span>{r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── Mapa de renderers ────────────────────────────────────────────────────────
export const RENDERERS: Record<string, React.FC<{ data: any }>> = {
  infographic: InfographicRenderer,
  ppt:         PPTRenderer,
  poster:      PosterRenderer,
  podcast:     PodcastRenderer,
  mindmap:     MindmapRenderer,
  flashcards:  FlashcardsRenderer,
  quiz:        QuizRenderer,
  timeline:    TimelineRenderer,
  cornell:     CornellRenderer,
  glossary:    GlossaryRenderer,
  story:       StoryRenderer,
  song:        SongRenderer,
  lessonplan:  LessonPlanRenderer,
}
