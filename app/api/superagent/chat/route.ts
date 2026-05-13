// app/api/superagent/chat/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Endpoint de chat para EduAI SuperAgent
// Usa ai-router-v5 con todos los proveedores gratuitos 2026
// Soporta: streaming (Groq), non-streaming (todos), selección de tarea
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest } from "next/server"
import { callAIv5, getAvailableProviders, getModelForTask } from "@/lib/ai-router-v5"
import type { Message, AITaskType } from "@/lib/ai-router-v5"
import { runCoreCycle } from "@/lib/superagent/superagent-core"
import type { CoreContext } from "@/lib/superagent/superagent-core"

export const runtime = "nodejs"
export const maxDuration = 60

// Sistema de contexto educativo para el superagente
const EDUAI_SYSTEM_PROMPT = `Eres EduAI Claw, el asistente inteligente de EduAI Platform — una plataforma educativa chilena para el Colegio Providencia.

Puedes ayudar con:
• 📝 Crear y mejorar evaluaciones (exámenes, rúbricas, preguntas)
• 📚 Planificación curricular según el currículum nacional MINEDUC
• 🧠 Tutorías y explicaciones pedagógicas
• ♿ Adaptaciones PIE/NEE (dislexia, TDAH, baja visión)
• 🔬 Contenido STEM (Física, Química, Biología, Matemática)
• 📊 Análisis de resultados de evaluaciones
• 🎨 Diseño de materiales educativos visuales

Responde siempre en español. Sé concreto, práctico y alineado al contexto chileno.
Cuando generes preguntas de examen, usa el formato JSON estructurado que EduAI entiende.
Para matemática, usa LaTeX con $...$ para inline y $$...$$ para bloques.`

// Detectar tipo de tarea desde el mensaje para optimizar routing
function detectTaskType(message: string): AITaskType {
  const text = message.toLowerCase()

  if (
    text.includes("código") || text.includes("code") ||
    text.includes("componente") || text.includes("react") ||
    text.includes("typescript") || text.includes("bug") ||
    text.includes("función") || text.includes("api")
  ) return "coding"

  if (
    text.includes("analiza") || text.includes("explica por qué") ||
    text.includes("razona") || text.includes("demuestra") ||
    text.includes("deduce") || text.includes("compara")
  ) return "reasoning"

  if (
    text.includes("imagen") || text.includes("foto") ||
    text.includes("diagrama") || text.includes("gráfico") ||
    text.includes("visual")
  ) return "vision"

  if (message.length > 3000) return "long_context"

  return "general"
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const {
      messages,
      task: explicitTask,
      maxTokens = 2000,
      systemPrompt,
      stream: wantStream = false,
      context,
    } = body as {
      messages: Message[]
      task?: AITaskType
      maxTokens?: number
      systemPrompt?: string
      stream?: boolean
      context?: {
        page?: string
        subject?: string
        examTitle?: string
        studentCourse?: string
      }
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json(
        { success: false, error: "messages es requerido y debe ser un array." },
        { status: 400 }
      )
    }

    // Determinar tipo de tarea
    const lastUserMessage = [...messages].reverse().find(m => m.role === "user")?.content ?? ""
    const task: AITaskType = explicitTask ?? detectTaskType(lastUserMessage)

    // Construir system prompt contextualizado
    let sysPrompt = systemPrompt ?? EDUAI_SYSTEM_PROMPT
    if (context?.subject) sysPrompt += `\nAsignatura actual: ${context.subject}`
    if (context?.page)    sysPrompt += `\nPágina actual: ${context.page}`
    if (context?.examTitle) sysPrompt += `\nExamen en edición: "${context.examTitle}"`
    if (context?.studentCourse) sysPrompt += `\nCurso: ${context.studentCourse}`

    // ── Streaming (solo Groq, el más rápido) ──────────────────────────────
    if (wantStream) {
      const encoder = new TextEncoder()

      const readable = new ReadableStream({
        async start(controller) {
          try {
            const Groq = (await import("groq-sdk")).default
            const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

            const model =
              task === "coding" ? "moonshotai/kimi-k2" : "llama-3.3-70b-versatile"

            const msgs: Message[] = [
              { role: "system", content: sysPrompt },
              ...messages,
            ]

            const stream = await groq.chat.completions.create({
              model,
              messages: msgs as Parameters<typeof groq.chat.completions.create>[0]["messages"],
              max_tokens: maxTokens,
              temperature: 0.7,
              stream: true,
            })

            let full = ""
            for await (const chunk of stream) {
              const delta = chunk.choices[0]?.delta?.content ?? ""
              if (delta) {
                full += delta
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ delta, done: false })}\n\n`)
                )
              }
            }

            // Evento final con metadata
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  done: true,
                  full,
                  provider: "Groq",
                  model,
                  task,
                })}\n\n`
              )
            )
            controller.close()
          } catch (streamErr) {
            // Fallback: non-stream con Gemini
            console.warn("[superagent/chat] Groq stream falló, usando Gemini:", streamErr)
            try {
              const res = await callAIv5(messages, {
                task,
                maxTokens,
                systemPrompt: sysPrompt,
              })
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    done: true,
                    full: res.text,
                    provider: res.provider,
                    model: res.model,
                    task,
                  })}\n\n`
                )
              )
              controller.close()
            } catch (fallbackErr) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    error: fallbackErr instanceof Error ? fallbackErr.message : "Error desconocido",
                  })}\n\n`
                )
              )
              controller.close()
            }
          }
        },
      })

      return new Response(readable, {
        headers: {
          "Content-Type":  "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection":    "keep-alive",
        },
      })
    }

    // ── Non-streaming: usar superagent-core con tool detection ────────────────
    const coreContext: CoreContext = {
      currentPage:   context?.page,
      subject:       context?.subject,
      examTitle:     context?.examTitle,
      studentCourse: context?.studentCourse,
    }

    const baseUrl = req.nextUrl.origin

    const result = await runCoreCycle(messages, coreContext, baseUrl)

    return Response.json(
      {
        success:     true,
        text:        result.text,
        provider:    result.provider,
        model:       result.model,
        task:        result.task,
        latencyMs:   result.latencyMs,
        wasToolCall: result.wasToolCall,
        toolUsed:    result.toolUsed,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("[superagent/chat:POST]", error)
    return Response.json(
      {
        success: false,
        error:   error instanceof Error ? error.message : "Error interno del servidor.",
      },
      { status: 500 }
    )
  }
}

// ── GET: estado de proveedores ────────────────────────────────────────────────
export async function GET() {
  const providers = getAvailableProviders()

  return Response.json({
    success: true,
    providers,
    taskRouting: {
      fast:         getModelForTask("fast"),
      coding:       getModelForTask("coding"),
      reasoning:    getModelForTask("reasoning"),
      long_context: getModelForTask("long_context"),
      vision:       getModelForTask("vision"),
      batch:        getModelForTask("batch"),
      general:      getModelForTask("general"),
    },
    envVarsNeeded: {
      GROQ_API_KEY:       { configured: !!process.env.GROQ_API_KEY,       free: true,  url: "https://console.groq.com" },
      GEMINI_API_KEY:     { configured: !!process.env.GEMINI_API_KEY,     free: true,  url: "https://aistudio.google.com" },
      OPENROUTER_API_KEY: { configured: !!process.env.OPENROUTER_API_KEY, free: true,  url: "https://openrouter.ai" },
      CEREBRAS_API_KEY:   { configured: !!process.env.CEREBRAS_API_KEY,   free: true,  url: "https://cloud.cerebras.ai" },
    },
  })
}
