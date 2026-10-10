"use client"

import { useState } from "react"
import { ArrowDown, ArrowUp, ExternalLink, FileText, Globe, Link2, Music2, PlayCircle, Plus, Trash2, Youtube } from "lucide-react"
import { getQrLinkPreview, MAX_QR_COLLECTION_LINKS, type QrCollectionLink } from "@/lib/qr/collection"

function Thumbnail({ url }: { url: string }) {
  const preview = getQrLinkPreview(url)
  if (preview.thumbnail) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={preview.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-16 w-24 shrink-0 rounded-lg object-cover bg-black/10" />
    )
  }
  const Icon = preview.kind === "spotify" || preview.kind === "music" ? Music2 : preview.kind === "drive" ? FileText : preview.kind === "youtube" ? Youtube : Globe
  return (
    <div className="h-16 w-24 shrink-0 rounded-lg flex items-center justify-center border border-soft bg-app">
      <Icon size={25} className="text-blue-400" aria-hidden="true" />
    </div>
  )
}

export function QrCollectionEditor({ links, onChange }: { links: QrCollectionLink[]; onChange: (next: QrCollectionLink[]) => void }) {
  const [draft, setDraft] = useState("")
  const [error, setError] = useState("")

  const append = () => {
    const input = draft.trim()
    if (links.length >= MAX_QR_COLLECTION_LINKS) return
    try {
      const parsed = new URL(input)
      if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password || input.length > 4096) {
        throw new Error("URL inválida")
      }
    } catch {
      setError("Ingresa un enlace http:// o https:// válido.")
      return
    }
    const preview = getQrLinkPreview(input)
    onChange([...links, { id: crypto.randomUUID(), url: input, title: preview.provider === "Sitio web" ? parsedHost(input) : "Recurso de " + preview.provider, description: "" }])
    setDraft("")
    setError("")
  }

  const update = (id: string, change: Partial<QrCollectionLink>) => {
    onChange(links.map((item) => item.id === id ? { ...item, ...change } : item))
  }
  const move = (index: number, offset: number) => {
    const target = index + offset
    if (target < 0 || target >= links.length) return
    const next = [...links]
    const previous = next[index]
    next[index] = next[target]
    next[target] = previous
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted2">Agrega hasta 25 enlaces y ordénalos. El QR seguirá siendo el mismo aunque luego edites la colección.</p>
      <div className="flex gap-2">
        <input value={draft} onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); append() } }}
          placeholder="Pega un enlace de YouTube, Spotify, Drive..."
          aria-label="Nuevo enlace" className="min-w-0 flex-1 rounded-xl border border-soft bg-transparent px-3 py-2.5 text-sm text-main outline-none" />
        <button type="button" disabled={!draft.trim() || links.length >= MAX_QR_COLLECTION_LINKS} onClick={append}
          className="rounded-xl bg-blue-600 text-white px-3 text-xs font-semibold disabled:opacity-40 inline-flex gap-1 items-center"><Plus size={16} /> Agregar</button>
      </div>
      {error && <p role="alert" className="text-red-400 text-xs">{error}</p>}
      <p className="text-xs text-muted2">{links.length} / {MAX_QR_COLLECTION_LINKS} enlaces</p>
      <div className="space-y-3">
        {links.map((item, index) => (
          <div key={item.id} className="rounded-2xl border border-soft bg-app p-3 space-y-2">
            <div className="flex gap-3 items-start">
              <Thumbnail url={item.url} />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-muted2 truncate">{getQrLinkPreview(item.url).provider} · Enlace {index + 1}</p>
                <p className="text-xs text-sub break-all line-clamp-2" title={item.url}>{item.url}</p>
              </div>
              <div className="flex gap-0.5 shrink-0">
                <button type="button" aria-label="Subir enlace" title="Subir" disabled={index === 0} onClick={() => move(index, -1)} className="p-1 text-muted2 disabled:opacity-20"><ArrowUp size={14} /></button>
                <button type="button" aria-label="Bajar enlace" title="Bajar" disabled={index === links.length - 1} onClick={() => move(index, 1)} className="p-1 text-muted2 disabled:opacity-20"><ArrowDown size={14} /></button>
                <button type="button" aria-label="Eliminar enlace" title="Eliminar enlace" onClick={() => onChange(links.filter((link) => link.id !== item.id))} className="p-1 text-red-400"><Trash2 size={14} /></button>
              </div>
            </div>
            <input aria-label={"Título del enlace " + (index + 1)} value={item.title} onChange={(event) => update(item.id, { title: event.target.value })}
              maxLength={160} placeholder="Título de este recurso" className="w-full rounded-lg border border-soft px-3 py-2 bg-transparent text-main text-xs" />
            <input aria-label={"Descripción del enlace " + (index + 1)} value={item.description} onChange={(event) => update(item.id, { description: event.target.value })}
              maxLength={600} placeholder="Descripción opcional" className="w-full rounded-lg border border-soft px-3 py-2 bg-transparent text-main text-xs" />
          </div>
        ))}
      </div>
    </div>
  )
}

function parsedHost(value: string) {
  try { return new URL(value).hostname.replace(/^www\./, "") } catch { return "Enlace" }
}

export function QrCollectionCards({ links }: { links: QrCollectionLink[] }) {
  const [playing, setPlaying] = useState<string | null>(null)
  return (
    <div className="space-y-3 mt-6">
      {links.map((item) => {
        const preview = getQrLinkPreview(item.url)
        const openPlayer = playing === item.id && preview.videoId
        return (
          <article key={item.id} className="rounded-2xl border border-soft p-3 sm:p-4 bg-app">
            <div className="flex gap-3 items-start">
              <Thumbnail url={item.url} />
              <div className="min-w-0 flex-1">
                <p className="text-main text-sm font-semibold break-words">{item.title}</p>
                <p className="text-[11px] text-muted2 mt-1">{preview.provider}</p>
                {item.description && <p className="text-xs text-sub mt-1 break-words">{item.description}</p>}
                <div className="flex flex-wrap gap-3 mt-2">
                  <a href={item.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"
                    className="text-xs text-blue-400 inline-flex gap-1 items-center"><ExternalLink size={13} /> Abrir enlace</a>
                  {preview.videoId && <button type="button" onClick={() => setPlaying(openPlayer ? null : item.id)}
                    className="text-xs text-blue-400 inline-flex gap-1 items-center"><PlayCircle size={13} /> {openPlayer ? "Cerrar video" : "Reproducir aquí"}</button>}
                </div>
              </div>
            </div>
            {openPlayer && (
              <div className="mt-3 rounded-xl overflow-hidden aspect-video bg-black">
                <iframe title={"Reproducir: " + item.title} loading="lazy" className="w-full h-full"
                  src={"https://www.youtube-nocookie.com/embed/" + preview.videoId}
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
              </div>
            )}
          </article>
        )
      })}
      <p className="text-center text-[11px] text-muted2 flex items-center justify-center gap-1"><Link2 size={12} /> Enlaces originales conservados íntegramente</p>
    </div>
  )
}
