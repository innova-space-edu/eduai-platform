// app/api/admin/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

// Cliente con service_role para operaciones que requieren acceso total
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurada")
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// Verifica que el usuario autenticado es admin
async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, error: "No autenticado" }

  const { data: isAdmin } = await supabase
    .from("admin_emails")
    .select("email")
    .eq("email", user.email)
    .maybeSingle()

  if (!isAdmin) return { user: null, error: "Acceso denegado" }
  return { user, error: null }
}

// ── GET ──────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { user, error } = await requireAdmin()
  if (!user) return NextResponse.json({ error }, { status: error === "No autenticado" ? 401 : 403 })

  const { searchParams } = new URL(request.url)
  const action   = searchParams.get("action")
  const userId   = searchParams.get("userId")
  const admin    = getAdminClient()

  try {
    // ── Listar todos los usuarios ─────────────────────────────────────────
    if (action === "users") {
      const page  = parseInt(searchParams.get("page") || "1")
      const limit = 30
      const from  = (page - 1) * limit
      const search = searchParams.get("search") || ""

      let query = admin
        .from("profiles")
        .select("id, name, email, xp, level, streak_days, created_at, user_code", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, from + limit - 1)

      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
      }

      const { data: profiles, count, error: err } = await query
      if (err) throw err

      return NextResponse.json({ users: profiles || [], total: count || 0, page, limit })
    }

    // ── Detalle de un usuario ─────────────────────────────────────────────
    if (action === "user" && userId) {
      const { data: profile } = await admin
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single()

      const { data: sessions } = await admin
        .from("study_sessions")
        .select("id, topic, status, score, created_at, study_mode")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20)

      const { data: reports } = await admin
        .from("admin_reports")
        .select("id, subject, status, category, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

      const { count: examCount } = await admin
        .from("exam_submissions")
        .select("*", { count: "exact", head: true })
        .eq("student_id", userId)

      return NextResponse.json({ profile, sessions: sessions || [], reports: reports || [], examCount: examCount || 0 })
    }

    // ── Listar todos los reportes ─────────────────────────────────────────
    if (action === "reports") {
      const status  = searchParams.get("status") || ""
      const page    = parseInt(searchParams.get("page") || "1")
      const limit   = 20
      const from    = (page - 1) * limit

      let query = admin
        .from("admin_reports")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, from + limit - 1)

      if (status) query = query.eq("status", status)

      const { data, count } = await query
      return NextResponse.json({ reports: data || [], total: count || 0, page, limit })
    }

    // ── Estadísticas globales ─────────────────────────────────────────────
    if (action === "stats") {
      const { count: totalUsers }   = await admin.from("profiles").select("*", { count: "exact", head: true })
      const { count: totalSessions }= await admin.from("study_sessions").select("*", { count: "exact", head: true })
      const { count: openReports }  = await admin.from("admin_reports").select("*", { count: "exact", head: true }).eq("status", "abierto")
      const { count: totalExams }   = await admin.from("teacher_exams").select("*", { count: "exact", head: true })

      // Usuarios activos últimas 24h
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { count: activeToday }  = await admin.from("study_sessions").select("*", { count: "exact", head: true }).gte("created_at", since)

      return NextResponse.json({ totalUsers, totalSessions, openReports, totalExams, activeToday })
    }

    return NextResponse.json({ error: "Acción inválida" }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── POST ─────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const { user, error } = await requireAdmin()
  if (!user) return NextResponse.json({ error }, { status: error === "No autenticado" ? 401 : 403 })

  const body  = await request.json()
  const { action } = body
  const admin = getAdminClient()

  try {
    // ── Editar perfil de usuario ──────────────────────────────────────────
    if (action === "edit_user") {
      const { userId, name, xp, level, streak_days } = body
      if (!userId) return NextResponse.json({ error: "userId requerido" }, { status: 400 })

      const patch: Record<string, any> = {}
      if (name        !== undefined) patch.name        = String(name).trim()
      if (xp          !== undefined) patch.xp          = Math.max(0, Number(xp))
      if (level       !== undefined) patch.level       = Math.min(6, Math.max(1, Number(level)))
      if (streak_days !== undefined) patch.streak_days = Math.max(0, Number(streak_days))

      const { error: err } = await admin.from("profiles").update(patch).eq("id", userId)
      if (err) throw err
      return NextResponse.json({ success: true })
    }

    // ── Resetear XP de usuario ────────────────────────────────────────────
    if (action === "reset_xp") {
      const { userId } = body
      const { error: err } = await admin
        .from("profiles")
        .update({ xp: 0, level: 1, streak_days: 0 })
        .eq("id", userId)
      if (err) throw err
      return NextResponse.json({ success: true })
    }

    // ── Eliminar todas las sesiones de un usuario ─────────────────────────
    if (action === "clear_sessions") {
      const { userId } = body
      const { error: err } = await admin
        .from("study_sessions")
        .delete()
        .eq("user_id", userId)
      if (err) throw err
      return NextResponse.json({ success: true })
    }

    // ── Responder a un reporte ────────────────────────────────────────────
    if (action === "reply_report") {
      const { reportId, reply, newStatus } = body
      if (!reportId || !reply) return NextResponse.json({ error: "reportId y reply requeridos" }, { status: 400 })

      const patch: Record<string, any> = {
        admin_reply: reply,
        admin_id:    user.id,
        status:      newStatus || "resuelto",
      }
      if (newStatus === "resuelto" || newStatus === "cerrado") {
        patch.resolved_at = new Date().toISOString()
      }

      const { error: err } = await admin.from("admin_reports").update(patch).eq("id", reportId)
      if (err) throw err
      return NextResponse.json({ success: true })
    }

    // ── Cambiar estado de reporte ─────────────────────────────────────────
    if (action === "update_report_status") {
      const { reportId, status: newStatus } = body
      const patch: Record<string, any> = { status: newStatus }
      if (newStatus === "resuelto" || newStatus === "cerrado") patch.resolved_at = new Date().toISOString()
      const { error: err } = await admin.from("admin_reports").update(patch).eq("id", reportId)
      if (err) throw err
      return NextResponse.json({ success: true })
    }

    // ── Agregar / quitar admin ────────────────────────────────────────────
    if (action === "add_admin") {
      const { email } = body
      if (!email) return NextResponse.json({ error: "email requerido" }, { status: 400 })
      await admin.from("admin_emails").upsert({ email }, { onConflict: "email" })
      return NextResponse.json({ success: true })
    }

    if (action === "remove_admin") {
      const { email } = body
      if (!email) return NextResponse.json({ error: "email requerido" }, { status: 400 })
      // Proteger los admins fundadores
      if (["admin@colprovidencia.cl", "emorales@colprovidencia.cl"].includes(email)) {
        return NextResponse.json({ error: "No se pueden remover los admins fundadores" }, { status: 403 })
      }
      await admin.from("admin_emails").delete().eq("email", email)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Acción inválida" }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
