// app/api/agents/claw-chat/route.ts
// Endpoint de compatibilidad para el botón flotante y la consola principal de Claw.
// Usa el núcleo del SuperAgent y entrega al AI Gateway el usuario autenticado real.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildCoreSystemPrompt,
  canStreamCoreAI,
  coreGatewayCapability,
  coreTokenBudget,
  detectCoreAITask,
  runCoreCycle,
} from "@/lib/superagent/superagent-core";
import type { CoreContext, CoreMessage } from "@/lib/superagent/superagent-core";
import { streamAIText, type GatewayMessage } from "@/lib/ai/gateway";
import { getEnabledTools } from "@/lib/superagent/tool-registry";
import { EDUAI_PAGES, searchEduAIPages } from "@/lib/superagent/eduai-map";
import { getEduAIPlatformKnowledgeContext } from "@/lib/eduai/platform-knowledge";
import { normalizeChatText } from "@/lib/text/normalize-chat-text";

type RouteSuggestion = { label: string; href: string; emoji: string };

function pageSuggestion(key: string): RouteSuggestion | null {
  const page = EDUAI_PAGES.find((item) => item.key === key);
  return page ? { label: page.label, href: page.href, emoji: page.emoji } : null;
}

type ClawAttachment = {
  id?: string
  name?: string
  mimeType?: string
  kind?: string
  text?: string
  warnings?: string[]
}

type PageContext = {
  pathname?: string;
  pageTitle?: string;
  mode?: string;
  subject?: string;
  selectedTopic?: string;
  selectedSubtopic?: string;
  availableActions?: string[];
};

function normalizeHistory(history: unknown, message: string): CoreMessage[] {
  const safeHistory = Array.isArray(history)
    ? history
        .filter((m): m is { role: string; content: string } => m && typeof m.role === "string" && typeof m.content === "string")
        .slice(-10)
        .map((m): CoreMessage => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }))
    : [];

  const last = safeHistory[safeHistory.length - 1];
  if (!last || last.role !== "user" || last.content.trim() !== message.trim()) {
    safeHistory.push({ role: "user", content: message });
  }

  return safeHistory;
}

function inferRouteSuggestions(reply: string, userMessage: string) {
  const suggestions: RouteSuggestion[] = [];
  const add = (route: RouteSuggestion | null) => {
    if (route && !suggestions.some((item) => item.href === route.href)) suggestions.push(route);
  };

  for (const page of searchEduAIPages(`${userMessage} ${reply}`, 6)) {
    add({ label: page.label, href: page.href, emoji: page.emoji });
  }

  for (const page of EDUAI_PAGES) {
    if (reply.includes(page.href)) {
      add({ label: page.label, href: page.href, emoji: page.emoji });
    }
  }

  return suggestions.slice(0, 4);
}

function buildSuggestions(reply: string, message: string, toolUsed?: string) {
  const suggestions = inferRouteSuggestions(reply, message);

  const toolMap: Record<string, string> = {
    generate_image: "image_studio",
    generate_image_prompt: "image_studio",
    generate_edu_video: "video_studio",
    recommend_focus_music: "music",
    narrate_text: "audio_lab",
    generate_podcast: "audio_lab",
    generate_exam_questions: "create_exam",
    generate_rubric: "create_exam",
    adapt_for_pie: "educator",
    plan_curriculum: "educator",
    summarize_text: "paper",
    proofread_text: "writer",
    translate_text: "translator",
    explain_concept: "study",
    generate_code: "creator_hub",
    fix_code_error: "creator_hub",
  };

  const key = toolUsed ? toolMap[toolUsed] : undefined;
  const route = key ? pageSuggestion(key) : null;
  if (route && !suggestions.some((item) => item.href === route.href)) suggestions.unshift(route);

  return suggestions.slice(0, 4);
}

function safeAttachments(value: unknown): ClawAttachment[] {
  if (!Array.isArray(value)) return []
  let remaining = 90_000
  const result: ClawAttachment[] = []

  for (const raw of value.slice(0, 6)) {
    if (!raw || typeof raw !== "object" || remaining <= 0) continue
    const item = raw as Record<string, unknown>
    const name = typeof item.name === "string" ? item.name.slice(0, 180) : "Archivo"
    const text = typeof item.text === "string" ? normalizeChatText(item.text).slice(0, remaining) : ""
    if (!text) continue
    remaining -= text.length
    result.push({
      id: typeof item.id === "string" ? item.id.slice(0, 100) : undefined,
      name,
      mimeType: typeof item.mimeType === "string" ? item.mimeType.slice(0, 120) : undefined,
      kind: typeof item.kind === "string" ? item.kind.slice(0, 60) : undefined,
      text,
      warnings: Array.isArray(item.warnings) ? item.warnings.map(String).slice(0, 5) : undefined,
    })
  }
  return result
}

function attachmentContext(items: ClawAttachment[]) {
  return items.map((item, index) => {
    const warnings = item.warnings?.length ? `\nAdvertencias de extracción: ${item.warnings.join(" | ")}` : ""
    return `[ARCHIVO ${index + 1}: ${item.name || "Archivo"} · ${item.kind || item.mimeType || "documento"}]\n${item.text || ""}${warnings}`
  }).join("\n\n---\n\n")
}

function safePageContext(value: unknown): PageContext {
  if (!value || typeof value !== "object") return {};
  const raw = value as Record<string, unknown>;
  return {
    pathname: typeof raw.pathname === "string" ? raw.pathname.slice(0, 180) : undefined,
    pageTitle: typeof raw.pageTitle === "string" ? raw.pageTitle.slice(0, 160) : undefined,
    mode: typeof raw.mode === "string" ? raw.mode.slice(0, 80) : undefined,
    subject: typeof raw.subject === "string" ? raw.subject.slice(0, 80) : undefined,
    selectedTopic: typeof raw.selectedTopic === "string" ? raw.selectedTopic.slice(0, 120) : undefined,
    selectedSubtopic: typeof raw.selectedSubtopic === "string" ? raw.selectedSubtopic.slice(0, 120) : undefined,
    availableActions: Array.isArray(raw.availableActions) ? raw.availableActions.map(String).slice(0, 12) : undefined,
  };
}

function inferPathnameFromReferrer(req: NextRequest): string | undefined {
  const ref = req.headers.get("referer") || req.headers.get("referrer");
  if (!ref) return undefined;
  try {
    return new URL(ref).pathname.slice(0, 180);
  } catch {
    return undefined;
  }
}

function inferTopicFromPath(pathname?: string): string | undefined {
  if (!pathname) return undefined;
  const match = pathname.match(/^\/study\/([^/?#]+)/);
  if (!match) return undefined;
  try {
    return decodeURIComponent(match[1]).slice(0, 120);
  } catch {
    return match[1];
  }
}

function buildClawConversationMode(mode?: string) {
  const normalized = String(mode || "").toLowerCase();
  const isTeacher = normalized.includes("teacher") || normalized.includes("docente");
  const isAdmin = normalized.includes("admin");

  if (isTeacher) {
    return `${isAdmin ? "usuario con permisos administrativos" : "usuario educativo"}; PRIORIDAD: trabaja como copiloto profesional y cercano, sin asumir que la persona es docente ni que pertenece a un colegio específico. Responde siempre en el idioma del último mensaje del usuario; si cambia a inglés, responde en inglés, y si vuelve al español, vuelve al español. Responde primero a la necesidad concreta y conserva continuidad con el contexto ya entregado. Puedes conversar con naturalidad y, cuando haya una tarea educativa, conviértela en un resultado utilizable. Flujos prioritarios: planificación, actividades, evaluaciones, rúbricas, retroalimentación, adaptación PIE/NEE, materiales, investigación, análisis de resultados, gestión y navegación por herramientas EduAI. Si falta un dato que cambie materialmente el resultado (por ejemplo nivel, curso, asignatura, tema, institución o duración), formula una sola pregunta breve y específica; no hagas cuestionarios largos. Si el dato ya está en el contexto o historial, no lo vuelvas a pedir. No asumas institución, ciudad o país. Si el usuario pide OA o referencias MINEDUC, usa el contexto chileno disponible y no inventes códigos ni descriptores; para otras instituciones o países, adapta el lenguaje a lo que el usuario indique. Diferencia claramente entre borrador, sugerencia y acción ejecutada. No empujes herramientas cuando una respuesta directa sea suficiente. Usa formato limpio, breve y accionable, y termina con un siguiente paso concreto solo cuando aporte valor.`;
  }

  return "usuario; conversación natural y cercana. No asumas profesión, institución, ciudad ni país. Responde siempre en el idioma del último mensaje del usuario; si cambia a inglés, responde en inglés, y si vuelve al español, vuelve al español. Responde primero a lo que la persona dice. No conviertas saludos ni charla casual en una sesión de estudio y no empujes herramientas si no las piden. Usa formato limpio y fácil de leer.";
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const tools = getEnabledTools()
      .filter((tool) => tool.category !== "code")
      .map((tool) => ({
        name: tool.name,
        label: tool.label,
        icon: tool.icon,
        description: tool.description,
        category: tool.category,
      }));

    const pages = EDUAI_PAGES
      .filter((page) => !page.href.startsWith("/admin"))
      .map(({ key, label, href, emoji, description, group }) => ({
        key,
        label,
        href,
        emoji,
        description,
        group,
      }));

    return NextResponse.json({
      audience: "education",
      tools,
      pages,
      syncedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const typed = err as Error;
    return NextResponse.json({ error: typed.message || "Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { message, history = [], userName, pageContext, requestedTool, stream = false, attachments } = await req.json();
    const cleanMessage = String(message || "").trim();

    if (!cleanMessage) return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });

    const context = safePageContext(pageContext);
    const inferredPath = context.pathname || inferPathnameFromReferrer(req) || "floating-claw";
    const inferredTopic = context.subject || context.selectedTopic || inferTopicFromPath(inferredPath);
    const messages = normalizeHistory(history, cleanMessage);
    const displayName = typeof userName === "string" && userName.trim() && userName.trim().toLowerCase() !== "usuario" ? userName.trim().slice(0, 100) : undefined;
    const platformKnowledge = await getEduAIPlatformKnowledgeContext(supabase, cleanMessage, messages);
    const safeFiles = safeAttachments(attachments);
    const sourceContext = attachmentContext(safeFiles);

    const coreContext: CoreContext = {
      currentPage: inferredPath,
      subject: inferredTopic,
      examTitle: context.pageTitle,
      studentCourse: context.selectedSubtopic,
      userId: user.id,
      pageMode: `${buildClawConversationMode(context.mode)}${displayName ? ` Nombre visible del usuario: ${displayName}.` : ""}${platformKnowledge ? `\n${platformKnowledge}` : ""}`,
      availableActions: context.availableActions,
      sourceContext: sourceContext || undefined,
      requestedTool:
        typeof requestedTool === "string"
          ? requestedTool.slice(0, 100)
          : undefined,
    };

    if (stream === true && canStreamCoreAI(cleanMessage, coreContext)) {
      const task = detectCoreAITask(cleanMessage);
      const aiMessages: GatewayMessage[] = [
        { role: "system", content: buildCoreSystemPrompt(coreContext) },
        ...messages
          .filter((item) => item.role !== "system")
          .map((item) => ({ role: item.role, content: item.content } as GatewayMessage)),
      ];

      const source = await streamAIText({
        messages: aiMessages,
        maxOutputTokens: coreTokenBudget(task, true),
        preferredProvider: task === "general" ? "groq" : undefined,
        fallbackToDefault: true,
        lite: task === "general",
        fastPath: true,
        context: {
          userId: user.id,
          module: "claw-chat-stream",
          reusePolicy: "never",
          visibility: "private",
        },
        supabase,
      });

      const reader = source.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();

      const body = new ReadableStream<Uint8Array>({
        async start(controller) {
          let full = "";
          try {
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              const delta = decoder.decode(value, { stream: true });
              if (!delta) continue;
              full += delta;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
            }

            const tail = decoder.decode();
            if (tail) {
              full += tail;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: tail })}\n\n`));
            }

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              done: true,
              suggestions: buildSuggestions(full, cleanMessage),
              task,
            })}\n\n`));
            controller.close();
          } catch (error) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              error: error instanceof Error ? error.message : "La respuesta se interrumpió.",
            })}\n\n`));
            controller.close();
          } finally {
            reader.releaseLock();
          }
        },
        cancel() {
          void reader.cancel();
        },
      });

      return new Response(body, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-store, no-transform",
          "Connection": "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    const result = await runCoreCycle(
      messages,
      coreContext,
      req.nextUrl.origin,
      { headers: req.headers },
      {
        supabase,
        userId: user.id,
        module: "claw-chat",
        latencyMode: "fast",
      },
    );

    const cleanReply = normalizeChatText(result.text)

    return NextResponse.json({
      reply: cleanReply,
      suggestions: buildSuggestions(cleanReply, cleanMessage, result.toolUsed),
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
      toolUsed: result.toolUsed,
      wasToolCall: result.wasToolCall,
      reused: Boolean(result.reused),
    });
  } catch (err: unknown) {
    const typed = err as Error & { status?: number; code?: string };
    return NextResponse.json(
      { error: typed.message || "Error", code: typed.code },
      { status: typed.status || 500 },
    );
  }
}