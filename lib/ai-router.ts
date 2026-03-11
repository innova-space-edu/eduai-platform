/**
 * AI Router v3 — EduAI Platform
 * ─────────────────────────────────────────────────────────────
 * Groq        → streaming rápido (AGT tutor, Quiz, Sócrates)
 * Gemini 2.5 Flash → razonamiento, calidad, contexto largo
 * Gemini 2.5 Flash-Lite → tareas rápidas (prompt optimizer, detección)
 * OpenRouter  → fallback general
 *
 * Agentes del orquestador potenciado (6 agentes):
 *   AGT-Contexto  → recupera memoria y contexto previo del alumno
 *   AGT-Web       → busca si el tema requiere info actualizada
 *   AGT-Diagnose  → evalúa qué sabe el alumno sobre el tema
 *   AGT-Synthesize → fusiona los 3 contextos (Gemini 2.5 Flash)
 *   AGT-Pedagogy  → elige el estilo pedagógico óptimo
 *   Tutor (Groq stream) → responde al estudiante
 */

interface Message {
  role: "system" | "user" | "assistant"
  content: string
}

interface AIResponse {
  text: string
  provider: string
  model: string
}

// ── MODELOS ───────────────────────────────────────────────
const GEMINI_FLASH      = "gemini-2.5-flash"        // razonamiento + calidad
const GEMINI_FLASH_LITE = "gemini-2.5-flash-lite"   // rápido + barato
const GROQ_MODEL        = "llama-3.3-70b-versatile"

// ── GROQ ─────────────────────────────────────────────────
async function callGroq(messages: Message[], maxTokens = 2000): Promise<AIResponse> {
  const Groq = (await import("groq-sdk")).default
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  const res = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages,
    max_tokens: maxTokens,
    temperature: 0.7,
  })
  return {
    text: res.choices[0]?.message?.content || "",
    provider: "Groq",
    model: GROQ_MODEL,
  }
}

// ── GROQ STREAMING ───────────────────────────────────────
export async function callGroqStream(messages: Message[], maxTokens = 3000): Promise<ReadableStream> {
  const Groq = (await import("groq-sdk")).default
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  const stream = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages,
    max_tokens: maxTokens,
    temperature: 0.7,
    stream: true,
  })
  return new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || ""
        if (text) controller.enqueue(new TextEncoder().encode(text))
      }
      controller.close()
    },
  })
}

// ── GEMINI ───────────────────────────────────────────────
// lite=true usa gemini-2.5-flash-lite para tareas simples/rápidas
async function callGemini(
  messages: Message[],
  maxTokens = 4000,
  lite = false
): Promise<AIResponse> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai")
  const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const modelId = lite ? GEMINI_FLASH_LITE : GEMINI_FLASH
  const gemini = genai.getGenerativeModel({ model: modelId })

  const system = messages.find(m => m.role === "system")?.content || ""
  const history = messages.filter(m => m.role !== "system")

  const chat = gemini.startChat({
    systemInstruction: system,
    history: history.slice(0, -1).map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.7,
    },
  })

  const last = history.at(-1)?.content || ""
  const result = await chat.sendMessage(last)
  return {
    text: result.response.text(),
    provider: "Gemini",
    model: modelId,
  }
}

// ── GEMINI STREAMING ─────────────────────────────────────
export async function callGeminiStream(
  messages: Message[],
  maxTokens = 4000,
  lite = false
): Promise<ReadableStream> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai")
  const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const modelId = lite ? GEMINI_FLASH_LITE : GEMINI_FLASH
  const gemini = genai.getGenerativeModel({ model: modelId })

  const system = messages.find(m => m.role === "system")?.content || ""
  const history = messages.filter(m => m.role !== "system")

  const chat = gemini.startChat({
    systemInstruction: system,
    history: history.slice(0, -1).map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.7,
    },
  })

  const last = history.at(-1)?.content || ""
  const result = await chat.sendMessageStream(last)
  return new ReadableStream({
    async start(controller) {
      for await (const chunk of result.stream) {
        const text = chunk.text()
        if (text) controller.enqueue(new TextEncoder().encode(text))
      }
      controller.close()
    },
  })
}

// ── OPENROUTER ───────────────────────────────────────────
async function callOpenRouter(messages: Message[], maxTokens = 2000): Promise<AIResponse> {
  const models = [
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemma-2-27b-it:free",
    "mistralai/mistral-7b-instruct:free",
  ]
  for (const model of models) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://eduai-platform-virid.vercel.app",
        "X-Title": "EduAI Platform",
      },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
    })
    if (res.ok) {
      const data = await res.json()
      const text = data.choices?.[0]?.message?.content
      if (text) return { text, provider: "OpenRouter", model }
    }
  }
  throw new Error("OpenRouter: all models failed")
}

// ── ROUTER PRINCIPAL ─────────────────────────────────────
/**
 * Asignación óptima por agente:
 *
 * preferProvider: "groq"        → AGT tutor (streaming), Quiz, Sócrates, Sugerencias
 * preferProvider: "gemini"      → Matemático, Redactor, Investigador, Traductor, Orquestador,
 *                                  Creator Studio, Evaluación IA exámenes
 * preferProvider: "gemini-lite" → Prompt optimizer imágenes, detección visual (AIm),
 *                                  clasificaciones simples
 * preferProvider: "openrouter"  → fallback manual
 *
 * Para streaming usar directamente callGroqStream() o callGeminiStream()
 */
export async function callAI(
  messages: Message[],
  options: {
    maxTokens?: number
    preferProvider?: "groq" | "openrouter" | "gemini" | "gemini-lite"
  } = {}
): Promise<AIResponse> {
  const { maxTokens = 2000, preferProvider } = options

  // gemini-lite es Gemini 2.5 Flash-Lite para tareas simples
  if (preferProvider === "gemini-lite") {
    try {
      return await callGemini(messages, maxTokens, true)
    } catch (e: any) {
      console.warn("[AI Router] gemini-lite failed, falling back to gemini:", e.message)
      try { return await callGemini(messages, maxTokens, false) }
      catch {}
      try { return await callGroq(messages, maxTokens) }
      catch {}
      throw new Error("All providers failed for gemini-lite task")
    }
  }

  const providers = [
    { name: "groq",       fn: () => callGroq(messages, maxTokens),            enabled: !!process.env.GROQ_API_KEY       },
    { name: "gemini",     fn: () => callGemini(messages, maxTokens, false),   enabled: !!process.env.GEMINI_API_KEY     },
    { name: "openrouter", fn: () => callOpenRouter(messages, maxTokens),      enabled: !!process.env.OPENROUTER_API_KEY },
  ]

  if (preferProvider) {
    providers.sort((a, b) => a.name === preferProvider ? -1 : b.name === preferProvider ? 1 : 0)
  }

  for (const p of providers) {
    if (!p.enabled) continue
    try { return await p.fn() }
    catch (e: any) { console.warn(`[AI Router] ${p.name} failed:`, e.message) }
  }

  throw new Error("All AI providers failed")
}

// ═══════════════════════════════════════════════════════════
// ORQUESTADOR POTENCIADO — 6 Agentes en paralelo + síntesis
// ═══════════════════════════════════════════════════════════

interface OrchestratorInput {
  question: string
  topic: string
  studentHistory?: string     // resumen de sesión actual
  longMemory?: string         // memoria larga del alumno (de Supabase)
  studentLevel?: "básico" | "intermedio" | "avanzado"
  studyMode?: "normal" | "socratic" | "evaluation" | "collab"
}

interface OrchestratorResult {
  enrichedContext: string
  pedagogyStyle: string
  suggestedVisual: "image" | "chart" | "mermaid" | "table" | "none"
  agentsUsed: string[]
}

/**
 * Orquestador de 6 agentes — usar en chat/route.ts antes del stream del tutor
 * Retorna contexto enriquecido para pasarle al AGT/ASc/AEv
 */
export async function runOrchestrator(input: OrchestratorInput): Promise<OrchestratorResult> {
  const { question, topic, studentHistory = "", longMemory = "", studentLevel = "intermedio", studyMode = "normal" } = input

  // ── AGENTE 1: Contexto (recupera y resume lo relevante del alumno) ──
  const agentContexto = callAI([
    {
      role: "system",
      content: `Eres AGT-Contexto. Analizas el historial de aprendizaje de un alumno y extraes lo más relevante para responder su pregunta actual.
Responde en máximo 3 oraciones concisas. No repitas la pregunta. Solo contexto útil.`
    },
    {
      role: "user",
      content: `Pregunta actual: "${question}"
Tema de estudio: ${topic}
Historial reciente: ${studentHistory.slice(0, 1500) || "Sin historial"}
Memoria larga del alumno: ${longMemory.slice(0, 1000) || "Sin memoria previa"}
¿Qué sabe el alumno sobre esto? ¿Hay brechas o conceptos pendientes?`
    }
  ], { maxTokens: 400, preferProvider: "gemini-lite" })

  // ── AGENTE 2: Diagnóstico (evalúa nivel y gaps) ──
  const agentDiagnose = callAI([
    {
      role: "system",
      content: `Eres AGT-Diagnose. Eres experto en diagnóstico pedagógico. Dado el nivel declarado del alumno y su pregunta, 
identifica: (1) nivel real implícito, (2) conceptos previos necesarios que puede no tener, (3) tipo de dificultad cognitiva.
Responde en máximo 3 líneas. Formato: NIVEL: x | PREREQUISITOS: a, b | TIPO_DIFICULTAD: conceptual/procedimental/aplicación`
    },
    {
      role: "user",
      content: `Nivel declarado: ${studentLevel}
Pregunta: "${question}"
Tema: ${topic}
Modo de estudio: ${studyMode}`
    }
  ], { maxTokens: 300, preferProvider: "gemini-lite" })

  // ── AGENTE 3: Investigador (decide si se necesita contexto extra) ──
  const agentInvestigador = callAI([
    {
      role: "system",
      content: `Eres AGT-Investigador. Analizas preguntas educativas y aportas contexto técnico preciso, datos actuales y ejemplos del mundo real.
Si la pregunta es sobre historia, ciencia, matemáticas u otro campo, aporta: datos clave, contexto histórico relevante, aplicaciones prácticas, analogías potentes.
Máximo 4 oraciones. Solo información de alto valor pedagógico.`
    },
    {
      role: "user",
      content: `Pregunta del alumno: "${question}"
Tema: ${topic}
Aporta el contexto técnico y datos clave más relevantes para explicar esto bien:`
    }
  ], { maxTokens: 500, preferProvider: "gemini" })

  // Ejecutar los 3 primeros en paralelo
  const [contextoRes, diagnoseRes, investigadorRes] = await Promise.allSettled([
    agentContexto,
    agentDiagnose,
    agentInvestigador,
  ])

  const contexto = contextoRes.status === "fulfilled" ? contextoRes.value.text : ""
  const diagnostico = diagnoseRes.status === "fulfilled" ? diagnoseRes.value.text : ""
  const investigacion = investigadorRes.status === "fulfilled" ? investigadorRes.value.text : ""

  // ── AGENTE 4: Síntesis (fusiona los 3 contextos) ──
  const agentSynthesize = await callAI([
    {
      role: "system",
      content: `Eres AGT-Synthesize. Recibes reportes de 3 agentes especializados y produces un briefing pedagógico integrado.
Tu output es usado por el tutor IA para dar la mejor respuesta posible.
Responde con un briefing claro en máximo 5 oraciones. Incluye: qué sabe el alumno, qué necesita, qué contexto técnico es relevante.`
    },
    {
      role: "user",
      content: `PREGUNTA DEL ALUMNO: "${question}"
TEMA: ${topic}

─── REPORTE CONTEXTO-ALUMNO ───
${contexto}

─── REPORTE DIAGNÓSTICO ───
${diagnostico}

─── REPORTE INVESTIGACIÓN ───
${investigacion}

Sintetiza en un briefing pedagógico para el tutor:`
    }
  ], { maxTokens: 600, preferProvider: "gemini" })

  // ── AGENTE 5: Pedagogía (elige el estilo óptimo de respuesta) ──
  const agentPedagogia = await callAI([
    {
      role: "system",
      content: `Eres AGT-Pedagogy. Eres experto en didáctica y estilos de aprendizaje.
Dado el diagnóstico del alumno, decide:
1. ESTILO: directo|socrático|analógico|paso-a-paso|visual
2. TONO: formal|conversacional|motivador|técnico
3. VISUAL: image|chart|mermaid|table|none (¿qué tipo de visual complementaría mejor?)
4. CONSEJO: una instrucción corta para el tutor (ej: "Usa analogías cotidianas", "Muestra el procedimiento paso a paso")
Responde SOLO en este formato JSON: {"estilo":"...","tono":"...","visual":"...","consejo":"..."}`
    },
    {
      role: "user",
      content: `Briefing del alumno: ${agentSynthesize.text}
Modo de estudio activo: ${studyMode}
Nivel: ${studentLevel}
Pregunta: "${question}"`
    }
  ], { maxTokens: 200, preferProvider: "gemini-lite" })

  // Parsear decisión pedagógica
  let pedagogyDecision = { estilo: "directo", tono: "conversacional", visual: "none" as const, consejo: "" }
  try {
    const raw = agentPedagogia.text.replace(/```json|```/g, "").trim()
    pedagogyDecision = { ...pedagogyDecision, ...JSON.parse(raw) }
  } catch { /* mantener defaults */ }

  const enrichedContext = `${agentSynthesize.text}\n\n[CONSEJO PEDAGÓGICO]: ${pedagogyDecision.consejo}`

  return {
    enrichedContext,
    pedagogyStyle: `${pedagogyDecision.estilo} | ${pedagogyDecision.tono}`,
    suggestedVisual: pedagogyDecision.visual as "image" | "chart" | "mermaid" | "table" | "none",
    agentsUsed: ["AGT-Contexto", "AGT-Diagnose", "AGT-Investigador", "AGT-Synthesize", "AGT-Pedagogy"],
  }
}

// ═══════════════════════════════════════════════════════════
// OPTIMIZADOR DE PROMPTS PARA IMÁGENES — Gemini 2.5 Flash-Lite
// ═══════════════════════════════════════════════════════════

export async function optimizeImagePrompt(
  userPrompt: string,
  style: string,
  styleKeywords: string,
  educationalContext?: string
): Promise<string> {
  const messages: Message[] = [
    {
      role: "system",
      content: `You are an expert prompt engineer for AI image generation (FLUX, Stable Diffusion).
Transform user descriptions into highly detailed, vivid English prompts.
CRITICAL RULES:
- Keep the user's EXACT subject — never change what they asked for
- Add style, lighting, composition, quality keywords
- If educational context is provided, make the image pedagogically useful
- Output ONLY the optimized prompt, no explanations, no quotes, no preamble`
    },
    {
      role: "user",
      content: `User request: "${userPrompt}"
Style: ${style} — keywords: ${styleKeywords}
${educationalContext ? `Educational context: "${educationalContext.slice(0, 400)}"` : ""}

Transform into an optimized generation prompt. Output ONLY the prompt:`
    }
  ]
  const result = await callAI(messages, { maxTokens: 400, preferProvider: "gemini-lite" })
  return result.text.trim().replace(/^["']|["']$/g, "")
}

// ═══════════════════════════════════════════════════════════
// DETECTOR DE VISUAL INTELIGENTE — AGT-AIm potenciado
// ═══════════════════════════════════════════════════════════

export async function detectVisualType(
  context: string,
  topic: string
): Promise<{ type: string; title: string; imagePrompt?: string; content?: string; caption: string }> {
  const messages: Message[] = [
    {
      role: "system",
      content: `Eres AIm v2, el agente visual de EduAI. Analizas texto educativo y decides el visual más efectivo.

REGLAS DE DECISIÓN:
- valores, datos, comparaciones estadísticas, porcentajes → "chart"
- procesos, pasos secuenciales, flujos, relaciones causa-efecto → "mermaid"
- comparaciones de entidades, características, propiedades → "table"
- conceptos físicos, geométricos, históricos, abstractos visualizables → "image"
- solo conversacional o explicativo sin elemento visual claro → "none"

Para "image": prompt educativo en inglés, 15-25 palabras, estilo pedagógico claro
Para "mermaid": sintaxis flowchart TD, máximo 7 nodos, sin punto y coma en labels, texto corto
Para "chart": JSON exacto con type/data/labels/datasets — usa datos REALES del contexto
Para "table": markdown, máximo 4 columnas × 6 filas, datos del contexto

Responde SOLO con JSON válido: {"type":"...","title":"...","imagePrompt":"...","content":"...","caption":"..."}`
    },
    {
      role: "user",
      content: `Tema: ${topic}
Texto educativo:\n"${context.slice(0, 2000)}"\n\n¿Qué visual añade más valor aquí?`
    }
  ]

  try {
    const result = await callAI(messages, { maxTokens: 600, preferProvider: "gemini-lite" })
    const raw = result.text.replace(/```json|```/g, "").trim()
    return JSON.parse(raw)
  } catch {
    return { type: "none", title: "", caption: "" }
  }
}
