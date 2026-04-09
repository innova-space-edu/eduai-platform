"use client"

import { useMemo, useState } from "react"

type DraftType =
  | "study_guide"
  | "lesson_plan"
  | "exam"
  | "research_outline"
  | "prompt_pack"
  | "generic"

type DraftFile = {
  id: string
  title: string
  filename: string
  draftType: DraftType
  content: string
  summary: string
  createdAt: string
  metadata?: Record<string, unknown>
}

type DraftApiResponse = {
  ok: boolean
  name?: string
  alias?: string
  message?: string
  target?: "drafts"
  draft?: DraftFile
  logs?: Record<string, unknown>[]
  error?: string
}

const EXAMPLES = [
  "Necesito una planificación con OA e indicadores para 1° medio",
  "Anticipa una prueba de matemática con alternativas y desarrollo",
  "Crea una guía de estudio de química con ejemplos",
  "Prepara un esquema de investigación sobre plasma para CubeSats",
  "Genera un pack de prompts para mejorar una infografía educativa",
]

export default function DraftCreatorCard() {
  const [goal, setGoal] = useState("")
  const [currentPage, setCurrentPage] = useState("/superagent")
  const [activeAgent, setActiveAgent] = useState("drafts")
  const [tagsText, setTagsText] = useState("draft, anticipacion")
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<DraftApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const parsedTags = useMemo(
    () =>
      tagsText
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    [tagsText]
  )

  async function handleCreateDraft() {
    if (!goal.trim()) {
      setError("Escribe primero el objetivo o borrador que quieres anticipar.")
      return
    }

    try {
      setLoading(true)
      setError(null)
      setResponse(null)

      const res = await fetch("/api/superagent/drafts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPage,
          activeAgent,
          userGoal: goal,
          tags: parsedTags,
        }),
      })

      const json = (await res.json()) as DraftApiResponse

      if (!res.ok || !json.ok) {
        setError(json.error || json.message || "No se pudo crear el borrador.")
        setResponse(json)
        return
      }

      setResponse(json)
    } catch {
      setError("Ocurrió un error al conectar con el endpoint de borradores.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Generador de borradores anticipados
          </h2>
          <p className="mt-2 text-sm leading-7 text-slate-300">
            EduAI Claw puede crear borradores seguros en memoria, anticipando
            necesidades del usuario sin sobrescribir producción.
          </p>
        </div>

        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-200">
          Drafts seguros
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-200">
            Objetivo o borrador a anticipar
          </label>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={4}
            placeholder="Ejemplo: Necesito una planificación con OA e indicadores para 1° medio..."
            className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/40"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200">
              Página actual
            </label>
            <input
              value={currentPage}
              onChange={(e) => setCurrentPage(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/40"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200">
              Agente activo
            </label>
            <input
              value={activeAgent}
              onChange={(e) => setActiveAgent(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/40"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-200">
            Etiquetas
          </label>
          <input
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="draft, anticipacion, planificacion"
            className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/40"
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-200">
            Ejemplos rápidos
          </p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setGoal(example)}
                className="rounded-full border border-white/10 bg-slate-900/70 px-3 py-1.5 text-xs text-slate-200 transition hover:border-cyan-400/30 hover:text-white"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleCreateDraft}
            disabled={loading}
            className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-medium text-cyan-200 transition hover:border-cyan-400/40 hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Creando borrador..." : "Crear borrador anticipado"}
          </button>

          <button
            type="button"
            onClick={() => {
              setGoal("")
              setResponse(null)
              setError(null)
            }}
            className="rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-slate-200 transition hover:border-white/20 hover:text-white"
          >
            Limpiar
          </button>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        {response?.draft && (
          <div className="mt-2 rounded-[1.5rem] border border-emerald-400/15 bg-emerald-400/5 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">
                  {response.draft.title}
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  {response.draft.summary}
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">
                {response.draft.filename}
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Tipo
                </p>
                <p className="mt-1 text-sm font-medium text-white">
                  {response.draft.draftType}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Creado
                </p>
                <p className="mt-1 text-sm font-medium text-white">
                  {new Date(response.draft.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Estado
                </p>
                <p className="mt-1 text-sm font-medium text-white">
                  En memoria segura
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <p className="mb-3 text-sm font-medium text-slate-200">
                Contenido del borrador
              </p>
              <pre className="overflow-x-auto whitespace-pre-wrap text-sm leading-7 text-slate-300">
                {response.draft.content}
              </pre>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
