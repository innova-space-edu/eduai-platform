"use client"

import { useEffect, useState } from "react"
import { Target, Calendar, CalendarDays, Zap } from "lucide-react"

interface Mission {
  id: string
  mission_id: string
  type: string
  title: string
  description: string
  goal: number
  progress: number
  xp_reward: number
  completed: boolean
  expires_at: string
}

export default function MissionsPanel() {
  const [missions, setMissions] = useState<Mission[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    fetch("/api/missions")
      .then(r => r.json())
      .then(data => setMissions(data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const daily  = missions.filter(m => m.type === "daily")
  const weekly = missions.filter(m => m.type === "weekly")

  if (loading || missions.length === 0) return null

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center">
          <Target size={14} className="text-amber-400" />
        </div>
        <h3 className="text-white font-semibold text-sm">Misiones</h3>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {/* Diarias */}
        <MissionGroup
          title="Diarias"
          icon={<Calendar size={12} className="text-blue-400" />}
          missions={daily}
          color="#3b82f6"
        />

        {/* Semanales */}
        <MissionGroup
          title="Semanales"
          icon={<CalendarDays size={12} className="text-purple-400" />}
          missions={weekly}
          color="#8b5cf6"
        />
      </div>
    </div>
  )
}

function MissionGroup({
  title, icon, missions, color,
}: {
  title: string
  icon: React.ReactNode
  missions: Mission[]
  color: string
}) {
  if (missions.length === 0) return null

  return (
    <div
      className="rounded-2xl p-4 border"
      style={{
        background: "rgba(255,255,255,0.02)",
        borderColor: "rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-center gap-1.5 mb-3">
        {icon}
        <p className="text-gray-500 text-[11px] font-semibold uppercase tracking-widest">{title}</p>
      </div>
      <div className="space-y-2.5">
        {missions.map(m => <MissionItem key={m.id} mission={m} accentColor={color} />)}
      </div>
    </div>
  )
}

function MissionItem({ mission, accentColor }: { mission: Mission; accentColor: string }) {
  const percent = Math.round((mission.progress / mission.goal) * 100)

  return (
    <div
      className="rounded-xl p-3 border transition-all"
      style={{
        background: mission.completed
          ? "rgba(16,185,129,0.05)"
          : "rgba(255,255,255,0.02)",
        borderColor: mission.completed
          ? "rgba(16,185,129,0.15)"
          : "rgba(255,255,255,0.05)",
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-medium leading-tight truncate"
             style={{ color: mission.completed ? "#6ee7b7" : "#e2e8f0" }}>
            {mission.completed && "✓ "}{mission.title}
          </p>
          <p className="text-gray-500 text-xs mt-0.5 line-clamp-1">{mission.description}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 px-2 py-0.5 rounded-lg bg-amber-500/8 border border-amber-500/15">
          <Zap size={9} className="text-amber-400" />
          <span className="text-amber-400 text-[11px] font-bold">{mission.xp_reward}</span>
        </div>
      </div>

      {!mission.completed && (
        <>
          <div className="w-full h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${percent}%`,
                background: `linear-gradient(90deg, ${accentColor}bb, ${accentColor})`,
              }}
            />
          </div>
          <p className="text-gray-600 text-[10px] text-right mt-1 tabular-nums">
            {mission.progress}/{mission.goal}
          </p>
        </>
      )}
    </div>
  )
}
