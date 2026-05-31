"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Copy, Download, ExternalLink, Loader2, Plus, QrCode, RefreshCw } from "lucide-react"

type ResourceType = "url" | "text" | "notebook"
type Visibility = "public" | "authenticated"

type QrResource = {
  id: string
  short_code: string
  title: string
  description: string | null
  resource_type: ResourceType | "creator_project" | "asset"
  target_url: string | null
  text_content: string | null
  notebook_id: string | null
  visibility: Visibility
  expires_at: string | null
  scan_count: number
  created_at: string
}

type CreateResponse = {
  resource: QrResource
  share_url: string
  qr_image_url: string
}

export default function QrStudioPage() {
  const searchParams = useSearchParams()
  const notebookFromUrl = searchParams.get("notebookId") ?? ""

  const [resources, setResources] = useState<QrResource[]>([])
  const [resourceType, setResourceType] = useState<ResourceType>(notebookFromUrl ? "notebook" : "url")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [targetUrl, setTargetUrl] = useState("")
  const [textContent, setTextContent] = useState("")
  const [notebookId, setNotebookId] = useState(notebookFromUrl)
  const [visibility, setVisibility] = useState<Visibility>("public")
  const [expiresAt, setExpiresAt] = useState("")
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [created, setCreated] = useState<CreateResponse | null>(null)

  const origin = typeof window === "undefined" ? "" : window.location.origin

  const refreshResources = async () => {
    setRefreshing(true)
    try {
      const response = await fetch("/api/qr", { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "No se pudieron cargar los códigos QR")
      setResources(data.resources ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar códigos QR")
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    refreshResources()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const canSubmit = useMemo(() => {
    if (!title.trim()) return false
    if (resourceType === "url") return Boolean(targetUrl.trim())
    if (resourceType === "text") return Boolean(textContent.trim())
    if (resourceType === "notebook") return Boolean(notebookId.trim())
    return false
  }, [notebookId, resourceType, targetUrl, textContent, title])

  const createResource = async () => {
    if (!canSubmit) return
    setLoading(true)
    setError("")
    setCreated(null)
    try {
      const response = await fetch("/api/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          resource_type: resourceType,
          target_url: resourceType === "url" ? targetUrl : null,
          text_content: resourceType === "text" ? textContent : null,
          notebook_id: resourceType === "notebook" ? notebookId : null,
          visibility,
          expires_at: expiresAt || null,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "No se pudo generar el QR")
      setCreated(data)
      setTitle("")
      setDescription("")
      setTargetUrl("")
      setTextContent("")
      if (!notebookFromUrl) setNotebookId("")
      await refreshResources()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al generar el QR")
    } finally {
      setLoading(false)
    }
  }

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value)
  }

  return (
    <div className="min-h-screen bg-app">
      <div className="border-b border-soft bg-app sticky top-0 z-10 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "rgba(59,130,246,0.12)" }}>
              <QrCode size={21} className="text-blue-400" />
            </div>
            <div>
              <h1 className="text-main font-bold">QR Studio</h1>
              <p className="text-muted2 text-xs">Comparte enlaces, textos y cuadernos mediante un código QR.</p>
            </div>
          </div>
          <Link href="/creator-hub" className="text-xs text-blue-400 hover:underline">Volver a Creator Hub</Link>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 py-8 grid lg:grid-cols-[1.05fr_0.95fr] gap-6">
        <section className="rounded-3xl border border-soft p-5" style={{ background: "var(--bg-card-soft)" }}>
          <div className="flex items-center gap-2 mb-5">
            <Plus size={17} className="text-blue-400" />
            <h2 className="text-main font-semibold">Crear nuevo QR</h2>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            {([
              ["url", "🔗 Enlace"],
              ["text", "📝 Texto"],
              ["notebook", "📓 Chat Paper"],
            ] as Array<[ResourceType, string]>).map(([id, label]) => (
              <button key={id} onClick={() => setResourceType(id)}
                className="rounded-xl px-3 py-2.5 text-xs font-semibold border transition-all"
                style={{
                  color: resourceType === id ? "var(--accent-blue)" : "var(--text-muted)",
                  borderColor: resourceType === id ? "rgba(59,130,246,0.35)" : "var(--border-soft)",
                  background: resourceType === id ? "rgba(59,130,246,0.08)" : "transparent",
                }}>
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título del recurso"
              className="w-full rounded-xl border border-soft bg-transparent px-3 py-2.5 text-sm text-main outline-none" />
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descripción opcional"
              rows={2} className="w-full rounded-xl border border-soft bg-transparent px-3 py-2.5 text-sm text-main outline-none resize-none" />

            {resourceType === "url" && (
              <input value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} placeholder="https://..."
                className="w-full rounded-xl border border-soft bg-transparent px-3 py-2.5 text-sm text-main outline-none" />
            )}
            {resourceType === "text" && (
              <textarea value={textContent} onChange={(event) => setTextContent(event.target.value)} placeholder="Contenido que se mostrará al escanear"
                rows={7} className="w-full rounded-xl border border-soft bg-transparent px-3 py-2.5 text-sm text-main outline-none resize-y" />
            )}
            {resourceType === "notebook" && (
              <input value={notebookId} onChange={(event) => setNotebookId(event.target.value)} placeholder="ID del cuaderno de Chat Paper"
                className="w-full rounded-xl border border-soft bg-transparent px-3 py-2.5 text-sm text-main outline-none" />
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              <select value={visibility} onChange={(event) => setVisibility(event.target.value as Visibility)}
                className="rounded-xl border border-soft bg-app px-3 py-2.5 text-sm text-main outline-none">
                <option value="public">Público</option>
                <option value="authenticated">Solo usuarios registrados</option>
              </select>
              <input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)}
                className="rounded-xl border border-soft bg-app px-3 py-2.5 text-sm text-main outline-none" />
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button onClick={createResource} disabled={!canSubmit || loading}
              className="w-full rounded-xl px-4 py-3 text-sm font-bold text-white transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <QrCode size={16} />}
              Generar QR
            </button>
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-3xl border border-soft p-5 min-h-[300px]" style={{ background: "var(--bg-card-soft)" }}>
            <h2 className="text-main font-semibold mb-4">Vista previa</h2>
            {created ? (
              <div className="flex flex-col items-center gap-3 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={created.qr_image_url} alt={`QR ${created.resource.title}`} className="w-52 h-52 rounded-2xl bg-white p-2" />
                <p className="text-main font-semibold text-sm">{created.resource.title}</p>
                <p className="text-muted2 text-xs break-all">{created.share_url}</p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button onClick={() => copy(created.share_url)} className="px-3 py-2 rounded-xl border border-soft text-xs text-sub flex items-center gap-1.5">
                    <Copy size={13} /> Copiar enlace
                  </button>
                  <a href={`/api/qr/${created.resource.short_code}/download`} className="px-3 py-2 rounded-xl border border-soft text-xs text-sub flex items-center gap-1.5">
                    <Download size={13} /> Descargar PNG
                  </a>
                  <a href={created.share_url} target="_blank" rel="noreferrer" className="px-3 py-2 rounded-xl border border-soft text-xs text-sub flex items-center gap-1.5">
                    <ExternalLink size={13} /> Abrir
                  </a>
                </div>
              </div>
            ) : (
              <div className="h-56 flex flex-col items-center justify-center text-center gap-3">
                <QrCode size={55} className="text-muted2 opacity-35" />
                <p className="text-muted2 text-sm">Completa el formulario para generar un código QR descargable.</p>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-soft p-5" style={{ background: "var(--bg-card-soft)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-main font-semibold">Mis códigos QR</h2>
              <button onClick={refreshResources} title="Actualizar" className="p-2 rounded-xl border border-soft text-muted2">
                <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              </button>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {resources.length === 0 && <p className="text-muted2 text-xs">Todavía no has creado códigos QR.</p>}
              {resources.map((resource) => {
                const shareUrl = `${origin}/q/${resource.short_code}`
                return (
                  <div key={resource.id} className="rounded-2xl border border-soft p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-main text-sm font-semibold truncate">{resource.title}</p>
                        <p className="text-muted2 text-[11px] mt-1">{resource.resource_type} · {resource.scan_count} escaneos · {resource.visibility}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => copy(shareUrl)} className="p-1.5 rounded-lg text-muted2 hover:text-main" title="Copiar enlace"><Copy size={13} /></button>
                        <a href={`/api/qr/${resource.short_code}/download`} className="p-1.5 rounded-lg text-muted2 hover:text-main" title="Descargar PNG"><Download size={13} /></a>
                        <a href={shareUrl} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg text-muted2 hover:text-main" title="Abrir"><ExternalLink size={13} /></a>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
