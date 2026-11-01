/**
 * List available text models per provider using the account's own server-side keys.
 * Read-only. Does not send completion prompts, leak keys or change billing.
 * Run with environment variables already configured.
 */
const providers = [
  { id: "groq", key: ["GROQ_API_KEY", "GROQ_API_KEY_1"], url: "https://api.groq.com/openai/v1/models", expected: ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"] },
  { id: "openrouter", key: ["OPENROUTER_API_KEY", "OPENROUTER_API_KEY_1"], url: "https://openrouter.ai/api/v1/models", expected: ["openrouter/free", "openrouter/auto"] },
  { id: "sambanova", key: ["SAMBANOVA_API_KEY"], url: "https://api.sambanova.ai/v1/models", expected: ["gpt-oss-120b", "DeepSeek-V3.1", "Meta-Llama-3.3-70B-Instruct"] },
  { id: "cerebras", key: ["CEREBRAS_API_KEY"], url: "https://api.cerebras.ai/v1/models", expected: ["gpt-oss-120b"] },
  { id: "together", key: ["TOGETHER_API_KEY"], url: "https://api.together.xyz/v1/models", expected: [] },
  { id: "gemini", key: ["GEMINI_API_KEY_TEXT", "GEMINI_API_KEY"], url: "https://generativelanguage.googleapis.com/v1beta/models", expected: ["gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-4-argon"] },
]
for (const provider of providers) {
  const key = provider.key.map(k => process.env[k]?.trim()).find(Boolean)
  if (!key) { console.log(provider.id + ": sin credencial configurada"); continue }
  try {
    const result = await fetch(provider.url, {
      headers: provider.id === "gemini" ? { "x-goog-api-key": key } : { Authorization: "Bearer " + key },
      signal: AbortSignal.timeout(12000),
    })
    if (!result.ok) { console.log(provider.id + ": HTTP " + result.status); continue }
    const data = await result.json()
    const names = (Array.isArray(data.data) ? data.data : Array.isArray(data.models) ? data.models : []).map(m => (m.id || m.name || "").replace(/^models\//, ""))
    const ids = new Set(names)
    console.log(provider.id + ": " + names.length + " modelos visibles")
    for (const model of provider.expected) console.log("  " + model + ": " + (ids.has(model) ? "disponible" : "no visible; validar acceso"))
  } catch (error) { console.log(provider.id + ": " + (error instanceof Error ? error.message : "error de red")) }
}
