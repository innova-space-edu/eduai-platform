export type ModelLabCategory = "chat" | "image" | "video";
export type ModelLabStage = "phase_1" | "phase_2" | "phase_3";
export type ModelLabOnlineRoute =
  | "openrouter"
  | "hf_provider_fal"
  | "vendor_api"
  | "hf_inference_endpoint"
  | "private_endpoint";

export type ModelLabCatalogItem = {
  id: string;
  label: string;
  category: ModelLabCategory;
  source: "huggingface" | "external";
  repoId?: string;
  hubUrl?: string;
  license: string;
  stage: ModelLabStage;
  onlineRoute: ModelLabOnlineRoute;
  providerLabel: string;
  enabledByDefault: boolean;
  capabilities: string[];
  notes: string;
};

export const MODEL_LAB_CATALOG: ModelLabCatalogItem[] = [
  {
    id: "openrouter-chat-catalog",
    label: "OpenRouter — catálogo dinámico de chat",
    category: "chat",
    source: "external",
    license: "según modelo seleccionado",
    stage: "phase_1",
    onlineRoute: "openrouter",
    providerLabel: "OpenRouter API",
    enabledByDefault: false,
    capabilities: ["chat", "comparación de modelos", "selector por proveedor", "pruebas de prompts"],
    notes: "Ruta inicial recomendada para chat experimental online sin acoplar EduAI a un solo modelo.",
  },
  {
    id: "hauhaucs-qwen36-aggressive",
    label: "Qwen3.6-35B-A3B Uncensored HauhauCS Aggressive",
    category: "chat",
    source: "huggingface",
    repoId: "HauhauCS/Qwen3.6-35B-A3B-Uncensored-HauhauCS-Aggressive",
    hubUrl: "https://huggingface.co/HauhauCS/Qwen3.6-35B-A3B-Uncensored-HauhauCS-Aggressive",
    license: "Apache-2.0",
    stage: "phase_3",
    onlineRoute: "private_endpoint",
    providerLabel: "Endpoint privado administrado",
    enabledByDefault: false,
    capabilities: ["chat experimental", "análisis multimodal", "pruebas de robustez"],
    notes: "Mantener aislado del chat público. Requiere endpoint privado porque no dispone de proveedor directo estándar.",
  },
  {
    id: "qwen-image-2512",
    label: "Qwen-Image-2512",
    category: "image",
    source: "huggingface",
    repoId: "Qwen/Qwen-Image-2512",
    hubUrl: "https://huggingface.co/Qwen/Qwen-Image-2512",
    license: "Apache-2.0",
    stage: "phase_1",
    onlineRoute: "hf_provider_fal",
    providerLabel: "Hugging Face Inference Provider: fal",
    enabledByDefault: false,
    capabilities: ["text-to-image", "afiches", "infografías", "texto dentro de imágenes", "realismo"],
    notes: "Modelo principal para generación de imágenes con texto, material educativo y composiciones visuales complejas.",
  },
  {
    id: "qwen-image-edit-2511",
    label: "Qwen-Image-Edit-2511",
    category: "image",
    source: "huggingface",
    repoId: "Qwen/Qwen-Image-Edit-2511",
    hubUrl: "https://huggingface.co/Qwen/Qwen-Image-Edit-2511",
    license: "Apache-2.0",
    stage: "phase_1",
    onlineRoute: "hf_provider_fal",
    providerLabel: "Hugging Face Inference Provider: fal",
    enabledByDefault: false,
    capabilities: ["image-to-image", "edición guiada", "múltiples referencias", "consistencia de personajes", "diseño industrial"],
    notes: "Modelo principal para corregir, reemplazar o combinar elementos de imágenes existentes.",
  },
  {
    id: "flux2-klein-4b",
    label: "FLUX.2 klein 4B",
    category: "image",
    source: "huggingface",
    repoId: "black-forest-labs/FLUX.2-klein-4B",
    hubUrl: "https://huggingface.co/black-forest-labs/FLUX.2-klein-4B",
    license: "Apache-2.0",
    stage: "phase_1",
    onlineRoute: "vendor_api",
    providerLabel: "Black Forest Labs API",
    enabledByDefault: false,
    capabilities: ["text-to-image", "image-to-image", "edición multirreferencia", "baja latencia"],
    notes: "Motor rápido para iteraciones, bocetos y previsualizaciones antes de ejecutar modelos más costosos.",
  },
  {
    id: "qwen-image-layered",
    label: "Qwen-Image-Layered",
    category: "image",
    source: "huggingface",
    repoId: "Qwen/Qwen-Image-Layered",
    hubUrl: "https://huggingface.co/Qwen/Qwen-Image-Layered",
    license: "Apache-2.0",
    stage: "phase_2",
    onlineRoute: "hf_inference_endpoint",
    providerLabel: "Hugging Face Inference Endpoint",
    enabledByDefault: false,
    capabilities: ["descomposición por capas", "mover objetos", "redimensionar objetos", "eliminar elementos", "edición recursiva"],
    notes: "Especialmente útil para convertir imágenes generadas en materiales editables dentro de EduAI.",
  },
  {
    id: "hunyuan-video-15",
    label: "HunyuanVideo-1.5",
    category: "video",
    source: "huggingface",
    repoId: "tencent/HunyuanVideo-1.5",
    hubUrl: "https://huggingface.co/tencent/HunyuanVideo-1.5",
    license: "Tencent Hunyuan Community License",
    stage: "phase_1",
    onlineRoute: "hf_provider_fal",
    providerLabel: "Hugging Face Inference Provider: fal",
    enabledByDefault: false,
    capabilities: ["text-to-video", "image-to-video", "previsualizaciones", "prompt enhancement"],
    notes: "Ruta inicial recomendada para activar generación de video online con mínima infraestructura propia.",
  },
  {
    id: "wan22-ti2v-5b",
    label: "Wan2.2 TI2V 5B",
    category: "video",
    source: "huggingface",
    repoId: "Wan-AI/Wan2.2-TI2V-5B",
    hubUrl: "https://huggingface.co/Wan-AI/Wan2.2-TI2V-5B",
    license: "Apache-2.0",
    stage: "phase_2",
    onlineRoute: "hf_inference_endpoint",
    providerLabel: "Hugging Face Inference Endpoint",
    enabledByDefault: false,
    capabilities: ["text-to-video", "image-to-video", "720p", "24 fps", "estética cinematográfica"],
    notes: "Modelo abierto recomendado para video final cuando se despliegue un endpoint GPU administrado.",
  },
  {
    id: "ltx23",
    label: "LTX-2.3",
    category: "video",
    source: "huggingface",
    repoId: "Lightricks/LTX-2.3",
    hubUrl: "https://huggingface.co/Lightricks/LTX-2.3",
    license: "LTX direct use license",
    stage: "phase_2",
    onlineRoute: "vendor_api",
    providerLabel: "LTX API",
    enabledByDefault: false,
    capabilities: ["text-to-video", "image-to-video", "video-to-video", "audio sincronizado", "upscaling"],
    notes: "Añadir después de la base visual para experimentar con clips audiovisuales sincronizados.",
  },
  {
    id: "wan22-animate-14b",
    label: "Wan2.2 Animate 14B",
    category: "video",
    source: "huggingface",
    repoId: "Wan-AI/Wan2.2-Animate-14B",
    hubUrl: "https://huggingface.co/Wan-AI/Wan2.2-Animate-14B",
    license: "Apache-2.0",
    stage: "phase_3",
    onlineRoute: "hf_inference_endpoint",
    providerLabel: "Hugging Face Inference Endpoint",
    enabledByDefault: false,
    capabilities: ["video-to-video", "animación", "transformación de movimiento", "personajes"],
    notes: "Reservar para experimentos avanzados de animación y transformación de clips.",
  },
  {
    id: "cogvideox-2b",
    label: "CogVideoX 2B",
    category: "video",
    source: "huggingface",
    repoId: "zai-org/CogVideoX-2b",
    hubUrl: "https://huggingface.co/zai-org/CogVideoX-2b",
    license: "Apache-2.0",
    stage: "phase_3",
    onlineRoute: "hf_inference_endpoint",
    providerLabel: "Hugging Face Inference Endpoint",
    enabledByDefault: false,
    capabilities: ["text-to-video", "fallback económico", "pruebas comparativas"],
    notes: "Mantener como fallback experimental liviano y como referencia comparativa histórica.",
  },
];

export const MODEL_LAB_IMAGE_MODELS = MODEL_LAB_CATALOG.filter((item) => item.category === "image");
export const MODEL_LAB_VIDEO_MODELS = MODEL_LAB_CATALOG.filter((item) => item.category === "video");
export const MODEL_LAB_CHAT_MODELS = MODEL_LAB_CATALOG.filter((item) => item.category === "chat");
