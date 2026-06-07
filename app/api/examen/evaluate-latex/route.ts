import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 20_000;

function evaluatorUrl() {
  return String(process.env.EXAM_LATEX_EVALUATOR_URL || "").replace(/\/$/, "");
}

export async function POST(request: NextRequest) {
  try {
    const endpoint = evaluatorUrl();
    if (!endpoint) {
      return NextResponse.json(
        {
          error: "EXAM_LATEX_EVALUATOR_URL no está configurada.",
          setupRequired: true,
        },
        { status: 503 },
      );
    }

    const body = await request.json();
    const response = await fetch(`${endpoint}/evaluate-question`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.EXAM_LATEX_EVALUATOR_TOKEN
          ? { "x-evaluator-token": process.env.EXAM_LATEX_EVALUATOR_TOKEN }
          : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { error: data?.detail || data?.error || "El motor LaTeX no pudo evaluar la respuesta." },
        { status: response.status },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[exam/evaluate-latex]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No fue posible consultar el motor LaTeX." },
      { status: 500 },
    );
  }
}
