// lib/agents/accessibility-agent.ts
// ─────────────────────────────────────────────────────────────────────────────
// AccessibilityAgent — analiza exámenes y adapta contenido para estudiantes
// con Necesidades Educativas Especiales (NEE/PIE).
// Aplica principios UDL (Universal Design for Learning) + MINEDUC Chile.
// ─────────────────────────────────────────────────────────────────────────────

import { callAIv5 } from "@/lib/ai-router-v5"
import type { Message } from "@/lib/ai-router-v5"

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type NEEType =
  | "dyslexia"    // Dislexia
  | "adhd"        // TDAH
  | "low_vision"  // Baja visión
  | "tea"         // Trastorno del Espectro Autista
  | "tel"         // Trastorno Específico del Lenguaje
  | "general_pie" // PIE general sin diagnóstico específico

export interface AccessibilityProfile {
  neeTypes:      NEEType[]
  fontSize?:     number    // px recomendado
  lineSpacing?:  number    // multiplicador (1.5, 2.0, etc.)
  fontFamily?:   string
  maxSentenceWords?: number  // palabras por oración
  useImages?:    boolean
  useSteps?:     boolean   // instrucciones en pasos numerados
  simplifyVocab?: boolean
  reduceOptions?: boolean  // reducir alternativas de 4 a 3
}

export interface AdaptedQuestion {
  original:  string
  adapted:   string
  changes:   string[]  // lista de cambios realizados
}

export interface AccessibilityReport {
  score:           number  // 0-100, qué tan accesible está el examen
  issues:          string[]
  recommendations: string[]
  neeProfiles:     AccessibilityProfile[]
}

// ── Perfiles NEE ──────────────────────────────────────────────────────────────

export const NEE_PROFILES: Record<NEEType, AccessibilityProfile> = {
  dyslexia: {
    neeTypes:         ["dyslexia"],
    fontSize:         17,
    lineSpacing:      1.9,
    fontFamily:       "Lexend",
    maxSentenceWords: 15,
    useImages:        true,
    useSteps:         false,
    simplifyVocab:    true,
    reduceOptions:    false,
  },
  adhd: {
    neeTypes:         ["adhd"],
    fontSize:         17,
    lineSpacing:      2.0,
    fontFamily:       "Lexend",
    maxSentenceWords: 12,
    useImages:        true,
    useSteps:         true,
    simplifyVocab:    true,
    reduceOptions:    false,
  },
  low_vision: {
    neeTypes:         ["low_vision"],
    fontSize:         19,
    lineSpacing:      2.0,
    fontFamily:       "Atkinson Hyperlegible",
    maxSentenceWords: 18,
    useImages:        false,
    useSteps:         false,
    simplifyVocab:    false,
    reduceOptions:    false,
  },
  tea: {
    neeTypes:         ["tea"],
    fontSize:         16,
    lineSpacing:      1.8,
    fontFamily:       "Inter",
    maxSentenceWords: 12,
    useImages:        true,
    useSteps:         true,
    simplifyVocab:    true,
    reduceOptions:    true,
  },
  tel: {
    neeTypes:         ["tel"],
    fontSize:         17,
    lineSpacing:      1.9,
    fontFamily:       "Poppins",
    maxSentenceWords: 10,
    useImages:        true,
    useSteps:         true,
    simplifyVocab:    true,
    reduceOptions:    true,
  },
  general_pie: {
    neeTypes:         ["general_pie"],
    fontSize:         17,
    lineSpacing:      1.8,
    fontFamily:       "Lexend",
    maxSentenceWords: 15,
    useImages:        true,
    useSteps:         true,
    simplifyVocab:    true,
    reduceOptions:    false,
  },
}

// ── Análisis estático (sin IA) ────────────────────────────────────────────────

/**
 * analyzeAccessibility — analiza el texto de preguntas sin llamar a la IA.
 * Rápido, sin costo, útil para feedback inmediato en el editor.
 */
export function analyzeAccessibility(
  questions: { question: string; type: string }[]
): AccessibilityReport {
  const issues: string[] = []
  const recommendations: string[] = []
  let penaltyScore = 0

  for (const q of questions) {
    const text  = q.question ?? ""
    const words = text.split(/\s+/).filter(Boolean)

    // Oraciones muy largas
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    for (const s of sentences) {
      const wc = s.split(/\s+/).filter(Boolean).length
      if (wc > 25) {
        issues.push(`Oración muy larga (${wc} palabras): "${s.slice(0, 60)}..."`)
        penaltyScore += 5
      }
    }

    // Vocabulario complejo (detección básica)
    const complexWords = [
      "implementar","mediante","conforme","establece","contempla",
      "circunscribir","denotar","suscitar","conllevar","subyacer",
    ]
    for (const w of complexWords) {
      if (text.toLowerCase().includes(w)) {
        issues.push(`Vocabulario complejo: "${w}" en pregunta "${text.slice(0,50)}..."`)
        penaltyScore += 3
        break
      }
    }

    // Instrucciones sin estructura
    if (q.type === "development" && words.length > 40 && !text.includes("1.") && !text.includes("a)")) {
      recommendations.push("Considera dividir las instrucciones de desarrollo en pasos numerados.")
      penaltyScore += 2
    }

    // Texto muy corto en desarrollo
    if (q.type === "development" && words.length < 8) {
      recommendations.push("La pregunta de desarrollo es muy breve. Agrega contexto o criterios claros.")
      penaltyScore += 2
    }
  }

  // Recomendaciones generales
  if (questions.length > 15) {
    recommendations.push("Más de 15 preguntas puede ser agotador para estudiantes con NEE. Considera dividir el examen.")
    penaltyScore += 5
  }

  const allDevelopment = questions.every(q => q.type === "development")
  if (allDevelopment && questions.length > 3) {
    recommendations.push("Solo preguntas de desarrollo puede ser difícil para NEE. Mezcla con alternativas.")
    penaltyScore += 8
  }

  const noImages = questions.every(q => !(q as Record<string, unknown>).imageUrl)
  if (noImages && questions.length > 5) {
    recommendations.push("Agrega imágenes a algunas preguntas para apoyo visual (especialmente para TEA/Dislexia).")
    penaltyScore += 5
  }

  // Si no hay issues, agregar nota positiva
  if (issues.length === 0) {
    recommendations.push("✅ El examen tiene buena legibilidad básica.")
  }

  const score = Math.max(0, Math.min(100, 100 - penaltyScore))

  return {
    score,
    issues:          [...new Set(issues)],
    recommendations: [...new Set(recommendations)],
    neeProfiles:     Object.values(NEE_PROFILES),
  }
}

// ── Adaptación con IA ─────────────────────────────────────────────────────────

/**
 * adaptQuestionForNEE — adapta el texto de UNA pregunta para un perfil NEE.
 * Usa IA solo cuando es necesario (vocabulario, redacción compleja).
 */
export async function adaptQuestionForNEE(
  questionText: string,
  neeType:      NEEType
): Promise<AdaptedQuestion> {
  const profile = NEE_PROFILES[neeType]

  const instructions: Record<NEEType, string> = {
    dyslexia:    `- Frases máximo ${profile.maxSentenceWords} palabras\n- Vocabulario simple y directo\n- Sin dobles negaciones\n- Una idea por oración\n- Palabras clave en negrita`,
    adhd:        `- Instrucciones en pasos numerados\n- Máximo ${profile.maxSentenceWords} palabras por oración\n- Una tarea a la vez\n- Verbo de acción al inicio ("Calcula...", "Indica...", "Explica...")\n- Sin información irrelevante`,
    low_vision:  `- Texto claro y directo\n- Sin figuras retóricas que puedan confundir\n- Sin referencias a posición visual ("el diagrama de la izquierda")\n- Descripción textual completa`,
    tea:         `- Lenguaje literal, sin metáforas\n- Máximo ${profile.maxSentenceWords} palabras por oración\n- Estructura predecible\n- Sin ambigüedades\n- Contexto explícito (no asumir conocimiento previo)`,
    tel:         `- Vocabulario básico (nivel 3° básico)\n- Oraciones simples de máximo ${profile.maxSentenceWords} palabras\n- Sin subordinadas complejas\n- Ejemplo concreto si es posible`,
    general_pie: `- Lenguaje claro y directo\n- Frases cortas\n- Vocabulario accesible\n- Instrucciones paso a paso si aplica`,
  }

  const messages: Message[] = [
    {
      role: "system",
      content: `Adaptas preguntas de examen para estudiantes con NEE en Chile.
Devuelve SOLO un objeto JSON con esta estructura exacta:
{"adapted":"texto adaptado aquí","changes":["cambio 1","cambio 2"]}
Sin texto adicional fuera del JSON.`,
    },
    {
      role: "user",
      content: `Adapta esta pregunta de examen para estudiantes con ${neeType.toUpperCase().replace("_"," ")}.

PREGUNTA ORIGINAL:
"${questionText}"

REGLAS DE ADAPTACIÓN:
${instructions[neeType]}

Devuelve SOLO el JSON con el texto adaptado y la lista de cambios realizados.`,
    },
  ]

  try {
    const result = await callAIv5(messages, { task: "fast", maxTokens: 600 })

    const match = result.text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error("No JSON found")

    const data = JSON.parse(match[0])

    return {
      original: questionText,
      adapted:  String(data.adapted ?? questionText),
      changes:  Array.isArray(data.changes) ? data.changes.map(String) : [],
    }
  } catch {
    // Fallback: devolver original sin cambios
    return {
      original: questionText,
      adapted:  questionText,
      changes:  ["No se pudo adaptar automáticamente. Revisa manualmente."],
    }
  }
}

/**
 * adaptExamForNEE — adapta todas las preguntas de un examen.
 * Retorna las preguntas con el texto adaptado.
 */
export async function adaptExamForNEE(
  questions: { question: string; type: string; [key: string]: unknown }[],
  neeType:   NEEType
): Promise<{ question: string; changes: string[]; [key: string]: unknown }[]> {
  const results = await Promise.all(
    questions.map(async (q) => {
      const adapted = await adaptQuestionForNEE(q.question, neeType)
      return {
        ...q,
        question: adapted.adapted,
        changes:  adapted.changes,
      }
    })
  )
  return results
}

/**
 * getNEERecommendations — devuelve recomendaciones rápidas por tipo NEE.
 * Sin IA, para mostrar en la UI inmediatamente.
 */
export function getNEERecommendations(neeType: NEEType): {
  font:        string
  fontSize:    number
  lineSpacing: number
  tips:        string[]
} {
  const profile = NEE_PROFILES[neeType]

  const tipsMap: Record<NEEType, string[]> = {
    dyslexia: [
      "Fuente Lexend: mayor legibilidad según evidencia 2026 (WebAbility/CAST)",
      "Espaciado de línea 1.9x para separar visualmente el texto",
      "Frases máximo 15 palabras",
      "Evitar texto justificado (usa alineación izquierda)",
      "Palabras clave en negrita",
    ],
    adhd: [
      "Instrucciones en pasos numerados",
      "Una sola tarea por pregunta",
      "Máximo 5-8 preguntas por examen",
      "Bloques bien separados visualmente",
      "Timer visible y tiempo generoso",
    ],
    low_vision: [
      "Fuente Atkinson Hyperlegible: diseñada para baja visión",
      "Tamaño mínimo 18-19px",
      "Alto contraste: fondo claro, texto muy oscuro",
      "Sin cursiva ni fuentes decorativas",
      "No usar solo color para transmitir información",
    ],
    tea: [
      "Lenguaje literal, sin metáforas ni frases idiomáticas",
      "Estructura de pregunta siempre igual",
      "Contexto explícito en cada pregunta",
      "Imágenes simples y claras como apoyo",
      "Evitar cambios abruptos de formato",
    ],
    tel: [
      "Vocabulario nivel básico (3°-4° básico como referencia)",
      "Oraciones de máximo 10 palabras",
      "Evitar subordinadas largas",
      "Ejemplos concretos junto a la pregunta",
      "Instrucciones verbales de apoyo si es posible",
    ],
    general_pie: [
      "Lenguaje claro y directo",
      "Fuente Lexend como opción segura para NEE general",
      "Preguntas cortas y concretas",
      "Tiempo adicional del 25-50% según PIE MINEDUC",
      "Ambiente sin distractores",
    ],
  }

  return {
    font:        profile.fontFamily ?? "Lexend",
    fontSize:    profile.fontSize   ?? 17,
    lineSpacing: profile.lineSpacing ?? 1.9,
    tips:        tipsMap[neeType] ?? [],
  }
}
