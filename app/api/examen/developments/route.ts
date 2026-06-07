import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "exam-development-artifacts";
const MAX_PNG_BYTES = 10 * 1024 * 1024;
const TIMEOUT_MS = 20_000;

type ArtifactPage = {
  id?: string;
  title?: string;
  latex?: string;
  ocrText?: string;
  ocrConfidence?: number | null;
  canvasHeight?: number;
  strokes?: unknown[];
  updatedAt?: string;
};

type SaveDevelopmentBody = {
  examId?: string;
  submissionId?: string | null;
  clientAttemptId?: string;
  questionId?: string;
  questionIndex?: number;
  artifactVersion?: number;
  pages?: ArtifactPage[];
  latex?: string;
  ocrText?: string;
  ocrConfidence?: number | null;
  previewPngDataUrl?: string;
  finalized?: boolean;
  questionText?: string;
  expectedLatex?: string;
  expectedSteps?: string[];
  rubric?: { criteria: string; points: number }[];
  maxPoints?: number;
};

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("Supabase de servidor no está configurado.");
  return createClient(url, key, { auth: { persistSession: false } });
}

function safeSegment(value: unknown, fallback: string) {
  const normalized = String(value || fallback).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 180);
  return normalized || fallback;
}

function decodePngDataUrl(value?: string) {
  if (!value) return null;
  const match = value.match(/^data:image\/png;base64,(.+)$/);
  if (!match) return null;
  const bytes = Buffer.from(match[1], "base64");
  if (bytes.byteLength > MAX_PNG_BYTES) throw new Error("La vista previa PNG supera el límite permitido.");
  return bytes;
}

function evaluatorUrl() {
  return String(process.env.EXAM_LATEX_EVALUATOR_URL || "").replace(/\/$/, "");
}

async function evaluateLatex(body: SaveDevelopmentBody, latex: string, pages: ArtifactPage[]) {
  const endpoint = evaluatorUrl();
  if (!endpoint || !String(body.expectedLatex || "").trim() || !latex.trim()) {
    return { status: "saved_no_engine", result: null } as const;
  }

  try {
    const response = await fetch(`${endpoint}/evaluate-question`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.EXAM_LATEX_EVALUATOR_TOKEN
          ? { "x-evaluator-token": process.env.EXAM_LATEX_EVALUATOR_TOKEN }
          : {}),
      },
      body: JSON.stringify({
        question_id: String(body.questionId || body.questionIndex || "question"),
        question_text: String(body.questionText || ""),
        expected_latex: String(body.expectedLatex || ""),
        student_latex: latex,
        expected_steps: Array.isArray(body.expectedSteps) ? body.expectedSteps : [],
        pages: pages.map((page, index) => ({
          page_id: String(page.id || `page-${index + 1}`),
          latex: String(page.latex || ""),
          ocr_confidence: typeof page.ocrConfidence === "number" ? page.ocrConfidence : null,
        })),
        rubric: Array.isArray(body.rubric) ? body.rubric : [],
        max_points: typeof body.maxPoints === "number" ? body.maxPoints : 1,
        metadata: { inputPolicy: "latex_only" },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { status: "failed", result: { error: result?.detail || result?.error || "El evaluador respondió con error." } } as const;
    }
    return { status: "completed", result } as const;
  } catch (error) {
    return {
      status: "failed",
      result: { error: error instanceof Error ? error.message : "No fue posible consultar el evaluador LaTeX." },
    } as const;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SaveDevelopmentBody;
    const examId = String(body.examId || "").trim();
    const clientAttemptId = String(body.clientAttemptId || "").trim();
    const questionIndex = Number(body.questionIndex);
    const questionId = String(body.questionId || `question-${questionIndex + 1}`).trim();
    const pages = Array.isArray(body.pages) ? body.pages : [];
    const latex = String(body.latex || "").slice(0, 60_000);
    const ocrText = String(body.ocrText || "").slice(0, 60_000);
    const artifactVersion = Math.max(1, Number(body.artifactVersion || 1));

    if (!examId || !clientAttemptId || !Number.isInteger(questionIndex) || questionIndex < 0) {
      return NextResponse.json({ error: "Faltan identificadores válidos del examen o la pregunta." }, { status: 400 });
    }

    const supabase = getAdminClient();
    const basePath = `${safeSegment(examId, "exam")}/${safeSegment(clientAttemptId, "attempt")}/${questionIndex}`;
    const jsonPath = `${basePath}/artifact.json`;
    const pngPath = `${basePath}/preview.png`;
    const jsonPayload = {
      inputPolicy: "latex_only",
      examId,
      clientAttemptId,
      questionId,
      questionIndex,
      artifactVersion,
      latex,
      ocrText,
      ocrConfidence: typeof body.ocrConfidence === "number" ? body.ocrConfidence : null,
      pages,
      finalized: body.finalized === true,
      updatedAt: new Date().toISOString(),
    };

    const jsonBytes = Buffer.from(JSON.stringify(jsonPayload, null, 2), "utf8");
    const { error: jsonError } = await supabase.storage.from(BUCKET).upload(jsonPath, jsonBytes, {
      contentType: "application/json",
      upsert: true,
    });
    if (jsonError) throw jsonError;

    let savedPngPath: string | null = null;
    const pngBytes = decodePngDataUrl(body.previewPngDataUrl);
    if (pngBytes) {
      const { error: pngError } = await supabase.storage.from(BUCKET).upload(pngPath, pngBytes, {
        contentType: "image/png",
        upsert: true,
      });
      if (pngError) throw pngError;
      savedPngPath = pngPath;
    }

    const evaluation = await evaluateLatex(body, latex, pages);
    const row = {
      exam_id: examId,
      submission_id: body.submissionId || null,
      client_attempt_id: clientAttemptId,
      question_id: questionId,
      question_index: questionIndex,
      artifact_version: artifactVersion,
      latex_source: latex,
      normalized_latex: typeof evaluation.result?.normalized_student_latex === "string"
        ? evaluation.result.normalized_student_latex
        : latex,
      rendered_text: ocrText,
      ocr_confidence: typeof body.ocrConfidence === "number" ? body.ocrConfidence : null,
      pages,
      strokes_path: jsonPath,
      preview_png_path: savedPngPath,
      ocr_json_path: jsonPath,
      evaluator_status: evaluation.status,
      evaluator_result: evaluation.result || {},
      finalized_at: body.finalized === true ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const { data: existing, error: readError } = await supabase
      .from("exam_question_developments")
      .select("id")
      .eq("exam_id", examId)
      .eq("client_attempt_id", clientAttemptId)
      .eq("question_index", questionIndex)
      .maybeSingle();
    if (readError) throw readError;

    const query = existing?.id
      ? supabase.from("exam_question_developments").update(row).eq("id", existing.id)
      : supabase.from("exam_question_developments").insert(row);
    const { data, error } = await query.select().single();
    if (error) throw error;

    return NextResponse.json({ success: true, artifact: data, evaluation: evaluation.result });
  } catch (error) {
    console.error("[exam/developments]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No fue posible guardar el desarrollo." },
      { status: 500 },
    );
  }
}
