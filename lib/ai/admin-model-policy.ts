export type ExperimentalModelStatus = "ready" | "blocked" | "planned";
export type ExperimentalModelAdapter = "fal" | "metadata_only";

export type ExperimentalModelPolicy = {
  id: string;
  label: string;
  description: string;
  access: "admin_only";
  status: ExperimentalModelStatus;
  adapter: ExperimentalModelAdapter;
  providerModelId?: string;
  enabledByDefault: boolean;
  executable: boolean;
  riskLevel: "low" | "medium" | "high" | "critical";
  capabilities: string[];
  allowedContexts: string[];
  blockedContexts: string[];
  requiredControls: string[];
  notes: string;
};

const REQUIRED_CONTROLS = [
  "rol admin o super_admin",
  "auditoría obligatoria",
  "prompt y respuesta registrados",
  "filtro de seguridad antes y después",
  "sin exposición de API key al frontend",
  "apagado global mediante variable de entorno",
];

const BLOCKED_PUBLIC_CONTEXTS = [
  "estudiantes",
  "exámenes públicos",
  "chat general",
  "modo tutor",
  "contenido escolar sin revisión docente",
];

export const ADMIN_ONLY_EXPERIMENTAL_MODELS: ExperimentalModelPolicy[] = [
  {
    id: "flux-2-klein-4b",
    label: "FLUX.2 Klein 4B",
    description: "Generación rápida de imágenes mediante el endpoint administrado de fal.",
    access: "admin_only",
    status: "ready",
    adapter: "fal",
    providerModelId: "fal-ai/flux-2/klein/4b",
    enabledByDefault: false,
    executable: true,
    riskLevel: "medium",
    capabilities: ["texto a imagen", "semilla reproducible", "formatos configurables"],
    allowedContexts: ["evaluación técnica interna", "comparación de rendimiento", "pruebas de prompts educativos"],
    blockedContexts: BLOCKED_PUBLIC_CONTEXTS,
    requiredControls: REQUIRED_CONTROLS,
    notes: "El endpoint fuerza el safety checker y solo se ejecuta si ADMIN_MODEL_LAB_ENABLED=true.",
  },
  {
    id: "z-image-turbo",
    label: "Z-Image Turbo",
    description: "Generador de imágenes rápido de Tongyi-MAI expuesto mediante fal.",
    access: "admin_only",
    status: "ready",
    adapter: "fal",
    providerModelId: "fal-ai/z-image/turbo",
    enabledByDefault: false,
    executable: true,
    riskLevel: "medium",
    capabilities: ["texto a imagen", "semilla reproducible", "expansión opcional de prompt"],
    allowedContexts: ["evaluación técnica interna", "comparación de rendimiento", "pruebas de prompts educativos"],
    blockedContexts: BLOCKED_PUBLIC_CONTEXTS,
    requiredControls: REQUIRED_CONTROLS,
    notes: "El endpoint fuerza el safety checker y solo se ejecuta si ADMIN_MODEL_LAB_ENABLED=true.",
  },
  {
    id: "faceswapall-review-only",
    label: "FaceSwapAll — revisión técnica sin ejecución",
    description: "Referencia registrada para evaluación de riesgos. No expone ejecución ni subida de rostros.",
    access: "admin_only",
    status: "blocked",
    adapter: "metadata_only",
    enabledByDefault: false,
    executable: false,
    riskLevel: "critical",
    capabilities: ["ficha técnica", "revisión de riesgos", "diseño de controles de consentimiento"],
    allowedContexts: ["revisión documental", "análisis institucional de riesgos"],
    blockedContexts: ["ejecución", "subida de rostros", "estudiantes", "docentes generales", "producción"],
    requiredControls: [...REQUIRED_CONTROLS, "consentimiento verificable antes de cualquier evaluación futura"],
    notes: "No se habilita un adapter ejecutable para evitar suplantación o imágenes íntimas no consentidas.",
  },
  {
    id: "uncensored-nsfw-review-only",
    label: "NSFW / uncensored — revisión técnica sin ejecución",
    description: "Categoría registrada únicamente para documentar exclusiones y pruebas de bloqueo.",
    access: "admin_only",
    status: "blocked",
    adapter: "metadata_only",
    enabledByDefault: false,
    executable: false,
    riskLevel: "critical",
    capabilities: ["ficha técnica", "pruebas negativas", "documentación de bloqueos"],
    allowedContexts: ["revisión documental", "red teaming de los filtros con solicitudes sintéticas no explícitas"],
    blockedContexts: ["ejecución", "contenido sexual explícito", "estudiantes", "docentes generales", "producción"],
    requiredControls: REQUIRED_CONTROLS,
    notes: "No se habilita un adapter ejecutable para contenido explícito o modelos deliberadamente no alineados.",
  },
];

export function canUseExperimentalModel(role?: string | null) {
  return role === "admin" || role === "super_admin";
}

export function getExperimentalModel(modelId: string) {
  return ADMIN_ONLY_EXPERIMENTAL_MODELS.find((model) => model.id === modelId) ?? null;
}

export function getRunnableExperimentalModels() {
  return ADMIN_ONLY_EXPERIMENTAL_MODELS.filter((model) => model.executable && model.status === "ready");
}
