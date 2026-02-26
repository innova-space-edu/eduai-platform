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
    console.log("[XP] Ganando:", amount, reason)

    // Mostrar toast
    const id = ++eventId
    setEvents(prev => [...prev, { id, amount, reason }])

    setTimeout(() => {
      setEvents(prev => prev.filter(e => e.id !== id))
    }, 2000)

    // Actualizar en base de datos
    try {
      console.log("[XP] Llamando API...")
      const res = await fetch("/api/profile/xp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xp_gained: amount }),
      })
      console.log("[XP] Respuesta:", res.status)
      if (!res.ok) {
        const text = await res.text()
        console.error("[XP] Error:", text)
        return
      }
      const data = await res.json()
      console.log("[XP] Nuevo XP:", data)
      onXPUpdate?.(data.xp, data.level)
    } catch (e) {
      console.error("[XP] Excepción:", e)
    }
  }, [onXPUpdate])

  return { events, gainXP }
}
