"use client"

import { useEffect, useState } from "react"

interface Achievement {
  id: string
  title: string
  emoji: string
  description: string
  xp: number
}

interface Props {
  achievements: Achievement[]
  onDismiss: (id: string) => void
}

export default function AchievementToast({ achievements, onDismiss }: Props) {
  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-3 pointer-events-none">
      {achievements.map((a) => (
        <AchievementCard key={a.id} achievement={a} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function AchievementCard({ achievement, onDismiss }: { achievement: Achievement, onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setTimeout(() => setVisible(true), 50)
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onDismiss(achievement.id), 300)
    }, 4000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className={`
      bg-gray-900 border border-amber-500/50 rounded-2xl p-4 shadow-2xl shadow-amber-500/10
      flex items-center gap-3 min-w-[280px] pointer-events-auto
      transition-all duration-300
      ${visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10"}
    `}>
      <div className="text-3xl">{achievement.emoji}</div>
      <div className="flex-1">
        <p className="text-xs text-amber-400 font-medium uppercase tracking-wider mb-0.5">
          🏆 Logro desbloqueado
        </p>
        <p className="text-white font-bold text-sm">{achievement.title}</p>
        <p className="text-gray-500 text-xs">{achievement.description}</p>
      </div>
      <div className="text-amber-400 text-xs font-bold">+{achievement.xp} XP</div>
    </div>
  )
}