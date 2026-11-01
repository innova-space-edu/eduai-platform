/** Groq model catalog valid for EduAI API calls; retired IDs are blocked. */
export const GROQ_QUALITY_MODEL = "openai/gpt-oss-120b"
export const GROQ_FAST_MODEL = "openai/gpt-oss-20b"
export const GROQ_REASONING_MODEL = "qwen/qwen3.8-27b"

const RETIRED_GROQ_MODEL_IDS = new Set([
  "llama-3.1-8b-instant",
  "llama-3.3-70b-versatile",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "llama-4-scout-17b-16e-instruct",
  "qwen/qwen3.6-27b",
  "qwen/qwen3-32b",
  "qwen-qwq-32b",
  "groq/compound",
  "groq/compound-mini",
])

export function isRetiredGroqModel(model: string | null | undefined): boolean {
  return RETIRED_GROQ_MODEL_IDS.has((model || "").trim().toLowerCase())
}
export function resolveGroqTextModel(selected = process.env.GROQ_TEXT_MODEL): string {
  const model = selected?.trim()
  return model && !isRetiredGroqModel(model) ? model : GROQ_QUALITY_MODEL
}
export function resolveGroqResearchModel(selected = process.env.GROQ_RESEARCH_MODEL): string {
  const model = selected?.trim()
  return model && !isRetiredGroqModel(model) ? model : GROQ_QUALITY_MODEL
}
