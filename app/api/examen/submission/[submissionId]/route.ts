import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!url || !key) {
    throw new Error("Faltan credenciales de Supabase para eliminación segura")
  }

  return createAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ submissionId: string }> | { submissionId: string } }
) {
  try {
    const resolvedParams =
      "then" in context.params ? await context.params : context.params

    const submissionId = resolvedParams?.submissionId

    if (!submissionId) {
      return NextResponse.json(
        { success: false, error: "Falta submissionId" },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      )
    }

    const { data: submission, error: submissionError } = await supabase
      .from("exam_submissions")
      .select("id, exam_id, student_name")
      .eq("id", submissionId)
      .maybeSingle()

    if (submissionError) {
      return NextResponse.json(
        { success: false, error: submissionError.message },
        { status: 500 }
      )
    }

    if (!submission) {
      return NextResponse.json(
        { success: false, error: "Registro no encontrado" },
        { status: 404 }
      )
    }

    const { data: exam, error: examError } = await supabase
      .from("teacher_exams")
      .select("id, teacher_id, status")
      .eq("id", submission.exam_id)
      .maybeSingle()

    if (examError) {
      return NextResponse.json(
        { success: false, error: examError.message },
        { status: 500 }
      )
    }

    if (!exam) {
      return NextResponse.json(
        { success: false, error: "Examen no encontrado" },
        { status: 404 }
      )
    }

    if (exam.teacher_id !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error: "No tienes permisos para eliminar este registro",
        },
        { status: 403 }
      )
    }

    const admin = getAdmin()

    const { error: incidentsError } = await admin
      .from("exam_incidents")
      .delete()
      .eq("submission_id", submissionId)

    if (incidentsError) {
      return NextResponse.json(
        { success: false, error: incidentsError.message },
        { status: 500 }
      )
    }

    const { error: deleteSubmissionError } = await admin
      .from("exam_submissions")
      .delete()
      .eq("id", submissionId)

    if (deleteSubmissionError) {
      return NextResponse.json(
        { success: false, error: deleteSubmissionError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      deletedId: submissionId,
      studentName: submission.student_name || null,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Error interno al eliminar el registro",
      },
      { status: 500 }
    )
  }
}
