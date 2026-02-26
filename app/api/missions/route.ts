import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

const DAILY_MISSIONS = [
  { id: "study_1",    title: "Estudioso",        description: "Estudia 1 tema hoy",           goal: 1,  xp: 20,  type: "daily"  },
  { id: "study_3",    title: "Triatleta mental",  description: "Estudia 3 temas hoy",          goal: 3,  xp: 50,  type: "daily"  },
  { id: "quiz_1",     title: "A prueba",          description: "Completa 1 quiz hoy",          goal: 1,  xp: 30,  type: "daily"  },
  { id: "correct_5",  title: "Precisión",         description: "5 respuestas correctas hoy",   goal: 5,  xp: 40,  type: "daily"  },
  { id: "streak",     title: "Constancia",        description: "Mantén tu racha de hoy",       goal: 1,  xp: 15,  type: "daily"  },
]

const WEEKLY_MISSIONS = [
  { id: "week_sessions", title: "Semana completa",  description: "10 sesiones esta semana",    goal: 10, xp: 150, type: "weekly" },
  { id: "week_perfect",  title: "Perfeccionista",   description: "3 quizzes perfectos",        goal: 3,  xp: 200, type: "weekly" },
  { id: "week_topics",   title: "Explorador semanal", description: "5 temas distintos",        goal: 5,  xp: 100, type: "weekly" },
  { id: "week_socratic", title: "Filósofo",         description: "3 sesiones modo Sócrates",   goal: 3,  xp: 120, type: "weekly" },
]

function getExpiry(type: string) {
  const now = new Date()
  if (type === "daily") {
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    return tomorrow.toISOString().split("T")[0]
  } else {
    const nextMonday = new Date(now)
    nextMonday.setDate(nextMonday.getDate() + (7 - nextMonday.getDay() + 1) % 7 || 7)
    nextMonday.setHours(0, 0, 0, 0)
    return nextMonday.toISOString().split("T")[0]
  }
}

// GET — obtener misiones activas, crear si no existen
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const today = new Date().toISOString().split("T")[0]

  // Limpiar misiones expiradas
  await supabase
    .from("missions")
    .delete()
    .eq("user_id", user.id)
    .lt("expires_at", today)

  // Obtener misiones activas
  const { data: active } = await supabase
    .from("missions")
    .select("*")
    .eq("user_id", user.id)
    .gte("expires_at", today)

  // Crear misiones si no hay suficientes
  const hasDaily = active?.some(m => m.type === "daily") || false
  const hasWeekly = active?.some(m => m.type === "weekly") || false

  const toCreate = []

  if (!hasDaily) {
    // Elegir 3 misiones diarias aleatorias
    const shuffled = [...DAILY_MISSIONS].sort(() => Math.random() - 0.5).slice(0, 3)
    for (const m of shuffled) {
      toCreate.push({
        user_id: user.id,
        mission_id: m.id,
        type: m.type,
        title: m.title,
        description: m.description,
        goal: m.goal,
        xp_reward: m.xp,
        expires_at: getExpiry("daily"),
      })
    }
  }

  if (!hasWeekly) {
    // Elegir 2 misiones semanales aleatorias
    const shuffled = [...WEEKLY_MISSIONS].sort(() => Math.random() - 0.5).slice(0, 2)
    for (const m of shuffled) {
      toCreate.push({
        user_id: user.id,
        mission_id: m.id,
        type: m.type,
        title: m.title,
        description: m.description,
        goal: m.goal,
        xp_reward: m.xp,
        expires_at: getExpiry("weekly"),
      })
    }
  }

  if (toCreate.length > 0) {
    await supabase.from("missions").insert(toCreate)
  }

  const { data: missions } = await supabase
    .from("missions")
    .select("*")
    .eq("user_id", user.id)
    .gte("expires_at", today)
    .order("type", { ascending: true })

  return NextResponse.json(missions || [])
}

// PATCH — actualizar progreso de misiones
export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { event } = await req.json()
  const today = new Date().toISOString().split("T")[0]

  const { data: missions } = await supabase
    .from("missions")
    .select("*")
    .eq("user_id", user.id)
    .eq("completed", false)
    .gte("expires_at", today)

  if (!missions || missions.length === 0) return NextResponse.json([])

  const newlyCompleted = []

  for (const mission of missions) {
    let shouldIncrement = false

    if (event === "session_completed" && ["study_1", "study_3", "week_sessions"].includes(mission.mission_id)) {
      shouldIncrement = true
    }
    if (event === "quiz_completed" && ["quiz_1", "week_perfect"].includes(mission.mission_id)) {
      shouldIncrement = true
    }
    if (event === "correct_answer" && mission.mission_id === "correct_5") {
      shouldIncrement = true
    }
    if (event === "topic_studied" && ["week_topics"].includes(mission.mission_id)) {
      shouldIncrement = true
    }
    if (event === "socratic_session" && mission.mission_id === "week_socratic") {
      shouldIncrement = true
    }
    if (event === "streak" && mission.mission_id === "streak") {
      shouldIncrement = true
    }

    if (shouldIncrement) {
      const newProgress = Math.min(mission.progress + 1, mission.goal)
      const completed = newProgress >= mission.goal

      await supabase
        .from("missions")
        .update({ progress: newProgress, completed })
        .eq("id", mission.id)

      if (completed) {
        newlyCompleted.push({ ...mission, progress: newProgress, completed: true })
        // Dar XP por misión completada
        await fetch("/api/profile/xp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ xp_gained: mission.xp_reward }),
        }).catch(() => {})
      }
    }
  }

  return NextResponse.json({ completed: newlyCompleted })
}
