// lib/agents/coding-agent.ts
// ─────────────────────────────────────────────────────────────────────────────
// CodingAgent — asistente de código para docentes y desarrollo de la plataforma.
// Usa Kimi K2 (task: "coding") — el mejor modelo free 2026 para código.
// Casos de uso: generar componentes React, consultas SQL, scripts Python,
// corrección de errores TypeScript, generación de APIs Next.js.
// ─────────────────────────────────────────────────────────────────────────────

import { callAIv5 } from "@/lib/ai-router-v5"
import type { Message } from "@/lib/ai-router-v5"

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type CodeLanguage =
  | "typescript" | "tsx"    | "javascript"
  | "python"     | "sql"    | "css"
  | "html"       | "bash"   | "json"

export type CodeTaskType =
  | "generate"   // generar código nuevo
  | "fix"        // corregir errores
  | "explain"    // explicar código existente
  | "refactor"   // mejorar código existente
  | "review"     // revisar y dar feedback

export interface CodeRequest {
  task:        CodeTaskType
  description: string        // qué quiere hacer
  language?:   CodeLanguage
  existingCode?: string      // código existente (para fix/explain/refactor)
  errorMessage?: string      // mensaje de error (para fix)
  context?:    string        // contexto adicional (stack, versión, etc.)
}

export interface CodeResult {
  success:     boolean
  code?:       string        // código generado/corregido
  explanation?: string       // explicación del código
  language?:   CodeLanguage
  provider?:   string
  error?:      string
}

// ── System prompt para coding ─────────────────────────────────────────────────

const CODING_SYSTEM = `Eres un experto en desarrollo de software educativo.
Stack principal: Next.js 14+, TypeScript, Tailwind CSS, Supabase, React.

Reglas:
- Código limpio, tipado correctamente en TypeScript
- Usa CSS variables del sistema (bg-app, text-main, border-soft, etc.) para Tailwind
- Componentes React con "use client" cuando sea necesario
- APIs de Next.js en app router (route.ts)
- Supabase con createClient() del servidor o cliente según contexto
- Comenta el código en español
- Si hay un error, explica la causa antes de la solución

Formato de respuesta:
1. Breve explicación de lo que hace el código (2-3 líneas)
2. Bloque de código con el lenguaje correcto
3. Instrucciones de uso si aplica`

// ── Builders de prompt ────────────────────────────────────────────────────────

function buildPrompt(req: CodeRequest): string {
  const lang = req.language ? `Lenguaje: ${req.language}` : ""

  switch (req.task) {
    case "generate":
      return `Genera el siguiente código:
${req.description}
${lang}
${req.context ? `Contexto: ${req.context}` : ""}`

    case "fix":
      return `Corrige este error en el código:

ERROR:
${req.errorMessage ?? "Ver el código para identificar el problema"}

CÓDIGO CON ERROR:
\`\`\`${req.language ?? "typescript"}
${req.existingCode ?? ""}
\`\`\`

${req.description ? `Descripción adicional: ${req.description}` : ""}`

    case "explain":
      return `Explica este código de forma clara y detallada:

\`\`\`${req.language ?? "typescript"}
${req.existingCode ?? ""}
\`\`\`

${req.description ? `Pregunta específica: ${req.description}` : ""}`

    case "refactor":
      return `Refactoriza este código para mejorar su calidad, legibilidad y rendimiento:

CÓDIGO ACTUAL:
\`\`\`${req.language ?? "typescript"}
${req.existingCode ?? ""}
\`\`\`

${req.description ? `Instrucciones específicas: ${req.description}` : ""}
Mantén la misma funcionalidad. Explica los cambios realizados.`

    case "review":
      return `Revisa este código y da feedback detallado:

\`\`\`${req.language ?? "typescript"}
${req.existingCode ?? ""}
\`\`\`

Evalúa: calidad, tipado, seguridad, rendimiento, mejores prácticas.
${req.description ? `Foco específico: ${req.description}` : ""}`

    default:
      return req.description
  }
}

// ── Extractor de código del response ─────────────────────────────────────────

function extractCode(text: string, language?: CodeLanguage): { code: string; explanation: string } {
  // Buscar bloque de código con lenguaje
  const langPattern = language ? `\`\`\`(?:${language}|tsx?|js)` : `\`\`\`\\w*`
  const codeMatch = text.match(new RegExp(`${langPattern}\\n([\\s\\S]*?)\`\`\``, "i"))

  if (codeMatch?.[1]) {
    const code        = codeMatch[1].trim()
    const explanation = text.replace(codeMatch[0], "").trim()
    return { code, explanation }
  }

  // Si no hay bloque de código, devolver todo como explicación
  return { code: "", explanation: text }
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * runCodingTask — ejecuta una tarea de código con Kimi K2.
 */
export async function runCodingTask(req: CodeRequest): Promise<CodeResult> {
  const messages: Message[] = [
    { role: "system", content: CODING_SYSTEM },
    { role: "user",   content: buildPrompt(req) },
  ]

  try {
    const result = await callAIv5(messages, {
      task:      "coding",   // → Kimi K2 automáticamente
      maxTokens: 4000,
    })

    const { code, explanation } = extractCode(result.text, req.language)

    return {
      success:     true,
      code:        code || undefined,
      explanation: explanation || result.text,
      language:    req.language,
      provider:    result.provider,
    }
  } catch (err) {
    return {
      success: false,
      error:   err instanceof Error ? err.message : "Error en CodingAgent.",
    }
  }
}

// ── Shortcuts ─────────────────────────────────────────────────────────────────

/**
 * generateComponent — genera un componente React/TSX.
 */
export async function generateComponent(
  description: string,
  context?:    string
): Promise<CodeResult> {
  return runCodingTask({
    task:        "generate",
    description,
    language:    "tsx",
    context:     context ?? "Next.js 14, Tailwind CSS, TypeScript",
  })
}

/**
 * fixTypeScriptError — corrige errores de TypeScript.
 */
export async function fixTypeScriptError(
  code:         string,
  errorMessage: string
): Promise<CodeResult> {
  return runCodingTask({
    task:         "fix",
    description:  "Corregir el error de TypeScript",
    language:     "typescript",
    existingCode: code,
    errorMessage,
  })
}

/**
 * generateSupabaseQuery — genera una query SQL para Supabase.
 */
export async function generateSupabaseQuery(
  description: string
): Promise<CodeResult> {
  return runCodingTask({
    task:        "generate",
    description,
    language:    "sql",
    context:     "PostgreSQL con Supabase, Row Level Security habilitado",
  })
}

/**
 * generateAPIRoute — genera una API route de Next.js.
 */
export async function generateAPIRoute(
  description: string
): Promise<CodeResult> {
  return runCodingTask({
    task:        "generate",
    description,
    language:    "typescript",
    context:     "Next.js 14 App Router, route.ts, Supabase auth con createClient()",
  })
}

/**
 * explainCode — explica código existente en términos simples.
 */
export async function explainCode(
  code:     string,
  language: CodeLanguage = "typescript",
  question?: string
): Promise<CodeResult> {
  return runCodingTask({
    task:         "explain",
    description:  question ?? "Explica qué hace este código paso a paso",
    language,
    existingCode: code,
  })
}

// ── Sugerencias de uso para docentes ─────────────────────────────────────────

export const CODING_QUICK_PROMPTS = [
  {
    label:   "Componente React",
    icon:    "⚛️",
    prompt:  "Genera un componente React para ",
    task:    "generate" as CodeTaskType,
    lang:    "tsx"      as CodeLanguage,
  },
  {
    label:   "API Route Next.js",
    icon:    "🔌",
    prompt:  "Genera una API route POST para ",
    task:    "generate" as CodeTaskType,
    lang:    "typescript" as CodeLanguage,
  },
  {
    label:   "Query SQL",
    icon:    "🗄️",
    prompt:  "Genera una query SQL para ",
    task:    "generate" as CodeTaskType,
    lang:    "sql"      as CodeLanguage,
  },
  {
    label:   "Corregir error",
    icon:    "🔧",
    prompt:  "Corrige este error: ",
    task:    "fix"      as CodeTaskType,
    lang:    "typescript" as CodeLanguage,
  },
  {
    label:   "Explicar código",
    icon:    "📖",
    prompt:  "Explica este código: ",
    task:    "explain"  as CodeTaskType,
    lang:    "typescript" as CodeLanguage,
  },
]
