// app/api/exam-security/event/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurada")
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// Severidad por tipo de evento
const SEVERITY: Record<string, "low" | "medium" | "high"> = {
  fullscreen_exit:       "medium",
  window_blur:           "low",
  tab_hidden:            "high",
  copy_attempt:          "high",
  paste_attempt:         "high",
  cut_attempt:           "high",
  contextmenu_attempt:   "medium",
  blocked_shortcut:      "medium",
  print_attempt:         "high",
  reload_attempt:        "high",
  drag_attempt:          "low",
}

// Nivel de riesgo según conteo total de incidentes
function incidentLevel(count: number): "clean" | "low" | "medium" | "high" {
  if (count === 0) return "clean"
  if (count <= 2)  return "low"
  if (count <= 4)  return "medium"
  return "high"
}

export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const {
    examId, attemptId, submissionId,
    studentName = "", studentCourse = "", studentRut,
    eventType, eventDetail = "",
    questionIndex, clientTimeLeft, incidentNumber,
    visibilityState, isFullscreen,
    windowWidth, windowHeight,
  } = body

  if (!examId || !eventType) {
    return NextResponse.json({ error: "examId y eventType son requeridos" }, { status: 400 })
  }

  const severity = SEVERITY[eventType] || "medium"

  try {
    const admin = getAdmin()

    // Guardar el incidente
    await admin.from("exam_incidents").insert({
      exam_id:          examId,
      submission_id:    submissionId || null,
      student_name:     studentName,
      student_course:   studentCourse,
      student_rut:      studentRut || null,
      event_type:       eventType,
      event_detail:     eventDetail,
      severity,
      question_index:   questionIndex ?? null,
      client_time_left: clientTimeLeft ?? null,
      incident_number:  incidentNumber || 1,
      visibility_state: visibilityState || null,
      is_fullscreen:    isFullscreen ?? false,
      window_width:     windowWidth || null,
      window_height:    windowHeight || null,
      user_agent:       req.headers.get("user-agent") || null,
    })

    // Si tenemos submissionId, actualizar el resumen en exam_submissions
    if (submissionId) {
      const { data: sub } = await admin
        .from("exam_submissions")
        .select("incident_count")
        .eq("id", submissionId)
        .maybeSingle()

      const newCount = (sub?.incident_count || 0) + 1
      const level    = incidentLevel(newCount)

      await admin.from("exam_submissions").update({
        incident_count:   newCount,
        incident_level:   level,
        security_flagged: newCount >= 5,
      }).eq("id", submissionId)
    }

    return NextResponse.json({ success: true, severity })
  } catch (err: any) {
    // No bloquear el examen por fallo del tracking
    console.error("[exam-security]", err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

// GET — obtener incidentes de un examen (para el panel docente)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const examId       = searchParams.get("examId")
  const submissionId = searchParams.get("submissionId")

  if (!examId) return NextResponse.json({ error: "examId requerido" }, { status: 400 })

  try {
    const admin = getAdmin()

    if (submissionId) {
      // Detalle de incidentes de un alumno específico
      const { data } = await admin
        .from("exam_incidents")
        .select("id, event_type, event_detail, severity, question_index, client_time_left, incident_number, created_at, is_fullscreen")
        .eq("exam_id", examId)
        .eq("submission_id", submissionId)
        .order("created_at", { ascending: true })

      return NextResponse.json({ incidents: data || [] })
    }

    // Resumen por submission (cuántos incidentes tiene cada alumno)
    const { data } = await admin
      .from("exam_incidents")
      .select("submission_id, student_name, event_type, severity, created_at")
      .eq("exam_id", examId)
      .order("created_at", { ascending: true })

    // Agrupar por submission_id
    const summary: Record<string, any> = {}
    for (const inc of (data || [])) {
      const key = inc.submission_id || "unknown"
      if (!summary[key]) {
        summary[key] = {
          submission_id:  key,
          student_name:   inc.student_name,
          total:          0,
          high:           0,
          medium:         0,
          low:            0,
          last_incident:  inc.created_at,
        }
      }
      summary[key].total++
      summary[key][inc.severity]++
      summary[key].last_incident = inc.created_at
    }

    return NextResponse.json({ summary: Object.values(summary) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
