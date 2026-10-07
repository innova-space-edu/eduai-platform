const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
}

function decodeEntitiesOnce(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : _
    })
    .replace(/&#(\d+);?/g, (_, decimal: string) => {
      const code = Number.parseInt(decimal, 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : _
    })
    .replace(/&([a-z]+);/gi, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match)
}

export function normalizeChatText(raw: string) {
  let text = String(raw || "").replace(/\r\n?/g, "\n")

  text = decodeEntitiesOnce(decodeEntitiesOnce(text))
    .replace(/\u00a0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")

  text = text
    .replace(/\\([|*_>#-])/g, "$1")
    .replace(/•(?=\S)/g, "• ")
    .replace(/\*\*(\d+\.)\*\*(?=\S)/g, "$1 ")
    .replace(/^(\s*)(\d+[.)])(?=\S)/gm, "$1$2 ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")

  return text.trim()
}
