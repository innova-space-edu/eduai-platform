export type ModelLabSmokeResult = {
  provider: string
  model: string
  supported: boolean
  passed: boolean
  latencyMs: number | null
  statusCode: number | null
  outputMatched: boolean
  detail: string
}

export type ModelLabTextCall = {
  provider: string
  model: string
  supported: boolean
  ok: boolean
  latencyMs: number | null
  statusCode: number | null
  text: string
  inputTokens: number | null
  outputTokens: number | null
  detail: string
}

const EXPECTED = "EDUAI_SMOKE_OK"
const PROMPT = `Prueba técnica de disponibilidad. Responde exactamente ${EXPECTED} y nada más.`

function timeoutMs() {
  const value = Number(process.env.EDUAI_AI_PROVIDER_TIMEOUT_MS || 30000)
  return Number.isFinite(value) ? Math.max(5000, Math.min(60000, value)) : 30000
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs())
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" })
  } finally {
    clearTimeout(timer)
  }
}

function secretFor(provider: string) {
  if (provider === "groq") return process.env.GROQ_API_KEY || ""
  if (provider === "openrouter") return process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY_1 || ""
  if (provider === "together") return process.env.TOGETHER_API_KEY || process.env.TOGETHER_API_KEY_1 || ""
  if (provider === "cerebras") return process.env.CEREBRAS_API_KEY || ""
  return ""
}

function endpointFor(provider: string) {
  if (provider === "groq") return "https://api.groq.com/openai/v1/chat/completions"
  if (provider === "openrouter") return "https://openrouter.ai/api/v1/chat/completions"
  if (provider === "together") return "https://api.together.xyz/v1/chat/completions"
  if (provider === "cerebras") return "https://api.cerebras.ai/v1/chat/completions"
  return ""
}

async function openAICompatible(provider: string, model: string, prompt: string, maxTokens = 128): Promise<ModelLabTextCall> {
  const key = secretFor(provider)
  const endpoint = endpointFor(provider)
  if (!key || !endpoint) {
    return { provider, model, supported: true, ok: false, latencyMs: null, statusCode: null, text: "", inputTokens: null, outputTokens: null, detail: `Falta API key server-side para ${provider}.` }
  }

  const started = Date.now()
  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    }
    if (provider === "openrouter") {
      headers["HTTP-Referer"] = process.env.OPENROUTER_REFERER || "https://eduaiplatformclon.vercel.app"
      headers["X-Title"] = process.env.OPENROUTER_APP_TITLE || "EduAI Platform"
    }

    const response = await fetchWithTimeout(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: maxTokens,
      }),
    })
    const latencyMs = Date.now() - started
    const payload = await response.json().catch(() => ({})) as any
    const text = String(payload?.choices?.[0]?.message?.content || "").trim()
    return {
      provider,
      model,
      supported: true,
      ok: response.ok,
      latencyMs,
      statusCode: response.status,
      text,
      inputTokens: Number.isFinite(payload?.usage?.prompt_tokens) ? Number(payload.usage.prompt_tokens) : null,
      outputTokens: Number.isFinite(payload?.usage?.completion_tokens) ? Number(payload.usage.completion_tokens) : null,
      detail: response.ok ? "Endpoint respondió correctamente." : String(payload?.error?.message || `HTTP ${response.status}`).slice(0, 400),
    }
  } catch (error) {
    return { provider, model, supported: true, ok: false, latencyMs: Date.now() - started, statusCode: null, text: "", inputTokens: null, outputTokens: null, detail: error instanceof Error ? error.message : "Error de red" }
  }
}

async function googleGemini(model: string, prompt: string, maxTokens = 128): Promise<ModelLabTextCall> {
  const key = process.env.GEMINI_API_KEY_TEXT || process.env.GEMINI_API_KEY || ""
  if (!key) return { provider: "google", model, supported: true, ok: false, latencyMs: null, statusCode: null, text: "", inputTokens: null, outputTokens: null, detail: "Falta GEMINI_API_KEY_TEXT/GEMINI_API_KEY server-side." }

  const started = Date.now()
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`
    const response = await fetchWithTimeout(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, maxOutputTokens: maxTokens },
      }),
    })
    const latencyMs = Date.now() - started
    const payload = await response.json().catch(() => ({})) as any
    const text = String(payload?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || "").join(" ") || "").trim()
    return {
      provider: "google",
      model,
      supported: true,
      ok: response.ok,
      latencyMs,
      statusCode: response.status,
      text,
      inputTokens: Number.isFinite(payload?.usageMetadata?.promptTokenCount) ? Number(payload.usageMetadata.promptTokenCount) : null,
      outputTokens: Number.isFinite(payload?.usageMetadata?.candidatesTokenCount) ? Number(payload.usageMetadata.candidatesTokenCount) : null,
      detail: response.ok ? "Endpoint respondió correctamente." : String(payload?.error?.message || `HTTP ${response.status}`).slice(0, 400),
    }
  } catch (error) {
    return { provider: "google", model, supported: true, ok: false, latencyMs: Date.now() - started, statusCode: null, text: "", inputTokens: null, outputTokens: null, detail: error instanceof Error ? error.message : "Error de red" }
  }
}

export function supportsTextSmoke(capabilities: string[]) {
  return capabilities.some(item => ["text", "structured", "long_context", "code", "research", "agentic", "reasoning", "tools"].includes(item))
}

export async function callModelLabText(provider: string, model: string, capabilities: string[], prompt: string, maxTokens = 128): Promise<ModelLabTextCall> {
  if (!supportsTextSmoke(capabilities)) {
    return { provider, model, supported: false, ok: false, latencyMs: null, statusCode: null, text: "", inputTokens: null, outputTokens: null, detail: "Este candidato requiere un benchmark de modalidad específica (audio, imagen, video o safety)." }
  }
  if (provider === "google") return googleGemini(model, prompt, maxTokens)
  if (["groq", "openrouter", "together", "cerebras"].includes(provider)) return openAICompatible(provider, model, prompt, maxTokens)
  return { provider, model, supported: false, ok: false, latencyMs: null, statusCode: null, text: "", inputTokens: null, outputTokens: null, detail: `Proveedor ${provider} aún no tiene adapter de texto.` }
}

export async function runModelLabSmoke(provider: string, model: string, capabilities: string[]): Promise<ModelLabSmokeResult> {
  const result = await callModelLabText(provider, model, capabilities, PROMPT, 32)
  const outputMatched = result.text.includes(EXPECTED)
  return {
    provider,
    model,
    supported: result.supported,
    passed: result.ok && outputMatched,
    latencyMs: result.latencyMs,
    statusCode: result.statusCode,
    outputMatched,
    detail: result.ok ? (outputMatched ? "Smoke test correcto." : "El endpoint respondió, pero no respetó la salida de control.") : result.detail,
  }
}
