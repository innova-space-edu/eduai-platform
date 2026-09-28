export type AudioEngineEvent = {
  progress?: number
  stage?: string
  label?: string
  error?: string
  job_id?: string
  profile_id?: string
  voice_id?: string
  audio_path?: string
  bucket?: string
  [key: string]: unknown
}

export type AudioEngineEventType = "progress" | "complete" | "error"

export const EDUAI_AUDIO_ENGINE_URL = "https://eduai-song-gateway-7rtwaj6pca-uc.a.run.app"

function parseSseBlock(block: string) {
  let event: AudioEngineEventType = "progress"
  const dataLines: string[] = []

  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("event:")) {
      const value = line.slice(6).trim()
      if (value === "complete" || value === "error" || value === "progress") event = value
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart())
    }
  }

  if (!dataLines.length) return null

  try {
    return { event, data: JSON.parse(dataLines.join("\n")) as AudioEngineEvent }
  } catch {
    return {
      event: "error" as const,
      data: { error: "El motor de audio devolvió una respuesta inválida" },
    }
  }
}

export async function streamAudioEngine(
  path: string,
  token: string,
  payload: Record<string, unknown>,
  onEvent: (type: AudioEngineEventType, data: AudioEngineEvent) => void,
) {
  const response = await fetch(`${EDUAI_AUDIO_ENGINE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(String(body?.detail || body?.error || `Google Audio Gateway respondió ${response.status}`))
  }
  if (!response.body) throw new Error("Google Audio Gateway no abrió el canal de progreso")

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let complete: AudioEngineEvent | null = null

  while (true) {
    const { value, done } = await reader.read()
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
    const blocks = buffer.split(/\r?\n\r?\n/)
    buffer = blocks.pop() || ""

    for (const block of blocks) {
      const parsed = parseSseBlock(block)
      if (!parsed) continue
      onEvent(parsed.event, parsed.data)
      if (parsed.event === "error") throw new Error(String(parsed.data.error || "El motor de audio informó un error"))
      if (parsed.event === "complete") complete = parsed.data
    }

    if (done) break
  }

  if (buffer.trim()) {
    const parsed = parseSseBlock(buffer)
    if (parsed) {
      onEvent(parsed.event, parsed.data)
      if (parsed.event === "error") throw new Error(String(parsed.data.error || "El motor de audio informó un error"))
      if (parsed.event === "complete") complete = parsed.data
    }
  }

  if (!complete) throw new Error("Google Audio Gateway cerró la conexión antes de completar la tarea")
  return complete
}

export async function callAudioEngine(
  path: string,
  token: string,
  payload: Record<string, unknown>,
) {
  const response = await fetch(`${EDUAI_AUDIO_ENGINE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(String(data?.detail || data?.error || `Google Audio Gateway respondió ${response.status}`))
  return data
}

export async function currentSupabaseToken(supabase: any) {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const token = data.session?.access_token
  if (!token) throw new Error("La sesión de EduAI venció. Vuelve a iniciar sesión.")
  return token
}
