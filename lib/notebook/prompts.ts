// lib/notebook/prompts.ts
// Prompts del sistema para el Notebook Hub

export function buildNotebookSystemPrompt(role: string): string {
  return `Eres ${role}.
Tu trabajo es analizar y responder usando ÚNICAMENTE la información de las fuentes activas del usuario.
No inventes datos. No agregues información externa que no esté en las fuentes.
Si algo no aparece en las fuentes, dilo claramente: "Eso no está cubierto en las fuentes actuales."
Cuando cites información, menciona brevemente la fuente (ej: "Según [nombre de fuente]...").
Responde en español, con claridad, estructura y precisión.
Usa markdown cuando ayude a la legibilidad (negritas, listas, encabezados).`.trim()
}

export function buildSummaryPrompt(
  sourcesText: string,
  specialistRole: string
): string {
  return `Eres ${specialistRole}. Analiza el siguiente conjunto de fuentes y genera un resumen estructurado.

FUENTES:
${sourcesText}

Genera un análisis con:
1. Resumen general (3-4 párrafos en markdown)
2. Puntos clave (exactamente 6-8 puntos, cada uno comenzando con verbo)
3. Glosario de términos importantes (8-12 términos con definición clara)
4. Temas principales detectados (3-6 temas cortos)

Responde SOLO en JSON con esta estructura exacta:
{
  "summary_markdown": "texto en markdown",
  "key_points": ["punto 1", "punto 2", ...],
  "glossary": [{"term": "...", "definition": "..."}, ...],
  "topics": ["tema 1", "tema 2", ...]
}`
}

export function buildInfographicPrompt(bundle: {
  summary: string
  keyPoints: string[]
  specialistRole: string
  topicHint?: string
}): string {
  return `Eres ${bundle.specialistRole}. Crea una infografía educativa estructurada basada en este contenido.

RESUMEN:
${bundle.summary}

PUNTOS CLAVE:
${bundle.keyPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}

${bundle.topicHint ? `TEMA ESPECÍFICO: ${bundle.topicHint}` : ""}

Responde SOLO en JSON:
{
  "title": "título llamativo",
  "subtitle": "subtítulo descriptivo",
  "intro": "introducción 1-2 oraciones",
  "heroStat": {"label": "dato destacado", "value": "número o cifra", "unit": "unidad opcional"},
  "stats": [
    {"label": "etiqueta", "value": "valor", "note": "nota opcional"}
  ],
  "sections": [
    {
      "title": "título sección",
      "text": "texto explicativo",
      "bullets": ["punto 1", "punto 2"]
    }
  ],
  "highlights": ["frase impactante 1", "frase 2"],
  "callouts": [{"text": "dato curiosos o importante destacado"}],
  "sourcesUsed": ["fuente 1", "fuente 2"]
}
Incluye 3-4 secciones, 3-5 stats, 2-3 highlights.`
}

export function buildMindmapPrompt(bundle: {
  summary: string
  keyPoints: string[]
  specialistRole: string
}): string {
  return `Eres ${bundle.specialistRole}. Organiza el contenido en un mapa mental jerárquico.

RESUMEN:
${bundle.summary}

PUNTOS CLAVE:
${bundle.keyPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}

Responde SOLO en JSON con esta estructura de árbol:
{
  "centralTopic": "tema central",
  "nodes": [
    {
      "id": "n1",
      "label": "rama principal",
      "category": "main",
      "colorIdx": 0,
      "children": [
        {"id": "n1a", "label": "subconcepto", "category": "sub", "parentId": "n1"},
        {"id": "n1b", "label": "otro subconcepto", "category": "sub", "parentId": "n1"}
      ]
    }
  ]
}
Genera 4-6 ramas principales, cada una con 2-4 subnodos. colorIdx va de 0 a 6.`
}

export function buildQuizPrompt(bundle: {
  chunks: string
  specialistRole: string
}): string {
  return `Eres ${bundle.specialistRole}. Crea un quiz educativo basado en las fuentes.

CONTENIDO:
${bundle.chunks}

Responde SOLO en JSON:
{
  "title": "título del quiz",
  "questions": [
    {
      "id": "q1",
      "type": "multiple",
      "question": "pregunta",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct": 0,
      "explanation": "por qué es correcto",
      "bloom": "recordar|comprender|aplicar|analizar"
    }
  ]
}
Genera 8-10 preguntas variadas (recordar, comprender, aplicar). Solo preguntas respaldadas por el contenido.`
}

export function buildPodcastPrompt(bundle: {
  summary: string
  keyPoints: string[]
  specialistRole: string
}): string {
  return `Eres ${bundle.specialistRole}. Crea un guión de podcast educativo conversacional.

RESUMEN:
${bundle.summary}

PUNTOS CLAVE:
${bundle.keyPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}

Responde SOLO en JSON:
{
  "title": "título del episodio",
  "duration": "duración estimada",
  "segments": [
    {
      "type": "intro|main|detail|closing",
      "speaker": "Álvaro|Elvira",
      "text": "texto del locutor"
    }
  ]
}
Alterna entre Álvaro y Elvira. Mínimo 8 segmentos. Tono didáctico y natural.`
}

export function buildFlashcardsPrompt(bundle: {
  chunks: string
  specialistRole: string
}): string {
  return `Eres ${bundle.specialistRole}. Crea flashcards de estudio basadas en las fuentes.

CONTENIDO:
${bundle.chunks}

Responde SOLO en JSON:
{
  "title": "nombre del mazo",
  "cards": [
    {
      "id": "c1",
      "front": "pregunta o concepto",
      "back": "respuesta o definición",
      "hint": "pista opcional",
      "difficulty": "easy|medium|hard"
    }
  ]
}
Genera 10-15 tarjetas. Solo contenido verificable en las fuentes.`
}

export function buildTimelinePrompt(bundle: {
  chunks: string
  specialistRole: string
}): string {
  return `Eres ${bundle.specialistRole}. Construye una línea de tiempo a partir de las fuentes.

CONTENIDO:
${bundle.chunks}

Responde SOLO en JSON:
{
  "title": "título de la timeline",
  "period": "período cubierto",
  "events": [
    {
      "id": "e1",
      "date": "año o fecha",
      "label": "nombre del evento",
      "description": "descripción breve",
      "importance": "high|medium|low",
      "category": "categoría temática"
    }
  ]
}
Solo eventos mencionados en las fuentes. Ordena cronológicamente.`
}
