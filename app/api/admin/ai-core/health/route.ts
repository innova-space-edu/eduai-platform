import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { generateGoogleText, hasGoogleAI } from "@/lib/ai/providers/google"

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
      google: hasGoogleAI("video"),
      fallback: configured("HF_SPACE_VIDEO_API_URL"),
      cronSecret: configured("CRON_SECRET") || configured("VIDEO_CRON_SECRET"),
      providerOrder: process.env.VIDEO_PROVIDER_ORDER || "google,hf-space",
    },
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

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })

  const config = configuration()
  const supabase = await supabaseReadiness()
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
  let status: "healthy" | "degraded" | "down" = "healthy"
  let errorCode: string | null = null
  let model: string | null = null
  let errorMessage: string | null = null

  try {
    const result = await generateGoogleText({
      messages: [
        { role: "system", content: "Health check técnico. Responde únicamente OK." },
        { role: "user", content: "OK" },
      ],
      maxOutputTokens: 8,
      lite: true,
    })
    model = result.model
    if (!/ok/i.test(result.text)) status = "degraded"
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
      metadata: errorMessage ? { error: errorMessage.slice(0, 500) } : {},
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