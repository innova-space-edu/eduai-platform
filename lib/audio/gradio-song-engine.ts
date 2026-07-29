type SongEngineInput = {
  prompt: string
  lyrics: string
  duration: number
  bpm: number | null
  keyScale: string
  timeSignature: string
  vocalLanguage: string
  instrumental: boolean
  vocalStyle: string
  referenceAudioUrl?: string
  seed?: number
}

type SongEngineOutput = {
  bytes: Uint8Array
  mime: string
  metadata: Record<string, unknown>
  sourceUrl: string
}

function cleanBaseUrl(value: string) {
  return value.replace(/\/+$/, "")
}

function getHuggingFaceToken() {
  return [
    process.env.HF_TOKEN,
    process.env.HF_TOKEN_1,
    process.env.HF_TOKEN_2,
    process.env.HUGGINGFACE_API_KEY,
  ].find((value) => value?.trim())?.trim() || ""
}

function authHeaders(token: string, json = false): HeadersInit {
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (json) headers["Content-Type"] = "application/json"
  return headers
}

function parseSseResult(text: string) {
  let completed: unknown = null
  let failure = ""

  const blocks = text.split(/\r?\n\r?\n/)
  for (const block of blocks) {
    const event = block.match(/^event:\s*(.+)$/m)?.[1]?.trim() || ""
    const dataLines = [...block.matchAll(/^data:\s?(.*)$/gm)].map((match) => match[1])
    const raw = dataLines.join("\n").trim()

    if (!raw) continue

    if (event === "error") {
      try {
        const parsed = JSON.parse(raw)
        failure = String(parsed?.message || parsed?.error || raw)
      } catch {
        failure = raw
      }
    }

    if (event === "complete") {
      try {
        completed = JSON.parse(raw)
      } catch {
        completed = raw
      }
    }
  }

  if (failure) throw new Error(failure)
  if (completed === null) {
    const fallback = [...text.matchAll(/^data:\s?(.*)$/gm)].map((match) => match[1]).filter(Boolean).at(-1)
    if (fallback) {
      try {
        completed = JSON.parse(fallback)
      } catch {
        completed = fallback
      }
    }
  }

  if (completed === null) throw new Error("El motor musical no devolvió un resultado completo")
  return completed
}

function extractFileDescriptor(value: unknown): { url: string; mime?: string } {
  const item = Array.isArray(value) ? value[0] : value
  if (typeof item === "string") return { url: item }
  if (!item || typeof item !== "object") throw new Error("El motor musical no devolvió un archivo de audio")

  const record = item as Record<string, unknown>
  const url = String(record.url || record.path || record.name || "")
  const mime = typeof record.mime_type === "string" ? record.mime_type : undefined
  if (!url) throw new Error("El motor musical devolvió un archivo sin URL")
  return { url, mime }
}

function absoluteFileUrl(baseUrl: string, value: string) {
  if (/^https?:\/\//i.test(value)) return value
  return `${baseUrl}/${value.replace(/^\/+/, "")}`
}

export async function generateSongWithAceStep(input: SongEngineInput): Promise<SongEngineOutput> {
  const baseUrl = cleanBaseUrl(
    process.env.ACE_STEP_SPACE_URL || "https://esthefanomc23-eduai-song-engine.hf.space"
  )
  const token = getHuggingFaceToken()

  if (!token) {
    throw new Error("Falta HF_TOKEN en Vercel para acceder al motor privado de canciones")
  }

  const data = [
    input.prompt,
    input.lyrics,
    input.duration,
    input.bpm || 0,
    input.keyScale,
    input.timeSignature,
    input.vocalLanguage,
    input.instrumental,
    input.vocalStyle,
    input.referenceAudioUrl || "",
    Number.isFinite(input.seed) ? input.seed : -1,
  ]

  const candidatePaths = [
    "/gradio_api/call/generate_song",
    "/call/generate_song",
  ]

  let startResponse: Response | null = null
  let callPath = candidatePaths[0]

  for (const path of candidatePaths) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: authHeaders(token, true),
      body: JSON.stringify({ data }),
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    }).catch(() => null)

    if (response && response.status !== 404) {
      startResponse = response
      callPath = path
      break
    }
  }

  if (!startResponse) throw new Error("No se pudo contactar el Space privado de canciones")

  const startText = await startResponse.text()
  if (!startResponse.ok) {
    throw new Error(`Motor musical no disponible (${startResponse.status}): ${startText.slice(0, 300)}`)
  }

  let eventId = ""
  try {
    eventId = String(JSON.parse(startText)?.event_id || "")
  } catch {
    eventId = ""
  }
  if (!eventId) throw new Error("El motor musical no entregó un identificador de generación")

  const streamResponse = await fetch(`${baseUrl}${callPath}/${encodeURIComponent(eventId)}`, {
    headers: authHeaders(token),
    cache: "no-store",
    signal: AbortSignal.timeout(280_000),
  })

  const streamText = await streamResponse.text()
  if (!streamResponse.ok) {
    throw new Error(`La generación musical falló (${streamResponse.status}): ${streamText.slice(0, 300)}`)
  }

  const completed = parseSseResult(streamText)
  const resultArray = Array.isArray(completed) ? completed : [completed]
  const file = extractFileDescriptor(resultArray[0])
  const sourceUrl = absoluteFileUrl(baseUrl, file.url)

  let metadata: Record<string, unknown> = {}
  const rawMetadata = resultArray[1]
  if (typeof rawMetadata === "string" && rawMetadata.trim()) {
    try {
      metadata = JSON.parse(rawMetadata)
    } catch {
      metadata = { raw: rawMetadata }
    }
  } else if (rawMetadata && typeof rawMetadata === "object") {
    metadata = rawMetadata as Record<string, unknown>
  }

  const audioResponse = await fetch(sourceUrl, {
    headers: authHeaders(token),
    cache: "no-store",
    signal: AbortSignal.timeout(90_000),
  })
  if (!audioResponse.ok) {
    throw new Error(`No se pudo descargar la canción generada (${audioResponse.status})`)
  }

  const buffer = await audioResponse.arrayBuffer()
  if (buffer.byteLength < 4_000) throw new Error("El archivo generado está vacío o incompleto")

  return {
    bytes: new Uint8Array(buffer),
    mime: audioResponse.headers.get("content-type") || file.mime || "audio/wav",
    metadata,
    sourceUrl,
  }
}
