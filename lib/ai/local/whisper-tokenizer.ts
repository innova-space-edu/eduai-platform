export const WHISPER_TOKENIZER_URL = "https://huggingface.co/openai/whisper-tiny/resolve/main/tokenizer.json"
export const WHISPER_DECODE_START_TOKEN_ID = 50258
export const WHISPER_DECODE_STOP_TOKEN_ID = 50257
export const WHISPER_TRANSLATE_TOKEN_ID = 50358
export const WHISPER_TRANSCRIBE_TOKEN_ID = 50359
export const WHISPER_NO_TIMESTAMPS_TOKEN_ID = 50363

export type WhisperLanguageToken = {
  code: string
  tokenId: number
}

export type WhisperTokenizer = {
  vocabSize: number
  decode: (tokenIds: number[]) => string
  decodeRaw: (tokenIds: number[]) => string
  specialTokenIds: ReadonlySet<number>
  languageTokens: ReadonlyMap<string, number>
  tokenForSpecial: (content: string) => number | null
  tokenText: (tokenId: number) => string | null
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
const CONTROL_TOKEN = /^<\|.+\|>$/
const LANGUAGE_TOKEN = /^<\|([a-z]{2,3})\|>$/

function makeTokenizer(payload: TokenizerJson): WhisperTokenizer {
  const idToToken = new Map<number, string>()
  const tokenToId = new Map<string, number>()
  const vocab = payload.model?.vocab || {}
  for (const [token, id] of Object.entries(vocab)) {
    if (!Number.isFinite(id)) continue
    idToToken.set(Number(id), token)
    tokenToId.set(token, Number(id))
  }

  const specialTokenIds = new Set<number>()
  const languageTokens = new Map<string, number>()
  for (const token of payload.added_tokens || []) {
    if (typeof token.id !== "number") continue
    if (typeof token.content === "string") {
      idToToken.set(token.id, token.content)
      tokenToId.set(token.content, token.id)
      const language = LANGUAGE_TOKEN.exec(token.content)?.[1]
      if (language) languageTokens.set(language, token.id)
    }
    if (token.special) specialTokenIds.add(token.id)
  }

  const utf8Encoder = new TextEncoder()
  const utf8Decoder = new TextDecoder("utf-8", { fatal: false })

  function decodeTokens(tokenIds: number[], keepControlTokens: boolean) {
    const pieces: string[] = []
    let bytes: number[] = []

    const flushBytes = () => {
      if (!bytes.length) return
      pieces.push(utf8Decoder.decode(new Uint8Array(bytes)))
      bytes = []
    }

    for (const tokenId of tokenIds) {
      const token = idToToken.get(tokenId)
      if (!token) continue
      const isControl = CONTROL_TOKEN.test(token) || specialTokenIds.has(tokenId)
      if (isControl) {
        flushBytes()
        if (keepControlTokens) pieces.push(token)
        continue
      }
      for (const character of token) {
        const byte = BYTE_DECODER.get(character)
        if (typeof byte === "number") bytes.push(byte)
        else bytes.push(...utf8Encoder.encode(character))
      }
    }
    flushBytes()
    return pieces.join("").replace(/\s+/g, " ").trim()
  }

  return {
    vocabSize: idToToken.size,
    specialTokenIds,
    languageTokens,
    tokenForSpecial(content: string) {
      return tokenToId.get(content) ?? null
    },
    tokenText(tokenId: number) {
      return idToToken.get(tokenId) ?? null
    },
    decodeRaw(tokenIds: number[]) {
      return decodeTokens(tokenIds, true)
    },
    decode(tokenIds: number[]) {
      return decodeTokens(tokenIds, false)
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
