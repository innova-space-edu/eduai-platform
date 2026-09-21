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

function normalizeLoopbackBaseUrl(input: string) {
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
  const normalized = normalizeLoopbackBaseUrl(baseUrl);
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
  const normalized = normalizeLoopbackBaseUrl(input.baseUrl);
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
