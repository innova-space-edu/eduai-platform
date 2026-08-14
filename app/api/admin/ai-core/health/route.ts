import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { generateGoogleText, hasGoogleAI } from "@/lib/ai/providers/google"

export const runtime = "nodejs"
export const maxDuration = 30

function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
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
    },
  }
}

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
  return NextResponse.json({ configuration: configuration() })
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
