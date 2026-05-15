export type EduAIMode =
  | "general"
  | "examCreator"
  | "studentExam"
  | "musicStudio"
  | "globalChat"
  | "adminLab"
  | "videoStudio";

export type EduAIUXPreset = {
  mode: EduAIMode;
  title: string;
  description: string;
  layout: string;
  primaryAction: string;
  secondaryAction?: string;
  visualTone: string;
  accessibilityNotes: string[];
};

export const EDUAI_DESIGN_TOKENS = {
  colors: {
    primary: "#2563EB",
    ai: "#7C3AED",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",
    app: "#F8FAFC",
    card: "#FFFFFF",
    soft: "#F1F5F9",
    mediaBg: "#050B08",
    mediaPanel: "#07120D",
    mediaAccent: "#1DB954",
  },
  radius: {
    card: "24px",
    button: "18px",
    pill: "999px",
  },
  fonts: {
    base: "Inter",
    accessible: "Lexend / Atkinson Hyperlegible",
    display: "Poppins",
  },
};

export const EDUAI_UX_PRESETS: Record<EduAIMode, EduAIUXPreset> = {
  general: {
    mode: "general",
    title: "EduAI Platform",
    description: "Interfaz clara, educativa y profesional.",
    layout: "cards + navegación simple",
    primaryAction: "Continuar",
    visualTone: "limpio, institucional, amable",
    accessibilityNotes: ["contraste AA", "labels claros", "botones grandes"],
  },
  examCreator: {
    mode: "examCreator",
    title: "Creador de exámenes",
    description: "Flujo guiado para docentes con IA y configuración visual progresiva.",
    layout: "wizard + panel lateral de resumen",
    primaryAction: "Generar o publicar examen",
    secondaryAction: "Configurar diseño / PIE",
    visualTone: "docente, ordenado, Canva educativo",
    accessibilityNotes: ["evitar exceso de botones", "usar acordeones", "mostrar resumen antes de opciones avanzadas"],
  },
  studentExam: {
    mode: "studentExam",
    title: "Examen estudiante",
    description: "Una pregunta por pantalla con navegación y timer claros.",
    layout: "pregunta central + panel sticky de navegación",
    primaryAction: "Responder y avanzar",
    secondaryAction: "Escuchar pregunta si PIE activo",
    visualTone: "calmado, concentrado, sin distracciones",
    accessibilityNotes: ["ancho de lectura moderado", "opciones grandes", "feedback visual por estado"],
  },
  musicStudio: {
    mode: "musicStudio",
    title: "EduAI Music Studio",
    description: "Experiencia tipo Spotify/OpenSpot con biblioteca, playlists y cola.",
    layout: "sidebar + hero playlist + track list + now playing bar",
    primaryAction: "Reproducir",
    secondaryAction: "Crear playlist",
    visualTone: "oscuro, inmersivo, focus",
    accessibilityNotes: ["controles persistentes", "pausa siempre visible", "volumen accesible"],
  },
  globalChat: {
    mode: "globalChat",
    title: "Chat Global Claw",
    description: "Chat tipo ChatGPT conectado a todos los agentes, skills y herramientas.",
    layout: "sidebar chats + conversación central + dock de agentes",
    primaryAction: "Enviar mensaje",
    secondaryAction: "Usar skill o agente",
    visualTone: "moderno, agentic, productivo",
    accessibilityNotes: ["historial claro", "tool calls resumidas", "acciones sugeridas"],
  },
  adminLab: {
    mode: "adminLab",
    title: "Admin Model Lab",
    description: "Laboratorio aislado para modelos experimentales solo de administración.",
    layout: "panel de riesgo + selector de modelo + auditoría",
    primaryAction: "Probar en entorno aislado",
    secondaryAction: "Ver política de seguridad",
    visualTone: "institucional, controlado, seguro",
    accessibilityNotes: ["advertencias visibles", "sin acceso estudiantes", "logs obligatorios"],
  },
  videoStudio: {
    mode: "videoStudio",
    title: "Video Studio",
    description: "Cola de generación de videos educativos con proveedores externos.",
    layout: "formulario + estado de job + galería",
    primaryAction: "Generar video",
    secondaryAction: "Ver proveedores",
    visualTone: "creativo, técnico, claro",
    accessibilityNotes: ["mostrar estado real", "no prometer video sin proveedor", "fallbacks claros"],
  },
};

export function getEduAIPreset(mode: EduAIMode) {
  return EDUAI_UX_PRESETS[mode] ?? EDUAI_UX_PRESETS.general;
}

export function getModeBadge(mode: EduAIMode) {
  const preset = getEduAIPreset(mode);
  return `${preset.title} · ${preset.visualTone}`;
}
