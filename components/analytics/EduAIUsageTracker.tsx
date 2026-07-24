"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { resolveAnalyticsModule } from "@/lib/admin/analytics-catalog"

const SKIP_PREFIXES = ["/login", "/register"]
const TRACK_DEDUP_MS = 20_000

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

    fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
      body: JSON.stringify({
        path: pathname,
        eventType: "page_view",
        success: true,
      }),
    }).catch(() => {
      // La analítica nunca debe interrumpir la experiencia principal.
    })
  }, [pathname])

  return null
}
