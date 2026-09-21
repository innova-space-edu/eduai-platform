import { searchEduAILocalKnowledgePack } from "./eduai-local-rag";
import { validateEduAIGgufFiles } from "./eduai-local-gguf";
import {
  DEFAULT_EDUAI_LOCAL_MODEL_ID,
  EDUAI_LOCAL_MODELS,
  getEduAILocalModel,
  recommendEduAILocalModel,
  type EduAILocalRuntimeMode,
} from "./eduai-local-models";

type WllamaChatResult = {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

type WllamaRuntime = {
  loadModelFromUrl: (
    source: string,
    config?: Record<string, unknown>,
  ) => Promise<void>;
  loadModel: (
    blobs: Blob[],
    config?: Record<string, unknown>,
  ) => Promise<void>;
  createChatCompletion: (config: Record<string, unknown>) => Promise<WllamaChatResult>;
  exit: () => void | Promise<void>;
  isMultithread?: () => boolean;
};

type WllamaConstructor = new (
  wasmPaths: unknown,
  config?: Record<string, unknown>,
) => WllamaRuntime;

type CachedModelRuntime = {
  url: string;
  size: number;
  validate?: () => string;
  remove: () => Promise<void>;
};

type ModelManagerRuntime = {
  clear: () => Promise<void>;
  getModels?: (opts?: { includeInvalid?: boolean }) => Promise<CachedModelRuntime[]>;
};

type ModelManagerConstructor = new () => ModelManagerRuntime;

type WllamaModuleShape = {
  Wllama: WllamaConstructor;
  ModelManager?: ModelManagerConstructor;
};

export type EduAILocalHardware = {
  cores: number;
  memoryGB: number | null;
  wasm: boolean;
  webgpu: boolean;
  online: boolean;
  secureContext: boolean;
  crossOriginIsolated: boolean;
  multithreadReady: boolean;
  storageUsageMB: number | null;
  storageQuotaMB: number | null;
  persistentStorage: boolean | null;
  gpuLabel: string | null;
  recommendedModelId: string;
  tier: "constrained" | "standard" | "accelerated";
};

export type EduAILocalLoadResult = {
  modelId: string;
  mode: EduAILocalRuntimeMode;
  loadMs: number;
  multithread: boolean;
};

export type EduAILocalChatResult = {
  text: string;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  tokensPerSecond: number | null;
  knowledgeSources: string[];
};

let activeRuntime: WllamaRuntime | null = null;
let activeModelId: string | null = null;
let activeMode: EduAILocalRuntimeMode | null = null;
let activeSystemPrompt: string | null = null;
let runtimeGeneration = 0;

function asMegabytes(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value / 1024 / 1024 : null;
}

export async function probeEduAILocalHardware(): Promise<EduAILocalHardware> {
  if (typeof navigator === "undefined") {
    return {
      cores: 1,
      memoryGB: null,
      wasm: false,
      webgpu: false,
      online: false,
      secureContext: false,
      crossOriginIsolated: false,
      multithreadReady: false,
      storageUsageMB: null,
      storageQuotaMB: null,
      persistentStorage: null,
      gpuLabel: null,
      recommendedModelId: DEFAULT_EDUAI_LOCAL_MODEL_ID,
      tier: "constrained",
    };
  }

  const nav = navigator as Navigator & {
    deviceMemory?: number;
    gpu?: {
      requestAdapter?: () => Promise<{
        info?: {
          vendor?: string;
          architecture?: string;
          device?: string;
          description?: string;
        };
      } | null>;
    };
  };
  const cores = Math.max(1, nav.hardwareConcurrency || 1);
  const memoryGB =
    typeof nav.deviceMemory === "number" && Number.isFinite(nav.deviceMemory)
      ? nav.deviceMemory
      : null;

  let storageUsageMB: number | null = null;
  let storageQuotaMB: number | null = null;
  let persistentStorage: boolean | null = null;
  try {
    const estimate = await nav.storage?.estimate();
    storageUsageMB = asMegabytes(estimate?.usage);
    storageQuotaMB = asMegabytes(estimate?.quota);
    persistentStorage = nav.storage?.persisted
      ? await nav.storage.persisted()
      : null;
  } catch {
    storageUsageMB = null;
    storageQuotaMB = null;
    persistentStorage = null;
  }

  const webgpu = Boolean(nav.gpu);
  let gpuLabel: string | null = null;
  if (nav.gpu?.requestAdapter) {
    try {
      const adapter = await nav.gpu.requestAdapter();
      const info = adapter?.info;
      const parts = [info?.vendor, info?.architecture, info?.device, info?.description]
        .filter((value): value is string => Boolean(value && value.trim()))
        .filter((value, index, values) => values.indexOf(value) === index);
      gpuLabel = parts.length ? parts.join(" · ") : null;
    } catch {
      gpuLabel = null;
    }
  }
  const isolated = typeof window !== "undefined" && window.crossOriginIsolated;
  const constrained = (memoryGB !== null && memoryGB <= 4) || cores <= 2;
  const accelerated = webgpu && (memoryGB === null || memoryGB >= 8);

  return {
    cores,
    memoryGB,
    wasm: typeof WebAssembly !== "undefined",
    webgpu,
    online: nav.onLine,
    secureContext: typeof window !== "undefined" ? window.isSecureContext : false,
    crossOriginIsolated: isolated,
    multithreadReady: isolated && cores > 1,
    storageUsageMB,
    storageQuotaMB,
    persistentStorage,
    gpuLabel,
    recommendedModelId: recommendEduAILocalModel({ memoryGB, vramGB: null, webgpu, cores }),
    tier: accelerated ? "accelerated" : constrained ? "constrained" : "standard",
  };
}

function getEduAILocalModelUrl(repo: string, file: string) {
  const safePath = file
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `https://huggingface.co/${repo}/resolve/main/${safePath}`;
}

async function createRuntime() {
  const wllamaModule = (await import("@wllama/wllama")) as unknown as WllamaModuleShape;
  const wasmPaths = {
    default: "/eduai-local/wllama.wasm",
  };
  return new wllamaModule.Wllama(wasmPaths, {
    parallelDownloads: 3,
    allowOffline: true,
  });
}

export async function requestEduAILocalPersistentStorage() {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) {
    return {
      supported: false,
      granted: false,
    };
  }

  const alreadyPersistent = navigator.storage.persisted
    ? await navigator.storage.persisted().catch(() => false)
    : false;
  if (alreadyPersistent) {
    return {
      supported: true,
      granted: true,
    };
  }

  const granted = await navigator.storage.persist().catch(() => false);
  return {
    supported: true,
    granted,
  };
}

export function getEduAILocalRuntimeState() {
  return {
    loaded: Boolean(activeRuntime && activeModelId),
    modelId: activeModelId,
    mode: activeMode,
  };
}

export async function loadEduAILocalModel(
  modelId: string,
  mode: EduAILocalRuntimeMode,
  onProgress?: (fraction: number) => void,
): Promise<EduAILocalLoadResult> {
  const model = getEduAILocalModel(modelId);
  if (activeRuntime && activeModelId === model.id && activeMode === mode) {
    return {
      modelId: model.id,
      mode,
      loadMs: 0,
      multithread: activeRuntime.isMultithread?.() || false,
    };
  }

  await unloadEduAILocalModel();
  const generation = runtimeGeneration;

  const hardware = await probeEduAILocalHardware();
  if (!hardware.wasm) throw new Error("Este navegador no expone WebAssembly.");
  if (!hardware.secureContext) throw new Error("EDUAI Local requiere HTTPS o localhost.");

  const runtime = await createRuntime();
  const threads = hardware.multithreadReady
    ? Math.max(1, Math.min(4, hardware.cores - 1))
    : 1;

  const loadConfig: Record<string, unknown> = {
    n_ctx: model.context,
    n_batch: 128,
    n_threads: threads,
    jinja: true,
    progressCallback: (progress: { loaded: number; total: number }) => {
      const fraction =
        progress.total > 0 ? Math.max(0, Math.min(1, progress.loaded / progress.total)) : 0;
      onProgress?.(fraction);
    },
  };
  if (mode === "cpu") loadConfig.n_gpu_layers = 0;

  const started = performance.now();
  try {
    await runtime.loadModelFromUrl(
      getEduAILocalModelUrl(model.repo, model.file),
      loadConfig,
    );
  } catch (error) {
    await Promise.resolve(runtime.exit()).catch(() => undefined);
    throw error;
  }

  if (generation !== runtimeGeneration) {
    await Promise.resolve(runtime.exit()).catch(() => undefined);
    throw new Error("La carga local fue cancelada.");
  }

  activeRuntime = runtime;
  activeModelId = model.id;
  activeMode = mode;
  activeSystemPrompt = model.systemPrompt;
  onProgress?.(1);

  return {
    modelId: model.id,
    mode,
    loadMs: performance.now() - started,
    multithread: runtime.isMultithread?.() || false,
  };
}

export async function loadEduAILocalGgufFiles(
  files: File[],
  mode: EduAILocalRuntimeMode,
  label = "",
  onProgress?: (fraction: number) => void,
): Promise<EduAILocalLoadResult> {
  const selection = validateEduAIGgufFiles(files);
  await unloadEduAILocalModel();
  const generation = runtimeGeneration;

  const hardware = await probeEduAILocalHardware();
  if (!hardware.wasm) throw new Error("Este navegador no expone WebAssembly.");
  if (!hardware.secureContext) throw new Error("EDUAI Local requiere HTTPS o localhost.");

  const runtime = await createRuntime();
  const threads = hardware.multithreadReady
    ? Math.max(1, Math.min(4, hardware.cores - 1))
    : 1;

  const loadConfig: Record<string, unknown> = {
    n_ctx: 4096,
    n_batch: 128,
    n_threads: threads,
    jinja: true,
  };
  if (mode === "cpu") loadConfig.n_gpu_layers = 0;

  const started = performance.now();
  onProgress?.(0.08);
  try {
    await runtime.loadModel(selection.files, loadConfig);
  } catch (error) {
    await Promise.resolve(runtime.exit()).catch(() => undefined);
    throw error;
  }

  if (generation !== runtimeGeneration) {
    await Promise.resolve(runtime.exit()).catch(() => undefined);
    throw new Error("La carga local fue cancelada.");
  }

  const displayLabel = label.trim() || selection.label;
  activeRuntime = runtime;
  activeModelId = `custom:${displayLabel}`;
  activeMode = mode;
  activeSystemPrompt =
    "Eres un candidato de EDUAI Local en evaluación. Usa el Knowledge Pack cuando sea relevante, no inventes archivos ni acciones y distingue claramente lo que no puedas verificar.";
  onProgress?.(1);

  return {
    modelId: activeModelId,
    mode,
    loadMs: performance.now() - started,
    multithread: runtime.isMultithread?.() || false,
  };
}

export type EduAILocalChatOptions = {
  useKnowledge?: boolean;
};

export async function runEduAILocalChat(
  prompt: string,
  maxTokens = 256,
  options: EduAILocalChatOptions = {},
): Promise<EduAILocalChatResult> {
  const cleanPrompt = prompt.trim();
  if (!cleanPrompt) throw new Error("Escribe una instrucción antes de ejecutar la prueba.");
  if (!activeRuntime || !activeModelId) throw new Error("Carga un modelo local primero.");

  const systemPrompt =
    activeSystemPrompt ||
    (activeModelId.startsWith("custom:")
      ? "Eres EDUAI Local."
      : getEduAILocalModel(activeModelId).systemPrompt);
  const started = performance.now();
  const knowledgeHits =
    options.useKnowledge === false
      ? []
      : await searchEduAILocalKnowledgePack(cleanPrompt, 4).catch(() => []);
  const knowledgeContext = knowledgeHits.length
    ? "\n\nContexto local de EDUAI (usa solo si es relevante):\n" +
      knowledgeHits.map((hit, index) => `[${index + 1}] ${hit.source}\n${hit.snippet}`).join("\n\n")
    : "";
  const result = await activeRuntime.createChatCompletion({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: cleanPrompt + knowledgeContext },
    ],
    max_tokens: Math.max(32, Math.min(512, maxTokens)),
    temperature: 0.3,
  });

  const raw = result.choices?.[0]?.message?.content;
  const text =
    typeof raw === "string"
      ? raw
      : raw == null
        ? ""
        : JSON.stringify(raw);

  const latencyMs = performance.now() - started;
  const promptTokens = result.usage?.prompt_tokens || 0;
  const completionTokens = result.usage?.completion_tokens || 0;
  const tokensPerSecond =
    completionTokens > 0 && latencyMs > 0
      ? completionTokens / (latencyMs / 1000)
      : null;

  return {
    text: text.trim() || "El modelo no devolvió texto.",
    latencyMs,
    promptTokens,
    completionTokens,
    tokensPerSecond,
    knowledgeSources: [...new Set(knowledgeHits.map((hit) => hit.source))],
  };
}

export async function unloadEduAILocalModel() {
  runtimeGeneration += 1;
  const runtime = activeRuntime;
  activeRuntime = null;
  activeModelId = null;
  activeMode = null;
  activeSystemPrompt = null;
  if (!runtime) return;
  await Promise.resolve(runtime.exit()).catch(() => undefined);
}

export type EduAILocalCachedModel = {
  url: string;
  sizeMB: number;
  status: string;
  catalogModelId: string | null;
  label: string;
};

function matchCatalogModelFromUrl(url: string) {
  const normalized = decodeURIComponent(url).toLowerCase();
  return (
    EDUAI_LOCAL_MODELS.find((model) => {
      const repo = model.repo.toLowerCase();
      const file = model.file.toLowerCase();
      return normalized.includes(repo) && normalized.includes(file);
    }) || null
  );
}

export async function listEduAILocalCachedModels(): Promise<EduAILocalCachedModel[]> {
  const wllamaModule = (await import("@wllama/wllama")) as unknown as WllamaModuleShape;
  if (!wllamaModule.ModelManager) return [];
  const manager = new wllamaModule.ModelManager();
  if (!manager.getModels) return [];

  const models = await manager.getModels({ includeInvalid: true });
  return models
    .filter((model) => model.size >= 0)
    .map((model) => {
      const catalog = matchCatalogModelFromUrl(model.url);
      let status = "unknown";
      try {
        status = model.validate?.() || "unknown";
      } catch {
        status = "unknown";
      }
      return {
        url: model.url,
        sizeMB: model.size / 1024 / 1024,
        status,
        catalogModelId: catalog?.id || null,
        label: catalog?.label || decodeURIComponent(model.url).split("/").pop() || "Modelo cacheado",
      };
    })
    .sort((a, b) => b.sizeMB - a.sizeMB);
}

export async function removeEduAILocalCachedModel(url: string) {
  await unloadEduAILocalModel();
  const wllamaModule = (await import("@wllama/wllama")) as unknown as WllamaModuleShape;
  if (!wllamaModule.ModelManager) {
    throw new Error("La versión instalada de wllama no expone ModelManager.");
  }
  const manager = new wllamaModule.ModelManager();
  if (!manager.getModels) {
    throw new Error("La versión instalada de wllama no permite listar modelos cacheados.");
  }
  const models = await manager.getModels({ includeInvalid: true });
  const target = models.find((model) => model.url === url);
  if (!target) throw new Error("El modelo cacheado ya no existe.");
  await target.remove();
}

export async function clearEduAILocalModelCache() {
  await unloadEduAILocalModel();
  const wllamaModule = (await import("@wllama/wllama")) as unknown as WllamaModuleShape;
  if (!wllamaModule.ModelManager) {
    throw new Error("La versión instalada de wllama no expone ModelManager.");
  }
  const manager = new wllamaModule.ModelManager();
  await manager.clear();
}
