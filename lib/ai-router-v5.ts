/**
 * lib/ai-router-v5.ts
 * AI Router v5 — Todos los proveedores gratuitos 2026
 *
 * PROVEEDORES GRATUITOS (sin tarjeta, indefinidos):
 * ─────────────────────────────────────────────────
 * 1. Groq          → Llama 3.3 70B / Llama 4 Scout / Kimi K2 / Qwen3 32B
 *                    30 RPM gratis · sub-100ms latencia · sin expiración
 * 2. Gemini Flash  → Gemini 2.5 Flash · 1,500 req/día · 1M contexto
 * 3. OpenRouter    → moonshotai/kimi-k2:free · deepseek/deepseek-r1:free
 *                    qwen/qwen3-32b:free · meta-llama/llama-3.3-70b-instruct:free
 * 4. Cerebras      → Llama 3.3 70B · 1M tokens/día · 2,000 tok/seg
 *
 * ESTRATEGIA DE ROUTING:
 * ─────────────────────
 * "fast"         → Groq Llama 3.3 70B (sub-100ms)
 * "coding"       → Kimi K2 vía Groq (1T params, líder en coding/agentic)
 * "reasoning"    → Kimi K2 vía OpenRouter free (131K contexto, reasoning avanzado)
 * "long_context" → Gemini Flash (1M contexto, multimodal)
 * "vision"       → Gemini Flash (multimodal, gratis)
 * "batch"        → Cerebras (1M tokens/día, máximo throughput)
 * "general"      → Gemini Flash → Groq → Kimi K2 → OpenRouter
 *
 * ENV VARS NECESARIAS:
 * ────────────────────
 * GROQ_API_KEY        (existente)
 * GEMINI_API_KEY      (existente)
 * OPENROUTER_API_KEY  (existente) ← usado para Kimi K2 free
 * CEREBRAS_API_KEY    (NUEVO — gratis en cerebras.ai)
 */

// ── Re-exportar todo de v4 para compatibilidad ──────────────────────────────
export type {
  Message,
  AIResponse,
  MultimodalInput,
  ImageGenerationResult,
  EducadorTask,
} from "./ai-router-v4"

export {
  callGeminiStream,
  callGeminiStructured,
  callGeminiMultimodal,
  callGeminiImage,
  callGroqStream,
  callAI,
  callAICached,
  runOrchestrator,
  optimizeImagePrompt,
  detectVisualType,
  getEducadorModelStrategy,
} from "./ai-router-v4"

import type { Message, AIResponse } from "./ai-router-v4"

// ── Tipos nuevos v5 ───────────────────────────────────────────────────────────

export type AITaskType =
  | "fast"         // Respuesta inmediata, <1s → Groq
  | "coding"       // Código, refactor, debugging → Kimi K2
  | "reasoning"    // Razonamiento complejo → Kimi K2 Thinking / DeepSeek R1
  | "long_context" // Documentos largos, +50K tokens → Gemini Flash
  | "vision"       // Imágenes, diagramas → Gemini Flash
  | "batch"        // Muchas requests paralelas → Cerebras
  | "general"      // Uso general → cadena completa

export interface AIv5Options {
  task?: AITaskType
  maxTokens?: number
  systemPrompt?: string
  /** Forzar un proveedor específico (para testing) */
  forceProvider?: "groq" | "gemini" | "openrouter" | "cerebras"
  /** Modelos OpenRouter alternativos */
  openrouterModel?: string
}

export interface AIv5Response extends AIResponse {
  taskType: AITaskType
  latencyMs?: number
}

// ── Modelos por proveedor ─────────────────────────────────────────────────────

/** Groq: ultra rápido, gratis, sin tarjeta */
const GROQ_MODELS = {
  llama70b:  "llama-3.3-70b-versatile",     // Modelo principal, 30 RPM
  llama4:    "llama-4-scout-17b-16e-instruct", // Más nuevo, más rápido
  kimi:      "moonshotai/kimi-k2",           // Kimi K2 en Groq (si disponible)
  qwen3:     "qwen-qwq-32b",                // Razonamiento con Qwen
  llama8b:   "llama-3.1-8b-instant",        // Respuestas instantáneas
}

/** Gemini: 1,500 req/día, 1M contexto, multimodal */
const GEMINI_MODELS = {
  flash:     process.env.GEMINI_TEXT_MODEL_PRIMARY  || "gemini-2.5-flash",
  flashLite: process.env.GEMINI_TEXT_MODEL_LITE     || "gemini-2.5-flash-lite",
}

/** OpenRouter: modelos :free gratuitos indefinidos */
const OR_FREE_MODELS = {
  kimiK2:    "moonshotai/kimi-k2:free",                 // 1T params, 131K ctx
  deepseekR1:"deepseek/deepseek-r1:free",               // Razonamiento avanzado
  qwen3:     "qwen/qwen3-32b:free",                     // Chino/multilingüe
  llama70b:  "meta-llama/llama-3.3-70b-instruct:free",  // Llama gratis
  geminiExp: "google/gemini-2.0-flash-exp:free",        // Gemini experimental
}

/** Cerebras: 1M tokens/día, 2000 tok/seg */
const CEREBRAS_MODELS = {
  llama70b: "llama3.3-70b",
  llama8b:  "llama3.1-8b",
}

// ── Llamadas a proveedores ────────────────────────────────────────────────────

async function callGroqV5(
  messages: Message[],
  model: string,
  maxTokens = 2000
): Promise<AIv5Response> {
  const Groq = (await import("groq-sdk")).default
  const groq  = new Groq({ apiKey: process.env.GROQ_API_KEY })

  const res = await groq.chat.completions.create({
    model,
    messages: messages as Parameters<typeof groq.chat.completions.create>[0]["messages"],
    max_tokens: maxTokens,
    temperature: 0.7,
  })

  const text = res.choices[0]?.message?.content ?? ""
  return { text, provider: "Groq", model, taskType: "general" }
}

async function callGeminiV5(
  messages: Message[],
  model: string,
  maxTokens = 2000
): Promise<AIv5Response> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error("GEMINI_API_KEY no configurada")

  const system = messages.find(m => m.role === "system")
  const userMessages = messages.filter(m => m.role !== "system")

  const body: Record<string, unknown> = {
    contents: userMessages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
  }

  if (system) {
    body.systemInstruction = { parts: [{ text: system.content }] }
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const res  = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini error ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
  return { text, provider: "Gemini", model, taskType: "general" }
}

async function callOpenRouterV5(
  messages: Message[],
  model: string,
  maxTokens = 2000
): Promise<AIv5Response> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error("OPENROUTER_API_KEY no configurada")

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method:  "POST",
    headers: {
      "Authorization":  `Bearer ${key}`,
      "Content-Type":   "application/json",
      "HTTP-Referer":   process.env.NEXT_PUBLIC_APP_URL || "https://eduai.school",
      "X-Title":        "EduAI Platform",
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.7 }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenRouter error ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content ?? ""
  return { text, provider: "OpenRouter", model, taskType: "general" }
}

async function callCerebrasV5(
  messages: Message[],
  model: string,
  maxTokens = 2000
): Promise<AIv5Response> {
  const key = process.env.CEREBRAS_API_KEY
  if (!key) throw new Error("CEREBRAS_API_KEY no configurada")

  const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
    method:  "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Cerebras error ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content ?? ""
  return { text, provider: "Cerebras", model, taskType: "general" }
}

// ── Router principal v5 ───────────────────────────────────────────────────────

/**
 * callAIv5 — Router inteligente con todos los proveedores gratuitos 2026
 *
 * @example
 * const res = await callAIv5(messages, { task: "coding", maxTokens: 4000 })
 * console.log(res.text, res.provider) // "Kimi K2 free..." / "Groq"
 */
export async function callAIv5(
  messages: Message[],
  options: AIv5Options = {}
): Promise<AIv5Response> {
  const {
    task = "general",
    maxTokens = 2000,
    systemPrompt,
    forceProvider,
    openrouterModel,
  } = options

  const t0 = Date.now()

  // Prepend system prompt si se pasó por separado
  const msgs: Message[] = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...messages]
    : messages

  // ── Forzar proveedor (testing) ──────────────────────────────────────────
  if (forceProvider) {
    const res = await {
      groq:        () => callGroqV5(msgs, GROQ_MODELS.llama70b, maxTokens),
      gemini:      () => callGeminiV5(msgs, GEMINI_MODELS.flash, maxTokens),
      openrouter:  () => callOpenRouterV5(msgs, openrouterModel ?? OR_FREE_MODELS.kimiK2, maxTokens),
      cerebras:    () => callCerebrasV5(msgs, CEREBRAS_MODELS.llama70b, maxTokens),
    }[forceProvider]()
    return { ...res, taskType: task, latencyMs: Date.now() - t0 }
  }

  // ── Cadenas por tipo de tarea ───────────────────────────────────────────

  type ProviderFn = () => Promise<AIv5Response>

  const chains: Record<AITaskType, ProviderFn[]> = {

    // Ultra rápido: Groq primero (sub-100ms), Cerebras fallback
    fast: [
      () => callGroqV5(msgs, GROQ_MODELS.llama4,    maxTokens),
      () => callGroqV5(msgs, GROQ_MODELS.llama70b,  maxTokens),
      () => callCerebrasV5(msgs, CEREBRAS_MODELS.llama8b, maxTokens),
      () => callGeminiV5(msgs, GEMINI_MODELS.flashLite, maxTokens),
    ],

    // Coding/Agentic: Kimi K2 es el líder en 2026
    coding: [
      () => callGroqV5(msgs, GROQ_MODELS.kimi, maxTokens),          // Kimi en Groq
      () => callOpenRouterV5(msgs, OR_FREE_MODELS.kimiK2, maxTokens), // Kimi free OR
      () => callGroqV5(msgs, GROQ_MODELS.llama70b, maxTokens),      // Llama fallback
      () => callGeminiV5(msgs, GEMINI_MODELS.flash, maxTokens),     // Gemini fallback
    ],

    // Razonamiento profundo: Kimi K2 / DeepSeek R1
    reasoning: [
      () => callOpenRouterV5(msgs, OR_FREE_MODELS.kimiK2,    maxTokens),
      () => callOpenRouterV5(msgs, OR_FREE_MODELS.deepseekR1, maxTokens),
      () => callGroqV5(msgs, GROQ_MODELS.qwen3, maxTokens),
      () => callGeminiV5(msgs, GEMINI_MODELS.flash, maxTokens),
    ],

    // Contexto muy largo: Gemini Flash (1M tokens)
    long_context: [
      () => callGeminiV5(msgs, GEMINI_MODELS.flash, Math.min(maxTokens, 8000)),
      () => callOpenRouterV5(msgs, OR_FREE_MODELS.kimiK2, maxTokens), // 131K ctx
      () => callGroqV5(msgs, GROQ_MODELS.llama70b, maxTokens),
    ],

    // Visión/Multimodal: Gemini Flash
    vision: [
      () => callGeminiV5(msgs, GEMINI_MODELS.flash, maxTokens),
      () => callOpenRouterV5(msgs, OR_FREE_MODELS.geminiExp, maxTokens),
    ],

    // Batch (muchas requests): Cerebras (1M tokens/día)
    batch: [
      () => callCerebrasV5(msgs, CEREBRAS_MODELS.llama70b, maxTokens),
      () => callGroqV5(msgs, GROQ_MODELS.llama70b, maxTokens),
      () => callGeminiV5(msgs, GEMINI_MODELS.flashLite, maxTokens),
    ],

    // General: cadena completa ordenada por calidad/límites
    general: [
      () => callGeminiV5(msgs, GEMINI_MODELS.flash, maxTokens),     // 1,500/día, 1M ctx
      () => callGroqV5(msgs, GROQ_MODELS.llama70b, maxTokens),      // 30 RPM, sub-100ms
      () => callOpenRouterV5(msgs, OR_FREE_MODELS.kimiK2, maxTokens),// Kimi free
      () => callOpenRouterV5(msgs, OR_FREE_MODELS.llama70b, maxTokens),
      () => callCerebrasV5(msgs, CEREBRAS_MODELS.llama70b, maxTokens),
    ],
  }

  const chain = chains[task] ?? chains.general

  for (const fn of chain) {
    try {
      const res = await fn()
      return { ...res, taskType: task, latencyMs: Date.now() - t0 }
    } catch (err) {
      console.warn(
        `[AI Router v5] proveedor falló (task=${task}):`,
        err instanceof Error ? err.message : String(err)
      )
    }
  }

  throw new Error(`[AI Router v5] Todos los proveedores fallaron para task="${task}"`)
}

// ── Streaming v5 (Groq, compatible con UI) ───────────────────────────────────

/**
 * streamAIv5 — Streaming con Groq (el más rápido para chat en vivo)
 * Fallback a Gemini si Groq falla.
 */
export async function streamAIv5(
  messages: Message[],
  options: {
    task?: AITaskType
    maxTokens?: number
    systemPrompt?: string
    onChunk: (chunk: string) => void
    onDone: (full: string, provider: string, model: string) => void
    onError: (err: string) => void
  }
): Promise<void> {
  const {
    task = "fast",
    maxTokens = 2000,
    systemPrompt,
    onChunk,
    onDone,
    onError,
  } = options

  const msgs: Message[] = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...messages]
    : messages

  // Intentar Groq stream primero (más rápido)
  try {
    const Groq = (await import("groq-sdk")).default
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

    const model = task === "coding" ? GROQ_MODELS.kimi : GROQ_MODELS.llama70b

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
      if (delta) { full += delta; onChunk(delta) }
    }
    onDone(full, "Groq", model)
    return
  } catch (err) {
    console.warn("[AI Router v5] Groq stream falló, usando Gemini:", err)
  }

  // Fallback: Gemini non-stream
  try {
    const res = await callGeminiV5(msgs, GEMINI_MODELS.flash, maxTokens)
    // Simular streaming character por character (natural feel)
    for (const char of res.text) {
      onChunk(char)
      await new Promise(r => setTimeout(r, 1))
    }
    onDone(res.text, "Gemini", GEMINI_MODELS.flash)
  } catch (err) {
    onError(err instanceof Error ? err.message : "Error desconocido")
  }
}

// ── Utilidades de información ─────────────────────────────────────────────────

/** Retorna qué proveedores están configurados (para mostrar en UI) */
export function getAvailableProviders(): {
  name: string
  configured: boolean
  free: boolean
  rpmLimit: number
  dailyLimit: string
  bestFor: string
}[] {
  return [
    {
      name:        "Groq",
      configured:  !!process.env.GROQ_API_KEY,
      free:        true,
      rpmLimit:    30,
      dailyLimit:  "14,400 req/día (8B) · 1,000 req/día (70B)",
      bestFor:     "Chat rápido, coding, respuestas en tiempo real",
    },
    {
      name:        "Gemini Flash",
      configured:  !!process.env.GEMINI_API_KEY,
      free:        true,
      rpmLimit:    15,
      dailyLimit:  "1,500 req/día",
      bestFor:     "Documentos largos, visión, contexto 1M tokens",
    },
    {
      name:        "Kimi K2 (OpenRouter free)",
      configured:  !!process.env.OPENROUTER_API_KEY,
      free:        true,
      rpmLimit:    20,
      dailyLimit:  "Rate-limited, uso moderado",
      bestFor:     "Coding avanzado, razonamiento agentic, UI generation",
    },
    {
      name:        "Cerebras",
      configured:  !!process.env.CEREBRAS_API_KEY,
      free:        true,
      rpmLimit:    30,
      dailyLimit:  "1M tokens/día",
      bestFor:     "Batch processing, throughput máximo (2,000 tok/seg)",
    },
  ]
}

/** Qué modelo se usará para una tarea (sin ejecutar la llamada) */
export function getModelForTask(task: AITaskType): { provider: string; model: string } {
  const map: Record<AITaskType, { provider: string; model: string }> = {
    fast:         { provider: "Groq",       model: GROQ_MODELS.llama4       },
    coding:       { provider: "Groq/Kimi",  model: "Kimi K2"                },
    reasoning:    { provider: "OpenRouter", model: OR_FREE_MODELS.kimiK2    },
    long_context: { provider: "Gemini",     model: GEMINI_MODELS.flash      },
    vision:       { provider: "Gemini",     model: GEMINI_MODELS.flash      },
    batch:        { provider: "Cerebras",   model: CEREBRAS_MODELS.llama70b },
    general:      { provider: "Gemini",     model: GEMINI_MODELS.flash      },
  }
  return map[task]
}
