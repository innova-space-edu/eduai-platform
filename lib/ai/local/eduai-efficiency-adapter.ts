/**
 * Universal Efficiency Adapter V1: a conservative storage / runtime planner.
 * It never downloads weights, executes remote code, or promotes experimental models.
 * The browser wllama runtime is NOT compatible with Bonsai 2's ternary GGUF formats.
 */
import { EDUAI_LOCAL_MODELS } from "./eduai-local-models";

export type EfficiencyEngine = "browser-wllama" | "native-prism" | "remote-server";
export type DataSensitivity = "public" | "internal" | "personal" | "sensitive";
export type EfficiencyStatus = "ready-to-test" | "requires-verification" | "blocked";
export type EfficiencyModel = {
  id: string;
  label: string;
  family: "eduai-gguf" | "bonsai-2";
  modelRepo: string;
  file: string;
  weightsMB: number;
  maxContext: number;
  engine: "wllama" | "prism-llama";
  visionProjectorMB?: number;
  license?: string;
  releaseNote?: string;
};

export const EFFICIENCY_PREFERENCE_KEY = "eduai-efficiency-adapter-opt-in-v1";
export const STORAGE_RESERVE_MB = 512;
export const RAM_SAFETY_FRACTION = 0.7;

const BONSAI_SIZE_MB: ReadonlyArray<{
  id: string; params: string; weightsMB: number; visionProjectorMB: number;
}> = [
  { id: "bonsai2-2b", params: "2B", weightsMB: 430, visionProjectorMB: 360 },
  { id: "bonsai2-4b", params: "4B", weightsMB: 950, visionProjectorMB: 370 },
  { id: "bonsai2-9b", params: "9B", weightsMB: 2000, visionProjectorMB: 440 },
  { id: "bonsai2-27b", params: "27B", weightsMB: 5950, visionProjectorMB: 630 },
];

export const BONSAI_REFERENCE_MODELS: readonly EfficiencyModel[] = BONSAI_SIZE_MB.map((entry) => ({
  id: entry.id,
  label: "Ternary Bonsai 2 " + entry.params + " · PTQ1_0",
  family: "bonsai-2",
  modelRepo: "prism-ml/Ternary-Bonsai-2-" + entry.params + "-gguf",
  file: "Ternary-Bonsai-2-" + entry.params + "-PTQ1_0.gguf",
  weightsMB: entry.weightsMB,
  maxContext: 262144,
  engine: "prism-llama",
  visionProjectorMB: entry.visionProjectorMB,
  license: "Apache-2.0",
  releaseNote: "Cifras publicadas de pesos, no RAM medida. Confirmar archivo, licencia y backend.",
}));

export const EFFICIENCY_MODELS: readonly EfficiencyModel[] = [
  ...EDUAI_LOCAL_MODELS.map((model) => ({
    id: model.id,
    label: model.label,
    family: "eduai-gguf" as const,
    modelRepo: model.repo,
    file: model.file,
    weightsMB: model.sizeMB,
    maxContext: model.context,
    engine: "wllama" as const,
  })),
  ...BONSAI_REFERENCE_MODELS,
];

export type EfficiencyInput = {
  model: EfficiencyModel;
  engine: EfficiencyEngine;
  hardware: {
    ramGB: number | null;
    vramGB: number | null;
    webgpu: boolean;
    cpuThreads: number;
    freeStorageMB: number | null;
    persistentStorage: boolean | null;
    online: boolean;
  };
  cachedOnDisk: boolean;
  nativeBackendVerified: boolean;
  serverEndpointVerified: boolean;
  allowRemoteInference: boolean;
  dataSensitivity: DataSensitivity;
  includeVision?: boolean;
  requestedContext?: number;
};

export type EfficiencyPlan = {
  modelId: string;
  status: EfficiencyStatus;
  executionTier: "RAM/VRAM" | "SSD + mmap" | "Servidor remoto" | "No disponible";
  storageTier: "caché local" | "descarga manual" | "remoto" | "no disponible";
  weightsMB: number;
  requiredDiskMB: number;
  estimatedRuntimeBudgetMB: number;
  chosenContext: number;
  batchSize: number;
  gpuOffload: "not-confirmed" | "not-applicable";
  requiresExplicitDownload: boolean;
  humanApprovalRequired: boolean;
  reasons: string[];
  warnings: string[];
};

/** A conservative admission budget, never a measurement of actual process RSS or VRAM. */
export function approximateRuntimeBudgetMB(model: EfficiencyModel, contextTokens: number, includeVision = false): number {
  const vision = includeVision ? (model.visionProjectorMB ?? 0) : 0;
  return Math.ceil(model.weightsMB + vision + Math.max(384, model.weightsMB * 0.22) + contextTokens * 0.14);
}

function positiveMemory(gb: number | null) {
  return typeof gb === "number" && Number.isFinite(gb) && gb > 0 ? gb : null;
}

export function planUniversalEfficiency(input: EfficiencyInput): EfficiencyPlan {
  const { model, hardware, engine } = input;
  const warnings: string[] = [
    "La estimación NO equivale a RAM o VRAM medida; SSD/caché no sustituyen RAM de inferencia.",
  ];
  const reasons: string[] = [];
  const ram = positiveMemory(hardware.ramGB);
  const vram = positiveMemory(hardware.vramGB);
  const desiredContext = Math.floor(input.requestedContext ?? 2048);
  const chosenContext = Math.max(512, Math.min(
    model.maxContext, 4096,
    Number.isFinite(desiredContext) ? desiredContext : 2048,
    ram !== null && ram <= 4 ? 1024 : ram !== null && ram < 12 ? 2048 : 4096,
  ));
  const batchSize = ram !== null && ram <= 4 ? 32 : ram !== null && ram < 12 ? 64 : 128;
  const weightsMB = model.weightsMB;
  const requiredDiskMB = Math.ceil(weightsMB + (input.includeVision ? (model.visionProjectorMB ?? 0) : 0));
  const estimatedRuntimeBudgetMB = approximateRuntimeBudgetMB(model, chosenContext, input.includeVision);
  let status: EfficiencyStatus = "requires-verification";
  let executionTier: EfficiencyPlan["executionTier"] = "No disponible";
  let storageTier: EfficiencyPlan["storageTier"] = input.cachedOnDisk ? "caché local" : "descarga manual";
  const requiresExplicitDownload = !input.cachedOnDisk;

  if (!Number.isFinite(weightsMB) || weightsMB <= 0 || !Number.isFinite(model.maxContext) || model.maxContext <= 0) {
    return {
      modelId: model.id, status: "blocked", executionTier, storageTier: "no disponible",
      weightsMB, requiredDiskMB, estimatedRuntimeBudgetMB, chosenContext, batchSize,
      gpuOffload: "not-confirmed", requiresExplicitDownload: false,
      humanApprovalRequired: true, reasons: ["Manifiesto de modelo inválido."], warnings,
    };
  }

  if (engine !== "remote-server" && !input.cachedOnDisk && hardware.freeStorageMB !== null
      && (!Number.isFinite(hardware.freeStorageMB)
          || hardware.freeStorageMB < requiredDiskMB + STORAGE_RESERVE_MB)) {
    warnings.push("Cuota de almacenamiento insuficiente para descarga y reserva de seguridad.");
    status = "blocked";
    storageTier = "no disponible";
  } else if (engine !== "remote-server" && !input.cachedOnDisk && hardware.freeStorageMB === null) {
    warnings.push("Cuota de almacenamiento no verificable: comprobar espacio antes de descargar.");
  }

  if (hardware.persistentStorage !== true && engine === "browser-wllama") {
    warnings.push("La caché del navegador puede desalojarse; solicitar persistencia no garantiza su concesión.");
  }

  if (engine === "browser-wllama") {
    if (model.engine !== "wllama") {
      status = "blocked";
      executionTier = "No disponible";
      storageTier = "no disponible";
      warnings.push("Bonsai 2 PTQ1_0 requiere runtime compatible; wllama actual no ofrece ese soporte verificado.");
    } else if (weightsMB > 2000) {
      status = "blocked";
      warnings.push("Archivo supera el límite conservador establecido para wllama.");
    } else if (ram === null) {
      warnings.push("RAM del navegador desconocida. No se garantiza carga segura.");
    } else if (estimatedRuntimeBudgetMB > ram * 1024 * RAM_SAFETY_FRACTION) {
      status = "blocked";
      warnings.push("La estimación supera el presupuesto prudente de RAM.");
    } else if (status !== "blocked") {
      executionTier = "RAM/VRAM";
      status = "ready-to-test";
      reasons.push("Modelo GGUF convencional apto para una prueba aislada en wllama.");
      warnings.push("WebGPU detectable no implica que wllama haya trasladado capas realmente a VRAM.");
    }
  } else if (engine === "native-prism") {
    if (!input.nativeBackendVerified) {
      status = "blocked";
      warnings.push("Backend nativo PrismML y formato específico aún no verificados en este equipo.");
    } else if (!input.cachedOnDisk) {
      warnings.push("El modelo debe estar descargado localmente antes de mapear pesos a disco.");
    }
    if (input.nativeBackendVerified && status !== "blocked") {
      if (ram === null) {
        status = "requires-verification";
        warnings.push("Se necesita RAM comprobada antes de autorizar inferencia nativa.");
      } else {
        executionTier = "SSD + mmap";
        status = input.cachedOnDisk && estimatedRuntimeBudgetMB <= ram * 1024 * RAM_SAFETY_FRACTION
          ? "ready-to-test" : "requires-verification";
        reasons.push("PrismML/llama.cpp nativo permite probar mmap y offloading CPU/GPU.");
        if (status !== "ready-to-test") {
          warnings.push("Memoria ajustada: mmap puede provocar fallos de página y rendimiento muy bajo.");
        }
      }
    }
  } else if (engine === "remote-server") {
    storageTier = "remoto";
    if (!input.serverEndpointVerified || !hardware.online) {
      status = "blocked";
      warnings.push("No hay un endpoint remoto autenticado y verificado disponible.");
    } else if (!input.allowRemoteInference) {
      status = "blocked";
      warnings.push("El usuario no autorizó transferir instrucciones al servidor.");
    } else if (input.dataSensitivity !== "public") {
      status = "blocked";
      warnings.push("V1 solo permite enviar datos explícitamente públicos; otros datos permanecen locales.");
    } else {
      executionTier = "Servidor remoto";
      status = "requires-verification";
      reasons.push("Endpoint declarado como verificado; falta benchmark de privacidad, calidad y latencia.");
    }
  }

  if (status === "blocked") executionTier = "No disponible";
  return {
    modelId: model.id, status, executionTier, storageTier, weightsMB, requiredDiskMB,
    estimatedRuntimeBudgetMB, chosenContext, batchSize,
    gpuOffload: "not-confirmed", requiresExplicitDownload,
    humanApprovalRequired: true, reasons, warnings,
  };
}

export function getAdaptiveWllamaTuning(memoryGB: number | null, modelContext: number): {
  n_ctx: number;
  n_batch: number;
} {
  const ram = positiveMemory(memoryGB);
  const ceiling = ram === null ? 1024 : ram <= 4 ? 1024 : ram < 12 ? 2048 : 4096;
  return {
    n_ctx: Math.min(Math.max(512, Math.floor(modelContext)), ceiling),
    n_batch: ram === null || ram <= 4 ? 32 : ram < 12 ? 64 : 128,
  };
}

export function isEfficiencyAdapterEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(EFFICIENCY_PREFERENCE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setEfficiencyAdapterEnabled(value: boolean): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(EFFICIENCY_PREFERENCE_KEY, value ? "true" : "false");
    return true;
  } catch {
    return false;
  }
}
