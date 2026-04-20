"use client"

import { useEffect, useMemo, useState } from "react"

type WebSearchResult = {
  title: string
  url: string
  snippet?: string
  source?: string
}

type Props = {
  notebookId: string
  sources: any[]
  onSourcesChange: () => void | Promise<void>
}

function normalizeUrl(url: string) {
  try {
    return new URL(url).toString().replace(/\/$/, "")
  } catch {
    return url.trim()
  }
}

export default function SourcePanel({ notebookId, sources, onSourcesChange }: Props) {
  const [urlInput, setUrlInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [addingAll, setAddingAll] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [webQuery, setWebQuery] = useState("")
  const [webResults, setWebResults] = useState<WebSearchResult[]>([])

  const existingUrlSet = useMemo(() => {
    const set = new Set<string>()
    for (const s of sources || []) {
      if (s?.url) set.add(normalizeUrl(s.url))
    }
    return set
  }, [sources])

  // ─────────────────────────────────────────────
  // 🔹 NUEVO: ingest robusto web
  // ─────────────────────────────────────────────
  const ingestWebUrl = async (payload: {
    url: string
    title?: string
    metadata?: Record<string, unknown>
  }) => {
    const res = await fetch("/api/web/ingest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        notebookId,
        url: payload.url,
        title: payload.title,
        metadata: payload.metadata ?? {},
      }),
    })

    const data = await res.json().catch(() => ({}))

    if (res.status === 409) {
      return { duplicated: true }
    }

    if (!res.ok) {
      throw new Error(data?.error || `Error HTTP ${res.status}`)
    }

    return { duplicated: false }
  }

  // ─────────────────────────────────────────────
  // 🔹 BUSCAR EN WEB (simulado o API tuya)
  // ─────────────────────────────────────────────
  const searchWeb = async () => {
    if (!webQuery.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/web/search?q=" + encodeURIComponent(webQuery))
      const data = await res.json()
      setWebResults(data.results || [])
    } catch {
      setError("Error buscando en la web")
    } finally {
      setLoading(false)
    }
  }

  // ─────────────────────────────────────────────
  // 🔹 AGREGAR UNA WEB (CORREGIDO)
  // ─────────────────────────────────────────────
  const addWebResult = async (result: WebSearchResult) => {
    if (existingUrlSet.has(normalizeUrl(result.url))) {
      setMessage("Esta fuente ya está en el cuaderno.")
      return
    }

    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      const { duplicated } = await ingestWebUrl({
        url: result.url,
        title: result.title,
        metadata: {
          snippet: result.snippet,
          source: result.source ?? "web-search",
          search_query: webQuery,
        },
      })

      setMessage(
        duplicated
          ? "La fuente ya existía en el cuaderno."
          : `Fuente agregada: ${result.title}`
      )

      await onSourcesChange()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // ─────────────────────────────────────────────
  // 🔹 AGREGAR TODAS (CORREGIDO)
  // ─────────────────────────────────────────────
  const addAllResults = async () => {
    if (!webResults.length) return

    setAddingAll(true)
    setError(null)
    setMessage(null)

    let added = 0
    let skipped = 0
    let failed = 0

    try {
      for (const r of webResults) {
        if (existingUrlSet.has(normalizeUrl(r.url))) {
          skipped++
          continue
        }

        try {
          const { duplicated } = await ingestWebUrl({
            url: r.url,
            title: r.title,
            metadata: {
              snippet: r.snippet,
              source: r.source ?? "web-search",
              search_query: webQuery,
            },
          })

          if (duplicated) skipped++
          else added++
        } catch {
          failed++
        }
      }

      await onSourcesChange()
      setMessage(`Agregadas: ${added} | Omitidas: ${skipped} | Fallidas: ${failed}`)
    } finally {
      setAddingAll(false)
    }
  }

  // ─────────────────────────────────────────────
  // 🔹 URL MANUAL (flujo viejo OK)
  // ─────────────────────────────────────────────
  const addManualUrl = async () => {
    if (!urlInput.trim()) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/notebooks/${notebookId}/sources`, {
        method: "POST",
        body: JSON.stringify({
          type: "url",
          url: urlInput,
        }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      // luego procesa
      await fetch(`/api/notebooks/${notebookId}/ingest`, {
        method: "POST",
        body: JSON.stringify({
          sourceId: data.source.id,
        }),
      })

      setUrlInput("")
      await onSourcesChange()
      setMessage("Fuente agregada y procesada")
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // ─────────────────────────────────────────────
  // UI
  // ─────────────────────────────────────────────
  return (
    <div className="p-4 space-y-4">
      <h2 className="font-bold">Fuentes</h2>

      {message && <div className="text-green-600">{message}</div>}
      {error && <div className="text-red-500">{error}</div>}

      {/* URL manual */}
      <div className="flex gap-2">
        <input
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="Agregar URL..."
          className="border p-2 flex-1"
        />
        <button onClick={addManualUrl} disabled={loading}>
          Agregar y procesar
        </button>
      </div>

      {/* buscador web */}
      <div className="flex gap-2">
        <input
          value={webQuery}
          onChange={(e) => setWebQuery(e.target.value)}
          placeholder="Buscar en web..."
          className="border p-2 flex-1"
        />
        <button onClick={searchWeb}>Buscar</button>
      </div>

      {webResults.length > 0 && (
        <div>
          <button onClick={addAllResults} disabled={addingAll}>
            Agregar todas las referencias
          </button>

          <div className="space-y-2 mt-2">
            {webResults.map((r, i) => (
              <div key={i} className="border p-2">
                <div className="font-semibold">{r.title}</div>
                <div className="text-sm">{r.snippet}</div>
                <button onClick={() => addWebResult(r)}>
                  Agregar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
