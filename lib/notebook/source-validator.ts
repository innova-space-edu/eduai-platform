// lib/notebook/source-validator.ts
// Valida la calidad de una fuente usando el patrón del agente Investigador
// Se llama opcionalmente antes de agregar URLs al notebook

import { callAI } from "@/lib/ai-router-v4"

export type SourceValidationResult = {
  relevant:      boolean   // ¿Es relevante para el tema?
  quality:       number    // 0-10
  category:      "académico" | "periodismo" | "oficial" | "educativo" | "comercial" | "otro"
  issues:        string[]  // Problemas detectados
  suggestion:    string    // Recomendación breve
}

export async function validateSource(params: {
  url:             string
  title:           string
  snippet?:        string
  notebookTitle:   string
  specialistRole:  string
}): Promise<SourceValidationResult | null> {
  const { url, title, snippet, notebookTitle, specialistRole } = params

  try {
    const domain = new URL(url).hostname

    const response = await callAI(
      [{
        role: "user",
        content: `Eres ${specialistRole}. Evalúa esta fuente para un notebook sobre: "${notebookTitle}".

Fuente:
- URL: ${url}
- Dominio: ${domain}
- Título: ${title}
${snippet ? `- Snippet: ${snippet.slice(0, 200)}` : ""}

Evalúa y responde SOLO en JSON:
{
  "relevant": true|false,
  "quality": 0-10,
  "category": "académico"|"periodismo"|"oficial"|"educativo"|"comercial"|"otro",
  "issues": ["problema1", "problema2"],
  "suggestion": "recomendación breve"
}

Criterios de calidad:
- 8-10: académico, oficial .gov/.edu, organismos internacionales
- 6-7: periodismo confiable, medios establecidos
- 4-5: blogs especializados, wikis
- 0-3: contenido comercial, spam, clickbait`,
      }],
      { maxTokens: 300, preferProvider: "gemini-lite" }
    )

    const raw = response.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
    const parsed = JSON.parse(raw)
    return parsed as SourceValidationResult
  } catch {
    return null
  }
}

// ─── Validación rápida sin LLM (heurística por dominio) ──────────────────────
// Para no depender de API en cada URL, hace un pre-filtro rápido

const HIGH_QUALITY_DOMAINS = [
  ".edu", ".gov", ".gob.cl", "mineduc.cl", "curriculumnacional.mineduc.cl",
  "who.int", "oas.org", "unesco.org", "cepal.org",
  "nature.com", "science.org", "pubmed.ncbi.nlm.nih.gov", "scholar.google",
  "researchgate.net", "academia.edu", "arxiv.org", "jstor.org",
  "bbc.com", "reuters.com", "apnews.com", "elmostrador.cl", "emol.com",
]

const LOW_QUALITY_PATTERNS = [
  "click", "viral", "increíble", "impactante", "secreto", "truco",
  "gana dinero", "gratis", "oferta", "descuento", "comprar",
]

export function quickDomainScore(url: string, title: string): number {
  try {
    const domain = new URL(url).hostname.toLowerCase()
    const titleLower = title.toLowerCase()

    if (HIGH_QUALITY_DOMAINS.some((d) => domain.includes(d))) return 9
    if (LOW_QUALITY_PATTERNS.some((p) => titleLower.includes(p))) return 2

    if (domain.endsWith(".cl") && !domain.includes("blog")) return 6
    if (domain.includes("wikipedia.org")) return 5

    return 5 // Neutral
  } catch {
    return 4
  }
}
