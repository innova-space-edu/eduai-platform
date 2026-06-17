"use client"

import { useEffect, useState } from "react"

type MixedQuestion = {
  id: string
  type: "mixed_choice_development"
  question: string
  options: string[]
  correctAnswer: number
  answerText: string
  explanation: string
  solutionSteps: string[]
  distractorRationales: string[]
  selectionPoints: number
  developmentMaxPoints: number
  modelAnswer: string
  expectedLatex: string
  rubric: { criteria: string; points: number }[]
  showRubricToStudent: boolean
  maxPoints: number
  imageUrl: string
}

const STORAGE_KEY = "eduai_create_mixed_ai_questions_v1"
const PATCH_KEY = "__eduaiCreateMixedAIPatch"

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function activePage() {
  return typeof window !== "undefined" && window.location.pathname.startsWith("/examen/crear")
}

function readStored(): MixedQuestion[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]")
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeStored(items: MixedQuestion[]) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  window.dispatchEvent(new CustomEvent("eduai:mixed-ai-store"))
}

function cleanOption(value: any) {
  return String(typeof value === "string" ? value : value?.text ?? value?.opcion ?? value ?? "")
    .replace(/^[A-Da-d][).]\s*/u, "")
    .trim()
}

function correctIndex(raw: any, options: string[]) {
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(0, Math.min(options.length - 1, Math.round(raw)))
  const value = String(raw ?? "").trim().toLowerCase()
  const numeric = Number(value)
  if (Number.isFinite(numeric)) return Math.max(0, Math.min(options.length - 1, Math.round(numeric)))
  const letter = ["a", "b", "c", "d", "e", "f"].indexOf(value)
  if (letter >= 0) return Math.max(0, Math.min(options.length - 1, letter))
  const byText = options.findIndex((option) => option.trim().toLowerCase() === value)
  return byText >= 0 ? byText : 0
}

function normalizeMixed(raw: any): MixedQuestion {
  const options = Array.isArray(raw?.options) ? raw.options.map(cleanOption).filter(Boolean).slice(0, 6) : []
  while (options.length < 4) options.push(`Alternativa ${String.fromCharCode(65 + options.length)}`)

  const correctAnswer = correctIndex(raw?.correctAnswer ?? raw?.respuestaCorrecta, options)
  const selectionPoints = Math.max(1, Number(raw?.selectionPoints ?? 3) || 3)
  const developmentMaxPoints = Math.max(1, Number(raw?.developmentMaxPoints ?? 2) || 2)
  const rubric = Array.isArray(raw?.rubric)
    ? raw.rubric.map((item: any) => ({
        criteria: String(item?.criteria ?? item?.criterion ?? item?.criterio ?? "Procedimiento y desarrollo correcto"),
        points: Math.max(0, Number(item?.points ?? item?.puntos ?? 1) || 1),
      }))
    : [{ criteria: "Procedimiento y desarrollo correcto", points: developmentMaxPoints }]

  return {
    id: uid(),
    type: "mixed_choice_development",
    question: String(raw?.question ?? raw?.enunciado ?? "").trim() || "Pregunta de desarrollo con alternativas",
    options,
    correctAnswer,
    answerText: String(raw?.answerText ?? options[correctAnswer] ?? ""),
    explanation: String(raw?.explanation ?? raw?.explicacion ?? ""),
    solutionSteps: Array.isArray(raw?.solutionSteps ?? raw?.steps) ? (raw.solutionSteps ?? raw.steps).map(String) : [],
    distractorRationales: Array.isArray(raw?.distractorRationales ?? raw?.distractor_reasons)
      ? (raw.distractorRationales ?? raw.distractor_reasons).map(String)
      : [],
    selectionPoints,
    developmentMaxPoints,
    modelAnswer: String(raw?.modelAnswer ?? raw?.expectedAnswer ?? raw?.respuestaModelo ?? ""),
    expectedLatex: String(raw?.expectedLatex ?? raw?.expected_latex ?? ""),
    rubric,
    showRubricToStudent: raw?.showRubricToStudent === true,
    maxPoints: selectionPoints + developmentMaxPoints,
    imageUrl: String(raw?.imageUrl ?? raw?.image_url ?? ""),
  }
}

function promptForMixed(count: number, context: string, difficulty: string) {
  return `Genera EXACTAMENTE ${count} preguntas escolares de tipo desarrollo con alternativas.
Tema: ${context || "tema del docente"}
Dificultad: ${difficulty}.

Devuelve SOLO JSON válido: {"title":"Preguntas mixtas","questions":[...]}.

Cada pregunta debe usar este esquema:
{
 "type":"multiple_choice",
 "question":"El estudiante debe elegir una alternativa y luego justificar o desarrollar.",
 "options":["...","...","...","..."],
 "correctAnswer":0,
 "answerText":"texto idéntico a options[correctAnswer]",
 "explanation":"explicación de la alternativa correcta",
 "solutionSteps":["paso 1","paso 2"],
 "distractorRationales":["A","B","C","D"],
 "selectionPoints":3,
 "developmentMaxPoints":2,
 "modelAnswer":"desarrollo esperado completo",
 "expectedLatex":"",
 "rubric":[{"criteria":"Procedimiento y desarrollo correcto","points":2}],
 "maxPoints":5,
 "imageUrl":""
}

Reglas: calcula primero la respuesta correcta, crea distractores plausibles y en modelAnswer explica cómo llegar a la alternativa correcta.`
}

function installPatch() {
  if (typeof window === "undefined") return
  const w = window as typeof window & Record<string, any>
  if (w[PATCH_KEY]) return
  const originalFetch = window.fetch.bind(window)
  w[PATCH_KEY] = true

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
      const method = String(init?.method || "GET").toUpperCase()
      if (activePage() && method === "POST" && url.includes("/api/agents/examen-docente") && typeof init?.body === "string") {
        const payload = JSON.parse(init.body)
        const mixed = readStored()
        if (payload?.action === "create" && mixed.length > 0) {
          const settings = payload.settings && typeof payload.settings === "object" ? payload.settings : {}
          const notebook = settings.developmentNotebook && typeof settings.developmentNotebook === "object" ? settings.developmentNotebook : {}
          const nextPayload = {
            ...payload,
            questions: [...(Array.isArray(payload.questions) ? payload.questions : []), ...mixed],
            settings: {
              ...settings,
              developmentNotebook: {
                ...notebook,
                enabled: true,
                mode: "development_only",
                requireArtifactBeforeNext: true,
                generateFinalPdf: true,
                maxPagesPerQuestion: 5,
              },
            },
          }
          const response = await originalFetch(input, { ...init, body: JSON.stringify(nextPayload) })
          response.clone().json().then((data) => { if (data?.success) writeStored([]) }).catch(() => {})
          return response
        }
      }
    } catch {}
    return originalFetch(input, init)
  }
}

export default function CreateExamMixedAI() {
  const [active, setActive] = useState(false)
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(2)
  const [difficulty, setDifficulty] = useState("mixta")
  const [context, setContext] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [preview, setPreview] = useState<MixedQuestion[]>([])
  const [stored, setStored] = useState<MixedQuestion[]>([])

  useEffect(() => {
    installPatch()
    const sync = () => {
      setActive(activePage())
      setStored(readStored())
    }
    sync()
    window.addEventListener("eduai:mixed-ai-store", sync)
    const interval = window.setInterval(sync, 1000)
    return () => {
      window.removeEventListener("eduai:mixed-ai-store", sync)
      window.clearInterval(interval)
    }
  }, [])

  if (!active) return null

  async function generate() {
    const safeCount = Math.max(1, Math.min(10, Math.round(Number(count) || 1)))
    setBusy(true)
    setError("")
    setPreview([])
    try {
      const response = await fetch("/api/agents/exam-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "full",
          mc: safeCount,
          tf: 0,
          dev: 0,
          prompt: promptForMixed(safeCount, context, difficulty),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data?.success) throw new Error(data?.error || "No se pudo generar")
      const questions = (Array.isArray(data.questions) ? data.questions : []).slice(0, safeCount).map(normalizeMixed)
      if (questions.length === 0) throw new Error("La IA no devolvió preguntas válidas")
      setPreview(questions)
    } catch (err: any) {
      setError(err?.message || "No se pudo generar")
    } finally {
      setBusy(false)
    }
  }

  function importPreview() {
    if (!preview.length) return
    writeStored([...readStored(), ...preview])
    setPreview([])
  }

  return (
    <div className="fixed bottom-5 right-5 z-[80] print:hidden">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="rounded-full border border-violet-200 bg-white px-4 py-3 text-xs font-black text-violet-800 shadow-2xl shadow-violet-100 hover:bg-violet-50">
          ✨ Desarrollo + alternativas IA
          {stored.length > 0 ? <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">{stored.length}</span> : null}
        </button>
      ) : (
        <div className="w-[24rem] max-w-[calc(100vw-1.5rem)] rounded-[28px] border border-violet-100 bg-white p-4 text-slate-900 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-600">IA preguntas mixtas</p>
              <h3 className="text-base font-black">Desarrollo + alternativas</h3>
              <p className="mt-1 text-xs text-slate-500">Se agregan al examen al momento de crearlo.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">✕</button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Cantidad</span>
              <input type="number" min={1} max={10} value={count} onChange={(e) => setCount(Number(e.target.value || 1))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Dificultad</span>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold">
                <option value="fácil">Fácil</option>
                <option value="media">Media</option>
                <option value="difícil">Difícil</option>
                <option value="mixta">Mixta</option>
              </select>
            </label>
          </div>

          <textarea value={context} onChange={(e) => setContext(e.target.value)} rows={3} placeholder="Contexto opcional: tema, curso, habilidad, tipo de ejercicio..." className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs" />

          {stored.length > 0 ? <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{stored.length} pregunta(s) mixta(s) importada(s). Se sumarán al crear el examen.</div> : null}
          {error ? <div className="mt-3 rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</div> : null}

          <div className="mt-4 flex gap-2">
            <button type="button" onClick={generate} disabled={busy} className="flex-1 rounded-2xl bg-violet-600 px-4 py-3 text-xs font-black text-white disabled:opacity-60">{busy ? "Generando..." : "Generar"}</button>
            {stored.length > 0 ? <button type="button" onClick={() => writeStored([])} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-600">Limpiar</button> : null}
          </div>

          {preview.length > 0 ? (
            <div className="mt-4 max-h-[320px] space-y-2 overflow-y-auto pr-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Vista previa · {preview.length}</p>
                <button type="button" onClick={importPreview} className="rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-black text-white">Importar</button>
              </div>
              {preview.map((q, i) => (
                <div key={q.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 text-xs">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-black text-violet-700">Mixta P{i + 1}</span>
                    <span className="text-[10px] font-bold text-slate-500">{q.maxPoints} pts</span>
                  </div>
                  <p className="line-clamp-3 font-semibold text-slate-900">{q.question}</p>
                  <p className="mt-1 text-[11px] text-slate-500">Correcta: {String.fromCharCode(65 + q.correctAnswer)} · Desarrollo: {q.developmentMaxPoints} pts</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
