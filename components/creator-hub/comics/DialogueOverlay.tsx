"use client"

export type DialogueLayout = "auto" | "bubbles" | "caption"
export type DialoguePosition = "top-left" | "top-right" | "bottom-left" | "bottom-right"

type CharacterLike = {
  name: string
}

type DialoguePart = {
  speaker?: string
  text: string
}

function splitByKnownSpeakers(dialogue: string, characters: CharacterLike[]) {
  const trimmed = dialogue.trim()
  if (!trimmed) return [] as DialoguePart[]

  const names = characters
    .map((character) => character.name.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)

  if (!names.length) return [{ text: trimmed }]

  const escaped = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  const pattern = new RegExp(`(?:^|\\s)(${escaped.join("|")}):\\s*`, "gi")
  const matches = [...trimmed.matchAll(pattern)]
  if (!matches.length) return [{ text: trimmed }]

  const parts: DialoguePart[] = []
  matches.forEach((match, index) => {
    const start = (match.index || 0) + match[0].length
    const end = index + 1 < matches.length ? matches[index + 1].index || trimmed.length : trimmed.length
    const text = trimmed.slice(start, end).trim()
    if (text) parts.push({ speaker: match[1], text })
  })
  return parts.length ? parts : [{ text: trimmed }]
}

function splitLongPart(part: DialoguePart, maxLength = 175) {
  if (part.text.length <= maxLength) return [part]
  const sentences = part.text.split(/(?<=[.!?…])\s+/).filter(Boolean)
  const chunks: DialoguePart[] = []
  let current = ""
  for (const sentence of sentences) {
    if (!current) {
      current = sentence
      continue
    }
    if (`${current} ${sentence}`.length <= maxLength) current = `${current} ${sentence}`
    else {
      chunks.push({ speaker: chunks.length === 0 ? part.speaker : undefined, text: current })
      current = sentence
    }
  }
  if (current) chunks.push({ speaker: chunks.length === 0 ? part.speaker : undefined, text: current })
  return chunks.length ? chunks : [part]
}

function normalizeParts(dialogue: string, characters: CharacterLike[]) {
  return splitByKnownSpeakers(dialogue, characters)
    .flatMap((part) => splitLongPart(part))
    .slice(0, 4)
}

function opposite(position: DialoguePosition): DialoguePosition {
  if (position === "top-left") return "top-right"
  if (position === "top-right") return "top-left"
  if (position === "bottom-left") return "bottom-right"
  return "bottom-left"
}

function bubbleClass(position: DialoguePosition) {
  if (position === "top-left") return "left-3 top-3 rounded-tl-sm"
  if (position === "top-right") return "right-3 top-3 rounded-tr-sm"
  if (position === "bottom-left") return "bottom-12 left-3 rounded-bl-sm"
  return "bottom-12 right-3 rounded-br-sm"
}

function Bubble({ part, position, compact }: { part: DialoguePart; position: DialoguePosition; compact: boolean }) {
  return (
    <div
      className={`absolute z-20 max-w-[45%] border border-black/10 bg-white/96 text-slate-900 shadow-lg ${bubbleClass(position)} ${compact ? "rounded-xl px-2.5 py-2 text-[9px] leading-[1.35]" : "rounded-2xl px-3 py-2.5 text-[10px] leading-[1.4] sm:text-[11px]"}`}
    >
      {part.speaker && <span className="mr-1 font-black">{part.speaker}:</span>}
      <span className="font-semibold">{part.text}</span>
    </div>
  )
}

export default function DialogueOverlay({
  dialogue,
  characters,
  layout = "auto",
  position = "top-left",
}: {
  dialogue: string
  characters: CharacterLike[]
  layout?: DialogueLayout
  position?: DialoguePosition
}) {
  const parts = normalizeParts(dialogue, characters)
  if (!parts.length) return null

  const totalLength = parts.reduce((sum, part) => sum + part.text.length, 0)
  const resolvedLayout: DialogueLayout = layout === "auto"
    ? totalLength > 230 || parts.length > 2
      ? "caption"
      : "bubbles"
    : layout

  if (resolvedLayout === "caption") {
    const compact = totalLength > 360
    return (
      <div className="absolute inset-x-2 bottom-2 z-20 max-h-[37%] overflow-hidden rounded-2xl border border-black/10 bg-white/96 px-3 py-2.5 text-slate-900 shadow-xl backdrop-blur-sm">
        <div className={`grid gap-x-3 gap-y-1.5 ${parts.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {parts.map((part, index) => (
            <p key={`${part.speaker || "dialogue"}-${index}`} className={`${compact ? "text-[8px] leading-[1.28]" : totalLength > 250 ? "text-[9px] leading-[1.35]" : "text-[10px] leading-[1.4]"}`}>
              {part.speaker && <strong>{part.speaker}: </strong>}
              <span className="font-semibold">{part.text}</span>
            </p>
          ))}
        </div>
      </div>
    )
  }

  const first = position
  const second = opposite(first)
  const third: DialoguePosition = first.startsWith("top") ? "bottom-left" : "top-left"
  const fourth: DialoguePosition = first.startsWith("top") ? "bottom-right" : "top-right"
  const positions = [first, second, third, fourth]
  const compact = totalLength > 180 || parts.length > 2

  return (
    <>
      {parts.map((part, index) => (
        <Bubble key={`${part.speaker || "dialogue"}-${index}`} part={part} position={positions[index]} compact={compact} />
      ))}
    </>
  )
}
