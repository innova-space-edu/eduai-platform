import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { hasGoogleAI } from "@/lib/ai/providers/google"
import { resolveProviderModel } from "@/lib/ai/model-registry"

export const runtime = "nodejs"
export const maxDuration = 30

const REQUIRED_TABLES = [
  "profiles",
  "admin_emails",
  "notebooks",
  "notebook_sources",
  "eduai_assets",
  "eduai_asset_links",
  "ai_generation_requests",
  "ai_generation_cache",
  "eduai_user_access",
  "video_jobs",
  "video_usage_daily",
] as const

function supabaseUrl() {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || null
}

function adminClient() {
  const url = supabaseUrl()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function projectRef() {
  const raw = supabaseUrl()
  if (!raw) return null
  try {
    return new URL(raw).hostname.split(".")[0] || null
  } catch {
    return null
  }
}

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return null
  const { data } = await supabase.from("admin_emails").select("email").eq("email", user.email).maybeSingle()
  return data ? user : null
}

function configured(name: string) {
  return Boolean(process.env[name]?.trim())
}

function googleTextKey() {
  return (
    process.env.GEMINI_API_KEY_TEXT ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    null
  )
}

function wanConfigured() {
  return configured("WAN_VIDEO_API_KEY") || configured("DASHSCOPE_API_KEY")
}

function hfGradioConfigured() {
  return configured("HF_GRADIO_VIDEO_BASE_URL")
}

function hfLegacyConfigured() {
  return configured("HF_SPACE_VIDEO_API_URL")
}

function googleVideoConfigured() {
  return configured("GEMINI_API_KEY_VIDEO") || configured("GEMINI_API_KEY") || configured("GOOGLE_API_KEY")
}

function effectiveVideoProviderOrder() {
  const configuredOrder = (process.env.VIDEO_PROVIDER_ORDER || "wan,hf-gradio,hf-space,google")
    .split(",")
    .map(value => value.trim().toLowerCase())
    .filter(Boolean)
    .map(value => value === "replicate" || value === "veo" ? "google" : value)
    .filter(value => ["wan", "hf-gradio", "hf-space", "google", "ltx", "wan-worker"].includes(value))

  const order = Array.from(new Set(configuredOrder))
  if (wanConfigured() && !order.includes("wan")) order.unshift("wan")
  if (hfGradioConfigured() && !order.includes("hf-gradio")) {
    order.splice(order[0] === "wan" ? 1 : 0, 0, "hf-gradio")
  }
  if (hfLegacyConfigured() && !order.includes("hf-space")) {
    const googleIndex = order.indexOf("google")
    if (googleIndex >= 0) order.splice(googleIndex, 0, "hf-space")
    else order.push("hf-space")
  }

  // Mismo criterio que el router real: reutilización primero, opciones de ahorro después y Veo al final.
  const premiumConfigured = order.includes("google") || googleVideoConfigured()
  const freeFirst = order.filter(provider => provider !== "google")
  if (premiumConfigured) freeFirst.push("google")

  if (!freeFirst.length) {
    const fallback: string[] = []
    if (wanConfigured()) fallback.push("wan")
    if (hfGradioConfigured()) fallback.push("hf-gradio")
    if (hfLegacyConfigured()) fallback.push("hf-space")
    if (googleVideoConfigured()) fallback.push("google")
    return fallback.join(",")
  }

  return freeFirst.join(",")
}

function configuration() {
  return {
    google: {
      text: hasGoogleAI("text"),
      image: hasGoogleAI("image"),
      video: hasGoogleAI("video"),
      sharedKey: configured("GEMINI_API_KEY") || configured("GOOGLE_API_KEY"),
      dedicatedTextKey: configured("GEMINI_API_KEY_TEXT"),
      dedicatedImageKey: configured("GEMINI_API_KEY_IMAGE"),
      dedicatedVideoKey: configured("GEMINI_API_KEY_VIDEO"),
      textModel: process.env.GOOGLE_TEXT_MODEL_PRIMARY || process.env.GEMINI_TEXT_MODEL_PRIMARY || "gemini-3.6-flash",
      liteModel: process.env.GOOGLE_TEXT_MODEL_LITE || process.env.GEMINI_TEXT_MODEL_LITE || "gemini-3.5-flash-lite",
      embeddingModel: process.env.GOOGLE_EMBEDDING_MODEL || "gemini-embedding-2",
      imageModel: process.env.GOOGLE_IMAGE_MODEL_PRIMARY || process.env.GEMINI_IMAGE_MODEL_PRIMARY || "gemini-3.1-flash-image",
      videoModel: process.env.GOOGLE_VIDEO_MODEL_PRIMARY || "veo-3.1-generate-preview",
    },
    groq: { configured: configured("GROQ_API_KEY") },
    openrouter: {
      configured: configured("OPENROUTER_API_KEY") || configured("OPENROUTER_API_KEY_1"),
    },
    together: {
      configured: configured("TOGETHER_API_KEY") || configured("TOGETHER_API_KEY_1"),
    },
    cerebras: { configured: configured("CEREBRAS_API_KEY") },
    redis: {
      configured: configured("UPSTASH_REDIS_REST_URL") && configured("UPSTASH_REDIS_REST_TOKEN"),
    },
    research: {
      tavily: configured("TAVILY_API_KEY"),
      firecrawl: configured("FIRECRAWL_API_KEY"),
      googleGrounding: hasGoogleAI("text"),
    },
    video: {
      google: googleVideoConfigured(),
      fallback: wanConfigured() || hfGradioConfigured() || hfLegacyConfigured(),
      cronSecret: configured("CRON_SECRET") || configured("VIDEO_CRON_SECRET"),
      configuredProviderOrder: process.env.VIDEO_PROVIDER_ORDER || "wan,hf-gradio,hf-space,google",
      providerOrder: effectiveVideoProviderOrder(),
    },
  }
}

async function effectiveGoogleModels() {
  const base = configuration().google
  const admin = adminClient()
  if (!admin) {
    return {
      text: { model: base.textModel, source: "fallback" as const },
      image: { model: base.imageModel, source: "fallback" as const },
      video: { model: base.videoModel, source: "fallback" as const },
    }
  }

  const [text, image, video] = await Promise.all([
    resolveProviderModel({ supabase: admin, provider: "google", capability: "text", fallbackModel: base.textModel }),
    resolveProviderModel({ supabase: admin, provider: "google", capability: "image", fallbackModel: base.imageModel }),
    resolveProviderModel({ supabase: admin, provider: "google", capability: "video", fallbackModel: base.videoModel }),
  ])

  return {
    text: { model: text.model, source: text.source },
    image: { model: image.model, source: image.source },
    video: { model: video.model, source: video.source },
  }
}

async function checkTableViaPostgrest(table: string) {
  const url = supabaseUrl()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return { table, available: false, error: "Supabase no configurado" }

  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${encodeURIComponent(table)}?select=*&limit=0`, {
      method: "GET",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
      cache: "no-store",
    })

    if (response.ok) return { table, available: true }

    const payload = await response.json().catch(() => null) as { message?: string; code?: string } | null
    return {
      table,
      available: false,
      error: payload?.message || payload?.code || `PostgREST ${response.status}`,
    }
  } catch (error) {
    return {
      table,
      available: false,
      error: error instanceof Error ? error.message : "No disponible",
    }
  }
}

async function supabaseReadiness() {
  const admin = adminClient()
  const urlConfigured = configured("SUPABASE_URL") || configured("NEXT_PUBLIC_SUPABASE_URL")
  const publishableConfigured = configured("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") || configured("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  const serviceRoleConfigured = configured("SUPABASE_SERVICE_ROLE_KEY")

  const result = {
    configured: urlConfigured && publishableConfigured,
    serviceRoleConfigured,
    projectRef: projectRef(),
    tables: [] as Array<{ table: string; available: boolean; error?: string }>,
    assetBucket: { available: false, error: undefined as string | undefined },
  }

  if (!admin) return result

  result.tables = await Promise.all(REQUIRED_TABLES.map(table => checkTableViaPostgrest(table)))

  try {
    const { data: buckets, error } = await admin.storage.listBuckets()
    if (error) {
      result.assetBucket = { available: false, error: error.message }
    } else {
      result.assetBucket = {
        available: Boolean((buckets || []).some(bucket => bucket.name === "eduai-assets")),
        error: undefined,
      }
    }
  } catch (error) {
    result.assetBucket = {
      available: false,
      error: error instanceof Error ? error.message : "No disponible",
    }
  }

  return result
}

async function probeGoogleLite(model: string) {
  const key = googleTextKey()
  if (!key) throw Object.assign(new Error("GEMINI_API_KEY no configurada"), { code: "GOOGLE_KEY_MISSING" })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8_000)

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Responde únicamente OK" }] }],
          generationConfig: { maxOutputTokens: 8, temperature: 0 },
        }),
        signal: controller.signal,
        cache: "no-store",
      },
    )

    const payload = await response.json().catch(() => null) as any
    if (!response.ok) {
      const message = payload?.error?.message || `Google HTTP ${response.status}`
      throw Object.assign(new Error(message), { code: `GOOGLE_HTTP_${response.status}` })
    }

    const text = payload?.candidates?.[0]?.content?.parts
      ?.map((part: any) => String(part?.text || ""))
      .join(" ")
      .trim() || ""

    return text
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw Object.assign(new Error("Google no respondió dentro de 8 segundos"), { code: "GOOGLE_HEALTH_TIMEOUT" })
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })

  const baseConfig = configuration()
  const [supabase, effectiveModels] = await Promise.all([
    supabaseReadiness(),
    effectiveGoogleModels(),
  ])
  const config = {
    ...baseConfig,
    google: {
      ...baseConfig.google,
      effectiveModels,
    },
  }
  const tablesReady = supabase.tables.length > 0 && supabase.tables.every(item => item.available)
  const ready = Boolean(
    supabase.configured &&
    supabase.serviceRoleConfigured &&
    tablesReady &&
    supabase.assetBucket.available &&
    config.google.text,
  )

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    ready,
    configuration: config,
    supabase,
  }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const provider = String(body?.provider || "google").toLowerCase()
  if (provider !== "google") {
    return NextResponse.json(
      { error: "El health check activo está habilitado inicialmente para Google. Los demás proveedores se validan al usarse mediante el Gateway." },
      { status: 400 },
    )
  }

  if (!hasGoogleAI("text")) {
    return NextResponse.json({ ok: false, provider: "google", status: "down", error: "GEMINI_API_KEY no configurada" }, { status: 503 })
  }

  const startedAt = Date.now()
  const baseConfig = configuration()
  const healthModel = baseConfig.google.liteModel
  let status: "healthy" | "degraded" | "down" = "healthy"
  let errorCode: string | null = null
  const model: string | null = healthModel
  let errorMessage: string | null = null

  try {
    const text = await probeGoogleLite(healthModel)
    if (!/ok/i.test(text)) status = "degraded"
  } catch (error) {
    status = "down"
    errorCode = (error as { code?: string })?.code || "GOOGLE_HEALTH_FAILED"
    errorMessage = error instanceof Error ? error.message : String(error)
  }

  const latencyMs = Date.now() - startedAt
  const admin = adminClient()
  if (admin) {
    const { error } = await admin.from("ai_provider_health").insert({
      provider: "google",
      model,
      capability: "text",
      status,
      latency_ms: latencyMs,
      error_code: errorCode,
      metadata: {
        health_check: "lite",
        ...(errorMessage ? { error: errorMessage.slice(0, 500) } : {}),
      },
      checked_at: new Date().toISOString(),
    })
    if (error && error.code !== "42P01") console.warn("[AI health]", error.message)
  }

  return NextResponse.json({
    ok: status !== "down",
    provider: "google",
    model,
    status,
    latencyMs,
    error: errorMessage,
  }, { status: status === "down" ? 503 : 200 })
}
