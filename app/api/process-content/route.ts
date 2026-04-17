// src/app/api/process-content/route.ts
import { NextRequest, NextResponse } from "next/server"
import { processContent, type SourceType, type OutputFormat } from "@/lib/content-processor"

export const maxDuration = 60

const VALID_SOURCES: SourceType[] = ["url", "text", "topic", "pdf", "docx"]

const VALID_FORMATS: OutputFormat[] = [
  "infographic",
  "ppt",
  "poster",
  "podcast",
  "mindmap",
  "flashcards",
  "quiz",
  "timeline",
  "cornell",
  "glossary",
  "story",
  "song",
  "lessonplan",
]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sourceType, content, fileName, outputFormat } = body

    // ─────────────────────────────────────────────
    // Validación de campos obligatorios
    // ─────────────────────────────────────────────
    if (!sourceType || !content || !outputFormat) {
      return NextResponse.json(
        {
          success: false,
          error: "Faltan campos: sourceType, content, outputFormat",
        },
        { status: 400 }
      )
    }

    // ─────────────────────────────────────────────
    // Validación de sourceType
    // ─────────────────────────────────────────────
    if (!VALID_SOURCES.includes(sourceType)) {
      return NextResponse.json(
        {
          success: false,
          error: `sourceType inválido. Válidos: ${VALID_SOURCES.join(", ")}`,
        },
        { status: 400 }
      )
    }

    // ─────────────────────────────────────────────
    // Validación de outputFormat
    // ─────────────────────────────────────────────
    if (!VALID_FORMATS.includes(outputFormat)) {
      return NextResponse.json(
        {
          success: false,
          error: `outputFormat inválido. Válidos: ${VALID_FORMATS.join(", ")}`,
        },
        { status: 400 }
      )
    }

    // ─────────────────────────────────────────────
    // Validación de URL
    // ─────────────────────────────────────────────
    if (sourceType === "url") {
      try {
        new URL(content)
      } catch {
        return NextResponse.json(
          { success: false, error: "URL inválida" },
          { status: 400 }
        )
      }
    }

    // ─────────────────────────────────────────────
    // Validación API Key
    // ─────────────────────────────────────────────
    const geminiKey = process.env.GEMINI_API_KEY
    if (!geminiKey) {
      return NextResponse.json(
        { success: false, error: "GEMINI_API_KEY no configurada" },
        { status: 500 }
      )
    }

    // ─────────────────────────────────────────────
    // Procesamiento principal
    // ─────────────────────────────────────────────
    const result = await processContent({
      sourceType,
      content,
      fileName,
      outputFormat,
      geminiKey,
    })

    if (!result.success) {
      return NextResponse.json(result, { status: 422 })
    }

    return NextResponse.json(result)
  } catch (err: any) {
    console.error("Error en /api/process-content:", err)

    return NextResponse.json(
      {
        success: false,
        error: `Error interno: ${err.message}`,
      },
      { status: 500 }
    )
  }
}
