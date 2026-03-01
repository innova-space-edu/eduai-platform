"use client"

import { useEffect, useState } from "react"

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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/missions")
      .then(r => r.json())
      .then(data => setMissions(data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const daily = missions.filter(m => m.type === "daily")
  const weekly = missions.filter(m => m.type === "weekly")

  if (loading) return null
  if (missions.length === 0) return null

  return (
    <div className="mb-6 sm:mb-8">
      <h3 className="text-base sm:text-lg font-semibold text-white mb-3">⚔️ Misiones</h3>
      <div className="grid sm:grid-cols-2 gap-4">

        {/* Diarias */}
        <div className="bg-gray-900/60 border border-white/5 rounded-3xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">📅 Diarias</p>
          <div className="space-y-3">
            {daily.map(m => (
              <MissionItem key={m.id} mission={m} />
            ))}
          </div>
        </div>

        {/* Semanales */}
        <div className="bg-gray-900/60 border border-white/5 rounded-3xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">📆 Semanales</p>
          <div className="space-y-3">
            {weekly.map(m => (
              <MissionItem key={m.id} mission={m} />
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

function MissionItem({ mission }: { mission: Mission }) {
  const percent = Math.round((mission.progress / mission.goal) * 100)

  return (
    <div className={`rounded-2xl p-3 transition-all ${
      mission.completed
        ? "bg-green-500/5 border border-green-500/20"
        : "bg-white/5/50 border border-gray-700/50"
    }`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className={`text-sm font-medium ${mission.completed ? "text-green-400" : "text-white"}`}>
            {mission.completed && "✅ "}{mission.title}
          </p>
          <p className="text-gray-500 text-xs">{mission.description}</p>
        </div>
        <span className="text-amber-400 text-xs font-bold whitespace-nowrap">+{mission.xp_reward} XP</span>
      </div>

      {!mission.completed && (
        <>
          <div className="w-full bg-gray-700 rounded-full h-1.5 mb-1">
            <div
              className="h-1.5 bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-gray-600 text-xs text-right">{mission.progress}/{mission.goal}</p>
        </>
      )}
    </div>
  )
}
