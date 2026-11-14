"use client"

import { EXAM_IMPORT_MAX_BYTES, EXAM_IMPORT_MAX_LABEL } from "@/lib/exam/creator-limits"
import { useEffect, useMemo, useRef, useState } from "react"
import ExamMathText from "@/components/ui/ExamMathText"

export type ExamDocumentImportResult = {
  success: boolean
  exam: { title?: string; topic?: string; instructions?: string }
  questions: any[]
  preview: {
    questionCount: number
    explicitAnswers: number
    inferredAnswers: number
    missingAnswers: number
    imageReferences: number
    imagesDetected: number
    imagesUsed: number
    fileName: string
    fileType: "pdf" | "docx"
    model?: string
  }
  warnings: string[]
}

type Props = {
  onApply: (result: ExamDocumentImportResult, mode: "replace" | "append") => boolean | void
  result?: ExamDocumentImportResult | null
  onResultChange?: (value: ExamDocumentImportResult | null) => void
  inferAnswers?: boolean
  onInferAnswersChange?: (value: boolean) => void
  onBusyChange?: (busy: boolean) => void
}

const MAX_BYTES = EXAM_IMPORT_MAX_BYTES

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function ExamDocumentImporter({ onApply, result: controlledResult, onResultChange, inferAnswers: controlledInferAnswers, onInferAnswersChange, onBusyChange }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const requestRef = useRef<AbortController | null>(null)
  const applyingRef = useRef(false)
  useEffect(() => () => requestRef.current?.abort(), [])
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [localInferAnswers, setLocalInferAnswers] = useState(false)
  const inferAnswers = controlledInferAnswers ?? localInferAnswers
  const setInferAnswers = onInferAnswersChange ?? setLocalInferAnswers
  const mode = "append" as const
  const [status, setStatus] = useState<"idle" | "analyzing" | "ready" | "error" | "applied">("idle")
  useEffect(() => { onBusyChange?.(status === "analyzing") }, [status, onBusyChange])
  const [error, setError] = useState("")
  const [localResult, setLocalResult] = useState<ExamDocumentImportResult | null>(null)
  const result = controlledResult === undefined ? localResult : controlledResult
  const setResult = onResultChange ?? setLocalResult
  useEffect(() => { if (result && status === "idle") setStatus("ready"); else if (!result && status === "ready") setStatus("idle") }, [result, status])

  const canApply = useMemo(() => {
    if (!result || status !== "ready") return false
    if (result.preview.missingAnswers > 0) return false
    return result.questions.length > 0 && result.questions.every((q: any) => q && ["file", "ai_inferred"].includes(q.answerSource) && String(q.question || "").trim() && (q.type === "development" || (Number.isInteger(q.correctAnswer) && q.correctAnswer >= 0 && q.correctAnswer < (q.type === "true_false" ? 2 : (q.options?.length ?? 0)))) && ((q.type !== "development" && q.type !== "mixed_choice_development") || String(q.modelAnswer || q.expectedLatex || "").trim()))
  }, [result, status])

  function chooseFile(next: File | null) {
    requestRef.current?.abort()
    requestRef.current = null
    applyingRef.current = false
    setError("")
    setResult(null)
    setStatus("idle")
    if (!next) {
      setFile(null)
      return
    }

    const lower = next.name.toLowerCase()
    if (!lower.endsWith(".pdf") && !lower.endsWith(".docx")) {
      setFile(null)
      setError("Selecciona un archivo PDF o DOCX.")
      setStatus("error")
      return
    }
    if (next.size <= 0 || next.size > MAX_BYTES) {
      setFile(null)
      setError(`El archivo debe pesar como máximo ${EXAM_IMPORT_MAX_LABEL}.`)
      setStatus("error")
      return
    }
    setFile(next)
  }

  async function analyze() {
    if (!file || requestRef.current) return
    const controller = new AbortController()
    requestRef.current = controller
    applyingRef.current = false
    setStatus("analyzing")
    setError("")
    setResult(null)

    try {
      const form = new FormData()
      form.append("file", file)
      form.append("inferAnswers", inferAnswers ? "true" : "false")

      const response = await fetch("/api/agents/exam-import", {
        method: "POST",
        body: form,
        signal: controller.signal,
      })
      if (response.status === 413) throw new Error(`El archivo debe pesar como máximo ${EXAM_IMPORT_MAX_LABEL}.`)
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "No se pudo analizar la evaluación.")
      }

      if (controller.signal.aborted || requestRef.current !== controller) return
      if (!Array.isArray(data.questions) || !data.questions.length || !data.preview || typeof data.preview.missingAnswers !== "number") throw new Error("El análisis devolvió un resultado incompleto. Vuelve a intentarlo.")
      setResult(data as ExamDocumentImportResult)
      setStatus("ready")
    } catch (e) {
      if (controller.signal.aborted || requestRef.current !== controller) return
      setError(e instanceof Error ? e.message : "No se pudo analizar la evaluación.")
      setStatus("error")
    } finally {
      if (requestRef.current === controller) requestRef.current = null
    }
  }

  function apply() {
    if (!result || !canApply || applyingRef.current) return
    applyingRef.current = true
    try {
      if (onApply(result, mode) === false) { applyingRef.current = false; return }
      setStatus("applied")
    } catch (e) {
      applyingRef.current = false
      setError(e instanceof Error ? e.message : "No se pudo aplicar la importación.")
    }
  }

  return (
    <div className="rounded-[26px] border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-4 md:p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-sky-600">Importación de archivo</p>
          <h3 className="mt-1 text-base font-black text-slate-950">Importar evaluación existente — PDF / Word</h3>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-600">
            EduAI transcribe preguntas, alternativas, imágenes, puntajes y notación matemática al mismo creador. Antes de aplicar podrás revisar qué se detectó.
          </p>
        </div>
        <span className="rounded-full border border-sky-200 bg-white px-3 py-1 text-[11px] font-bold text-sky-700">PDF · DOCX · máx. {EXAM_IMPORT_MAX_LABEL}</span>
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label="Seleccionar evaluación PDF o Word"
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click() } }}
        onDragEnter={(e) => { e.preventDefault(); setDragging(true) }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={(e) => { e.preventDefault(); setDragging(false) }}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          chooseFile(e.dataTransfer.files?.[0] || null)
        }}
        onClick={() => inputRef.current?.click()}
        className={`mt-4 cursor-pointer rounded-2xl border-2 border-dashed px-4 py-6 text-center transition ${dragging ? "border-sky-500 bg-sky-100" : "border-sky-200 bg-white hover:border-sky-400 hover:bg-sky-50"}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => { const selected = e.target.files?.[0]; e.target.value = ""; if (selected) chooseFile(selected) }}
        />
        <div className="text-3xl">📄</div>
        {file ? (
          <>
            <p className="mt-2 text-sm font-black text-slate-900">{file.name}</p>
            <p className="text-xs text-slate-500">{formatBytes(file.size)} · clic para cambiar</p>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm font-black text-slate-900">Arrastra aquí tu evaluación</p>
            <p className="text-xs text-slate-500">o haz clic para seleccionar PDF / DOCX</p>
          </>
        )}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3">
          <input
            type="checkbox"
            checked={inferAnswers}
            onChange={(e) => {
              requestRef.current?.abort()
              requestRef.current = null
              applyingRef.current = false
              setInferAnswers(e.target.checked)
              setResult(null)
              setError("")
              setStatus("idle")
            }}
            className="mt-1 h-4 w-4"
          />
          <span>
            <span className="block text-xs font-black text-slate-900">Resolver respuestas faltantes con IA</span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">
              Desactivado por defecto. Si el archivo no trae solucionario, EduAI solo podrá aplicar la importación cuando actives esta opción y vuelvas a analizar.
            </span>
          </span>
        </label>

        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-black text-slate-900">Al aplicar</p>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-900">Agregar al final<br/><span className="font-normal">Se conservan las preguntas existentes.</span></div>
        </div>
      </div>

      <button
        type="button"
        onClick={analyze}
        disabled={!file || status === "analyzing"}
        className="mt-4 w-full rounded-2xl bg-sky-600 px-4 py-3 text-sm font-black text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "analyzing" ? "Analizando estructura, fórmulas e imágenes..." : "Analizar evaluación"}
      </button>

      {status === "analyzing" && <button type="button" onClick={() => { requestRef.current?.abort(); requestRef.current = null; setStatus("idle") }} className="mt-2 w-full rounded-xl border border-sky-200 px-3 py-2 text-xs font-bold text-sky-700">Cancelar análisis</button>}
      {error && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">❌ {error}</div>
      )}

      {result && (
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["Preguntas", result.preview.questionCount],
              ["Imágenes", `${result.preview.imagesUsed}/${result.preview.imagesDetected}`],
              ["Pauta archivo", result.preview.explicitAnswers],
              ["Pauta IA", result.preview.inferredAnswers],
              ["Sin respuesta", result.preview.missingAnswers],
              ["Formato", result.preview.fileType.toUpperCase()],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-0.5 text-sm font-black text-slate-900">{value}</p>
              </div>
            ))}
          </div>

          {result.preview.missingAnswers > 0 && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
              <strong>Importación bloqueada:</strong> hay {result.preview.missingAnswers} pregunta{result.preview.missingAnswers !== 1 ? "s" : ""} sin respuesta conocida. Activa “Resolver respuestas faltantes con IA” y vuelve a analizar, o agrega la pauta en el archivo.
            </div>
          )}

          {result.warnings?.length > 0 && (
            <details className="rounded-2xl border border-amber-200 bg-white px-4 py-3">
              <summary className="cursor-pointer text-xs font-black text-amber-800">Advertencias de importación ({result.warnings.length})</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[11px] leading-relaxed text-amber-700">
                {result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}
              </ul>
            </details>
          )}

          <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {result.questions.map((q: any, index: number) => (
              <div key={index} className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-700">P{index + 1}</span>
                    <span className="text-[10px] font-bold uppercase text-slate-500">{q.type}</span>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${q.answerSource === "file" ? "bg-emerald-100 text-emerald-700" : q.answerSource === "ai_inferred" ? "bg-violet-100 text-violet-700" : "bg-amber-100 text-amber-700"}`}>
                    {q.answerSource === "file" ? "Respuesta del archivo" : q.answerSource === "ai_inferred" ? "Respuesta inferida por IA" : "Sin respuesta"}
                  </span>
                </div>
                <ExamMathText text={q.question || ""} className="mt-2 text-xs font-semibold leading-relaxed text-slate-900" />
                {q.imageUrl && (
                  <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={q.imageUrl} alt={`Apoyo visual pregunta ${index + 1}`} className="max-h-44 w-full object-contain" />
                  </div>
                )}
                <p className="mt-1 text-[11px] text-slate-500">Puntaje: {q.maxPoints ?? "Revisar"} pts{q.sourcePage ? ` · Página ${q.sourcePage}` : ""}</p>
                {q.answerSource !== "missing" && (q.modelAnswer || q.expectedLatex || q.explanation) && <div className="mt-2 rounded-lg bg-emerald-50 p-2 text-[11px] text-emerald-900"><p className="font-bold">Pauta detectada</p><ExamMathText text={String(q.modelAnswer || q.expectedLatex || q.explanation)} /></div>}
                {Array.isArray(q.options) && q.options.length > 0 && (
                  <div className="mt-2 grid gap-1 sm:grid-cols-2">
                    {q.options.map((option: string, optionIndex: number) => (
                      <div key={optionIndex} className={`rounded-lg px-2 py-1 text-[11px] ${q.correctAnswer === optionIndex ? "bg-emerald-50 text-emerald-800" : "bg-slate-50 text-slate-700"}`}>
                        <span className="font-black">{String.fromCharCode(65 + optionIndex)}.</span>{" "}
                        <ExamMathText text={option} className="inline" />
                        {q.optionImageUrls?.[optionIndex] && (
                          <div className="mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={q.optionImageUrls[optionIndex]} alt={`Imagen alternativa ${optionIndex + 1}`} className="max-h-28 w-full object-contain" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={apply}
            disabled={!canApply}
            className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "applied" ? "✓ Importación aplicada" : "Aplicar y agregar al final"}
          </button>
        </div>
      )}
    </div>
  )
}
