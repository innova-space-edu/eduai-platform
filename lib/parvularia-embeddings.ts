import { GoogleGenAI } from "@google/genai"

export const PARVULARIA_EMBEDDING_MODEL =
  process.env.GOOGLE_EMBEDDING_MODEL || "gemini-embedding-2"
export const PARVULARIA_EMBEDDING_DIMENSIONS = 768
const EMBEDDING_BATCH = 4

export type ParvulariaEmbeddingInput = {
  id?: string
  level?: string | null
  topic?: string | null
  ambito_nucleo?: string | null
  oa_text?: string | null
  oat_text?: string | null
  skill_text?: string | null
  experience_text?: string | null
  evaluation?: string | null
  resources?: string | null
  search_text?: string | null
}

function embeddingKeys(): string[] {
  return (
    process.env.GEMINI_API_KEY_POOL ||
    process.env.GEMINI_API_KEY_TEXT ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ""
  ).split(",").map((key) => key.trim()).filter(Boolean)
}

export function buildParvulariaEmbeddingText(activity: ParvulariaEmbeddingInput): string {
  return [
    activity.level ? `Nivel: ${activity.level}` : "",
    activity.topic ? `Tema: ${activity.topic}` : "",
    activity.ambito_nucleo ? `Ámbito y núcleo: ${activity.ambito_nucleo}` : "",
    activity.oa_text ? `Objetivo de aprendizaje: ${activity.oa_text}` : "",
    activity.oat_text ? `Objetivo transversal: ${activity.oat_text}` : "",
    activity.skill_text ? `Habilidades: ${activity.skill_text}` : "",
    activity.experience_text ? `Experiencia: ${activity.experience_text}` : "",
    activity.evaluation ? `Evaluación: ${activity.evaluation}` : "",
    activity.resources ? `Recursos: ${activity.resources}` : "",
    activity.search_text ? `Contexto adicional: ${activity.search_text}` : "",
  ].filter(Boolean).join("\n").slice(0, 8_000)
}

export async function embedParvulariaText(text: string): Promise<number[] | null> {
  try {
    const keys = embeddingKeys()
    if (!keys.length || !text.trim()) return null
    const key = keys[Math.floor(Math.random() * keys.length)]
    const ai = new GoogleGenAI({ apiKey: key })
    const result = await ai.models.embedContent({
      model: PARVULARIA_EMBEDDING_MODEL,
      contents: text.slice(0, 8_000),
      config: { outputDimensionality: PARVULARIA_EMBEDDING_DIMENSIONS },
    })
    const values = result.embeddings?.[0]?.values
    return Array.isArray(values) && values.length === PARVULARIA_EMBEDDING_DIMENSIONS ? values : null
  } catch (error) {
    console.warn("[Parvularia embeddings]", error instanceof Error ? error.message : String(error))
    return null
  }
}

export async function embedParvulariaActivities(rows: ParvulariaEmbeddingInput[]): Promise<Array<number[] | null>> {
  const output: Array<number[] | null> = []
  for (let index = 0; index < rows.length; index += EMBEDDING_BATCH) {
    const batch = rows.slice(index, index + EMBEDDING_BATCH)
    output.push(...await Promise.all(batch.map((row) => embedParvulariaText(buildParvulariaEmbeddingText(row)))))
    if (index + EMBEDDING_BATCH < rows.length) await new Promise((resolve) => setTimeout(resolve, 180))
  }
  return output
}
