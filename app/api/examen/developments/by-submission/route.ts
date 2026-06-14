import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const BUCKET = "exam-development-artifacts"
const SIGNED_URL_TTL_SECONDS = 60 * 15

type DevelopmentRow = {
  id: string
  exam_id: string
  submission_id: string | null
  client_attempt_id: string
  question_id: string
  question_index: number
  artifact_version: number | null
  latex_source: string | null
  normalized_latex: string | null
  rendered_text: string | null
  ocr_confidence: number | null
  pages: unknown
  strokes_path: string | null
  preview_png_path: string | null
  ocr_json_path: string | null
  evaluator_status: string | null
  evaluator_result: unknown
  finalized_at: string | null
  updated_at: string | null
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ""
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  if (!url || !key) throw new Error("Supabase de servidor no está configurado.")
  return createClient(url, key, { auth: { persistSession: false } })
}

async function createSignedUrl(supabase: ReturnType<typeof getAdminClient>, path?: string | null) {
  if (!path) return null
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

  if (error) {
    console.error("[exam/developments/by-submission/signed-url]", error)
    return null
  }

  return data?.signedUrl || null
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const submissionId = String(searchParams.get("submissionId") || "").trim()
    const examIdParam = String(searchParams.get("examId") || "").trim()

    if (!submissionId) {
      return NextResponse.json({ error: "submissionId requerido", developments: [] }, { status: 400 })
    }

    const supabase = getAdminClient()

    const { data: submission, error: submissionError } = await supabase
      .from("exam_submissions")
      .select("id, exam_id, student_name, student_course")
      .eq("id", submissionId)
      .maybeSingle()

    if (submissionError || !submission) {
      return NextResponse.json({ error: "Entrega no encontrada", developments: [] }, { status: 404 })
    }

    const examId = examIdParam || String(submission.exam_id || "")
    if (!examId || examId !== String(submission.exam_id || "")) {
      return NextResponse.json({ error: "El examId no coincide con la entrega", developments: [] }, { status: 403 })
    }

    const { data: rows, error } = await supabase
      .from("exam_question_developments")
      .select(
        "id, exam_id, submission_id, client_attempt_id, question_id, question_index, artifact_version, latex_source, normalized_latex, rendered_text, ocr_confidence, pages, strokes_path, preview_png_path, ocr_json_path, evaluator_status, evaluator_result, finalized_at, updated_at",
      )
      .eq("exam_id", examId)
      .eq("submission_id", submissionId)
      .order("question_index", { ascending: true })

    if (error) throw error

    const developments = await Promise.all(
      ((rows || []) as DevelopmentRow[]).map(async (row) => ({
        id: row.id,
        examId: row.exam_id,
        submissionId: row.submission_id,
        clientAttemptId: row.client_attempt_id,
        questionId: row.question_id,
        questionIndex: row.question_index,
        artifactVersion: row.artifact_version,
        latexSource: row.latex_source || "",
        normalizedLatex: row.normalized_latex || "",
        renderedText: row.rendered_text || "",
        ocrConfidence: row.ocr_confidence,
        pages: Array.isArray(row.pages) ? row.pages : [],
        strokesPath: row.strokes_path,
        previewPngPath: row.preview_png_path,
        ocrJsonPath: row.ocr_json_path,
        previewPngUrl: await createSignedUrl(supabase, row.preview_png_path),
        artifactJsonUrl: await createSignedUrl(supabase, row.ocr_json_path || row.strokes_path),
        evaluatorStatus: row.evaluator_status,
        evaluatorResult: row.evaluator_result || null,
        finalizedAt: row.finalized_at,
        updatedAt: row.updated_at,
      })),
    )

    return NextResponse.json({ success: true, developments })
  } catch (error) {
    console.error("[exam/developments/by-submission]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No fue posible cargar los lienzos del estudiante.", developments: [] },
      { status: 500 },
    )
  }
}
