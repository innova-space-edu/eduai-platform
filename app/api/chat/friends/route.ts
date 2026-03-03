import { createClient } from "@/lib/supabase/server"

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")
  const action = searchParams.get("action")

  // Buscar usuario por código
  if (code) {
    const { data } = await supabase.from("profiles")
      .select("id, name, user_code, avatar_url, is_online, last_seen")
      .eq("user_code", code.toUpperCase())
      .neq("id", user.id)
      .single()
    return Response.json(data || null)
  }

  // Listar amigos
  if (action === "list") {
    const { data: friendships } = await supabase.from("friendships")
      .select("*, requester:requester_id(id,name,user_code,avatar_url,is_online,last_seen), addressee:addressee_id(id,name,user_code,avatar_url,is_online,last_seen)")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq("status", "accepted")
    return Response.json(friendships || [])
  }

  // Listar solicitudes pendientes
  if (action === "requests") {
    const { data } = await supabase.from("friendships")
      .select("*, requester:requester_id(id,name,user_code,avatar_url)")
      .eq("addressee_id", user.id)
      .eq("status", "pending")
    return Response.json(data || [])
  }

  return Response.json([])
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { action, addresseeId, friendshipId } = await req.json()

  if (action === "send") {
    const { error } = await supabase.from("friendships").insert({
      requester_id: user.id,
      addressee_id: addresseeId,
      status: "pending",
    })
    return Response.json({ ok: !error, error: error?.message })
  }

  if (action === "accept") {
    await supabase.from("friendships").update({ status: "accepted" }).eq("id", friendshipId)
    return Response.json({ ok: true })
  }

  if (action === "reject") {
    await supabase.from("friendships").delete().eq("id", friendshipId)
    return Response.json({ ok: true })
  }

  return Response.json({ ok: false })
}
