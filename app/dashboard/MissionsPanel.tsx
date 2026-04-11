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
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(217,119,6,0.12)", border: "1px solid rgba(217,119,6,0.22)" }}>
          <Target size={14} style={{ color: "var(--accent-amber)" }} />
        </div>
        <h3 className="text-main font-semibold text-sm">Misiones</h3>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <MissionGroup title="Diarias"   icon={<Calendar    size={12} style={{ color: "var(--accent-blue)"   }} />} missions={daily}  color="var(--accent-blue)" />
        <MissionGroup title="Semanales" icon={<CalendarDays size={12} style={{ color: "var(--accent-purple)" }} />} missions={weekly} color="var(--accent-purple)" />
      </div>
    </div>
  )
}

function MissionGroup({ title, icon, missions, color }: {
  title: string
  icon: React.ReactNode
  missions: Mission[]
  color: string
}) {
  if (missions.length === 0) return null

  return (
    <div className="rounded-2xl p-4 border"
      style={{ background: "var(--bg-card)", borderColor: "var(--border-soft)", boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-center gap-1.5 mb-3">
        {icon}
        <p className="text-muted2 text-[11px] font-semibold uppercase tracking-widest">{title}</p>
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
        background: mission.completed ? "rgba(5,150,105,0.06)" : "var(--bg-card-soft)",
        borderColor: mission.completed ? "rgba(5,150,105,0.18)" : "var(--border-soft)",
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-medium leading-tight truncate"
            style={{ color: mission.completed ? "#059669" : "var(--text-primary)" }}>
            {mission.completed && "✓ "}{mission.title}
          </p>
          <p className="text-muted2 text-xs mt-0.5 line-clamp-1">{mission.description}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 px-2 py-0.5 rounded-lg"
          style={{ background: "rgba(217,119,6,0.09)", border: "1px solid rgba(217,119,6,0.18)" }}>
          <Zap size={9} style={{ color: "var(--accent-amber)" }} />
          <span className="text-[11px] font-bold" style={{ color: "var(--accent-amber)" }}>{mission.xp_reward}</span>
        </div>
      </div>

      {!mission.completed && (
        <>
          <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "var(--border-soft)" }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${percent}%`, background: `linear-gradient(90deg, ${accentColor}bb, ${accentColor})` }}
            />
          </div>
          <p className="text-muted2 text-[10px] text-right mt-1 tabular-nums">
            {mission.progress}/{mission.goal}
          </p>
        </>
      )}
    </div>
  )
}
