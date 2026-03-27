"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import {
  ArrowLeft, Sparkles, Download, Trash2,
  ZoomIn, ChevronLeft, ChevronRight, Search,
  SlidersHorizontal, ImagePlus, Loader2, X
} from "lucide-react"

const STYLES = [
  { id: "realistic", label: "Realista", emoji: "📷" },
  { id: "digital art", label: "Arte Digital", emoji: "🎨" },
  { id: "oil painting", label: "Óleo", emoji: "🖼️" },
  { id: "anime", label: "Anime", emoji: "⛩️" },
  { id: "watercolor", label: "Acuarela", emoji: "💧" },
  { id: "3d render", label: "3D", emoji: "🧊" },
  { id: "sketch", label: "Boceto", emoji: "✏️" },
  { id: "cinematic", label: "Cinematográfico", emoji: "🎬" },
  { id: "educational", label: "Educativo", emoji: "📚" },
  { id: "flat design", label: "Flat Design", emoji: "✦" },
]

const SIZES = [
  { label: "Horizontal", w: 1024, h: 576, ratio: "16/9" },
  { label: "Cuadrado", w: 1024, h: 1024, ratio: "1/1" },
  { label: "Vertical", w: 576, h: 1024, ratio: "9/16" },
]

const PROVIDERS = [
  { id: "auto", label: "Auto" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "pollinations", label: "Pollinations" },
  { id: "together", label: "Together" },
  { id: "huggingface", label: "Hugging Face" },
]

const MODES = [
  { id: "fast", label: "Rápido" },
  { id: "quality", label: "Calidad" },
  { id: "educational", label: "Educativo" },
]

const EXAMPLES = [
  "Un sistema solar con planetas etiquetados",
  "La mitocondria como ciudad futurista",
  "La Revolución Francesa en un cuadro épico",
  "ADN doble hélice con colores vibrantes",
  "Un mapa mental de ecosistemas terrestres",
  "Célula animal con orgánulos iluminados",
]

interface GalleryImage {
  id: string
  prompt: string
  optimized_prompt: string
  image_url: string
  provider: string
  style: string
  source: string
  topic: string | null
  width: number
  height: number
  created_at: string
}

type FilterSource = "all" | "manual" | "auto_study"
type PanelMode = "generate" | "gallery"
type GenerationMode = "fast" | "quality" | "educational"

export default function ImageStudioPage() {
  const router = useRouter()
  const supabase = createClient()

  const [panel, setPanel] = useState<PanelMode>("generate")

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/login")
    })
  }, [router, supabase])

  const [prompt, setPrompt] = useState("")
  const [style, setStyle] = useState("realistic")
  const [sizeIdx, setSizeIdx] = useState(0)
  const [provider, setProvider] = useState("auto")
  const [mode, setMode] = useState<GenerationMode>("fast")
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState("")
  const [result, setResult] = useState<{
    imageUrl: string
    optimizedPrompt: string
    provider: string
    model?: string
    mode?: string
  } | null>(null)

  const [images, setImages] = useState<GalleryImage[]>([])
  const [galLoading, setGalLoading] = useState(true)
  const [filter, setFilter] = useState<FilterSource>("all")
  const [search, setSearch] = useState("")
  const [fullscreen, setFullscreen] = useState<GalleryImage | null>(null)
  const [fsIdx, setFsIdx] = useState(0)

  useEffect(() => {
    loadGallery()
  }, [])

  async function loadGallery() {
    setGalLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from("generated_images")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(120)

    setImages(data || [])
    setGalLoading(false)
  }

  async function readErrorResponse(res: Response) {
    const contentType = res.headers.get("content-type") || ""

    if (contentType.includes("application/json")) {
      try {
        const data = await res.json()
        return data?.error || data?.message || JSON.stringify(data)
      } catch {
        return `Error ${res.status}`
      }
    }

    try {
      const text = await res.text()
      return text || `Error ${res.status}`
    } catch {
      return `Error ${res.status}`
    }
  }

  async function handleGenerate() {
    if (!prompt.trim() || generating) return

    setGenerating(true)
    setGenError("")
    setResult(null)

    const size = SIZES[sizeIdx]

    try {
      const res = await fetch("/api/agents/imagenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          style,
          width: size.w,
          height: size.h,
          provider,
          mode,
          source: "manual",
        }),
      })

      if (!res.ok) {
        const msg = await readErrorResponse(res)
        throw new Error(msg)
      }

      const data = await res.json()

      setResult({
        imageUrl: data.imageUrl,
        optimizedPrompt: data.optimizedPrompt,
        provider: data.provider,
        model: data.model,
        mode: data.mode,
      })

      setTimeout(loadGallery, 1000)
    } catch (err: any) {
      setGenError(err?.message || "No se pudo generar la imagen")
    } finally {
      setGenerating(false)
    }
  }

  async function handleDelete(id: string) {
    await supabase.from("generated_images").delete().eq("id", id)
    setImages((prev) => prev.filter((img) => img.id !== id))
    if (fullscreen?.id === id) setFullscreen(null)
  }

  function handleDownload(imageUrl: string, promptText: string) {
    const a = document.createElement("a")
    a.href = imageUrl
    a.download = `eduai-${promptText.slice(0, 30).replace(/\s+/g, "-")}.jpg`
    a.click()
  }

  const filtered = images.filter((img) => {
    const matchSource = filter === "all" ? true : img.source === filter
    const matchSearch =
      search.trim() === "" ? true : img.prompt.toLowerCase().includes(search.toLowerCase())

    return matchSource && matchSearch
  })

  function openFullscreen(img: GalleryImage) {
    const idx = filtered.findIndex((i) => i.id === img.id)
    setFsIdx(idx)
    setFullscreen(img)
  }

  function fsNavigate(dir: -1 | 1) {
    const next = fsIdx + dir
    if (next < 0 || next >= filtered.length) return
    setFsIdx(next)
    setFullscreen(filtered[next])
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!fullscreen) return
      if (e.key === "Escape") setFullscreen(null)
      if (e.key === "ArrowLeft") fsNavigate(-1)
      if (e.key === "ArrowRight") fsNavigate(1)
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [fullscreen, fsIdx, filtered])

  const styleLabel: Record<string, string> = Object.fromEntries(STYLES.map((s) => [s.id, s.label]))

  return (
    <div className="min-h-screen bg-gray-950">
      {fullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col"
          onClick={() => setFullscreen(null)}
        >
          <div className="flex items-start justify-between p-4 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <div className="flex-1 min-w-0 pr-4">
              <p className="text-white/70 text-sm leading-relaxed">{fullscreen.prompt}</p>
              <p className="text-white/30 text-xs mt-1">
                {styleLabel[fullscreen.style] || fullscreen.style} · {fullscreen.provider}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => handleDownload(fullscreen.image_url, fullscreen.prompt)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-white transition-all"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
              >
                <Download size={13} /> Descargar
              </button>
              <button
                onClick={() => handleDelete(fullscreen.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-red-400 transition-all"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
              >
                <Trash2 size={13} /> Eliminar
              </button>
              <button
                onClick={() => setFullscreen(null)}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-white transition-colors"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center relative px-4 pb-4" onClick={(e) => e.stopPropagation()}>
            {fsIdx > 0 && (
              <button
                onClick={() => fsNavigate(-1)}
                className="absolute left-4 z-10 w-10 h-10 rounded-full flex items-center justify-center text-white transition-all"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <ChevronLeft size={18} />
              </button>
            )}

            <img
              src={fullscreen.image_url}
              alt={fullscreen.prompt}
              className="max-h-[75vh] max-w-full rounded-2xl object-contain shadow-2xl"
            />

            {fsIdx < filtered.length - 1 && (
              <button
                onClick={() => fsNavigate(1)}
                className="absolute right-4 z-10 w-10 h-10 rounded-full flex items-center justify-center text-white transition-all"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <ChevronRight size={18} />
              </button>
            )}
          </div>

          <div className="text-center pb-4 flex-shrink-0">
            <span className="text-gray-600 text-xs">{fsIdx + 1} / {filtered.length}</span>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-gray-950/90 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.06] text-gray-400 hover:text-white hover:bg-white/[0.07] transition-all flex-shrink-0"
          >
            <ArrowLeft size={15} />
          </Link>

          <div
            className="w-9 h-9 rounded-2xl flex items-center justify-center shadow-md flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #db2777, #9333ea)", boxShadow: "0 4px 12px rgba(219,39,119,0.3)" }}
          >
            <ImagePlus size={17} className="text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-white font-bold text-sm leading-tight">Image Studio</h1>
            <p className="text-gray-600 text-[11px]">Generación · Galería · Análisis visual</p>
          </div>

          <div
            className="flex items-center gap-1 p-1 rounded-xl"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {(["generate", "gallery"] as PanelMode[]).map((p) => (
              <button
                key={p}
                onClick={() => setPanel(p)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: panel === p ? "rgba(219,39,119,0.15)" : "transparent",
                  color: panel === p ? "#f9a8d4" : "#6b7280",
                  borderColor: panel === p ? "rgba(219,39,119,0.3)" : "transparent",
                }}
              >
                {p === "generate" ? "✨ Generar" : `🖼️ Galería (${images.length})`}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {panel === "generate" && (
          <div className="flex flex-col gap-5 animate-fade-in">
            <div>
              <label className="text-gray-600 text-[11px] font-semibold tracking-widest block mb-2">DESCRIPCIÓN</label>
              <div className="relative">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey) handleGenerate() }}
                  placeholder="Describe la imagen que quieres crear..."
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3.5 text-gray-200 placeholder-gray-600 text-sm focus:outline-none focus:border-pink-500/30 focus:bg-white/[0.06] transition-all resize-none min-h-[80px]"
                />
                <div className="flex gap-1.5 flex-wrap mt-2">
                  {EXAMPLES.slice(0, 3).map((ex) => (
                    <button
                      key={ex}
                      onClick={() => setPrompt(ex)}
                      className="text-[10px] px-2.5 py-1 rounded-lg border transition-all"
                      style={{ background: "rgba(219,39,119,0.06)", borderColor: "rgba(219,39,119,0.15)", color: "#f9a8d4" }}
                    >
                      {ex.slice(0, 28)}…
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-gray-600 text-[11px] font-semibold tracking-widest block mb-2">ESTILO</label>
                <div className="flex flex-wrap gap-1.5">
                  {STYLES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setStyle(s.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all"
                      style={{
                        background: style === s.id ? "rgba(219,39,119,0.1)" : "rgba(255,255,255,0.02)",
                        borderColor: style === s.id ? "rgba(219,39,119,0.3)" : "rgba(255,255,255,0.07)",
                        color: style === s.id ? "#f9a8d4" : "#6b7280",
                      }}
                    >
                      <span>{s.emoji}</span><span>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-gray-600 text-[11px] font-semibold tracking-widest block mb-2">TAMAÑO</label>
                <div className="flex flex-col gap-1.5">
                  {SIZES.map((s, i) => (
                    <button
                      key={s.label}
                      onClick={() => setSizeIdx(i)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all text-left"
                      style={{
                        background: sizeIdx === i ? "rgba(219,39,119,0.1)" : "rgba(255,255,255,0.02)",
                        borderColor: sizeIdx === i ? "rgba(219,39,119,0.3)" : "rgba(255,255,255,0.07)",
                        color: sizeIdx === i ? "#f9a8d4" : "#6b7280",
                      }}
                    >
                      <div
                        className="rounded flex-shrink-0"
                        style={{
                          width: s.ratio === "16/9" ? 18 : s.ratio === "1/1" ? 12 : 9,
                          height: s.ratio === "16/9" ? 10 : s.ratio === "1/1" ? 12 : 16,
                          background: sizeIdx === i ? "rgba(219,39,119,0.4)" : "rgba(255,255,255,0.2)",
                          border: `1px solid ${sizeIdx === i ? "rgba(219,39,119,0.6)" : "rgba(255,255,255,0.2)"}`,
                        }}
                      />
                      <span>{s.label}</span>
                      <span className="ml-auto opacity-50">{s.w}×{s.h}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-gray-600 text-[11px] font-semibold tracking-widest block mb-2">PROVEEDOR</label>
                <div className="flex flex-col gap-1.5">
                  {PROVIDERS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setProvider(p.id)}
                      className="px-3 py-2 rounded-xl text-xs font-medium border transition-all text-left"
                      style={{
                        background: provider === p.id ? "rgba(219,39,119,0.1)" : "rgba(255,255,255,0.02)",
                        borderColor: provider === p.id ? "rgba(219,39,119,0.3)" : "rgba(255,255,255,0.07)",
                        color: provider === p.id ? "#f9a8d4" : "#6b7280",
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="text-gray-600 text-[11px] font-semibold tracking-widest block mb-2">MODO</label>
              <div className="flex gap-2 flex-wrap">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id as GenerationMode)}
                    className="px-3 py-2 rounded-xl text-xs font-medium border transition-all"
                    style={{
                      background: mode === m.id ? "rgba(219,39,119,0.1)" : "rgba(255,255,255,0.02)",
                      borderColor: mode === m.id ? "rgba(219,39,119,0.3)" : "rgba(255,255,255,0.07)",
                      color: mode === m.id ? "#f9a8d4" : "#6b7280",
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-600 mt-2 leading-relaxed">
                Rápido: menor costo · Calidad: mejor acabado · Educativo: mejor para diagramas, infografías y texto.
              </p>
            </div>

            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || generating}
              className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl font-bold text-sm text-white transition-all disabled:opacity-40"
              style={{
                background: "linear-gradient(135deg, #be185d, #db2777)",
                boxShadow: prompt.trim() && !generating ? "0 4px 20px rgba(219,39,119,0.3)" : "none",
              }}
            >
              {generating
                ? <><Loader2 size={18} className="animate-spin" /> Generando imagen...</>
                : <><Sparkles size={18} /> Generar imagen</>
              }
            </button>

            {genError && (
              <div className="px-4 py-3 rounded-xl border border-red-500/25 bg-red-500/8 text-red-400 text-sm whitespace-pre-wrap">
                ❌ {genError}
              </div>
            )}

            {result && (
              <div className="flex flex-col gap-3 animate-fade-in-scale">
                <div className="relative rounded-2xl overflow-hidden border border-white/[0.08]">
                  <img
                    src={result.imageUrl}
                    alt={prompt}
                    className="w-full object-cover"
                    style={{ aspectRatio: SIZES[sizeIdx].ratio }}
                  />
                  <div className="absolute top-3 right-3 flex gap-2">
                    <button
                      onClick={() => handleDownload(result.imageUrl, prompt)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-white backdrop-blur-md transition-all"
                      style={{ background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.12)" }}
                    >
                      <Download size={13} /> Descargar
                    </button>
                  </div>
                </div>

                <div
                  className="px-4 py-3 rounded-xl border"
                  style={{ background: "rgba(219,39,119,0.05)", borderColor: "rgba(219,39,119,0.15)" }}
                >
                  <p className="text-[10px] text-pink-400 font-semibold uppercase tracking-widest mb-1">Prompt optimizado</p>
                  <p className="text-gray-400 text-xs leading-relaxed">{result.optimizedPrompt}</p>
                  <p className="text-gray-600 text-[10px] mt-1.5">
                    Proveedor: {result.provider}{result.model ? ` · Modelo: ${result.model}` : ""}{result.mode ? ` · Modo: ${result.mode}` : ""}
                  </p>
                </div>

                <button
                  onClick={() => { setResult(null); setPrompt("") }}
                  className="text-gray-600 hover:text-gray-400 text-xs transition-colors text-center"
                >
                  + Nueva imagen
                </button>
              </div>
            )}
          </div>
        )}

        {panel === "gallery" && (
          <div className="flex flex-col gap-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por descripción..."
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2.5 text-gray-300 placeholder-gray-600 text-sm focus:outline-none focus:border-pink-500/30 transition-all"
                />
              </div>

              <div className="flex gap-1.5">
                {([
                  { id: "all", label: "Todas" },
                  { id: "manual", label: "Manual" },
                  { id: "auto_study", label: "Auto-estudio" },
                ] as { id: FilterSource; label: string }[]).map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    className="px-3 py-2 rounded-xl text-xs font-medium border transition-all"
                    style={{
                      background: filter === f.id ? "rgba(219,39,119,0.1)" : "rgba(255,255,255,0.02)",
                      borderColor: filter === f.id ? "rgba(219,39,119,0.3)" : "rgba(255,255,255,0.07)",
                      color: filter === f.id ? "#f9a8d4" : "#6b7280",
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div
              className="flex items-center justify-between px-4 py-3 rounded-2xl border"
              style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.07)" }}
            >
              <div className="flex items-center gap-2 text-gray-400 text-xs">
                <SlidersHorizontal size={13} />
                <span>{filtered.length} imágenes</span>
              </div>
              <button
                onClick={loadGallery}
                className="text-xs text-pink-400 hover:text-pink-300 transition-colors"
              >
                Recargar
              </button>
            </div>

            {galLoading ? (
              <div className="py-16 flex items-center justify-center text-gray-500 text-sm">
                <Loader2 size={18} className="animate-spin mr-2" />
                Cargando galería...
              </div>
            ) : filtered.length === 0 ? (
              <div
                className="py-16 rounded-2xl border text-center"
                style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.06)" }}
              >
                <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                     style={{ background: "rgba(219,39,119,0.08)" }}>
                  <ImagePlus size={24} className="text-pink-400" />
                </div>
                <p className="text-gray-300 text-sm font-medium mb-1">No hay imágenes todavía</p>
                <p className="text-gray-600 text-xs">Genera tu primera imagen para verla aquí.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {filtered.map((img) => (
                  <div
                    key={img.id}
                    className="group relative rounded-2xl overflow-hidden border border-white/[0.06] cursor-pointer transition-all hover:border-white/[0.12] hover:scale-[1.02]"
                    style={{ aspectRatio: img.width && img.height ? `${img.width}/${img.height}` : "16/9", background: "#0f172a" }}
                    onClick={() => openFullscreen(img)}
                  >
                    <img
                      src={img.image_url}
                      alt={img.prompt}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />

                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2"
                      style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.1) 60%, transparent 100%)" }}
                    >
                      <div className="flex justify-end">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(img.id) }}
                          className="w-7 h-7 flex items-center justify-center rounded-lg backdrop-blur-md transition-all"
                          style={{ background: "rgba(239,68,68,0.3)", border: "1px solid rgba(239,68,68,0.4)" }}
                        >
                          <Trash2 size={12} className="text-red-300" />
                        </button>
                      </div>

                      <div>
                        <p className="text-white/80 text-[10px] leading-tight line-clamp-2 mb-2">{img.prompt}</p>
                        <div className="flex gap-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDownload(img.image_url, img.prompt) }}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-white backdrop-blur-md"
                            style={{ background: "rgba(255,255,255,0.12)" }}
                          >
                            <Download size={10} /> Descargar
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); openFullscreen(img) }}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-white backdrop-blur-md"
                            style={{ background: "rgba(255,255,255,0.12)" }}
                          >
                            <ZoomIn size={10} /> Ver
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
