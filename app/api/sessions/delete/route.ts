import { createClient } from "@/lib/supabase/server"

export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { session_id } = await req.json()

  const { error } = await supabase
    .from("study_sessions")
    .delete()
    .eq("id", session_id)
    .eq("user_id", user.id)

  if (error) return new Response(error.message, { status: 500 })
  return new Response("OK", { status: 200 })
}
