"use client"
// hooks/useNotebook.ts
// Hook central para el estado del notebook workspace

import { useCallback, useEffect, useRef, useState } from "react"
import type { Notebook, NotebookSource, NotebookSummary } from "@/lib/notebook/types"

export function useNotebook(notebookId: string) {
  const [notebook, setNotebook]   = useState<Notebook | null>(null)
  const [sources,  setSources]    = useState<NotebookSource[]>([])
  const [summary,  setSummary]    = useState<NotebookSummary | null>(null)
  const [loading,  setLoading]    = useState(true)
  const [error,    setError]      = useState<string | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  // ─── Carga inicial ────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    try {
      const [nbRes, srcRes, sumRes] = await Promise.all([
        fetch(`/api/notebooks/${notebookId}`),
        fetch(`/api/notebooks/${notebookId}/sources`),
        fetch(`/api/notebooks/${notebookId}/summary`),
      ])
      const [nb, src, sum] = await Promise.all([
        nbRes.json(), srcRes.json(), sumRes.json(),
      ])
      if (nb.notebook)  setNotebook(nb.notebook)
      if (src.sources)  setSources(src.sources)
      if (sum.summary)  setSummary(sum.summary)
    } catch {
      setError("Error cargando el cuaderno")
    } finally {
      setLoading(false)
    }
  }, [notebookId])

  useEffect(() => { load() }, [load])

  // ─── Polling de fuentes en procesamiento ─────────────────────────────────

  useEffect(() => {
    const hasPending = sources.some(
      (s) => s.status === "pending" || s.status === "processing"
    )

    if (hasPending) {
      pollRef.current = setInterval(async () => {
        const res  = await fetch(`/api/notebooks/${notebookId}/sources`)
        const data = await res.json()
        if (data.sources) setSources(data.sources)
      }, 3000)
    } else {
      if (pollRef.current) clearInterval(pollRef.current)
    }

    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [notebookId, sources])

  // ─── Acciones ─────────────────────────────────────────────────────────────

  const refreshSources = useCallback(async () => {
    const res  = await fetch(`/api/notebooks/${notebookId}/sources`)
    const data = await res.json()
    if (data.sources) setSources(data.sources)
  }, [notebookId])

  const refreshSummary = useCallback(async () => {
    const res  = await fetch(`/api/notebooks/${notebookId}/summary`)
    const data = await res.json()
    if (data.summary) setSummary(data.summary)
  }, [notebookId])

  const updateNotebook = useCallback(async (updates: Partial<Notebook>) => {
    const res  = await fetch(`/api/notebooks/${notebookId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(updates),
    })
    const data = await res.json()
    if (data.notebook) setNotebook(data.notebook)
    return data.notebook
  }, [notebookId])

  // ─── Computed ─────────────────────────────────────────────────────────────

  const hasReadySources  = sources.some((s) => s.status === "ready" && s.is_active)
  const activeSources    = sources.filter((s) => s.is_active)
  const processingCount  = sources.filter(
    (s) => s.status === "pending" || s.status === "processing"
  ).length

  return {
    notebook,
    sources,
    summary,
    loading,
    error,
    hasReadySources,
    activeSources,
    processingCount,
    refreshSources,
    refreshSummary,
    updateNotebook,
    reload: load,
  }
}
