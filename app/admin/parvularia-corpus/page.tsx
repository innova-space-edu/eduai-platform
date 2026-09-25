"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { ArrowLeft, BookOpen, BrainCircuit, Database, FileArchive, Loader2, RefreshCw, Upload } from "lucide-react"

type CorpusStats = {
  documents: number
  activities: number
  embeddedActivities: number
  pendingEmbeddings: number
  embeddingModel: string
  retrievalMode: string
}

type ImportResult = CorpusStats & {
  success: boolean
  corpusKey: string
  parsedDocuments: number
  legacyDocuments: number
  unsupportedDocuments: number
  levels: string[]
  categories: string[]
}

export default function ParvulariaCorpusAdminPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [stats, setStats] = useState<CorpusStats | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [corpusKey, setCorpusKey] = useState("sala-cuna-20200503")
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [vectorizing, setVectorizing] = useState(false)
  const [message, setMessage] = useState("")
  const [result, setResult] = useState<ImportResult | null>(null)

  async function loadStats() {
    setLoading(true)
    setMessage("")
    try {
      const response = await fetch("/api/admin/parvularia-corpus", { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "No se pudo consultar la biblioteca.")
      setStats(data)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo consultar la biblioteca.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadStats() }, [])

  async function importCorpus() {
    if (!file) return
    setUploading(true)
    setMessage("")
    setResult(null)
    try {
      const form = new FormData()
      form.append("file", file)
      form.append("corpusKey", corpusKey.trim() || "parvularia-manual")
      const response = await fetch("/api/admin/parvularia-corpus", { method: "POST", body: form })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "No fue posible importar el corpus.")
      setResult(data)
      setStats((current) => current ? { ...current, documents: data.documents, activities: data.activities } : current)
      setMessage("Corpus importado. Ahora puedes completar la indexación semántica para activar la búsqueda híbrida.")
      setFile(null)
      if (inputRef.current) inputRef.current.value = ""
      await loadStats()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible importar el corpus.")
    } finally {
      setUploading(false)
    }
  }


  async function vectorizePending() {
    setVectorizing(true)
    setMessage("")
    try {
      let totalEmbedded = 0
      for (let round = 0; round < 30; round += 1) {
        const form = new FormData()
        form.append("action", "embed")
        form.append("limit", "64")
        const response = await fetch("/api/admin/parvularia-corpus", { method: "POST", body: form })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "No fue posible indexar la biblioteca.")
        totalEmbedded += Number(data.embedded || 0)
        await loadStats()
        if (data.done || Number(data.attempted || 0) === 0) break
      }
      setMessage(`Indexación semántica actualizada: ${totalEmbedded} actividades vectorizadas en esta ejecución.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible indexar la biblioteca.")
    } finally {
      setVectorizing(false)
    }
  }

  return (
    <main className="min-h-screen bg-app px-4 py-6 md:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center gap-3">
          <Link href="/admin" className="flex h-9 w-9 items-center justify-center rounded-xl border border-soft bg-card-soft-theme text-sub">
            <ArrowLeft size={16} />
          </Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-pink-500/10 text-pink-500">
            <BookOpen size={20} />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-black text-main">Biblioteca pedagógica de Educación Parvularia</h1>
            <p className="mt-1 text-sm text-sub">Corpus privado para enriquecer actividades de APl y reducir repeticiones entre planificaciones.</p>
          </div>
          <button onClick={() => void loadStats()} className="flex items-center gap-2 rounded-xl border border-soft bg-card-soft-theme px-3 py-2 text-xs font-bold text-sub">
            <RefreshCw size={14} /> Actualizar
          </button>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-soft bg-card p-5">
            <div className="flex items-center gap-3">
              <Database size={19} className="text-blue-500" />
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-muted2">Documentos incorporados</p>
                <p className="mt-1 text-3xl font-black text-main">{loading ? "…" : stats?.documents ?? 0}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-soft bg-card p-5">
            <div className="flex items-center gap-3">
              <BookOpen size={19} className="text-emerald-500" />
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-muted2">Actividades estructuradas</p>
                <p className="mt-1 text-3xl font-black text-main">{loading ? "…" : stats?.activities ?? 0}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-soft bg-card p-5">
            <div className="flex items-center gap-3">
              <BrainCircuit size={19} className="text-violet-500" />
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-muted2">Indexadas semánticamente</p>
                <p className="mt-1 text-3xl font-black text-main">{loading ? "…" : stats?.embeddedActivities ?? 0}</p>
                <p className="mt-1 text-[11px] text-muted2">Pendientes: {loading ? "…" : stats?.pendingEmbeddings ?? 0}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-soft bg-card p-5 md:p-6">
          <div className="flex items-start gap-3">
            <FileArchive size={22} className="mt-0.5 text-pink-500" />
            <div>
              <h2 className="font-black text-main">Agregar documentos al corpus</h2>
              <p className="mt-1 text-sm leading-6 text-sub">Acepta ZIP con documentos Word o un DOCX individual. Los DOCX se analizan por tablas y cada experiencia queda clasificada por nivel, tema, OA/OAT, habilidades, evaluación y recursos. Los .DOC antiguos se registran como fuente para conversión posterior.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <div>
              <label className="mb-2 block text-xs font-black text-sub">Clave del corpus</label>
              <input
                value={corpusKey}
                onChange={(event) => setCorpusKey(event.target.value)}
                className="w-full rounded-xl border border-medium bg-input px-3 py-2.5 text-sm text-main outline-none focus:border-pink-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-black text-sub">Archivo ZIP / DOCX / DOC</label>
              <input
                ref={inputRef}
                type="file"
                accept=".zip,.docx,.doc"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                className="block w-full rounded-xl border border-medium bg-input px-3 py-2 text-xs text-sub"
              />
            </div>
            <button
              type="button"
              onClick={() => void importCorpus()}
              disabled={!file || uploading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-pink-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-40"
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {uploading ? "Importando…" : "Importar"}
            </button>
          </div>

          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
            Los documentos del corpus se guardan en Supabase, no en el repositorio público. APl también consulta las planificaciones Parvularia ya guardadas por cada usuario para no repetir actividades recientes.
          </div>

          {message && <p className="mt-4 rounded-xl border border-soft bg-card-soft-theme p-3 text-sm text-sub">{message}</p>}

          {result && (
            <div className="mt-4 grid gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-950 md:grid-cols-2">
              <p><strong>Documentos procesados:</strong> {result.documents}</p>
              <p><strong>Actividades extraídas:</strong> {result.activities}</p>
              <p><strong>DOCX analizados:</strong> {result.parsedDocuments}</p>
              <p><strong>DOC antiguos registrados:</strong> {result.legacyDocuments}</p>
              <p className="md:col-span-2"><strong>Niveles:</strong> {result.levels?.join(" · ") || "—"}</p>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-violet-200 bg-violet-50/70 p-5 md:p-6">
          <div className="flex flex-wrap items-start gap-3">
            <BrainCircuit size={22} className="mt-0.5 text-violet-600" />
            <div className="min-w-0 flex-1">
              <h2 className="font-black text-violet-950">EDUAI Cloud · búsqueda híbrida</h2>
              <p className="mt-1 text-sm leading-6 text-violet-950/80">La biblioteca combina coincidencia textual con embeddings de 768 dimensiones y Reciprocal Rank Fusion. También consulta documentos complementarios del corpus y mantiene la memoria antirrepetición del usuario.</p>
              <p className="mt-2 text-xs text-violet-900/70">Modelo: {stats?.embeddingModel || "gemini-embedding-2"} · Modo: {stats?.retrievalMode || "hybrid_rrf"}</p>
            </div>
            <button type="button" onClick={() => void vectorizePending()} disabled={vectorizing || loading || !stats?.pendingEmbeddings} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-40">
              {vectorizing ? <Loader2 size={16} className="animate-spin" /> : <BrainCircuit size={16} />}
              {vectorizing ? "Indexando…" : "Completar indexación"}
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-soft bg-card-soft-theme p-5">
          <h2 className="font-black text-main">Cómo lo usa APl</h2>
          <p className="mt-2 text-sm leading-6 text-sub">Para cada nueva planificación, APl recupera experiencias mediante búsqueda híbrida por subnivel, tema, núcleo y OA/OAT; descarta referencias demasiado similares a planificaciones guardadas o generaciones recientes; selecciona referencias diversas y obliga a la IA a cambiar de forma sustantiva la acción infantil, materiales, espacio, mediación y evidencia observable.</p>
        </section>
      </div>
    </main>
  )
}
