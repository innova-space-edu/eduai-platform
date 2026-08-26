"use client"

import { useEffect } from "react"
import { prewarmCalibratedLiteRTModels, scheduleLiteRTModelPrewarm } from "@/lib/ai/local/litert-model-prewarm"
import { scheduleLiteRTPrewarm } from "@/lib/ai/local/litert-runtime"

export default function LiteRTPrewarm() {
  useEffect(() => {
    const cancelRuntime = scheduleLiteRTPrewarm({ timeoutMs: 2200, delayMs: 600 })
    const cancelModels = scheduleLiteRTModelPrewarm({ timeoutMs: 4800, delayMs: 1700, maxModels: 2 })
    const onRouteProfile = () => void prewarmCalibratedLiteRTModels({ maxModels: 2 })
    window.addEventListener("eduai:litert-route-profile", onRouteProfile)
    return () => {
      cancelRuntime()
      cancelModels()
      window.removeEventListener("eduai:litert-route-profile", onRouteProfile)
    }
  }, [])
  return null
}
