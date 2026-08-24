import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { clearProviderModelCache } from "@/lib/ai/model-registry"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const HEADERS = { "Cache-Control": "no-store, max-age=0" }

type ModelRow = {
  provider: string
  model: string
  label: string | null
  capabilities: string[] | null
  is_enabled: boolean
  is_default: boolean
  priority: number | null
  config: Record<string, unknown> | null
  deprecated_at: string | null
  shutdown_at: string | null
  created_at?: string
  updated_at?: string
}

function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase server credentials no configuradas")
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return null
  const { data } = await supabase.from("admin_emails").select("email").eq("email", user.email).maybeSingle()
  return data ? user : null
}

function clean(value: unknown, max = 160) {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

function overlaps(a: string[] | null | undefined, b: string[] | null | undefined) {
  const right = new Set(b || [])
  return (a || []).some(value => right.has(value))
}

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Acceso denegado" }, { status: 403, headers: HEADERS })

  try {
    const admin = adminClient()
    const { data, error } = await admin
      .from("ai_provider_models")
      .select("provider,model,label,capabilities,is_enabled,is_default,priority,config,deprecated_at,shutdown_at,created_at,updated_at")
      .order("provider", { ascending: true })
      .order("priority", { ascending: true })
      .order("model", { ascending: true })

    if (error) throw error
    return NextResponse.json({ models: data || [] }, { headers: HEADERS })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo leer el registro de modelos" }, { status: 500, headers: HEADERS })
  }
}

export async function PATCH(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Acceso denegado" }, { status: 403, headers: HEADERS })

  const body = await request.json().catch(() => ({}))
  const provider = clean(body?.provider, 60).toLowerCase()
  const model = clean(body?.model, 180)
  const action = clean(body?.action, 40)

  if (!provider || !model || !["enable", "disable", "set_default"].includes(action)) {
    return NextResponse.json({ error: "provider, model y action válidos son requeridos" }, { status: 400, headers: HEADERS })
  }

  try {
    const admin = adminClient()
    const { data: target, error: targetError } = await admin
      .from("ai_provider_models")
      .select("provider,model,label,capabilities,is_enabled,is_default,priority,config,deprecated_at,shutdown_at")
      .eq("provider", provider)
      .eq("model", model)
      .maybeSingle()

    if (targetError) throw targetError
    if (!target) return NextResponse.json({ error: "Modelo no registrado" }, { status: 404, headers: HEADERS })

    const typedTarget = target as ModelRow

    if (action === "disable") {
      if (typedTarget.is_default) {
        return NextResponse.json({ error: "Primero selecciona otro modelo principal antes de desactivar el actual." }, { status: 409, headers: HEADERS })
      }
      const { error } = await admin
        .from("ai_provider_models")
        .update({ is_enabled: false, updated_at: new Date().toISOString() })
        .eq("provider", provider)
        .eq("model", model)
      if (error) throw error
    }

    if (action === "enable") {
      const { error } = await admin
        .from("ai_provider_models")
        .update({ is_enabled: true, updated_at: new Date().toISOString() })
        .eq("provider", provider)
        .eq("model", model)
      if (error) throw error
    }

    if (action === "set_default") {
      const { data: rows, error: rowsError } = await admin
        .from("ai_provider_models")
        .select("provider,model,capabilities,is_default")
        .eq("provider", provider)
      if (rowsError) throw rowsError

      const competing = (rows || []).filter((row: any) =>
        row.model !== model && row.is_default && overlaps(row.capabilities, typedTarget.capabilities)
      )

      for (const row of competing) {
        const { error } = await admin
          .from("ai_provider_models")
          .update({ is_default: false, updated_at: new Date().toISOString() })
          .eq("provider", provider)
          .eq("model", row.model)
        if (error) throw error
      }

      const { error } = await admin
        .from("ai_provider_models")
        .update({ is_enabled: true, is_default: true, updated_at: new Date().toISOString() })
        .eq("provider", provider)
        .eq("model", model)
      if (error) throw error
    }

    clearProviderModelCache(provider as any)

    const { data: updated, error: updatedError } = await admin
      .from("ai_provider_models")
      .select("provider,model,label,capabilities,is_enabled,is_default,priority,config,deprecated_at,shutdown_at")
      .eq("provider", provider)
      .eq("model", model)
      .maybeSingle()
    if (updatedError) throw updatedError

    return NextResponse.json({ success: true, model: updated }, { headers: HEADERS })
  } catch (error) {
    console.error("[AI model registry admin]", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar el modelo" }, { status: 500, headers: HEADERS })
  }
}