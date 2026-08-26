export const WHISPER_TOKENIZER_URL = "https://huggingface.co/openai/whisper-tiny/resolve/main/tokenizer.json"
export const WHISPER_DECODE_START_TOKEN_ID = 50258
export const WHISPER_DECODE_STOP_TOKEN_ID = 50257

export type WhisperTokenizer = {
  vocabSize: number
  decode: (tokenIds: number[]) => string
  specialTokenIds: ReadonlySet<number>
}

type TokenizerJson = {
  model?: { vocab?: Record<string, number> }
  added_tokens?: Array<{ id?: number; content?: string; special?: boolean }>
}

let tokenizerPromise: Promise<WhisperTokenizer> | null = null

function buildByteDecoder() {
  const base: number[] = []
  for (let value = 33; value <= 126; value += 1) base.push(value)
  for (let value = 161; value <= 172; value += 1) base.push(value)
  for (let value = 174; value <= 255; value += 1) base.push(value)
  const bytes = [...base]
  const unicode = [...base]
  let extra = 0
  for (let value = 0; value < 256; value += 1) {
    if (base.includes(value)) continue
    bytes.push(value)
    unicode.push(256 + extra)
    extra += 1
  }
  const decoder = new Map<string, number>()
  for (let index = 0; index < bytes.length; index += 1) decoder.set(String.fromCodePoint(unicode[index]), bytes[index])
  return decoder
}

const BYTE_DECODER = buildByteDecoder()

function makeTokenizer(payload: TokenizerJson): WhisperTokenizer {
  const idToToken = new Map<number, string>()
  const vocab = payload.model?.vocab || {}
  for (const [token, id] of Object.entries(vocab)) {
    if (Number.isFinite(id)) idToToken.set(Number(id), token)
  }
  const specialTokenIds = new Set<number>()
  for (const token of payload.added_tokens || []) {
    if (typeof token.id !== "number") continue
    if (typeof token.content === "string") idToToken.set(token.id, token.content)
    if (token.special) specialTokenIds.add(token.id)
  }

  const utf8Encoder = new TextEncoder()
  const utf8Decoder = new TextDecoder("utf-8", { fatal: false })

  return {
    vocabSize: idToToken.size,
    specialTokenIds,
    decode(tokenIds: number[]) {
      const bytes: number[] = []
      for (const tokenId of tokenIds) {
        if (specialTokenIds.has(tokenId)) continue
        const token = idToToken.get(tokenId)
        if (!token) continue
        for (const character of token) {
          const byte = BYTE_DECODER.get(character)
          if (typeof byte === "number") {
            bytes.push(byte)
          } else {
            bytes.push(...utf8Encoder.encode(character))
          }
        }
      }
      return utf8Decoder.decode(new Uint8Array(bytes)).trim()
    },
  }
}

export function loadWhisperTokenizer() {
  if (!tokenizerPromise) {
    tokenizerPromise = fetch(WHISPER_TOKENIZER_URL, { cache: "force-cache" })
      .then(async response => {
        if (!response.ok) throw new Error(`No fue posible descargar tokenizer.json (HTTP ${response.status}).`)
        return makeTokenizer(await response.json() as TokenizerJson)
      })
      .catch(error => {
        tokenizerPromise = null
        throw error
      })
  }
  return tokenizerPromise
}
