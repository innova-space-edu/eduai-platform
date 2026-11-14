import { planExamBatches } from "./generation-contract.mjs"

export type ExamGenerationCache = {
  key: string
  completed: number
  questions: any[]
  providers: string[]
  title: string
}
type CacheRef = { current: ExamGenerationCache | null }

export async function requestExamGeneration(
  url: string,
  init: RequestInit,
  setProgress: (label: string) => void,
  cache: CacheRef,
): Promise<Response> {
  if (typeof init.body !== "string") return fetch(url, init)
  const body = JSON.parse(init.body)
  const counts = { mc: Number(body.mc || 0), mixed: Number(body.mixed || 0), tf: Number(body.tf || 0), dev: Number(body.dev || 0) }
  const batches = planExamBatches(counts, 3)
  const key = JSON.stringify(body)
  if (!cache.current || cache.current.key !== key) {
    cache.current = { key, completed: 0, questions: [], providers: [], title: "" }
  }
  const state = cache.current!
  const total = batches.reduce((sum, batch) => sum + batch.total, 0)
  for (let i = state.completed; i < batches.length; i++) {
    if (init.signal?.aborted) throw new DOMException("Generación cancelada", "AbortError")
    const batch = batches[i]
    setProgress(`Generando lote ${i + 1}/${batches.length} · ${state.questions.length}/${total} preguntas verificadas…`)
    let response: Response
    try {
      response = await fetch(url, {
        ...init,
        body: JSON.stringify({
          ...body,
          mc: batch.mc, mixed: batch.mixed, tf: batch.tf, dev: batch.dev,
          preferredProvider: state.providers[state.providers.length - 1],
          existingQuestions: [...(Array.isArray(body.existingQuestions) ? body.existingQuestions : []), ...state.questions.map(q => q.question)],
        }),
      })
    } catch (error) {
      if (init.signal?.aborted) throw error
      return Response.json({ error: `No se pudo completar el lote ${i + 1}. Se conservaron ${state.questions.length} preguntas verificadas para reintentar con los mismos ajustes.` }, { status: 502 })
    }
    const data = await response.json().catch(() => null)
    if (init.signal?.aborted) throw new DOMException("Generación cancelada", "AbortError")
    const typeCounts = { multiple_choice: batch.mc, mixed_choice_development: batch.mixed, true_false: batch.tf, development: batch.dev }
    if (!response.ok || !data?.success || !Array.isArray(data.questions) || data.questions.length !== batch.total ||
        Object.entries(typeCounts).some(([type, count]) => data.questions.filter((q: any) => q?.type === type).length !== count)) {
      return Response.json({ error: `${data?.error || "El lote devolvió una respuesta incompleta."} Se conservaron ${state.questions.length} preguntas verificadas para reintentar con los mismos ajustes.`, details: data?.details }, { status: response.ok ? 502 : response.status })
    }
    state.questions.push(...data.questions)
    if (!state.title && typeof data.title === "string") state.title = data.title
    for (const provider of (Array.isArray(data.providers) ? data.providers : [data.provider])) {
      if (typeof provider === "string") state.providers.push(provider)
    }
    state.completed = i + 1
  }
  const result = Response.json({ success: true, title: state.title, questions: state.questions, provider: state.providers[0], providers: [...new Set(state.providers)] })
  if (cache.current === state) cache.current = null
  return result
}
