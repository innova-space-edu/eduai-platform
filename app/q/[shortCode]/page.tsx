"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"

type SharedResource = {
  title: string
  description: string | null
  resource_type: "url" | "text" | "notebook" | "creator_project" | "asset"
  target_url: string | null
  text_content: string | null
  notebook_id: string | null
  visibility: "public" | "authenticated"
  expires_at: string | null
}

export default function SharedQrResourcePage() {
  const { shortCode } = useParams() as { shortCode: string }
  const [resource, setResource] = useState<SharedResource | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch(`/api/qr/${encodeURIComponent(shortCode)}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || "Recurso no disponible")
        return body.resource as SharedResource
      })
      .then(setResource)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Recurso no disponible"))
  }, [shortCode])

  return (
    <main className="min-h-screen bg-app px-5 py-10">
      <section className="max-w-2xl mx-auto rounded-3xl border border-soft p-6" style={{ background: "var(--bg-card-soft)" }}>
        <p className="text-blue-400 text-xs font-bold mb-3">EDUAI QR STUDIO</p>
        {!resource && !error && <p className="text-muted2 text-sm">Abriendo recurso...</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {resource && (
          <div>
            <h1 className="text-main text-2xl font-bold">{resource.title}</h1>
            {resource.description && <p className="text-muted2 text-sm mt-3">{resource.description}</p>}
            {resource.resource_type === "text" && <p className="text-sub text-sm whitespace-pre-wrap mt-6">{resource.text_content}</p>}
            {resource.resource_type === "url" && resource.target_url && (
              <div className="mt-6">
                <p className="text-muted2 text-xs mb-2">Enlace externo compartido:</p>
                <p className="text-sub text-sm break-all">{resource.target_url}</p>
                <a href={resource.target_url} target="_blank" rel="noopener noreferrer" className="inline-block mt-4 rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}>
                  Abrir enlace externo
                </a>
              </div>
            )}
            {resource.resource_type === "notebook" && resource.notebook_id && (
              <div className="mt-6">
                <p className="text-muted2 text-sm">Este recurso corresponde a un cuaderno de Chat Paper y mantiene los permisos de acceso de EduAI.</p>
                <a href={`/notebooks/${resource.notebook_id}`} className="inline-block mt-4 rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}>
                  Abrir Chat Paper
                </a>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  )
}
