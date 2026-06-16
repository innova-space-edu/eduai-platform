import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  { auth: { persistSession: false } }
)

function normalizeMinutes(value: unknown) {
  const minutes = Number(value)
  if (!Number.isFinite(minutes)) return null
  const rounded = Math.round(minutes)
  if (rounded < 5 || rounded > 240) return null
  return rounded
}

function normalizeSettings(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const examId = String(body?.examId || "").trim()
    const teacherId = String(body?.teacherId || "").trim()
    const nextTimeLimit = normalizeMinutes(body?.timeLimit)

    if (!examId || !teacherId || !nextTimeLimit) {
      return NextResponse.json(
        { error: "examId, teacherId y timeLimit válido son requeridos" },
        { status: 400 }
      )
    }

    const { data: exam, error: examError } = await supabase
      .from("teacher_exams")
      .select("id, teacher_id, settings")
      .eq("id", examId)
      .maybeSingle()

    if (examError) throw examError
    if (!exam) {
      return NextResponse.json({ error: "Examen no encontrado" }, { status: 404 })
    }

    if (String(exam.teacher_id || "") !== teacherId) {
      return NextResponse.json(
        { error: "No tienes permisos para editar este examen" },
        { status: 403 }
      )
    }

    const currentSettings = normalizeSettings(exam.settings)
    const currentTimeLimit = normalizeMinutes(currentSettings.timeLimit) || 30

    const { count: activeDraftsCount, error: draftsError } = await supabase
      .from("exam_attempt_drafts")
      .select("id", { count: "exact", head: true })
      .eq("exam_id", examId)
      .eq("status", "in_progress")

    if (draftsError) throw draftsError

    if (nextTimeLimit < currentTimeLimit && Number(activeDraftsCount || 0) > 0) {
      return NextResponse.json(
        {
          error:
            "No se puede bajar el tiempo mientras hay intentos activos. Esto evita recortar el tiempo guardado de estudiantes que ya comenzaron.",
          activeDraftsCount: activeDraftsCount || 0,
        },
        { status: 409 }
      )
    }

    const updatedAt = new Date().toISOString()
    const nextSettings = {
      ...currentSettings,
      timeLimit: nextTimeLimit,
      timeLimitAppliesTo: "new_attempts",
      timeLimitUpdatedAt: updatedAt,
    }

    const { data: updated, error: updateError } = await supabase
      .from("teacher_exams")
      .update({
        settings: nextSettings,
        updated_at: updatedAt,
      })
      .eq("id", examId)
      .eq("teacher_id", teacherId)
      .select("id, settings, updated_at")
      .single()

    if (updateError) throw updateError

    return NextResponse.json({
      success: true,
      exam: updated,
      timeLimit: nextTimeLimit,
      appliesTo: "new_attempts",
      activeDraftsCount: activeDraftsCount || 0,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "No se pudo actualizar el tiempo del examen" },
      { status: 500 }
    )
  }
}
