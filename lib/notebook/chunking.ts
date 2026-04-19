// lib/notebook/chunking.ts
// División de texto en chunks para indexación

const CHUNK_SIZE  = 600  // tokens aproximados (chars/4)
const CHUNK_CHARS = CHUNK_SIZE * 4  // ~2400 chars por chunk
const OVERLAP     = 200  // chars de superposición

export type RawChunk = {
  text: string
  index: number
  tokenCount: number
}

/**
 * Divide texto en chunks con superposición.
 * Respeta límites de párrafo/oración cuando es posible.
 */
export function chunkText(text: string): RawChunk[] {
  if (!text || text.trim().length === 0) return []

  const cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()

  if (cleaned.length <= CHUNK_CHARS) {
    return [{ text: cleaned, index: 0, tokenCount: Math.ceil(cleaned.length / 4) }]
  }

  const chunks: RawChunk[] = []
  let start = 0
  let index = 0

  while (start < cleaned.length) {
    const end = Math.min(start + CHUNK_CHARS, cleaned.length)
    let slice = cleaned.slice(start, end)

    // Intentar cortar en párrafo o punto
    if (end < cleaned.length) {
      const lastParagraph = slice.lastIndexOf("\n\n")
      const lastPeriod    = slice.lastIndexOf(". ")
      const lastNewline   = slice.lastIndexOf("\n")

      let cutAt = -1
      if (lastParagraph > CHUNK_CHARS * 0.5) cutAt = lastParagraph + 2
      else if (lastPeriod    > CHUNK_CHARS * 0.5) cutAt = lastPeriod + 2
      else if (lastNewline   > CHUNK_CHARS * 0.5) cutAt = lastNewline + 1

      if (cutAt > 0) slice = slice.slice(0, cutAt)
    }

    if (slice.trim().length > 50) {
      chunks.push({
        text: slice.trim(),
        index,
        tokenCount: Math.ceil(slice.length / 4),
      })
      index++
    }

    // Avanzar con overlap
    start = start + slice.length - OVERLAP
    if (start < 0) start = 0
    // Evitar loop infinito
    if (slice.length < 100) break
  }

  return chunks
}

/**
 * Extrae texto limpio desde HTML con cheerio-style
 */
export function cleanHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, " ")
    .trim()
}

/**
 * Estima tokens (aprox. chars/4)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}
