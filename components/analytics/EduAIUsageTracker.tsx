"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { resolveAnalyticsModule } from "@/lib/admin/analytics-catalog"
import {
  trackEduAIEvent,
  type EduAIAnalyticsMetadata,
  type EduAIEventType,
} from "@/lib/analytics/client"

const SKIP_PREFIXES = ["/login", "/register"]
const TRACK_DEDUP_MS = 20_000
const API_EXCLUSIONS = [
  "/api/analytics/track",
  "/api/admin",
  "/api/reports",
]

const GENERATION_KEYWORDS = [
  "agent",
  "generate",
  "generation",
  "chat",
  "completion",
  "planning",
  "educador",
  "evaluate",
  "grade",
  "correct",
  "transcribe",
  "speech",
  "tts",
  "image",
  "video",
  "audio",
  "notebook",
  "rag",
  "gemini",
  "openai",
  "groq",
  "anthropic",
  "fal",
  "replicate",
]

const UI_ACTIONS: Array<{
  keywords: string[]
  action: string
  eventType: EduAIEventType
}> = [
  { keywords: ["descargar", "download"], action: "download", eventType: "download" },
  { keywords: ["exportar", "export", "pdf", "excel", "xlsx", "csv"], action: "export", eventType: "export" },
  { keywords: ["subir", "cargar archivo", "importar", "upload"], action: "upload", eventType: "upload" },
  { keywords: ["regenerar", "generar", "crear con ia", "corregir con ia"], action: "generate", eventType: "generation" },
  { keywords: ["guardar", "publicar", "entregar", "enviar", "copiar", "eliminar", "borrar"], action: "action", eventType: "action" },
]

type UsageMetrics = {
  inputTokens: number | null
  outputTokens: number | null
  estimatedCost: number | null
  provider: string | null
  model: string | null
}

function finiteMetric(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

function firstNumber(values: unknown[]) {
  for (const value of values) {
    const metric = finiteMetric(value)
    if (metric !== null) return metric
  }
  return null
}

function firstString(values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 180)
  }
  return null
}

function readUsageMetrics(payload: unknown): UsageMetrics {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { inputTokens: null, outputTokens: null, estimatedCost: null, provider: null, model: null }
  }

  const root = payload as Record<string, unknown>
  const data = root.data && typeof root.data === "object" && !Array.isArray(root.data)
    ? root.data as Record<string, unknown>
    : {}
  const usageValue = root.usage || data.usage
  const usage = usageValue && typeof usageValue === "object" && !Array.isArray(usageValue)
    ? usageValue as Record<string, unknown>
    : {}
  const metricsValue = root.metrics || data.metrics
  const metrics = metricsValue && typeof metricsValue === "object" && !Array.isArray(metricsValue)
    ? metricsValue as Record<string, unknown>
    : {}

  return {
    inputTokens: firstNumber([
      root.inputTokens,
      root.input_tokens,
      data.inputTokens,
      data.input_tokens,
      usage.inputTokens,
      usage.input_tokens,
      usage.promptTokens,
      usage.prompt_tokens,
      metrics.inputTokens,
      metrics.input_tokens,
    ]),
    outputTokens: firstNumber([
      root.outputTokens,
      root.output_tokens,
      data.outputTokens,
      data.output_tokens,
      usage.outputTokens,
      usage.output_tokens,
      usage.completionTokens,
      usage.completion_tokens,
      metrics.outputTokens,
      metrics.output_tokens,
    ]),
    estimatedCost: firstNumber([
      root.estimatedCost,
      root.estimated_cost,
      root.cost,
      data.estimatedCost,
      data.estimated_cost,
      data.cost,
      usage.estimatedCost,
      usage.estimated_cost,
      usage.cost,
      metrics.estimatedCost,
      metrics.estimated_cost,
      metrics.cost,
    ]),
    provider: firstString([
      root.provider,
      root.modelProvider,
      root.model_provider,
      data.provider,
      data.modelProvider,
      data.model_provider,
    ]),
    model: firstString([
      root.model,
      root.modelName,
      root.model_name,
      data.model,
      data.modelName,
      data.model_name,
    ]),
  }
}

async function extractResponseMetrics(response: Response): Promise<UsageMetrics> {
  const empty = { inputTokens: null, outputTokens: null, estimatedCost: null, provider: null, model: null }
  const contentType = response.headers.get("content-type") || ""
  const contentLength = Number(response.headers.get("content-length") || 0)

  if (!contentType.includes("application/json")) return empty
  if (contentLength > 750_000) return empty

  try {
    return readUsageMetrics(await response.clone().json())
  } catch {
    return empty
  }
}

function classifyApiEvent(apiPath: string, method: string): EduAIEventType {
  const value = apiPath.toLowerCase()
  if (value.includes("download")) return "download"
  if (value.includes("export") || value.includes("pdf") || value.includes("xlsx") || value.includes("csv")) return "export"
  if (value.includes("upload") || value.includes("import") || value.includes("ingest")) return "upload"
  if (GENERATION_KEYWORDS.some(keyword => value.includes(keyword))) return "generation"
  return method === "DELETE" ? "action" : "action"
}

function shouldTrackApi(url: URL, method: string) {
  if (url.origin !== window.location.origin) return false
  if (!url.pathname.startsWith("/api/")) return false
  if (API_EXCLUSIONS.some(prefix => url.pathname.startsWith(prefix))) return false
  return !["GET", "HEAD", "OPTIONS"].includes(method)
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.method) return init.method.toUpperCase()
  if (typeof Request !== "undefined" && input instanceof Request) return input.method.toUpperCase()
  return "GET"
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input
  if (input instanceof URL) return input.toString()
  return input.url
}

function metadataForApi(
  apiPath: string,
  method: string,
  status: number | null,
  metrics?: UsageMetrics,
): EduAIAnalyticsMetadata {
  return {
    apiPath: apiPath.slice(0, 180),
    method,
    status,
    provider: metrics?.provider || null,
    model: metrics?.model || null,
    instrumentation: "client_fetch_v1",
  }
}

function canonicalUiAction(target: Element) {
  const element = target.closest("button, a, [role='button'], input[type='submit']")
  if (!element) return null

  const download = element instanceof HTMLAnchorElement && element.hasAttribute("download")
  if (download) return { action: "download", eventType: "download" as EduAIEventType }

  const label = [
    element.getAttribute("aria-label"),
    element.getAttribute("title"),
    element.textContent,
    element instanceof HTMLInputElement ? element.value : "",
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .slice(0, 240)

  if (!label) return null
  for (const definition of UI_ACTIONS) {
    if (definition.keywords.some(keyword => label.includes(keyword))) {
      return { action: definition.action, eventType: definition.eventType }
    }
  }
  return null
}

export default function EduAIUsageTracker() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname || SKIP_PREFIXES.some(prefix => pathname.includes(prefix))) return

    const module = resolveAnalyticsModule(pathname)
    if (!module) return

    const storageKey = `eduai-analytics:${pathname}`
    const now = Date.now()

    try {
      const lastTracked = Number(sessionStorage.getItem(storageKey) || 0)
      if (lastTracked && now - lastTracked < TRACK_DEDUP_MS) return
      sessionStorage.setItem(storageKey, String(now))
    } catch {
      // sessionStorage puede no estar disponible en navegación privada estricta.
    }

    trackEduAIEvent({
      path: pathname,
      eventType: "page_view",
      success: true,
      metadata: { instrumentation: "route_view_v1" },
    })
  }, [pathname])

  useEffect(() => {
    const nativeFetch = window.fetch.bind(window)
    const previousFetch = window.fetch

    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = requestMethod(input, init)
      let url: URL

      try {
        url = new URL(requestUrl(input), window.location.origin)
      } catch {
        return nativeFetch(input, init)
      }

      if (!shouldTrackApi(url, method)) return nativeFetch(input, init)

      const startedAt = performance.now()
      const currentPath = window.location.pathname
      const eventType = classifyApiEvent(url.pathname, method)

      try {
        const response = await nativeFetch(input, init)
        const latencyMs = Math.max(0, Math.round(performance.now() - startedAt))

        void extractResponseMetrics(response).then(metrics => {
          trackEduAIEvent({
            path: currentPath,
            eventType: response.ok ? eventType : "error",
            success: response.ok,
            latencyMs,
            inputTokens: metrics.inputTokens,
            outputTokens: metrics.outputTokens,
            estimatedCost: metrics.estimatedCost,
            errorCode: response.ok ? null : `http_${response.status}`,
            metadata: metadataForApi(url.pathname, method, response.status, metrics),
          })
        })

        return response
      } catch (error) {
        trackEduAIEvent({
          path: currentPath,
          eventType: "error",
          success: false,
          latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
          errorCode: error instanceof DOMException && error.name === "AbortError"
            ? "request_aborted"
            : "network_error",
          metadata: metadataForApi(url.pathname, method, null),
        })
        throw error
      }
    }) as typeof window.fetch

    const recentUiActions = new Map<string, number>()
    const handleClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return
      const action = canonicalUiAction(event.target)
      if (!action) return

      const module = resolveAnalyticsModule(window.location.pathname)
      if (!module) return

      const dedupKey = `${window.location.pathname}:${action.action}`
      const now = Date.now()
      const previous = recentUiActions.get(dedupKey) || 0
      if (now - previous < 1_200) return
      recentUiActions.set(dedupKey, now)

      trackEduAIEvent({
        eventType: action.eventType,
        success: true,
        metadata: {
          uiAction: action.action,
          instrumentation: "ui_action_v1",
        },
      })
    }

    const handleRuntimeError = () => {
      trackEduAIEvent({
        eventType: "error",
        success: false,
        errorCode: "client_runtime_error",
        metadata: { instrumentation: "browser_error_v1" },
      })
    }

    document.addEventListener("click", handleClick, true)
    window.addEventListener("error", handleRuntimeError)
    window.addEventListener("unhandledrejection", handleRuntimeError)

    return () => {
      window.fetch = previousFetch
      document.removeEventListener("click", handleClick, true)
      window.removeEventListener("error", handleRuntimeError)
      window.removeEventListener("unhandledrejection", handleRuntimeError)
    }
  }, [])

  return null
}
