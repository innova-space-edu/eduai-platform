type OpenVoiceConversionInput = {
  referenceAudioUrl: string
  sourceBytes: Uint8Array
  sourceMime: string
}

type OpenVoiceAudioOutput = {
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
    process.env.OPENVOICE_HF_TOKEN,
    process.env.ACE_STEP_HF_TOKEN,
    process.env.HF_TOKEN,
    process.env.HF_TOKEN_1,
    process.env.HUGGINGFACE_API_KEY,
  ].find((value) => value?.trim())?.trim() || ""
}

function authHeaders(token: string, json = false): HeadersInit {
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (json) headers["Content-Type"] = "application/json"
  return headers
}

async function probePrivateSpace(token: string) {
  const repoId = process.env.OPENVOICE_SPACE_REPO || "EsthefanoMC23/eduai-openvoice-private"
  const response = await fetch(`https://huggingface.co/api/spaces/${repoId}`, {
    headers: authHeaders(token),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null)

  if (!response) throw new Error("No se pudo contactar Hugging Face para validar OpenVoice")
  if ([401, 403, 404].includes(response.status)) {
    throw new Error(
      "El Space privado de OpenVoice no existe o el token de Vercel no tiene acceso. Revisa OPENVOICE_HF_TOKEN/ACE_STEP_HF_TOKEN."
    )
  }
  if (!response.ok) throw new Error(`No se pudo consultar OpenVoice (${response.status})`)

  const payload = await response.json().catch(() => ({} as Record<string, unknown>))
  const runtime = payload && typeof payload === "object" ? (payload as Record<string, any>).runtime : null
  const stage = String(runtime?.stage || runtime?.status || "unknown").toUpperCase()
  if (["BUILDING", "BUILDING_APP", "STARTING", "PAUSED", "STOPPED", "SLEEPING", "ERROR"].includes(stage)) {
    throw new Error(`OpenVoice todavía no está disponible. Estado actual: ${stage}`)
  }
}

function parseSseResult(text: string) {
  let completed: unknown = null
  let failure = ""

  for (const block of text.split(/\r?\n\r?\n/)) {
    const event = block.match(/^event:\s*(.+)$/m)?.[1]?.trim() || ""
    const raw = [...block.matchAll(/^data:\s?(.*)$/gm)].map((match) => match[1]).join("\n").trim()
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
    const raw = [...text.matchAll(/^data:\s?(.*)$/gm)].map((match) => match[1]).filter(Boolean).at(-1)
    if (raw) {
      try {
        completed = JSON.parse(raw)
      } catch {
        completed = raw
      }
    }
  }
  if (completed === null) throw new Error("OpenVoice no devolvió un resultado completo")
  return completed
}

async function callPrivateGradio(apiName: string, data: unknown[], timeoutMs: number) {
  const baseUrl = cleanBaseUrl(
    process.env.OPENVOICE_SPACE_URL || "https://esthefanomc23-eduai-openvoice-private.hf.space"
  )
  const token = getHuggingFaceToken()
  if (!token) {
    throw new Error("Falta OPENVOICE_HF_TOKEN o ACE_STEP_HF_TOKEN en Vercel para usar OpenVoice")
  }

  await probePrivateSpace(token)

  const candidatePaths = [
    `/gradio_api/call/${apiName}`,
    `/call/${apiName}`,
  ]

  let startResponse: Response | null = null
  let callPath = candidatePaths[0]
  let lastStatus = 0
  for (const path of candidatePaths) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: authHeaders(token, true),
      body: JSON.stringify({ data }),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    }).catch(() => null)
    if (!response) continue
    lastStatus = response.status
    if (response.status !== 404) {
      startResponse = response
      callPath = path
      break
    }
  }

  if (!startResponse) {
    if (lastStatus === 404) throw new Error(`OpenVoice no publica el endpoint ${apiName}`)
    throw new Error("No se pudo iniciar la llamada al Space de OpenVoice")
  }

  const startText = await startResponse.text()
  if (!startResponse.ok) {
    throw new Error(`OpenVoice no disponible (${startResponse.status}): ${startText.slice(0, 240)}`)
  }

  let eventId = ""
  try {
    eventId = String(JSON.parse(startText)?.event_id || "")
  } catch {}
  if (!eventId) throw new Error("OpenVoice no entregó identificador de ejecución")

  const streamResponse = await fetch(`${baseUrl}${callPath}/${encodeURIComponent(eventId)}`, {
    headers: authHeaders(token),
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  })
  const streamText = await streamResponse.text()
  if (!streamResponse.ok) {
    throw new Error(`OpenVoice falló (${streamResponse.status}): ${streamText.slice(0, 280)}`)
  }

  return {
    completed: parseSseResult(streamText),
    baseUrl,
    token,
  }
}

function extractFileDescriptor(value: unknown): { url: string; mime?: string } {
  const item = Array.isArray(value) ? value[0] : value
  if (typeof item === "string") return { url: item }
  if (!item || typeof item !== "object") throw new Error("OpenVoice no devolvió un archivo de audio")
  const record = item as Record<string, unknown>
  const url = String(record.url || record.path || record.name || "")
  const mime = typeof record.mime_type === "string" ? record.mime_type : undefined
  if (!url) throw new Error("OpenVoice devolvió un archivo sin URL")
  return { url, mime }
}

function absoluteFileUrl(baseUrl: string, value: string) {
  if (/^https?:\/\//i.test(value)) return value
  return `${baseUrl}/${value.replace(/^\/+/, "")}`
}

function parseMetadata(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    try {
      return JSON.parse(value) as Record<string, unknown>
    } catch {
      return { raw: value }
    }
  }
  if (value && typeof value === "object") return value as Record<string, unknown>
  return {}
}

export async function prepareVoiceWithOpenVoice(referenceAudioUrl: string) {
  const { completed } = await callPrivateGradio("prepare_voice", [referenceAudioUrl], 180_000)
  const result = Array.isArray(completed) ? completed : [completed]
  const metadata = parseMetadata(result[0])
  if (metadata.ok === false) throw new Error(String(metadata.error || "OpenVoice rechazó la muestra vocal"))
  return metadata
}

export async function convertVoiceWithOpenVoice(input: OpenVoiceConversionInput): Promise<OpenVoiceAudioOutput> {
  const sourceBase64 = Buffer.from(input.sourceBytes).toString("base64")
  const { completed, baseUrl, token } = await callPrivateGradio(
    "convert_voice",
    [input.referenceAudioUrl, sourceBase64, input.sourceMime],
    240_000,
  )

  const result = Array.isArray(completed) ? completed : [completed]
  const file = extractFileDescriptor(result[0])
  const metadata = parseMetadata(result[1])
  const sourceUrl = absoluteFileUrl(baseUrl, file.url)

  const response = await fetch(sourceUrl, {
    headers: authHeaders(token),
    cache: "no-store",
    signal: AbortSignal.timeout(90_000),
  })
  if (!response.ok) throw new Error(`No se pudo descargar la voz clonada (${response.status})`)

  const buffer = await response.arrayBuffer()
  if (buffer.byteLength < 1_000) throw new Error("OpenVoice devolvió audio vacío o incompleto")

  const headerMime = String(response.headers.get("content-type") || file.mime || "").split(";", 1)[0].trim()
  const mime = headerMime.startsWith("audio/") && headerMime !== "audio/octet-stream"
    ? headerMime
    : "audio/wav"

  return {
    bytes: new Uint8Array(buffer),
    mime,
    metadata,
    sourceUrl,
  }
}
