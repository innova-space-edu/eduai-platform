import type { EduAIDesignFormat, EduAIDesignTemplate } from "./types"

const ALL_CREATOR_FORMATS: EduAIDesignFormat[] = [
  "infographic",
  "ppt",
  "poster",
  "podcast",
  "mindmap",
  "flashcards",
  "quiz",
  "timeline",
  "cornell",
  "glossary",
  "story",
  "song",
  "lessonplan",
  "worksheet",
  "card",
  "generic",
]

export const DESIGN_TEMPLATES: EduAIDesignTemplate[] = [
  {
    id: "eduai-canva-classroom",
    name: "EduAI Canva Classroom",
    shortName: "Canva Aula",
    description: "Plantilla moderna, clara y colorida para material escolar imprimible y digital.",
    category: "educational",
    mood: "canva",
    density: "rich",
    surface: "light",
    formats: ALL_CREATOR_FORMATS,
    accentColor: "#7c3aed",
    palette: {
      primary: "#7c3aed",
      secondary: "#06b6d4",
      accent: "#f59e0b",
      background: "#f8fafc",
      surface: "#ffffff",
      text: "#111827",
      muted: "#64748b",
      success: "#10b981",
      warning: "#f59e0b",
      danger: "#ef4444",
    },
    tags: ["aula", "canva", "general", "pdf", "presentacion"],
    layoutHints: [
      "Usar tarjetas con bordes redondeados y sombras suaves.",
      "Separar ideas en bloques visuales con iconos educativos.",
      "Incluir llamadas visuales tipo dato clave, pregunta guía y conclusión.",
      "Priorizar legibilidad para estudiantes y docentes.",
    ],
    visualElements: ["badges", "cards", "iconos", "ondas suaves", "bloques coloridos"],
    promptDirective: "Diseña el contenido como material educativo estilo Canva: bloques visuales, títulos breves, jerarquía clara, iconos sugeridos, datos clave destacados, actividades accionables y texto listo para exportar a PDF/PPTX.",
    export: {
      pdfHeader: "hero",
      pptTheme: "gradient",
      cardRadius: 5,
      useDecorations: true,
      pageBackground: "#f8fafc",
    },
  },
  {
    id: "presenton-pro-slides",
    name: "Presenton Pro Slides",
    shortName: "Presenton Pro",
    description: "Base tipo Presenton: portada fuerte, agenda, secciones, bloques visuales y slides exportables.",
    category: "presentation",
    mood: "clean",
    density: "balanced",
    surface: "gradient",
    formats: ["ppt", "infographic", "timeline", "lessonplan", "report", "generic"],
    accentColor: "#2563eb",
    palette: {
      primary: "#2563eb",
      secondary: "#7c3aed",
      accent: "#22c55e",
      background: "#eff6ff",
      surface: "#ffffff",
      text: "#0f172a",
      muted: "#64748b",
      success: "#22c55e",
      warning: "#f59e0b",
      danger: "#ef4444",
    },
    tags: ["presentaciones", "slides", "presenton", "pptx", "moderno"],
    layoutHints: [
      "Crear una narrativa slide por slide con progresión lógica.",
      "Usar máximo 4 bullets por slide y notas del expositor.",
      "Agregar slides de agenda, dato clave, comparación y cierre.",
      "Sugerir imágenes o diagramas por slide cuando corresponda.",
    ],
    visualElements: ["hero slide", "section divider", "stats grid", "speaker notes"],
    promptDirective: "Estructura el resultado como una presentación profesional inspirada en Presenton: portada, agenda, secciones, slides con intención visual, notas del orador, sugerencias de imagen y cierre memorable.",
    export: {
      pdfHeader: "split",
      pptTheme: "gradient",
      cardRadius: 4,
      useDecorations: true,
      pageBackground: "#eff6ff",
    },
  },
  {
    id: "steam-lab-modern",
    name: "STEAM Lab Modern",
    shortName: "STEAM Lab",
    description: "Ideal para ciencias, tecnología, experimentos, informes, laboratorios y ferias escolares.",
    category: "educational",
    mood: "futuristic",
    density: "rich",
    surface: "light",
    formats: ["infographic", "poster", "ppt", "timeline", "lessonplan", "worksheet", "report", "quiz", "generic"],
    accentColor: "#0891b2",
    palette: {
      primary: "#0891b2",
      secondary: "#0f766e",
      accent: "#a3e635",
      background: "#ecfeff",
      surface: "#ffffff",
      text: "#083344",
      muted: "#64748b",
      success: "#10b981",
      warning: "#eab308",
      danger: "#ef4444",
    },
    tags: ["steam", "ciencias", "laboratorio", "experimentos", "feria"],
    layoutHints: [
      "Incluir secciones de hipótesis, procedimiento, datos, análisis y conclusión cuando aplique.",
      "Usar visuales tipo laboratorio: moléculas, grillas, etiquetas y recuadros de seguridad.",
      "Agregar preguntas de investigación y evidencia esperada.",
      "Conectar el contenido con aplicación real o escolar.",
    ],
    visualElements: ["moléculas", "grillas", "cápsulas", "diagramas", "etiquetas de evidencia"],
    promptDirective: "Convierte el contenido en material STEAM moderno: hipótesis, procedimiento, evidencia, análisis de datos, preguntas guía, iconos científicos y aplicaciones reales para estudiantes.",
    export: {
      pdfHeader: "hero",
      pptTheme: "light",
      cardRadius: 4,
      useDecorations: true,
      pageBackground: "#ecfeff",
    },
  },
  {
    id: "minimal-print-friendly",
    name: "Minimal Print Friendly",
    shortName: "Imprimible",
    description: "Diseño limpio para guías, evaluaciones, rúbricas y documentos con bajo consumo de tinta.",
    category: "print",
    mood: "academic",
    density: "balanced",
    surface: "paper",
    formats: ["quiz", "flashcards", "cornell", "glossary", "lessonplan", "exam", "planning", "report", "worksheet", "generic"],
    accentColor: "#334155",
    palette: {
      primary: "#334155",
      secondary: "#64748b",
      accent: "#2563eb",
      background: "#ffffff",
      surface: "#ffffff",
      text: "#111827",
      muted: "#6b7280",
      success: "#047857",
      warning: "#b45309",
      danger: "#b91c1c",
    },
    tags: ["imprimir", "rubrica", "guia", "evaluacion", "bajo consumo"],
    layoutHints: [
      "Evitar fondos oscuros y exceso de color.",
      "Usar tablas limpias, espacios de respuesta y títulos jerárquicos.",
      "Priorizar claridad, márgenes amplios y secciones numeradas.",
      "Mantener formato apto para fotocopia escolar.",
    ],
    visualElements: ["tablas", "líneas de respuesta", "secciones numeradas", "checklists"],
    promptDirective: "Genera contenido imprimible, limpio y ordenado: títulos claros, tablas, espacios de respuesta, instrucciones precisas, pocas tintas y excelente legibilidad.",
    export: {
      pdfHeader: "minimal",
      pptTheme: "paper",
      cardRadius: 2,
      useDecorations: false,
      pageBackground: "#ffffff",
    },
  },
  {
    id: "admin-pro-dashboard",
    name: "Admin Pro Dashboard",
    shortName: "Admin Pro",
    description: "Reportes, análisis, métricas, paneles y documentos ejecutivos para administrador/docente.",
    category: "assessment",
    mood: "editorial",
    density: "max",
    surface: "light",
    formats: ["report", "exam", "planning", "ppt", "infographic", "timeline", "generic"],
    accentColor: "#4f46e5",
    palette: {
      primary: "#4f46e5",
      secondary: "#0ea5e9",
      accent: "#f97316",
      background: "#f8fafc",
      surface: "#ffffff",
      text: "#111827",
      muted: "#64748b",
      success: "#16a34a",
      warning: "#d97706",
      danger: "#dc2626",
    },
    tags: ["admin", "reportes", "dashboard", "analitica", "docente"],
    layoutHints: [
      "Destacar métricas en tarjetas KPI.",
      "Separar hallazgos, riesgos, acciones y próximos pasos.",
      "Usar visuales tipo dashboard educativo con tablas y porcentajes.",
      "Incluir recomendaciones accionables para el docente o administrador.",
    ],
    visualElements: ["KPI cards", "tablas", "badges", "riesgos", "semáforos"],
    promptDirective: "Estructura como reporte ejecutivo educativo: KPIs, hallazgos, riesgos, evidencias, recomendaciones priorizadas y acciones siguientes con diseño tipo dashboard.",
    export: {
      pdfHeader: "band",
      pptTheme: "light",
      cardRadius: 4,
      useDecorations: true,
      pageBackground: "#f8fafc",
    },
  },
  {
    id: "dark-neon-showcase",
    name: "Dark Neon Showcase",
    shortName: "Neón",
    description: "Diseño llamativo para pantallas, exposiciones, posters digitales y proyectos innovadores.",
    category: "brand",
    mood: "futuristic",
    density: "rich",
    surface: "dark",
    formats: ["ppt", "poster", "infographic", "mindmap", "timeline", "card", "generic"],
    accentColor: "#a855f7",
    palette: {
      primary: "#a855f7",
      secondary: "#22d3ee",
      accent: "#f472b6",
      background: "#020617",
      surface: "#0f172a",
      text: "#f8fafc",
      muted: "#94a3b8",
      success: "#22c55e",
      warning: "#facc15",
      danger: "#fb7185",
    },
    tags: ["neon", "pantalla", "futurista", "innovacion", "expo"],
    layoutHints: [
      "Usar alto contraste para pantalla, no para documentos extensos imprimibles.",
      "Crear secciones cortas, visuales grandes y texto breve.",
      "Agregar brillos, contornos y bloques con gradientes.",
      "Ideal para presentaciones y afiches digitales.",
    ],
    visualElements: ["gradientes", "glow", "líneas futuristas", "tarjetas oscuras"],
    promptDirective: "Diseña para pantalla con estilo futurista: textos breves, alto impacto visual, gradientes, datos clave grandes, secciones dinámicas y lenguaje motivador.",
    export: {
      pdfHeader: "hero",
      pptTheme: "dark",
      cardRadius: 5,
      useDecorations: true,
      pageBackground: "#020617",
    },
  },
]

const DEFAULT_BY_FORMAT: Partial<Record<EduAIDesignFormat, string>> = {
  ppt: "presenton-pro-slides",
  infographic: "eduai-canva-classroom",
  poster: "dark-neon-showcase",
  mindmap: "dark-neon-showcase",
  timeline: "presenton-pro-slides",
  flashcards: "minimal-print-friendly",
  quiz: "minimal-print-friendly",
  cornell: "minimal-print-friendly",
  glossary: "minimal-print-friendly",
  lessonplan: "eduai-canva-classroom",
  podcast: "eduai-canva-classroom",
  exam: "minimal-print-friendly",
  planning: "admin-pro-dashboard",
  report: "admin-pro-dashboard",
  worksheet: "minimal-print-friendly",
  card: "eduai-canva-classroom",
  generic: "eduai-canva-classroom",
}

export function getDesignTemplate(templateId?: string | null, format?: string): EduAIDesignTemplate {
  const safeFormat = normalizeFormat(format)
  const fallbackId = safeFormat ? DEFAULT_BY_FORMAT[safeFormat] : "eduai-canva-classroom"
  return (
    DESIGN_TEMPLATES.find((t) => t.id === templateId) ||
    DESIGN_TEMPLATES.find((t) => t.id === fallbackId) ||
    DESIGN_TEMPLATES[0]
  )
}

export function normalizeFormat(format?: string | null): EduAIDesignFormat | undefined {
  if (!format) return undefined
  const f = String(format).trim() as EduAIDesignFormat
  const all = new Set<EduAIDesignFormat>([
    ...ALL_CREATOR_FORMATS,
    "exam",
    "planning",
    "report",
  ])
  return all.has(f) ? f : "generic"
}

export function getDefaultDesignTemplateId(format?: string | null): string {
  const normalized = normalizeFormat(format)
  return (normalized && DEFAULT_BY_FORMAT[normalized]) || "eduai-canva-classroom"
}

export function getCompatibleDesignTemplates(format?: string | null): EduAIDesignTemplate[] {
  const normalized = normalizeFormat(format)
  if (!normalized) return DESIGN_TEMPLATES
  return DESIGN_TEMPLATES.filter((template) => template.formats.includes(normalized) || template.formats.includes("generic"))
}

export function buildDesignPromptDirective(templateId?: string | null, format?: string | null): string {
  const template = getDesignTemplate(templateId, format || undefined)
  return `\n\nDIRECTRIZ VISUAL EDUAI DESIGN ENGINE:\n- Plantilla seleccionada: ${template.name}.\n- Estilo: ${template.mood}; densidad: ${template.density}; superficie: ${template.surface}.\n- Paleta sugerida: primario ${template.palette.primary}, secundario ${template.palette.secondary}, acento ${template.palette.accent}.\n- Elementos visuales esperados: ${template.visualElements.join(", ")}.\n- Reglas de composición: ${template.layoutHints.join(" ")}\n- Instrucción central: ${template.promptDirective}\n- Devuelve campos textuales útiles para renderizar; cuando corresponda, incluye sugerencias de icono, imagen, layout o nota visual en las propiedades existentes del JSON.\n`
}

export function getDesignTemplateSummary(templateId?: string | null, format?: string | null) {
  const t = getDesignTemplate(templateId, format || undefined)
  return {
    templateId: t.id,
    name: t.name,
    shortName: t.shortName,
    accentColor: t.accentColor,
    palette: t.palette,
    mood: t.mood,
    density: t.density,
    surface: t.surface,
    tags: t.tags,
  }
}
