export type ModelLabProviderId =
  | "openrouter"
  | "hf_fal"
  | "bfl"
  | "ltx"
  | "hf_endpoint"
  | "private_endpoint";

export type ModelLabProvider = {
  id: ModelLabProviderId;
  label: string;
  supports: Array<"chat" | "image" | "video">;
  stage: "phase_1" | "phase_2" | "phase_3";
  enabledByDefault: boolean;
  notes: string;
};

export const MODEL_LAB_PROVIDERS: ModelLabProvider[] = [
  {
    id: "openrouter",
    label: "OpenRouter",
    supports: ["chat"],
    stage: "phase_1",
    enabledByDefault: false,
    notes: "Catálogo dinámico de modelos de chat mediante una sola API.",
  },
  {
    id: "hf_fal",
    label: "Hugging Face Inference Providers · fal",
    supports: ["image", "video"],
    stage: "phase_1",
    enabledByDefault: false,
    notes: "Ruta inicial para modelos HF con proveedor administrado disponible.",
  },
  {
    id: "bfl",
    label: "Black Forest Labs API",
    supports: ["image"],
    stage: "phase_1",
    enabledByDefault: false,
    notes: "Iteraciones visuales rápidas con la familia FLUX.",
  },
  {
    id: "ltx",
    label: "LTX API",
    supports: ["video"],
    stage: "phase_2",
    enabledByDefault: false,
    notes: "Video con audio sincronizado y transformación audiovisual.",
  },
  {
    id: "hf_endpoint",
    label: "Hugging Face Inference Endpoint",
    supports: ["image", "video"],
    stage: "phase_2",
    enabledByDefault: false,
    notes: "Despliegue administrado para modelos abiertos sin proveedor directo.",
  },
  {
    id: "private_endpoint",
    label: "Endpoint privado administrado",
    supports: ["chat", "image", "video"],
    stage: "phase_3",
    enabledByDefault: false,
    notes: "Ruta aislada para modelos especiales y pruebas avanzadas.",
  },
];
