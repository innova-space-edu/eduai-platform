import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;
export type IndexedAttachment = { id: string; name: string; kind: string };
type DocumentChunk = {
  chunk_index: number;
  content: string;
  section_title?: string | null;
  page_start?: number | null;
  page_end?: number | null;
  lexical_hint?: string | null;
};

const MAX_CONTEXT_CHARS = 14_000;
const MAX_CHUNKS_PER_FILE = 4;
const STOP = new Set("de la el los las del para que qué cómo cual cuáles desde hacia por con sobre en una uno unos unas al es son fue está este esta esto se su sus me mi tu te no y o u a e the of and for to from in with what is how please haz dime quiero necesito documento archivo adjunto documento pdf".split(" "));

function terms(text: string) {
  return [...new Set(String(text).normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase().match(/[a-z0-9]{3,}/g)?.filter(w => !STOP.has(w)) || [])].slice(0, 24);
}
function score(chunk: DocumentChunk, words: string[]) {
  const text = (chunk.section_title || "") + " " + (chunk.lexical_hint || "") + " " + chunk.content;
  const lower = text.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  return words.reduce((acc, word) => {
    const boundary = new RegExp("(^|[^a-z0-9])" + word + "([^a-z0-9]|$)", "g");
    return acc + (lower.match(boundary)?.length || 0) * 3 + (lower.includes(word) ? 1 : 0);
  }, 0);
}
function isOverview(q: string) {
  return /(resumen|resume|ideas principales|idea central|de qué trata|de que trata|visión general|vision general|overview|summary)/i.test(q);
}
function chooseChunks(chunks: DocumentChunk[], question: string) {
  if (!chunks.length) return [];
  const words = terms(question);
  if (isOverview(question) || !words.length) {
    const indices = [0, Math.floor((chunks.length - 1) / 3), Math.floor((chunks.length - 1) * 2 / 3), chunks.length - 1];
    return [...new Map(indices.map(i => [i, chunks[i]])).values()].slice(0, MAX_CHUNKS_PER_FILE);
  }
  return chunks.map((chunk, i) => ({ chunk, i, relevance: score(chunk, words) }))
    .sort((a,b) => b.relevance - a.relevance || a.i - b.i)
    .slice(0, MAX_CHUNKS_PER_FILE)
    .sort((a,b) => a.i - b.i).map(x => x.chunk);
}

export async function loadClawDocumentContext(params: {
  supabase: Supabase;
  userId: string;
  attachments: IndexedAttachment[];
  question: string;
}) {
  const { supabase, userId, attachments, question } = params;
  let remaining = MAX_CONTEXT_CHARS;
  const blocks: string[] = [];
  for (const attachment of attachments.slice(0, 6)) {
    const isPaper = attachment.kind === "paper";
    let title = attachment.name;
    let overview = "";
    let chunks: DocumentChunk[] = [];
    if (isPaper) {
      const { data: doc, error: docError } = await supabase.from("paper_documents")
        .select("title,summary").eq("id", attachment.id).eq("user_id", userId).maybeSingle();
      if (docError) throw new Error("No se pudo consultar el documento PDF.");
      if (!doc) throw new Error("Este PDF no está disponible para esta cuenta. Vuelve a adjuntarlo.");
      title = doc.title || attachment.name;
      overview = doc.summary ? `Resumen de extracción: ${String(doc.summary).slice(0,550)}\n` : "";
      const { data: found, error: chunkError } = await supabase.from("paper_chunks")
        .select("chunk_index,content,section_title,page_start,page_end,lexical_hint")
        .eq("document_id",attachment.id).eq("user_id",userId)
        .order("chunk_index",{ascending:true}).limit(500);
      if (chunkError) throw new Error("No se pudieron consultar los fragmentos del PDF.");
      chunks = found || [];
    } else {
      const { data: doc, error: docError } = await supabase.from("claw_documents")
        .select("name,kind").eq("id",attachment.id).eq("user_id",userId).maybeSingle();
      if (docError) throw new Error("No se pudo acceder al índice de Claw en Supabase.");
      if (!doc) throw new Error("Este adjunto no está disponible para tu cuenta. Vuelve a adjuntarlo.");
      title = doc.name || attachment.name;
      const { data: found, error: chunkError } = await supabase.from("claw_document_chunks")
        .select("chunk_index,content,section_title")
        .eq("document_id",attachment.id).eq("user_id",userId)
        .order("chunk_index",{ascending:true}).limit(500);
      if (chunkError) throw new Error("No se pudieron consultar los fragmentos del adjunto.");
      chunks = found || [];
    }
    const head = `ARCHIVO: ${title} [${isPaper ? "PDF Chat Paper" : "Documento Claw"}]`;
    if (remaining < 650) break;
    const selected = chooseChunks(chunks, question);
    let block = head + "\n" + overview;
    for (const chunk of selected) {
      const pageLabel = isPaper ? ` (páginas ${chunk.page_start || "?"}-${chunk.page_end || "?"})` : "";
      const label = `\n[Fragmento ${chunk.chunk_index+1}${pageLabel}${chunk.section_title ? " · "+chunk.section_title : ""}]\n`;
      const available = Math.min(2_200, remaining - block.length - label.length - 70);
      if (available < 250) break;
      block += label + chunk.content.slice(0,available) + "\n";
    }
    if (block.length > remaining) block = block.slice(0,remaining);
    blocks.push(block);
    remaining -= block.length;
  }
  return blocks.join("\n\n---\n\n");
}
