import { searchEduAILocalKnowledgePack } from "./eduai-local-rag";

export type EduAILocalBridgeModel = {
  id: string;
  ownedBy?: string;
};

export type EduAILocalBridgeProbe = {
  baseUrl: string;
  models: EduAILocalBridgeModel[];
  latencyMs: number;
};

export type EduAILocalBridgeChatResult = {
  text: string;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  tokensPerSecond: number | null;
  knowledgeSources: string[];
};

export type EduAILocalBridgeHardwareProfile = {
  memoryGB: number | null;
  vramGB: number | null;
};

export type EduAILocalBridgeCapacity = {
  label: string;
  recommendedMaxB: number;
  experimentalMaxB: number;
  detail: string;
};

export type EduAILocalBridgeFit = "recommended" | "possible" | "heavy" | "unknown";

export function recommendEduAILocalBridgeCapacity(
  profile: EduAILocalBridgeHardwareProfile,
): EduAILocalBridgeCapacity {
  const ram = profile.memoryGB ?? 8;
  const vram = profile.vramGB ?? 0;

  if (ram >= 64 && vram >= 24) {
    return {
      label: "20–30B Q4",
      recommendedMaxB: 30,
      experimentalMaxB: 40,
      detail: "Perfil workstation. Prioriza GPU y deja margen para contexto/KV cache.",
    };
  }
  if (ram >= 32 && vram >= 16) {
    return {
      label: "12–14B Q4",
      recommendedMaxB: 14,
      experimentalMaxB: 20,
      detail: "Adecuado para 12–14B cuantizados; 20B puede requerir offload híbrido.",
    };
  }
  if (ram >= 24 && vram >= 12) {
    return {
      label: "8–12B Q4",
      recommendedMaxB: 12,
      experimentalMaxB: 14,
      detail: "Buen margen para modelos medianos con contexto moderado.",
    };
  }
  if (ram >= 16 && vram >= 8) {
    return {
      label: "7–8B Q4",
      recommendedMaxB: 8,
      experimentalMaxB: 12,
      detail: "Perfil sólido para 7–8B; modelos mayores dependerán del offload y contexto.",
    };
  }
  if (ram >= 16 && vram >= 6) {
    return {
      label: "4–7B Q4",
      recommendedMaxB: 7,
      experimentalMaxB: 8,
      detail: "7B puede ser viable con cuantización y offload parcial.",
    };
  }
  if (ram >= 8 && vram >= 4) {
    return {
      label: "3–4B Q4",
      recommendedMaxB: 4,
      experimentalMaxB: 7,
      detail: "Para i5/8 GB + 4 GB VRAM: 3–4B es la banda prudente; 7B es experimental/híbrido.",
    };
  }
  if (ram >= 8 && vram >= 2) {
    return {
      label: "1–3B Q4",
      recommendedMaxB: 3,
      experimentalMaxB: 4,
      detail: "Conviene priorizar modelos pequeños y mantener contexto contenido.",
    };
  }
  return {
    label: "≤2B Q4",
    recommendedMaxB: 2,
    experimentalMaxB: 3,
    detail: "Perfil limitado; Browser Local suele ser más simple y estable.",
  };
}

export function inferEduAILocalBridgeModelBillions(modelId: string): number | null {
  const normalized = modelId.toLowerCase();
  const matches = [...normalized.matchAll(/(?:^|[-_./])([0-9]+(?:\.[0-9]+)?)b(?:[-_./]|$)/g)];
  if (!matches.length) return null;
  const values = matches
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0);
  return values.length ? Math.max(...values) : null;
}

export function evaluateEduAILocalBridgeModel(
  modelId: string,
  profile: EduAILocalBridgeHardwareProfile,
): EduAILocalBridgeFit {
  const billions = inferEduAILocalBridgeModelBillions(modelId);
  if (billions === null) return "unknown";
  const capacity = recommendEduAILocalBridgeCapacity(profile);
  if (billions <= capacity.recommendedMaxB) return "recommended";
  if (billions <= capacity.experimentalMaxB) return "possible";
  return "heavy";
}

export function normalizeEduAILocalBridgeBaseUrl(input: string) {
  const value = input.trim().replace(/\/+$/, "");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("La URL del servidor local no es válida.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("El servidor local debe usar http:// o https://.");
  }

  const host = url.hostname.toLowerCase();
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
    throw new Error("Por seguridad, Local Bridge solo acepta localhost o loopback.");
  }

  return url.toString().replace(/\/$/, "");
}

function headers(token?: string) {
  const result: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token?.trim()) result.Authorization = `Bearer ${token.trim()}`;
  return result;
}

async function readJson(response: Response) {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.error ||
      data?.message ||
      `Servidor local respondió HTTP ${response.status}`;
    throw new Error(String(message));
  }
  return data;
}

export async function probeEduAILocalBridge(
  baseUrl: string,
  token?: string,
): Promise<EduAILocalBridgeProbe> {
  const normalized = normalizeEduAILocalBridgeBaseUrl(baseUrl);
  const started = performance.now();
  let response: Response;
  try {
    response = await fetch(`${normalized}/models`, {
      method: "GET",
      headers: headers(token),
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "No se pudo conectar al servidor local. Comprueba que esté iniciado y que permita solicitudes desde el navegador.",
    );
  }

  const data = await readJson(response);
  const models = Array.isArray(data?.data)
    ? data.data
        .filter((item: unknown) => item && typeof item === "object")
        .map((item: { id?: unknown; owned_by?: unknown }) => ({
          id: typeof item.id === "string" ? item.id : "",
          ownedBy: typeof item.owned_by === "string" ? item.owned_by : undefined,
        }))
        .filter((item: EduAILocalBridgeModel) => Boolean(item.id))
    : [];

  return {
    baseUrl: normalized,
    models,
    latencyMs: performance.now() - started,
  };
}

export async function runEduAILocalBridgeChat(input: {
  baseUrl: string;
  model: string;
  prompt: string;
  token?: string;
  maxTokens?: number;
}): Promise<EduAILocalBridgeChatResult> {
  const normalized = normalizeEduAILocalBridgeBaseUrl(input.baseUrl);
  const prompt = input.prompt.trim();
  if (!input.model.trim()) throw new Error("Selecciona un modelo local.");
  if (!prompt) throw new Error("Escribe una instrucción.");

  const knowledgeHits = await searchEduAILocalKnowledgePack(prompt, 5).catch(() => []);
  const context = knowledgeHits.length
    ? "\n\nContexto local de EDUAI (usa solo si es relevante):\n" +
      knowledgeHits
        .map((hit, index) => `[${index + 1}] ${hit.source}\n${hit.snippet}`)
        .join("\n\n")
    : "";

  const started = performance.now();
  let response: Response;
  try {
    response = await fetch(`${normalized}/chat/completions`, {
      method: "POST",
      headers: headers(input.token),
      body: JSON.stringify({
        model: input.model,
        messages: [
          {
            role: "system",
            content:
              "Eres EDUAI Local Bridge, un asistente local experto en EDUAI. Usa el contexto local suministrado, no inventes archivos ni acciones y distingue claramente lo que no puedas verificar.",
          },
          { role: "user", content: prompt + context },
        ],
        temperature: 0.25,
        max_tokens: Math.max(32, Math.min(2048, input.maxTokens || 512)),
        stream: false,
      }),
    });
  } catch {
    throw new Error(
      "La conexión al modelo local falló. Comprueba el servidor, CORS y que el modelo siga cargado.",
    );
  }

  const data = await readJson(response);
  const text = data?.choices?.[0]?.message?.content;
  const latencyMs = performance.now() - started;
  const promptTokens = Number(data?.usage?.prompt_tokens || 0);
  const completionTokens = Number(data?.usage?.completion_tokens || 0);
  const tokensPerSecond =
    completionTokens > 0 && latencyMs > 0
      ? completionTokens / (latencyMs / 1000)
      : null;

  return {
    text: typeof text === "string" && text.trim() ? text.trim() : "El servidor local no devolvió texto.",
    latencyMs,
    promptTokens,
    completionTokens,
    tokensPerSecond,
    knowledgeSources: [...new Set(knowledgeHits.map((hit) => hit.source))],
  };
}
