import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// Algoritmo SM-2
function sm2(easiness: number, interval: number, repetitions: number, score: number) {
  // score: 0-100 → convertir a 0-5
  const q = Math.round((score / 100) * 5)

  let newEasiness = easiness + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  if (newEasiness < 1.3) newEasiness = 1.3

  let newRepetitions = repetitions
  let newInterval = interval

  if (q < 3) {
    newRepetitions = 0
    newInterval = 1
  } else {
    newRepetitions += 1
    if (newRepetitions === 1) newInterval = 1
    else if (newRepetitions === 2) newInterval = 6
    else newInterval = Math.round(interval * newEasiness)
  }

  const nextReview = new Date()
  nextReview.setDate(nextReview.getDate() + newInterval)

  return {
    easiness: newEasiness,
    interval: newInterval,
    repetitions: newRepetitions,
    next_review: nextReview.toISOString().split("T")[0],
  }
}

// GET — obtener temas pendientes de repaso
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const today = new Date().toISOString().split("T")[0]

  const { data } = await supabase
    .from("spaced_repetition")
    .select("*")
    .eq("user_id", user.id)
    .lte("next_review", today)
    .order("next_review", { ascending: true })

  return NextResponse.json(data || [])
}

// POST — registrar resultado y calcular próximo repaso
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { topic, score } = await req.json()

  // Buscar registro existente
  const { data: existing } = await supabase
    .from("spaced_repetition")
    .select("*")
    .eq("user_id", user.id)
    .eq("topic", topic)
    .single()

  const current = existing || { easiness: 2.5, interval: 1, repetitions: 0 }
  const updated = sm2(current.easiness, current.interval, current.repetitions, score)

  const { data } = await supabase
    .from("spaced_repetition")
    .upsert({
      user_id: user.id,
      topic,
      ...updated,
      last_score: score,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,topic" })
    .select()
    .single()

  return NextResponse.json(data)
}

// PATCH — marcar repaso como realizado y mover próxima revisión
export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { topic } = await req.json()
  if (!topic) {
    return NextResponse.json({ error: "topic is required" }, { status: 400 })
  }

  const nextReview = new Date()
  nextReview.setDate(nextReview.getDate() + 1)

  const { data, error } = await supabase
    .from("spaced_repetition")
    .update({
      next_review: nextReview.toISOString().split("T")[0],
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .eq("topic", topic)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}