import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

const LEVEL_THRESHOLDS = [0, 100, 250, 500, 1000, 2000, 5000]
const LEVEL_NAMES = ["", "Explorador", "Aprendiz", "Practicante", "Analista", "Experto", "Maestro"]

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { xp_gained } = await req.json()

  // Obtener perfil actual
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("xp, level, streak_days, last_study_date")
    .eq("id", user.id)
    .single()

  if (error || !profile) return new Response("Profile not found", { status: 404 })

  const newXP = (profile.xp || 0) + xp_gained

  // Calcular nuevo nivel
  let newLevel = profile.level || 1
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 1; i--) {
    if (newXP >= LEVEL_THRESHOLDS[i]) {
      newLevel = i
      break
    }
  }

  // Calcular racha
  const today = new Date().toISOString().split("T")[0]
  const lastStudy = profile.last_study_date
  let newStreak = profile.streak_days || 0

  if (lastStudy === today) {
    // Ya estudió hoy, no cambia la racha
  } else if (lastStudy === new Date(Date.now() - 86400000).toISOString().split("T")[0]) {
    // Estudió ayer — suma racha
    newStreak += 1
  } else {
    // Rompió la racha
    newStreak = 1
  }

  // Actualizar perfil
  const { data: updated } = await supabase
    .from("profiles")
    .update({
      xp: newXP,
      level: newLevel,
      streak_days: newStreak,
      last_study_date: today,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select()
    .single()

  const leveledUp = newLevel > (profile.level || 1)

  return NextResponse.json({
    xp: newXP,
    level: newLevel,
    level_name: LEVEL_NAMES[newLevel],
    streak: newStreak,
    leveled_up: leveledUp,
    xp_to_next: LEVEL_THRESHOLDS[Math.min(newLevel + 1, 6)] - newXP,
  })
}
