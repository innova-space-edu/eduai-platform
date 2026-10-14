// Fragmentación determinista de documentos: el modelo nunca recibe este
// texto completo. Se recuperan solo unos pocos fragmentos por pregunta.
export const CLAW_MAX_STORED_CHARS = 250_000;
const TARGET = 1_800;
const MAX = 2_200;

export type IndexedChunk = {
  chunk_index: number;
  section_title: string | null;
  content: string;
};

export function indexClawText(text: string): IndexedChunk[] {
  const clean = String(text || "").replace(/\r\n?/g, "\n").trim().slice(0, CLAW_MAX_STORED_CHARS);
  if (!clean) return [];
  const paragraphs = clean.split(/\n{2,}/).filter(Boolean);
  const chunks: IndexedChunk[] = [];
  let pending = "";
  let section: string | null = null;

  function save() {
    const content = pending.trim();
    if (!content) return;
    chunks.push({ chunk_index: chunks.length, section_title: section, content });
    pending = "";
  }

  for (const paragraph of paragraphs) {
    const first = paragraph.split("\n")[0].trim();
    if (first.length < 105 && /^(?:#{1,5}\s+|(?:cap[ií]tulo|secci[oó]n|art[ií]culo|hoja|diapositiva)\b)/i.test(first)) {
      save();
      section = first.replace(/^#+\s*/, "");
    }
    let rest = paragraph.trim();
    while (rest.length) {
      if (pending && pending.length + rest.length + 2 > MAX) save();
      const room = (pending ? MAX - pending.length - 2 : MAX);
      if (rest.length <= room) {
        pending = pending ? pending + "\n\n" + rest : rest;
        rest = "";
      } else {
        let cut = rest.lastIndexOf(" ", Math.min(room, TARGET));
        if (cut < Math.min(room, TARGET) / 2) cut = Math.min(room, TARGET);
        pending = pending ? pending + "\n\n" + rest.slice(0, cut) : rest.slice(0, cut);
        save();
        rest = rest.slice(cut).trimStart();
      }
    }
  }
  save();
  return chunks;
}
