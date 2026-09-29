// app/api/agents/claw-chat/route.ts
// Endpoint de compatibilidad para el botón flotante y la consola principal de Claw.
// Usa el núcleo del SuperAgent y entrega al AI Gateway el usuario autenticado real.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runCoreCycle } from "@/lib/superagent/superagent-core";
import type { CoreMessage } from "@/lib/superagent/superagent-core";
import { getEnabledTools } from "@/lib/superagent/tool-registry";
import { EDUAI_PAGES } from "@/lib/superagent/eduai-map";

const AGENT_ROUTES: Record<string, { label: string; href: string; emoji: string }> = {
  dashboard: { label: "Panel", href: "/dashboard", emoji: "🏠" },
  study: { label: "Estudiar un tema", href: "/study", emoji: "📚" },
  sessions: { label: "Sesiones", href: "/sessions", emoji: "📖" },
  agentes: { label: "Agentes", href: "/agentes", emoji: "🤖" },
  educador: { label: "Planificador docente", href: "/educador", emoji: "🏫" },
  investigador: { label: "Investigador académico", href: "/investigador", emoji: "🔬" },
  redactor: { label: "Redactor de documentos", href: "/redactor", emoji: "✍️" },
  matematico: { label: "Matemático IA", href: "/matematico", emoji: "🧮" },
  traductor: { label: "Traductor", href: "/traductor", emoji: "🌐" },
  imagenes: { label: "Image Studio", href: "/image-studio", emoji: "🎨" },
  galeria: { label: "Galería de imágenes", href: "/galeria", emoji: "🖼️" },
  paper: { label: "Paper académico", href: "/paper", emoji: "📄" },
  audiolab: { label: "Audio Lab", href: "/audio-lab", emoji: "🎙️" },
  videostudio: { label: "Video Studio", href: "/video-studio", emoji: "🎬" },
  music: { label: "EduAI Music", href: "/music", emoji: "🎵" },
  examfocus: { label: "Exam Focus", href: "/exam-focus", emoji: "🎯" },
  aisocial: { label: "Chat social de agentes", href: "/ai-social", emoji: "💬" },
  examen: { label: "Crear examen", href: "/examen/crear", emoji: "📝" },
  resultados: { label: "Resultados", href: "/examen/docente", emoji: "📊" },
  creator: { label: "Creator Hub", href: "/creator-hub", emoji: "🚀" },
  workspace: { label: "Mis proyectos", href: "/workspace", emoji: "📁" },
  collab: { label: "Estudio colaborativo", href: "/collab", emoji: "🤝" },
  qr: { label: "QR Studio", href: "/qr-studio", emoji: "▦" },
};

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
        .slice(-16)
        .map((m): CoreMessage => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }))
    : [];

  const last = safeHistory[safeHistory.length - 1];
  if (!last || last.role !== "user" || last.content.trim() !== message.trim()) {
    safeHistory.push({ role: "user", content: message });
  }

  return safeHistory;
}

function inferRouteSuggestions(reply: string, userMessage: string) {
  const text = `${reply} ${userMessage}`.toLowerCase();
  const suggestions: { label: string; href: string; emoji: string }[] = [];

  const add = (key: keyof typeof AGENT_ROUTES) => {
    const route = AGENT_ROUTES[key];
    if (route && !suggestions.find((item) => item.href === route.href)) suggestions.push(route);
  };

  if (/estudi|aprender|repasar|clase aut[oó]noma|sesi[oó]n/.test(text)) add("study");
  if (/examen|prueba|evaluaci[oó]n|preguntas/.test(text)) add("examen");
  if (/imagen|infograf|visual|afiche|poster/.test(text)) add("imagenes");
  if (/audio|voz|narrar|transcrip/.test(text)) add("audiolab");
  if (/video|animaci[oó]n/.test(text)) add("videostudio");
  if (/qr|c[oó]digo qr|enlace/.test(text)) add("qr");
  if (/paper|documento|investigaci[oó]n|pdf/.test(text)) add("paper");
  if (/m[uú]sica|focus|concentraci[oó]n/.test(text)) add("music");
  if (/planific|mineduc|oa|clase docente|actividad de aprendizaje|adaptar.*pie|nee/.test(text)) add("educador");
  if (/resultado|notas?|calificaciones|respuestas|promedio|rendimiento/.test(text)) add("resultados");
  if (/proyecto|workspace|tarea/.test(text)) add("workspace");
  if (/creator|hub|material|recurso/.test(text)) add("creator");

  for (const route of Object.values(AGENT_ROUTES)) {
    if (reply.includes(route.href) && !suggestions.find((item) => item.href === route.href)) suggestions.push(route);
  }

  return suggestions.slice(0, 4);
}

function buildSuggestions(reply: string, message: string, toolUsed?: string) {
  const suggestions = inferRouteSuggestions(reply, message);

  const toolMap: Record<string, keyof typeof AGENT_ROUTES> = {
    generate_image: "imagenes",
    generate_image_prompt: "imagenes",
    generate_edu_video: "videostudio",
    recommend_focus_music: "music",
    narrate_text: "audiolab",
    generate_exam_questions: "examen",
    generate_rubric: "examen",
    adapt_for_pie: "educador",
    plan_curriculum: "educador",
    generate_code: "creator",
    fix_code_error: "creator",
  };

  const key = toolUsed ? toolMap[toolUsed] : undefined;
  if (key) {
    const route = AGENT_ROUTES[key];
    if (route && !suggestions.find((item) => item.href === route.href)) suggestions.unshift(route);
  }

  return suggestions.slice(0, 4);
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
    return `${isAdmin ? "administrador y docente" : "docente"}; PRIORIDAD: trabaja como copiloto profesional del profesor, no como tutor de estudiante. Responde primero a la necesidad concreta y conserva continuidad con el contexto ya entregado. Puedes conversar con naturalidad, pero ante tareas pedagógicas debes convertir la solicitud en un resultado utilizable. Flujos prioritarios: planificación de clases, actividades, evaluaciones, rúbricas, retroalimentación, adaptación PIE/NEE, materiales, análisis de resultados y navegación por herramientas EduAI. Si falta un dato que cambie materialmente el producto (por ejemplo curso, asignatura, tema o duración), formula una sola pregunta breve y específica; no hagas cuestionarios largos. Si el dato ya está en el contexto o historial, no lo vuelvas a pedir. Para Chile, usa lenguaje docente y estructura compatible con trabajo escolar; cuando el usuario solicite OA o referencias MINEDUC, no inventes códigos ni descriptores que no estén disponibles. Diferencia claramente entre borrador, sugerencia y acción ejecutada. No empujes herramientas cuando una respuesta directa sea suficiente. Usa formato limpio, breve y accionable, y termina con un siguiente paso concreto solo cuando aporte valor.`;
  }

  return "usuario; conversación natural y cercana. Responde primero a lo que la persona dice. No conviertas saludos ni charla casual en una sesión de estudio y no empujes herramientas si no las piden. Usa formato limpio y fácil de leer.";
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
      audience: "teacher",
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

    const { message, history = [], userName, pageContext, requestedTool } = await req.json();
    const cleanMessage = String(message || "").trim();

    if (!cleanMessage) return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });

    const context = safePageContext(pageContext);
    const inferredPath = context.pathname || inferPathnameFromReferrer(req) || "floating-claw";
    const inferredTopic = context.subject || context.selectedTopic || inferTopicFromPath(inferredPath);
    const messages = normalizeHistory(history, cleanMessage);
    const displayName = typeof userName === "string" ? userName.slice(0, 100) : undefined;

    const result = await runCoreCycle(
      messages,
      {
        currentPage: inferredPath,
        subject: inferredTopic,
        examTitle: context.pageTitle,
        studentCourse: context.selectedSubtopic,
        userId: user.id,
        pageMode: `${buildClawConversationMode(context.mode)}${displayName ? ` Nombre visible del usuario: ${displayName}.` : ""}`,
        availableActions: context.availableActions,
        requestedTool:
          typeof requestedTool === "string"
            ? requestedTool.slice(0, 100)
            : undefined,
      },
      req.nextUrl.origin,
      { headers: req.headers },
      {
        supabase,
        userId: user.id,
        module: "claw-chat",
      },
    );

    return NextResponse.json({
      reply: result.text,
      suggestions: buildSuggestions(result.text, cleanMessage, result.toolUsed),
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