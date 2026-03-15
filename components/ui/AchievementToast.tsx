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
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-3 pointer-events-none">
      {achievements.map((a) => (
        <AchievementCard key={a.id} achievement={a} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function AchievementCard({
  achievement,
  onDismiss,
}: {
  achievement: Achievement
  onDismiss: (id: string) => void
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const show = setTimeout(() => setVisible(true), 50)
    const hide = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onDismiss(achievement.id), 400)
    }, 4500)
    return () => { clearTimeout(show); clearTimeout(hide) }
  }, [])

  return (
    <div
      className={`
        pointer-events-auto w-[300px] rounded-2xl p-4
        border border-amber-500/20
        shadow-2xl shadow-black/40
        transition-all duration-400
        ${visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"}
      `}
      style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1a1a2e 100%)",
      }}
    >
      {/* Top label */}
      <div className="flex items-center gap-1.5 mb-3">
        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-amber-400 text-[10px] font-semibold uppercase tracking-widest">
          Logro desbloqueado
        </span>
      </div>

      {/* Content */}
      <div className="flex items-center gap-3">
        {/* Emoji with glow */}
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
          style={{
            background: "rgba(245,158,11,0.12)",
            border: "1px solid rgba(245,158,11,0.25)",
            boxShadow: "0 0 16px rgba(245,158,11,0.15)",
          }}
        >
          {achievement.emoji}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm leading-tight truncate">
            {achievement.title}
          </p>
          <p className="text-gray-500 text-xs mt-0.5 leading-snug line-clamp-2">
            {achievement.description}
          </p>
        </div>

        {/* XP badge */}
        <div className="flex-shrink-0 px-2 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <span className="text-amber-400 text-xs font-bold">+{achievement.xp}</span>
          <span className="text-amber-500/60 text-[10px] ml-0.5">XP</span>
        </div>
      </div>

      {/* Progress bar (visual only) */}
      <div className="mt-3 h-0.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
          style={{
            width: visible ? "100%" : "0%",
            transition: "width 4.5s linear",
          }}
        />
      </div>
    </div>
  )
}
