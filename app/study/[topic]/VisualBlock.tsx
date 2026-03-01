"use client"

import { useEffect, useState } from "react"

interface Props {
  topic: string
  context: string
}

type State = "idle" | "detecting" | "generating" | "done" | "skip"

export default function VisualBlock({ topic, context }: Props) {
  const [state, setState] = useState<State>("idle")
  const [imageUrl, setImageUrl]     = useState("")
  const [imagePrompt, setImagePrompt] = useState("")
  const [provider, setProvider]     = useState("")
  const [expanded, setExpanded]     = useState(true)

  useEffect(() => {
    if (!context || context.length < 100) return
    detect()
  }, [context])

  async function detect() {
    setState("detecting")
    try {
      const res = await fetch("/api/agents/visual-detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, context }),
      })
      const data = await res.json()
      if (!data.shouldGenerate) { setState("skip"); return }
      await generateImage(data.imagePrompt || topic)
    } catch {
      setState("skip")
    }
  }

  async function generateImage(prompt: string) {
    setState("generating")
    setImagePrompt(prompt)
    try {
      const res = await fetch("/api/agents/imagenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          style: "digital art",
          width: 768,
          height: 432,
          provider: "auto",
          source: "auto_study",
          topic,
          customPrompt: prompt + ", educational illustration, clear, detailed, professional"
        }),
      })
      if (!res.ok) { setState("skip"); return }
      const data = await res.json()
      setImageUrl(data.imageUrl)
      setProvider(data.provider)
      setState("done")
    } catch {
      setState("skip")
    }
  }

  async function regenerate() {
    await generateImage(imagePrompt)
  }

  if (state === "idle" || state === "skip") return null

  if (state === "detecting" || state === "generating") {
    return (
      <div className="mt-4 flex items-center gap-2 text-gray-600 text-xs">
        <div className="w-3 h-3 border border-gray-600 border-t-transparent rounded-full animate-spin" />
        {state === "detecting" ? "Analizando si se puede visualizar..." : "Generando imagen de apoyo..."}
      </div>
    )
  }

  if (state === "done" && imageUrl) {
    return (
      <div className="mt-4 border border-gray-800 rounded-2xl overflow-hidden bg-gray-900/50">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">🖼️ Visualización automática</span>
            <span className="text-[10px] text-gray-700">via {provider}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={regenerate}
              className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors px-2 py-1 rounded-lg hover:bg-gray-800"
            >
              🔄 Regenerar
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors px-2 py-1 rounded-lg hover:bg-gray-800"
            >
              {expanded ? "Ocultar ▲" : "Ver imagen ▼"}
            </button>
          </div>
        </div>

        {/* Imagen */}
        {expanded && (
          <div className="relative">
            <img
              src={imageUrl}
              alt={imagePrompt}
              className="w-full object-cover max-h-64"
            />
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-3">
              <p className="text-white/70 text-[10px] italic line-clamp-1">{imagePrompt}</p>
            </div>
          </div>
        )}
      </div>
    )
  }

  return null
}