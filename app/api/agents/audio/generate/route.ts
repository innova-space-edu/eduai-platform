import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createNarration } from "@/lib/audio/narration-server"
import { createSongJob, deleteSongJob, listSongJobs } from "@/lib/audio/song-studio-server"

export const runtime = "nodejs"
export const maxDuration = 300

function isSongRequest(req: NextRequest, body?: Record<string, unknown>) {
  return req.nextUrl.searchParams.get("kind") === "song" || body?.kind === "song"
}

export async function GET(req: NextRequest) {
  if (!isSongRequest(req)) {
    return NextResponse.json({ error: "Método no disponible" }, { status: 405 })
  }
  return listSongJobs()
}

export async function DELETE(req: NextRequest) {
  if (!isSongRequest(req)) {
    return NextResponse.json({ error: "Método no disponible" }, { status: 405 })
  }
  return deleteSongJob(req.nextUrl.searchParams.get("id") || "")
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  if (isSongRequest(req, body)) return createSongJob(body)
  return createNarration(body)
}
