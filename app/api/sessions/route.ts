import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

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
