"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

interface Image {
  id: string
  prompt: string
  optimized_prompt: string
  image_url: string
  provider: string
  style: string
  source: string
  topic: string | null
  created_at: string
}

const STYLE_LABELS: Record<string, string> = {
  "realistic": "Realista",
  "digital art": "Arte Digital",
  "oil painting": "Óleo",
  "anime": "Anime",
  "watercolor": "Acuarela",
  "3d render": "3D",
  "sketch": "Boceto",
  "cinematic": "Cinematográfico",
}

export default function GaleriaPage() {
  const [images, setImages]     = useState<Image[]>([])
  const [loading, setLoading]   = useState(true)
  const [fullscreen, setFullscreen] = useState<Image | null>(null)
  const [filter, setFilter]     = useState<"all" | "manual" | "auto_study">("all")
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadImages()
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreen(null) }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  async function loadImages() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }

    const { data } = await supabase
      .from("generated_images")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100)

    setImages(data || [])
    setLoading(false)
  }

  async function deleteImage(id: string) {
    await supabase.from("generated_images").delete().eq("id", id)
    setImages(prev => prev.filter(img => img.id !== id))
    setFullscreen(null)
  }

  function downloadImage(url: string, prompt: string) {
    const a = document.createElement("a")
    a.href = url
    a.download = `eduai-${prompt.slice(0, 20).replace(/\s+/g, "-")}.jpg`
    a.click()
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr)
    return d.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })
  }

  const filtered = images.filter(img => filter === "all" ? true : img.source === filter)

  return (
    <div className="min-h-screen bg-app">
      {/* Fullscreen */}
      {fullscreen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setFullscreen(null)}>
          <div className="relative max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-muted2 text-sm">{fullscreen.prompt}</p>
                <p className="text-muted2 text-xs mt-0.5">
                  {STYLE_LABELS[fullscreen.style] || fullscreen.style} · {fullscreen.provider} · {formatDate(fullscreen.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => downloadImage(fullscreen.image_url, fullscreen.prompt)}
                  className="bg-card-soft-theme hover:bg-card-soft-theme text-main px-3 py-2 rounded-xl text-xs transition-colors">
                  ⬇ Descargar
                </button>
                <button onClick={() => deleteImage(fullscreen.id)}
                  className="bg-red-900/50 hover:bg-red-800 text-red-700 px-3 py-2 rounded-xl text-xs transition-colors">
                  🗑 Eliminar
                </button>
                <button onClick={() => setFullscreen(null)}
                  className="bg-card-soft-theme hover:bg-card-soft-theme text-main px-3 py-2 rounded-xl text-xs transition-colors">
                  ✕ Cerrar
                </button>
              </div>
            </div>
            <img src={fullscreen.image_url} alt={fullscreen.prompt}
              className="w-full rounded-2xl object-contain shadow-2xl"
              style={{ maxHeight: "80vh" }} />
            {fullscreen.topic && (
              <p className="text-muted2 text-xs mt-2 text-center">
                📚 Generada durante sesión de estudio: {fullscreen.topic}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="border-b sticky top-0 z-10 backdrop-blur-xl" style={{ background: "var(--bg-header)", borderColor: "var(--border-soft)" }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-all text-sm text-sub hover:text-main" style={{ background: "var(--bg-card-soft)", border: "1px solid var(--border-soft)" }}>←</button>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-lg">🖼️</div>
          <div className="flex-1">
            <h1 className="text-main font-semibold text-sm">Mi Galería</h1>
            <p className="text-muted2 text-xs">{images.length} imágenes guardadas</p>
          </div>
          <button onClick={() => router.push("/image-studio")}
            className="bg-pink-600 hover:bg-pink-500 text-main px-4 py-2 rounded-xl text-xs font-medium transition-colors">
            + Nueva imagen
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Filtros */}
        <div className="flex gap-2 mb-6">
          {[
            { id: "all",        label: `Todas (${images.length})`                                        },
            { id: "manual",     label: `Creadas por mí (${images.filter(i => i.source === "manual").length})`     },
            { id: "auto_study", label: `Del tutor (${images.filter(i => i.source === "auto_study").length})` },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id as any)}
              className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${
                filter === f.id
                  ? "bg-pink-500/20 border border-pink-500/40 text-pink-700"
                  : "bg-card-soft-theme border border-soft text-muted2 hover:text-sub"
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-video rounded-2xl animate-pulse border" style={{ background: "var(--bg-card-soft)", borderColor: "var(--border-soft)" }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-6xl mb-4">🖼️</p>
            <p className="text-sub font-medium mb-2">No hay imágenes aún</p>
            <p className="text-muted2 text-sm mb-6">
              {filter === "auto_study"
                ? "Las imágenes se generan automáticamente mientras estudias"
                : "Crea tu primera imagen en el generador"}
            </p>
            <button onClick={() => router.push("/image-studio")}
              className="bg-pink-600 hover:bg-pink-500 text-main px-6 py-3 rounded-xl text-sm font-medium transition-colors">
              🎨 Ir al generador
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(img => (
              <div key={img.id}
                className="group relative aspect-video rounded-2xl overflow-hidden border cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md" style={{ background: "var(--bg-card-soft)", borderColor: "var(--border-soft)" }}>
                <img
                  src={img.image_url}
                  alt={img.prompt}
                  onClick={() => setFullscreen(img)}
                  className="w-full h-full object-cover" />

                {/* Overlay con info y botones */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Botón eliminar arriba izquierda */}
                  <button
                    onClick={e => { e.stopPropagation(); deleteImage(img.id) }}
                    className="absolute top-2 left-2 bg-red-600/80 hover:bg-red-500 text-main text-[10px] px-2 py-1 rounded-lg backdrop-blur-sm transition-colors"
                  >
                    🗑 Eliminar
                  </button>

                  {/* Info abajo */}
                  <div className="absolute bottom-0 inset-x-0 p-3 flex items-end justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-main text-xs font-medium line-clamp-1">{img.prompt}</p>
                      <p className="text-muted2 text-[10px] mt-0.5">{formatDate(img.created_at)}</p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); downloadImage(img.image_url, img.prompt) }}
                      className="ml-2 bg-card-soft-theme hover:bg-card-soft-theme text-main text-[10px] px-2 py-1 rounded-lg backdrop-blur-sm transition-colors flex-shrink-0"
                    >
                      ⬇
                    </button>
                  </div>
                </div>

                {img.source === "auto_study" && (
                  <div className="absolute top-2 right-2 bg-blue-500/80 text-main text-[9px] px-2 py-0.5 rounded-full backdrop-blur-sm">
                    📚 Estudio
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
