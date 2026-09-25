import { GoogleGenAI } from "@google/genai"

export const PARVULARIA_EMBEDDING_MODEL =
  process.env.GOOGLE_EMBEDDING_MODEL || "gemini-embedding-2"
export const PARVULARIA_EMBEDDING_DIMENSIONS = 768

// Gemini Embedding 2 admite varios objetos Content en una sola llamada y devuelve
// un embedding separado por Content. Esto reduce de forma importante las RPM del indexador.
const EMBEDDING_BATCH = 16

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

async function embedTextsBatch(texts: string[]): Promise<Array<number[] | null>> {
  const clean = texts.map((text) => text.slice(0, 8_000))
  if (!clean.length) return []

  const keys = embeddingKeys()
  if (!keys.length) return clean.map(() => null)

  let lastError = ""
  for (const key of keys) {
    try {
      const ai = new GoogleGenAI({ apiKey: key })
      const result = await ai.models.embedContent({
        model: PARVULARIA_EMBEDDING_MODEL,
        contents: clean.map((text) => ({ parts: [{ text }] })),
        config: { outputDimensionality: PARVULARIA_EMBEDDING_DIMENSIONS },
      })

      const embeddings = result.embeddings || []
      if (embeddings.length !== clean.length) {
        lastError = `Respuesta incompleta: ${embeddings.length}/${clean.length}`
        continue
      }

      return embeddings.map((embedding) => {
        const values = embedding.values
        return Array.isArray(values) && values.length === PARVULARIA_EMBEDDING_DIMENSIONS
          ? values
          : null
      })
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
  }

  console.warn("[Parvularia embeddings batch]", lastError || "No se pudo generar el lote")
  return clean.map(() => null)
}

export async function embedParvulariaText(text: string): Promise<number[] | null> {
  if (!text.trim()) return null
  const [embedding] = await embedTextsBatch([text])
  return embedding || null
}

export async function embedParvulariaActivities(
  rows: ParvulariaEmbeddingInput[],
): Promise<Array<number[] | null>> {
  const output: Array<number[] | null> = []

  for (let index = 0; index < rows.length; index += EMBEDDING_BATCH) {
    const batch = rows.slice(index, index + EMBEDDING_BATCH)
    output.push(...await embedTextsBatch(batch.map(buildParvulariaEmbeddingText)))

    // Pequeña separación para evitar ráfagas si la importación contiene cientos de actividades.
    if (index + EMBEDDING_BATCH < rows.length) {
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }

  return output
}
