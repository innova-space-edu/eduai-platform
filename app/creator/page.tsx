// src/app/creator/page.tsx
"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"

// ============================================================
// SIDEBAR (mismo patrón que dashboard)
// ============================================================

const NAV_LINKS = [
  { href: "/dashboard", icon: "🏠", label: "Inicio" },
  { href: "/agentes",   icon: "🤖", label: "Agentes" },
  { href: "/sessions",  icon: "📚", label: "Sesiones" },
  { href: "/galeria",   icon: "🖼️", label: "Galería" },
  { href: "/ranking",   icon: "🏆", label: "Ranking" },
  { href: "/chat",      icon: "💬", label: "Chat" },
  { href: "/collab",    icon: "🤝", label: "Colaborar" },
  { href: "/creator",   icon: "✨", label: "Creator" },
  { href: "/profile",   icon: "👤", label: "Perfil" },
]

// ============================================================
// OUTPUT FORMAT CONFIG
// ============================================================

const OUTPUT_FORMATS = [
  { id: "infographic", icon: "📊", label: "Infografía",    desc: "Visual con datos clave" },
  { id: "ppt",         icon: "📑", label: "Presentación",  desc: "Slides descargables" },
  { id: "poster",      icon: "🎨", label: "Afiche",        desc: "Poster visual" },
  { id: "podcast",     icon: "🎙️", label: "Podcast",       desc: "Audio conversacional" },
  { id: "mindmap",     icon: "🧠", label: "Mapa Mental",   desc: "Conceptos conectados" },
  { id: "flashcards",  icon: "📇", label: "Flashcards",    desc: "Tarjetas de estudio" },
  { id: "quiz",        icon: "✅", label: "Quiz",           desc: "Evaluación adaptativa" },
  { id: "timeline",    icon: "⏳", label: "Timeline",       desc: "Línea temporal" },
]

const SOURCE_TYPES = [
  { id: "topic", icon: "💡", label: "Tema" },
  { id: "text",  icon: "📝", label: "Texto" },
  { id: "url",   icon: "🔗", label: "URL" },
  { id: "pdf",   icon: "📄", label: "PDF" },
  { id: "docx",  icon: "📎", label: "DOCX" },
]

// ============================================================
// RENDERERS
// ============================================================

function InfographicRenderer({ data }: { data: any }) {
  const schemes: Record<string, { accent: string; light: string }> = {
    blue:   { accent: "#3b82f6", light: "rgba(59,130,246,0.08)" },
    green:  { accent: "#22c55e", light: "rgba(34,197,94,0.08)" },
    purple: { accent: "#a855f7", light: "rgba(168,85,247,0.08)" },
    orange: { accent: "#f97316", light: "rgba(249,115,22,0.08)" },
    red:    { accent: "#ef4444", light: "rgba(239,68,68,0.08)" },
  }
  const c = schemes[data.colorScheme] || schemes.blue

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-xl font-bold text-white">{data.title}</h2>
        {data.subtitle && <p className="text-gray-500 text-sm mt-1">{data.subtitle}</p>}
      </div>
      {data.keyFact && (
        <div className="rounded-2xl p-4 text-center border" style={{ background: c.light, borderColor: c.accent + "30" }}>
          <span className="text-sm font-bold" style={{ color: c.accent }}>💡 {data.keyFact}</span>
        </div>
      )}
      {(data.sections || []).map((sec: any, i: number) => (
        <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{sec.icon || "📌"}</span>
            <h3 className="text-sm font-bold text-gray-200">{sec.heading}</h3>
          </div>
          <ul className="space-y-1 ml-1">
            {(sec.points || []).map((p: string, j: number) => (
              <li key={j} className="text-gray-400 text-xs flex gap-2">
                <span style={{ color: c.accent }}>•</span>{p}
              </li>
            ))}
          </ul>
          {sec.stat && (
            <div className="mt-2 inline-block rounded-lg px-3 py-1" style={{ background: c.light }}>
              <span className="text-lg font-extrabold" style={{ color: c.accent }}>{sec.stat.value}</span>
              <span className="text-gray-500 text-xs ml-2">{sec.stat.label}</span>
            </div>
          )}
        </div>
      ))}
      {data.conclusion && (
        <p className="text-center text-gray-500 text-xs border-t border-white/5 pt-3">{data.conclusion}</p>
      )}
    </div>
  )
}

function PodcastRenderer({ data }: { data: any }) {
  const [current, setCurrent] = useState(0)
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-2xl">🎙️</div>
        <div>
          <h3 className="text-white font-bold text-sm">{data.title}</h3>
          <p className="text-gray-600 text-xs">EduAI Podcast • {data.duration || "5 min"}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 bg-white/[0.03] rounded-2xl p-3">
        <button className="w-9 h-9 rounded-full bg-red-500 flex items-center justify-center text-white text-sm flex-shrink-0">▶</button>
        <div className="flex-1 flex items-end gap-[2px] h-6 overflow-hidden">
          {Array.from({ length: 50 }, (_, i) => (
            <div key={i} className="w-[3px] rounded-sm transition-all" style={{
              height: `${Math.random() * 16 + 6}px`,
              background: i < current ? "#ef4444" : "rgba(255,255,255,0.1)",
            }} />
          ))}
        </div>
      </div>
      <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
        {(data.segments || []).map((seg: any, i: number) => (
          <div key={i} onClick={() => setCurrent(Math.floor((i / data.segments.length) * 50))}
            className="flex gap-2 p-2 rounded-xl cursor-pointer hover:bg-white/[0.03] transition-colors">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
              seg.speaker === "A" ? "bg-blue-500/20 text-blue-400" : "bg-yellow-500/20 text-yellow-400"
            }`}>{seg.speaker}</div>
            <p className="text-gray-400 text-xs leading-relaxed">{seg.text}</p>
          </div>
        ))}
      </div>
      <p className="text-center text-gray-700 text-[10px]">⚡ Audio TTS con Kokoro / ElevenLabs (próximamente)</p>
    </div>
  )
}

function FlashcardsRenderer({ data }: { data: any }) {
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const cards = data.cards || []
  const card = cards[idx]
  if (!card) return null

  return (
    <div className="text-center space-y-4">
      <h3 className="text-blue-400 font-bold text-sm">{data.deckTitle}</h3>
      <p className="text-gray-600 text-xs">{idx + 1} / {cards.length}</p>
      <div onClick={() => setFlipped(!flipped)}
        className={`min-h-[200px] rounded-3xl p-7 cursor-pointer border transition-all flex flex-col items-center justify-center ${
          flipped
            ? "bg-green-500/[0.06] border-green-500/20"
            : "bg-blue-500/[0.06] border-blue-500/20"
        }`}>
        <span className="text-[10px] text-gray-600 font-semibold tracking-widest mb-2">
          {flipped ? "RESPUESTA" : "PREGUNTA"} — toca para voltear
        </span>
        <p className="text-white font-semibold text-base leading-relaxed">
          {flipped ? card.back : card.front}
        </p>
        {card.difficulty && (
          <div className="flex gap-1 mt-3">
            {[1, 2, 3].map(d => (
              <div key={d} className={`w-2 h-2 rounded-full ${d <= card.difficulty ? "bg-yellow-400" : "bg-white/10"}`} />
            ))}
          </div>
        )}
      </div>
      <div className="flex justify-center gap-2">
        <button onClick={() => { setIdx(Math.max(0, idx - 1)); setFlipped(false) }} disabled={idx === 0}
          className="px-4 py-2 rounded-xl border border-white/10 text-gray-500 text-sm disabled:opacity-30">← Anterior</button>
        <button onClick={() => { setIdx(Math.min(cards.length - 1, idx + 1)); setFlipped(false) }} disabled={idx === cards.length - 1}
          className="px-4 py-2 rounded-xl bg-blue-600/20 border border-blue-500/20 text-blue-400 text-sm disabled:opacity-30">Siguiente →</button>
      </div>
    </div>
  )
}

function QuizRenderer({ data }: { data: any }) {
  const [qIdx, setQIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [done, setDone] = useState(false)
  const questions = data.questions || []
  const q = questions[qIdx]

  const score = Object.keys(answers).reduce((acc, k) => {
    const i = Number(k)
    return acc + (answers[i] === questions[i]?.correctAnswer ? 1 : 0)
  }, 0)

  if (done) {
    const pct = score / questions.length
    return (
      <div className="text-center py-8 space-y-3">
        <div className="text-5xl">{pct >= 0.7 ? "🎉" : pct >= 0.4 ? "📚" : "💪"}</div>
        <h3 className="text-2xl font-extrabold text-white">{score} / {questions.length}</h3>
        <p className="text-gray-500 text-sm">
          {pct >= 0.7 ? "¡Excelente dominio!" : pct >= 0.4 ? "Buen progreso, sigue practicando" : "Repasa el material y vuelve a intentar"}
        </p>
        <button onClick={() => { setAnswers({}); setQIdx(0); setDone(false) }}
          className="mt-2 px-5 py-2.5 rounded-2xl bg-blue-600 text-white text-sm font-semibold">Reintentar</button>
      </div>
    )
  }

  if (!q) return null

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-xs">
        <span className="text-gray-600">Pregunta {qIdx + 1} / {questions.length}</span>
        <span className="text-blue-400 font-semibold">Score: {score}</span>
      </div>
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
        <p className="text-white font-semibold text-sm leading-relaxed">{q.question}</p>
      </div>
      <div className="space-y-2">
        {(q.options || []).map((opt: string, i: number) => {
          const answered = answers[qIdx] !== undefined
          const selected = answers[qIdx] === i
          const correct = i === q.correctAnswer
          let cls = "bg-white/[0.03] border-white/[0.06]"
          if (answered && correct) cls = "bg-green-500/10 border-green-500/30"
          else if (answered && selected) cls = "bg-red-500/10 border-red-500/30"

          return (
            <button key={i} onClick={() => !answered && setAnswers({ ...answers, [qIdx]: i })}
              className={`w-full text-left p-3 rounded-xl border text-sm transition-all ${cls} ${!answered ? "cursor-pointer hover:bg-white/[0.06]" : ""}`}>
              <span className="text-blue-400 font-bold mr-2">{String.fromCharCode(65 + i)}.</span>
              <span className="text-gray-300">{opt}</span>
              {answered && correct && <span className="float-right">✅</span>}
              {answered && selected && !correct && <span className="float-right">❌</span>}
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
          <button onClick={() => setQIdx(qIdx - 1)} className="px-3 py-2 rounded-xl border border-white/10 text-gray-500 text-xs">← Anterior</button>
        )}
        {qIdx < questions.length - 1 ? (
          <button onClick={() => setQIdx(qIdx + 1)} disabled={answers[qIdx] === undefined}
            className="px-3 py-2 rounded-xl bg-blue-600/80 text-white text-xs font-semibold disabled:opacity-30">Siguiente →</button>
        ) : (
          <button onClick={() => setDone(true)} disabled={answers[qIdx] === undefined}
            className="px-3 py-2 rounded-xl bg-green-600/80 text-white text-xs font-semibold disabled:opacity-30">Ver resultado</button>
        )}
      </div>
    </div>
  )
}

function MindmapRenderer({ data }: { data: any }) {
  const [selected, setSelected] = useState<string | null>(null)
  const nodes = data.nodes || []
  const cx = 280, cy = 220

  return (
    <div className="space-y-3">
      <h3 className="text-center text-blue-400 font-bold text-sm">🧠 {data.centralTopic}</h3>
      <div className="relative h-[420px] bg-white/[0.02] rounded-3xl border border-white/[0.06] overflow-hidden">
        {/* Center */}
        <div className="absolute z-10 px-4 py-2 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-center"
          style={{ left: cx - 55, top: cy - 18 }}>
          <span className="text-blue-400 font-bold text-xs">{data.centralTopic}</span>
        </div>
        {/* Nodes */}
        {nodes.map((n: any, i: number) => {
          const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2
          const r = n.category === "main" ? 140 : 195
          const x = cx + Math.cos(angle) * r - 48
          const y = cy + Math.sin(angle) * r - 14

          return (
            <div key={n.id}>
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <line x1={cx} y1={cy} x2={x + 48} y2={y + 14}
                  stroke={n.color || "#6366f140"} strokeWidth={1.5}
                  strokeDasharray={n.category === "detail" ? "4,4" : "none"} />
              </svg>
              <div onClick={() => setSelected(selected === n.id ? null : n.id)}
                className={`absolute z-10 min-w-[90px] max-w-[120px] px-2.5 py-2 rounded-xl text-center cursor-pointer transition-all border ${
                  selected === n.id ? "bg-white/10 border-white/20" : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]"
                }`} style={{ left: x, top: y }}>
                <span className="text-gray-300 text-[11px] font-semibold leading-tight block">{n.label}</span>
              </div>
            </div>
          )
        })}
      </div>
      {selected && (() => {
        const n = nodes.find((nd: any) => nd.id === selected)
        return n?.description ? (
          <div className="bg-blue-500/[0.06] border border-blue-500/20 rounded-2xl p-3">
            <h4 className="text-blue-400 font-bold text-xs mb-1">{n.label}</h4>
            <p className="text-gray-400 text-xs">{n.description}</p>
          </div>
        ) : null
      })()}
    </div>
  )
}

function PPTRenderer({ data }: { data: any }) {
  const [idx, setIdx] = useState(0)
  const slides = data.slides || []
  const s = slides[idx]
  if (!s) return null

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-gray-600 text-xs">📑 {data.title}</span>
        <span className="text-gray-600 text-xs">{idx + 1} / {slides.length}</span>
      </div>
      <div className="aspect-video rounded-2xl border border-white/[0.08] p-8 flex flex-col"
        style={{ background: idx === 0 ? "linear-gradient(135deg, #1e1b4b, #312e81)" : "linear-gradient(135deg, #0f172a, #1e293b)" }}>
        <h2 className={`font-extrabold text-white mb-3 ${idx === 0 ? "text-xl text-center mt-auto mb-auto" : "text-base"}`}>{s.title}</h2>
        {idx !== 0 && (s.bullets || []).map((b: string, i: number) => (
          <div key={i} className="flex gap-2 mb-2">
            <span className="text-blue-400 text-sm mt-0.5">●</span>
            <span className="text-gray-300 text-sm leading-relaxed">{b}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-center items-center gap-2">
        <button onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}
          className="px-3 py-1.5 rounded-lg border border-white/10 text-gray-500 text-xs disabled:opacity-30">←</button>
        {slides.map((_: any, i: number) => (
          <button key={i} onClick={() => setIdx(i)}
            className={`w-2 h-2 rounded-full transition-all ${i === idx ? "bg-blue-400" : "bg-white/10"}`} />
        ))}
        <button onClick={() => setIdx(Math.min(slides.length - 1, idx + 1))} disabled={idx === slides.length - 1}
          className="px-3 py-1.5 rounded-lg border border-white/10 text-gray-500 text-xs disabled:opacity-30">→</button>
      </div>
      {s.notes && (
        <div className="bg-white/[0.03] rounded-xl p-3">
          <span className="text-gray-700 text-[10px] font-semibold">NOTAS:</span>
          <p className="text-gray-500 text-xs mt-1">{s.notes}</p>
        </div>
      )}
    </div>
  )
}

function TimelineRenderer({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      <h3 className="text-center text-blue-400 font-bold text-sm">⏳ {data.title}</h3>
      {data.period && <p className="text-center text-gray-600 text-xs">{data.period}</p>}
      <div className="relative pl-6">
        <div className="absolute left-2 top-0 bottom-0 w-[2px] bg-gradient-to-b from-blue-500 via-purple-500 to-pink-500 rounded-full" />
        {(data.events || []).map((evt: any, i: number) => (
          <div key={i} className="mb-3 relative">
            <div className={`absolute -left-4 top-1.5 w-3 h-3 rounded-full border-2 border-gray-950 ${
              evt.importance === "high" ? "bg-red-500" : evt.importance === "medium" ? "bg-yellow-500" : "bg-blue-500"
            }`} />
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm">{evt.icon || "📅"}</span>
                <span className="text-blue-400 text-[11px] font-bold">{evt.date}</span>
              </div>
              <h4 className="text-gray-200 font-bold text-xs">{evt.title}</h4>
              <p className="text-gray-500 text-[11px] mt-0.5">{evt.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PosterRenderer({ data }: { data: any }) {
  const dark = data.colorScheme !== "pastel"
  return (
    <div className={`rounded-3xl p-8 text-center border ${
      dark ? "bg-gradient-to-br from-gray-900 to-gray-800 border-white/10" : "bg-gradient-to-br from-pink-50 to-purple-50 border-purple-200"
    }`}>
      <h1 className={`text-2xl font-black leading-tight mb-2 ${dark ? "text-white" : "text-gray-900"}`}>{data.headline}</h1>
      {data.tagline && <p className={`text-sm mb-6 ${dark ? "text-gray-400" : "text-gray-600"}`}>{data.tagline}</p>}
      <div className="space-y-4 text-left mb-6">
        {(data.mainPoints || []).map((pt: any, i: number) => (
          <div key={i} className="flex gap-3">
            <span className="text-2xl flex-shrink-0">{pt.icon}</span>
            <div>
              <h3 className={`font-bold text-sm ${dark ? "text-gray-200" : "text-gray-900"}`}>{pt.title}</h3>
              <p className={`text-xs ${dark ? "text-gray-500" : "text-gray-600"}`}>{pt.description}</p>
            </div>
          </div>
        ))}
      </div>
      {data.callToAction && (
        <div className="bg-blue-500/20 border border-blue-500/30 rounded-2xl p-3">
          <span className="text-blue-400 font-bold text-sm">{data.callToAction}</span>
        </div>
      )}
    </div>
  )
}

// ============================================================
// RENDERER MAP
// ============================================================

const RENDERERS: Record<string, React.FC<{ data: any }>> = {
  infographic: InfographicRenderer,
  ppt: PPTRenderer,
  poster: PosterRenderer,
  podcast: PodcastRenderer,
  mindmap: MindmapRenderer,
  flashcards: FlashcardsRenderer,
  quiz: QuizRenderer,
  timeline: TimelineRenderer,
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function CreatorStudioPage() {
  const [user, setUser] = useState<any>(null)
  const [expanded, setExpanded] = useState(false)
  const [sourceType, setSourceType] = useState("topic")
  const [content, setContent] = useState("")
  const [fileName, setFileName] = useState("")
  const [outputFormat, setOutputFormat] = useState("infographic")
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<"input" | "processing" | "result">("input")
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/login")
      else setUser(user)
    })
  }, [])

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const b64 = (reader.result as string).split(",")[1]
      setContent(b64)
    }
    reader.readAsDataURL(file)
  }, [])

  const handleGenerate = async () => {
    if (!content.trim()) return
    setProcessing(true)
    setError(null)
    setStep("processing")

    try {
      const res = await fetch("/api/process-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType, content, fileName, outputFormat }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || "Error procesando")
      setResult(data.output.data)
      setStep("result")
    } catch (err: any) {
      setError(err.message)
      setStep("input")
    } finally {
      setProcessing(false)
    }
  }

  const sw = expanded ? "200px" : "64px"
  const Renderer = result ? RENDERERS[outputFormat] : null

  return (
    <div className="min-h-screen bg-gray-950 flex">

      {/* ── Sidebar ── */}
      <aside style={{ width: sw }}
        className="fixed left-0 top-0 h-full bg-gray-900/95 backdrop-blur-xl border-r border-white/5 flex flex-col z-20 transition-all duration-300 overflow-hidden">
        <button onClick={() => setExpanded(!expanded)}
          className="h-14 flex items-center border-b border-white/5 flex-shrink-0 hover:bg-white/5 transition-colors px-3 gap-3 w-full">
          <div className="w-10 flex items-center justify-center flex-shrink-0">
            <span className="text-blue-400 font-bold text-lg">{expanded ? "◀" : "▶"}</span>
          </div>
          {expanded && <span className="text-blue-400 font-bold text-sm whitespace-nowrap">Edu<span className="text-white">AI</span></span>}
        </button>
        <div className="flex-1 py-3 flex flex-col overflow-y-auto overflow-x-hidden">
          {NAV_LINKS.map(item => (
            <Link key={item.href} href={item.href} title={!expanded ? item.label : undefined}
              className={`flex items-center gap-3 mx-2 mb-1 px-2 py-2.5 rounded-2xl border border-transparent transition-all group ${
                item.href === "/creator" ? "bg-white/[0.06] border-white/[0.08]" : "hover:bg-white/[0.06] hover:border-white/[0.08]"
              }`}>
              <span className="text-2xl w-10 text-center flex-shrink-0">{item.icon}</span>
              {expanded && <span className={`text-sm font-medium whitespace-nowrap ${
                item.href === "/creator" ? "text-white" : "text-gray-400 group-hover:text-white"
              }`}>{item.label}</span>}
            </Link>
          ))}
        </div>
        <div className="border-t border-gray-800 py-3 flex-shrink-0">
          <button onClick={async () => { await supabase.auth.signOut(); router.push("/login") }}
            className="flex items-center gap-3 mx-2 px-2 py-2.5 rounded-2xl border border-transparent hover:bg-white/[0.06] hover:border-white/[0.08] transition-all group w-[calc(100%-16px)]"
            title={!expanded ? "Salir" : undefined}>
            <span className="text-2xl w-10 text-center flex-shrink-0">🚪</span>
            {expanded && <span className="text-gray-500 group-hover:text-red-400 text-sm whitespace-nowrap transition-colors">Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ marginLeft: sw }} className="flex-1 flex flex-col min-h-screen transition-all duration-300">

        {/* Topbar */}
        <div className="border-b border-white/5 bg-gray-950/80 backdrop-blur-xl sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">✨</span>
              <p className="text-white font-bold text-sm">Creator Studio</p>
            </div>
            {step === "result" && (
              <button onClick={() => { setStep("input"); setResult(null); setContent(""); setFileName("") }}
                className="text-xs text-gray-500 hover:text-white border border-white/10 rounded-xl px-3 py-1.5 transition-colors">
                + Nueva creación
              </button>
            )}
          </div>
        </div>

        <div className="max-w-2xl mx-auto w-full px-6 py-8 flex flex-col gap-5">

          {/* ── INPUT STEP ── */}
          {step === "input" && (
            <>
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">Crea material de estudio</h1>
                <p className="text-gray-500 text-sm">Transforma cualquier contenido en infografías, presentaciones, podcasts y más</p>
              </div>

              {/* Source */}
              <div>
                <label className="text-gray-600 text-[11px] font-semibold tracking-widest block mb-2">FUENTE</label>
                <div className="flex gap-2 flex-wrap">
                  {SOURCE_TYPES.map(s => (
                    <button key={s.id} onClick={() => { setSourceType(s.id); setContent(""); setFileName("") }}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border text-sm font-medium transition-all ${
                        sourceType === s.id
                          ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                          : "bg-white/[0.03] border-white/[0.06] text-gray-500 hover:bg-white/[0.06]"
                      }`}>
                      <span>{s.icon}</span>{s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content input */}
              {(sourceType === "topic" || sourceType === "text" || sourceType === "url") ? (
                <textarea value={content} onChange={e => setContent(e.target.value)}
                  placeholder={
                    sourceType === "topic" ? "Escribe el tema... ej: Fotosíntesis, Guerra Fría, Números complejos" :
                    sourceType === "url" ? "https://ejemplo.com/articulo" :
                    "Pega aquí el texto que quieres transformar..."
                  }
                  className={`w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3.5 text-gray-200 placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500/30 focus:bg-white/[0.06] transition-all resize-vertical ${
                    sourceType === "text" ? "min-h-[140px]" : "min-h-[52px]"
                  }`} />
              ) : (
                <div onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                    content ? "border-green-500/30 bg-green-500/[0.04]" : "border-white/10 bg-white/[0.02] hover:border-white/20"
                  }`}>
                  <div className="text-3xl mb-2">{content ? "✅" : sourceType === "pdf" ? "📄" : "📎"}</div>
                  <p className={`text-sm ${content ? "text-green-400" : "text-gray-500"}`}>
                    {content ? `${fileName} cargado` : `Clic para subir .${sourceType}`}
                  </p>
                  <input ref={fileRef} type="file" accept={sourceType === "pdf" ? ".pdf" : ".docx,.doc"} onChange={handleFile} className="hidden" />
                </div>
              )}

              {/* Output format */}
              <div>
                <label className="text-gray-600 text-[11px] font-semibold tracking-widest block mb-2">¿QUÉ QUIERES CREAR?</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {OUTPUT_FORMATS.map(f => (
                    <button key={f.id} onClick={() => setOutputFormat(f.id)}
                      className={`p-3 rounded-2xl border text-center transition-all ${
                        outputFormat === f.id
                          ? "bg-blue-500/10 border-blue-500/30"
                          : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"
                      }`}>
                      <div className="text-xl mb-1">{f.icon}</div>
                      <div className={`text-xs font-bold ${outputFormat === f.id ? "text-blue-400" : "text-gray-400"}`}>{f.label}</div>
                      <div className="text-[10px] text-gray-600 mt-0.5">{f.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate button */}
              <button onClick={handleGenerate} disabled={!content.trim() || processing}
                className="w-full py-3.5 rounded-2xl font-bold text-sm transition-all disabled:opacity-30 bg-blue-600/90 hover:bg-blue-500 text-white hover:shadow-lg hover:shadow-blue-500/20">
                ✨ Generar {OUTPUT_FORMATS.find(f => f.id === outputFormat)?.label}
              </button>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-3">
                  <p className="text-red-400 text-xs">❌ {error}</p>
                </div>
              )}
            </>
          )}

          {/* ── PROCESSING ── */}
          {step === "processing" && (
            <div className="text-center py-16">
              <div className="relative w-16 h-16 mx-auto mb-5">
                <div className="w-16 h-16 rounded-full border-2 border-white/10 border-t-blue-400 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center text-2xl">
                  {OUTPUT_FORMATS.find(f => f.id === outputFormat)?.icon}
                </div>
              </div>
              <h3 className="text-white font-bold text-base mb-1">Procesando contenido...</h3>
              <p className="text-gray-600 text-sm">
                Extrayendo conceptos y generando {OUTPUT_FORMATS.find(f => f.id === outputFormat)?.label.toLowerCase()}
              </p>
            </div>
          )}

          {/* ── RESULT ── */}
          {step === "result" && result && (
            <>
              <div className="flex items-center gap-2 bg-green-500/[0.06] border border-green-500/20 rounded-2xl p-3">
                <span>✅</span>
                <span className="text-green-400 text-sm font-semibold flex-1">
                  {OUTPUT_FORMATS.find(f => f.id === outputFormat)?.label} generada
                </span>
                <button onClick={() => navigator.clipboard?.writeText(JSON.stringify(result, null, 2))}
                  className="text-[11px] text-green-400 border border-green-500/20 rounded-lg px-2.5 py-1 hover:bg-green-500/10 transition-colors">
                  📋 JSON
                </button>
              </div>

              <div className="bg-gray-900/60 border border-white/5 rounded-3xl p-5 backdrop-blur-sm">
                {Renderer && <Renderer data={result} />}
              </div>
            </>
          )}

        </div>
      </main>
    </div>
  )
}
