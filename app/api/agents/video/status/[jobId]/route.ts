import { createClient } from "@/lib/supabase/server"

export async function GET(_req: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("video_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return Response.json({ error: "Job no encontrado." }, { status: 404 })
    }

    return Response.json({ job: data })
  } catch (error: any) {
    return Response.json({ error: error?.message || "Unexpected error" }, { status: 500 })
  }
}
