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
      .maybeSingle()
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
    // Verificar que no exista ya una solicitud
    const { data: existing } = await supabase.from("friendships")
      .select("id, status")
      .or(`and(requester_id.eq.${user.id},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${user.id})`)
      .maybeSingle()

    if (existing) {
      return Response.json({ ok: false, error: `Ya existe: ${existing.status}` })
    }

    const { data, error } = await supabase.from("friendships").insert({
      requester_id: user.id,
      addressee_id: addresseeId,
      status: "pending",
    }).select().single()

    console.log("Friendship insert:", { data, error, userId: user.id, addresseeId })
    return Response.json({ ok: !error, error: error?.message, data })
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
