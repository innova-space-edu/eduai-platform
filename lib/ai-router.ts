/**
 * AI Router — fallback automático entre providers gratuitos
 * Orden: Groq (más rápido) → OpenRouter (más modelos) → Gemini (más volumen)
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

// ── GROQ ────────────────────────────────────────────────
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

// ── OPENROUTER ──────────────────────────────────────────
async function callOpenRouter(messages: Message[], maxTokens = 2000): Promise<AIResponse> {
  const models = [
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemma-2-27b-it:free",
    "mistralai/mistral-7b-instruct:free",
    "qwen/qwen-2.5-72b-instruct:free",
  ]

  for (const model of models) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://eduai-pl.netlify.app",
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

// ── GEMINI ──────────────────────────────────────────────
async function callGemini(messages: Message[], maxTokens = 2000): Promise<AIResponse> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai")
  const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const gemini = genai.getGenerativeModel({ model: "gemini-2.0-flash-exp" })

  // Separar system prompt
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
    model: "gemini-2.0-flash-exp",
  }
}

// ── ROUTER PRINCIPAL ────────────────────────────────────
export async function callAI(
  messages: Message[],
  options: { maxTokens?: number; preferProvider?: "groq" | "openrouter" | "gemini" } = {}
): Promise<AIResponse> {
  const { maxTokens = 2000, preferProvider } = options

  const providers = [
    { name: "groq",        fn: () => callGroq(messages, maxTokens),        enabled: !!process.env.GROQ_API_KEY },
    { name: "openrouter",  fn: () => callOpenRouter(messages, maxTokens),   enabled: !!process.env.OPENROUTER_API_KEY },
    { name: "gemini",      fn: () => callGemini(messages, maxTokens),       enabled: !!process.env.GEMINI_API_KEY },
  ]

  // Reordenar si hay preferencia
  if (preferProvider) {
    providers.sort((a, b) => a.name === preferProvider ? -1 : b.name === preferProvider ? 1 : 0)
  }

  for (const provider of providers) {
    if (!provider.enabled) continue
    try {
      return await provider.fn()
    } catch (e: any) {
      console.warn(`[AI Router] ${provider.name} failed:`, e.message)
    }
  }

  throw new Error("All AI providers failed")
}
