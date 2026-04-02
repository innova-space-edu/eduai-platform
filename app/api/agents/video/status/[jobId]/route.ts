import { NextResponse } from "next/server"
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
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorized",
        } satisfies VideoStatusApiResponse,
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
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        } satisfies VideoStatusApiResponse,
        { status: 500 }
      )
    }

    if (!job) {
      return NextResponse.json(
        {
          ok: false,
          error: "Job no encontrado.",
        } satisfies VideoStatusApiResponse,
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

    const uiMode: "text-to-video" | "image-to-video" =
      payload.mode === "image_to_video" ? "image-to-video" : "text-to-video"

    return NextResponse.json(
      {
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
      } satisfies VideoStatusApiResponse
    )
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Unexpected error",
      } satisfies VideoStatusApiResponse,
      { status: 500 }
    )
  }
}
