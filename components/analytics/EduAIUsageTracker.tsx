"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { resolveAnalyticsModule } from "@/lib/admin/analytics-catalog"
import { trackEduAIEvent, type EduAIEventType } from "@/lib/analytics/client"

const SKIP_PREFIXES = ["/login", "/register"]
const TRACK_DEDUP_MS = 20_000
const RESOURCE_DEDUP_MS = 3_000

const API_EXCLUSIONS = [
  "/api/analytics/",
  "/api/admin",
  "/api/reports",
  "/api/exam/heartbeat",
  "/api/exams/heartbeat",
]

const GENERATION_KEYWORDS = [
  "agent",
  "generate",
  "generation",
  "chat",
  "completion",
  "educador",
  "planning",
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
]

const UI_ACTIONS: Array<{
  keywords: string[]
  action: string
  eventType: EduAIEventType
}> = [
  { keywords: ["descargar", "download"], action: "download", eventType: "download" },
  { keywords: ["exportar", "export", "pdf", "excel", "xlsx", "csv"], action: "export", eventType: "export" },
  { keywords: ["subir", "cargar archivo", "importar", "upload"], action: "upload", eventType: "upload" },
  { keywords: ["regenerar", "generar", "crear con ia", "corregir con ia"], action: "generate", eventType: "action" },
  { keywords: ["guardar", "publicar", "entregar", "enviar", "copiar"], action: "action", eventType: "action" },
  { keywords: ["eliminar", "borrar"], action: "delete", eventType: "action" },
]

function classifyApiEvent(pathname: string): EduAIEventType {
  const value = pathname.toLowerCase()
  if (value.includes("download")) return "download"
  if (value.includes("export") || value.includes("pdf") || value.includes("xlsx") || value.includes("csv")) return "export"
  if (value.includes("upload") || value.includes("import") || value.includes("ingest")) return "upload"
  if (GENERATION_KEYWORDS.some(keyword => value.includes(keyword))) return "generation"
  return "action"
}

function shouldObserveApi(pathname: string) {
  if (!pathname.startsWith("/api/")) return false
  if (API_EXCLUSIONS.some(prefix => pathname.startsWith(prefix))) return false
  if (/heartbeat|keepalive|health|poll|presence/i.test(pathname)) return false
  return true
}

function canonicalUiAction(target: Element) {
  const element = target.closest("button, a, [role='button'], input[type='submit']")
  if (!element) return null

  if (element instanceof HTMLAnchorElement && element.hasAttribute("download")) {
    return { action: "download", eventType: "download" as EduAIEventType }
  }

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
      metadata: { instrumentation: "route_view_v2" },
    })
  }, [pathname])

  useEffect(() => {
    const recentResources = new Map<string, number>()
    const recentUiActions = new Map<string, number>()

    const observer = typeof PerformanceObserver !== "undefined"
      ? new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            if (entry.entryType !== "resource") continue
            const resourceEntry = entry as PerformanceResourceTiming

            let url: URL
            try {
              url = new URL(resourceEntry.name)
            } catch {
              continue
            }

            if (url.origin !== window.location.origin || !shouldObserveApi(url.pathname)) continue
            if (!resolveAnalyticsModule(window.location.pathname)) continue

            const now = Date.now()
            const dedupKey = `${window.location.pathname}:${url.pathname}`
            const previous = recentResources.get(dedupKey) || 0
            if (now - previous < RESOURCE_DEDUP_MS) continue
            recentResources.set(dedupKey, now)

            trackEduAIEvent({
              eventType: classifyApiEvent(url.pathname),
              success: true,
              latencyMs: Math.max(0, Math.round(resourceEntry.duration)),
              metadata: {
                apiPath: url.pathname.slice(0, 180),
                initiatorType: resourceEntry.initiatorType || "resource",
                instrumentation: "performance_resource_v1",
              },
            })
          }
        })
      : null

    try {
      observer?.observe({ type: "resource", buffered: false })
    } catch {
      // Navegadores sin soporte para PerformanceObserver continúan sin telemetría de recursos.
    }

    const handleClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return
      if (!resolveAnalyticsModule(window.location.pathname)) return

      const action = canonicalUiAction(event.target)
      if (!action) return

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
      if (!resolveAnalyticsModule(window.location.pathname)) return
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
      observer?.disconnect()
      document.removeEventListener("click", handleClick, true)
      window.removeEventListener("error", handleRuntimeError)
      window.removeEventListener("unhandledrejection", handleRuntimeError)
    }
  }, [])

  return null
}
