import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE_HEADERS })

  const [{ data, error }, { data: profile, error: profileError }] = await Promise.all([
    supabase
      .from("study_sessions")
      .select("id, topic, created_at, score, status, study_mode, correct_answers, total_questions, current_level")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("xp, streak_days")
      .eq("id", user.id)
      .maybeSingle(),
  ])

  if (error) {
    console.error("[sessions] GET failed:", error)
    return NextResponse.json(
      { error: "No se pudieron cargar las sesiones.", detail: error.message },
      { status: 500, headers: NO_STORE_HEADERS },
    )
  }

  if (profileError) {
    console.warn("[sessions] profile progress unavailable:", profileError.message)
  }

  const sessions = data || []
  const completed = sessions.filter((session) => session.status === "completed").length
  const scored = sessions.filter((session) => typeof session.score === "number")
  const avgScore = scored.length
    ? Math.round(scored.reduce((sum, session) => sum + Number(session.score || 0), 0) / scored.length)
    : null

  return NextResponse.json(
    {
      sessions,
      summary: {
        total: sessions.length,
        completed,
        avgScore,
      },
      progress: {
        xp: Number(profile?.xp || 0),
        streakDays: Number(profile?.streak_days || 0),
      },
      syncedAt: new Date().toISOString(),
    },
    { headers: NO_STORE_HEADERS },
  )
}

// Crear nueva sesión
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { topic, study_mode = "normal" } = await req.json()

  const { data, error } = await supabase
    .from("study_sessions")
    .insert({
      user_id: user.id,
      topic,
      study_mode,
      status: "active",
      current_level: 1,
    })
    .select()
    .single()

  if (error) return new Response(error.message, { status: 500 })
  return NextResponse.json(data)
}

// Actualizar sesión existente
export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { session_id, ...updates } = await req.json()

  const { data, error } = await supabase
    .from("study_sessions")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", session_id)
    .eq("user_id", user.id)
    .select()
    .single()

  if (error) return new Response(error.message, { status: 500 })
  return NextResponse.json(data)
}
