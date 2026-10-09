import { createClient } from "@/lib/supabase/server"
import { semanticSearchPaperChunks } from "@/lib/papers/embeddings"

type DocumentReference = { name?: string; filePath?: string; documentId?: string }
type Chunk = { chunk_index: number; section_title: string | null; page_start: number; page_end: number; content: string; lexical_hint?: string }

function terms(query: string) {
  const stop = new Set(["para","como","sobre","este","esta","archivo","documento","hacer","quiero","puedes","necesito","tiene","entre","desde","donde","cuales","cual","todo","todos","resumen","analiza"])
  return [...new Set(query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[a-z0-9]{4,}/g) || [])]
    .filter(term => !stop.has(term)).slice(0, 20)
}

function rank(chunk: Chunk, words: string[]) {
  const source = `${chunk.section_title || ""} ${chunk.content}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  return words.reduce((score, word) => score + (source.includes(word) ? (source.split(word).length - 1) : 0), 0)
}

// Document text remains in private Paper tables; only relevant passages enter the model prompt.
export async function resolveClawPaperContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  question: string,
  references: DocumentReference[],
) {
  const sections: string[] = []
  const words = terms(question)
  for (const ref of references.slice(0, 6)) {
    const filePath = String(ref.filePath || "")
    if (!filePath.startsWith(`${userId}/`) || filePath.includes("..")) continue

    const { data: document, error } = await supabase
      .from("paper_documents")
      .select("id,title,summary,file_path")
      .eq("user_id", userId)
      .eq("bucket", "papers")
      .eq("file_path", filePath)
      .maybeSingle()
    if (error || !document?.id) continue

    const { data: rows } = await supabase
      .from("paper_chunks")
      .select("chunk_index,section_title,page_start,page_end,content,lexical_hint")
      .eq("document_id", document.id)
      .eq("user_id", userId)
      .order("chunk_index", { ascending: true })
      .limit(1500)
    const chunks = (rows || []) as Chunk[]
    if (!chunks.length) continue

    let semantic: Chunk[] = []
    try {
      semantic = (await semanticSearchPaperChunks({
        supabase, userId, documentId: document.id, query: question, limit: 6,
      })) as Chunk[]
    } catch { /* lexical search remains available without embeddings */ }

    const scores = new Map<number, number>()
    for (const [position, chunk] of semantic.entries()) scores.set(chunk.chunk_index, 100 - position * 8)
    for (const chunk of chunks) scores.set(chunk.chunk_index, (scores.get(chunk.chunk_index) || 0) + rank(chunk, words))
    const selected = chunks.sort((a,b) => (scores.get(b.chunk_index) || 0) - (scores.get(a.chunk_index) || 0)).slice(0, 4)
    const source = selected.map(c => `[p. ${c.page_start}${c.page_end !== c.page_start ? "-" + c.page_end : ""}; fragmento ${c.chunk_index + 1}]\n${c.content.slice(0, 2200)}`).join("\n\n")
    sections.push(`DOCUMENTO: ${String(document.title || ref.name || "PDF").slice(0,160)}\nRESUMEN: ${String(document.summary || "").slice(0,1000)}\nFRAGMENTOS RELEVANTES:\n${source}`)
  }
  return sections.join("\n\n---\n\n").slice(0, 18000)
}
