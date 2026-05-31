"use client"

import { useState } from "react"
import { Download, ImagePlus, Loader2, RefreshCw } from "lucide-react"

type ComicStyle = "manga" | "western" | "webtoon" | "child"

type Character = {
  name: string
  description: string
}

type Props = {
  panelIndex: number
  title: string
  scene: string
  topic: string
  audience: string
  educationalGoal: string
  style: ComicStyle
  characters: Character[]
}

const VISUAL_STYLE: Record<ComicStyle, string> = {
  manga: "black and white manga panel, clean ink line art, screentone shading, expressive faces, dynamic composition",
  western: "colorful western comic-book panel, clean outlines, cinematic framing, polished digital illustration",
  webtoon: "modern webtoon panel, clean digital illustration, vertical-friendly composition, soft polished colors",
  child: "friendly children's educational comic panel, simple readable shapes, colorful warm illustration",
}

const API_STYLE: Record<ComicStyle, string> = {
  manga: "anime",
  western: "digital art",
  webtoon: "anime",
  child: "educational",
}

export default function ComicPanelImage({
  panelIndex, title, scene, topic, audience, educationalGoal, style, characters,
}: Props) {
  const [imageUrl, setImageUrl] = useState("")
  const [provider, setProvider] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const buildPrompt = () => {
    const cast = characters
      .filter((character) => character.name.trim() || character.description.trim())
      .map((character) => `${character.name.trim() || "Personaje"}: ${character.description.trim()}`)
      .join(" | ")

    return [
      `Create one single comic illustration panel about: ${topic.trim() || "educational story"}.`,
      `Panel title: ${title}. Scene: ${scene}.`,
      `Keep the same character appearance across panels. Cast: ${cast || "student protagonist and educational guide"}.`,
      `Visual style: ${VISUAL_STYLE[style]}.`,
      educationalGoal.trim() ? `Educational goal: ${educationalGoal.trim()}.` : "",
      `Audience: ${audience.trim() || "students"}.`,
      "No written words, no captions, no speech bubbles, no logo, no signature, no watermark. Dialogue is added separately in the editor.",
      "Clear single-panel composition with the important action fully visible.",
    ].filter(Boolean).join(" ")
  }

  const generate = async () => {
    if (loading) return
    setLoading(true)
    setError("")
    try {
      const vertical = style === "webtoon"
      const response = await fetch("/api/agents/imagenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: buildPrompt(),
          style: API_STYLE[style],
          width: vertical ? 768 : 1024,
          height: vertical ? 1024 : 768,
          provider: "auto",
          mode: "quality",
          source: "comic_panel",
          topic: topic.trim() || "comic educational project",
          educationalContext: `${audience}. ${educationalGoal}`,
        }),
      })

      if (!response.ok) throw new Error(await response.text())
      const data = await response.json()
      setImageUrl(data.imageUrl)
      setProvider(data.model ? `${data.provider} · ${data.model}` : data.provider)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo generar la imagen")
    } finally {
      setLoading(false)
    }
  }

  const download = () => {
    if (!imageUrl) return
    const anchor = document.createElement("a")
    anchor.href = imageUrl
    anchor.download = `eduai-comic-panel-${panelIndex + 1}.png`
    anchor.click()
  }

  return (
    <div className="mb-3">
      <div className="relative overflow-hidden rounded-xl border border-soft aspect-[4/3] flex items-center justify-center" style={{ background: "var(--bg-input)" }}>
        {imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={`Viñeta ${panelIndex + 1}: ${title}`} className="w-full h-full object-cover" />
            <div className="absolute right-2 bottom-2 flex gap-1">
              <button onClick={download} title="Descargar imagen" className="w-8 h-8 rounded-lg flex items-center justify-center text-white bg-black/60 backdrop-blur-sm">
                <Download size={14} />
              </button>
              <button onClick={generate} title="Regenerar imagen" className="w-8 h-8 rounded-lg flex items-center justify-center text-white bg-black/60 backdrop-blur-sm">
                <RefreshCw size={14} />
              </button>
            </div>
          </>
        ) : loading ? (
          <div className="flex flex-col items-center gap-2 text-center p-4">
            <Loader2 size={25} className="animate-spin text-pink-400" />
            <p className="text-muted2 text-xs">Generando imagen...</p>
          </div>
        ) : (
          <button onClick={generate} className="flex flex-col items-center gap-2 text-muted2 hover:text-main transition-colors p-4">
            <ImagePlus size={28} />
            <span className="text-xs font-semibold">Generar imagen</span>
          </button>
        )}
      </div>
      {provider && <p className="text-[10px] text-muted2 mt-1 truncate">Motor: {provider}</p>}
      {error && <p className="text-[11px] text-red-400 mt-1 whitespace-pre-wrap line-clamp-4">{error}</p>}
    </div>
  )
}
