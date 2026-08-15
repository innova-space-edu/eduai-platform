// app/api/superagent/chat/route.ts
// Chat del SuperAgent/Claw conectado a EduAI AI Gateway.
// Mantiene el contrato existente de streaming SSE y tool-use.

import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { runAIText, streamAIText, type GatewayMessage } from "@/lib/ai/gateway"
import { getAvailableProviders, getModelForTask } from "@/lib/ai-router-v5"
import type { Message, AITaskType } from "@/lib/ai-router-v5"
import { runCoreCycle } from "@/lib/superagent/superagent-core"
import type { CoreContext } from "@/lib/superagent/superagent-core"

export const runtime = "nodejs"
export const maxDuration = 60

const EDUAI_SYSTEM_PROMPT = `Eres EduAI Claw, el asistente inteligente de EduAI Platform — una plataforma educativa chilena.

Puedes ayudar con:
• 📝 Crear y mejorar evaluaciones, rúbricas y preguntas
• 📚 Planificación curricular según MINEDUC
• 🧠 Tutorías y explicaciones pedagógicas
• ♿ Adaptaciones PIE/NEE
• 🔬 Contenido STEM
• 📊 Análisis de resultados
• 🎨 Diseño de materiales educativos visuales

Responde siempre en español. Sé concreto, práctico y alineado al contexto chileno.
Para matemática, usa LaTeX con $...$ inline y $$...$$ para bloques.`

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

function capabilityForTask(task: AITaskType): "text" | "code" | "vision" | "long_context" {
  if (task === "coding") return "code"
  if (task === "vision") return "vision"
  if (task === "long_context") return "long_context"
  return "text"
}

function gatewayMessages(messages: Message[], systemPrompt: string): GatewayMessage[] {
  return [
    { role: "system", content: systemPrompt },
    ...messages.map((message) => ({ role: message.role, content: message.content } as GatewayMessage)),
  ]
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ success: false, error: "No autenticado" }, { status: 401 })
    }

    const body = await req.json()
    const {
      messages,
      task: explicitTask,
      maxTokens = 2000,
      systemPrompt,
      stream: wantStream = false,
      context,
      skipTools = false,
    } = body as {
      messages: Message[]
      task?: AITaskType
      maxTokens?: number
      systemPrompt?: string
      stream?: boolean
      context?: {
        page?: string
        pageMode?: string
        subject?: string
        examTitle?: string
        studentCourse?: string
      }
      skipTools?: boolean
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json(
        { success: false, error: "messages es requerido y debe ser un array." },
        { status: 400 }
      )
    }

    const lastUserMessage = [...messages].reverse().find(m => m.role === "user")?.content ?? ""
    const task: AITaskType = explicitTask ?? detectTaskType(lastUserMessage)

    let sysPrompt = systemPrompt ?? EDUAI_SYSTEM_PROMPT
    if (context?.subject) sysPrompt += `\nAsignatura actual: ${context.subject}`
    if (context?.page) sysPrompt += `\nPágina actual: ${context.page}`
    if (context?.examTitle) sysPrompt += `\nExamen en edición: "${context.examTitle}"`
    if (context?.studentCourse) sysPrompt += `\nCurso: ${context.studentCourse}`

    const messagesForGateway = gatewayMessages(messages, sysPrompt)
    const requestContext = {
      userId: user.id,
      module: skipTools ? "superagent-internal" : "superagent-chat",
      reusePolicy: "exact_private" as const,
      visibility: "private" as const,
    }

    // Llamada interna sin tools: evita recursión cuando una herramienta usa IA.
    if (skipTools) {
      const aiResult = await runAIText({
        messages: messagesForGateway,
        capability: capabilityForTask(task),
        maxOutputTokens: maxTokens,
        context: requestContext,
        supabase,
      })

      return Response.json({
        success: true,
        text: aiResult.data,
        provider: aiResult.provider,
        model: aiResult.model,
        task,
        wasToolCall: false,
        reused: aiResult.reused,
      })
    }

    // Streaming SSE compatible con la interfaz existente, ahora sobre AI Gateway.
    if (wantStream) {
      const source = await streamAIText({
        messages: messagesForGateway,
        maxOutputTokens: maxTokens,
        context: requestContext,
        supabase,
      })
      const reader = source.getReader()
      const encoder = new TextEncoder()
      const decoder = new TextDecoder()

      const readable = new ReadableStream<Uint8Array>({
        async start(controller) {
          let full = ""
          try {
            while (true) {
              const { value, done } = await reader.read()
              if (done) break
              const delta = decoder.decode(value, { stream: true })
              if (!delta) continue
              full += delta
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta, done: false })}\n\n`))
            }

            const tail = decoder.decode()
            if (tail) {
              full += tail
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: tail, done: false })}\n\n`))
            }

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              done: true,
              full,
              provider: "EduAI AI Gateway",
              model: "stream",
              task,
            })}\n\n`))
            controller.close()
          } catch (streamError) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              error: streamError instanceof Error ? streamError.message : "Error de streaming",
            })}\n\n`))
            controller.close()
          } finally {
            reader.releaseLock()
          }
        },
        cancel() {
          void reader.cancel()
        },
      })

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
        },
      })
    }

    const coreContext: CoreContext = {
      userId: user.id,
      currentPage: context?.page,
      pageMode: context?.pageMode,
      subject: context?.subject,
      examTitle: context?.examTitle,
      studentCourse: context?.studentCourse,
    }

    const result = await runCoreCycle(
      messages,
      coreContext,
      req.nextUrl.origin,
      { headers: req.headers },
      { supabase, userId: user.id, module: "superagent-chat" },
    )

    return Response.json({
      success: true,
      text: result.text,
      provider: result.provider,
      model: result.model,
      task: result.task,
      latencyMs: result.latencyMs,
      wasToolCall: result.wasToolCall,
      toolUsed: result.toolUsed,
      reused: Boolean(result.reused),
    })
  } catch (error) {
    console.error("[superagent/chat:POST]", error)
    const typed = error as Error & { status?: number; code?: string }
    return Response.json(
      {
        success: false,
        error: typed.message || "Error interno del servidor.",
        code: typed.code,
      },
      { status: typed.status || 500 }
    )
  }
}

// GET conserva el diagnóstico legacy de proveedores mientras Model Lab migra
// el inventario completo a AI Core.
export async function GET() {
  const providers = getAvailableProviders()

  return Response.json({
    success: true,
    providers,
    taskRouting: {
      fast: getModelForTask("fast"),
      coding: getModelForTask("coding"),
      reasoning: getModelForTask("reasoning"),
      long_context: getModelForTask("long_context"),
      vision: getModelForTask("vision"),
      batch: getModelForTask("batch"),
      general: getModelForTask("general"),
    },
    envVarsNeeded: {
      GROQ_API_KEY: { configured: !!process.env.GROQ_API_KEY, free: true },
      GEMINI_API_KEY: { configured: !!process.env.GEMINI_API_KEY, free: true },
      OPENROUTER_API_KEY: { configured: !!process.env.OPENROUTER_API_KEY, free: true },
      CEREBRAS_API_KEY: { configured: !!process.env.CEREBRAS_API_KEY, free: true },
    },
  })
}