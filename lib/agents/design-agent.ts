// lib/agents/design-agent.ts
// ─────────────────────────────────────────────────────────────────────────────
// DesignAgent — decide automáticamente tema visual, fuente y configuración
// de accesibilidad según asignatura, nivel y necesidades PIE.
// Se usa en el creador de exámenes y en el renderer del estudiante.
// ─────────────────────────────────────────────────────────────────────────────

import type { ExamTheme, ExamFont, ExamStyleSettings } from "@/lib/exam/theme-utils"

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface DesignInput {
  subject?:     string   // "Matemática", "Física", "Biología", etc.
  level?:       string   // "1° Básico", "4° Medio", etc.
  pieMode?:     boolean
  dyslexia?:    boolean
  adhd?:        boolean
  lowVision?:   boolean
  tea?:         boolean
  // Override manual del docente (si ya eligió)
  manualTheme?: ExamTheme
  manualFont?:  ExamFont
}

export interface DesignRecommendation {
  theme:       ExamTheme
  font:        ExamFont
  reason:      string     // explicación para el docente
  settings:    ExamStyleSettings
  // Sugerencias de UX adicionales
  suggestions: string[]
}

// ── Mapas de asignatura → tema ────────────────────────────────────────────────

const SUBJECT_THEME_MAP: Record<string, ExamTheme> = {
  // Ciencias exactas
  "matemática":          "stem",
  "matematica":          "stem",
  "física":              "stem",
  "fisica":              "stem",
  "química":             "stem",
  "quimica":             "stem",
  "ciencias naturales":  "stem",
  "ciencias":            "stem",
  "biología":            "modern",
  "biologia":            "modern",
  // Humanidades
  "lenguaje":            "modern",
  "historia":            "modern",
  "filosofía":           "modern",
  "filosofia":           "modern",
  "religión":            "pie_calm",
  "religion":            "pie_calm",
  // Artes y otros
  "artes":               "canva",
  "educación artística": "canva",
  "educacion artistica": "canva",
  "música":              "canva",
  "musica":              "canva",
  "tecnología":          "modern",
  "tecnologia":          "modern",
  "inglés":              "classic",
  "ingles":              "classic",
  "educación física":    "kids",
  "educacion fisica":    "kids",
}

const SUBJECT_FONT_MAP: Record<string, ExamFont> = {
  "matemática":          "inter",
  "matematica":          "inter",
  "física":              "inter",
  "fisica":              "inter",
  "química":             "inter",
  "quimica":             "inter",
  "ciencias naturales":  "inter",
  "ciencias":            "inter",
  "biología":            "inter",
  "biologia":            "inter",
  "lenguaje":            "lexend",
  "historia":            "lexend",
  "artes":               "poppins",
  "educación artística": "poppins",
  "educacion artistica": "poppins",
  "música":              "poppins",
  "musica":              "poppins",
}

// ── Lógica de nivel → kids ────────────────────────────────────────────────────

function isBasicSchool(level?: string): boolean {
  if (!level) return false
  return /1°\s*básico|2°\s*básico|3°\s*básico|4°\s*básico|básico/i.test(level)
}

// ── Función principal ─────────────────────────────────────────────────────────

/**
 * recommendDesign — dado el contexto del examen, devuelve la configuración
 * visual óptima. Si el docente ya eligió manualmente, respeta su elección
 * pero agrega sugerencias de accesibilidad.
 */
export function recommendDesign(input: DesignInput): DesignRecommendation {
  const subjectKey = (input.subject ?? "").toLowerCase().trim()

  // ── Tema ──────────────────────────────────────────────────────────────────
  let theme: ExamTheme = input.manualTheme ?? "classic"
  let themeReason = "Tema clásico por defecto."

  if (!input.manualTheme) {
    if (input.lowVision) {
      theme      = "high_contrast"
      themeReason = "Alto contraste recomendado para baja visión."
    } else if (input.adhd) {
      theme      = "adhd_focus"
      themeReason = "Diseño ADHD Focus: máximo contraste, sin distractores, bloques amplios."
    } else if (input.pieMode || input.dyslexia || input.tea) {
      theme      = "pie_calm"
      themeReason = "PIE Calm: fondo cálido, bajo estímulo visual para NEE."
    } else if (isBasicSchool(input.level)) {
      theme      = "kids"
      themeReason = "Tema Kids para enseñanza básica: colores amigables, tipografía grande."
    } else if (SUBJECT_THEME_MAP[subjectKey]) {
      theme      = SUBJECT_THEME_MAP[subjectKey]
      themeReason = `Tema ${theme} recomendado para ${input.subject}.`
    } else {
      theme      = "modern"
      themeReason = "Tema moderno minimalista por defecto."
    }
  }

  // ── Fuente ────────────────────────────────────────────────────────────────
  let font: ExamFont = input.manualFont ?? "inter"
  let fontReason = ""

  if (!input.manualFont) {
    if (input.dyslexia) {
      font       = "lexend"
      fontReason = "Lexend: mayor legibilidad para dislexia (evidencia CAST/WebAbility 2026)."
    } else if (input.lowVision) {
      font       = "atkinson"
      fontReason = "Atkinson Hyperlegible: diseñada específicamente para baja visión."
    } else if (isBasicSchool(input.level)) {
      font       = "poppins"
      fontReason = "Poppins: amigable para edades tempranas."
    } else if (SUBJECT_FONT_MAP[subjectKey]) {
      font       = SUBJECT_FONT_MAP[subjectKey]
    } else {
      font       = "inter"
    }
  }

  // ── Accesibilidad ─────────────────────────────────────────────────────────
  const accessibility: ExamStyleSettings["accessibility"] = {
    pieMode:       input.pieMode,
    dyslexiaMode:  input.dyslexia,
    adhdMode:      input.adhd,
    lowVisionMode: input.lowVision,
  }

  // ── Sugerencias adicionales ───────────────────────────────────────────────
  const suggestions: string[] = []

  if (input.pieMode && !input.dyslexia && !input.adhd && !input.lowVision) {
    suggestions.push("Activa un modo específico (Dislexia, TDAH o Baja visión) para mayor personalización.")
  }
  if (theme === "stem" && input.subject?.toLowerCase().includes("matemátic")) {
    suggestions.push("Puedes agregar imágenes de gráficos o fórmulas por pregunta para contexto visual.")
  }
  if (input.adhd) {
    suggestions.push("Para TDAH: considera máximo 5 preguntas por examen y usa preguntas cortas.")
    suggestions.push("Activa el modo 'una pregunta a la vez' si está disponible en el examen.")
  }
  if (input.dyslexia) {
    suggestions.push("Evita enunciados con más de 2 líneas. Divide preguntas complejas en partes.")
  }
  if (isBasicSchool(input.level)) {
    suggestions.push("Para básica: usa imágenes en las preguntas para apoyo visual.")
    suggestions.push("Considera máximo 8 preguntas y tiempo generoso (90 minutos).")
  }

  const reason = [themeReason, fontReason].filter(Boolean).join(" ")

  return {
    theme,
    font,
    reason,
    settings: { theme, font, accessibility },
    suggestions,
  }
}

/**
 * applyDesignToSettings — aplica la recomendación sobre settings existentes
 * respetando overrides manuales del docente.
 */
export function applyDesignToSettings(
  existingSettings: Record<string, unknown>,
  input: DesignInput
): Record<string, unknown> {
  const rec = recommendDesign(input)

  return {
    ...existingSettings,
    theme: input.manualTheme ?? rec.theme,
    font:  input.manualFont  ?? rec.font,
    accessibility: {
      ...(typeof existingSettings.accessibility === "object"
        ? existingSettings.accessibility as Record<string, unknown>
        : {}),
      ...rec.settings.accessibility,
    },
  }
}

/**
 * getSubjectSuggestions — devuelve sugerencias de configuración para una
 * asignatura específica sin necesidad de pasar todo el contexto.
 */
export function getSubjectSuggestions(subject: string): {
  theme: ExamTheme
  font:  ExamFont
  tips:  string[]
} {
  const key = subject.toLowerCase().trim()

  return {
    theme: SUBJECT_THEME_MAP[key] ?? "modern",
    font:  SUBJECT_FONT_MAP[key]  ?? "inter",
    tips: [
      subject.toLowerCase().includes("matemát") || subject.toLowerCase().includes("física")
        ? "Usa LaTeX para fórmulas: $\\\\frac{a}{b}$ o $$E=mc^2$$"
        : "",
      subject.toLowerCase().includes("biolog") || subject.toLowerCase().includes("quím")
        ? "Puedes agregar imágenes de células, moléculas o diagramas en cada pregunta."
        : "",
      subject.toLowerCase().includes("historia")
        ? "Las líneas de tiempo y mapas como imágenes enriquecen la evaluación."
        : "",
      subject.toLowerCase().includes("inglés") || subject.toLowerCase().includes("ingles")
        ? "Alterna preguntas en inglés y en español para contexto bilingüe."
        : "",
    ].filter(Boolean),
  }
}
