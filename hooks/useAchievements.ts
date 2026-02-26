import { useState, useCallback } from "react"

interface Achievement {
  id: string
  title: string
  emoji: string
  description: string
  xp: number
}

export function useAchievements() {
  const [pending, setPending] = useState<Achievement[]>([])

  const checkAchievements = useCallback(async () => {
    try {
      const res = await fetch("/api/achievements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!res.ok) return
      const data = await res.json()
      if (data.newlyUnlocked?.length > 0) {
        setPending(prev => [...prev, ...data.newlyUnlocked])
      }
    } catch (e) {
      console.error("Achievement check error:", e)
    }
  }, [])

  function dismiss(id: string) {
    setPending(prev => prev.filter(a => a.id !== id))
  }

  return { pending, checkAchievements, dismiss }
}
