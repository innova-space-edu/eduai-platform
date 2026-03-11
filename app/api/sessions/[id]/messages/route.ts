// app/api/sessions/[id]/messages/route.ts
// Retorna los mensajes guardados de una sesión específica.
// Los mensajes se guardan en la columna `messages` (JSONB) de study_sessions
// cuando completeSession() guarda el quiz. Si no existe esa columna todavía,
// retorna [] sin error para compatibilidad con sesiones antiguas.

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(req: Request, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { id } = await params

  const { data, error } = await supabase
    .from("study_sessions")
    .select("messages, user_id")
    .eq("id", id)
    .single()

  if (error) {
    // Si el error es que la columna no existe, retorna [] silenciosamente
    if (error.message?.includes("column") || error.message?.includes("messages")) {
      return NextResponse.json([])
    }
    return NextResponse.json([], { status: 200 })
  }

  // Verificar que la sesión pertenece al usuario
  if (data?.user_id !== user.id) {
    return new Response("Forbidden", { status: 403 })
  }

  return NextResponse.json(data?.messages || [])
}
