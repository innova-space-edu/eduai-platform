import { NextRequest, NextResponse } from "next/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase administrativo no configurado")
  return createAdminClient(url, key, { auth: { persistSession: false } })
}

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return null

  const admin = adminClient()
  const { data } = await admin
    .from("admin_emails")
    .select("email")
    .eq("email", user.email)
    .maybeSingle()

  return data ? user : null
}

function normalizeRut(value: unknown) {
  return String(value || "").toUpperCase().replace(/[^0-9K]/g, "")
}

function formatRut(value: unknown) {
  const clean = normalizeRut(value)
  if (clean.length < 2) return clean
  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)
  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${dv}`
}

function validRutLike(value: unknown) {
  const clean = normalizeRut(value)
  if (!/^[0-9]{6,9}[0-9K]$/.test(clean)) return false
  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)
  let factor = 2
  let sum = 0
  for (let i = body.length - 1; i >= 0; i -= 1) {
    sum += Number(body[i]) * factor
    factor = factor === 7 ? 2 : factor + 1
  }
  const result = 11 - (sum % 11)
  const expected = result === 11 ? "0" : result === 10 ? "K" : String(result)
  return dv === expected
}

function normalizeName(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim()
}

function normalizeSearch(value: unknown) {
  return normalizeName(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
}

export async function GET(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Acceso administrativo requerido" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const schoolYear = searchParams.get("schoolYear") || "2026"
  const course = (searchParams.get("course") || "").trim()
  const search = (searchParams.get("search") || "").trim()
  const status = searchParams.get("status") || "active"
  const page = Math.max(1, Number(searchParams.get("page") || 1))
  const limit = 100
  const from = (page - 1) * limit

  let query = adminClient()
    .from("student_roster")
    .select("id,school_year,course,student_name,rut,active,source,updated_at", { count: "exact" })
    .eq("school_year", schoolYear)
    .order("course")
    .order("student_name")
    .range(from, from + limit - 1)

  if (course) query = query.eq("course", course)
  if (status === "active") query = query.eq("active", true)
  if (status === "inactive") query = query.eq("active", false)
  if (search) {
    const rut = normalizeRut(search)
    const safeSearch = search.replace(/[,%()]/g, " ").trim()
    const filters = [`student_name.ilike.%${safeSearch}%`]
    if (rut) filters.push(`rut_clean.ilike.%${rut}%`)
    query = query.or(filters.join(","))
  }

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: courseRows } = await adminClient()
    .from("student_roster")
    .select("course")
    .eq("school_year", schoolYear)

  const courses = Array.from(new Set((courseRows || []).map((row: any) => row.course))).sort()
  return NextResponse.json({ students: data || [], total: count || 0, page, limit, courses })
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Acceso administrativo requerido" }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const action = String(body.action || "")
  const admin = adminClient()

  if (action === "set_active") {
    const id = String(body.id || "")
    if (!id) return NextResponse.json({ error: "Alumno requerido" }, { status: 400 })
    const { error } = await admin
      .from("student_roster")
      .update({ active: body.active === true })
      .eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (action === "upsert") {
    const id = body.id ? String(body.id) : null
    const schoolYear = String(body.schoolYear || "2026").trim()
    const course = String(body.course || "").trim()
    const studentName = normalizeName(body.studentName)
    const rutClean = normalizeRut(body.rut)

    if (!course || !studentName || !rutClean) {
      return NextResponse.json({ error: "Nombre, RUT/IPE y curso son requeridos" }, { status: 400 })
    }
    if (!validRutLike(rutClean)) {
      return NextResponse.json({ error: "RUT/IPE inválido" }, { status: 400 })
    }

    const row = {
      school_year: schoolYear,
      course,
      student_name: studentName,
      student_name_normalized: normalizeSearch(studentName),
      rut: formatRut(rutClean),
      rut_clean: rutClean,
      active: body.active !== false,
      source: id ? "admin_edit" : "admin_manual",
      created_by: user.id,
    }

    if (id) {
      const { data, error } = await admin
        .from("student_roster")
        .update({
          course: row.course,
          student_name: row.student_name,
          student_name_normalized: row.student_name_normalized,
          rut: row.rut,
          rut_clean: row.rut_clean,
          active: row.active,
          source: row.source,
        })
        .eq("id", id)
        .select("id")
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, id: data.id })
    }

    const { data, error } = await admin
      .from("student_roster")
      .upsert(row, { onConflict: "school_year,course,rut_clean" })
      .select("id")
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, id: data.id })
  }

  return NextResponse.json({ error: "Acción inválida" }, { status: 400 })
}
