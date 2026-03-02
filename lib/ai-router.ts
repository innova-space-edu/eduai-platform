/**
 * AI Router — fallback automático entre providers
 * Groq   → velocidad, streaming, respuestas cortas
 * Gemini → calidad, razonamiento, contexto largo
 * OpenRouter → fallback general
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

// ── GROQ ─────────────────────────────────────────────────
async function callGroq(messages: Message[], maxTokens = 2000): Promise<AIResponse> {
  const Groq = (await import("groq-sdk")).default
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  const res = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages,
    max_tokens: maxTokens,
    temperature: 0.7,
  })
  return {
    text: res.choices[0]?.message?.content || "",
    provider: "Groq",
    model: "llama-3.3-70b-versatile",
  }
}

// ── GROQ STREAMING ───────────────────────────────────────
export async function callGroqStream(messages: Message[], maxTokens = 3000): Promise<ReadableStream> {
  const Groq = (await import("groq-sdk")).default
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  const stream = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
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
async function callGemini(messages: Message[], maxTokens = 3000): Promise<AIResponse> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai")
  const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const gemini = genai.getGenerativeModel({ model: "gemini-2.0-flash" })
  const system = messages.find(m => m.role === "system")?.content || ""
  const history = messages.filter(m => m.role !== "system")
  const chat = gemini.startChat({
    systemInstruction: system,
    history: history.slice(0, -1).map(m => ({
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
    model: "gemini-2.0-flash",
  }
}

// ── GEMINI STREAMING ─────────────────────────────────────
export async function callGeminiStream(messages: Message[], maxTokens = 3000): Promise<ReadableStream> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai")
  const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const gemini = genai.getGenerativeModel({ model: "gemini-2.0-flash" })
  const system = messages.find(m => m.role === "system")?.content || ""
  const history = messages.filter(m => m.role !== "system")
  const chat = gemini.startChat({
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
 * preferProvider: "groq"       → Tutor (streaming rápido), Quiz, Sócrates, Sugerencias
 * preferProvider: "gemini"     → Matemático, Redactor, Investigador, Traductor, Visual detect
 * preferProvider: "openrouter" → fallback manual
 *
 * Para streaming usar directamente callGroqStream() o callGeminiStream()
 */
export async function callAI(
  messages: Message[],
  options: {
    maxTokens?: number
    preferProvider?: "groq" | "openrouter" | "gemini"
  } = {}
): Promise<AIResponse> {
  const { maxTokens = 2000, preferProvider } = options

  const providers = [
    { name: "groq",       fn: () => callGroq(messages, maxTokens),       enabled: !!process.env.GROQ_API_KEY       },
    { name: "gemini",     fn: () => callGemini(messages, maxTokens),     enabled: !!process.env.GEMINI_API_KEY     },
    { name: "openrouter", fn: () => callOpenRouter(messages, maxTokens), enabled: !!process.env.OPENROUTER_API_KEY },
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