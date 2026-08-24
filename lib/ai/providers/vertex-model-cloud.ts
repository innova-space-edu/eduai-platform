import type { GatewayMessage } from "./google"

const CLOUD_SCOPE = "https://www.googleapis.com/auth/cloud-platform"
const DEFAULT_TIMEOUT_MS = 60_000

type VertexModelCloudProtocol = "completion" | "chat"

type VertexModelCloudConfig = {
  enabled: boolean
  projectId: string
  projectNumber: string
  location: string
  endpointId: string
  modelId: string
  serviceAccountEmail: string
  workloadIdentityPoolId: string
  workloadIdentityProviderId: string
  protocol: VertexModelCloudProtocol
  timeoutMs: number
}

let accessTokenCache: { token: string; expiresAt: number } | null = null

function env(name: string) {
  return process.env[name]?.trim() || ""
}

function timeoutMs() {
  const parsed = Number(process.env.VERTEX_MODEL_CLOUD_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 5_000), 180_000) : DEFAULT_TIMEOUT_MS
}

export function vertexModelCloudConfig(): VertexModelCloudConfig {
  const protocol = process.env.VERTEX_MODEL_CLOUD_PROTOCOL === "chat" ? "chat" : "completion"
  return {
    enabled: process.env.VERTEX_MODEL_CLOUD_ENABLED === "true",
    projectId: env("GCP_PROJECT_ID") || env("GOOGLE_CLOUD_PROJECT"),
    projectNumber: env("GCP_PROJECT_NUMBER"),
    location: env("VERTEX_MODEL_CLOUD_LOCATION") || env("GOOGLE_CLOUD_LOCATION") || "us-central1",
    endpointId: env("VERTEX_MODEL_CLOUD_ENDPOINT_ID"),
    modelId: env("VERTEX_MODEL_CLOUD_MODEL_ID") || "vertex-model-cloud",
    serviceAccountEmail: env("GCP_SERVICE_ACCOUNT_EMAIL"),
    workloadIdentityPoolId: env("GCP_WORKLOAD_IDENTITY_POOL_ID"),
    workloadIdentityProviderId: env("GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID"),
    protocol,
    timeoutMs: timeoutMs(),
  }
}

export function vertexModelCloudModel() {
  return vertexModelCloudConfig().modelId
}

export function hasVertexModelCloud() {
  const config = vertexModelCloudConfig()
  return Boolean(
    config.enabled &&
    config.projectId &&
    config.projectNumber &&
    config.endpointId &&
    config.serviceAccountEmail &&
    config.workloadIdentityPoolId &&
    config.workloadIdentityProviderId
  )
}

function safeErrorDetail(value: unknown) {
  if (typeof value === "string") return value.slice(0, 600)
  try {
    return JSON.stringify(value).slice(0, 600)
  } catch {
    return "respuesta no legible"
  }
}

async function vercelOidcSubjectToken() {
  const envToken = env("VERCEL_OIDC_TOKEN")
  if (envToken) return envToken

  try {
    const { headers } = await import("next/headers")
    const requestHeaders = await headers()
    const token = requestHeaders.get("x-vercel-oidc-token")?.trim()
    if (token) return token
  } catch {
    // Fuera de un request de Next.js no existe un token OIDC de Vercel.
  }

  const error = new Error(
    "Vertex Model Cloud requiere OIDC de Vercel. Habilita Secure backend access/OIDC en el proyecto de Vercel."
  ) as Error & { code?: string }
  error.code = "VERTEX_MODEL_CLOUD_OIDC_MISSING"
  throw error
}

async function googleAccessToken(config: VertexModelCloudConfig) {
  const now = Date.now()
  if (accessTokenCache && accessTokenCache.expiresAt > now + 60_000) {
    return accessTokenCache.token
  }

  if (!config.serviceAccountEmail.endsWith(".iam.gserviceaccount.com")) {
    const error = new Error("GCP_SERVICE_ACCOUNT_EMAIL no corresponde a una service account de Google Cloud") as Error & { code?: string }
    error.code = "VERTEX_MODEL_CLOUD_SERVICE_ACCOUNT_INVALID"
    throw error
  }

  const subjectToken = await vercelOidcSubjectToken()
  const audience = `//iam.googleapis.com/projects/${config.projectNumber}/locations/global/workloadIdentityPools/${config.workloadIdentityPoolId}/providers/${config.workloadIdentityProviderId}`
  const exchangeBody = new URLSearchParams({
    audience,
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
    requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
    scope: CLOUD_SCOPE,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    subject_token: subjectToken,
  })

  const stsResponse = await fetch("https://sts.googleapis.com/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: exchangeBody,
    signal: AbortSignal.timeout(config.timeoutMs),
    cache: "no-store",
  })
  const stsPayload = await stsResponse.json().catch(() => null) as { access_token?: string; error?: string; error_description?: string } | null
  if (!stsResponse.ok || !stsPayload?.access_token) {
    const error = new Error(`Google STS rechazó la identidad OIDC (${stsResponse.status}): ${safeErrorDetail(stsPayload?.error_description || stsPayload?.error)}`) as Error & { code?: string }
    error.code = "VERTEX_MODEL_CLOUD_STS_FAILED"
    throw error
  }

  const impersonationUrl = `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${config.serviceAccountEmail}:generateAccessToken`
  const iamResponse = await fetch(impersonationUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stsPayload.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ scope: [CLOUD_SCOPE], lifetime: "3600s" }),
    signal: AbortSignal.timeout(config.timeoutMs),
    cache: "no-store",
  })
  const iamPayload = await iamResponse.json().catch(() => null) as { accessToken?: string; expireTime?: string; error?: { message?: string } } | null
  if (!iamResponse.ok || !iamPayload?.accessToken) {
    const error = new Error(`Google IAM Credentials rechazó la suplantación (${iamResponse.status}): ${safeErrorDetail(iamPayload?.error?.message)}`) as Error & { code?: string }
    error.code = "VERTEX_MODEL_CLOUD_IMPERSONATION_FAILED"
    throw error
  }

  const parsedExpiry = iamPayload.expireTime ? Date.parse(iamPayload.expireTime) : NaN
  accessTokenCache = {
    token: iamPayload.accessToken,
    expiresAt: Number.isFinite(parsedExpiry) ? parsedExpiry : now + 50 * 60_000,
  }
  return iamPayload.accessToken
}

function promptFromMessages(messages: GatewayMessage[]) {
  return messages
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n")
}

function withStructuredInstruction(messages: GatewayMessage[], schema?: Record<string, unknown>) {
  if (!schema) return messages
  return [
    {
      role: "system" as const,
      content: `Devuelve exclusivamente JSON válido que cumpla este JSON Schema. No uses markdown.\n${JSON.stringify(schema)}`,
    },
    ...messages,
  ]
}

function decodeRawPredictPayload(raw: string): unknown {
  const parsed = JSON.parse(raw)
  if (
    parsed &&
    typeof parsed === "object" &&
    typeof (parsed as { data?: unknown }).data === "string" &&
    typeof (parsed as { contentType?: unknown }).contentType === "string"
  ) {
    const decoded = Buffer.from((parsed as { data: string }).data, "base64").toString("utf8")
    return JSON.parse(decoded)
  }
  return parsed
}

export async function generateVertexModelCloudText(input: {
  messages: GatewayMessage[]
  model?: string | null
  maxOutputTokens?: number
  structuredSchema?: Record<string, unknown>
}) {
  const config = vertexModelCloudConfig()
  if (!hasVertexModelCloud()) {
    const error = new Error("Vertex Model Cloud no está configurado") as Error & { code?: string }
    error.code = "VERTEX_MODEL_CLOUD_NOT_CONFIGURED"
    throw error
  }

  const accessToken = await googleAccessToken(config)
  const messages = withStructuredInstruction(input.messages, input.structuredSchema)
  const model = input.model?.trim() || config.modelId
  const maxTokens = Math.min(Math.max(input.maxOutputTokens || 1024, 8), 8192)
  const requestBody = config.protocol === "chat"
    ? {
        model,
        messages: messages.map((message) => ({ role: message.role, content: message.content })),
        max_tokens: maxTokens,
        temperature: 0.2,
        stream: false,
      }
    : {
        model,
        prompt: promptFromMessages(messages),
        max_tokens: maxTokens,
        temperature: 0.2,
        stream: false,
      }

  const endpointResource = `projects/${config.projectId}/locations/${config.location}/endpoints/${config.endpointId}`
  const url = `https://${config.location}-aiplatform.googleapis.com/v1/${endpointResource}:rawPredict`
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(config.timeoutMs),
    cache: "no-store",
  })
  const raw = await response.text()
  if (!response.ok) {
    const error = new Error(`Vertex Model Cloud respondió HTTP ${response.status}: ${safeErrorDetail(raw)}`) as Error & { code?: string }
    error.code = response.status === 429 ? "VERTEX_MODEL_CLOUD_QUOTA" : "VERTEX_MODEL_CLOUD_INFERENCE_FAILED"
    throw error
  }

  let data: any
  try {
    data = decodeRawPredictPayload(raw)
  } catch {
    const error = new Error("Vertex Model Cloud devolvió una respuesta no JSON") as Error & { code?: string }
    error.code = "VERTEX_MODEL_CLOUD_RESPONSE_INVALID"
    throw error
  }

  const text =
    data?.choices?.[0]?.message?.content ??
    data?.choices?.[0]?.text ??
    data?.text ??
    ""
  if (typeof text !== "string" || !text.trim()) {
    const error = new Error("Vertex Model Cloud no devolvió texto") as Error & { code?: string }
    error.code = "VERTEX_MODEL_CLOUD_EMPTY"
    throw error
  }

  return {
    text: text.trim(),
    provider: "vertex-model-cloud" as const,
    model: typeof data?.model === "string" && data.model ? data.model : model,
  }
}
