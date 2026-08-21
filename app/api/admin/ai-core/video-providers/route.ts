import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

function configured(name: string) {
  return Boolean(process.env[name]?.trim())
}

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

function wanConfigured() {
  return configured("WAN_VIDEO_API_KEY") || configured("DASHSCOPE_API_KEY")
}

function hfGradioConfigured() {
  return configured("HF_GRADIO_VIDEO_BASE_URL")
}

function hfLegacyConfigured() {
  return configured("HF_SPACE_VIDEO_API_URL")
}

function googleConfigured() {
  return configured("GEMINI_API_KEY_VIDEO") || configured("GEMINI_API_KEY") || configured("GOOGLE_API_KEY")
}

function effectiveOrder() {
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

  // Debe reflejar exactamente la política del router real: ahorro primero y Google/Veo al final.
  const premiumConfigured = order.includes("google") || googleConfigured()
  const freeFirst = order.filter(provider => provider !== "google")
  if (premiumConfigured) freeFirst.push("google")

  if (!freeFirst.length) {
    const fallback: string[] = []
    if (wanConfigured()) fallback.push("wan")
    if (hfGradioConfigured()) fallback.push("hf-gradio")
    if (hfLegacyConfigured()) fallback.push("hf-space")
    if (googleConfigured()) fallback.push("google")
    return fallback
  }

  return freeFirst
}

function classifyError(error: string | null | undefined) {
  const value = String(error || "")
  if (!value) return null
  if (/429|RESOURCE_EXHAUSTED|quota|billing/i.test(value)) return "quota_or_billing"
  if (/401|403|unauthorized|forbidden|api.?key/i.test(value)) return "credentials"
  if (/timeout|timed out|abort/i.test(value)) return "timeout"
  if (/moderation|blocked|safety/i.test(value)) return "moderation"
  return "provider_error"
}

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })

  const providers = [
    {
      id: "wan",
      label: "Alibaba WAN",
      configured: wanConfigured(),
      tier: "free_quota",
      textToVideo: true,
      imageToVideo: true,
      model: process.env.WAN_VIDEO_MODEL_TEXT || "wan2.7-t2v-2026-06-12",
      note: "Usa cuota gratuita cuando esté disponible. Puede configurarse en modo sin cargos automáticos desde Alibaba.",
    },
    {
      id: "hf-gradio",
      label: "Hugging Face / Gradio",
      configured: hfGradioConfigured(),
      tier: "shared_free",
      textToVideo: true,
      imageToVideo: false,
      model: process.env.HF_GRADIO_VIDEO_MODEL || "Wan-AI/Wan2.1-T2V-1.3B-Diffusers",
      note: "Adecuado para Space/worker compartido. La cuota depende del host y no se considera ilimitada.",
    },
    {
      id: "hf-space",
      label: "HF Space legacy",
      configured: hfLegacyConfigured(),
      tier: "external",
      textToVideo: true,
      imageToVideo: true,
      model: null,
      note: "Adapter HTTP de compatibilidad. Se mantiene mientras migramos a Gradio asíncrono.",
    },
    {
      id: "google",
      label: "Google Veo",
      configured: googleConfigured(),
      tier: "premium",
      textToVideo: true,
      imageToVideo: true,
      model: process.env.GOOGLE_VIDEO_MODEL_PRIMARY || "veo-3.1-lite-generate-preview",
      note: "Premium/opcional. Tener API key no garantiza cuota de video; requiere billing/cuota disponible.",
    },
  ]

  let recentFailures: Array<{ provider: string | null; model: string | null; category: string | null; at: string | null }> = []
  let personalCredentialCount = 0
  let personalSpendEventCount = 0
  const admin = adminClient()
  if (admin) {
    const [{ data }, credentials, spendEvents] = await Promise.all([
      admin
        .from("video_jobs")
        .select("provider,model,error_message,completed_at,updated_at")
        .eq("status", "failed")
        .order("updated_at", { ascending: false })
        .limit(8),
      admin.from("user_ai_credentials").select("id", { count: "exact", head: true }),
      admin.from("user_ai_spend_events").select("id", { count: "exact", head: true }),
    ])

    recentFailures = (data || []).map(row => ({
      provider: row.provider || null,
      model: row.model || null,
      category: classifyError(row.error_message),
      at: row.completed_at || row.updated_at || null,
    }))
    personalCredentialCount = credentials.count ?? 0
    personalSpendEventCount = spendEvents.count ?? 0
  }

  const freeConfigured = providers.some(provider => provider.configured && provider.tier !== "premium")

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    freeConfigured,
    premiumConfigured: googleConfigured(),
    configuredOrder: process.env.VIDEO_PROVIDER_ORDER || null,
    effectiveOrder: effectiveOrder(),
    providers,
    personalMarketplace: {
      enabled: true,
      masterKeyConfigured: configured("EDUAI_CREDENTIALS_MASTER_KEY"),
      credentialCount: personalCredentialCount,
      spendEventCount: personalSpendEventCount,
      supportedProviders: ["fal", "replicate", "huggingface"],
      generationProviders: ["fal", "replicate"],
      billingOwner: "user",
    },
    recentFailures,
  }, { headers: { "Cache-Control": "no-store" } })
}
