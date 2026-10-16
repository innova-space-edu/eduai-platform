/** Single source of truth for Model Lab navigation, also used for deep-link tests. */
export const MODEL_LAB_SECTIONS = [
  { id: "resumen", label: "Resumen", group: "general", description: "Accesos rápidos y estado de los laboratorios", icon: "layout-dashboard" },
  { id: "infraestructura", label: "AI Core", group: "operacion", description: "Proveedores, salud e infraestructura", icon: "server" },
  { id: "local-runtime", label: "Runtime local", group: "operacion", description: "wllama, GGUF, WebGPU, caché y Local Bridge", icon: "cpu" },
  { id: "litert", label: "LiteRT y voz", group: "operacion", description: "Inferencia ligera, cuantización y audio", icon: "audio-waveform" },
  { id: "efficiency", label: "Adaptador universal", group: "operacion", description: "Bonsai, memoria, almacenamiento y planes de recursos", icon: "zap" },
  { id: "artifacts", label: "Artefactos SSD", group: "modelos", description: "Integridad SHA-256, caché y motor nativo Bonsai", icon: "hard-drive" },
  { id: "dataset", label: "Dataset Factory", group: "modelos", description: "Corpus, revisión y particiones de entrenamiento", icon: "database" },
  { id: "training", label: "Model Factory", group: "modelos", description: "LoRA, checkpoints, exportación y perfiles", icon: "graduation-cap" },
  { id: "modelos", label: "Candidatos", group: "modelos", description: "Registros, Quality Gate y promoción manual", icon: "layers" },
  { id: "benchmark", label: "Benchmarks", group: "supervision", description: "Calidad, latencia y velocidad de inferencia", icon: "gauge" },
  { id: "brain-ai", label: "Brain AI", group: "supervision", description: "Cognitive OS, aprendizaje continuo y voz", icon: "brain-circuit" },
  { id: "observabilidad", label: "Observabilidad", group: "supervision", description: "Telemetría local, modelos y métricas", icon: "activity" },
  { id: "video", label: "Video Router", group: "supervision", description: "Estado de proveedores; generación en mantenimiento", icon: "video" },
  { id: "experimental", label: "Seguridad experimental", group: "supervision", description: "Políticas de acceso, aislamiento y Production Gate", icon: "shield-check" },
] as const;

export type ModelLabSectionId = typeof MODEL_LAB_SECTIONS[number]["id"];
export const MODEL_LAB_GROUPS = [
  { id: "general", label: "General" },
  { id: "operacion", label: "Ejecución" },
  { id: "modelos", label: "Desarrollo" },
  { id: "supervision", label: "Supervisión" },
] as const;

const VALID_IDS = new Set<string>(MODEL_LAB_SECTIONS.map((section) => section.id));

export function resolveModelLabSection(raw: string | null | undefined): ModelLabSectionId {
  const clean = (raw || "").replace(/^#/, "").trim().toLowerCase();
  if (clean === "adaptador") return "efficiency";
  if (clean === "almacenamiento") return "artifacts";
  if (VALID_IDS.has(clean)) return clean as ModelLabSectionId;
  return "resumen";
}

export function modelLabSectionHash(id: ModelLabSectionId) {
  return "#" + id;
}
