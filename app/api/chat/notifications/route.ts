import { createClient } from "@/lib/supabase/server"

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get("action")

  if (action === "unreadCount") {
    const { count } = await supabase.from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id).eq("read", false)
    return Response.json({ count: count || 0 })
  }

  const { data } = await supabase.from("notifications")
    .select("*").eq("user_id", user.id)
    .order("created_at", { ascending: false }).limit(20)
  return Response.json(data || [])
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { action, notificationId } = await req.json()

  if (action === "markRead") {
    await supabase.from("notifications").update({ read: true }).eq("id", notificationId).eq("user_id", user.id)
    return Response.json({ ok: true })
  }
  return Response.json({ ok: false })
}
