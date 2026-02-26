import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export const ACHIEVEMENTS = [
  { id: "first_session",    title: "Primera sesión",       emoji: "🎯", description: "Completaste tu primera sesión",        xp: 20  },
  { id: "five_sessions",    title: "Estudiante dedicado",  emoji: "📚", description: "Completaste 5 sesiones",               xp: 50  },
  { id: "ten_sessions",     title: "Imparable",            emoji: "🚀", description: "Completaste 10 sesiones",              xp: 100 },
  { id: "perfect_score",    title: "Perfección",           emoji: "⭐", description: "100% en un quiz",                     xp: 75  },
  { id: "streak_3",         title: "En racha",             emoji: "🔥", description: "3 días consecutivos",                  xp: 30  },
  { id: "streak_7",         title: "Semana completa",      emoji: "💫", description: "7 días consecutivos",                  xp: 100 },
  { id: "streak_30",        title: "Mes de estudio",       emoji: "🏅", description: "30 días consecutivos",                 xp: 500 },
  { id: "five_topics",      title: "Explorador curioso",   emoji: "🗺️", description: "5 temas diferentes",                  xp: 40  },
  { id: "ten_topics",       title: "Enciclopedia",         emoji: "📖", description: "10 temas diferentes",                  xp: 80  },
  { id: "level_2",          title: "Aprendiz",             emoji: "🏅", description: "Nivel Aprendiz alcanzado",             xp: 50  },
  { id: "level_3",          title: "Practicante",          emoji: "🥈", description: "Nivel Practicante alcanzado",          xp: 100 },
  { id: "level_4",          title: "Analista",             emoji: "🥇", description: "Nivel Analista alcanzado",             xp: 200 },
  { id: "level_5",          title: "Experto",              emoji: "💎", description: "Nivel Experto alcanzado",              xp: 400 },
  { id: "socratic_master",  title: "Maestro Socrático",    emoji: "🏛️", description: "5 sesiones en modo Sócrates",        xp: 60  },
  { id: "xp_100",           title: "Centenario",           emoji: "💯", description: "100 XP acumulados",                   xp: 10  },
  { id: "xp_500",           title: "Medio millar",         emoji: "🌟", description: "500 XP acumulados",                   xp: 25  },
  { id: "xp_1000",          title: "Millar",               emoji: "👑", description: "1000 XP acumulados",                  xp: 50  },
]

// GET — obtener logros del usuario
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { data: unlocked } = await supabase
    .from("achievements")
    .select("achievement_id, unlocked_at")
    .eq("user_id", user.id)

  const unlockedIds = new Set(unlocked?.map(a => a.achievement_id) || [])

  return NextResponse.json(
    ACHIEVEMENTS.map(a => ({
      ...a,
      unlocked: unlockedIds.has(a.id),
      unlocked_at: unlocked?.find(u => u.achievement_id === a.id)?.unlocked_at || null,
    }))
  )
}

// POST — verificar y desbloquear logros nuevos
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  // Obtener stats del usuario
  const [{ data: profile }, { data: sessions }, { data: existing }] = await Promise.all([
    supabase.from("profiles").select("xp, level, streak_days").eq("id", user.id).single(),
    supabase.from("study_sessions").select("topic, status, study_mode, score").eq("user_id", user.id),
    supabase.from("achievements").select("achievement_id").eq("user_id", user.id),
  ])

  const existingIds = new Set(existing?.map(a => a.achievement_id) || [])
  const completedSessions = sessions?.filter(s => s.status === "completed") || []
  const uniqueTopics = new Set(sessions?.map(s => s.topic) || []).size
  const socratiSessions = completedSessions.filter(s => s.study_mode === "socratic").length
  const hasPerfect = completedSessions.some(s => s.score === 100)

  const checks: Record<string, boolean> = {
    first_session:   completedSessions.length >= 1,
    five_sessions:   completedSessions.length >= 5,
    ten_sessions:    completedSessions.length >= 10,
    perfect_score:   hasPerfect,
    streak_3:        (profile?.streak_days || 0) >= 3,
    streak_7:        (profile?.streak_days || 0) >= 7,
    streak_30:       (profile?.streak_days || 0) >= 30,
    five_topics:     uniqueTopics >= 5,
    ten_topics:      uniqueTopics >= 10,
    level_2:         (profile?.level || 1) >= 2,
    level_3:         (profile?.level || 1) >= 3,
    level_4:         (profile?.level || 1) >= 4,
    level_5:         (profile?.level || 1) >= 5,
    socratic_master: socratiSessions >= 5,
    xp_100:          (profile?.xp || 0) >= 100,
    xp_500:          (profile?.xp || 0) >= 500,
    xp_1000:         (profile?.xp || 0) >= 1000,
  }

  // Desbloquear nuevos logros
  const newlyUnlocked: string[] = []
  for (const [id, condition] of Object.entries(checks)) {
    if (condition && !existingIds.has(id)) {
      newlyUnlocked.push(id)
    }
  }

  if (newlyUnlocked.length > 0) {
    await supabase.from("achievements").insert(
      newlyUnlocked.map(id => ({ user_id: user.id, achievement_id: id }))
    )

    // Dar XP por cada logro desbloqueado
    const xpBonus = newlyUnlocked.reduce((sum, id) => {
      const a = ACHIEVEMENTS.find(a => a.id === id)
      return sum + (a?.xp || 0)
    }, 0)

    if (xpBonus > 0) {
      try {
        await supabase.rpc("increment_xp", { user_id_input: user.id, xp_amount: xpBonus })
      } catch {
        await supabase
          .from("profiles")
          .update({ xp: (profile?.xp || 0) + xpBonus })
          .eq("id", user.id)
      }
    }
  }

  return NextResponse.json({
    newlyUnlocked: newlyUnlocked.map(id => ACHIEVEMENTS.find(a => a.id === id)),
  })
}
