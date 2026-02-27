import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

// POST — crear sala
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { topic } = await req.json()
  const code = generateCode()

  const { data, error } = await supabase
    .from("study_rooms")
    .insert({ code, topic, host_id: user.id, status: "waiting" })
    .select()
    .single()

  if (error) return new Response(error.message, { status: 500 })
  return NextResponse.json(data)
}

// PATCH — unirse a sala
export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { code } = await req.json()

  const { data: room } = await supabase
    .from("study_rooms")
    .select("*")
    .eq("code", code.toUpperCase())
    .single()

  if (!room) return new Response("Sala no encontrada", { status: 404 })
  if (room.status === "full") return new Response("Sala llena", { status: 400 })
  if (room.host_id === user.id) return NextResponse.json(room)

  const { data, error } = await supabase
    .from("study_rooms")
    .update({ guest_id: user.id, status: "active" })
    .eq("id", room.id)
    .select()
    .single()

  if (error) return new Response(error.message, { status: 500 })
  return NextResponse.json(data)
}
