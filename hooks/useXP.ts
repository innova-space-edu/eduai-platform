import { useState, useCallback } from "react"

interface XPEvent {
  id: number
  amount: number
  reason: string
}

let eventId = 0

export function useXP(onXPUpdate?: (newXP: number, newLevel: number) => void) {
  const [events, setEvents] = useState<XPEvent[]>([])

  const gainXP = useCallback(async (amount: number, reason: string) => {
    const id = ++eventId
    setEvents(prev => [...prev, { id, amount, reason }])
    setTimeout(() => {
      setEvents(prev => prev.filter(e => e.id !== id))
    }, 2000)

    try {
      const res = await fetch("/api/profile/xp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xp_gained: amount }),
      })
      if (!res.ok) return
      const data = await res.json()
      onXPUpdate?.(data.xp, data.level)
    } catch (e) {
      console.error("XP error:", e)
    }
  }, [onXPUpdate])

  return { events, gainXP }
}
