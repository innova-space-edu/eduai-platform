"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

type Submission = {
  id: string
  created_at: string
  material: {
    title: string
    subject: string
    educational_level: string
    school_year: number
    source_type: "file" | "youtube"
    original_file_name?: string
    youtube_video_id?: string
  }
}

const endpoint = "/api/repository/moderation"
const button = "rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"

export default function RepositoryModeration() {
  const [items, setItems] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch(endpoint, { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "No fue posible cargar los envíos.")
      setItems(data.submissions)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible cargar los envíos.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function review(item: Submission, action: "approve" | "reject") {
    if (!window.confirm(action === "approve" ? `¿Publicar «${item.material.title}» en la nube?` : `¿Rechazar «${item.material.title}»?`)) return
    setBusy(item.id)
    setError("")
    setNotice("")
    try {
      const response = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, action }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "No fue posible registrar la decisión.")
      await load()
      setNotice(action === "approve" ? "Material publicado." : "Envío rechazado.")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible registrar la decisión.")
    } finally {
      setBusy(null)
    }
  }

  return <main className="mx-auto min-h-screen max-w-4xl space-y-5 p-6">
    <Link href="/repositorio" className="text-sm font-semibold text-blue-700">Volver a Nube EduAI</Link>
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-2xl font-bold">Envíos pendientes</h1>
        <p className="mt-1 text-sm text-slate-600">Revisa los aportes recibidos desde el enlace público.</p></div>
      <button className={button} disabled={loading || busy !== null} onClick={() => void load()}>Actualizar</button>
    </header>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-emerald-800">{notice}</p>}
    {loading ? <p>Cargando envíos…</p> : !error && !items.length ? <p>No hay envíos pendientes.</p> : null}
    {!loading && items.map(item => <article key={item.id} className="space-y-3 rounded-xl border p-4">
      <div><h2 className="font-semibold">{item.material.title}</h2>
        <p className="text-sm text-slate-600">{item.material.subject} · {item.material.educational_level} · {item.material.school_year}</p>
        {item.material.original_file_name && <p className="break-all text-sm">{item.material.original_file_name}</p>}</div>
      <div className="flex flex-wrap gap-2">
        {item.material.source_type === "file" ? <a className={button} href={`${endpoint}?file=${item.id}`}>Descargar para revisar</a>
          : <a className={button} href={`https://www.youtube.com/watch?v=${encodeURIComponent(item.material.youtube_video_id || "")}`} target="_blank" rel="noreferrer">Revisar video</a>}
        <button className={`${button} bg-emerald-700 text-white`} disabled={busy !== null} onClick={() => void review(item, "approve")}>Aprobar y publicar</button>
        <button className={`${button} text-red-700`} disabled={busy !== null} onClick={() => void review(item, "reject")}>Rechazar</button>
      </div>
    </article>)}
  </main>
}
