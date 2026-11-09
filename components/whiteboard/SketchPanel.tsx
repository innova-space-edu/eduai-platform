"use client"

import katex from "katex"
import "katex/dist/katex.min.css"
import { useEffect, useRef, useState } from "react"
import type { Sketch } from "./sketch"

export function Formula({ source }: { source: string }) {
  try {
    const html = katex.renderToString(source, { output: "mathml", trust: false, throwOnError: true, maxExpand: 200, maxSize: 12 })
    return <span dangerouslySetInnerHTML={{ __html: html }} />
  } catch {
    return <span>Revisa la expresión matemática.</span>
  }
}

type InkStroke = { id: string; points: { x: number; y: number }[] }
type Choice = { id: string; label: string }
type Props = {
  strokes: InkStroke[]
  sketch: Sketch | null
  solids: Choice[]
  canConvertVector: boolean
  canExtrude: boolean
  convert: (type: "figure" | "axes" | "vector" | "solid" | "extrude", solid?: string) => void
  insertText: (source: string, formula: boolean) => void
}

export default function SketchPanel({ strokes, sketch, solids, canConvertVector, canExtrude, convert, insertText }: Props) {
  const [solid, setSolid] = useState(solids[0].id)
  const [source, setSource] = useState("")
  const [format, setFormat] = useState<"formula" | "text">("formula")
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState(false)
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])

  async function transcribe() {
    const controller = new AbortController()
    pending.current = controller
    setBusy(true)
    setStatus("")
    try {
      const response = await fetch("/api/whiteboard/recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strokes }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(45000)]),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "No se pudo transcribir la selección.")
      if (controller.signal.aborted) return
      if (data.latex) {
        setFormat("formula")
        const latex = data.blocks?.filter((block: { latex?: string }) => block.latex).length > 1
          ? `\\begin{gathered}${data.latex}\\end{gathered}`
          : data.latex
        setSource(String(latex).slice(0, 2000))
        setStatus("Revisa la transcripción antes de insertarla.")
      } else {
        const text = data.blocks?.map((block: { text?: string }) => block.text).filter(Boolean).join("\n")
        if (!text) throw new Error("No se reconoció la escritura. Puedes transcribirla manualmente.")
        setFormat("text")
        setSource(String(text).slice(0, 2000))
      }
    } catch (error) {
      if (!controller.signal.aborted) setStatus(error instanceof Error ? error.message : "No se pudo transcribir.")
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  const control = "rounded-lg border border-indigo-200 bg-white px-2 py-1.5 text-xs font-semibold disabled:opacity-40"
  return <fieldset className="space-y-2 rounded-xl border border-indigo-200 bg-indigo-50 p-2">
    <legend className="px-1 text-xs font-bold text-indigo-800">Convertir boceto</legend>
    <p className="text-xs text-slate-700">
      {strokes.length ? `${strokes.length} trazos seleccionados` : "Dibuja con el lápiz. Luego encierra los trazos arrastrando sobre la hoja."}
    </p>
    {strokes.length > 0 && <>
      <p className="text-xs text-slate-600">Al convertir se reemplazan los trazos seleccionados. Puedes recuperarlos con Deshacer.</p>
      <div className="flex flex-wrap gap-1">
        {sketch && <button className={control} onClick={() => convert(sketch.kind === "axes" ? "axes" : "figure")}>
          {sketch.kind === "axes" ? "Crear plano 2D" : "Crear figura 2D"}
        </button>}
        <button className={control} disabled={!canConvertVector} onClick={() => convert("vector")}>Crear vector</button>
        {canExtrude && <button className={control} onClick={() => convert("extrude")}>Extruir polígono</button>}
      </div>
      {!sketch && <p className="text-xs text-slate-600">Para una figura 2D, cierra el contorno. Para un plano, dibuja dos ejes cruzados.</p>}
      <label className="block text-xs font-semibold">Interpretar boceto como
        <select className="mt-1 w-full rounded-lg border bg-white p-1 text-xs" value={solid} onChange={event => setSolid(event.target.value)}>
          {solids.map(choice => <option key={choice.id} value={choice.id}>{choice.label}</option>)}
        </select>
      </label>
      <button className={control} onClick={() => convert("solid", solid)}>Crear modelo</button>
      <button className={control} disabled={busy || strokes.length > 60} onClick={() => void transcribe()}>
        {busy ? "Transcribiendo…" : "Transcribir selección con IA"}
      </button>
      {strokes.length > 60 && <p className="text-xs">Selecciona hasta 60 trazos para transcribir.</p>}
    </>}
    <label className="block text-xs font-semibold">Formato
      <select className="mt-1 w-full rounded-lg border bg-white p-1 text-xs" value={format}
        onChange={event => setFormat(event.target.value === "text" ? "text" : "formula")}>
        <option value="formula">Fórmula</option>
        <option value="text">Texto</option>
      </select>
    </label>
    <textarea aria-label="Texto o fórmula para insertar" rows={2} maxLength={2000} value={source}
      placeholder={format === "formula" ? "Ejemplo: x^2 + y^2 = 25" : "Escribe tus anotaciones"}
      onChange={event => setSource(event.target.value)} className="w-full rounded-lg border bg-white p-2 text-xs" />
    {format === "formula" && source.trim() && <div className="overflow-auto rounded bg-white p-2"><Formula source={source.trim()} /></div>}
    <button className={control} disabled={!source.trim()} onClick={() => insertText(source.trim(), format === "formula")}>
      Insertar {format === "formula" ? "fórmula" : "texto"}
    </button>
    {status && <p role="status" className="text-xs text-slate-700">{status}</p>}
  </fieldset>
}
