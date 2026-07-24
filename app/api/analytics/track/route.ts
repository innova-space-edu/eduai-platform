import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveAnalyticsModule } from "@/lib/admin/analytics-catalog"

export const runtime = "nodejs"
export const maxDuration = 15

const EVENT_TYPES = new Set([
  "page_view",
  "action",
  "generation",
  "export",
  "upload",
  "download",
  "error",
])

function safeInteger(value: unknown, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.min(Math.round(parsed), max)
}

function safeCost(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.min(parsed, 1_000_000)
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ tracked: false, reason: "not_authenticated" }, { status: 200 })
    }

    const body = await request.json().catch(() => ({}))
    const path = typeof body.path === "string" ? body.path.slice(0, 500) : ""
    const module = resolveAnalyticsModule(path)

    if (!module) {
      return NextResponse.json({ tracked: false, reason: "unknown_module" }, { status: 200 })
    }

    const eventType = EVENT_TYPES.has(body.eventType) ? body.eventType : "action"
    const metadata = body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
      ? body.metadata
      : {}

    const { error } = await supabase.from("eduai_usage_events").insert({
      user_id: user.id,
      module_key: module.key,
      module_name: module.name,
      module_category: module.category,
      agent_key: module.agentKey || null,
      agent_name: module.agentName || null,
      event_type: eventType,
      path,
      success: body.success !== false,
      latency_ms: safeInteger(body.latencyMs, 3_600_000),
      input_tokens: safeInteger(body.inputTokens, 10_000_000),
      output_tokens: safeInteger(body.outputTokens, 10_000_000),
      estimated_cost: safeCost(body.estimatedCost),
      error_code: typeof body.errorCode === "string" ? body.errorCode.slice(0, 120) : null,
      metadata,
    })

    if (error) {
      const tableMissing = error.code === "42P01" || /eduai_usage_events/i.test(error.message || "")
      return NextResponse.json({
        tracked: false,
        reason: tableMissing ? "analytics_table_missing" : "insert_failed",
      }, { status: 200 })
    }

    return NextResponse.json({ tracked: true })
  } catch {
    return NextResponse.json({ tracked: false, reason: "unexpected_error" }, { status: 200 })
  }
}
