/**
 * AI Router v4 — EduAI Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * GEMINI como motor principal. Misma interfaz que v3 — drop-in replacement.
 *
 * Modelos:
 *   gemini-2.5-flash          → razonamiento, texto largo, análisis, exámenes
 *   gemini-2.5-flash-lite      → tareas rápidas/económicas (classify, brief agents)
 *   gemini-2.0-flash-preview-image-generation → generación de imágenes
 *   llama-3.3-70b-versatile   → streaming ultra-rápido (Groq, fallback 1)
 *   OpenRouter models          → fallback 2
 *   Together AI models         → fallback 3
 *
 * Nuevas funciones v4:
 *   callGeminiStructured()    → JSON garantizado via responseSchema
 *   callGeminiMultimodal()    → acepta texto + imagen base64
 *   callGeminiImage()         → genera imágenes con Gemini
 *   callAICached()            → wrapper con cache Redis (TTL configurable)
 *
 * Backward compatible:
 *   callAI()        → misma firma que v3
 *   callGroqStream() → sin cambios
 *   callGeminiStream() → sin cambios
 *   runOrchestrator() → sin cambios
 *   optimizeImagePrompt() → sin cambios
 *   detectVisualType() → sin cambios
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { getRedis } from "./redis"

// ── Types ─────────────────────────────────────────────────────────────────────
export interface Message {
  role: "system" | "user" | "assistant"
  content: string
}

export interface AIResponse {
  text: string
  provider: string
  model: string
}

export interface MultimodalInput {
  text: string
  imageBase64?: string
  mimeType?: "image/jpeg" | "image/png" | "image/webp" | "image/gif" | "application/pdf"
}

export interface ImageGenerationResult {
  base64: string
  mimeType: string
  model: string
}

// ── Modelos ───────────────────────────────────────────────────────────────────
const GEMINI_FLASH       = "gemini-2.5-flash"
const GEMINI_FLASH_LITE  = "gemini-2.5-flash-lite"
const GEMINI_IMAGE_MODEL = "gemini-2.0-flash-preview-image-generation"
const GROQ_MODEL         = "llama-3.3-70b-versatile"

// ══════════════════════════════════════════════════════════════════════════════
// GEMINI — texto
// ══════════════════════════════════════════════════════════════════════════════
async function callGemini(
  messages: Message[],
  maxTokens = 4000,
  lite = false
): Promise<AIResponse> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai")
  const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const modelId = lite ? GEMINI_FLASH_LITE : GEMINI_FLASH
  const model = genai.getGenerativeModel({ model: modelId })

  const system = messages.find(m => m.role === "system")?.content || ""
  const history = messages.filter(m => m.role !== "system")

  const chat = model.startChat({
    systemInstruction: system,
    history: history.slice(0, -1).map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
  })

  const last = history.at(-1)?.content || ""
  const result = await chat.sendMessage(last)
  return { text: result.response.text(), provider: "Gemini", model: modelId }
}

// ── Gemini streaming ──────────────────────────────────────────────────────────
export async function callGeminiStream(
  messages: Message[],
  maxTokens = 4000,
  lite = false
): Promise<ReadableStream> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai")
  const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const modelId = lite ? GEMINI_FLASH_LITE : GEMINI_FLASH
  const model = genai.getGenerativeModel({ model: modelId })

  const system = messages.find(m => m.role === "system")?.content || ""
  const history = messages.filter(m => m.role !== "system")

  const chat = model.startChat({
    systemInstruction: system,
    history: history.slice(0, -1).map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
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

// ── Gemini structured output — JSON garantizado ────────────────────────────────
/**
 * Usa responseSchema de Gemini para obtener JSON estructurado sin try/catch.
 * Ideal para Creator Hub, Orquestador, y cualquier agente que necesite JSON.
 *
 * @param messages   - Historial de mensajes (igual que callAI)
 * @param schema     - JSON Schema del objeto esperado
 * @param maxTokens  - Máximo de tokens
 * @param lite       - Usar modelo lite (más económico)
 */
export async function callGeminiStructured<T = Record<string, unknown>>(
  messages: Message[],
  schema: object,
  maxTokens = 2000,
  lite = false
): Promise<{ data: T; provider: string; model: string }> {
  const { GoogleGenerativeAI, SchemaType } = await import("@google/generative-ai")
  const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const modelId = lite ? GEMINI_FLASH_LITE : GEMINI_FLASH

  const model = genai.getGenerativeModel({
    model: modelId,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema as any,
      maxOutputTokens: maxTokens,
      temperature: 0.4, // más determinista para structured outputs
    },
  })

  const system = messages.find(m => m.role === "system")?.content || ""
  const history = messages.filter(m => m.role !== "system")

  // Para structured outputs, concatenamos system + historial en una sola llamada
  const fullPrompt = system
    ? `${system}\n\n${history.map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n")}`
    : history.map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n")

  const result = await model.generateContent(fullPrompt)
  const raw = result.response.text().trim()

  // Gemini structured outputs garantizan JSON válido, pero hacemos doble check
  let data: T
  try {
    data = JSON.parse(raw) as T
  } catch {
    // Fallback: extraer JSON del texto
    const match = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
    if (!match) throw new Error(`Gemini structured output invalid JSON: ${raw.slice(0, 200)}`)
    data = JSON.parse(match[0]) as T
  }

  return { data, provider: "Gemini", model: modelId }
}

// ── Gemini multimodal — texto + imagen ────────────────────────────────────────
/**
 * Envía texto + imagen a Gemini para análisis visual.
 * Usar para: foto de problema, captura de pantalla, análisis de diagrama.
 */
export async function callGeminiMultimodal(
  input: MultimodalInput,
  systemPrompt?: string,
  maxTokens = 3000
): Promise<AIResponse> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai")
  const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genai.getGenerativeModel({
    model: GEMINI_FLASH,
    ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
  })

  const parts: any[] = [{ text: input.text }]

  if (input.imageBase64 && input.mimeType) {
    parts.unshift({
      inlineData: {
        mimeType: input.mimeType,
        data: input.imageBase64,
      },
    })
  }

  const result = await model.generateContent(parts)
  return {
    text: result.response.text(),
    provider: "Gemini",
    model: GEMINI_FLASH,
  }
}

// ── Gemini Image Generation ───────────────────────────────────────────────────
/**
 * Genera imágenes con Gemini Image model.
 * Devuelve base64 de la imagen generada.
 */
export async function callGeminiImage(
  prompt: string,
  opts: { width?: number; height?: number } = {}
): Promise<ImageGenerationResult> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai")
  const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

  const model = genai.getGenerativeModel({
    model: GEMINI_IMAGE_MODEL,
    generationConfig: {
      // @ts-ignore — responseModalities es parte de la API de imagen
      responseModalities: ["Text", "Image"],
    },
  })

  const result = await model.generateContent(prompt)
  const response = result.response

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return {
        base64: part.inlineData.data,
        mimeType: part.inlineData.mimeType || "image/png",
        model: GEMINI_IMAGE_MODEL,
      }
    }
  }

  throw new Error("Gemini Image: no image returned in response")
}

// ══════════════════════════════════════════════════════════════════════════════
// GROQ — streaming ultra-rápido (sin cambios vs v3)
// ══════════════════════════════════════════════════════════════════════════════
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

export async function callGroqStream(
  messages: Message[],
  maxTokens = 3000
): Promise<ReadableStream> {
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

// ══════════════════════════════════════════════════════════════════════════════
// OPENROUTER — fallback 2
// ══════════════════════════════════════════════════════════════════════════════
async function callOpenRouter(
  messages: Message[],
  maxTokens = 2000,
  preferredModel?: string
): Promise<AIResponse> {
  const models = preferredModel
    ? [preferredModel, "openai/gpt-4o-mini", "meta-llama/llama-3.3-70b-instruct:free"]
    : [
        "openai/gpt-4o-mini",               // 1° — rápido, económico, muy buena calidad
        "anthropic/claude-3-haiku",          // 2° — rápido, excelente para texto largo
        "openai/gpt-4o",                     // 3° — máxima calidad OpenAI
        "anthropic/claude-3.5-sonnet",       // 4° — máxima calidad Anthropic
        "meta-llama/llama-3.3-70b-instruct:free", // 5° — gratuito, fallback
        "google/gemma-2-27b-it:free",        // 6° — gratuito, fallback
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

// ══════════════════════════════════════════════════════════════════════════════
// TOGETHER AI — fallback 3
// ══════════════════════════════════════════════════════════════════════════════
async function callTogetherAI(
  messages: Message[],
  maxTokens = 2000
): Promise<AIResponse> {
  const model = "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo"
  const res = await fetch("https://api.together.xyz/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.TOGETHER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
  })
  if (!res.ok) throw new Error(`Together AI error: ${res.status}`)
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error("Together AI: empty response")
  return { text, provider: "TogetherAI", model }
}

// ══════════════════════════════════════════════════════════════════════════════
// ROUTER PRINCIPAL — v4 (backward compatible con v3)
// ══════════════════════════════════════════════════════════════════════════════
/**
 * callAI() — misma firma exacta que ai-router.ts v3.
 *
 * Cambios v4:
 *   - Gemini es ahora el proveedor por defecto (preferProvider: undefined)
 *   - Fallback chain actualizado: Gemini → Groq → OpenRouter → TogetherAI
 *   - "gemini-lite" usa GEMINI_FLASH_LITE
 *
 * Migración: cambiar el import de "@/lib/ai-router" a "@/lib/ai-router-v4"
 * en cada agente. La firma callAI() es idéntica.
 */
export async function callAI(
  messages: Message[],
  options: {
    maxTokens?: number
    preferProvider?: "groq" | "openrouter" | "gemini" | "gemini-lite"
    openrouterModel?: string  // modelo específico de OpenRouter (ej: "openai/gpt-4o")
  } = {}
): Promise<AIResponse> {
  const { maxTokens = 2000, preferProvider, openrouterModel } = options

  // gemini-lite → Gemini Flash Lite
  if (preferProvider === "gemini-lite") {
    try {
      return await callGemini(messages, maxTokens, true)
    } catch (e: any) {
      console.warn("[AI Router v4] gemini-lite failed, fallback to flash:", e.message)
      try { return await callGemini(messages, maxTokens, false) } catch {}
      try { return await callGroq(messages, maxTokens) } catch {}
      throw new Error("All providers failed for gemini-lite task")
    }
  }

  // Orden de providers según preferencia
  type ProviderDef = { name: string; fn: () => Promise<AIResponse>; enabled: boolean }
  const providers: ProviderDef[] = [
    { name: "gemini",     fn: () => callGemini(messages, maxTokens, false),              enabled: !!process.env.GEMINI_API_KEY },
    { name: "groq",       fn: () => callGroq(messages, maxTokens),                       enabled: !!process.env.GROQ_API_KEY },
    { name: "openrouter", fn: () => callOpenRouter(messages, maxTokens, openrouterModel), enabled: !!process.env.OPENROUTER_API_KEY },
    { name: "together",   fn: () => callTogetherAI(messages, maxTokens),                 enabled: !!process.env.TOGETHER_API_KEY },
  ]

  if (preferProvider) {
    providers.sort((a, b) =>
      a.name === preferProvider ? -1 : b.name === preferProvider ? 1 : 0
    )
  }

  for (const p of providers) {
    if (!p.enabled) continue
    try { return await p.fn() } catch (e: any) {
      console.warn(`[AI Router v4] ${p.name} failed:`, e.message)
    }
  }

  throw new Error("All AI providers failed")
}

// ══════════════════════════════════════════════════════════════════════════════
// CACHE LAYER — callAICached
// ══════════════════════════════════════════════════════════════════════════════
/**
 * Wrapper de callAI con cache en Redis (Upstash).
 * Si Redis no está configurado, pasa directo a callAI sin error.
 *
 * @param cacheKey  - Clave única para esta consulta (ej: `investigador:${topic}`)
 * @param ttl       - Tiempo de vida en segundos (default: 300 = 5 minutos)
 */
export async function callAICached(
  messages: Message[],
  options: Parameters<typeof callAI>[1] & { cacheKey: string; ttl?: number }
): Promise<AIResponse> {
  const { cacheKey, ttl = 300, ...aiOptions } = options
  const redis = getRedis()

  if (redis) {
    try {
      const cached = await redis.get<AIResponse>(cacheKey)
      if (cached) {
        console.log(`[AI Cache] HIT: ${cacheKey}`)
        return { ...cached, provider: `${cached.provider} (cached)` }
      }
    } catch (e: any) {
      console.warn("[AI Cache] Redis get failed:", e.message)
    }
  }

  const result = await callAI(messages, aiOptions)

  if (redis) {
    try {
      await redis.set(cacheKey, result, { ex: ttl })
      console.log(`[AI Cache] SET: ${cacheKey} (TTL: ${ttl}s)`)
    } catch (e: any) {
      console.warn("[AI Cache] Redis set failed:", e.message)
    }
  }

  return result
}

// ══════════════════════════════════════════════════════════════════════════════
// ORQUESTADOR POTENCIADO — 6 Agentes (igual que v3, ahora usa Gemini como primario)
// ══════════════════════════════════════════════════════════════════════════════
interface OrchestratorInput {
  question: string
  topic: string
  studentHistory?: string
  longMemory?: string
  studentLevel?: "básico" | "intermedio" | "avanzado"
  studyMode?: "normal" | "socratic" | "evaluation" | "collab"
}

interface OrchestratorResult {
  enrichedContext: string
  pedagogyStyle: string
  suggestedVisual: "image" | "chart" | "mermaid" | "table" | "none"
  agentsUsed: string[]
}

export async function runOrchestrator(
  input: OrchestratorInput
): Promise<OrchestratorResult> {
  const {
    question,
    topic,
    studentHistory = "",
    longMemory = "",
    studentLevel = "intermedio",
    studyMode = "normal",
  } = input

  // Agentes 1-3 en paralelo
  const [contextoRes, diagnoseRes, investigadorRes] = await Promise.allSettled([
    callAI([
      { role: "system", content: `Eres AGT-Contexto. Analizas el historial de aprendizaje de un alumno y extraes lo más relevante para responder su pregunta actual.\nResponde en máximo 3 oraciones concisas. No repitas la pregunta. Solo contexto útil.` },
      { role: "user",   content: `Pregunta actual: "${question}"\nTema de estudio: ${topic}\nHistorial reciente: ${studentHistory.slice(0, 1500) || "Sin historial"}\nMemoria larga del alumno: ${longMemory.slice(0, 1000) || "Sin memoria previa"}\n¿Qué sabe el alumno sobre esto? ¿Hay brechas o conceptos pendientes?` },
    ], { maxTokens: 400, preferProvider: "gemini-lite" }),

    callAI([
      { role: "system", content: `Eres AGT-Diagnose. Experto en diagnóstico pedagógico.\nIdentifica: (1) nivel real implícito, (2) conceptos previos necesarios, (3) tipo de dificultad cognitiva.\nFormato: NIVEL: x | PREREQUISITOS: a, b | TIPO_DIFICULTAD: conceptual/procedimental/aplicación` },
      { role: "user",   content: `Nivel declarado: ${studentLevel}\nPregunta: "${question}"\nTema: ${topic}\nModo de estudio: ${studyMode}` },
    ], { maxTokens: 300, preferProvider: "gemini-lite" }),

    callAICached([
      { role: "system", content: `Eres AGT-Investigador. Aportas contexto técnico preciso, datos verificados y analogías pedagógicas de alto valor.\nMáximo 4 oraciones. Solo información de alto valor pedagógico.` },
      { role: "user",   content: `Pregunta del alumno: "${question}"\nTema: ${topic}\nAporta el contexto técnico y datos clave más relevantes:` },
    ], { maxTokens: 500, preferProvider: "gemini", cacheKey: `orch-inv:${topic}:${question.slice(0,60)}`, ttl: 300 }),
  ])

  const contexto     = contextoRes.status     === "fulfilled" ? contextoRes.value.text     : ""
  const diagnostico  = diagnoseRes.status     === "fulfilled" ? diagnoseRes.value.text     : ""
  const investigacion = investigadorRes.status === "fulfilled" ? investigadorRes.value.text : ""

  // Agente 4: Síntesis
  const agentSynthesize = await callAI([
    { role: "system", content: `Eres AGT-Synthesize. Produces un briefing pedagógico integrado para el tutor IA.\nResponde con un briefing claro en máximo 5 oraciones. Incluye: qué sabe el alumno, qué necesita, qué contexto técnico es relevante.` },
    { role: "user",   content: `PREGUNTA: "${question}"\nTEMA: ${topic}\n\n─── CONTEXTO-ALUMNO ───\n${contexto}\n\n─── DIAGNÓSTICO ───\n${diagnostico}\n\n─── INVESTIGACIÓN ───\n${investigacion}\n\nBriefing pedagógico para el tutor:` },
  ], { maxTokens: 600, preferProvider: "gemini" })

  // Agente 5: Pedagogía
  const agentPedagogia = await callAI([
    { role: "system", content: `Eres AGT-Pedagogy. Experto en didáctica.\nDecide: estilo (directo|socrático|analógico|paso-a-paso|visual), tono (formal|conversacional|motivador|técnico), visual (image|chart|mermaid|table|none), consejo corto para el tutor.\nResponde SOLO con este JSON: {"estilo":"...","tono":"...","visual":"...","consejo":"..."}` },
    { role: "user",   content: `Briefing: ${agentSynthesize.text}\nModo: ${studyMode}\nNivel: ${studentLevel}\nPregunta: "${question}"` },
  ], { maxTokens: 200, preferProvider: "gemini-lite" })

  let pedagogyDecision = { estilo: "directo", tono: "conversacional", visual: "none" as const, consejo: "" }
  try {
    const raw = agentPedagogia.text.replace(/```json|```/g, "").trim()
    pedagogyDecision = { ...pedagogyDecision, ...JSON.parse(raw) }
  } catch { /* mantener defaults */ }

  return {
    enrichedContext: `${agentSynthesize.text}\n\n[CONSEJO PEDAGÓGICO]: ${pedagogyDecision.consejo}`,
    pedagogyStyle: `${pedagogyDecision.estilo} | ${pedagogyDecision.tono}`,
    suggestedVisual: pedagogyDecision.visual as OrchestratorResult["suggestedVisual"],
    agentsUsed: ["AGT-Contexto", "AGT-Diagnose", "AGT-Investigador", "AGT-Synthesize", "AGT-Pedagogy"],
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// OPTIMIZER DE PROMPTS PARA IMÁGENES (igual que v3)
// ══════════════════════════════════════════════════════════════════════════════
export async function optimizeImagePrompt(
  userPrompt: string,
  style: string,
  styleKeywords: string,
  educationalContext?: string
): Promise<string> {
  const result = await callAI([
    { role: "system", content: `You are an expert prompt engineer for AI image generation.\nTransform user descriptions into highly detailed, vivid English prompts.\nCRITICAL: Keep the user's EXACT subject. Add style, lighting, composition, quality keywords.\nOutput ONLY the optimized prompt, no explanations, no quotes.` },
    { role: "user",   content: `User request: "${userPrompt}"\nStyle: ${style} — keywords: ${styleKeywords}\n${educationalContext ? `Educational context: "${educationalContext.slice(0, 400)}"` : ""}\nOptimized prompt:` },
  ], { maxTokens: 400, preferProvider: "gemini-lite" })
  return result.text.trim().replace(/^[\"']|[\"']$/g, "")
}

// ══════════════════════════════════════════════════════════════════════════════
// DETECTOR DE VISUAL INTELIGENTE — AGT-AIm (igual que v3)
// ══════════════════════════════════════════════════════════════════════════════
export async function detectVisualType(
  context: string,
  topic: string
): Promise<{ type: string; title: string; imagePrompt?: string; content?: string; caption: string }> {
  try {
    const result = await callAI([
      { role: "system", content: `Eres AIm v2, el agente visual de EduAI. Analizas texto educativo y decides el visual más efectivo.\nREGLAS: valores/datos/porcentajes → "chart" | procesos/pasos/flujos → "mermaid" | comparaciones → "table" | conceptos físicos/visualizables → "image" | solo conversacional → "none"\nPara "image": prompt educativo en inglés 15-25 palabras.\nPara "mermaid": flowchart TD, máximo 7 nodos.\nPara "chart": JSON con type/data/labels/datasets.\nPara "table": markdown, máximo 4col × 6fil.\nResponde SOLO con JSON: {"type":"...","title":"...","imagePrompt":"...","content":"...","caption":"..."}` },
      { role: "user",   content: `Tema: ${topic}\nTexto educativo:\n"${context.slice(0, 2000)}"\n\n¿Qué visual añade más valor?` },
    ], { maxTokens: 600, preferProvider: "gemini-lite" })
    const raw = result.text.replace(/```json|```/g, "").trim()
    return JSON.parse(raw)
  } catch {
    return { type: "none", title: "", caption: "" }
  }
}
