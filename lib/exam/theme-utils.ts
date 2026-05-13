// lib/exam/theme-utils.ts
// ─────────────────────────────────────────────────────────────────────────────
// Convierte exam.settings (theme, font, accessibility) en CSS vars y clases
// Usado en ExamThemeProvider y ExamRenderer.
// ─────────────────────────────────────────────────────────────────────────────

export type ExamTheme =
  | "classic" | "modern" | "canva" | "pie_calm"
  | "adhd_focus" | "high_contrast" | "stem" | "kids"

export type ExamFont = "inter" | "lexend" | "atkinson" | "poppins"

export interface ExamAccessibility {
  pieMode?:      boolean
  dyslexiaMode?: boolean
  adhdMode?:     boolean
  lowVisionMode?: boolean
}

export interface ExamStyleSettings {
  theme?:        ExamTheme
  font?:         ExamFont
  accessibility?: ExamAccessibility
}

// ── CSS vars por tema ─────────────────────────────────────────────────────────

export const THEME_VARS: Record<ExamTheme, Record<string, string>> = {
  classic: {
    "--exam-bg":          "#ffffff",
    "--exam-card-bg":     "#f8f9fa",
    "--exam-border":      "#e2e8f0",
    "--exam-text":        "#1a202c",
    "--exam-text-sub":    "#64748b",
    "--exam-accent":      "#2563eb",
    "--exam-radius":      "16px",
    "--exam-spacing":     "1.5rem",
    "--exam-font-size":   "16px",
    "--exam-line-height": "1.6",
  },
  modern: {
    "--exam-bg":          "#fafafa",
    "--exam-card-bg":     "#ffffff",
    "--exam-border":      "#ebebeb",
    "--exam-text":        "#111111",
    "--exam-text-sub":    "#888888",
    "--exam-accent":      "#6366f1",
    "--exam-radius":      "24px",
    "--exam-spacing":     "1.75rem",
    "--exam-font-size":   "16px",
    "--exam-line-height": "1.7",
  },
  canva: {
    "--exam-bg":          "#f0f4ff",
    "--exam-card-bg":     "#ffffff",
    "--exam-border":      "#c7d2fe",
    "--exam-text":        "#1e1b4b",
    "--exam-text-sub":    "#6366f1",
    "--exam-accent":      "#6c63ff",
    "--exam-radius":      "24px",
    "--exam-spacing":     "1.75rem",
    "--exam-font-size":   "16px",
    "--exam-line-height": "1.7",
  },
  pie_calm: {
    "--exam-bg":          "#f7f3e8",
    "--exam-card-bg":     "#fefcf5",
    "--exam-border":      "#d4c89a",
    "--exam-text":        "#2d2a1e",
    "--exam-text-sub":    "#6b5e3e",
    "--exam-accent":      "#8b7355",
    "--exam-radius":      "20px",
    "--exam-spacing":     "2rem",
    "--exam-font-size":   "17px",
    "--exam-line-height": "1.9",
  },
  adhd_focus: {
    "--exam-bg":          "#fafafa",
    "--exam-card-bg":     "#ffffff",
    "--exam-border":      "#d1d5db",
    "--exam-text":        "#111827",
    "--exam-text-sub":    "#6b7280",
    "--exam-accent":      "#0ea5e9",
    "--exam-radius":      "20px",
    "--exam-spacing":     "2.5rem",
    "--exam-font-size":   "17px",
    "--exam-line-height": "2.0",
  },
  high_contrast: {
    "--exam-bg":          "#000000",
    "--exam-card-bg":     "#111111",
    "--exam-border":      "#ffffff",
    "--exam-text":        "#ffffff",
    "--exam-text-sub":    "#cccccc",
    "--exam-accent":      "#ffff00",
    "--exam-radius":      "12px",
    "--exam-spacing":     "2rem",
    "--exam-font-size":   "18px",
    "--exam-line-height": "1.9",
  },
  stem: {
    "--exam-bg":          "#0f172a",
    "--exam-card-bg":     "#1e293b",
    "--exam-border":      "#334155",
    "--exam-text":        "#f8fafc",
    "--exam-text-sub":    "#94a3b8",
    "--exam-accent":      "#38bdf8",
    "--exam-radius":      "16px",
    "--exam-spacing":     "1.5rem",
    "--exam-font-size":   "16px",
    "--exam-line-height": "1.7",
  },
  kids: {
    "--exam-bg":          "#fff9f0",
    "--exam-card-bg":     "#ffffff",
    "--exam-border":      "#fed7aa",
    "--exam-text":        "#431407",
    "--exam-text-sub":    "#92400e",
    "--exam-accent":      "#f97316",
    "--exam-radius":      "28px",
    "--exam-spacing":     "2rem",
    "--exam-font-size":   "18px",
    "--exam-line-height": "2.0",
  },
}

// ── Google Fonts URL por fuente ───────────────────────────────────────────────

export const FONT_URLS: Record<ExamFont, string | null> = {
  inter:    "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
  lexend:   "https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&display=swap",
  atkinson: "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap",
  poppins:  "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap",
}

export const FONT_FAMILIES: Record<ExamFont, string> = {
  inter:    "'Inter', sans-serif",
  lexend:   "'Lexend', sans-serif",
  atkinson: "'Atkinson Hyperlegible', sans-serif",
  poppins:  "'Poppins', sans-serif",
}

// ── Resolución de estilos finales ─────────────────────────────────────────────

export interface ResolvedExamStyle {
  cssVars:    Record<string, string>
  fontUrl:    string | null
  fontFamily: string
  bodyClass:  string   // clases extras para el body del examen
  maxWidth:   string   // ADHD: más angosto para foco
}

export function resolveExamStyle(settings?: ExamStyleSettings): ResolvedExamStyle {
  const theme  = settings?.theme  || "classic"
  const font   = settings?.font   || "inter"
  const access = settings?.accessibility || {}

  // Ajustar fuente automáticamente según modo PIE
  let finalFont = font
  if (access.dyslexiaMode && font === "inter") finalFont = "lexend"
  if (access.lowVisionMode && font === "inter") finalFont = "atkinson"

  const baseVars  = THEME_VARS[theme] || THEME_VARS.classic
  const extraVars: Record<string, string> = {}

  // PIE Calm auto-override si está activado sin tema específico
  if (access.pieMode && theme === "classic") {
    Object.assign(extraVars, THEME_VARS.pie_calm)
  }

  // ADHD: más espaciado y fuente más grande
  if (access.adhdMode) {
    extraVars["--exam-spacing"]     = "2.5rem"
    extraVars["--exam-line-height"] = "2.1"
    extraVars["--exam-font-size"]   = "17px"
  }

  // Low vision: alto contraste si no tiene tema ya
  if (access.lowVisionMode && theme === "classic") {
    extraVars["--exam-font-size"]   = "19px"
    extraVars["--exam-line-height"] = "2.0"
    extraVars["--exam-bg"]          = "#fffef0"
    extraVars["--exam-text"]        = "#000000"
  }

  const cssVars = { ...baseVars, ...extraVars }

  // Clases del body para comportamiento extra
  const bodyClasses: string[] = []
  if (access.dyslexiaMode)  bodyClasses.push("exam-dyslexia")
  if (access.adhdMode)      bodyClasses.push("exam-adhd")
  if (access.lowVisionMode) bodyClasses.push("exam-low-vision")
  if (theme === "adhd_focus") bodyClasses.push("exam-adhd-theme")

  // Max-width por tema
  const maxWidth = access.adhdMode || theme === "adhd_focus" ? "700px" : "900px"

  return {
    cssVars,
    fontUrl:    FONT_URLS[finalFont],
    fontFamily: FONT_FAMILIES[finalFont],
    bodyClass:  bodyClasses.join(" "),
    maxWidth,
  }
}

// ── Estilos CSS para inyectar en <style> ──────────────────────────────────────

export function buildExamStyleTag(resolved: ResolvedExamStyle): string {
  const vars = Object.entries(resolved.cssVars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n")

  return `
.exam-root {
${vars}
  --exam-font-family: ${resolved.fontFamily};
  font-family: var(--exam-font-family);
  font-size: var(--exam-font-size);
  line-height: var(--exam-line-height);
}

/* Fondo */
.exam-root { background-color: var(--exam-bg); }
.exam-content { max-width: ${resolved.maxWidth}; margin: 0 auto; }

/* Card de pregunta */
.exam-question {
  background-color: var(--exam-card-bg) !important;
  border-color: var(--exam-border) !important;
  border-radius: var(--exam-radius) !important;
  padding: var(--exam-spacing) !important;
  color: var(--exam-text) !important;
}

/* Botones de alternativa */
.exam-option {
  border-radius: var(--exam-radius) !important;
  border-color: var(--exam-border) !important;
  background-color: var(--exam-card-bg) !important;
  font-size: var(--exam-font-size) !important;
  line-height: var(--exam-line-height) !important;
  color: var(--exam-text) !important;
}
.exam-option.selected {
  border-color: var(--exam-accent) !important;
  background-color: color-mix(in srgb, var(--exam-accent) 12%, transparent) !important;
}
.exam-option:hover:not(.selected) {
  border-color: color-mix(in srgb, var(--exam-accent) 40%, transparent) !important;
}

/* Dislexia: mayor espaciado entre letras */
.exam-dyslexia .exam-question,
.exam-dyslexia .exam-option {
  letter-spacing: 0.04em;
  word-spacing: 0.12em;
}

/* ADHD: bloques bien separados */
.exam-adhd .exam-question { padding: 2.5rem !important; }
.exam-adhd .exam-option   { margin-bottom: 0.75rem !important; padding: 1rem 1.25rem !important; }

/* Baja visión */
.exam-low-vision .exam-question { font-size: 19px !important; }
.exam-low-vision .exam-option   { font-size: 18px !important; min-height: 56px !important; }

/* Imagen de pregunta */
.exam-question-image {
  border-radius: calc(var(--exam-radius) - 4px);
  overflow: hidden;
  margin-bottom: 1.25rem;
  max-height: 320px;
  border: 1px solid var(--exam-border);
}
.exam-question-image img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: var(--exam-bg);
}
`.trim()
}
