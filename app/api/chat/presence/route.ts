import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { online } = await req.json()
  await supabase.from("profiles").update({
    is_online: online,
    last_seen: new Date().toISOString(),
  }).eq("id", user.id)

  return Response.json({ ok: true })
}
