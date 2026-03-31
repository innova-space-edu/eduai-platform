/**
 * lib/ai-router-v4.ts
 * AI Router v4 — actualizado con separación de keys para texto / imagen / prompt optimizer
 */

import { getRedis } from "./redis"
import {
  basicPrompt,
  errMsg,
  getGeminiImageKeys,
  getGeminiTextKeys,
  getOpenRouterKeys,
  getPromptOptimizerKeys,
  getTogetherKeys,
  pickFromPool,
} from "./image-config"

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

export type EducadorTask =
  | "parvularia_suggestion"
  | "planning_short"
  | "planning_full"

export function getEducadorModelStrategy(task: EducadorTask): {
  maxTokens: number
  preferProvider?: "groq" | "openrouter" | "gemini" | "gemini-lite"
  openrouterModel?: string
} {
  switch (task) {
    case "parvularia_suggestion":
      return {
        maxTokens: 2200,
        preferProvider: "gemini-lite",
        openrouterModel: "openai/gpt-4o-mini",
      }

    case "planning_short":
      return {
        maxTokens: 3200,
        preferProvider: "groq",
        openrouterModel: "openai/gpt-4o-mini",
      }

    case "planning_full":
    default:
      return {
        maxTokens: 8000,
        preferProvider: "gemini",
        openrouterModel: "openai/gpt-4o",
      }
  }
}

const GEMINI_FLASH = process.env.GEMINI_TEXT_MODEL_PRIMARY || "gemini-2.5-flash"
const GEMINI_FLASH_LITE = process.env.GEMINI_TEXT_MODEL_LITE || "gemini-2.5-flash-lite"
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL_PRIMARY || "gemini-2.0-flash-preview-image-generation"
const GROQ_MODEL = process.env.GROQ_TEXT_MODEL || "llama-3.3-70b-versatile"

function getGeminiTextKey(): string {
  const key = pickFromPool(getGeminiTextKeys())
  if (!key) throw new Error("No Gemini text key configured")
  return key
}

function getGeminiImageKey(): string {
  const key = pickFromPool(getGeminiImageKeys())
  if (!key) throw new Error("No Gemini image key configured")
  return key
}

function getGeminiPromptKey(seed?: string): string {
  const key = pickFromPool(getPromptOptimizerKeys(), seed)
  if (!key) throw new Error("No Gemini prompt optimizer key configured")
  return key
}

function getOpenRouterKey(seed?: string): string {
  const key = pickFromPool(getOpenRouterKeys(), seed)
  if (!key) throw new Error("No OpenRouter key configured")
  return key
}

function getTogetherKey(seed?: string): string {
  const key = pickFromPool(getTogetherKeys(), seed)
  if (!key) throw new Error("No Together key configured")
  return key
}

// ══════════════════════════════════════════════════════════════════════════════
// GEMINI — texto
// ══════════════════════════════════════════════════════════════════════════════
async function callGemini(
  messages: Message[],
  maxTokens = 4000,
  lite = false
): Promise<AIResponse> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai")
  const genai = new GoogleGenerativeAI(getGeminiTextKey())
  const modelId = lite ? GEMINI_FLASH_LITE : GEMINI_FLASH
  const model = genai.getGenerativeModel({ model: modelId })

  const system = messages.find((m) => m.role === "system")?.content || ""
  const history = messages.filter((m) => m.role !== "system")

  const chat = model.startChat({
    systemInstruction: system,
    history: history.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
  })

  const last = history.at(-1)?.content || ""
  const result = await chat.sendMessage(last)

  return {
    text: result.response.text(),
    provider: "Gemini",
    model: modelId,
  }
}

export async function callGeminiStream(
  messages: Message[],
  maxTokens = 4000,
  lite = false
): Promise<ReadableStream> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai")
  const genai = new GoogleGenerativeAI(getGeminiTextKey())
  const modelId = lite ? GEMINI_FLASH_LITE : GEMINI_FLASH
  const model = genai.getGenerativeModel({ model: modelId })

  const system = messages.find((m) => m.role === "system")?.content || ""
  const history = messages.filter((m) => m.role !== "system")

  const chat = model.startChat({
    systemInstruction: system,
    history: history.slice(0, -1).map((m) => ({
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
        if (text) {
          controller.enqueue(new TextEncoder().encode(text))
        }
      }
      controller.close()
    },
  })
}

export async function callGeminiStructured<T = Record<string, unknown>>(
  messages: Message[],
  schema: object,
  maxTokens = 2000,
  lite = false
): Promise<{ data: T; provider: string; model: string }> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai")
  const genai = new GoogleGenerativeAI(getGeminiTextKey())
  const modelId = lite ? GEMINI_FLASH_LITE : GEMINI_FLASH

  const model = genai.getGenerativeModel({
    model: modelId,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema as any,
      maxOutputTokens: maxTokens,
      temperature: 0.4,
    },
  })

  const system = messages.find((m) => m.role === "system")?.content || ""
  const history = messages.filter((m) => m.role !== "system")

  const fullPrompt = system
    ? `${system}\n\n${history
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n")}`
    : history
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n")

  const result = await model.generateContent(fullPrompt)
  const raw = result.response.text().trim()

  let data: T
  try {
    data = JSON.parse(raw) as T
  } catch {
    const match = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
    if (!match) throw new Error(`Gemini structured output invalid JSON: ${raw.slice(0, 200)}`)
    data = JSON.parse(match[0]) as T
  }

  return { data, provider: "Gemini", model: modelId }
}

export async function callGeminiMultimodal(
  input: MultimodalInput,
  systemPrompt?: string,
  maxTokens = 3000
): Promise<AIResponse> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai")
  const genai = new GoogleGenerativeAI(getGeminiTextKey())
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

export async function callGeminiImage(
  prompt: string,
  _opts: { width?: number; height?: number } = {}
): Promise<ImageGenerationResult> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai")
  const genai = new GoogleGenerativeAI(getGeminiImageKey())

  const model = genai.getGenerativeModel({
    model: GEMINI_IMAGE_MODEL,
    generationConfig: {
      // @ts-ignore
      responseModalities: ["Text", "Image"],
    },
  })

  const result = await model.generateContent(prompt)
  const response = result.response

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData?.data) {
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
// GROQ
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
// OPENROUTER
// ══════════════════════════════════════════════════════════════════════════════
async function callOpenRouter(
  messages: Message[],
  maxTokens = 2000,
  preferredModel?: string
): Promise<AIResponse> {
  const models = preferredModel
    ? [preferredModel, "openai/gpt-4o-mini", "meta-llama/llama-3.3-70b-instruct:free"]
    : [
        "openai/gpt-4o-mini",
        "anthropic/claude-3-haiku",
        "openai/gpt-4o",
        "anthropic/claude-3.5-sonnet",
        "meta-llama/llama-3.3-70b-instruct:free",
        "google/gemma-2-27b-it:free",
      ]

  const apiKey = getOpenRouterKey(JSON.stringify({ messages, preferredModel, maxTokens }))

  for (const model of models) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_REFERER || "https://eduai-platform-virid.vercel.app",
        "X-Title": process.env.OPENROUTER_APP_TITLE || "EduAI Platform",
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
      }),
    })

    if (!res.ok) continue

    const data = await res.json()
    const text = data?.choices?.[0]?.message?.content
    if (text) {
      return {
        text,
        provider: "OpenRouter",
        model,
      }
    }
  }

  throw new Error("OpenRouter: all models failed")
}

// ══════════════════════════════════════════════════════════════════════════════
// TOGETHER AI
// ══════════════════════════════════════════════════════════════════════════════
async function callTogetherAI(
  messages: Message[],
  maxTokens = 2000
): Promise<AIResponse> {
  const model = process.env.TOGETHER_TEXT_MODEL || "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo"
  const apiKey = getTogetherKey(JSON.stringify({ messages, maxTokens }))

  const res = await fetch("https://api.together.xyz/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
    }),
  })

  if (!res.ok) throw new Error(`Together AI error: ${res.status}`)

  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content
  if (!text) throw new Error("Together AI: empty response")

  return {
    text,
    provider: "TogetherAI",
    model,
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ROUTER PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export async function callAI(
  messages: Message[],
  options: {
    maxTokens?: number
    preferProvider?: "groq" | "openrouter" | "gemini" | "gemini-lite"
    openrouterModel?: string
  } = {}
): Promise<AIResponse> {
  const { maxTokens = 2000, preferProvider, openrouterModel } = options

  if (preferProvider === "gemini-lite") {
    try {
      return await callGemini(messages, maxTokens, true)
    } catch (e: any) {
      console.warn("[AI Router v4] gemini-lite failed, fallback to flash:", e?.message || String(e))
      try {
        return await callGemini(messages, maxTokens, false)
      } catch {}
      try {
        return await callGroq(messages, maxTokens)
      } catch {}
      throw new Error("All providers failed for gemini-lite task")
    }
  }

  type ProviderDef = {
    name: string
    fn: () => Promise<AIResponse>
    enabled: boolean
  }

  const providers: ProviderDef[] = [
    {
      name: "gemini",
      fn: () => callGemini(messages, maxTokens, false),
      enabled: getGeminiTextKeys().length > 0,
    },
    {
      name: "groq",
      fn: () => callGroq(messages, maxTokens),
      enabled: !!process.env.GROQ_API_KEY,
    },
    {
      name: "openrouter",
      fn: () => callOpenRouter(messages, maxTokens, openrouterModel),
      enabled: getOpenRouterKeys().length > 0,
    },
    {
      name: "together",
      fn: () => callTogetherAI(messages, maxTokens),
      enabled: getTogetherKeys().length > 0,
    },
  ]

  if (preferProvider) {
    providers.sort((a, b) => {
      if (a.name === preferProvider) return -1
      if (b.name === preferProvider) return 1
      return 0
    })
  }

  for (const provider of providers) {
    if (!provider.enabled) continue
    try {
      return await provider.fn()
    } catch (e: any) {
      console.warn(`[AI Router v4] ${provider.name} failed:`, e?.message || String(e))
    }
  }

  throw new Error("All AI providers failed")
}

// ══════════════════════════════════════════════════════════════════════════════
// CACHE LAYER
// ══════════════════════════════════════════════════════════════════════════════
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
        return { ...cached, provider: `${cached.provider} (cached)` }
      }
    } catch (e: any) {
      console.warn("[AI Cache] Redis get failed:", e?.message || String(e))
    }
  }

  const result = await callAI(messages, aiOptions)

  if (redis) {
    try {
      await redis.set(cacheKey, result, { ex: ttl })
    } catch (e: any) {
      console.warn("[AI Cache] Redis set failed:", e?.message || String(e))
    }
  }

  return result
}

// ══════════════════════════════════════════════════════════════════════════════
// ORQUESTADOR
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

  const [contextoRes, diagnoseRes, investigadorRes] = await Promise.allSettled([
    callAI(
      [
        {
          role: "system",
          content:
            "Eres AGT-Contexto. Analizas el historial de aprendizaje de un alumno y extraes lo más relevante para responder su pregunta actual. Responde en máximo 3 oraciones concisas. No repitas la pregunta. Solo contexto útil.",
        },
        {
          role: "user",
          content: `Pregunta actual: "${question}"\nTema de estudio: ${topic}\nHistorial reciente: ${studentHistory.slice(0, 1500) || "Sin historial"}\nMemoria larga del alumno: ${longMemory.slice(0, 1000) || "Sin memoria previa"}\n¿Qué sabe el alumno sobre esto? ¿Hay brechas o conceptos pendientes?`,
        },
      ],
      { maxTokens: 400, preferProvider: "gemini-lite" }
    ),

    callAI(
      [
        {
          role: "system",
          content:
            'Eres AGT-Diagnose. Experto en diagnóstico pedagógico. Identifica: (1) nivel real implícito, (2) conceptos previos necesarios, (3) tipo de dificultad cognitiva. Formato: NIVEL: x | PREREQUISITOS: a, b | TIPO_DIFICULTAD: conceptual/procedimental/aplicación',
        },
        {
          role: "user",
          content: `Nivel declarado: ${studentLevel}\nPregunta: "${question}"\nTema: ${topic}\nModo de estudio: ${studyMode}`,
        },
      ],
      { maxTokens: 300, preferProvider: "gemini-lite" }
    ),

    callAICached(
      [
        {
          role: "system",
          content:
            "Eres AGT-Investigador. Aportas contexto técnico preciso, datos verificados y analogías pedagógicas de alto valor. Máximo 4 oraciones. Solo información de alto valor pedagógico.",
        },
        {
          role: "user",
          content: `Pregunta del alumno: "${question}"\nTema: ${topic}\nAporta el contexto técnico y datos clave más relevantes:`,
        },
      ],
      {
        maxTokens: 500,
        preferProvider: "gemini",
        cacheKey: `orch-inv:${topic}:${question.slice(0, 60)}`,
        ttl: 300,
      }
    ),
  ])

  const contexto = contextoRes.status === "fulfilled" ? contextoRes.value.text : ""
  const diagnostico = diagnoseRes.status === "fulfilled" ? diagnoseRes.value.text : ""
  const investigacion = investigadorRes.status === "fulfilled" ? investigadorRes.value.text : ""

  const agentSynthesize = await callAI(
    [
      {
        role: "system",
        content:
          "Eres AGT-Synthesize. Produces un briefing pedagógico integrado para el tutor IA. Responde con un briefing claro en máximo 5 oraciones. Incluye: qué sabe el alumno, qué necesita, qué contexto técnico es relevante.",
      },
      {
        role: "user",
        content: `PREGUNTA: "${question}"\nTEMA: ${topic}\n\n─── CONTEXTO-ALUMNO ───\n${contexto}\n\n─── DIAGNÓSTICO ───\n${diagnostico}\n\n─── INVESTIGACIÓN ───\n${investigacion}\n\nBriefing pedagógico para el tutor:`,
      },
    ],
    { maxTokens: 600, preferProvider: "gemini" }
  )

  const agentPedagogia = await callAI(
    [
      {
        role: "system",
        content:
          'Eres AGT-Pedagogy. Experto en didáctica. Decide: estilo (directo|socrático|analógico|paso-a-paso|visual), tono (formal|conversacional|motivador|técnico), visual (image|chart|mermaid|table|none), consejo corto para el tutor. Responde SOLO con este JSON: {"estilo":"...","tono":"...","visual":"...","consejo":"..."}',
      },
      {
        role: "user",
        content: `Briefing: ${agentSynthesize.text}\nModo: ${studyMode}\nNivel: ${studentLevel}\nPregunta: "${question}"`,
      },
    ],
    { maxTokens: 200, preferProvider: "gemini-lite" }
  )

  let pedagogyDecision = {
    estilo: "directo",
    tono: "conversacional",
    visual: "none" as const,
    consejo: "",
  }

  try {
    const raw = agentPedagogia.text.replace(/```json|```/g, "").trim()
    pedagogyDecision = { ...pedagogyDecision, ...JSON.parse(raw) }
  } catch {}

  return {
    enrichedContext: `${agentSynthesize.text}\n\n[CONSEJO PEDAGÓGICO]: ${pedagogyDecision.consejo}`,
    pedagogyStyle: `${pedagogyDecision.estilo} | ${pedagogyDecision.tono}`,
    suggestedVisual: pedagogyDecision.visual as OrchestratorResult["suggestedVisual"],
    agentsUsed: [
      "AGT-Contexto",
      "AGT-Diagnose",
      "AGT-Investigador",
      "AGT-Synthesize",
      "AGT-Pedagogy",
    ],
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// OPTIMIZER DE PROMPTS PARA IMÁGENES
// ══════════════════════════════════════════════════════════════════════════════
export async function optimizeImagePrompt(
  userPrompt: string,
  style: string,
  styleKeywords: string,
  educationalContext?: string
): Promise<string> {
  const promptKey = getGeminiPromptKey(`${userPrompt}:${style}:${educationalContext || ""}`)

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_FLASH_LITE}:generateContent?key=${promptKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [
              {
                text: "You are an expert prompt engineer for AI image generation. Transform user descriptions into highly detailed, vivid English prompts. CRITICAL: Keep the user's exact subject. Add style, lighting, composition, quality keywords. Output ONLY the optimized prompt, no explanations, no quotes.",
              },
            ],
          },
          contents: [
            {
              parts: [
                {
                  text: `User request: "${userPrompt}"\nStyle: ${style} — keywords: ${styleKeywords}\n${educationalContext ? `Educational context: "${educationalContext.slice(0, 400)}"` : ""}\nOptimized prompt:`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 400,
          },
        }),
        signal: AbortSignal.timeout(12000),
      }
    )

    if (!res.ok) return basicPrompt(userPrompt, style)

    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()

    if (!text) return basicPrompt(userPrompt, style)
    return text.replace(/^[\"']|[\"']$/g, "")
  } catch (e) {
    console.warn("[AI Router v4] optimizeImagePrompt failed:", errMsg(e))
    return basicPrompt(userPrompt, style)
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// DETECTOR DE VISUAL
// ══════════════════════════════════════════════════════════════════════════════
export async function detectVisualType(
  context: string,
  topic: string
): Promise<{ type: string; title: string; imagePrompt?: string; content?: string; caption: string }> {
  try {
    const result = await callAI(
      [
        {
          role: "system",
          content:
            'Eres AIm v2, el agente visual de EduAI. Analizas texto educativo y decides el visual más efectivo. REGLAS: valores/datos/porcentajes → "chart" | procesos/pasos/flujos → "mermaid" | comparaciones → "table" | conceptos físicos/visualizables → "image" | solo conversacional → "none". Para "image": prompt educativo en inglés 15-25 palabras. Para "mermaid": flowchart TD, máximo 7 nodos. Para "chart": JSON con type/data/labels/datasets. Para "table": markdown, máximo 4col × 6fil. Responde SOLO con JSON: {"type":"...","title":"...","imagePrompt":"...","content":"...","caption":"..."}',
        },
        {
          role: "user",
          content: `Tema: ${topic}\nTexto educativo:\n"${context.slice(0, 2000)}"\n\n¿Qué visual añade más valor?`,
        },
      ],
      { maxTokens: 600, preferProvider: "gemini-lite" }
    )

    const raw = result.text.replace(/```json|```/g, "").trim()
    return JSON.parse(raw)
  } catch {
    return { type: "none", title: "", caption: "" }
  }
}
