import { createClient } from "@/lib/supabase/server"
import { normalizeVideoRequest, type VideoRequestInput } from "@/lib/video-config"
import {
  enforceVideoLimits,
  getCachedCompletedVideo,
  hashVideoRequest,
} from "@/lib/video-agent"

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const input = (await req.json()) as VideoRequestInput
    const request = normalizeVideoRequest(input)

    if (!request.prompt) {
      return Response.json({ error: "El prompt es obligatorio." }, { status: 400 })
    }

    if (request.mode === "image_to_video" && !request.imageUrl && !request.imageBase64) {
      return Response.json({ error: "Para image_to_video debes enviar imageUrl o imageBase64." }, { status: 400 })
    }

    await enforceVideoLimits(user.id)

    const cached = await getCachedCompletedVideo(user.id, request)
    if (cached?.status === "completed" && cached.video_url) {
      return Response.json({
        reused: true,
        job: cached,
      })
    }

    const requestHash = hashVideoRequest(request)

    const { data: existing } = await supabase
      .from("video_jobs")
      .select("*")
      .eq("user_id", user.id)
      .eq("request_hash", requestHash)
      .in("status", ["queued", "processing", "completed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      return Response.json({ reused: true, job: existing })
    }

    const { data: inserted, error } = await supabase
      .from("video_jobs")
      .insert({
        user_id: user.id,
        status: "queued",
        request_hash: requestHash,
        request_payload: request,
        attempts: 0,
      })
      .select("*")
      .single()

    if (error || !inserted) {
      return Response.json({ error: error?.message || "No se pudo crear el job." }, { status: 500 })
    }

    return Response.json({
      reused: false,
      job: inserted,
      message: "Video en cola. Consulta el estado con el job id.",
    })
  } catch (error: any) {
    return Response.json({ error: error?.message || "Unexpected error" }, { status: 500 })
  }
}
