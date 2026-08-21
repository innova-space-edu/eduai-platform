import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

function parseSupabaseAssetUrl(value: string | null | undefined) {
  if (!value?.startsWith("supabase://")) return null
  const rest = value.slice("supabase://".length)
  const slash = rest.indexOf("/")
  if (slash <= 0) return null
  return { bucket: rest.slice(0, slash), path: rest.slice(slash + 1) }
}

async function signedUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  value: string | null | undefined,
) {
  if (!value) return null
  const parsed = parseSupabaseAssetUrl(value)
  if (!parsed) return value
  const { data, error } = await supabase.storage.from(parsed.bucket).createSignedUrl(parsed.path, 60 * 30)
  return error ? null : data?.signedUrl || null
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const { data, error } = await supabase
    .from("video_jobs")
    .select("id,status,provider,model,video_url,thumbnail_url,asset_id,error_message,request_payload,created_at,updated_at,completed_at")
    .eq("user_id", user.id)
    .eq("plan", "personal")
    .order("created_at", { ascending: false })
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const jobs = await Promise.all((data || []).map(async row => {
    const payload = (row.request_payload || {}) as Record<string, unknown>
    const estimated = typeof payload.estimatedCostUsd === "number" ? payload.estimatedCostUsd : null
    return {
      jobId: row.id,
      status: row.status,
      provider: row.provider || null,
      model: row.model || null,
      estimatedCostUsd: estimated,
      videoUrl: await signedUrl(supabase, row.video_url),
      thumbnailUrl: row.thumbnail_url || null,
      assetId: row.asset_id || null,
      errorMessage: row.error_message || null,
      reusable: Boolean(row.status === "completed" && row.asset_id),
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null,
      completedAt: row.completed_at || null,
    }
  }))

  return NextResponse.json({ jobs }, { headers: { "Cache-Control": "no-store" } })
}
