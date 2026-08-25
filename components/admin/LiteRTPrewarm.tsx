"use client"

import { useEffect } from "react"
import { scheduleLiteRTPrewarm } from "@/lib/ai/local/litert-runtime"

export default function LiteRTPrewarm() {
  useEffect(() => scheduleLiteRTPrewarm({ timeoutMs: 2200, delayMs: 600 }), [])
  return null
}
