"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"

const STYLES = [
  { id: "realistic",     label: "Realista",       emoji: "📷" },
  { id: "digital art",  label: "Arte Digital",    emoji: "🎨" },
  { id: "oil painting", label: "Óleo",            emoji: "🖼️" },
  { id: "anime",        label: "Anime",           emoji: "⛩️" },
  { id: "watercolor",   label: "Acuarela",        emoji: "💧" },
  { id: "3d render",    label: "3D",              emoji: "🧊" },
  { id: "sketch",       label: "Boceto",          emoji: "✏️" },
  { id: "cinematic",    label: "Cinematográfico", emoji: "🎬" },
]

const SIZES = [
  { label: "Horizontal",  w: 1024, h: 576  },
  { label: "Cuadrado",    w: 1024, h: 1024 },
  { label: "Vertical",    w: 576,  h: 1024 },
]

const PROVIDERS = [
  { id: "auto",         label: "Auto (mejor disponible)" },
  { id: "pollinations", label: "Pollinations FLUX"       },
  { id: "together",     label: "Together AI"             },
  { id: "huggingface",  label: "Hugging Face SD"         },
]

const EXAMPLES = [
  "Un astronauta explorando una ciudad submarina futurista",
  "Un bosque de bambú al amanecer con niebla",
  "Un robot leyendo un libro en una biblioteca antigua",
  "Una ciudad chilena en el año 2150",
  "Un gato samurái bajo la lluvia",
  "Sistema solar visto desde una nave espacial",
]

interface Result {
  imageUrl: string
  optimizedPrompt: string
  provider: string
}

export default function ImagenesPage() {
  const [prompt, setPrompt]     = useState("")
  const [style, setStyle]       = useState("realistic")
  const [size, setSize]         = useState(SIZES[0])
  const [provider, setProvider] = useState("auto")
  const [loading, setLoading]   = useState(false)
  const [results, setResults]   = useState<Result[]>([])
  const [showPrompt, setShowPrompt] = useState<number | null>(null)
  const router = useRouter()

  async function generate() {
    if (!prompt.trim() || loading) return
    setLoading(true)
    try {
      const res = await fetch("/api/agents/imagenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          style,
          width: size.w,
          height: size.h,
          provider,
        }),
      })
      const data = await res.json()
      setResults(prev => [data, ...prev])
    } catch {
      alert("Error generando la imagen. Intenta de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  function downloadImage(url: string, index: number) {
    const a = document.createElement("a")
    a.href = url
    a.download = `eduai-imagen-${index + 1}.jpg`
    a.target = "_blank"
    a.click()
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/80 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-all text-sm">←</button>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-lg">🎨</div>
          <div>
            <h1 className="text-white font-semibold text-sm">Generador de Imágenes</h1>
            <p className="text-gray-500 text-xs">Prompt optimizado con IA · FLUX · Stable Diffusion</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto w-full px-4 py-6 flex flex-col gap-5">

        {/* Input principal */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <label className="text-gray-400 text-xs font-medium mb-2 block">Describe la imagen que quieres generar</label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => e.key === "Enter" && e.ctrlKey && generate()}
            placeholder="Ej: Un astronauta explorando una ciudad submarina futurista al atardecer..."
            rows={3}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-gray-200 placeholder-gray-600 text-sm focus:outline-none focus:border-pink-500/50 resize-none"
          />

          {/* Ejemplos */}
          <div className="flex flex-wrap gap-2 mt-3">
            {EXAMPLES.map(ex => (
              <button key={ex} onClick={() => setPrompt(ex)}
                className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-500 hover:text-gray-300 px-3 py-1 rounded-full transition-colors truncate max-w-[200px]">
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Controles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Estilos */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 md:col-span-2">
            <label className="text-gray-500 text-xs font-medium mb-3 block">Estilo artístico</label>
            <div className="grid grid-cols-4 gap-2">
              {STYLES.map(s => (
                <button key={s.id} onClick={() => setStyle(s.id)}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                    style === s.id
                      ? "bg-pink-500/20 border-pink-500/40 text-pink-300"
                      : "bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300"
                  }`}>
                  <span className="text-lg">{s.emoji}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tamaño y proveedor */}
          <div className="flex flex-col gap-3">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <label className="text-gray-500 text-xs font-medium mb-2 block">Tamaño</label>
              <div className="flex flex-col gap-1.5">
                {SIZES.map(s => (
                  <button key={s.label} onClick={() => setSize(s)}
                    className={`text-xs py-2 px-3 rounded-lg border text-left transition-all ${
                      size.label === s.label
                        ? "bg-pink-500/20 border-pink-500/40 text-pink-300"
                        : "bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600"
                    }`}>
                    {s.label} <span className="text-gray-600">{s.w}×{s.h}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <label className="text-gray-500 text-xs font-medium mb-2 block">Proveedor</label>
              <select
                value={provider}
                onChange={e => setProvider(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-300 text-xs focus:outline-none focus:border-pink-500/50"
              >
                {PROVIDERS.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Botón generar */}
        <button
          onClick={generate}
          disabled={!prompt.trim() || loading}
          className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 disabled:opacity-40 text-white py-4 rounded-2xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Generando imagen...
            </>
          ) : (
            <>🎨 Generar imagen</>
          )}
        </button>

        {/* Resultados */}
        {results.length > 0 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-white font-semibold text-sm">Imágenes generadas</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.map((r, i) => (
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden group">
                  {/* Imagen */}
                  <div className="relative aspect-video bg-gray-800">
                    <img
                      src={r.imageUrl}
                      alt={`Imagen ${i + 1}`}
                      className="w-full h-full object-cover"
                      onError={e => {
                        (e.target as HTMLImageElement).src = `https://image.pollinations.ai/prompt/${encodeURIComponent(r.optimizedPrompt)}?width=800&height=450&nologo=true`
                      }}
                    />
                    {/* Overlay botones */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <button
                        onClick={() => downloadImage(r.imageUrl, i)}
                        className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-xs font-medium backdrop-blur-sm transition-all"
                      >
                        ⬇ Descargar
                      </button>
                      <button
                        onClick={() => setPrompt(results[results.length - 1 - i]?.optimizedPrompt || "")}
                        className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-xs font-medium backdrop-blur-sm transition-all"
                      >
                        🔄 Reusar prompt
                      </button>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-600">via {r.provider}</span>
                      <button
                        onClick={() => setShowPrompt(showPrompt === i ? null : i)}
                        className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
                      >
                        {showPrompt === i ? "Ocultar prompt" : "Ver prompt ↓"}
                      </button>
                    </div>
                    {showPrompt === i && (
                      <p className="text-gray-500 text-xs italic mt-1 leading-relaxed border-t border-gray-800 pt-2">
                        {r.optimizedPrompt}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
