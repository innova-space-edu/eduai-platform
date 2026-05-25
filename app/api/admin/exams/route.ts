// app/api/admin/exams/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL no configurada")
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurada")
  return createAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

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

export async function GET(request: NextRequest) {
  const { user, error } = await requireAdmin()
  if (!user) {
    return NextResponse.json({ success: false, error }, { status: error === "No autenticado" ? 401 : 403 })
  }

  const admin = getAdminClient()
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get("page") || 1))
  const limit = Math.min(50, Math.max(10, Number(searchParams.get("limit") || 20)))
  const from = (page - 1) * limit
  const search = (searchParams.get("search") || "").trim()
  const status = (searchParams.get("status") || "").trim()

  let query = admin
    .from("teacher_exams")
    .select("id, code, title, topic, status, teacher_id, settings, created_at, updated_at, deleted_at, closed_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1)

  if (search) {
    query = query.or(`title.ilike.%${search}%,topic.ilike.%${search}%,code.ilike.%${search}%`)
  }

  if (status && status !== "deleted") {
    query = query.eq("status", status)
  }

  if (status === "deleted") {
    query = query.not("deleted_at", "is", null)
  }

  const { data: exams, count, error: examsError } = await query
  if (examsError) {
    return NextResponse.json({ success: false, error: examsError.message }, { status: 500 })
  }

  const examIds = (exams || []).map((exam) => exam.id)
  const teacherIds = Array.from(new Set((exams || []).map((exam) => exam.teacher_id).filter(Boolean)))

  const [{ data: submissions }, { data: sessions }, { data: teachers }] = await Promise.all([
    examIds.length
      ? admin.from("exam_submissions").select("id, exam_id, score, grade, submitted_at").in("exam_id", examIds)
      : Promise.resolve({ data: [] as any[] }),
    examIds.length
      ? admin.from("exam_security_sessions").select("id, exam_id, status, risk_level, warning_count, freeze_count, block_count, updated_at").in("exam_id", examIds)
      : Promise.resolve({ data: [] as any[] }),
    teacherIds.length
      ? admin.from("profiles").select("id, name, email").in("id", teacherIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const teacherMap = new Map((teachers || []).map((teacher: any) => [teacher.id, teacher]))

  const enriched = (exams || []).map((exam: any) => {
    const examSubmissions = (submissions || []).filter((submission: any) => submission.exam_id === exam.id)
    const examSessions = (sessions || []).filter((session: any) => session.exam_id === exam.id)
    const blockedCount = examSessions.filter((session: any) => session.status === "blocked").length
    const frozenCount = examSessions.filter((session: any) => session.status === "frozen").length
    const incidentCount = examSessions.reduce((acc: number, session: any) => {
      return acc + Number(session.warning_count || 0) + Number(session.freeze_count || 0) + Number(session.block_count || 0)
    }, 0)

    return {
      ...exam,
      teacher: teacherMap.get(exam.teacher_id) || null,
      submissionCount: examSubmissions.length,
      securitySessionCount: examSessions.length,
      blockedCount,
      frozenCount,
      incidentCount,
    }
  })

  return NextResponse.json({ success: true, exams: enriched, total: count || 0, page, limit })
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireAdmin()
  if (!user) {
    return NextResponse.json({ success: false, error }, { status: error === "No autenticado" ? 401 : 403 })
  }

  const body = await request.json()
  const { action, examId } = body
  if (!examId) return NextResponse.json({ success: false, error: "examId requerido" }, { status: 400 })

  const admin = getAdminClient()
  const patch: Record<string, any> = {}

  if (action === "close") {
    patch.status = "closed"
    patch.closed_at = new Date().toISOString()
  } else if (action === "reopen") {
    patch.status = "active"
    patch.closed_at = null
    patch.deleted_at = null
  } else if (action === "soft_delete") {
    patch.deleted_at = new Date().toISOString()
  } else if (action === "restore") {
    patch.deleted_at = null
  } else {
    return NextResponse.json({ success: false, error: "Acción inválida" }, { status: 400 })
  }

  const { error: updateError } = await admin
    .from("teacher_exams")
    .update(patch)
    .eq("id", examId)

  if (updateError) {
    return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
