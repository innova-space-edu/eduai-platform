import { GoogleGenAI } from "@google/genai"

export type DeepResearchAgent = "deep-research-preview-04-2026" | "deep-research-max-preview-04-2026"

export type DeepResearchCitation = {
  title: string
  uri: string
}

export type DeepResearchResult = {
  id: string
  status: "running" | "completed" | "failed"
  rawStatus: string
  text: string
  citations: DeepResearchCitation[]
  error: string | null
}

function apiKey() {
  const value = process.env.GEMINI_API_KEY_TEXT || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  if (!value) throw new Error("Gemini API no está configurada para Deep Research")
  return value
}

export function hasGoogleDeepResearch() {
  return Boolean(process.env.GEMINI_API_KEY_TEXT || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)
}

export function deepResearchAgent(max = false): DeepResearchAgent {
  if (max && process.env.GOOGLE_DEEP_RESEARCH_MAX_ENABLED === "true") {
    return "deep-research-max-preview-04-2026"
  }
  return "deep-research-preview-04-2026"
}

function client() {
  return new GoogleGenAI({ apiKey: apiKey() })
}

function normalizeStatus(value: unknown): DeepResearchResult["status"] {
  const status = String(value || "").toLowerCase()
  if (status === "completed") return "completed"
  if (status === "failed" || status === "cancelled" || status === "canceled") return "failed"
  return "running"
}

function collectText(interaction: any) {
  if (typeof interaction?.output_text === "string" && interaction.output_text.trim()) {
    return interaction.output_text.trim()
  }

  const steps = Array.isArray(interaction?.steps) ? interaction.steps : []
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const content = Array.isArray(steps[index]?.content) ? steps[index].content : []
    const text = content
      .filter((item: any) => item?.type === "text" && typeof item?.text === "string")
      .map((item: any) => item.text.trim())
      .filter(Boolean)
      .join("\n\n")
    if (text) return text
  }
  return ""
}

function collectCitations(interaction: any, text: string) {
  const seen = new Map<string, DeepResearchCitation>()

  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return
    if (Array.isArray(value)) {
      for (const item of value) visit(item)
      return
    }

    const object = value as Record<string, unknown>
    const candidate = typeof object.uri === "string"
      ? object.uri
      : typeof object.url === "string"
        ? object.url
        : null
    if (candidate && /^https?:\/\//i.test(candidate)) {
      let fallbackTitle = candidate
      try { fallbackTitle = new URL(candidate).hostname } catch {}
      const title = typeof object.title === "string" && object.title.trim()
        ? object.title.trim()
        : fallbackTitle
      if (!seen.has(candidate)) seen.set(candidate, { title: title.slice(0, 240), uri: candidate })
    }

    for (const child of Object.values(object)) visit(child)
  }

  visit(interaction?.steps)

  const markdownLink = /\[([^\]]{1,240})\]\((https?:\/\/[^)\s]+)\)/g
  for (const match of text.matchAll(markdownLink)) {
    if (!seen.has(match[2])) seen.set(match[2], { title: match[1], uri: match[2] })
  }

  return [...seen.values()].slice(0, 30)
}

function interactionError(interaction: any) {
  if (!interaction?.error) return null
  if (typeof interaction.error === "string") return interaction.error.slice(0, 1200)
  if (typeof interaction.error?.message === "string") return interaction.error.message.slice(0, 1200)
  try { return JSON.stringify(interaction.error).slice(0, 1200) } catch { return "Deep Research falló" }
}

function normalizeInteraction(interaction: any): DeepResearchResult {
  const text = collectText(interaction)
  return {
    id: String(interaction?.id || ""),
    status: normalizeStatus(interaction?.status),
    rawStatus: String(interaction?.status || "in_progress"),
    text,
    citations: collectCitations(interaction, text),
    error: interactionError(interaction),
  }
}

export async function startGoogleDeepResearch(input: {
  prompt: string
  max?: boolean
  visualization?: boolean
}) {
  const ai = client()
  const agent = deepResearchAgent(Boolean(input.max))
  const interactions = ai.interactions as any
  const interaction = await interactions.create({
    input: input.prompt,
    agent,
    background: true,
    agent_config: {
      type: "deep-research",
      thinking_summaries: "auto",
      ...(input.visualization ? { visualization: "auto" } : {}),
    },
  })
  const result = normalizeInteraction(interaction)
  if (!result.id) throw new Error("Google Deep Research no devolvió interaction id")
  return { ...result, agent }
}

export async function getGoogleDeepResearch(interactionId: string) {
  const ai = client()
  const interactions = ai.interactions as any
  const interaction = await interactions.get(interactionId)
  return normalizeInteraction(interaction)
}
