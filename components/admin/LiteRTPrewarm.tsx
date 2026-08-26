"use client"

import { useEffect } from "react"
import { scheduleLiteRTModelPrewarm } from "@/lib/ai/local/litert-model-prewarm"
import { scheduleLiteRTPrewarm } from "@/lib/ai/local/litert-runtime"

export default function LiteRTPrewarm() {
  useEffect(() => {
    const cancelRuntime = scheduleLiteRTPrewarm({ timeoutMs: 2200, delayMs: 600 })
    const cancelModels = scheduleLiteRTModelPrewarm({ timeoutMs: 4800, delayMs: 1700, maxModels: 2 })
    return () => {
      cancelRuntime()
      cancelModels()
    }
  }, [])
  return null
}
