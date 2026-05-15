// lib/exam/theme-utils.ts
// Sistema visual claro para exámenes EduAI: Canva + LaTeX + PIE/NEE.

export type ExamTheme =
  | "classic"
  | "modern"
  | "canva"
  | "pie_calm"
  | "adhd_focus"
  | "high_contrast"
  | "stem"
  | "kids";

export type ExamFont = "inter" | "lexend" | "atkinson" | "poppins";

export interface ExamAccessibility {
  pieMode?: boolean;
  dyslexiaMode?: boolean;
  adhdMode?: boolean;
  lowVisionMode?: boolean;
}

export interface ExamStyleSettings {
  theme?: ExamTheme;
  font?: ExamFont;
  accessibility?: ExamAccessibility;
}

export const THEME_LABELS: Record<ExamTheme, string> = {
  classic: "Clásico claro",
  modern: "Moderno suave",
  canva: "Canva educativo",
  pie_calm: "PIE calma",
  adhd_focus: "Foco TDAH",
  high_contrast: "Alta legibilidad",
  stem: "STEM claro",
  kids: "Kids visual",
};

export const THEME_DESCRIPTIONS: Record<ExamTheme, string> = {
  classic: "Blanco cálido, texto oscuro y estructura formal.",
  modern: "Minimalista, tarjetas limpias y azul institucional.",
  canva: "Colores pastel, tarjetas grandes y estilo guía visual.",
  pie_calm: "Fondo crema, baja carga visual y lectura cómoda.",
  adhd_focus: "Una tarea a la vez, foco marcado y poco ruido.",
  high_contrast: "Texto muy oscuro, fondo claro cálido y bordes definidos.",
  stem: "Azules claros para matemática, ciencia y tecnología.",
  kids: "Tonos cálidos, amigables y alto apoyo visual.",
};

export const THEME_VARS: Record<ExamTheme, Record<string, string>> = {
  classic: {
    "--exam-bg": "#f8fafc",
    "--exam-surface": "#ffffff",
    "--exam-card-bg": "#ffffff",
    "--exam-soft-bg": "#f1f5f9",
    "--exam-border": "#dbe3ef",
    "--exam-text": "#0f172a",
    "--exam-text-sub": "#475569",
    "--exam-muted": "#64748b",
    "--exam-accent": "#2563eb",
    "--exam-accent-soft": "#dbeafe",
    "--exam-success": "#047857",
    "--exam-warning": "#b45309",
    "--exam-radius": "22px",
    "--exam-spacing": "1.35rem",
    "--exam-font-size": "16px",
    "--exam-line-height": "1.75",
  },
  modern: {
    "--exam-bg": "#f7f9fc",
    "--exam-surface": "#ffffff",
    "--exam-card-bg": "#ffffff",
    "--exam-soft-bg": "#eef4ff",
    "--exam-border": "#d7e2f2",
    "--exam-text": "#111827",
    "--exam-text-sub": "#4b5563",
    "--exam-muted": "#6b7280",
    "--exam-accent": "#4f46e5",
    "--exam-accent-soft": "#e0e7ff",
    "--exam-success": "#047857",
    "--exam-warning": "#b45309",
    "--exam-radius": "26px",
    "--exam-spacing": "1.5rem",
    "--exam-font-size": "16px",
    "--exam-line-height": "1.75",
  },
  canva: {
    "--exam-bg": "#f5f7ff",
    "--exam-surface": "#ffffff",
    "--exam-card-bg": "#ffffff",
    "--exam-soft-bg": "#eef2ff",
    "--exam-border": "#c7d2fe",
    "--exam-text": "#1e1b4b",
    "--exam-text-sub": "#4f46e5",
    "--exam-muted": "#6366f1",
    "--exam-accent": "#5b5bd6",
    "--exam-accent-soft": "#e0e7ff",
    "--exam-success": "#047857",
    "--exam-warning": "#b45309",
    "--exam-radius": "30px",
    "--exam-spacing": "1.65rem",
    "--exam-font-size": "16px",
    "--exam-line-height": "1.8",
  },
  pie_calm: {
    "--exam-bg": "#fbf7ed",
    "--exam-surface": "#fffdf7",
    "--exam-card-bg": "#fffdf7",
    "--exam-soft-bg": "#f4ecd9",
    "--exam-border": "#ded0ad",
    "--exam-text": "#1f2933",
    "--exam-text-sub": "#5f5a4e",
    "--exam-muted": "#746d5d",
    "--exam-accent": "#2f6f73",
    "--exam-accent-soft": "#d9f0eb",
    "--exam-success": "#047857",
    "--exam-warning": "#92400e",
    "--exam-radius": "26px",
    "--exam-spacing": "1.85rem",
    "--exam-font-size": "17px",
    "--exam-line-height": "1.95",
  },
  adhd_focus: {
    "--exam-bg": "#f8fafc",
    "--exam-surface": "#ffffff",
    "--exam-card-bg": "#ffffff",
    "--exam-soft-bg": "#e0f2fe",
    "--exam-border": "#bae6fd",
    "--exam-text": "#0f172a",
    "--exam-text-sub": "#334155",
    "--exam-muted": "#64748b",
    "--exam-accent": "#0369a1",
    "--exam-accent-soft": "#e0f2fe",
    "--exam-success": "#047857",
    "--exam-warning": "#b45309",
    "--exam-radius": "24px",
    "--exam-spacing": "2rem",
    "--exam-font-size": "17px",
    "--exam-line-height": "2.0",
  },
  high_contrast: {
    "--exam-bg": "#fffbea",
    "--exam-surface": "#ffffff",
    "--exam-card-bg": "#ffffff",
    "--exam-soft-bg": "#fef3c7",
    "--exam-border": "#111827",
    "--exam-text": "#000000",
    "--exam-text-sub": "#1f2937",
    "--exam-muted": "#374151",
    "--exam-accent": "#1d4ed8",
    "--exam-accent-soft": "#dbeafe",
    "--exam-success": "#065f46",
    "--exam-warning": "#92400e",
    "--exam-radius": "18px",
    "--exam-spacing": "1.85rem",
    "--exam-font-size": "18px",
    "--exam-line-height": "1.95",
  },
  stem: {
    "--exam-bg": "#eef7ff",
    "--exam-surface": "#ffffff",
    "--exam-card-bg": "#ffffff",
    "--exam-soft-bg": "#dff3ff",
    "--exam-border": "#b7dff6",
    "--exam-text": "#0f172a",
    "--exam-text-sub": "#075985",
    "--exam-muted": "#0369a1",
    "--exam-accent": "#0284c7",
    "--exam-accent-soft": "#e0f2fe",
    "--exam-success": "#047857",
    "--exam-warning": "#b45309",
    "--exam-radius": "24px",
    "--exam-spacing": "1.5rem",
    "--exam-font-size": "16px",
    "--exam-line-height": "1.75",
  },
  kids: {
    "--exam-bg": "#fff8ed",
    "--exam-surface": "#ffffff",
    "--exam-card-bg": "#ffffff",
    "--exam-soft-bg": "#ffedd5",
    "--exam-border": "#fed7aa",
    "--exam-text": "#431407",
    "--exam-text-sub": "#7c2d12",
    "--exam-muted": "#9a3412",
    "--exam-accent": "#ea580c",
    "--exam-accent-soft": "#ffedd5",
    "--exam-success": "#047857",
    "--exam-warning": "#b45309",
    "--exam-radius": "32px",
    "--exam-spacing": "1.85rem",
    "--exam-font-size": "18px",
    "--exam-line-height": "2.0",
  },
};

export const FONT_URLS: Record<ExamFont, string | null> = {
  inter: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
  lexend: "https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700;800&display=swap",
  atkinson: "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap",
  poppins: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap",
};

export const FONT_FAMILIES: Record<ExamFont, string> = {
  inter: "'Inter', system-ui, sans-serif",
  lexend: "'Lexend', system-ui, sans-serif",
  atkinson: "'Atkinson Hyperlegible', system-ui, sans-serif",
  poppins: "'Poppins', system-ui, sans-serif",
};

export interface ResolvedExamStyle {
  cssVars: Record<string, string>;
  fontUrl: string | null;
  fontFamily: string;
  bodyClass: string;
  maxWidth: string;
}

export function resolveExamStyle(settings?: ExamStyleSettings): ResolvedExamStyle {
  const theme = settings?.theme || "classic";
  const font = settings?.font || "inter";
  const access = settings?.accessibility || {};

  let finalFont = font;
  if (access.dyslexiaMode && font === "inter") finalFont = "lexend";
  if (access.lowVisionMode && font === "inter") finalFont = "atkinson";

  const baseVars = THEME_VARS[theme] || THEME_VARS.classic;
  const extraVars: Record<string, string> = {};

  if (access.pieMode && theme === "classic") Object.assign(extraVars, THEME_VARS.pie_calm);
  if (access.dyslexiaMode) {
    extraVars["--exam-bg"] = extraVars["--exam-bg"] || "#fbf7ed";
    extraVars["--exam-line-height"] = "1.95";
    extraVars["--exam-font-size"] = "17px";
  }
  if (access.adhdMode) {
    extraVars["--exam-spacing"] = "2rem";
    extraVars["--exam-line-height"] = "2.05";
    extraVars["--exam-font-size"] = "17px";
  }
  if (access.lowVisionMode) {
    extraVars["--exam-font-size"] = "19px";
    extraVars["--exam-line-height"] = "2.0";
    extraVars["--exam-text"] = "#000000";
    extraVars["--exam-border"] = "#111827";
  }

  const cssVars = { ...baseVars, ...extraVars };
  const bodyClasses: string[] = [];
  if (access.dyslexiaMode) bodyClasses.push("exam-dyslexia");
  if (access.adhdMode) bodyClasses.push("exam-adhd");
  if (access.lowVisionMode) bodyClasses.push("exam-low-vision");
  if (theme === "canva") bodyClasses.push("exam-canva-theme");
  if (theme === "adhd_focus") bodyClasses.push("exam-adhd-theme");

  const maxWidth = access.adhdMode || theme === "adhd_focus" ? "760px" : "980px";

  return {
    cssVars,
    fontUrl: FONT_URLS[finalFont],
    fontFamily: FONT_FAMILIES[finalFont],
    bodyClass: bodyClasses.join(" "),
    maxWidth,
  };
}

export function buildExamStyleTag(resolved: ResolvedExamStyle): string {
  const vars = Object.entries(resolved.cssVars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");

  return `
.exam-root {
${vars}
  --exam-font-family: ${resolved.fontFamily};
  font-family: var(--exam-font-family);
  font-size: var(--exam-font-size);
  line-height: var(--exam-line-height);
  color: var(--exam-text);
  background: radial-gradient(circle at top left, color-mix(in srgb, var(--exam-accent) 10%, transparent), transparent 30%), var(--exam-bg);
}
.exam-content { max-width: ${resolved.maxWidth}; margin: 0 auto; }
.exam-shell-card {
  background: var(--exam-surface);
  border: 1px solid var(--exam-border);
  border-radius: calc(var(--exam-radius) + 8px);
  box-shadow: 0 18px 45px rgba(15,23,42,.08);
}
.exam-question {
  background-color: var(--exam-card-bg) !important;
  border: 1px solid var(--exam-border) !important;
  border-radius: var(--exam-radius) !important;
  padding: var(--exam-spacing) !important;
  color: var(--exam-text) !important;
  box-shadow: 0 12px 30px rgba(15,23,42,.07);
}
.exam-question-title { color: var(--exam-text) !important; }
.exam-question-meta { color: var(--exam-text-sub) !important; }
.exam-option {
  border-radius: calc(var(--exam-radius) - 4px) !important;
  border: 1px solid var(--exam-border) !important;
  background-color: var(--exam-surface) !important;
  font-size: var(--exam-font-size) !important;
  line-height: var(--exam-line-height) !important;
  color: var(--exam-text) !important;
}
.exam-option.selected {
  border-color: var(--exam-accent) !important;
  background-color: var(--exam-accent-soft) !important;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--exam-accent) 12%, transparent);
}
.exam-option:hover:not(.selected) { border-color: var(--exam-accent) !important; }
.exam-input {
  background: var(--exam-surface) !important;
  border: 1px solid var(--exam-border) !important;
  border-radius: calc(var(--exam-radius) - 4px) !important;
  color: var(--exam-text) !important;
}
.exam-badge {
  background: var(--exam-accent-soft);
  color: var(--exam-accent);
  border: 1px solid color-mix(in srgb, var(--exam-accent) 20%, transparent);
}
.exam-progress-track { background: var(--exam-soft-bg); border: 1px solid var(--exam-border); }
.exam-progress-fill { background: var(--exam-accent); }
.exam-dyslexia .exam-question,
.exam-dyslexia .exam-option,
.exam-dyslexia .exam-input { letter-spacing: 0.025em; word-spacing: 0.12em; }
.exam-adhd .exam-question { padding: 2rem !important; }
.exam-adhd .exam-option { margin-bottom: 0.75rem !important; padding: 1rem 1.25rem !important; }
.exam-low-vision .exam-question { font-size: 19px !important; }
.exam-low-vision .exam-option { font-size: 18px !important; min-height: 58px !important; }
.exam-question-image {
  border-radius: calc(var(--exam-radius) - 6px);
  overflow: hidden;
  margin-bottom: 1.25rem;
  max-height: 320px;
  border: 1px solid var(--exam-border);
  background: var(--exam-soft-bg);
}
.exam-question-image img { width: 100%; height: 100%; object-fit: contain; }
.exam-root .katex { font-size: 1.04em; }
.exam-root .katex-display {
  overflow-x: auto;
  overflow-y: hidden;
  padding: .75rem 1rem;
  border-radius: calc(var(--exam-radius) - 8px);
  background: var(--exam-soft-bg);
  border: 1px solid var(--exam-border);
}
`.trim();
}
