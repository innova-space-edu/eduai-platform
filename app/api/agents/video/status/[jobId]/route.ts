import { createClient } from "@/lib/supabase/server"

type VideoStatusApiResponse = {
  ok: boolean
  job?: {
    id: string
    status: "queued" | "processing" | "completed" | "failed" | "canceled"
    prompt: string
    mode: "text-to-video" | "image-to-video"
    duration_seconds: number
    include_audio: boolean
    image_url?: string | null
    output_url?: string | null
    error_message?: string | null
    created_at?: string
    updated_at?: string
  }
  error?: string
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json<VideoStatusApiResponse>(
        {
          ok: false,
          error: "Unauthorized",
        },
        { status: 401 }
      )
    }

    const { data: job, error } = await supabase
      .from("video_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (error) {
      return Response.json<VideoStatusApiResponse>(
        {
          ok: false,
          error: error.message,
        },
        { status: 500 }
      )
    }

    if (!job) {
      return Response.json<VideoStatusApiResponse>(
        {
          ok: false,
          error: "Job no encontrado.",
        },
        { status: 404 }
      )
    }

    const payload = (job.request_payload || {}) as {
      prompt?: string
      mode?: string
      imageUrl?: string
      durationSeconds?: number
      audio?: { enabled?: boolean }
    }

    const uiMode =
      payload.mode === "image_to_video" ? "image-to-video" : "text-to-video"

    return Response.json<VideoStatusApiResponse>({
      ok: true,
      job: {
        id: job.id,
        status: job.status,
        prompt: payload.prompt || "",
        mode: uiMode,
        duration_seconds: Number(payload.durationSeconds || 6),
        include_audio: Boolean(payload.audio?.enabled),
        image_url: payload.imageUrl || null,
        output_url: job.video_url || null,
        error_message: job.error_message || null,
        created_at: job.created_at,
        updated_at: job.updated_at,
      },
    })
  } catch (error: any) {
    return Response.json<VideoStatusApiResponse>(
      {
        ok: false,
        error: error?.message || "Unexpected error",
      },
      { status: 500 }
    )
  }
}
