"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  BookOpenText,
  Check,
  ChevronRight,
  Circle,
  ExternalLink,
  FileOutput,
  ListChecks,
  Loader2,
  Plus,
  Users,
  X,
} from "lucide-react"
import type {
  WorkCitation,
  WorkContextData,
  WorkTask,
} from "@/lib/work/types"

type ContextTab = "sources" | "results" | "tasks" | "team"

type SessionResult = { id: string; title: string; type: string; href?: string }

type WorkContextPanelProps = {
  open: boolean
  notebookId: string | null
  notebookTitle?: string
  context: WorkContextData
  citations: WorkCitation[]
  sessionResults: SessionResult[]
  loading: boolean
  onClose: () => void
}

const TABS: Array<{ id: ContextTab; label: string; icon: typeof BookOpenText }> = [
  { id: "sources", label: "Fuentes", icon: BookOpenText },
  { id: "results", label: "Resultados", icon: FileOutput },
  { id: "tasks", label: "Tareas", icon: ListChecks },
  { id: "team", label: "Equipo", icon: Users },
]

function iconForSource(type: string) {
  if (type === "url" || type === "search_result") return "🌐"
  if (type === "pdf") return "📄"
  if (type === "docx") return "📝"
  return "📚"
}

export function WorkContextPanel({
  open,
  notebookId,
  notebookTitle,
  context,
  citations,
  sessionResults,
  loading,
  onClose,
}: WorkContextPanelProps) {
  const [tab, setTab] = useState<ContextTab>("sources")
  const [tasks, setTasks] = useState<WorkTask[]>([])
  const [taskDraft, setTaskDraft] = useState("")
  const [hydratedTaskKey, setHydratedTaskKey] = useState<string | null>(null)
  const taskKey = `open-eduai-work:tasks:${notebookId || "general"}`

  useEffect(() => {
    try {
      const saved = localStorage.getItem(taskKey)
      setTasks(saved ? JSON.parse(saved) : [])
    } catch {
      setTasks([])
    } finally {
      setHydratedTaskKey(taskKey)
    }
  }, [taskKey])

  useEffect(() => {
    if (hydratedTaskKey !== taskKey) return
    localStorage.setItem(taskKey, JSON.stringify(tasks))
  }, [hydratedTaskKey, taskKey, tasks])

  useEffect(() => {
    if (citations.length) setTab("sources")
  }, [citations])

  if (!open) return null

  const addTask = () => {
    const title = taskDraft.trim()
    if (!title) return
    setTasks((current) => [...current, { id: crypto.randomUUID(), title, completed: false }])
    setTaskDraft("")
  }

  return (
    <aside className="absolute inset-y-0 right-0 z-40 flex w-[350px] max-w-[92vw] shrink-0 flex-col border-l border-soft bg-card-theme shadow-xl xl:relative xl:z-auto xl:shadow-none">
      <div className="flex items-center gap-2 border-b border-soft px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-main">Contexto del trabajo</p>
          <p className="truncate text-[9px] text-muted2">{notebookTitle || "Conversación general"}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted2 hover:bg-card-soft-theme" aria-label="Cerrar panel contextual">
          <X size={15} />
        </button>
      </div>

      <div className="grid grid-cols-4 border-b border-soft px-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex flex-col items-center gap-1 border-b-2 px-1 py-2 text-[9px] font-medium transition ${tab === id ? "border-blue-500 text-blue-500" : "border-transparent text-muted2 hover:text-main"}`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {loading && <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted2"><Loader2 size={14} className="animate-spin" /> Actualizando</div>}

        {!loading && tab === "sources" && (
          <div className="space-y-3">
            {citations.length > 0 && (
              <section>
                <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.15em] text-violet-500">Usadas en la última respuesta</p>
                <div className="space-y-2">
                  {citations.map((citation, index) => (
                    <article key={`${citation.sourceId}-${citation.chunkId || index}`} className="rounded-xl border border-violet-500/15 bg-violet-500/5 p-3">
                      <div className="flex items-start gap-2">
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-violet-600 text-[9px] font-bold text-white">{index + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-[11px] font-semibold text-main">{citation.sourceTitle || "Fuente"}</p>
                          {citation.snippet && <p className="mt-1 line-clamp-4 text-[9px] leading-relaxed text-muted2">{citation.snippet}</p>}
                          {citation.sourceUrl && (
                            <a href={citation.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[9px] font-medium text-violet-500 hover:underline">
                              Abrir fuente <ExternalLink size={9} />
                            </a>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            <section>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted2">Biblioteca del Work</p>
                {notebookId && <Link href={`/notebooks/${notebookId}`} className="text-[9px] font-medium text-blue-500 hover:underline">Administrar</Link>}
              </div>
              {context.sources.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-soft p-4 text-center">
                  <p className="text-2xl">📎</p>
                  <p className="mt-2 text-xs font-semibold text-main">Agrega documentos y enlaces</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted2">Las respuestas podrán citar el contenido real de tus fuentes.</p>
                  <Link href={notebookId ? `/notebooks/${notebookId}` : "/notebooks"} className="mt-3 inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-2 text-[10px] font-semibold text-white">
                    <Plus size={11} /> Agregar fuente
                  </Link>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {context.sources.map((source) => (
                    <a key={source.id} href={source.url || (notebookId ? `/notebooks/${notebookId}` : "#")} target={source.url ? "_blank" : undefined} rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-soft px-3 py-2.5 hover:bg-card-soft-theme">
                      <span>{iconForSource(source.type)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-medium text-main">{source.title || source.url || "Fuente sin título"}</span>
                        <span className={`text-[9px] ${source.status === "ready" ? "text-emerald-500" : source.status === "error" ? "text-red-500" : "text-amber-500"}`}>{source.status === "ready" ? "Lista" : source.status === "error" ? "Error" : "Procesando"}</span>
                      </span>
                      <ChevronRight size={12} className="text-muted2" />
                    </a>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {!loading && tab === "results" && (
          <div>
            <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.15em] text-muted2">Resultados del trabajo</p>
            {sessionResults.length === 0 && context.outputs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-soft p-5 text-center">
                <FileOutput size={24} className="mx-auto text-muted2" />
                <p className="mt-2 text-xs font-semibold text-main">Todavía no hay resultados</p>
                <p className="mt-1 text-[10px] text-muted2">Usa el modo Crear o Ejecutar para producir materiales.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sessionResults.map((result) => (
                  <article key={result.id} className="rounded-xl border border-blue-500/15 bg-blue-500/5 p-3">
                    <p className="text-[9px] font-medium uppercase text-blue-500">{result.type}</p>
                    <p className="mt-1 text-xs font-semibold capitalize text-main">{result.title}</p>
                    {result.href && <Link href={result.href} className="mt-2 inline-flex text-[9px] text-blue-500">Abrir resultado</Link>}
                  </article>
                ))}
                {context.outputs.map((output) => (
                  <Link key={output.id} href={notebookId ? `/notebooks/${notebookId}` : "#"} className="flex items-center gap-3 rounded-xl border border-soft p-3 hover:bg-card-soft-theme">
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-500/10">✨</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-main">{output.title || output.format}</span>
                      <span className="text-[9px] capitalize text-muted2">{output.format} · versión {output.version}</span>
                    </span>
                    <ChevronRight size={12} className="text-muted2" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {!loading && tab === "tasks" && (
          <div>
            <div className="flex gap-2">
              <input
                value={taskDraft}
                onChange={(event) => setTaskDraft(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && addTask()}
                placeholder="Nueva tarea…"
                className="min-w-0 flex-1 rounded-xl border border-soft bg-card-soft-theme px-3 py-2 text-xs text-main outline-none focus:border-blue-500/40"
              />
              <button type="button" onClick={addTask} disabled={!taskDraft.trim()} className="grid h-8 w-8 place-items-center rounded-xl bg-blue-600 text-white disabled:opacity-40" aria-label="Agregar tarea"><Plus size={13} /></button>
            </div>
            <div className="mt-3 space-y-1.5">
              {tasks.length === 0 && <p className="py-8 text-center text-[10px] text-muted2">Agrega pasos y compromisos para este trabajo.</p>}
              {tasks.map((task) => (
                <button key={task.id} type="button" onClick={() => setTasks((current) => current.map((item) => item.id === task.id ? { ...item, completed: !item.completed } : item))} className="flex w-full items-start gap-2 rounded-xl border border-soft p-3 text-left hover:bg-card-soft-theme">
                  {task.completed ? <Check size={15} className="mt-0.5 shrink-0 text-emerald-500" /> : <Circle size={15} className="mt-0.5 shrink-0 text-muted2" />}
                  <span className={`text-xs ${task.completed ? "text-muted2 line-through" : "text-main"}`}>{task.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {!loading && tab === "team" && (
          <div className="space-y-3">
            <div className="rounded-2xl bg-gradient-to-br from-teal-500/10 to-blue-500/10 p-4 ring-1 ring-inset ring-teal-500/15">
              <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl bg-teal-600 text-sm text-white">A</span><div><p className="text-xs font-semibold text-main">Profesor ACo</p><p className="text-[9px] text-muted2">Moderador de trabajo colaborativo</p></div></div>
              <p className="mt-3 text-[10px] leading-relaxed text-sub">Crea una sala en tiempo real para conversar, distribuir aportes y recibir orientación del agente colaborativo.</p>
              <Link href="/collab" className="mt-3 inline-flex items-center gap-1 rounded-xl bg-teal-600 px-3 py-2 text-[10px] font-semibold text-white"><Users size={11} /> Abrir sala colaborativa</Link>
            </div>
            <div className="rounded-2xl border border-soft p-4">
              <p className="text-xs font-semibold text-main">Próxima integración</p>
              <p className="mt-1 text-[10px] leading-relaxed text-muted2">Edición compartida de resultados, comentarios por bloque y presencia dentro del mismo Work.</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
