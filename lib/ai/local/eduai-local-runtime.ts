import { searchEduAILocalKnowledgePack } from "./eduai-local-rag";
import {
  DEFAULT_EDUAI_LOCAL_MODEL_ID,
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
};

type WllamaRuntime = {
  loadModelFromHF: (
    source: { repo: string; file: string },
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

type ModelManagerRuntime = {
  clear: () => Promise<void>;
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
  knowledgeSources: string[];
};

let activeRuntime: WllamaRuntime | null = null;
let activeModelId: string | null = null;
let activeMode: EduAILocalRuntimeMode | null = null;
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
  try {
    const estimate = await nav.storage?.estimate();
    storageUsageMB = asMegabytes(estimate?.usage);
    storageQuotaMB = asMegabytes(estimate?.quota);
  } catch {
    storageUsageMB = null;
    storageQuotaMB = null;
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
    gpuLabel,
    recommendedModelId: recommendEduAILocalModel({ memoryGB, vramGB: null, webgpu, cores }),
    tier: accelerated ? "accelerated" : constrained ? "constrained" : "standard",
  };
}

async function createRuntime() {
  const wllamaModule = (await import("@wllama/wllama")) as unknown as WllamaModuleShape;
  const wasmPaths = {
    default: "https://cdn.jsdelivr.net/npm/@wllama/wllama@3.6.1/src/wasm/wllama.wasm",
  };
  return new wllamaModule.Wllama(wasmPaths, {
    parallelDownloads: 3,
    allowOffline: true,
  });
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
    await runtime.loadModelFromHF(
      { repo: model.repo, file: model.file },
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
  onProgress?.(1);

  return {
    modelId: model.id,
    mode,
    loadMs: performance.now() - started,
    multithread: runtime.isMultithread?.() || false,
  };
}

export async function runEduAILocalChat(
  prompt: string,
  maxTokens = 256,
): Promise<EduAILocalChatResult> {
  const cleanPrompt = prompt.trim();
  if (!cleanPrompt) throw new Error("Escribe una instrucción antes de ejecutar la prueba.");
  if (!activeRuntime || !activeModelId) throw new Error("Carga un modelo local primero.");

  const model = getEduAILocalModel(activeModelId);
  const started = performance.now();
  const knowledgeHits = await searchEduAILocalKnowledgePack(cleanPrompt, 4).catch(() => []);
  const knowledgeContext = knowledgeHits.length
    ? "\n\nContexto local de EDUAI (usa solo si es relevante):\n" +
      knowledgeHits.map((hit, index) => `[${index + 1}] ${hit.source}\n${hit.snippet}`).join("\n\n")
    : "";
  const result = await activeRuntime.createChatCompletion({
    messages: [
      { role: "system", content: model.systemPrompt },
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

  return {
    text: text.trim() || "El modelo no devolvió texto.",
    latencyMs: performance.now() - started,
    knowledgeSources: [...new Set(knowledgeHits.map((hit) => hit.source))],
  };
}

export async function unloadEduAILocalModel() {
  runtimeGeneration += 1;
  const runtime = activeRuntime;
  activeRuntime = null;
  activeModelId = null;
  activeMode = null;
  if (!runtime) return;
  await Promise.resolve(runtime.exit()).catch(() => undefined);
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
